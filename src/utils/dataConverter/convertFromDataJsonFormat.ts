import type { TranslationData, TranslationValue } from "../../types";

/**
 * Type-guard: checks that a value has the shape of sheet data
 * (an object mapping locale → translation record)
 */
function isSheetData(
	v: unknown
): v is Record<string, Record<string, TranslationValue>> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Converts languageData.json format back to the translation object structure
 * @param dataJson - Data in the languageData.json format
 * @returns Converted data in the TranslationData format
 */
export function convertFromDataJsonFormat(
	dataJson: Record<string, unknown>[]
): TranslationData {
	const result: TranslationData = {};

	for (const projectData of dataJson) {
		for (const sheetTitle of Object.keys(projectData)) {
			const raw = projectData[sheetTitle];

			if (!isSheetData(raw)) {
				console.warn(`Skipping malformed entry for sheet "${sheetTitle}"`);
				continue;
			}

			for (const locale of Object.keys(raw)) {
				// Initialize locale if it doesn't exist
				if (!result[locale]) {
					result[locale] = {};
				}

				// Initialize sheet if it doesn't exist
				if (!result[locale][sheetTitle]) {
					result[locale][sheetTitle] = {};
				}

				const localeData = raw[locale];
				if (typeof localeData !== 'object' || localeData === null) {
					continue;
				}

				// Add all translations
				for (const key of Object.keys(localeData)) {
					result[locale][sheetTitle][key] = localeData[key];
				}
			}
		}
	}

	return result;
}
