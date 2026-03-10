import type { TranslationData } from "../types";
/**
 * Writes locale files to the translations directory
 * @param translations Translation data organized by locale
 * @param locales Array of locale identifiers
 * @param translationsOutputDir Directory to write translation files to
 */
export declare function writeTranslationFiles(translations: TranslationData, locales: string[], translationsOutputDir: string): void;
/**
 * Writes the locales.ts file containing the array of available locales and header mapping
 * @param locales Array of normalized locale identifiers (filtered to only include valid locales)
 * @param localeMapping Mapping from normalized locales to original spreadsheet headers
 * @param localesOutputPath Path to write the locales.ts file
 */
export declare function writeLocalesFile(locales: string[], localeMapping: Record<string, string>, localesOutputPath: string): void;
/**
 * Writes the languageData.json file containing all translation data
 * @param translations Translation data organized by locale
 * @param locales Array of locale identifiers
 * @param dataJsonPath Path to write the languageData.json file
 */
export declare function writeLanguageDataFile(translations: TranslationData, locales: string[], dataJsonPath: string): void;
//# sourceMappingURL=fileWriter.d.ts.map