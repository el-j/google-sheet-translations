import fs from "node:fs";
import path from "node:path";
import type { TranslationData } from "../types";
import { convertToDataJsonFormat } from "./dataConverter/convertToDataJsonFormat";

/**
 * Writes locale files to the translations directory
 * @param translations Translation data organized by locale
 * @param locales Array of locale identifiers
 * @param translationsOutputDir Directory to write translation files to
 */
export function writeTranslationFiles(
	translations: TranslationData,
	locales: string[],
	translationsOutputDir: string
): void {
	// Make sure the translations directory exists
	if (!fs.existsSync(translationsOutputDir)) {
		fs.mkdirSync(translationsOutputDir, { recursive: true });
	}

	// Write files for all locales
	for (const locale of locales) {
		if (!translations[locale] || Object.keys(translations[locale]).length === 0) {
			console.warn(`No translations found for locale "${locale}"`);
			continue;
		}

		fs.writeFileSync(
			`${translationsOutputDir}/${locale.toLowerCase()}.json`,
			JSON.stringify(translations[locale], null, 2),
			"utf8"
		);
		console.log(`Successfully wrote translations for ${locale}`);
	}
}

/**
 * Writes the locales.ts file containing the array of available locales
 * @param locales Array of locale identifiers (filtered to only include valid locales)
 * @param localesOutputPath Path to write the locales.ts file
 */
export function writeLocalesFile(locales: string[], localesOutputPath: string): void {
	// Create locales.ts file directory if it doesn't exist
	const localesOutputDir = path.dirname(localesOutputPath);
	if (!fs.existsSync(localesOutputDir)) {
		fs.mkdirSync(localesOutputDir, { recursive: true });
	}

	// Only write valid, non-empty locales
	const validLocales = locales.filter(locale => locale && locale.trim().length > 0);

	fs.writeFileSync(
		localesOutputPath,
		`export const locales = ${JSON.stringify(validLocales)};\nexport default locales;`,
		"utf8"
	);
	console.log(`Successfully wrote locales file with ${validLocales.length} locales:`, validLocales);
}

/**
 * Writes the languageData.json file containing all translation data
 * @param translations Translation data organized by locale
 * @param locales Array of locale identifiers
 * @param dataJsonPath Path to write the languageData.json file
 */
export function writeLanguageDataFile(
	translations: TranslationData,
	locales: string[],
	dataJsonPath: string
): void {
	// Create languageData.json directory if it doesn't exist
	const dataJsonDir = path.dirname(dataJsonPath);
	if (!fs.existsSync(dataJsonDir)) {
		fs.mkdirSync(dataJsonDir, { recursive: true });
	}

	// Convert the object format to the array format expected in languageData.json
	const dataJsonContent = convertToDataJsonFormat(translations, locales);

	// Write the updated data to languageData.json
	fs.writeFileSync(
		dataJsonPath,
		JSON.stringify(dataJsonContent, null, 2),
		"utf8"
	);
	console.log("Successfully updated languageData.json with fresh spreadsheet data");
}
