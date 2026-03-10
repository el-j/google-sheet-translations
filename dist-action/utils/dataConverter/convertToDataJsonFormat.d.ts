import type { TranslationData } from "../../types";
/**
 * Converts the translation object to the expected languageData.json format
 * @param translationObj - The translation object with locale->sheet->key->value structure
 * @param locales - Array of locale identifiers
 * @returns Converted data in the format expected for languageData.json
 */
export declare function convertToDataJsonFormat(translationObj: TranslationData, locales: string[]): Record<string, unknown>[];
export default convertToDataJsonFormat;
//# sourceMappingURL=convertToDataJsonFormat.d.ts.map