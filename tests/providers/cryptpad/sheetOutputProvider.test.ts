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
});
