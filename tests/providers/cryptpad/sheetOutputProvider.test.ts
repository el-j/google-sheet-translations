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
    expect(commonRows).toContainEqual({ var: 'btn.save', en: 'Save', de: 'Speichern' });
    expect(commonRows).toContainEqual({ var: 'btn.cancel', en: 'Cancel', de: 'Abbrechen' });

    const authRows = sheetRows.auth;
    expect(authRows).toHaveLength(1);
    expect(authRows).toEqual([{ var: 'login.title', en: 'Welcome', de: 'Willkommen' }]);
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

  it('defaults to the Google Sheets "var" convention for the key column', () => {
    const translations = {
      en: {
        common: { 'btn.save': 'Save' },
      },
      de: {
        common: { 'btn.save': 'Speichern' },
      },
    };

    const sheetRows = convertTranslationsToSheetRows(translations);
    expect(sheetRows.common).toEqual([{ var: 'btn.save', en: 'Save', de: 'Speichern' }]);
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

    expect(mockWriteSheetRows).toHaveBeenCalledWith('common', [{ var: 'save', en: 'Save' }], {
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

  it('applies localeMapping reverse headers when converting translations', () => {
    const translations = {
      'en-US': { home: { welcome: 'Hello' } },
    };
    const localeMapping = { en: 'en-US' };
    const result = convertTranslationsToSheetRows(translations, localeMapping);
    expect(result.home).toEqual([{ var: 'welcome', en: 'Hello' }]);
  });
});
