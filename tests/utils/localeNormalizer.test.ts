import { getNormalizedLocaleForHeader, getOriginalHeaderForLocale, resolveLocaleWithFallback, getGoogleTranslateCode } from '../../src/utils/localeNormalizer';

describe('getGoogleTranslateCode', () => {
	test('strips region qualifier from simple locale codes', () => {
		expect(getGoogleTranslateCode('tr-TR')).toBe('tr');
		expect(getGoogleTranslateCode('ru-RU')).toBe('ru');
		expect(getGoogleTranslateCode('pl-PL')).toBe('pl');
		expect(getGoogleTranslateCode('de-DE')).toBe('de');
		expect(getGoogleTranslateCode('fr-FR')).toBe('fr');
		expect(getGoogleTranslateCode('en-US')).toBe('en');
		expect(getGoogleTranslateCode('en-GB')).toBe('en');
		expect(getGoogleTranslateCode('es-ES')).toBe('es');
		expect(getGoogleTranslateCode('it-IT')).toBe('it');
	});

	test('preserves zh-TW and zh-CN for Chinese variants', () => {
		expect(getGoogleTranslateCode('zh-TW')).toBe('zh-tw');
		expect(getGoogleTranslateCode('zh-CN')).toBe('zh-cn');
	});

	test('handles underscore-separated locales', () => {
		expect(getGoogleTranslateCode('zh_TW')).toBe('zh-tw');
		expect(getGoogleTranslateCode('zh_CN')).toBe('zh-cn');
		expect(getGoogleTranslateCode('de_DE')).toBe('de');
	});

	test('returns bare codes unchanged', () => {
		expect(getGoogleTranslateCode('en')).toBe('en');
		expect(getGoogleTranslateCode('de')).toBe('de');
		expect(getGoogleTranslateCode('tr')).toBe('tr');
		expect(getGoogleTranslateCode('ru')).toBe('ru');
		expect(getGoogleTranslateCode('pl')).toBe('pl');
		expect(getGoogleTranslateCode('zh')).toBe('zh');
	});

	test('is case-insensitive', () => {
		expect(getGoogleTranslateCode('TR-TR')).toBe('tr');
		expect(getGoogleTranslateCode('ZH-TW')).toBe('zh-tw');
		expect(getGoogleTranslateCode('EN')).toBe('en');
	});

	test('trims whitespace', () => {
		expect(getGoogleTranslateCode(' tr-TR ')).toBe('tr');
		expect(getGoogleTranslateCode(' zh-TW ')).toBe('zh-tw');
	});
});

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

describe('resolveLocaleWithFallback', () => {
	const availableLocales = ['en-us', 'de-de', 'fr-fr'];

	test('exact match returns the locale unchanged', () => {
		expect(resolveLocaleWithFallback('en-us', availableLocales)).toBe('en-us');
	});

	test('lowercase match: mixed-case input resolves correctly', () => {
		expect(resolveLocaleWithFallback('EN-US', availableLocales)).toBe('en-us');
		expect(resolveLocaleWithFallback('De-De', availableLocales)).toBe('de-de');
	});

	test('language-family fallback: short code resolves to full locale', () => {
		expect(resolveLocaleWithFallback('en', availableLocales)).toBe('en-us');
		expect(resolveLocaleWithFallback('de', availableLocales)).toBe('de-de');
		expect(resolveLocaleWithFallback('fr', availableLocales)).toBe('fr-fr');
	});

	test('language-family fallback: different region resolves to available variant', () => {
		expect(resolveLocaleWithFallback('en-GB', availableLocales)).toBe('en-us');
		expect(resolveLocaleWithFallback('de-AT', availableLocales)).toBe('de-de');
	});

	test('returns undefined when no match found', () => {
		expect(resolveLocaleWithFallback('ja', availableLocales)).toBeUndefined();
		expect(resolveLocaleWithFallback('zh-cn', availableLocales)).toBeUndefined();
	});

	test('returns undefined for empty available locales', () => {
		expect(resolveLocaleWithFallback('en', [])).toBeUndefined();
	});

	test('exact match takes priority over family fallback', () => {
		const locales = ['en-gb', 'en-us'];
		expect(resolveLocaleWithFallback('en-gb', locales)).toBe('en-gb');
		expect(resolveLocaleWithFallback('en-us', locales)).toBe('en-us');
	});

	test('works with a single available locale', () => {
		expect(resolveLocaleWithFallback('en', ['en-gb'])).toBe('en-gb');
		expect(resolveLocaleWithFallback('en-US', ['en-gb'])).toBe('en-gb');
	});
});
