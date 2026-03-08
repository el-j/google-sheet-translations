import { getNormalizedLocaleForHeader, getOriginalHeaderForLocale } from '../../src/utils/localeNormalizer';

describe('getNormalizedLocaleForHeader', () => {
	test('should return the mapped value for a matching key', () => {
		const originalMapping = { en: 'en-GB' };
		expect(getNormalizedLocaleForHeader('en', originalMapping)).toBe('en-GB');
	});

	test('should be case-insensitive and match EN to the en key', () => {
		const originalMapping = { en: 'en-GB' };
		expect(getNormalizedLocaleForHeader('EN', originalMapping)).toBe('en-GB');
	});

	test('should return undefined when the key is not in the mapping', () => {
		const originalMapping = {};
		expect(getNormalizedLocaleForHeader('xx', originalMapping)).toBeUndefined();
	});
});

describe('getOriginalHeaderForLocale', () => {
	test('direct match returns original header', () => {
		const localeMapping = { 'en-us': 'en-US', 'de-de': 'de-DE' };
		expect(getOriginalHeaderForLocale('en-us', localeMapping)).toBe('en-US');
	});

	test('lowercase match is case-insensitive', () => {
		const localeMapping = { 'en-us': 'en-US' };
		expect(getOriginalHeaderForLocale('EN-US', localeMapping)).toBe('en-US');
	});

	test('returns undefined when no match exists', () => {
		const localeMapping = { 'de-de': 'de-DE' };
		expect(getOriginalHeaderForLocale('fr-FR', localeMapping)).toBeUndefined();
	});

	test('language-family fallback: short code matches full locale in mapping', () => {
		// 'en' should resolve to 'en-US' when only 'en-us' is in the mapping
		const localeMapping = { 'en-us': 'en-US', 'de-de': 'de-DE' };
		expect(getOriginalHeaderForLocale('en', localeMapping)).toBe('en-US');
	});

	test('language-family fallback: en-GB resolves to en-US header when only en-US is in mapping', () => {
		const localeMapping = { 'en-us': 'en-US', 'de-de': 'de-DE' };
		// 'en-GB' is not in the mapping but same language family as 'en-us'
		expect(getOriginalHeaderForLocale('en-GB', localeMapping)).toBe('en-US');
	});

	test('language-family fallback: short de code matches de-DE', () => {
		const localeMapping = { 'en-us': 'en-US', 'de-de': 'de-DE' };
		expect(getOriginalHeaderForLocale('de', localeMapping)).toBe('de-DE');
	});

	test('language-family fallback: returns undefined when no family match exists', () => {
		// 'fr' should not match 'en-us' or 'de-de'
		const localeMapping = { 'en-us': 'en-US', 'de-de': 'de-DE' };
		expect(getOriginalHeaderForLocale('fr', localeMapping)).toBeUndefined();
	});

	test('exact match takes priority over family fallback', () => {
		// When 'en-gb' exists, it must be preferred over 'en-us' for input 'en-GB'
		const localeMapping = { 'en-gb': 'en-GB', 'en-us': 'en-US' };
		expect(getOriginalHeaderForLocale('en-GB', localeMapping)).toBe('en-GB');
	});
});
