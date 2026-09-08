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
    expect(mockWriteSheetRows).not.toHaveBeenCalled();
  });

  it('pushes local diffs to sheet tabs when changes are detected', async () => {
    const mockWriteSheetRows = vi.fn().mockResolvedValue(2);
    vi.spyOn(CryptPadClient.prototype, 'writeSheetRows').mockImplementation(mockWriteSheetRows);

    const provider = createCryptPadSheetSyncProvider({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
      conflictPolicy: 'local-wins',
    });

    const remote = { en: { common: { title: 'Hello Remote' } } };
    const local = { en: { common: { title: 'Hello Local' } } };

    const result = await provider.syncTranslations({
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(mockWriteSheetRows).toHaveBeenCalled();
    expect(result.changedKeys).toBeGreaterThanOrEqual(1);
    expect(result.metadata?.provider).toBe('cryptpad-sheet');
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
