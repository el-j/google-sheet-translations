import type { TranslationData, TranslationValue } from "../../types";

/**
 * Converts data.json format back to the translation object structure
 * @param dataJson - Data in the data.json format
 * @returns Converted data in the TranslationData format
 */

export function convertFromDataJsonFormat(
	dataJson: Record<string, unknown>[]
): TranslationData {
	const result: TranslationData = {};

	for (const projectData of dataJson) {
		for (const sheetTitle of Object.keys(projectData)) {
			const sheetData = projectData[sheetTitle] as Record<string, Record<string, TranslationValue>>;

			for (const locale of Object.keys(sheetData)) {
				// Initialize locale if it doesn't exist
				if (!result[locale]) {
					result[locale] = {};
				}

				// Initialize sheet if it doesn't exist
				if (!result[locale][sheetTitle]) {
					result[locale][sheetTitle] = {};
				}

				// Add all translations
				for (const key of Object.keys(sheetData[locale])) {
					result[locale][sheetTitle][key] = sheetData[locale][key];
				}
			}
		}
	}

	return result;
}
