import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { findLocalChanges } from "./dataConverter/findLocalChanges";
import { updateSpreadsheetWithLocalChanges } from "./spreadsheetUpdater";
import { isDataJsonNewer } from "./isDataJsonNewer";
import { readDataJson } from "./readDataJson";

/**
 * Sync operation result
 */
export interface SyncResult {
	shouldRefresh: boolean;
	hasChanges: boolean;
}

/**
 * Checks if local changes need to be synced to the spreadsheet and performs the sync if needed
 * @param doc Google Spreadsheet document
 * @param dataJsonPath Path to the languageData.json file
 * @param translationsOutputDir Directory containing translation output files
 * @param syncLocalChanges Whether sync is enabled
 * @param autoTranslate Whether to auto-generate Google Translate formulas
 * @param spreadsheetData Current data from the spreadsheet
 * @param waitSeconds Time to wait between API calls
 * @param localeMapping Mapping from normalized locale codes to original spreadsheet headers
 * @param override When true AND autoTranslate is true, overwrite existing translations with formulas
 * @param cleanPush When true, push ALL keys from localData (bypasses timestamp guard and diff)
 * @returns Sync operation result
 */
export async function handleBidirectionalSync(
	doc: GoogleSpreadsheet,
	dataJsonPath: string,
	translationsOutputDir: string,
	syncLocalChanges: boolean,
	autoTranslate: boolean,
	spreadsheetData: TranslationData,
	waitSeconds: number,
	localeMapping: Record<string, string> = {},
	override = false,
	cleanPush = false
): Promise<SyncResult> {
	const result: SyncResult = {
		shouldRefresh: false,
		hasChanges: false
	};

	// Check if languageData.json exists and read it
	const localData = readDataJson(dataJsonPath);
	const dataJsonExists = localData !== null;
	
	// cleanPush bypasses the timestamp guard and syncs everything.
	// Normal path: only sync when the local file is newer than the output dir.
	const shouldSyncToSheet = dataJsonExists && (
		cleanPush ||
		(syncLocalChanges && isDataJsonNewer(dataJsonPath, translationsOutputDir))
	);

	if (!shouldSyncToSheet || !localData) {
		return result;
	}

	if (cleanPush) {
		console.log("Clean push enabled – pushing ALL keys from languageData.json to the spreadsheet...");
	} else {
		console.log("Local languageData.json is newer than translation files. Checking for changes...");
	}
	
	// cleanPush: use the full local dataset so every key is pushed/updated.
	// Normal path: only include keys that differ from the spreadsheet.
	const changes = cleanPush ? localData : findLocalChanges(localData, spreadsheetData);
	
	// Check if there are any actual changes
	const hasChanges = Object.keys(changes).length > 0 && 
		Object.keys(changes).some(locale => 
			Object.keys(changes[locale]).length > 0
		);

	if (!hasChanges) {
		console.log("No local changes found that need to be synced to the spreadsheet.");
		return result;
	}

	const localesCount = Object.keys(changes).length;
	const keysCount = Object.values(changes)
		.flatMap(l => Object.values(l))
		.flatMap(s => Object.keys(s)).length;
	const pushMode = cleanPush ? 'clean push' : 'incremental sync';
	console.log(`Found local changes (${pushMode}): ${localesCount} locale(s), ~${keysCount} key(s) to sync to the spreadsheet.`);
	
	// Update the spreadsheet with the changes, passing the autoTranslate option and locale mapping
	try {
		await updateSpreadsheetWithLocalChanges(doc, changes, waitSeconds, autoTranslate, localeMapping, override);
		result.shouldRefresh = true;
		result.hasChanges = true;
	} catch (err) {
		console.error("Failed to sync local changes to spreadsheet:", err);
		// Do not set shouldRefresh; return unchanged result to avoid stale refresh loop
	}

	return result;
}
