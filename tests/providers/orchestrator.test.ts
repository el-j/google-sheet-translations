import { describe, expect, it, vi } from 'vitest';
import { runProviderPipeline } from '../../src/providers/orchestrator';
import { createCapabilitySet } from '../../src/providers/capabilities';
import type {
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
} from '../../src/providers/contracts';

describe('provider orchestrator', () => {
  it('runs input + transform + output + sync flow', async () => {
    const inputProvider: TranslationInputProvider = {
      kind: 'input',
      providerId: 'input-a',
      displayName: 'Input A',
      capabilities: createCapabilitySet({ readTables: true }),
      readTables: vi.fn().mockResolvedValue({
        tables: [{ tableId: '1', tableName: 'home', rows: [{ key: 'welcome', en: 'Welcome' }] }],
        metadata: { source: 'test' },
      }),
    };

    const outputProvider: TranslationOutputProvider = {
      kind: 'output',
      providerId: 'output-a',
      displayName: 'Output A',
      capabilities: createCapabilitySet({ writeTables: true }),
      writeTranslations: vi.fn().mockResolvedValue({ wroteFiles: ['translations/en.json'] }),
    };

    const syncProvider: TranslationSyncProvider = {
      kind: 'sync',
      providerId: 'sync-a',
      displayName: 'Sync A',
      capabilities: createCapabilitySet({ syncBack: true }),
      syncTranslations: vi.fn().mockResolvedValue({ changedKeys: 1, skippedKeys: 0 }),
    };

    const result = await runProviderPipeline(
      {
        inputProvider,
        outputProvider,
        syncProvider,
        localTranslationsForSync: { en: { home: { welcome: 'Welcome local' } } },
      },
      {
        transformRows: vi.fn().mockReturnValue({
          translations: { en: { home: { welcome: 'Welcome' } } },
          locales: ['en'],
          localeMapping: { en: 'en' },
          originalMapping: { en: 'en' },
          success: true,
        }),
        logger: { warn: vi.fn() },
      },
    );

    expect(inputProvider.readTables).toHaveBeenCalled();
    expect(outputProvider.writeTranslations).toHaveBeenCalled();
    expect(syncProvider.syncTranslations).toHaveBeenCalled();
    expect(result.locales).toEqual(['en']);
    expect(result.inputTableCount).toBe(1);
  });

  it('fails fast when input provider lacks required read capability', async () => {
    const inputProvider: TranslationInputProvider = {
      kind: 'input',
      providerId: 'input-no-read',
      displayName: 'Input Missing Read',
      capabilities: createCapabilitySet({ readTables: false }),
      readTables: vi.fn(),
    };

    await expect(
      runProviderPipeline({ inputProvider }),
    ).rejects.toThrow('missing required capabilities');
  });

  it('fails when output is requested but provider lacks write capability', async () => {
    const inputProvider: TranslationInputProvider = {
      kind: 'input',
      providerId: 'input-a',
      displayName: 'Input A',
      capabilities: createCapabilitySet({ readTables: true }),
      readTables: vi.fn().mockResolvedValue({ tables: [] }),
    };

    const outputProvider: TranslationOutputProvider = {
      kind: 'output',
      providerId: 'output-no-write',
      displayName: 'Output Missing Write',
      capabilities: createCapabilitySet({ writeTables: false }),
      writeTranslations: vi.fn(),
    };

    await expect(
      runProviderPipeline({ inputProvider, outputProvider }),
    ).rejects.toThrow('missing required capabilities');
  });

  it('skips unsuccessful table transformations gracefully', async () => {
    const warn = vi.fn();

    const inputProvider: TranslationInputProvider = {
      kind: 'input',
      providerId: 'input-a',
      displayName: 'Input A',
      capabilities: createCapabilitySet({ readTables: true }),
      readTables: vi.fn().mockResolvedValue({
        tables: [{ tableId: '1', tableName: 'home', rows: [{ key: 'k', en: 'v' }] }],
      }),
    };

    const result = await runProviderPipeline(
      { inputProvider },
      {
        transformRows: vi.fn().mockReturnValue({
          translations: {},
          locales: [],
          localeMapping: {},
          originalMapping: {},
          success: false,
        }),
        logger: { warn },
      },
    );

    expect(warn).toHaveBeenCalled();
    expect(result.translations).toEqual({});
  });
});
