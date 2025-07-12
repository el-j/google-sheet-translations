/**
 * Locale normalization utilities for converting simple language codes to full locale codes
 * and maintaining mappings between normalized codes and original spreadsheet headers
 */

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
		return locale;
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
export function createLocaleMapping(originalHeaders: string[], keyColumn: string) {
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
 * Finds the original header name for a given normalized locale
 * @param normalizedLocale The normalized locale code (e.g., 'pl-PL')
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
	
	return undefined;
}

/**
 * Finds the normalized locale for a given original header
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
