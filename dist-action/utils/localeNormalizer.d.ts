/**
 * Locale normalization utilities for converting simple language codes to full locale codes
 * and maintaining mappings between normalized codes and original spreadsheet headers
 */
/**
 * Returns the language prefix of a locale code (the part before the first
 * `-` or `_` separator), lowercased.
 *
 * Examples:
 * - `'en-US'` → `'en'`
 * - `'zh_CN'` → `'zh'`
 * - `'de'`    → `'de'`
 *
 * Used for language-family matching when an exact locale code is not found.
 */
export declare function getLanguagePrefix(locale: string): string;
/**
 * Normalizes a language code to include country code if missing
 * @param locale The original locale code from spreadsheet header
 * @returns Normalized locale with country code
 */
export declare function normalizeLocaleCode(locale: string): string;
/**
 * Creates a mapping between normalized locale codes and their original spreadsheet headers
 * @param originalHeaders Array of original header names from spreadsheet
 * @param keyColumn The key column name to exclude
 * @returns Object with normalized locales and header mapping
 */
export declare function createLocaleMapping(originalHeaders: string[], keyColumn: string): {
    normalizedLocales: string[];
    localeMapping: Record<string, string>;
    originalMapping: Record<string, string>;
};
/**
 * Finds the original header name for a given normalized locale.
 *
 * Lookup order (most-specific → most-lenient):
 * 1. Direct key match  (`'en-us'` → `'en-US'`)
 * 2. Lowercase key match (`'EN-US'` → key `'en-us'`)
 * 3. Case-insensitive key comparison
 * 4. Language-family prefix match – e.g. `'en'` or `'en-GB'` finds `'en-US'`
 *    when `'en-US'` is the only English variant present in the mapping.
 *
 * @param normalizedLocale The normalized locale code (e.g., `'en-GB'`, `'en'`)
 * @param localeMapping Mapping from normalized locales to original headers
 * @returns Original header name or undefined if not found
 */
export declare function getOriginalHeaderForLocale(normalizedLocale: string, localeMapping: Record<string, string>): string | undefined;
/**
 * Finds the normalized locale for a given original header
 * @public
 * @param originalHeader The original header name (e.g., 'pl')
 * @param originalMapping Mapping from original headers to normalized locales
 * @returns Normalized locale code or undefined if not found
 */
export declare function getNormalizedLocaleForHeader(originalHeader: string, originalMapping: Record<string, string>): string | undefined;
/**
 * Resolves a locale code to the closest matching locale in an available list
 * using a three-step fallback strategy:
 *
 * 1. **Exact match** — `'en-us'` → `'en-us'`
 * 2. **Lowercase match** — `'en-US'` → `'en-us'`
 * 3. **Language-family prefix** — `'en'` or `'en-GB'` → `'en-us'`
 *    when `'en-us'` is the only English variant in `availableLocales`
 *
 * Returns `undefined` when no matching locale is found.
 *
 * This is the same strategy used internally by `findLocalChanges()` when
 * mapping local `languageData.json` keys to spreadsheet locale columns.
 *
 * @param locale           - The locale code to resolve (e.g. `'en'`, `'en-GB'`).
 * @param availableLocales - Array of locale codes to search (e.g. from
 *   `Object.keys(translations)` or the `locales` array from `getSpreadSheetData`).
 * @returns The matched locale code from `availableLocales`, or `undefined`.
 *
 * @example
 * ```ts
 * import { resolveLocaleWithFallback } from '@el-j/google-sheet-translations';
 *
 * const locales = ['en-us', 'de-de', 'fr-fr'];
 * resolveLocaleWithFallback('en', locales);    // → 'en-us'
 * resolveLocaleWithFallback('en-GB', locales); // → 'en-us'
 * resolveLocaleWithFallback('de-DE', locales); // → 'de-de'
 * resolveLocaleWithFallback('ja', locales);    // → undefined
 * ```
 */
export declare function resolveLocaleWithFallback(locale: string, availableLocales: string[]): string | undefined;
//# sourceMappingURL=localeNormalizer.d.ts.map