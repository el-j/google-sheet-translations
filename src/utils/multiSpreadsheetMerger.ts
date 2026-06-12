import type { TranslationData } from '../types';

/**
 * Merges multiple TranslationData results (from different spreadsheets) into one.
 * Sheets/keys from later spreadsheets override earlier ones if collisions occur.
 */
export function mergeMultipleTranslationData(
	results: TranslationData[],
	mergeStrategy: 'later-wins' | 'first-wins' = 'later-wins',
): TranslationData {
	const merged: TranslationData = {};

	for (const result of results) {
		for (const [locale, sheets] of Object.entries(result)) {
			if (!merged[locale]) {
				merged[locale] = {};
			}
			for (const [sheet, keys] of Object.entries(sheets)) {
				if (!merged[locale][sheet]) {
					merged[locale][sheet] = {};
				}
				for (const [key, value] of Object.entries(keys)) {
					if (mergeStrategy === 'first-wins' && key in merged[locale][sheet]) {
						continue;
					}
					merged[locale][sheet][key] = value;
				}
			}
		}
	}

	return merged;
}
