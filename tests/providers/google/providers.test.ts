import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleSheetsInputProvider,
  createGoogleSheetsOutputProvider,
  createGoogleSheetsSyncProvider,
  GOOGLE_SHEETS_PROVIDER_CAPABILITIES,
} from '../../../src/providers/google';
import type { TranslationData } from '../../../src/types';

function passthroughRetry<T>(fn: () => Promise<T>) {
  return fn();
}

describe('google provider adapters', () => {
  it('declares capabilities for input/output/sync adapters', () => {
    expect(GOOGLE_SHEETS_PROVIDER_CAPABILITIES.input.readTables).toBe(true);
    expect(GOOGLE_SHEETS_PROVIDER_CAPABILITIES.input.publicReadNoAuth).toBe(true);
    expect(GOOGLE_SHEETS_PROVIDER_CAPABILITIES.output.writeTables).toBe(true);
    expect(GOOGLE_SHEETS_PROVIDER_CAPABILITIES.output.autoTranslateFormula).toBe(true);
    expect(GOOGLE_SHEETS_PROVIDER_CAPABILITIES.sync.syncBack).toBe(true);
  });

  it('reads public tables via the public sheet reader', async () => {
    const readPublicSheet = vi.fn().mockResolvedValue([{ key: 'welcome', en: 'Welcome' }]);

    const provider = createGoogleSheetsInputProvider(
      {
        spreadsheetId: 'sheet-public',
        publicSheet: true,
      },
      {
        readPublicSheet,
        withRetry: passthroughRetry as any,
      },
    );

    const result = await provider.readTables({ tableNames: ['home'] });

    expect(readPublicSheet).toHaveBeenCalledWith('sheet-public', 'home');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].rows[0]).toEqual({ key: 'welcome', en: 'Welcome' });
    expect(result.metadata).toEqual({ spreadsheetId: 'sheet-public', sourceMode: 'public' });
  });

  it('reads authenticated tables from GoogleSpreadsheet sheetsByTitle', async () => {
    const getRows = vi.fn().mockResolvedValue([
      {
        toObject: () => ({ key: 'cta', en: 'Buy' }),
      },
    ]);

    const doc = {
      loadInfo: vi.fn().mockResolvedValue(undefined),
      sheetsByTitle: {
        home: { getRows },
      },
    };

    const createSpreadsheetClient = vi.fn().mockReturnValue(doc);
    const loggerWarn = vi.fn();

    const provider = createGoogleSheetsInputProvider(
      { spreadsheetId: 'sheet-auth' },
      {
        createAuthClient: vi.fn().mockReturnValue({} as any),
        createSpreadsheetClient: createSpreadsheetClient as any,
        withRetry: passthroughRetry as any,
        logger: { warn: loggerWarn, log: vi.fn() },
      },
    );

    const result = await provider.readTables({ tableNames: ['home', 'missing'] });

    expect(createSpreadsheetClient).toHaveBeenCalled();
    expect(doc.loadInfo).toHaveBeenCalledWith(true);
    expect(getRows).toHaveBeenCalledWith({ limit: 100 });
    expect(loggerWarn).toHaveBeenCalledWith('Sheet "missing" not found in the document');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('home');
  });

  it('writes translations through spreadsheet updater in output adapter', async () => {
    const updateSpreadsheetWithLocalChanges = vi.fn().mockResolvedValue(undefined);
    const doc = {
      loadInfo: vi.fn().mockResolvedValue(undefined),
      sheetsByTitle: {},
    };

    const provider = createGoogleSheetsOutputProvider(
      {
        spreadsheetId: 'sheet-out',
        waitSeconds: 2,
        autoTranslate: true,
        override: true,
      },
      {
        createAuthClient: vi.fn().mockReturnValue({} as any),
        createSpreadsheetClient: vi.fn().mockReturnValue(doc) as any,
        withRetry: passthroughRetry as any,
        updateSpreadsheetWithLocalChanges,
      },
    );

    const translations: TranslationData = {
      en: { home: { welcome: 'Welcome' } },
    };

    const result = await provider.writeTranslations({
      translations,
      locales: ['en'],
      localeMapping: { en: 'en' },
    });

    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalledWith(
      doc,
      translations,
      2,
      true,
      { en: 'en' },
      true,
    );
    expect(result.wroteFiles).toEqual([]);
  });

  it('sync adapter skips when there is no local diff', async () => {
    const updateSpreadsheetWithLocalChanges = vi.fn().mockResolvedValue(undefined);

    const provider = createGoogleSheetsSyncProvider(
      { spreadsheetId: 'sheet-sync' },
      {
        findLocalChanges: vi.fn().mockReturnValue({}) as any,
        updateSpreadsheetWithLocalChanges,
      },
    );

    const result = await provider.syncTranslations({
      localTranslations: { en: { home: { welcome: 'Welcome' } } },
      remoteTranslations: { en: { home: { welcome: 'Welcome' } } },
    });

    expect(result.changedKeys).toBe(0);
    expect(updateSpreadsheetWithLocalChanges).not.toHaveBeenCalled();
  });

  it('sync adapter pushes diff through spreadsheet updater', async () => {
    const changes: TranslationData = {
      en: { home: { welcome: 'Welcome' } },
    };

    const updateSpreadsheetWithLocalChanges = vi.fn().mockResolvedValue(undefined);
    const doc = {
      loadInfo: vi.fn().mockResolvedValue(undefined),
      sheetsByTitle: {},
    };

    const provider = createGoogleSheetsSyncProvider(
      {
        spreadsheetId: 'sheet-sync',
        autoTranslate: true,
      },
      {
        findLocalChanges: vi.fn().mockReturnValue(changes) as any,
        createAuthClient: vi.fn().mockReturnValue({} as any),
        createSpreadsheetClient: vi.fn().mockReturnValue(doc) as any,
        withRetry: passthroughRetry as any,
        updateSpreadsheetWithLocalChanges,
      },
    );

    const result = await provider.syncTranslations({
      localTranslations: changes,
      remoteTranslations: {},
    });

    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalledWith(
      doc,
      changes,
      1,
      true,
      {},
      false,
    );
    expect(result.changedKeys).toBe(1);
  });
});
