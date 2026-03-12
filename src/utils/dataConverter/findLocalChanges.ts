import type { TranslationData } from "../../types";
import { resolveLocaleWithFallback } from "../localeNormalizer";
import { I18N_SHEET_NAME } from "../../constants";

/**
 * Compares local languageData.json with spreadsheet data to find new keys.
 *
 * A key is considered "new" when:
 * - No matching locale exists in `spreadsheetData` for that locale, OR
 * - The sheet or key is absent for the resolved locale.
 *
 * Locale matching is fuzzy: `'en'` and `'en-GB'` will both match against
 * an `'en-us'` entry in `spreadsheetData` (language-family resolution via
 * `resolveLocaleWithFallback`).
 *
 * @param localData - Data from local languageData.json file
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

		// Resolve the locale to the matching key in spreadsheetData (fuzzy match)
		const resolvedLocale = resolveLocaleWithFallback(locale, Object.keys(spreadsheetData));

		// Check each sheet in local data
		for (const sheet of Object.keys(localData[locale])) {
			if (!localData[locale][sheet]) continue;

			// The i18n sheet is a metadata sheet (locale display names).
			// Its contents must never be treated as new translation keys to push.
			if (sheet === I18N_SHEET_NAME) continue;

			// Check each key in local data
			for (const key of Object.keys(localData[locale][sheet])) {
				// If the spreadsheet doesn't have this locale, sheet, or key, it's a new key
				const isNewKey = !resolvedLocale ||
					!spreadsheetData[resolvedLocale]?.[sheet] ||
					!spreadsheetData[resolvedLocale][sheet][key];

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
