/**
 * Locale validation utilities
 */

const COMMON_LOCALE_PATTERNS = [
	/^[a-z]{2}$/,                    // en, de, fr
	/^[a-z]{2}-[a-z]{2}$/,          // en-us, de-de
	/^[a-z]{2}_[a-z]{2}$/,          // en_us, de_de
	/^[a-z]{2}-[a-z]{2}-[a-z]+$/,   // en-us-traditional
];

const NON_LOCALE_KEYWORDS = [
	'key', 'keys', 'id', 'identifier', 'name', 'title', 'label',
	'description', 'comment', 'note', 'context', 'category', 'type',
	'status', 'updated', 'created', 'modified', 'version', 'source',
	'i18n', 'translation', 'namespace', 'section'
];

/**
 * Determines if a string represents a valid locale identifier
 * @param value The string to test
 * @returns true if the string appears to be a locale identifier
 */
export function isValidLocale(value: string): boolean {
	if (!value || typeof value !== 'string') {
		return false;
	}

	const normalized = value.toLowerCase().trim();
	
	// Check if it's a common non-locale keyword
	if (NON_LOCALE_KEYWORDS.includes(normalized)) {
		return false;
	}

	// Check if it matches common locale patterns (only accept lowercase patterns)
	return COMMON_LOCALE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Filters header row to only include valid locale columns, excluding the key column
 * @param headerRow Array of column names from the sheet header
 * @param keyColumn The name of the key column to exclude
 * @returns Array of valid locale identifiers
 */
export function filterValidLocales(headerRow: string[], keyColumn: string): string[] {
	return headerRow
		.filter(column => column.toLowerCase() !== keyColumn.toLowerCase())
		.filter(column => isValidLocale(column)) // Use original case for validation
		.map(locale => locale.toLowerCase()); // Then normalize to lowercase
}
