import type { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { withRetry } from "./rateLimiter";
import { getOriginalHeaderForLocale, getLanguagePrefix } from "./localeNormalizer";
import { I18N_SHEET_NAME } from "../constants";

/** Converts a 0-based column index to a spreadsheet column letter (A, B, ..., Z, AA, AB, ...) */
function columnIndexToLetter(index: number): string {
    let result = '';
    let i = index;
    do {
        result = String.fromCharCode(65 + (i % 26)) + result;
        i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    return result;
}

/**
 * Updates the Google Spreadsheet with new keys from local data.
 *
 * When autoTranslate is enabled:
 * - For each new key added to the spreadsheet, the system checks which languages have translations
 * - For languages missing translations, it automatically adds Google Translate formulas
 * - The formula format is: =GOOGLETRANSLATE(INDIRECT(sourceColumn&ROW());$sourceColumn$1;targetColumn$1)
 * - This dynamic formula uses cell references for language codes and automatically adapts to the correct row
 * - For **existing** keys the same logic applies: empty cells in other language columns receive a
 *   formula; cells that already contain a translation are only overwritten when `override` is true.
 *
 * If a sheet named `sheetTitle` does not yet exist in the document and `localeMapping` is
 * non-empty, the sheet is **created automatically** with "key" as the first column followed by
 * the original locale-header names from `localeMapping`.  This ensures that new feature sheets
 * (e.g. "ui") are bootstrapped on the first sync without requiring manual spreadsheet setup.
 *
 * Example:
 * If a new key "welcome" has an English translation in column B but no German translation in column C,
 * and autoTranslate is enabled, the system will add:
 * =GOOGLETRANSLATE(INDIRECT("B"&ROW());$B$1;C$1) to the German column
 *
 * @param doc - The Google Spreadsheet instance
 * @param changes - Object containing new keys to add to the spreadsheet
 * @param waitSeconds - Base back-off delay in seconds for retrying rate-limited API calls
 * @param autoTranslate - Whether to add Google Translate formulas for missing translations (default: false)
 * @param localeMapping - Mapping from normalized locale codes to original spreadsheet headers
 * @param override - When true AND autoTranslate is true, existing translations in other language
 *   columns are overwritten with GOOGLETRANSLATE formulas.  When false (default) only empty cells
 *   receive a formula.
 * @returns Promise that resolves when the update is complete
 */
export async function updateSpreadsheetWithLocalChanges(
    doc: GoogleSpreadsheet,
    changes: TranslationData,
    waitSeconds: number,
    autoTranslate = false,
    localeMapping: Record<string, string> = {},
    override = false
): Promise<void> {
    console.log("Updating spreadsheet with local changes...");
    const baseDelayMs = waitSeconds * 1000;
    
    // Process each sheet in the changes object
    for (const sheetTitle of new Set(
        Object.values(changes).flatMap(locale => Object.keys(locale))
    )) {
        // The i18n sheet is a reserved metadata sheet (locale display names).
        // Translation key pushes must NEVER touch it.
        if (sheetTitle === I18N_SHEET_NAME) {
            console.log(`Skipping reserved metadata sheet "${sheetTitle}" – its content is managed separately.`);
            continue;
        }
        console.log(`Processing sheet: ${sheetTitle}`);
        // Allow re-assignment: sheet may be auto-created below
        let sheet = doc.sheetsByTitle[sheetTitle] as GoogleSpreadsheetWorksheet | undefined;
        
        if (!sheet) {
            const localeHeaders = Object.values(localeMapping);
            if (localeHeaders.length === 0) {
                console.warn(`Sheet "${sheetTitle}" not found in the document, cannot update`);
                continue;
            }
            console.log(`Sheet "${sheetTitle}" not found — creating it with ${localeHeaders.length} locale column(s).`);
            sheet = await withRetry(
                () => doc.addSheet({ title: sheetTitle, headerValues: ['key', ...localeHeaders] }),
                `addSheet: ${sheetTitle}`,
                baseDelayMs,
            );
        }

        // Safety guard — should never be reached, but satisfies TypeScript
        if (!sheet) {
            console.warn(`Sheet "${sheetTitle}" could not be found or created, skipping.`);
            continue;
        }
        
        // Get all rows from the sheet (retries automatically on rate-limit)
        const rows = await withRetry(
            () => sheet!.getRows(),
            `getRows: ${sheetTitle}`,
            baseDelayMs,
        );
        
        // Determine column headers.
        // Normal path: derive from the first data row (most reliable).
        // Empty-sheet path: the sheet was just auto-created (or had all rows deleted);
        // reconstruct from localeMapping so we can still add new keys correctly.
        let headerRow: string[];
        let originalHeaders: string[];

        if (rows.length > 0) {
            originalHeaders = Object.keys(rows[0].toObject());
            headerRow = originalHeaders.map(h => h.toLowerCase());
        } else {
            const localeHeaders = Object.values(localeMapping);
            if (localeHeaders.length === 0) {
                console.warn(`No rows found in sheet "${sheetTitle}", cannot update`);
                continue;
            }
            // Reconstruct headers from the locale mapping (original case preserved)
            originalHeaders = ['key', ...localeHeaders];
            headerRow = originalHeaders.map(h => h.toLowerCase());
        }

        const keyColumn = headerRow[0]; // First column is always the key column
        
        // Get all locales from the headerRow except the key column
        const locales = headerRow.filter(key => key !== keyColumn);
        
        // Map of existing keys to their row indices (empty when rows.length === 0)
        const existingKeys = new Map<string, number>();
        rows.forEach((row, index) => {
            const rowData = row.toObject();
            const keyField = Object.keys(rowData).find(k => k.toLowerCase() === keyColumn);
            
            if (keyField && rowData[keyField]) {
                // Store the key in lowercase for case-insensitive comparison
                existingKeys.set(rowData[keyField].toString().toLowerCase(), index);
            }
        });
        
        // New keys to add to the sheet
        const newKeys = new Map<string, Record<string, string>>();
        
        // Track which locales have values for each new key (for auto-translation)
        const keyLocalesMap = new Map<string, Map<string, string>>();

        // Precompute which locale headers are explicitly pushed for each existing key.
        // This prevents auto-translate formulas from overwriting values that will be
        // (or have been) set by another locale iteration in the same push batch.
        const pushedLocaleHeadersPerKey = new Map<string, Set<string>>();
        if (autoTranslate) {
            for (const pushedLocale of Object.keys(changes)) {
                if (!changes[pushedLocale]?.[sheetTitle]) continue;
                for (const pushedKey of Object.keys(changes[pushedLocale][sheetTitle])) {
                    const pushedKeyLower = pushedKey.toLowerCase();
                    if (!existingKeys.has(pushedKeyLower)) continue; // new keys handled separately

                    let pushedHeader = getOriginalHeaderForLocale(pushedLocale, localeMapping);
                    if (!pushedHeader) {
                        const prefix = getLanguagePrefix(pushedLocale);
                        pushedHeader = originalHeaders.find(h => getLanguagePrefix(h) === prefix);
                    }
                    if (pushedHeader) {
                        if (!pushedLocaleHeadersPerKey.has(pushedKeyLower)) {
                            pushedLocaleHeadersPerKey.set(pushedKeyLower, new Set());
                        }
                        pushedLocaleHeadersPerKey.get(pushedKeyLower)!.add(pushedHeader.toLowerCase());
                    }
                }
            }
        }
        
        // Collect all new keys and their translations
        for (const locale of Object.keys(changes)) {
            if (!changes[locale]?.[sheetTitle]) continue;
            
            const localeData = changes[locale][sheetTitle];
            for (const key of Object.keys(localeData)) {
                const keyLower = key.toLowerCase();
                
                if (!existingKeys.has(keyLower)) {
                    if (!newKeys.has(keyLower)) {
                        newKeys.set(keyLower, { [keyColumn]: key });
                        // Initialize map for this key's locale values
                        keyLocalesMap.set(keyLower, new Map<string, string>());
                    }
                    
                    // Find the exact header for this locale using the mapping
                    let localeHeader = getOriginalHeaderForLocale(locale, localeMapping);
                    
                    // Fallback: language-family prefix match against original-case sheet headers
                    // e.g. locale 'en' finds column header 'en-US' (not the lowercase 'en-us')
                    if (!localeHeader) {
                        const localeLang = getLanguagePrefix(locale);
                        localeHeader = originalHeaders.find(
                            h => getLanguagePrefix(h) === localeLang
                        );
                    }
                    
                    if (localeHeader) {
                        const theKey = newKeys.get(keyLower);
                        if (!theKey) {
                            console.warn(`Key "${key}" not found in newKeys map, skipping...`);
                            continue;
                        }
                        
                        const value = String(localeData[key]);
                        
                        // Use the correct header name for the locale value
                        theKey[localeHeader] = value;
                        
                        // Store this locale value for potential auto-translation
                        const localesForKey = keyLocalesMap.get(keyLower);
                        if (localesForKey) {
                            localesForKey.set(locale.toLowerCase(), localeHeader);
                        }
                    }
                } else {
                    // Update existing key with new translation
                    const rowIndex = existingKeys.get(keyLower)!;
                    const row = rows[rowIndex];
                    
                    // Find the exact header for this locale using the mapping
                    let localeHeader = getOriginalHeaderForLocale(locale, localeMapping);
                    
                    // Fallback: language-family prefix match against the row's own keys
                    // e.g. locale 'en' finds column header 'en-US' on the existing row
                    if (!localeHeader) {
                        const localeLang = getLanguagePrefix(locale);
                        localeHeader = Object.keys(row.toObject()).find(
                            h => getLanguagePrefix(h) === localeLang
                        );
                    }
                    
                    if (localeHeader) {
                        // Use set() method instead of direct property assignment to avoid TS errors
                        row.set(localeHeader, String(localeData[key]));

                        // When autoTranslate is enabled, also fill other language columns:
                        // - empty columns always get a GOOGLETRANSLATE formula
                        // - non-empty columns are overwritten only when override=true
                        // Columns that are explicitly being pushed (via another locale entry in
                        // this batch) are skipped to avoid racing with their actual value.
                        if (autoTranslate) {
                            const sourceHeaderLower = localeHeader.toLowerCase();
                            const sourceHeaderIndex = headerRow.indexOf(sourceHeaderLower);

                            if (sourceHeaderIndex >= 0) {
                                const sourceColumnLetter = columnIndexToLetter(sourceHeaderIndex);
                                // Snapshot current cell values each time so that formula-fills made
                                // by an earlier locale iteration for the same key are visible here
                                // (and therefore not duplicated for that target column).
                                const rowObj = row.toObject();
                                const pushedHeaders = pushedLocaleHeadersPerKey.get(keyLower) ?? new Set<string>();

                                for (const targetLocaleHeader of locales) {
                                    const targetLower = targetLocaleHeader.toLowerCase();
                                    // Skip the source locale itself
                                    if (targetLower === sourceHeaderLower) continue;
                                    // Skip locales that are also being explicitly pushed for this key
                                    if (pushedHeaders.has(targetLower)) continue;

                                    const targetHeaderIndex = headerRow.indexOf(targetLower);
                                    if (targetHeaderIndex < 0) continue;

                                    // Use original-case header name for row.set()
                                    const exactTargetHeader = originalHeaders.find(
                                        h => h.toLowerCase() === targetLower
                                    );
                                    if (!exactTargetHeader) continue;

                                    const existingValue = rowObj[exactTargetHeader];
                                    const isEmpty = !existingValue || existingValue.toString().trim() === '';

                                    if (isEmpty || override) {
                                        const targetColumnLetter = columnIndexToLetter(targetHeaderIndex);
                                        row.set(
                                            exactTargetHeader,
                                            `=GOOGLETRANSLATE(INDIRECT("${sourceColumnLetter}"&ROW());$${sourceColumnLetter}$1;${targetColumnLetter}$1)`
                                        );
                                    }
                                }
                            }
                        }

                        try {
                            await withRetry(
                                () => row.save(),
                                `save row ${rowIndex} in ${sheetTitle}`,
                                baseDelayMs,
                            );
                        } catch (err) {
                            console.error(
                                `Failed to save row for key "${keyLower}" in sheet "${sheetTitle}":`,
                                err
                            );
                        }
                    }
                }
            }
        }
        
        // Add new keys to the sheet
        if (newKeys.size > 0) {
            console.log(`Adding ${newKeys.size} new keys to sheet ${sheetTitle}...`);
            
            // Apply auto-translation for new keys if enabled
            if (autoTranslate) {
                // Process each new key
                for (const [keyLower, rowData] of newKeys.entries()) {
                    const localesWithValues = keyLocalesMap.get(keyLower);
                    
                    if (localesWithValues && localesWithValues.size > 0) {
                        // Pick the first locale with a value as the source for translation
                        const [, sourceHeader] = [...localesWithValues.entries()][0];
                        
                        // Find the cell reference for the source value
                        // In Google Sheets formulas, we need to use column letters (A, B, C...) and row numbers
                        
                        // For each locale that doesn't have a value, add a GOOGLETRANSLATE formula
                        for (const localeHeader of locales) {
                            const localeLower = localeHeader.toLowerCase();
                            
                            // Skip if this locale already has a value.
                            // rowData keys may be mixed-case (e.g. "en-GB"), so use a
                            // case-insensitive lookup instead of a direct key access.
                            const rowDataKey = Object.keys(rowData).find(k => k.toLowerCase() === localeLower);
                            if (localesWithValues.has(localeLower) || (rowDataKey && rowData[rowDataKey])) {
                                continue;
                            }
                            
                            // Find the exact case-preserved header name (from originalHeaders, not the
                            // all-lowercase headerRow, so we store the formula under the correct key).
                            const exactHeaderName = originalHeaders.find(
                                h => h.toLowerCase() === localeLower
                            );
                            
                            if (exactHeaderName) {
                                // Create Google Translate formula referring to the source column
                                // Since we don't know the exact row number yet, we'll use a special placeholder
                                // that will be replaced with the actual cell reference after the rows are added
                                
                                // headerRow is fully lowercased; normalise both source and target headers to
                                // lowercase for the index lookup so mixed-case headers (e.g. "en-GB") are found.
                                const sourceHeaderIndex = headerRow.indexOf(sourceHeader.toLowerCase());
                                // Get the column index for the target locale (use lowercase for headerRow lookup)
                                const targetHeaderIndex = headerRow.indexOf(exactHeaderName.toLowerCase());
                                // Guard against unexpected out-of-range indices
                                if (sourceHeaderIndex < 0 || targetHeaderIndex < 0) {
                                    continue;
                                }
                                const sourceColumnLetter = columnIndexToLetter(sourceHeaderIndex);
                                const targetColumnLetter = columnIndexToLetter(targetHeaderIndex);
                                
                                // Create improved Google Translate formula using INDIRECT and cell references
                                // This formula dynamically references:
                                // - INDIRECT(sourceColumn&ROW()) for the source text
                                // - $sourceColumn$1 for the source language code from header
                                // - targetColumn$1 for the target language code from header
                                rowData[exactHeaderName] = `=GOOGLETRANSLATE(INDIRECT("${sourceColumnLetter}"&ROW());$${sourceColumnLetter}$1;${targetColumnLetter}$1)`;
                            }
                        }
                    }
                }
            }
            
            const newRows = Array.from(newKeys.values());
            
            // Add new rows in chunks to keep individual requests manageable
            const CHUNK_SIZE = 5;
            
            for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
                const chunk = newRows.slice(i, i + CHUNK_SIZE);
                await withRetry(
                    () => sheet!.addRows(chunk),
                    `addRows chunk ${Math.floor(i / CHUNK_SIZE) + 1} in ${sheetTitle}`,
                    baseDelayMs,
                );
            }
        }
    }
    
    console.log("Finished updating spreadsheet with local changes.");
}
