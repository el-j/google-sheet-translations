import fs from "node:fs";
import path from "node:path";
import { getFileLastModified } from "./getFileLastModified";

/**
 * Checks if languageData.json has been modified more recently than the translation files
 * @param dataJsonPath - Path to languageData.json
 * @param translationsOutputDir - Directory containing translation files
 * @returns True if languageData.json is newer than the translation files
 */
export function isDataJsonNewer(dataJsonPath: string, translationsOutputDir: string): boolean {
	const dataJsonMtime = getFileLastModified(dataJsonPath);

	if (!dataJsonMtime) return false;

	// Get the most recent translation file modification time
	try {
		const files = fs.readdirSync(translationsOutputDir)
			.filter(file => file.endsWith('.json'))
			.map(file => path.join(translationsOutputDir, file));

		if (files.length === 0) return true;

		const mostRecentTranslationMtime = files
			.map(file => getFileLastModified(file))
			.filter(Boolean)
			.sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];

		return dataJsonMtime.getTime() > (mostRecentTranslationMtime as Date).getTime();
	} catch (error) {
		console.warn("Error comparing file modification times:", error);
		return false;
	}
}
