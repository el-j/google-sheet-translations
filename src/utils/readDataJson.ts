import fs from "node:fs";
import type { TranslationData } from "../types";
import { convertFromDataJsonFormat } from "../utils/dataConverter/convertFromDataJsonFormat";

/**
 * Reads and parses the data.json file
 * @param dataJsonPath - Path to data.json
 * @returns Parsed data.json contents, or null if file doesn't exist or is invalid
 */
export function readDataJson(dataJsonPath: string): TranslationData | null {
	try {
		if (!fs.existsSync(dataJsonPath)) {
			return null;
		}

		const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
		const dataJson = JSON.parse(dataJsonContent);

		// Convert from data.json format to TranslationData
		return convertFromDataJsonFormat(dataJson);
	} catch (error) {
		console.warn("Error reading or parsing data.json:", error);
		return null;
	}
}
