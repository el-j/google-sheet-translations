import type { GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import type { SheetRow, TranslationData } from "../types";
import { wait } from "./wait";
import { filterValidLocales } from "./localeFilter";

/**
 * Result of processing a single sheet
 */
export interface SheetProcessingResult {
	translations: TranslationData;
	locales: string[];
	success: boolean;
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
	waitSeconds: number
): Promise<SheetProcessingResult> {
	const result: SheetProcessingResult = {
		translations: {},
		locales: [],
		success: false
	};

	try {
		const rows = await sheet.getRows({ limit: rowLimit });

		if (!rows || rows.length === 0) {
			console.warn(`No rows found in sheet "${sheetTitle}"`);
			return result;
		}

		// Extract header information
		const rowObject = rows[0].toObject();
		const headerRow: string[] = Object.keys(rowObject).map(key => key.toLowerCase());
		console.log(`Header row for sheet "${sheetTitle}":`, headerRow);
		
		const keyColumn = headerRow[0];
		const locales = filterValidLocales(headerRow, keyColumn);
		
		if (locales.length === 0) {
			console.warn(`No valid locale columns found in sheet "${sheetTitle}"`);
			return result;
		}

		// Convert rows to data objects
		const cells = rows.map(row => row.toObject());

		if (!cells || cells.length === 0) {
			console.warn(`No cells data found for sheet "${sheetTitle}"`);
			return result;
		}

		// Process each locale
		for (const locale of locales) {
			const languageCells = cells.map((row: SheetRow) => {
				// Look for the key column (case-insensitive)
				const keyField = Object.keys(row).find(
					k => k.toLowerCase() === keyColumn
				);
				const localeField = Object.keys(row).find(
					k => k.toLowerCase() === locale
				);

				if (!keyField || !localeField || !row[keyField] || !row[localeField]) {
					return {}; // Skip rows without key or translation
				}

				const rowLocal: SheetRow = {};
				// Convert key to lowercase
				rowLocal[row[keyField].toString().toLowerCase()] = row[localeField];
				return rowLocal;
			});

			// Filter out empty objects before combining
			const nonEmptyLanguageCells = languageCells.filter(
				cell => Object.keys(cell).length > 0
			);

			// Combine all keys into one object
			const prepareObj: Record<string, Record<string, string>> = {};
			prepareObj[sheetTitle] = Object.assign({}, ...nonEmptyLanguageCells);

			if (result.translations[locale]) {
				result.translations[locale] = { ...result.translations[locale], ...prepareObj };
			} else {
				result.translations[locale] = { ...prepareObj };
			}
		}

		result.locales = locales;
		result.success = true;

		await wait(waitSeconds, `after processing sheet: ${sheetTitle}`);
		
	} catch (error) {
		console.error(`Error processing sheet "${sheetTitle}":`, error);
	}

	return result;
}
