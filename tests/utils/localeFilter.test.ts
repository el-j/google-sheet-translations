import { isValidLocale, filterValidLocales } from '../../src/utils/localeFilter';

describe('localeFilter', () => {
	describe('isValidLocale', () => {
		it('should accept valid two-letter language codes', () => {
			expect(isValidLocale('en')).toBe(true);
			expect(isValidLocale('de')).toBe(true);
			expect(isValidLocale('fr')).toBe(true);
			expect(isValidLocale('ja')).toBe(true);
		});

		it('should accept valid language-country codes with hyphens', () => {
			expect(isValidLocale('en-us')).toBe(true);
			expect(isValidLocale('en-gb')).toBe(true);
			expect(isValidLocale('de-de')).toBe(true);
			expect(isValidLocale('fr-ca')).toBe(true);
		});

		it('should accept valid language-country codes with underscores', () => {
			expect(isValidLocale('en_us')).toBe(true);
			expect(isValidLocale('en_gb')).toBe(true);
			expect(isValidLocale('de_de')).toBe(true);
		});

		it('should accept extended locale codes', () => {
			expect(isValidLocale('en-us-traditional')).toBe(true);
			expect(isValidLocale('zh-cn-simplified')).toBe(true);
		});

		it('should reject common non-locale keywords', () => {
			expect(isValidLocale('key')).toBe(false);
			expect(isValidLocale('keys')).toBe(false);
			expect(isValidLocale('id')).toBe(false);
			expect(isValidLocale('name')).toBe(false);
			expect(isValidLocale('title')).toBe(false);
			expect(isValidLocale('description')).toBe(false);
			expect(isValidLocale('i18n')).toBe(false);
			expect(isValidLocale('translation')).toBe(false);
		});

		it('should reject invalid formats', () => {
			expect(isValidLocale('')).toBe(false);
			expect(isValidLocale('x')).toBe(false);
			expect(isValidLocale('english')).toBe(false);
			expect(isValidLocale('123')).toBe(false);
			expect(isValidLocale('en-')).toBe(false);
		});

		it('should accept uppercase formats (they get normalized internally)', () => {
			expect(isValidLocale('EN-US')).toBe(true); // Should be valid, gets normalized
			expect(isValidLocale('DE')).toBe(true);
		});

		it('should handle null and undefined', () => {
			expect(isValidLocale(null as any)).toBe(false);
			expect(isValidLocale(undefined as any)).toBe(false);
		});
	});

	describe('filterValidLocales', () => {
		it('should filter out the key column and non-locale columns', () => {
			const headerRow = ['key', 'en', 'de', 'fr', 'description', 'en-us', 'status'];
			const keyColumn = 'key';
			
			const result = filterValidLocales(headerRow, keyColumn);
			
			expect(result).toEqual(['en', 'de', 'fr', 'en-us']);
			expect(result).not.toContain('key');
			expect(result).not.toContain('description');
			expect(result).not.toContain('status');
		});

		it('should handle case-insensitive key column matching', () => {
			const headerRow = ['Key', 'en', 'DE', 'fr-ca'];
			const keyColumn = 'key';
			
			const result = filterValidLocales(headerRow, keyColumn);
			
			expect(result).toEqual(['en', 'de', 'fr-ca']); // normalized to lowercase
			expect(result).not.toContain('key');
		});

		it('should return empty array when no valid locales found', () => {
			const headerRow = ['key', 'name', 'description', 'status'];
			const keyColumn = 'key';
			
			const result = filterValidLocales(headerRow, keyColumn);
			
			expect(result).toEqual([]);
		});

		it('should handle empty header row', () => {
			const result = filterValidLocales([], 'key');
			expect(result).toEqual([]);
		});
	});
});
