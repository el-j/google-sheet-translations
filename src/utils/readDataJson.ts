import fs from "node:fs";
import type { TranslationData } from "../types";
import { convertFromDataJsonFormat } from "../utils/dataConverter/convertFromDataJsonFormat";

/**
 * Reads and parses the languageData.json file
 * @param dataJsonPath - Path to languageData.json
 * @returns Parsed languageData.json contents, or null if file doesn't exist or is invalid
 */
export function readDataJson(dataJsonPath: string): TranslationData | null {
	try {
		if (!fs.existsSync(dataJsonPath)) {
			return null;
		}

		const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
		const dataJson = JSON.parse(dataJsonContent);

		// Convert from languageData.json format to TranslationData
		return convertFromDataJsonFormat(dataJson);
	} catch (error) {
		console.warn("Error reading or parsing languageData.json:", error);
		return null;
	}
}
