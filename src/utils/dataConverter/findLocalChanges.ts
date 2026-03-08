import type { TranslationData } from "../../types";
import { getLanguagePrefix } from "../localeNormalizer";

/**
 * Resolves a locale key from `localData` to the corresponding key actually
 * present in `spreadsheetData`, using a three-step strategy:
 *
 * 1. Exact match            – `'en-us'` → `'en-us'`
 * 2. Lowercase match        – `'en-US'` → `'en-us'`
 * 3. Language-family prefix – `'en'` or `'en-GB'` → `'en-us'`
 *    (when `'en-us'` is the only English variant in the spreadsheet data)
 *
 * Returns `undefined` when no matching locale exists in `spreadsheetData`.
 */
function resolveLocaleAlias(
	locale: string,
	spreadsheetData: TranslationData,
): string | undefined {
	if (spreadsheetData[locale]) return locale;
	const lower = locale.toLowerCase();
	if (spreadsheetData[lower]) return lower;
	const langCode = getLanguagePrefix(lower);
	return Object.keys(spreadsheetData).find(
		(k) => getLanguagePrefix(k) === langCode,
	);
}

/**
 * Compares local languageData.json with spreadsheet data to find new keys.
 *
 * A key is considered "new" when:
 * - No matching locale exists in `spreadsheetData` for that locale, OR
 * - The sheet or key is absent for the resolved locale.
 *
 * Locale matching is fuzzy: `'en'` and `'en-GB'` will both match against
 * an `'en-us'` entry in `spreadsheetData` (language-family resolution).
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
		const resolvedLocale = resolveLocaleAlias(locale, spreadsheetData);

		// Check each sheet in local data
		for (const sheet of Object.keys(localData[locale])) {
			if (!localData[locale][sheet]) continue;

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
