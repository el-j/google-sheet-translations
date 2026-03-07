import type { GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import type { SheetRow, TranslationData } from "../types";
import { wait } from "./wait";
import { filterValidLocales } from "./localeFilter";
import { createLocaleMapping } from "./localeNormalizer";

/**
 * Result of processing a single sheet
 */
export interface SheetProcessingResult {
	translations: TranslationData;
	locales: string[];
	localeMapping: Record<string, string>; // normalized -> original header
	originalMapping: Record<string, string>; // original header -> normalized
	success: boolean;
}

/**
 * Core row-processing logic shared by both the authenticated and public sheet paths.
 * Accepts pre-fetched rows (as plain objects) and returns the same
 * {@link SheetProcessingResult} shape that `processSheet` produces.
 *
 * @param rows       - Array of row objects keyed by column header
 * @param sheetTitle - The sheet tab name (used as namespace key in translations)
 * @param waitSeconds - Seconds to wait after processing (rate limiting)
 * @returns Processing result containing translations and locales
 */
export async function processRawRows(
	rows: SheetRow[],
	sheetTitle: string,
	waitSeconds: number,
): Promise<SheetProcessingResult> {
	const result: SheetProcessingResult = {
		translations: {},
		locales: [],
		localeMapping: {},
		originalMapping: {},
		success: false,
	};

	try {
		if (!rows || rows.length === 0) {
			console.warn(`No rows found in sheet "${sheetTitle}"`);
			return result;
		}

		// Extract header information
		const headerRow: string[] = Object.keys(rows[0]).map((key) => key.toLowerCase());
		console.log(`Header row for sheet "${sheetTitle}":`, headerRow);

		const keyColumn = headerRow[0];
		const validLocales = filterValidLocales(headerRow, keyColumn);

		if (validLocales.length === 0) {
			console.warn(`No valid locale columns found in sheet "${sheetTitle}"`);
			return result;
		}

		// Create locale mapping for normalization
		const originalHeaders = Object.keys(rows[0]); // Keep original case
		const { normalizedLocales, localeMapping, originalMapping } = createLocaleMapping(
			originalHeaders,
			keyColumn,
		);

		// Store the mappings in the result
		result.localeMapping = localeMapping;
		result.originalMapping = originalMapping;

		// Process each normalized locale
		for (const normalizedLocale of normalizedLocales) {
			// Find the original header for this normalized locale
			const originalHeader = localeMapping[normalizedLocale];
			if (!originalHeader) continue;

			const languageCells = rows.map((row: SheetRow) => {
				// Look for the key column (case-insensitive)
				const keyField = Object.keys(row).find((k) => k.toLowerCase() === keyColumn);

				if (!keyField || !row[keyField] || !row[originalHeader]) {
					return {}; // Skip rows without key or translation
				}

				const rowLocal: SheetRow = {};
				// Convert key to lowercase
				rowLocal[row[keyField].toString().toLowerCase()] = row[originalHeader];
				return rowLocal;
			});

			// Filter out empty objects before combining
			const nonEmptyLanguageCells = languageCells.filter(
				(cell) => Object.keys(cell).length > 0,
			);

			// Combine all keys into one object
			const prepareObj: Record<string, Record<string, string>> = {};
			prepareObj[sheetTitle] = nonEmptyLanguageCells.reduce<Record<string, string>>(
				(acc, cell) => Object.assign(acc, cell),
				{},
			);

			// Use normalized locale as the key in translations
			if (result.translations[normalizedLocale]) {
				result.translations[normalizedLocale] = {
					...result.translations[normalizedLocale],
					...prepareObj,
				};
			} else {
				result.translations[normalizedLocale] = { ...prepareObj };
			}
		}

		result.locales = normalizedLocales;
		result.success = true;

		await wait(waitSeconds, `after processing sheet: ${sheetTitle}`);
	} catch (error) {
		console.error(`Error processing sheet "${sheetTitle}":`, error);
	}

	return result;
}

/**
 * Processes a single Google Sheet and extracts translation data
 * @param sheet The Google Spreadsheet worksheet to process
 * @param sheetTitle The title of the sheet being processed
 * @param rowLimit Maximum number of rows to fetch
 * @param waitSeconds Time to wait after processing
 * @returns Processing result containing translations and locales
 */
export async function processSheet(
	sheet: GoogleSpreadsheetWorksheet,
	sheetTitle: string,
	rowLimit: number,
	waitSeconds: number,
): Promise<SheetProcessingResult> {
	const emptyResult: SheetProcessingResult = {
		translations: {},
		locales: [],
		localeMapping: {},
		originalMapping: {},
		success: false,
	};

	try {
		const googleRows = await sheet.getRows({ limit: rowLimit });

		if (!googleRows || googleRows.length === 0) {
			console.warn(`No rows found in sheet "${sheetTitle}"`);
			return emptyResult;
		}

		// Convert GoogleSpreadsheetRow objects to plain SheetRow objects
		const rows: SheetRow[] = googleRows.map((row) => row.toObject());

		return processRawRows(rows, sheetTitle, waitSeconds);
	} catch (error) {
		console.error(`Error processing sheet "${sheetTitle}":`, error);
		return emptyResult;
	}
}
