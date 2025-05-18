import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { wait } from "./wait";

/**
 * Updates the Google Spreadsheet with new keys from local data
 * 
 * When autoTranslate is enabled:
 * - For each new key added to the spreadsheet, the system checks which languages have translations
 * - For languages missing translations, it automatically adds Google Translate formulas
 * - The formula format is: =GOOGLETRANSLATE(sourceCell, "sourceLocale", "targetLocale")
 * - The source is the first available translation for that key
 * 
 * Example:
 * If a new key "welcome" has an English translation but no German translation,
 * and autoTranslate is enabled, the system will add:
 * =GOOGLETRANSLATE(B23, "en-us", "de") to the German column
 * 
 * @param doc - The Google Spreadsheet instance
 * @param changes - Object containing new keys to add to the spreadsheet
 * @param waitSeconds - Number of seconds to wait between API calls
 * @param autoTranslate - Whether to add Google Translate formulas for missing translations (default: false)
 * @returns Promise that resolves when the update is complete
 */
export async function updateSpreadsheetWithLocalChanges(
    doc: GoogleSpreadsheet,
    changes: TranslationData,
    waitSeconds: number,
    autoTranslate = false
): Promise<void> {
    console.log("Updating spreadsheet with local changes...");
    
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
        
        // Get all rows from the sheet
        await wait(waitSeconds, `before getting rows for sheet: ${sheetTitle}`);
        const rows = await sheet.getRows();
        
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
                    
                    // Find the exact header for this locale (preserving case)
                    const localeHeader = headerRow.find(h => h.toLowerCase() === locale.toLowerCase());
                    if (localeHeader) {
                        const theKey = newKeys.get(keyLower);
                        if (!theKey) {
                            console.warn(`Key "${key}" not found in newKeys map, skipping...`);
                            continue;
                        }
                        
                        const value = localeData[key] as string;
                        
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
                    const rowIndex = existingKeys.get(keyLower) as number;
                    const row = rows[rowIndex];
                    
                    // Find the exact header for this locale (preserving case)
                    const localeHeader = Object.keys(row.toObject()).find(
                        h => h.toLowerCase() === locale.toLowerCase()
                    );
                    
                    if (localeHeader) {
                        // Use set() method instead of direct property assignment to avoid TS errors
                        row.set(localeHeader, localeData[key] as string);
                        await wait(waitSeconds / 2, `before updating row ${rowIndex}`);
                        await row.save();
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
                        const [sourceLocale, sourceHeader] = [...localesWithValues.entries()][0];
                        
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
                                const sourceColumnLetter = String.fromCharCode(65 + sourceHeaderIndex); // Convert index to letter (A, B, C...)
                                
                                // Extract locale part (e.g., 'en', 'fr', 'de') - assumes headerRow contains locale codes
                                // This creates formulas like =GOOGLETRANSLATE(B2, "en", "fr") for translating from English to French
                                const sourceLocaleCode = sourceLocale.split('-')[0] || sourceLocale;
                                const targetLocaleCode = localeLower.split('-')[0] || localeLower;
                                
                                // Create the formula with a special placeholder for the row number
                                rowData[exactHeaderName] = `=GOOGLETRANSLATE(${sourceColumnLetter}{{ROW_NUMBER}}, "${sourceLocaleCode}", "${targetLocaleCode}")`;
                            }
                        }
                    }
                }
            }
            
            const newRows = Array.from(newKeys.values());
            await wait(waitSeconds, `before adding ${newRows.length} new rows`);
            
            // Add new rows in chunks to avoid rate limiting
            const CHUNK_SIZE = 5;
            
            // Calculate the starting row number for GOOGLETRANSLATE formulas
            const startingRowNumber = rows.length + 2; // +2 because Google Sheets is 1-indexed and we need to account for the header row
            
            for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
                const chunk = newRows.slice(i, i + CHUNK_SIZE);
                
                // Replace the {{ROW_NUMBER}} placeholder with actual row numbers
                if (autoTranslate) {
                    chunk.forEach((rowData, index) => {
                        const rowNumber = startingRowNumber + i + index;
                        for (const key in rowData) {
                            const value = rowData[key];
                            if (typeof value === 'string' && value.includes('{{ROW_NUMBER}}')) {
                                rowData[key] = value.replace('{{ROW_NUMBER}}', rowNumber.toString());
                            }
                        }
                        
                    });
                }
                
                await sheet.addRows(chunk);
                
                if (i + CHUNK_SIZE < newRows.length) {
                    await wait(waitSeconds, `after adding ${chunk.length} rows (chunk ${i / CHUNK_SIZE + 1})`);
                }
            }
        }
        
        await wait(waitSeconds, `after updating sheet: ${sheetTitle}`);
    }
    
    console.log("Finished updating spreadsheet with local changes.");
}

export default updateSpreadsheetWithLocalChanges;
