import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
/**
 * Updates the Google Spreadsheet with new keys from local data.
 *
 * When autoTranslate is enabled:
 * - For each new key added to the spreadsheet, the system checks which languages have translations
 * - For languages missing translations, it automatically adds Google Translate formulas
 * - The formula format is: =GOOGLETRANSLATE(INDIRECT(sourceColumn&ROW());$sourceColumn$1;targetColumn$1)
 * - This dynamic formula uses cell references for language codes and automatically adapts to the correct row
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
 * @returns Promise that resolves when the update is complete
 */
export declare function updateSpreadsheetWithLocalChanges(doc: GoogleSpreadsheet, changes: TranslationData, waitSeconds: number, autoTranslate?: boolean, localeMapping?: Record<string, string>): Promise<void>;
//# sourceMappingURL=spreadsheetUpdater.d.ts.map