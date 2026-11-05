import { describe, expect, it, vi } from 'vitest';
import {
  createCryptPadSheetSyncProvider,
  CRYPTPAD_SHEET_SYNC_CAPABILITIES,
} from '../../../src/providers/cryptpad/sheetSyncProvider';
import { CryptPadClient } from '../../../src/providers/cryptpad/client';

describe('cryptpad sheet sync provider', () => {
  it('declares syncBack and writeTables capabilities', () => {
    expect(CRYPTPAD_SHEET_SYNC_CAPABILITIES.syncBack).toBe(true);
    expect(CRYPTPAD_SHEET_SYNC_CAPABILITIES.writeTables).toBe(true);
  });

  describe('default mode (no base snapshot supplied) — matches Google Sheets sync exactly (#164)', () => {
    it('skips sync and returns 0 changedKeys if there is no local diff', async () => {
      const mockWriteSheetRows = vi.fn();
      vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

      const provider = createCryptPadSheetSyncProvider({
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        password: 'test-test',
      });

      const identical = { en: { common: { title: 'Hello' } } };
      const result = await provider.syncTranslations({
        localTranslations: identical,
        remoteTranslations: identical,
      });

      expect(result.changedKeys).toBe(0);
      expect(result.metadata?.reason).toBe('no-local-diff');
      expect(result.metadata?.mode).toBe('new-keys-only');
      expect(mockWriteSheetRows).not.toHaveBeenCalled();
    });

    it('pushes brand-new local keys', async () => {
      const mockWriteSheetRows = vi.fn().mockResolvedValue(1);
      vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

      const provider = createCryptPadSheetSyncProvider({
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        password: 'test-test',
      });

      const remote = { en: { common: { title: 'Hello' } } };
      const local = { en: { common: { title: 'Hello', subtitle: 'New key' } } };

      const result = await provider.syncTranslations({
        localTranslations: local,
        remoteTranslations: remote,
      });

      expect(mockWriteSheetRows).toHaveBeenCalledTimes(1);
      const pushedRows = mockWriteSheetRows.mock.calls[0][1];
      expect(pushedRows.some((r: any) => r.key === 'subtitle' && r.en === 'New key')).toBe(true);
      expect(result.changedKeys).toBe(1);
      expect(result.metadata?.mode).toBe('new-keys-only');
    });

    it('does NOT push a key that exists both locally and remotely with a different value (no base = no overwrite, same as Google)', async () => {
      const mockWriteSheetRows = vi.fn();
      vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

      const provider = createCryptPadSheetSyncProvider({
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        password: 'test-test',
        conflictPolicy: 'local-wins', // must be ignored in default mode — no base means no conflicts
      });

      const remote = { en: { common: { title: 'Hello Remote' } } };
      const local = { en: { common: { title: 'Hello Local' } } };

      const result = await provider.syncTranslations({
        localTranslations: local,
        remoteTranslations: remote,
      });

      expect(mockWriteSheetRows).not.toHaveBeenCalled();
      expect(result.changedKeys).toBe(0);
    });
  });

  describe('advanced mode (explicit base snapshot in metadata) — genuine three-way merge', () => {
    it('applies a conflicting update when conflictPolicy is local-wins', async () => {
      const mockWriteSheetRows = vi.fn().mockResolvedValue(1);
      vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

      const provider = createCryptPadSheetSyncProvider({
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        password: 'test-test',
        conflictPolicy: 'local-wins',
      });

      const base = { en: { common: { title: 'Hello Base' } } };
      const remote = { en: { common: { title: 'Hello Remote' } } };
      const local = { en: { common: { title: 'Hello Local' } } };

      const result = await provider.syncTranslations({
        localTranslations: local,
        remoteTranslations: remote,
        metadata: { baseTranslations: base },
      });

      expect(mockWriteSheetRows).toHaveBeenCalled();
      const pushedRows = mockWriteSheetRows.mock.calls[0][1];
      expect(pushedRows.some((r: any) => r.key === 'title' && r.en === 'Hello Local')).toBe(true);
      expect(result.changedKeys).toBeGreaterThanOrEqual(1);
      expect(result.metadata?.provider).toBe('cryptpad-sheet');
      expect(result.metadata?.mode).toBe('three-way');
    });

    it('skips a conflicting update when conflictPolicy is manual (default)', async () => {
      const mockWriteSheetRows = vi.fn();
      vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

      const provider = createCryptPadSheetSyncProvider({
        url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        password: 'test-test',
      });

      const base = { en: { common: { title: 'Hello Base' } } };
      const remote = { en: { common: { title: 'Hello Remote' } } };
      const local = { en: { common: { title: 'Hello Local' } } };

      const result = await provider.syncTranslations({
        localTranslations: local,
        remoteTranslations: remote,
        metadata: { baseTranslations: base },
      });

      expect(mockWriteSheetRows).not.toHaveBeenCalled();
      expect(result.changedKeys).toBe(0);
      expect(result.skippedKeys).toBe(1);
    });
  });

  it('throws if no url is provided', () => {
    const saved = process.env.CRYPTPAD_URL;
    delete process.env.CRYPTPAD_URL;
    try {
      expect(() => createCryptPadSheetSyncProvider({})).toThrow('requires a "url" option');
    } finally {
      if (saved) process.env.CRYPTPAD_URL = saved;
    }
  });
});
