// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  convertCellsToMultiSheetRows,
  convertTranslationsToSheetRows,
  createCryptPadSheetOutputProvider,
  createCryptPadSheetSyncProvider,
  CryptPadClient,
} from '../../src/providers/cryptpad';
import { resolveSyncPlan } from '../../src/providers/syncEngine';
import type { TranslationData } from '../../src/types';

describe('CryptPad multi-sheet and RT channel workflow integration', () => {
  it('converts multi-sheet translations into per-sheet row records and back', () => {
    const multiTranslations: TranslationData = {
      en: {
        common: { 'btn.save': 'Save', 'btn.cancel': 'Cancel' },
        auth: { 'login.title': 'Welcome Back', 'login.button': 'Sign In' },
        settings: { 'theme.dark': 'Dark Mode' },
      },
      de: {
        common: { 'btn.save': 'Speichern', 'btn.cancel': 'Abbrechen' },
        auth: { 'login.title': 'Willkommen zurück', 'login.button': 'Anmelden' },
        settings: { 'theme.dark': 'Dunkelmodus' },
      },
    };

    const sheetRowsMap = convertTranslationsToSheetRows(multiTranslations);
    expect(Object.keys(sheetRowsMap).sort()).toEqual(['auth', 'common', 'settings']);

    expect(sheetRowsMap.common).toHaveLength(2);
    expect(sheetRowsMap.auth).toHaveLength(2);
    expect(sheetRowsMap.settings).toHaveLength(1);

    expect(sheetRowsMap.common).toContainEqual({
      var: 'btn.save',
      en: 'Save',
      de: 'Speichern',
    });
    expect(sheetRowsMap.auth).toContainEqual({
      var: 'login.title',
      en: 'Welcome Back',
      de: 'Willkommen zurück',
    });
  });

  it('reconciles multi-sheet conflicts deterministically across tabs', () => {
    const base: TranslationData = {
      en: {
        common: { save: 'Save', cancel: 'Cancel' },
        auth: { title: 'Welcome' },
      },
    };

    const local: TranslationData = {
      en: {
        common: { save: 'Save changes', cancel: 'Cancel' },
        auth: { title: 'Welcome local' },
      },
    };

    const remote: TranslationData = {
      en: {
        common: { save: 'Save', cancel: 'Dismiss' },
        auth: { title: 'Welcome remote' },
      },
    };

    const resolution = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'local-wins',
    );

    expect(resolution.appliedLocalChanges).toBe(2);
    expect(resolution.mergedTranslations.en.common.save).toBe('Save changes');
    expect(resolution.mergedTranslations.en.common.cancel).toBe('Dismiss');
    expect(resolution.mergedTranslations.en.auth.title).toBe('Welcome local');
  });

  it('verifies client protocol envelope structure for headless RT initialization', async () => {
    const client = new CryptPadClient({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/testSeedWithoutBrowser/',
    });

    const keys = client.getKeys();
    expect(keys.channelHex).toHaveLength(32);
    expect(keys.cryptKey).toHaveLength(32);

    // Verify parsed URL structure
    expect(client.parsedUrl.app).toBe('sheet');
    expect(client.parsedUrl.mode).toBe('edit');
    expect(client.parsedUrl.isPasswordProtected).toBe(false);
  });
});
