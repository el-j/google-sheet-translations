import type { TranslationData, TranslationValue } from "../types";

/**
 * Converts the translation object to the expected data.json format
 * @param translationObj - The translation object with locale->sheet->key->value structure
 * @param locales - Array of locale identifiers
 * @returns Converted data in the format expected for data.json
 */
export function convertToDataJsonFormat(
	translationObj: TranslationData,
	locales: string[],
): Record<string, unknown>[] {
	const result: Record<string, unknown>[] = [];
	console.log("Converting translation object to data.json format...");

	// Get all sheet names from all locales to make sure we don't miss any
	const allSheets = new Set<string>();
	for (const locale of Object.keys(translationObj)) {
		if (translationObj[locale]) {
			for (const sheet of Object.keys(translationObj[locale])) {
				allSheets.add(sheet);
			}
		}
	}

	console.log(`Found ${allSheets.size} sheets across all locales`);

	// Process each sheet
	for (const sheetTitle of allSheets) {
		// Create a new project object with the sheet title as the main key
		const projectData: Record<
			string,
			Record<string, Record<string, TranslationValue>>
		> = {};
		projectData[sheetTitle] = {};

		// For each locale, add all key-value pairs
		for (const locale of locales) {
			const localeKey = locale.toLowerCase();
			if (translationObj?.localeKey && translationObj[localeKey][sheetTitle]) {
				// Create the locale object
				projectData[sheetTitle][localeKey] = {};

				// Add all translations for this locale
				const translations = translationObj[localeKey][sheetTitle];
				for (const key of Object.keys(translations)) {
					projectData[sheetTitle][localeKey][key] = translations[key];
				}

				// Log how many translations we found for debugging
				console.log(
					`Found ${
						Object.keys(translations).length
					} keys for locale ${localeKey} in sheet ${sheetTitle}`,
				);
			}
		}

		// Only add non-empty projects
		if (Object.keys(projectData[sheetTitle]).length > 0) {
			result.push(projectData);
		}
	}

	console.log(`Created ${result.length} sheet entries for data.json`);
	return result;
}

export default convertToDataJsonFormat;
