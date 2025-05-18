import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { wait } from "./wait";

/**
 * Updates the Google Spreadsheet with new keys from local data
 * @param doc - The Google Spreadsheet instance
 * @param changes - Object containing new keys to add to the spreadsheet
 * @param waitSeconds - Number of seconds to wait between API calls
 * @returns Promise that resolves when the update is complete
 */
export async function updateSpreadsheetWithLocalChanges(
    doc: GoogleSpreadsheet,
    changes: TranslationData,
    waitSeconds: number
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
        
        // Collect all new keys and their translations
        for (const locale of Object.keys(changes)) {
            if (!changes[locale]?.[sheetTitle]) continue;
            
            const localeData = changes[locale][sheetTitle];
            for (const key of Object.keys(localeData)) {
                const keyLower = key.toLowerCase();
                
                if (!existingKeys.has(keyLower)) {
                    if (!newKeys.has(keyLower)) {
                        newKeys.set(keyLower, { [keyColumn]: key });
                    }
                    
                    // Find the exact header for this locale (preserving case)
                    const localeHeader = headerRow.find(h => h.toLowerCase() === locale.toLowerCase());
                    if (localeHeader) {
                        const theKey = newKeys.get(keyLower);
                        if (!theKey) {
                            console.warn(`Key "${key}" not found in newKeys map, skipping...`);
                            continue;
                        }
                        // Use the correct header name for the locale value
                        theKey[localeHeader] = localeData[key] as string;
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
            
            const newRows = Array.from(newKeys.values());
            await wait(waitSeconds, `before adding ${newRows.length} new rows`);
            
            // Add new rows in chunks to avoid rate limiting
            const CHUNK_SIZE = 5;
            for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
                const chunk = newRows.slice(i, i + CHUNK_SIZE);
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
