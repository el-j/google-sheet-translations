/**
 * Locale validation utilities
 */
/**
 * Determines if a string represents a valid locale identifier
 * @param value The string to test
 * @returns true if the string appears to be a locale identifier
 */
export declare function isValidLocale(value: string): boolean;
/**
 * Filters header row to only include valid locale columns, excluding the key column
 * @param headerRow Array of column names from the sheet header
 * @param keyColumn The name of the key column to exclude
 * @returns Array of valid locale identifiers
 */
export declare function filterValidLocales(headerRow: string[], keyColumn: string): string[];
//# sourceMappingURL=localeFilter.d.ts.map