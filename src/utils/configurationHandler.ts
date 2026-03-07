import path from "node:path";
import { DEFAULT_WAIT_SECONDS } from "../constants";

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
export function normalizeConfig(options: SpreadsheetOptions = {}): NormalizedConfig {
	return {
		rowLimit: options.rowLimit ?? 100,
		waitSeconds: options.waitSeconds ?? DEFAULT_WAIT_SECONDS,
		dataJsonPath: options.dataJsonPath ?? path.join(process.cwd(), "src/lib/languageData.json"),
		localesOutputPath: options.localesOutputPath ?? "src/i18n/locales.ts",
		translationsOutputDir: options.translationsOutputDir ?? "translations",
		syncLocalChanges: options.syncLocalChanges !== false, // Default to true
		autoTranslate: options.autoTranslate === true, // Default to false
		spreadsheetId: options.spreadsheetId,
		publicSheet: options.publicSheet === true, // Default to false
		autoCreate: options.autoCreate !== false, // Default to true
		spreadsheetTitle: options.spreadsheetTitle ?? 'google-sheet-translations',
		sourceLocale: options.sourceLocale ?? 'en',
		targetLocales: options.targetLocales ?? ['de', 'fr', 'es', 'it', 'pt', 'ja', 'zh'],
	};
}
