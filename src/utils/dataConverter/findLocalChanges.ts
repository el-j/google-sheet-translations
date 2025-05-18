import type { TranslationData } from "../../types";

/**
 * Compares local data.json with spreadsheet data to find new keys
 * @param localData - Data from local data.json file
 * @param spreadsheetData - Data fetched from the spreadsheet
 * @returns Object with new keys that are in localData but not in spreadsheetData
 */

export function findLocalChanges(
	localData: TranslationData,
	spreadsheetData: TranslationData
): TranslationData {
	const changes: TranslationData = {};

	// Check each locale in local data
	for (const locale of Object.keys(localData)) {
		if (!localData[locale]) continue;

		// Check each sheet in local data
		for (const sheet of Object.keys(localData[locale])) {
			if (!localData[locale][sheet]) continue;

			// Check each key in local data
			for (const key of Object.keys(localData[locale][sheet])) {
				// If the spreadsheet doesn't have this locale, sheet, or key, it's a new key
				const isNewKey = !spreadsheetData[locale] ||
					!spreadsheetData[locale][sheet] ||
					!spreadsheetData[locale][sheet][key];

				// If it's a new key, add it to changes
				if (isNewKey) {
					if (!changes[locale]) changes[locale] = {};
					if (!changes[locale][sheet]) changes[locale][sheet] = {};
					changes[locale][sheet][key] = localData[locale][sheet][key];
				}
			}
		}
	}

	return changes;
}
