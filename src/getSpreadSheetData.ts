import { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "./types";
import { wait } from "./utils/wait";
import { createAuthClient } from "./utils/auth";
import { validateEnv } from "./utils/validateEnv";
import { normalizeConfig, type SpreadsheetOptions } from "./utils/configurationHandler";
import { processSheet } from "./utils/sheetProcessor";
import { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from "./utils/fileWriter";
import { handleBidirectionalSync } from "./utils/syncManager";

// Default wait time between API calls (in seconds)
export const DEFAULT_WAIT_SECONDS = 1;

/**
 * Fetches and processes data from a Google Spreadsheet
 * @param _docTitle - Array of sheet titles to process
 * @param options - Additional options for fetching data
 * @returns Processed translation data
 */
export async function getSpreadSheetData(
	_docTitle?: string[],
	options: SpreadsheetOptions = {},
): Promise<TranslationData> {
	// Normalize configuration with defaults
	const config = normalizeConfig(options);

	// Get spreadsheet ID from environment variables
	const { GOOGLE_SPREADSHEET_ID } = validateEnv();

	// Initialize Google Spreadsheet connection
	const serviceAuthClient = createAuthClient();
	const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID, serviceAuthClient);

	await doc.loadInfo(true);

	// Prepare sheet titles to process
	let docTitle: string[] = _docTitle || [];
	
	if (!docTitle || docTitle.length === 0) {
		console.warn("No sheet titles provided, cannot process spreadsheet data");
		return {};
	}
	
	// Always include i18n sheet if not already present
	if (!docTitle.includes("i18n")) {
		docTitle.push("i18n");
	}

	console.log(`Processing ${docTitle.length} sheets: ${docTitle.join(", ")}`);

	// Initialize result containers
	const finalTranslations: TranslationData = {};
	const allLocales = new Set<string>();
	const localesWithContent = new Set<string>(); // Track locales with actual translations in non-i18n sheets
	const globalLocaleMapping: Record<string, string> = {}; // normalized -> original header
	const globalOriginalMapping: Record<string, string> = {}; // original header -> normalized

	// Process each sheet in parallel
	await Promise.all(
		docTitle.map(async (title) => {
			await wait(config.waitSeconds, `before get cells for sheet: ${title}`);
			const sheet = doc.sheetsByTitle[title];

			if (!sheet) {
				console.warn(`Sheet "${title}" not found in the document`);
				return;
			}

			const result = await processSheet(sheet, title, config.rowLimit, config.waitSeconds);
			
			if (result.success) {
				// Merge locale mappings - prioritize first occurrence for consistency
				for (const [normalized, original] of Object.entries(result.localeMapping)) {
					if (!globalLocaleMapping[normalized]) {
						globalLocaleMapping[normalized] = original;
					}
				}
				for (const [original, normalized] of Object.entries(result.originalMapping)) {
					if (!globalOriginalMapping[original]) {
						globalOriginalMapping[original] = normalized;
					}
				}

				// Merge translations from this sheet into final result
				for (const locale of result.locales) {
					if (finalTranslations[locale]) {
						finalTranslations[locale] = { 
							...finalTranslations[locale], 
							...result.translations[locale] 
						};
					} else {
						finalTranslations[locale] = result.translations[locale];
					}
					allLocales.add(locale);
					
					// Only track locales with content from non-i18n sheets
					if (title !== "i18n" && result.translations[locale] && Object.keys(result.translations[locale]).length > 0) {
						// Check if this locale actually has translation content (not just empty objects)
						const hasActualTranslations = Object.values(result.translations[locale]).some(sheetTranslations => 
							Object.keys(sheetTranslations).length > 0
						);
						if (hasActualTranslations) {
							localesWithContent.add(locale);
						}
					}
				}
			}
		})
	);

	// Use locales with actual content for the locales file, fall back to all locales if none found
	const localesForOutput = localesWithContent.size > 0 ? Array.from(localesWithContent) : Array.from(allLocales);
	const allLocalesArray = Array.from(allLocales);

	// Handle bidirectional sync if needed
	const syncResult = await handleBidirectionalSync(
		doc,
		config.dataJsonPath,
		config.translationsOutputDir,
		config.syncLocalChanges,
		config.autoTranslate,
		finalTranslations,
		config.waitSeconds,
		globalLocaleMapping
	);

	// If sync requested a refresh, recursively call with updated data
	if (syncResult.shouldRefresh) {
		return getSpreadSheetData(_docTitle, {
			...options,
			syncLocalChanges: false, // Prevent infinite loop
		});
	}

	// Write output files - use all locales for translation files but filtered locales for locales.ts
	writeTranslationFiles(finalTranslations, allLocalesArray, config.translationsOutputDir);
	writeLocalesFile(localesForOutput, globalLocaleMapping, config.localesOutputPath);
	
	console.log(`Writing locales file with ${localesForOutput.length} locales that have actual translations:`, localesForOutput);
	
	// Write languageData.json if we have fresh data or it doesn't exist
	const hasData = Object.keys(finalTranslations).length > 0;
	if (hasData) {
		writeLanguageDataFile(finalTranslations, allLocalesArray, config.dataJsonPath);
	}

	return finalTranslations;
}

export default getSpreadSheetData;
