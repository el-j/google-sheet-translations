import { describe, expect, it, vi } from 'vitest';
import {
  createCryptPadSheetOutputProvider,
  convertTranslationsToSheetRows,
  CRYPTPAD_SHEET_OUTPUT_CAPABILITIES,
} from '../../../src/providers/cryptpad/sheetOutputProvider';
import { CryptPadClient } from '../../../src/providers/cryptpad/client';

describe('cryptpad sheet output provider', () => {
  it('declares writeTables capability', () => {
    expect(CRYPTPAD_SHEET_OUTPUT_CAPABILITIES.writeTables).toBe(true);
    expect(CRYPTPAD_SHEET_OUTPUT_CAPABILITIES.readTables).toBe(false);
  });

  it('converts TranslationData to multi-sheet tabular rows', () => {
    const translations = {
      en: {
        common: { 'btn.save': 'Save', 'btn.cancel': 'Cancel' },
        auth: { 'login.title': 'Welcome' },
      },
      de: {
        common: { 'btn.save': 'Speichern', 'btn.cancel': 'Abbrechen' },
        auth: { 'login.title': 'Willkommen' },
      },
    };

    const sheetRows = convertTranslationsToSheetRows(translations);
    expect(Object.keys(sheetRows).sort()).toEqual(['auth', 'common']);

    const commonRows = sheetRows.common;
    expect(commonRows).toHaveLength(2);
    expect(commonRows).toContainEqual({ key: 'btn.save', en: 'Save', de: 'Speichern' });
    expect(commonRows).toContainEqual({ key: 'btn.cancel', en: 'Cancel', de: 'Abbrechen' });

    const authRows = sheetRows.auth;
    expect(authRows).toHaveLength(1);
    expect(authRows).toEqual([{ key: 'login.title', en: 'Welcome', de: 'Willkommen' }]);
  });

  it('never converts rows for the reserved i18n metadata sheet (matches Google Sheets output/sync)', () => {
    const translations = {
      en: {
        i18n: { en: 'English', de: 'German' },
        common: { 'btn.save': 'Save' },
      },
      de: {
        i18n: { en: 'Englisch', de: 'Deutsch' },
        common: { 'btn.save': 'Speichern' },
      },
    };

    const sheetRows = convertTranslationsToSheetRows(translations);
    expect(Object.keys(sheetRows)).toEqual(['common']);
    expect(sheetRows.i18n).toBeUndefined();
  });

  it('defaults to the "key" column header, matching a brand-new Google Sheets sheet', () => {
    const translations = {
      en: {
        common: { 'btn.save': 'Save' },
      },
      de: {
        common: { 'btn.save': 'Speichern' },
      },
    };

    const sheetRows = convertTranslationsToSheetRows(translations);
    expect(sheetRows.common).toEqual([{ key: 'btn.save', en: 'Save', de: 'Speichern' }]);
  });

  it('header row content matches Google Sheets exactly for a brand-new sheet (#165)', () => {
    // Google auto-creates a missing sheet with `headerValues: ['key', ...localeHeaders]`
    // (src/utils/spreadsheetUpdater.ts) — column A literally 'key', then each locale's
    // *original* header text from localeMapping, in insertion order. Assert CryptPad's
    // row-conversion produces the identical header set (as object keys, since rows are
    // built as {key, ...headers} objects rather than an explicit header array) for the
    // same localeMapping, so the two providers' new-sheet header rows read identically.
    const localeMapping = { en: 'English', de: 'Deutsch' };
    const translations = {
      en: { common: { 'btn.save': 'Save' } },
      de: { common: { 'btn.save': 'Speichern' } },
    };

    const sheetRows = convertTranslationsToSheetRows(translations, localeMapping);
    const googleHeaderRow = ['key', ...Object.values(localeMapping)];
    expect(Object.keys(sheetRows.common[0]).sort()).toEqual([...googleHeaderRow].sort());
    expect(sheetRows.common[0]).toEqual({ key: 'btn.save', English: 'Save', Deutsch: 'Speichern' });
  });

  it('supports custom keyColumnName = "var" matching Google Sheets header convention', () => {
    const translations = {
      de: {
        saeulen: { title: 'Säulen' },
      },
      en: {
        saeulen: { title: 'Pillars' },
      },
    };

    const sheetRows = convertTranslationsToSheetRows(translations, {}, 'var');
    expect(sheetRows.saeulen).toEqual([{ var: 'title', de: 'Säulen', en: 'Pillars' }]);
  });

  it('writes translations via CryptPadClient writeSheetRows mock', async () => {
    const mockWriteSheetRows = vi.fn().mockResolvedValue(4);
    vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

    const provider = createCryptPadSheetOutputProvider({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
      override: true,
    });

    const result = await provider.writeTranslations({
      translations: {
        en: {
          common: { save: 'Save' },
        },
      },
      locales: ['en'],
    });

    expect(mockWriteSheetRows).toHaveBeenCalledWith('common', [{ key: 'save', en: 'Save' }], {
      override: true,
    });
    expect(result.wroteFiles).toEqual([
      'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
    ]);
    expect(result.metadata?.totalUpdatedCells).toBe(4);
  });

  it('throws if no url is provided', () => {
    const saved = process.env.CRYPTPAD_URL;
    delete process.env.CRYPTPAD_URL;
    try {
      expect(() => createCryptPadSheetOutputProvider({})).toThrow('requires a "url" option');
    } finally {
      if (saved) process.env.CRYPTPAD_URL = saved;
    }
  });

  it('uses the original header text for a locale, not the normalized code (#165)', () => {
    // localeMapping is normalizedLocale -> originalHeader (createLocaleMapping's shape,
    // e.g. a spreadsheet with a two-letter "en" header normalizes to "en-GB" per
    // website/guide/spreadsheet-setup.md) — the pushed sheet must show the original "en"
    // header back, not the normalized "en-GB", matching what Google Sheets writes via
    // getOriginalHeaderForLocale.
    const translations = {
      'en-GB': { home: { welcome: 'Hello' } },
    };
    const localeMapping = { 'en-GB': 'en' };
    const result = convertTranslationsToSheetRows(translations, localeMapping);
    expect(result.home).toEqual([{ key: 'welcome', en: 'Hello' }]);
  });
});
