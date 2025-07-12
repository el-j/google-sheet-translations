import { normalizeLocaleCode, createLocaleMapping, getOriginalHeaderForLocale } from '../../src/utils/localeNormalizer';

describe('Locale Normalization Integration Tests', () => {
	describe('normalizeLocaleCode', () => {
		it('should normalize simple language codes by appending uppercase version', () => {
			expect(normalizeLocaleCode('pl')).toBe('pl-PL');
			expect(normalizeLocaleCode('fr')).toBe('fr-FR'); // From mapping
			expect(normalizeLocaleCode('xx')).toBe('xx-XX'); // Not in mapping, use fallback
		});

		it('should leave already normalized locales unchanged', () => {
			expect(normalizeLocaleCode('en-US')).toBe('en-us');
			expect(normalizeLocaleCode('pt-BR')).toBe('pt-br');
		});

		it('should handle case variations correctly', () => {
			expect(normalizeLocaleCode('PL')).toBe('pl-PL');
			expect(normalizeLocaleCode('En')).toBe('en-GB'); // From mapping
		});

		it('should handle invalid inputs gracefully', () => {
			expect(normalizeLocaleCode('')).toBe('');
			expect(normalizeLocaleCode('123')).toBe('123');
			expect(normalizeLocaleCode('toolong')).toBe('toolong');
		});
	});

	describe('createLocaleMapping', () => {
		it('should create proper mappings for spreadsheet headers', () => {
			const headers = ['key', 'en', 'pl', 'de-DE', 'fr-FR'];
			const { normalizedLocales, localeMapping, originalMapping } = createLocaleMapping(headers, 'key');

			expect(normalizedLocales).toContain('en-GB');
			expect(normalizedLocales).toContain('pl-PL');
			expect(normalizedLocales).toContain('de-de');
			expect(normalizedLocales).toContain('fr-fr');

			expect(localeMapping['en-GB']).toBe('en');
			expect(localeMapping['pl-PL']).toBe('pl');
			expect(localeMapping['de-de']).toBe('de-DE');
			expect(localeMapping['fr-fr']).toBe('fr-FR');

			expect(originalMapping['en']).toBe('en-GB');
			expect(originalMapping['pl']).toBe('pl-PL');
			expect(originalMapping['de-de']).toBe('de-de');
			expect(originalMapping['fr-fr']).toBe('fr-fr');
		});

		it('should handle mixed case headers correctly', () => {
			const headers = ['Key', 'EN', 'Pl', 'DE-de'];
			const { normalizedLocales, localeMapping } = createLocaleMapping(headers, 'Key');

			expect(normalizedLocales).toContain('en-GB');
			expect(normalizedLocales).toContain('pl-PL');
			expect(normalizedLocales).toContain('de-de');

			expect(localeMapping['en-GB']).toBe('EN');
			expect(localeMapping['pl-PL']).toBe('Pl');
			expect(localeMapping['de-de']).toBe('DE-de');
		});

		it('should exclude non-locale headers', () => {
			const headers = ['key', 'en', 'notes', 'comments', 'pl', 'status'];
			const { normalizedLocales, localeMapping } = createLocaleMapping(headers, 'key');

			expect(normalizedLocales).toHaveLength(2);
			expect(normalizedLocales).toContain('en-GB');
			expect(normalizedLocales).toContain('pl-PL');
			expect(localeMapping).not.toHaveProperty('notes');
			expect(localeMapping).not.toHaveProperty('comments');
			expect(localeMapping).not.toHaveProperty('status');
		});
	});

	describe('getOriginalHeaderForLocale', () => {
		const mapping = {
			'en-GB': 'en',
			'pl-PL': 'pl',
			'de-de': 'de-DE',
			'fr-fr': 'fr-FR'
		};

		it('should return correct original header for normalized locale', () => {
			expect(getOriginalHeaderForLocale('en-GB', mapping)).toBe('en');
			expect(getOriginalHeaderForLocale('pl-PL', mapping)).toBe('pl');
			expect(getOriginalHeaderForLocale('de-de', mapping)).toBe('de-DE');
		});

		it('should handle case variations', () => {
			expect(getOriginalHeaderForLocale('EN-GB', mapping)).toBe('en');
			expect(getOriginalHeaderForLocale('PL-PL', mapping)).toBe('pl');
		});

		it('should return undefined for unknown locales', () => {
			expect(getOriginalHeaderForLocale('es-ES', mapping)).toBeUndefined();
			expect(getOriginalHeaderForLocale('unknown', mapping)).toBeUndefined();
		});
	});

	describe('end-to-end locale processing', () => {
		it('should correctly handle the full locale processing pipeline', () => {
			// Simulate spreadsheet headers with mixed formats
			const spreadsheetHeaders = ['key', 'en', 'pl', 'de-DE', 'fr', 'notes'];
			
			// Create mapping
			const { normalizedLocales, localeMapping } = createLocaleMapping(spreadsheetHeaders, 'key');
			
			// Verify normalized locales
			expect(normalizedLocales).toEqual(['en-GB', 'pl-PL', 'de-de', 'fr-FR']);
			
			// Verify we can map back to original headers for sync operations
			expect(getOriginalHeaderForLocale('en-GB', localeMapping)).toBe('en');
			expect(getOriginalHeaderForLocale('pl-PL', localeMapping)).toBe('pl');
			expect(getOriginalHeaderForLocale('de-de', localeMapping)).toBe('de-DE');
			expect(getOriginalHeaderForLocale('fr-FR', localeMapping)).toBe('fr');
			
			// Verify non-locale headers are excluded
			expect(normalizedLocales).not.toContain('notes');
			expect(normalizedLocales).not.toContain('key');
		});
	});
});
