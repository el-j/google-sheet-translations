import { describe, expect, it, vi } from 'vitest';
import {
  createCryptPadCsvInputProvider,
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  createCryptPadAssetSyncProvider,
  createDefaultProviderCatalog,
  runProviderPipeline,
  assertOperationCapabilities,
} from '../../src/providers';
import type { TranslationData } from '../../src/types';

describe('provider parity matrix', () => {
  it('passes contract gates for input/output/sync/assets/discovery', async () => {
    const inputProvider = createCryptPadCsvInputProvider(
      {
        sources: [{ tableName: 'home', filePath: '/tmp/home.csv' }],
      },
      {
        readCsvFile: vi.fn().mockResolvedValue('key,en\nwelcome,Hello\n'),
        fetchCsv: vi.fn(),
      },
    );

    const outputProvider = createCryptPadWorkspaceOutputProvider(
      { filePath: '/tmp/state.json' },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 1, translations: {} }),
        writeSnapshot: vi.fn().mockResolvedValue(undefined),
      },
    );

    const syncProvider = createCryptPadWorkspaceSyncProvider(
      { filePath: '/tmp/state.json', conflictPolicy: 'manual' },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 1, translations: {} }),
        writeSnapshot: vi.fn().mockResolvedValue(undefined),
      },
    );

    const assetProvider = createCryptPadAssetSyncProvider(
      { manifestPath: '/tmp/assets.json' },
      {
        readManifest: vi.fn().mockResolvedValue([]),
        readAssetBuffer: vi.fn(),
        fileExists: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn().mockResolvedValue(undefined),
      },
    );

    const catalogProvider = createDefaultProviderCatalog();

    expect(() =>
      assertOperationCapabilities(inputProvider.providerId, inputProvider.capabilities, 'read-input'),
    ).not.toThrow();
    expect(() =>
      assertOperationCapabilities(outputProvider.providerId, outputProvider.capabilities, 'write-output'),
    ).not.toThrow();
    expect(() =>
      assertOperationCapabilities(syncProvider.providerId, syncProvider.capabilities, 'sync-back'),
    ).not.toThrow();
    expect(() =>
      assertOperationCapabilities(assetProvider.providerId, assetProvider.capabilities, 'sync-assets'),
    ).not.toThrow();
    expect(() =>
      assertOperationCapabilities(catalogProvider.providerId, catalogProvider.capabilities, 'discover-sources'),
    ).not.toThrow();
  });

  it('runs integration matrix for google full and cryptpad full modes', async () => {
    const cryptpadInput = createCryptPadCsvInputProvider(
      {
        sources: [{ tableName: 'home', filePath: '/tmp/home.csv' }],
      },
      {
        readCsvFile: vi.fn().mockResolvedValue('key,en\nwelcome,Hello\n'),
        fetchCsv: vi.fn(),
      },
    );

    const cryptpadOutput = createCryptPadWorkspaceOutputProvider(
      { filePath: '/tmp/state.json' },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 1, translations: {} }),
        writeSnapshot: vi.fn().mockResolvedValue(undefined),
      },
    );

    const base: TranslationData = { en: { home: { welcome: 'Hello' } } };
    const local: TranslationData = { en: { home: { welcome: 'Hello local' } } };
    const remote: TranslationData = { en: { home: { welcome: 'Hello remote' } } };

    const cryptpadSync = createCryptPadWorkspaceSyncProvider(
      { filePath: '/tmp/state.json', conflictPolicy: 'local-wins' },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 1, translations: remote }),
        writeSnapshot: vi.fn().mockResolvedValue(undefined),
      },
    );

    const cryptpadResult = await runProviderPipeline({
      inputProvider: cryptpadInput,
      outputProvider: cryptpadOutput,
      syncProvider: cryptpadSync,
      localTranslationsForSync: local,
    });

    expect(cryptpadResult.inputTableCount).toBe(1);
    expect(cryptpadResult.outputResult).toBeDefined();
    expect(cryptpadResult.syncResult).toBeDefined();

    // Google full mode matrix path with mocked provider contracts
    const googleLikeResult = await runProviderPipeline({
      inputProvider: {
        kind: 'input',
        providerId: 'google-sheets',
        displayName: 'Google Input',
        capabilities: {
          readTables: true,
          writeTables: false,
          syncBack: false,
          readAssets: false,
          writeAssets: false,
          autoTranslateFormula: false,
          discoverByFolder: true,
          assetSync: false,
          publicReadNoAuth: true,
        },
        readTables: vi.fn().mockResolvedValue({
          tables: [{ tableId: 'sheet:home', tableName: 'home', rows: [{ key: 'welcome', en: 'Hello' }] }],
        }),
      },
      outputProvider: {
        kind: 'output',
        providerId: 'google-sheets',
        displayName: 'Google Output',
        capabilities: {
          readTables: false,
          writeTables: true,
          syncBack: false,
          readAssets: false,
          writeAssets: false,
          autoTranslateFormula: true,
          discoverByFolder: false,
          assetSync: false,
          publicReadNoAuth: false,
        },
        writeTranslations: vi.fn().mockResolvedValue({ wroteFiles: [] }),
      },
      syncProvider: {
        kind: 'sync',
        providerId: 'google-sheets',
        displayName: 'Google Sync',
        capabilities: {
          readTables: false,
          writeTables: true,
          syncBack: true,
          readAssets: false,
          writeAssets: false,
          autoTranslateFormula: true,
          discoverByFolder: false,
          assetSync: false,
          publicReadNoAuth: false,
        },
        syncTranslations: vi.fn().mockResolvedValue({ changedKeys: 1, skippedKeys: 0 }),
      },
      localTranslationsForSync: base,
    });

    expect(googleLikeResult.syncResult?.changedKeys).toBe(1);
  });
});
