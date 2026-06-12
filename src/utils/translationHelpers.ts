/**
 * Higher-level translation utility helpers.
 *
 * These utilities solve common patterns that appear when consuming the
 * translation data returned by `getSpreadSheetData()`.  They were previously
 * implemented inline in the documentation website; extracting them into the
 * package makes them reusable for every downstream consumer.
 */

import type { TranslationData, TranslationValue } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-sheet summary for a single locale: sheet name and the number of
 * translation keys it contains.
 */
export interface SheetSummary {
	sheet: string;
	count: number;
}

/**
 * Translation summary keyed by locale.
 * Each locale maps to an array of sheet summaries with key counts.
 *
 * @example
 * ```ts
 * const summary = getTranslationSummary(translations);
 * // { 'en-us': [{ sheet: 'landingPage', count: 12 }, { sheet: 'ui', count: 5 }], ... }
 * ```
 */
export type TranslationSummary = Record<string, SheetSummary[]>;

// ---------------------------------------------------------------------------
// getTranslationSummary
// ---------------------------------------------------------------------------

/**
 * Builds a summary of translation key counts per locale and sheet.
 *
 * Useful for dashboards, translation coverage reports, and monitoring.
 *
 * @param translations - The `TranslationData` object returned by
 *   `getSpreadSheetData()`.
 * @returns A `TranslationSummary` mapping each locale to an array of
 *   `{ sheet, count }` entries.
 *
 * @example
 * ```ts
 * import { getSpreadSheetData, getTranslationSummary } from '@el-j/google-sheet-translations';
 *
 * const translations = await getSpreadSheetData(['ui', 'landingPage'], { publicSheet: true, spreadsheetId: '...' });
 * const summary = getTranslationSummary(translations);
 * // summary['en-us'] = [{ sheet: 'ui', count: 5 }, { sheet: 'landingPage', count: 12 }]
 * ```
 */
export function getTranslationSummary(translations: TranslationData): TranslationSummary {
	const summary: TranslationSummary = {};
	for (const locale of Object.keys(translations)) {
		summary[locale] = Object.entries(translations[locale]).map(([sheet, keys]) => ({
			sheet,
			count: Object.keys(keys as object).length,
		}));
	}
	return summary;
}

// ---------------------------------------------------------------------------
// getLocaleDisplayName
// ---------------------------------------------------------------------------

/**
 * Returns the human-readable display name for a locale by looking it up in
 * the `i18n` sheet of the translation data.
 *
 * The `i18n` sheet is expected to follow the convention used by the demo
 * spreadsheet: translation keys are locale codes (e.g. `"en-us"`,
 * `"de-de"`) and their values are the locale's own name in that language —
 * i.e. the mapping is self-referential.  For example:
 *   - locale `"en-us"` → key `"en-us"` in the `"i18n"` sheet → `"English"`
 *   - locale `"de-de"` → key `"de-de"` in the `"i18n"` sheet → `"Deutsch"`
 *
 * Falls back to the raw locale code if the name is not found.
 *
 * @param locale       - The locale code to look up (e.g. `"de-de"`).
 * @param translations - The `TranslationData` object returned by
 *   `getSpreadSheetData()`.
 * @param i18nSheet    - The sheet that contains locale display names
 *   (default: `"i18n"`).
 * @returns Human-readable locale name, or `locale` itself as a fallback.
 *
 * @example
 * ```ts
 * import { getSpreadSheetData, getLocaleDisplayName } from '@el-j/google-sheet-translations';
 *
 * const translations = await getSpreadSheetData(['i18n'], { publicSheet: true, spreadsheetId: '...' });
 * const name = getLocaleDisplayName('de-de', translations);
 * // → 'Deutsch'
 * ```
 */
export function getLocaleDisplayName(
	locale: string,
	translations: TranslationData,
	i18nSheet = 'i18n',
): string {
	const localeData = translations[locale];
	if (!localeData) return locale;

	const sheetData = localeData[i18nSheet];
	if (!sheetData) return locale;

	// Keys in the i18n sheet are lowercase locale codes
	const name = sheetData[locale] ?? sheetData[locale.toLowerCase()];
	return typeof name === 'string' ? name : locale;
}

// ---------------------------------------------------------------------------
// mergeSheets
// ---------------------------------------------------------------------------

/**
 * Selects one or more sheets from the translation data for a given locale and
 * merges them into a single flat key→value map.
 *
 * Later sheets in `sheetNames` overwrite earlier ones when there are duplicate
 * keys (same semantics as `Object.assign`).
 *
 * This is the canonical way to extract a "current locale" translation map for
 * rendering UI strings when translation keys are spread across multiple sheets.
 *
 * @param translations - The `TranslationData` object returned by
 *   `getSpreadSheetData()`.
 * @param locale       - The locale whose data should be extracted.
 * @param sheetNames   - Which sheets to merge (in order). Omit to merge all
 *   sheets for the locale.
 * @returns Flat `{ key: value }` map.  Returns an empty object if the locale
 *   or none of the requested sheets are found.
 *
 * @example
 * ```ts
 * import { getSpreadSheetData, mergeSheets } from '@el-j/google-sheet-translations';
 *
 * const translations = await getSpreadSheetData(['ui', 'landingPage'], { publicSheet: true, spreadsheetId: '...' });
 * const t = mergeSheets(translations, 'de-de', ['ui', 'landingPage']);
 * // t.hero_title === 'Willkommen'
 * ```
 */
export function mergeSheets(
	translations: TranslationData,
	locale: string,
	sheetNames?: string[],
): Record<string, TranslationValue> {
	const localeData = translations[locale];
	if (!localeData) return {};

	const sheets = sheetNames ?? Object.keys(localeData);
	const merged: Record<string, TranslationValue> = {};
	for (const sheetName of sheets) {
		const sheetData = localeData[sheetName];
		if (sheetData) {
			Object.assign(merged, sheetData);
		}
	}
	return merged;
}
