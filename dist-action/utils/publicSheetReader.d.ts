import type { SheetRow } from "../types";
/**
 * Reads rows from a *publicly accessible* Google Spreadsheet sheet without
 * requiring any service-account credentials or API key.
 *
 * The spreadsheet must be shared with **"Anyone with link can view"** (or
 * broader). Works via Google's Visualization (gviz) query endpoint which
 * is available at no cost for public sheets.
 *
 * @param spreadsheetId - The Google Spreadsheet ID (from the URL)
 * @param sheetName     - The sheet tab name to fetch
 * @returns An array of row objects keyed by column header
 * @throws  If the sheet is not accessible or the response cannot be parsed
 */
export declare function readPublicSheet(spreadsheetId: string, sheetName: string): Promise<SheetRow[]>;
export default readPublicSheet;
//# sourceMappingURL=publicSheetReader.d.ts.map