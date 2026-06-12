import {
	getTranslationSummary,
	getLocaleDisplayName,
	mergeSheets,
} from '../../src/utils/translationHelpers';
import type { TranslationData } from '../../src/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const sampleTranslations: TranslationData = {
	'en-gb': {
		landingPage: {
			hero_title: 'Welcome',
			hero_text: 'A description',
			hero_tagline: 'Tagline',
		},
		ui: {
			save: 'Save',
			cancel: 'Cancel',
		},
		i18n: {
			'en-gb': 'English',
			'de-de': 'German',
		},
	},
	'de-de': {
		landingPage: {
			hero_title: 'Willkommen',
			hero_text: 'Eine Beschreibung',
			hero_tagline: 'Slogan',
		},
		ui: {
			save: 'Speichern',
			cancel: 'Abbrechen',
		},
		i18n: {
			'en-gb': 'Englisch',
			'de-de': 'Deutsch',
		},
	},
};

// ---------------------------------------------------------------------------
// getTranslationSummary
// ---------------------------------------------------------------------------

describe('getTranslationSummary', () => {
	it('returns a summary with the correct sheets and key counts per locale', () => {
		const summary = getTranslationSummary(sampleTranslations);

		expect(Object.keys(summary)).toEqual(expect.arrayContaining(['en-gb', 'de-de']));

		const enSheets = summary['en-gb'];
		expect(enSheets).toEqual(
			expect.arrayContaining([
				{ sheet: 'landingPage', count: 3 },
				{ sheet: 'ui', count: 2 },
				{ sheet: 'i18n', count: 2 },
			]),
		);

		const deSheets = summary['de-de'];
		expect(deSheets).toEqual(
			expect.arrayContaining([
				{ sheet: 'landingPage', count: 3 },
				{ sheet: 'ui', count: 2 },
				{ sheet: 'i18n', count: 2 },
			]),
		);
	});

	it('returns an empty object for empty translations', () => {
		expect(getTranslationSummary({})).toEqual({});
	});

	it('returns zero counts for empty sheets', () => {
		const translations: TranslationData = {
			'en-gb': {
				empty: {},
			},
		};
		const summary = getTranslationSummary(translations);
		expect(summary['en-gb']).toEqual([{ sheet: 'empty', count: 0 }]);
	});

	it('preserves all locales', () => {
		const summary = getTranslationSummary(sampleTranslations);
		expect(Object.keys(summary)).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// getLocaleDisplayName
// ---------------------------------------------------------------------------

describe('getLocaleDisplayName', () => {
	it('returns the display name for a locale from the i18n sheet', () => {
		expect(getLocaleDisplayName('de-de', sampleTranslations)).toBe('Deutsch');
		expect(getLocaleDisplayName('en-gb', sampleTranslations)).toBe('English');
	});

	it('falls back to the raw locale code when the locale is not in translations', () => {
		expect(getLocaleDisplayName('fr-fr', sampleTranslations)).toBe('fr-fr');
	});

	it('falls back to the raw locale code when the i18n sheet is absent', () => {
		const translations: TranslationData = {
			'en-gb': {
				ui: { save: 'Save' },
			},
		};
		expect(getLocaleDisplayName('en-gb', translations)).toBe('en-gb');
	});

	it('falls back to the raw locale code when the key is missing in i18n', () => {
		const translations: TranslationData = {
			'fr-fr': {
				i18n: {
					'en-gb': 'Anglais',
					// 'fr-fr' key intentionally absent
				},
			},
		};
		expect(getLocaleDisplayName('fr-fr', translations)).toBe('fr-fr');
	});

	it('supports a custom i18nSheet name', () => {
		const translations: TranslationData = {
			'en-gb': {
				localeNames: {
					'en-gb': 'English (custom)',
				},
			},
		};
		expect(getLocaleDisplayName('en-gb', translations, 'localeNames')).toBe(
			'English (custom)',
		);
	});

	it('handles case-insensitive locale key lookup (lowercase normalization)', () => {
		const translations: TranslationData = {
			'EN-GB': {
				i18n: {
					'en-gb': 'English',
				},
			},
		};
		// The locale stored in translations under 'EN-GB', but the i18n key is 'en-gb'
		expect(getLocaleDisplayName('EN-GB', translations)).toBe('English');
	});
});

// ---------------------------------------------------------------------------
// mergeSheets
// ---------------------------------------------------------------------------

describe('mergeSheets', () => {
	it('merges specified sheets into a single flat map', () => {
		const merged = mergeSheets(sampleTranslations, 'en-gb', ['landingPage', 'ui']);
		expect(merged).toEqual({
			hero_title: 'Welcome',
			hero_text: 'A description',
			hero_tagline: 'Tagline',
			save: 'Save',
			cancel: 'Cancel',
		});
	});

	it('merges all sheets when sheetNames is omitted', () => {
		const merged = mergeSheets(sampleTranslations, 'en-gb');
		expect(merged).toHaveProperty('hero_title', 'Welcome');
		expect(merged).toHaveProperty('save', 'Save');
		expect(merged).toHaveProperty('en-gb', 'English');
	});

	it('later sheets overwrite earlier sheets on key conflict', () => {
		const translations: TranslationData = {
			'en-gb': {
				sheetA: { shared_key: 'from A', only_a: 'A' },
				sheetB: { shared_key: 'from B', only_b: 'B' },
			},
		};
		const merged = mergeSheets(translations, 'en-gb', ['sheetA', 'sheetB']);
		expect(merged.shared_key).toBe('from B');
		expect(merged.only_a).toBe('A');
		expect(merged.only_b).toBe('B');
	});

	it('returns an empty object for an unknown locale', () => {
		expect(mergeSheets(sampleTranslations, 'fr-fr', ['ui'])).toEqual({});
	});

	it('silently skips missing sheets', () => {
		const merged = mergeSheets(sampleTranslations, 'en-gb', ['ui', 'nonExistent']);
		expect(merged).toEqual({ save: 'Save', cancel: 'Cancel' });
	});

	it('returns an empty object when all requested sheets are missing', () => {
		expect(mergeSheets(sampleTranslations, 'en-gb', ['ghost'])).toEqual({});
	});

	it('returns an empty object for empty translations', () => {
		expect(mergeSheets({}, 'en-gb', ['ui'])).toEqual({});
	});
});
