import type { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "../types";
import { findLocalChanges } from "./dataConverter/findLocalChanges";
import updateSpreadsheetWithLocalChanges from "./spreadsheetUpdater";
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
 * @returns Sync operation result
 */
export async function handleBidirectionalSync(
	doc: GoogleSpreadsheet,
	dataJsonPath: string,
	translationsOutputDir: string,
	syncLocalChanges: boolean,
	autoTranslate: boolean,
	spreadsheetData: TranslationData,
	waitSeconds: number
): Promise<SyncResult> {
	const result: SyncResult = {
		shouldRefresh: false,
		hasChanges: false
	};

	// Check if languageData.json exists and read it
	const localData = readDataJson(dataJsonPath);
	const dataJsonExists = localData !== null;
	
	// Check if we need to sync local changes to the spreadsheet
	const shouldSyncToSheet = syncLocalChanges && 
		dataJsonExists && 
		isDataJsonNewer(dataJsonPath, translationsOutputDir);

	if (!shouldSyncToSheet || !localData) {
		return result;
	}

	console.log("Local languageData.json is newer than translation files. Checking for changes...");
	
	// Find differences between local data and spreadsheet data
	const changes = findLocalChanges(localData, spreadsheetData);
	
	// Check if there are any actual changes
	const hasChanges = Object.keys(changes).length > 0 && 
		Object.keys(changes).some(locale => 
			Object.keys(changes[locale]).length > 0
		);

	if (!hasChanges) {
		console.log("No local changes found that need to be synced to the spreadsheet.");
		return result;
	}

	console.log("Found local changes to sync to the spreadsheet:");
	console.log(JSON.stringify(changes, null, 2));
	
	// Update the spreadsheet with the changes, passing the autoTranslate option
	await updateSpreadsheetWithLocalChanges(doc, changes, waitSeconds, autoTranslate);
	
	result.shouldRefresh = true;
	result.hasChanges = true;
	
	return result;
}
