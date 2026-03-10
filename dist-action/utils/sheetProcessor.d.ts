import type { GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import type { SheetRow, TranslationData } from "../types";
/**
 * Result of processing a single sheet
 */
export interface SheetProcessingResult {
    translations: TranslationData;
    locales: string[];
    localeMapping: Record<string, string>;
    originalMapping: Record<string, string>;
    success: boolean;
}
/**
 * Core row-processing logic shared by both the authenticated and public sheet paths.
 * Accepts pre-fetched rows (as plain objects) and returns the same
 * {@link SheetProcessingResult} shape that `processSheet` produces.
 * Contains only pure computation — no API calls are made here.
 *
 * @param rows       - Array of row objects keyed by column header
 * @param sheetTitle - The sheet tab name (used as namespace key in translations)
 * @returns Processing result containing translations and locales
 */
export declare function processRawRows(rows: SheetRow[], sheetTitle: string): Promise<SheetProcessingResult>;
/**
 * Fetches rows from a Google Sheet and extracts translation data.
 * The underlying `getRows` API call is automatically retried on rate-limit
 * responses (HTTP 429 / 503) using exponential back-off.
 *
 * @param sheet      The Google Spreadsheet worksheet to process
 * @param sheetTitle The title of the sheet being processed
 * @param rowLimit   Maximum number of rows to fetch
 * @param baseDelayMs Base back-off delay in ms for retrying rate-limited requests
 * @returns Processing result containing translations and locales
 */
export declare function processSheet(sheet: GoogleSpreadsheetWorksheet, sheetTitle: string, rowLimit: number, baseDelayMs?: number): Promise<SheetProcessingResult>;
//# sourceMappingURL=sheetProcessor.d.ts.map