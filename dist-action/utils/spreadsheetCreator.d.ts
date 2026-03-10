import type { JWT } from "google-auth-library";
export interface CreateSpreadsheetOptions {
    /** Spreadsheet title (default: "google-sheet-translations") */
    title?: string;
    /** Source locale column header – translations in this locale are real text (default: "en") */
    sourceLocale?: string;
    /** Additional locale columns – filled with GOOGLETRANSLATE formulas (default: common languages) */
    targetLocales?: string[];
    /** Seed keys: key → source-locale value. If omitted a starter template is used. */
    seedKeys?: Record<string, string>;
}
export interface CreatedSpreadsheetInfo {
    spreadsheetId: string;
    url: string;
}
/**
 * Creates a new Google Spreadsheet seeded with translation starter content and
 * GOOGLETRANSLATE formulas for every non-source locale.
 *
 * Returns the spreadsheet ID and URL.
 */
export declare function createSpreadsheet(authClient: JWT, options?: CreateSpreadsheetOptions): Promise<CreatedSpreadsheetInfo>;
//# sourceMappingURL=spreadsheetCreator.d.ts.map