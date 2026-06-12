import type { TranslationData } from './types';
import type { SpreadsheetOptions } from './utils/configurationHandler';
import { getSpreadSheetData } from './getSpreadSheetData';
import { mergeMultipleTranslationData } from './utils/multiSpreadsheetMerger';

export interface MultiSpreadsheetOptions extends SpreadsheetOptions {
	/** Array of spreadsheet IDs to fetch from. Overrides spreadsheetId if provided. */
	spreadsheetIds?: string[];
	/**
	 * How to merge same-locale same-sheet keys from different spreadsheets.
	 * 'later-wins': keys from later spreadsheets override earlier (default)
	 * 'first-wins': keep first occurrence of each key
	 */
	mergeStrategy?: 'later-wins' | 'first-wins';
}

/**
 * Fetches translations from multiple Google Spreadsheets and merges them.
 * When spreadsheetIds is not provided, falls back to options.spreadsheetId
 * or GOOGLE_SPREADSHEET_ID env var (same as getSpreadSheetData).
 */
export async function getMultipleSpreadSheetsData(
	docTitles?: string[],
	options: MultiSpreadsheetOptions = {},
): Promise<TranslationData> {
	const { spreadsheetIds, mergeStrategy = 'later-wins', ...baseOptions } = options;

	if (!spreadsheetIds || spreadsheetIds.length === 0) {
		return getSpreadSheetData(docTitles, baseOptions);
	}

	console.log(`[getMultipleSpreadSheetsData] Fetching ${spreadsheetIds.length} spreadsheets...`);

	const results: TranslationData[] = [];

	for (let i = 0; i < spreadsheetIds.length; i++) {
		const id = spreadsheetIds[i];
		console.log(`[getMultipleSpreadSheetsData] (${i + 1}/${spreadsheetIds.length}) "${id}"...`);
		const result = await getSpreadSheetData(docTitles, { ...baseOptions, spreadsheetId: id });
		results.push(result);
	}

	return mergeMultipleTranslationData(results, mergeStrategy);
}
