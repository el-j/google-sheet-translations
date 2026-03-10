/**
 * Configuration options for getSpreadSheetData
 */
export interface SpreadsheetOptions {
    rowLimit?: number;
    /**
     * Base back-off delay in seconds used when retrying Google Sheets API
     * calls that fail with a rate-limit response (HTTP 429 / 503).
     * The actual delay for each retry attempt is `waitSeconds * 2^attempt`,
     * capped at 30 seconds.  Defaults to 1.
     */
    waitSeconds?: number;
    dataJsonPath?: string;
    localesOutputPath?: string;
    translationsOutputDir?: string;
    syncLocalChanges?: boolean;
    autoTranslate?: boolean;
    /**
     * Google Spreadsheet ID.
     * Overrides the `GOOGLE_SPREADSHEET_ID` environment variable when provided.
     */
    spreadsheetId?: string;
    /**
     * When `true`, the spreadsheet is read through the Google Visualization
     * API without any service-account credentials.
     *
     * The spreadsheet must be shared as **"Anyone with link can view"** (or
     * broader). Bidirectional sync and auto-translate are unavailable in
     * this mode because they require write access.
     */
    publicSheet?: boolean;
    /**
     * Automatically create a new Google Spreadsheet when no spreadsheetId is
     * available and the caller is in authenticated mode.
     * Default: `true` (creation happens on the first run when no ID is set).
     */
    autoCreate?: boolean;
    /** Title for the auto-created spreadsheet (default: "google-sheet-translations"). */
    spreadsheetTitle?: string;
    /**
     * Source locale used when seeding the auto-created spreadsheet with
     * GOOGLETRANSLATE formulas (default: "en").
     */
    sourceLocale?: string;
    /**
     * Target locales for GOOGLETRANSLATE formulas in the auto-created spreadsheet.
     * Default: ['de', 'fr', 'es', 'it', 'pt', 'ja', 'zh'].
     */
    targetLocales?: string[];
}
/**
 * Normalized configuration with all defaults applied
 */
export interface NormalizedConfig {
    rowLimit: number;
    waitSeconds: number;
    dataJsonPath: string;
    localesOutputPath: string;
    translationsOutputDir: string;
    syncLocalChanges: boolean;
    autoTranslate: boolean;
    spreadsheetId: string | undefined;
    publicSheet: boolean;
    autoCreate: boolean;
    spreadsheetTitle: string;
    sourceLocale: string;
    targetLocales: string[];
}
/**
 * Normalizes configuration options by applying defaults
 */
export declare function normalizeConfig(options?: SpreadsheetOptions): NormalizedConfig;
//# sourceMappingURL=configurationHandler.d.ts.map