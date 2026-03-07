import { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "./types";
import { wait } from "./utils/wait";
import { createAuthClient } from "./utils/auth";
import { validateEnv } from "./utils/validateEnv";
import { normalizeConfig, type SpreadsheetOptions } from "./utils/configurationHandler";
import { processSheet, processRawRows } from "./utils/sheetProcessor";
import { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from "./utils/fileWriter";
import { handleBidirectionalSync } from "./utils/syncManager";
import { readPublicSheet } from "./utils/publicSheetReader";
import { DEFAULT_WAIT_SECONDS } from "./constants";
export { DEFAULT_WAIT_SECONDS };

/**
 * Fetches and processes data from a Google Spreadsheet
 * @param _docTitle - Array of sheet titles to process
 * @param options - Additional options for fetching data
 * @returns Processed translation data
 */
const MAX_SYNC_REFRESH_DEPTH = 1;

export async function getSpreadSheetData(
	_docTitle?: string[],
	options: SpreadsheetOptions = {},
	_refreshDepth = 0,
): Promise<TranslationData> {
	// Normalize configuration with defaults
	const config = normalizeConfig(options);

	// Resolve spreadsheet ID: option takes precedence over env var
	const spreadsheetId =
		config.spreadsheetId ??
		(config.publicSheet
			? process.env.GOOGLE_SPREADSHEET_ID
			: validateEnv().GOOGLE_SPREADSHEET_ID);

	if (!spreadsheetId) {
		throw new Error(
			"No spreadsheet ID provided. Set the GOOGLE_SPREADSHEET_ID environment variable or pass spreadsheetId in options.",
		);
	}

	// Prepare sheet titles to process
	const docTitle: string[] = _docTitle ?? [];

	if (docTitle.length === 0) {
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

	if (config.publicSheet) {
		// ── Public (unauthenticated) path ─────────────────────────────────────
		await Promise.all(
			docTitle.map(async (title) => {
				await wait(config.waitSeconds, `before get cells for sheet: ${title}`);

				let rows;
				try {
					rows = await readPublicSheet(spreadsheetId, title);
				} catch (err) {
					console.warn(`Sheet "${title}" could not be fetched: ${(err as Error).message}`);
					return;
				}

				const result = await processRawRows(rows, title, config.waitSeconds);

				if (result.success) {
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

					for (const locale of result.locales) {
						if (finalTranslations[locale]) {
							finalTranslations[locale] = {
								...finalTranslations[locale],
								...result.translations[locale],
							};
						} else {
							finalTranslations[locale] = result.translations[locale];
						}
						allLocales.add(locale);

						if (title !== "i18n" && result.translations[locale]) {
							const hasActualTranslations = Object.values(
								result.translations[locale],
							).some((sheetTranslations) => Object.keys(sheetTranslations).length > 0);
							if (hasActualTranslations) {
								localesWithContent.add(locale);
							}
						}
					}
				}
			}),
		);
	} else {
		// ── Authenticated path (service account / JWT) ────────────────────────
		const serviceAuthClient = createAuthClient();
		const doc = new GoogleSpreadsheet(spreadsheetId, serviceAuthClient);

		try {
			await doc.loadInfo(true);
		} catch (err) {
			throw new Error(`Failed to load spreadsheet "${spreadsheetId}"`, { cause: err });
		}

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
								...result.translations[locale],
							};
						} else {
							finalTranslations[locale] = result.translations[locale];
						}
						allLocales.add(locale);

						// Only track locales with content from non-i18n sheets
						if (
							title !== "i18n" &&
							result.translations[locale] &&
							Object.keys(result.translations[locale]).length > 0
						) {
							// Check if this locale actually has translation content (not just empty objects)
							const hasActualTranslations = Object.values(
								result.translations[locale],
							).some((sheetTranslations) => Object.keys(sheetTranslations).length > 0);
							if (hasActualTranslations) {
								localesWithContent.add(locale);
							}
						}
					}
				}
			}),
		);

		// Handle bidirectional sync if needed (only available for authenticated sheets)
		const syncResult = await handleBidirectionalSync(
			doc,
			config.dataJsonPath,
			config.translationsOutputDir,
			config.syncLocalChanges,
			config.autoTranslate,
			finalTranslations,
			config.waitSeconds,
			globalLocaleMapping,
		);

		// If sync requested a refresh, recursively call with updated data (depth-limited)
		if (syncResult.shouldRefresh && _refreshDepth < MAX_SYNC_REFRESH_DEPTH) {
			return getSpreadSheetData(
				_docTitle,
				{
					...options,
					syncLocalChanges: false,
				},
				_refreshDepth + 1,
			);
		}
	}

	// Use locales with actual content for the locales file, fall back to all locales if none found
	const localesForOutput =
		localesWithContent.size > 0 ? Array.from(localesWithContent) : Array.from(allLocales);
	const allLocalesArray = Array.from(allLocales);

	// Write output files - use all locales for translation files but filtered locales for locales.ts
	writeTranslationFiles(finalTranslations, allLocalesArray, config.translationsOutputDir);
	writeLocalesFile(localesForOutput, globalLocaleMapping, config.localesOutputPath);

	console.log(
		`Writing locales file with ${localesForOutput.length} locales that have actual translations:`,
		localesForOutput,
	);

	// Write languageData.json if we have fresh data or it doesn't exist
	const hasData = Object.keys(finalTranslations).length > 0;
	if (hasData) {
		writeLanguageDataFile(finalTranslations, allLocalesArray, config.dataJsonPath);
	}

	return finalTranslations;
}

export default getSpreadSheetData;
