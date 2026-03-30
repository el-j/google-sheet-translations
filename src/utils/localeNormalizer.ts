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
export function getLanguagePrefix(locale: string): string {
	return locale.toLowerCase().split(/[-_]/)[0];
}

/**
 * Locale codes where the region qualifier is meaningful for GOOGLETRANSLATE
 * and must be preserved.  Currently only Chinese Traditional vs Simplified
 * requires the region suffix; all other languages use a bare ISO 639-1 code.
 */
const GOOGLE_TRANSLATE_CODES_REQUIRING_REGION = new Set(['zh-tw', 'zh-cn']);

/**
 * Converts a spreadsheet locale header (e.g. `"tr-TR"`, `"en-US"`, `"zh-TW"`)
 * into the language code accepted by Google Sheets' `GOOGLETRANSLATE` function.
 *
 * Rules:
 * - Chinese variants (`zh-TW`, `zh-CN`) keep their region qualifier because
 *   `GOOGLETRANSLATE` distinguishes between Simplified and Traditional Chinese.
 * - All other locales are stripped to their ISO 639-1 two-letter prefix
 *   (e.g. `"tr-TR"` → `"tr"`, `"en-US"` → `"en"`).
 *
 * @param locale - A locale string from a spreadsheet header or config option.
 * @returns A lowercased language code suitable for `GOOGLETRANSLATE`.
 *
 * @example
 * ```ts
 * getGoogleTranslateCode('tr-TR'); // → 'tr'
 * getGoogleTranslateCode('en-US'); // → 'en'
 * getGoogleTranslateCode('zh-TW'); // → 'zh-tw'
 * getGoogleTranslateCode('de');    // → 'de'
 * ```
 */
export function getGoogleTranslateCode(locale: string): string {
	const normalized = locale.toLowerCase().trim().replace('_', '-');
	if (GOOGLE_TRANSLATE_CODES_REQUIRING_REGION.has(normalized)) {
		return normalized;
	}
	return normalized.split(/[-_]/)[0];
}

/**
 * Common language to country mappings for normalization
 * Maps language codes to their most common country variants
 */
const LANGUAGE_TO_COUNTRY_MAP: Record<string, string> = {
	'en': 'en-GB',
	'de': 'de-DE', 
	'fr': 'fr-FR',
	'es': 'es-ES',
	'it': 'it-IT',
	'pt': 'pt-PT',
	'pl': 'pl-PL',
	'ru': 'ru-RU',
	'zh': 'zh-CN',
	'ja': 'ja-JP',
	'ko': 'ko-KR',
	'ar': 'ar-SA',
	'hi': 'hi-IN',
	'th': 'th-TH',
	'vi': 'vi-VN',
	'tr': 'tr-TR',
	'nl': 'nl-NL',
	'sv': 'sv-SE',
	'da': 'da-DK',
	'no': 'no-NO',
	'fi': 'fi-FI',
	'cs': 'cs-CZ',
	'sk': 'sk-SK',
	'hu': 'hu-HU',
	'ro': 'ro-RO',
	'bg': 'bg-BG',
	'hr': 'hr-HR',
	'sl': 'sl-SI',
	'et': 'et-EE',
	'lv': 'lv-LV',
	'lt': 'lt-LT',
	'el': 'el-GR',
	'he': 'he-IL',
	'uk': 'uk-UA',
	'be': 'be-BY',
};

/**
 * Normalizes a language code to include country code if missing
 * @param locale The original locale code from spreadsheet header
 * @returns Normalized locale with country code
 */
export function normalizeLocaleCode(locale: string): string {
	if (!locale || typeof locale !== 'string') {
		return '';
	}

	const normalized = locale.toLowerCase().trim();
	
	// If already has country code, return as is
	if (normalized.includes('-') || normalized.includes('_')) {
		return normalized;
	}

	// Look up the language in our mapping first
	const withCountry = LANGUAGE_TO_COUNTRY_MAP[normalized];
	if (withCountry) {
		return withCountry;
	}

	// If not in mapping and it's a 2-letter code, append the same code in uppercase
	// This handles cases like "pl" -> "pl-PL"
	if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
		return `${normalized}-${normalized.toUpperCase()}`;
	}

	// Return original if we can't normalize it
	return normalized;
}

/**
 * Creates a mapping between normalized locale codes and their original spreadsheet headers
 * @param originalHeaders Array of original header names from spreadsheet
 * @param keyColumn The key column name to exclude
 * @returns Object with normalized locales and header mapping
 */
export function createLocaleMapping(
	originalHeaders: string[],
	keyColumn: string
): {
	normalizedLocales: string[];
	localeMapping: Record<string, string>;
	originalMapping: Record<string, string>;
} {
	const localeMapping: Record<string, string> = {}; // normalized -> original
	const originalMapping: Record<string, string> = {}; // original -> normalized
	const normalizedLocales: string[] = [];

	for (const header of originalHeaders) {
		const headerLower = header.toLowerCase();
		
		// Skip key column and non-locale headers
		if (headerLower === keyColumn.toLowerCase()) {
			continue;
		}

		// Check if this looks like a locale
		const isLocale = /^[a-z]{2}([_-][a-z]{2})?([_-][a-z]+)?$/.test(headerLower);
		if (!isLocale) {
			continue;
		}

		const normalized = normalizeLocaleCode(headerLower);
		
		localeMapping[normalized] = header; // Store original case
		originalMapping[headerLower] = normalized;
		normalizedLocales.push(normalized);
	}

	return {
		normalizedLocales: [...new Set(normalizedLocales)], // Remove duplicates
		localeMapping, // normalized -> original header
		originalMapping // original header (lowercase) -> normalized
	};
}

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
export function getOriginalHeaderForLocale(
	normalizedLocale: string, 
	localeMapping: Record<string, string>
): string | undefined {
	// Try direct lookup first
	let result = localeMapping[normalizedLocale];
	if (result) return result;
	
	// Try lowercase lookup if direct lookup fails
	const lowercaseLocale = normalizedLocale.toLowerCase();
	result = localeMapping[lowercaseLocale];
	if (result) return result;
	
	// Try finding by case-insensitive key comparison
	for (const [key, value] of Object.entries(localeMapping)) {
		if (key.toLowerCase() === lowercaseLocale) {
			return value;
		}
	}

	// Language-family fallback: 'en' or 'en-GB' should find 'en-US' when that
	// is the only English variant present in the localeMapping.
	const inputLangCode = getLanguagePrefix(normalizedLocale);
	for (const [key, value] of Object.entries(localeMapping)) {
		if (getLanguagePrefix(key) === inputLangCode) {
			return value;
		}
	}
	
	return undefined;
}

/**
 * Finds the normalized locale for a given original header
 * @public
 * @param originalHeader The original header name (e.g., 'pl')
 * @param originalMapping Mapping from original headers to normalized locales
 * @returns Normalized locale code or undefined if not found
 */
export function getNormalizedLocaleForHeader(
	originalHeader: string, 
	originalMapping: Record<string, string>
): string | undefined {
	return originalMapping[originalHeader.toLowerCase()];
}

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
export function resolveLocaleWithFallback(
	locale: string,
	availableLocales: string[],
): string | undefined {
	// 1. Exact match
	if (availableLocales.includes(locale)) return locale;
	// 2. Lowercase match
	const lower = locale.toLowerCase();
	const lowerMatch = availableLocales.find((l) => l === lower);
	if (lowerMatch) return lowerMatch;
	// 3. Language-family prefix fallback
	const langCode = getLanguagePrefix(lower);
	return availableLocales.find((l) => getLanguagePrefix(l) === langCode);
}
