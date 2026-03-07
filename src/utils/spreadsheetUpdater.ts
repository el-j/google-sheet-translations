import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { withRetry } from "./rateLimiter";
import { getOriginalHeaderForLocale } from "./localeNormalizer";

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
 * Updates the Google Spreadsheet with new keys from local data
 * 
 * When autoTranslate is enabled:
 * - For each new key added to the spreadsheet, the system checks which languages have translations
 * - For languages missing translations, it automatically adds Google Translate formulas
 * - The formula format is: =GOOGLETRANSLATE(INDIRECT(sourceColumn&ROW());$sourceColumn$1;targetColumn$1)
 * - This dynamic formula uses cell references for language codes and automatically adapts to the correct row
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
 * @returns Promise that resolves when the update is complete
 */
export async function updateSpreadsheetWithLocalChanges(
    doc: GoogleSpreadsheet,
    changes: TranslationData,
    waitSeconds: number,
    autoTranslate = false,
    localeMapping: Record<string, string> = {}
): Promise<void> {
    console.log("Updating spreadsheet with local changes...");
    const baseDelayMs = waitSeconds * 1000;
    
    // Process each sheet in the changes object
    for (const sheetTitle of new Set(
        Object.values(changes).flatMap(locale => Object.keys(locale))
    )) {
        console.log(`Processing sheet: ${sheetTitle}`);
        const sheet = doc.sheetsByTitle[sheetTitle];
        
        if (!sheet) {
            console.warn(`Sheet "${sheetTitle}" not found in the document, cannot update`);
            continue;
        }
        
        // Get all rows from the sheet (retries automatically on rate-limit)
        const rows = await withRetry(
            () => sheet.getRows(),
            `getRows: ${sheetTitle}`,
            baseDelayMs,
        );
        
        if (!rows || rows.length === 0) {
            console.warn(`No rows found in sheet "${sheetTitle}", cannot update`);
            continue;
        }
        
        // Extract header information
        const rowObject = rows[0].toObject();
        const headerRow = Object.keys(rowObject).map(key => key.toLowerCase());
        const keyColumn = headerRow[0]; // First column is the key
        
        // Get all locales from the headerRow except the key column
        const locales = headerRow.filter(key => key !== keyColumn);
        
        // Map of existing keys to their row indices
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
                    
                    // Fallback to case-insensitive search in headerRow if mapping lookup fails
                    if (!localeHeader) {
                        localeHeader = headerRow.find(h => h.toLowerCase() === locale.toLowerCase());
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
                    
                    // Fallback to case-insensitive search if mapping lookup fails
                    if (!localeHeader) {
                        localeHeader = Object.keys(row.toObject()).find(
                            h => h.toLowerCase() === locale.toLowerCase()
                        );
                    }
                    
                    if (localeHeader) {
                        // Use set() method instead of direct property assignment to avoid TS errors
                        row.set(localeHeader, String(localeData[key]));
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
                            
                            // Skip if this locale already has a value
                            if (localesWithValues.has(localeLower) || rowData[localeHeader]) {
                                continue;
                            }
                            
                            // Find the exact case-preserved header name
                            const exactHeaderName = headerRow.find(
                                h => h.toLowerCase() === localeLower
                            );
                            
                            if (exactHeaderName) {
                                // Create Google Translate formula referring to the source column
                                // Since we don't know the exact row number yet, we'll use a special placeholder
                                // that will be replaced with the actual cell reference after the rows are added
                                
                                // Get the column index for the source locale to build the reference
                                const sourceHeaderIndex = headerRow.indexOf(sourceHeader);
                                // Get the column index for the target locale
                                const targetHeaderIndex = headerRow.indexOf(exactHeaderName);
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
                    () => sheet.addRows(chunk),
                    `addRows chunk ${Math.floor(i / CHUNK_SIZE) + 1} in ${sheetTitle}`,
                    baseDelayMs,
                );
            }
        }
    }
    
    console.log("Finished updating spreadsheet with local changes.");
}
