import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
/**
 * Sync operation result
 */
export interface SyncResult {
    shouldRefresh: boolean;
    hasChanges: boolean;
}
/**
 * Checks if local changes need to be synced to the spreadsheet and performs the sync if needed
 * @param doc Google Spreadsheet document
 * @param dataJsonPath Path to the languageData.json file
 * @param translationsOutputDir Directory containing translation output files
 * @param syncLocalChanges Whether sync is enabled
 * @param autoTranslate Whether to auto-generate Google Translate formulas
 * @param spreadsheetData Current data from the spreadsheet
 * @param waitSeconds Time to wait between API calls
 * @param localeMapping Mapping from normalized locale codes to original spreadsheet headers
 * @returns Sync operation result
 */
export declare function handleBidirectionalSync(doc: GoogleSpreadsheet, dataJsonPath: string, translationsOutputDir: string, syncLocalChanges: boolean, autoTranslate: boolean, spreadsheetData: TranslationData, waitSeconds: number, localeMapping?: Record<string, string>): Promise<SyncResult>;
//# sourceMappingURL=syncManager.d.ts.map