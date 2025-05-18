import { GoogleSpreadsheet } from "google-spreadsheet";
import fs from "node:fs";
import path from "node:path";
import type { SheetRow, TranslationData } from "./types";
import { wait } from "./utils/wait";
import { createAuthClient } from "./utils/auth";
import { validateEnv } from "./utils/validateEnv";
import { 
	convertToDataJsonFormat} from "./utils/dataConverter/convertToDataJsonFormat";
import { findLocalChanges } from "./utils/dataConverter/findLocalChanges";
import updateSpreadsheetWithLocalChanges from "./utils/spreadsheetUpdater";
import { isDataJsonNewer } from "./utils/isDataJsonNewer";
import { readDataJson } from "./utils/readDataJson";

// Default wait time between API calls (in seconds)
export const DEFAULT_WAIT_SECONDS = 5;

/**
 * Fetches and processes data from a Google Spreadsheet
 * @param range - The range to fetch (currently not used but kept for API compatibility)
 * @param _docTitle - Array of sheet titles to process
 * @param options - Additional options for fetching data
 * @returns Processed translation data
 */
export async function getSpreadSheetData(
	_docTitle?: string[],
	options: {
		rowLimit?: number;
		waitSeconds?: number;
		dataJsonPath?: string;
		localesOutputPath?: string;
		translationsOutputDir?: string;
		syncLocalChanges?: boolean;
	} = {},
): Promise<TranslationData> {
	// Set defaults
	const waitSeconds = options.waitSeconds || DEFAULT_WAIT_SECONDS;
	const dataJsonPath =
		options.dataJsonPath || path.join(process.cwd(), "src/lib/data.json");
	const localesOutputPath = options.localesOutputPath || "src/i18n/locales.ts";
	const translationsOutputDir = options.translationsOutputDir || "translations";
	const syncLocalChanges = options.syncLocalChanges !== false; // Default to true

	// Get spreadsheet ID from environment variables
	const { GOOGLE_SPREADSHEET_ID } = validateEnv();
	const contentDocId = GOOGLE_SPREADSHEET_ID;

	const obj: TranslationData = {};
	const serviceAuthClient = createAuthClient();
	const doc = new GoogleSpreadsheet(contentDocId, serviceAuthClient);

	await doc.loadInfo(true);
	const prepareOutput: string[] = [];
	let dataUpdated = false;
	let locales: string[] = [];
	let docTitle: string[] = _docTitle || [];

	// Check if data.json exists and read it
	const localData = readDataJson(dataJsonPath);
	const dataJsonExists = localData !== null;
	
	// Check if we need to sync local changes to the spreadsheet
	const shouldSyncToSheet = syncLocalChanges && 
		dataJsonExists && 
		isDataJsonNewer(dataJsonPath, translationsOutputDir);

	// Start downloading and processing sheet data
	if (!docTitle || docTitle.length === 0) {
		console.warn("No sheet titles provided, cannot process spreadsheet data");
		return obj;
	}

	if (prepareOutput.length > 0) {
		docTitle = [...docTitle, ...prepareOutput];
	}

	// Log the sheets we're going to process
	console.log(`Processing ${docTitle.length} sheets: ${docTitle.join(", ")}`);

	await Promise.all(
		docTitle.map(async (title) => {
			await wait(waitSeconds, `before get cells for sheet: ${title}`);
			const sheet = doc.sheetsByTitle[title];

			if (!sheet) {
				console.warn(`Sheet "${title}" not found in the document`);
				return;
			}

			const rows = await sheet.getRows({ limit: options.rowLimit ?? 100 });

			if (!rows || rows.length === 0) {
				console.warn(`No rows found in sheet "${title}"`);
				return;
			}

			const rowObject = rows[0].toObject();
			const headerRow: string[] = Object.keys(rowObject).map((key) =>
				key.toLowerCase(),
			);
			console.log("headerRow", headerRow);
			const keyColumn = headerRow[0];
			locales = headerRow.filter((key) => {
				if (key !== keyColumn) {
					return key.toLowerCase();
				}
			});
			const cells = rows.map((row) => {
				const rowData = row.toObject();
				return rowData;
			});

			if (!cells || cells.length === 0) {
				console.warn(`No cells data found for sheet "${title}"`);
				return;
			}

			for (const locale of locales) {
				const languageCells = cells.map((row: SheetRow) => {
					// Look for the key column (case-insensitive)
					const keyField = Object.keys(row).find(
						(k) => k.toLowerCase() === keyColumn,
					);
					const localeField = Object.keys(row).find(
						(k) => k.toLowerCase() === locale,
					);

					if (
						!keyField ||
						!localeField ||
						!row[keyField] ||
						!row[localeField]
					) {
						return {}; // Skip rows without key or translation
					}

					const rowLocal: SheetRow = {};
					// Convert key to lowercase
					rowLocal[row[keyField].toString().toLowerCase()] = row[localeField];
					return rowLocal;
				});

				// Filter out empty objects before combining
				const nonEmptyLanguageCells = languageCells.filter(
					(cell) => Object.keys(cell).length > 0,
				);

				// Combine all keys into one object
				const prepareObj: Record<string, Record<string, string>> = {};
				prepareObj[title] = Object.assign({}, ...nonEmptyLanguageCells);

				if (obj[locale]) {
					obj[locale] = { ...obj[locale], ...prepareObj };
				} else {
					obj[locale] = { ...prepareObj };
				}
			}

			// Mark data as updated to indicate fresh content
			dataUpdated = true;

			await wait(waitSeconds, `after processing sheet: ${title}`);
		}),
	);

	// If we need to sync local changes to the spreadsheet, do it before writing files
	if (shouldSyncToSheet && localData) {
		console.log("Local data.json is newer than translation files. Checking for changes...");
		
		// Find differences between local data and spreadsheet data
		const changes = findLocalChanges(localData, obj);
		
		// If there are changes, update the spreadsheet
		if (
			Object.keys(changes).length > 0 && 
			Object.keys(changes).some(locale => 
				Object.keys(changes[locale]).length > 0
			)
		) {
			console.log("Found local changes to sync to the spreadsheet:");
			console.log(JSON.stringify(changes, null, 2));
			
			// Update the spreadsheet with the changes
			await updateSpreadsheetWithLocalChanges(doc, changes, waitSeconds);
			
			// Refresh the spreadsheet data to include the changes
			return getSpreadSheetData(_docTitle, {
				...options,
				syncLocalChanges: false, // Prevent infinite loop
			});
		}
		
		console.log("No local changes found that need to be synced to the spreadsheet.");
	}

	// Make sure the translations directory exists
	if (!fs.existsSync(translationsOutputDir)) {
		fs.mkdirSync(translationsOutputDir, { recursive: true });
	}

	// Create locales.ts file
	const localesOutputDir = path.dirname(localesOutputPath);
	if (!fs.existsSync(localesOutputDir)) {
		fs.mkdirSync(localesOutputDir, { recursive: true });
	}

	fs.writeFileSync(
		localesOutputPath,
		`export const locales = ${JSON.stringify(locales)};\nexport default locales;`,
		"utf8",
	);

	// Write files for all locales
	for (const locale of locales) {
		if (!obj[locale] || Object.keys(obj[locale]).length === 0) {
			console.warn(`No translations found for locale "${locale}"`);
			continue;
		}

		fs.writeFileSync(
			`${translationsOutputDir}/${locale.toLowerCase()}.json`,
			JSON.stringify(obj[locale], null, 2),
			"utf8",
		);
		console.log(`Successfully wrote translations for ${locale}`);
	}

	// If we have updated data, write it to data.json
	if (dataUpdated || !dataJsonExists) {
		// Create data.json directory if it doesn't exist
		const dataJsonDir = path.dirname(dataJsonPath);
		if (!fs.existsSync(dataJsonDir)) {
			fs.mkdirSync(dataJsonDir, { recursive: true });
		}

		// Convert the object format to the array format expected in data.json
		const dataJsonContent = convertToDataJsonFormat(obj, locales);

		// Write the updated data to data.json
		fs.writeFileSync(
			dataJsonPath,
			JSON.stringify(dataJsonContent, null, 2),
			"utf8",
		);
		console.log("Successfully updated data.json with fresh spreadsheet data");
	}

	return obj;
}

export default getSpreadSheetData;
