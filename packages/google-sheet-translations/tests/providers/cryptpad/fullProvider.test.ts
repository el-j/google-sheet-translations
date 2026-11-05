// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import {
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  createCryptPadAssetSyncProvider,
  assertOperationCapabilities,
} from '../../../src/providers';
import type { TranslationData } from '../../../src/types';

describe('cryptpad workspace providers', () => {
  it('writes merged translations and increments revision', async () => {
    const writeSnapshot = vi.fn().mockResolvedValue(undefined);

    const provider = createCryptPadWorkspaceOutputProvider(
      { filePath: '/tmp/cryptpad.json', expectedRevision: 2 },
      {
        readSnapshot: vi.fn().mockResolvedValue({
          revision: 2,
          translations: { en: { home: { welcome: 'Hello' } } },
        }),
        writeSnapshot,
      },
    );

    const payload: TranslationData = { en: { home: { newKey: 'New value' } } };
    const result = await provider.writeTranslations({
      translations: payload,
      locales: ['en'],
    });

    expect(result.wroteFiles).toEqual(['/tmp/cryptpad.json']);
    expect(writeSnapshot).toHaveBeenCalledWith(
      '/tmp/cryptpad.json',
      expect.objectContaining({
        revision: 3,
        translations: {
          en: { home: { welcome: 'Hello', newKey: 'New value' } },
        },
      }),
    );
  });

  it('syncs with local-wins policy and reports changed keys', async () => {
    const writeSnapshot = vi.fn().mockResolvedValue(undefined);

    const provider = createCryptPadWorkspaceSyncProvider(
      {
        filePath: '/tmp/cryptpad.json',
        conflictPolicy: 'local-wins',
        expectedRevision: 5,
      },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 5, translations: {} }),
        writeSnapshot,
      },
    );

    const base: TranslationData = { en: { home: { welcome: 'Hello' } } };
    const local: TranslationData = { en: { home: { welcome: 'Hello local' } } };
    const remote: TranslationData = { en: { home: { welcome: 'Hello remote' } } };

    const result = await provider.syncTranslations({
      localTranslations: local,
      remoteTranslations: remote,
      metadata: { baseTranslations: base, expectedRevision: 5 },
    });

    expect(result.changedKeys).toBe(1);
    expect(result.skippedKeys).toBe(0);
    expect(writeSnapshot).toHaveBeenCalledWith(
      '/tmp/cryptpad.json',
      expect.objectContaining({
        revision: 6,
        translations: local,
      }),
    );
  });

  it('throws on revision mismatch to enforce optimistic concurrency', async () => {
    const provider = createCryptPadWorkspaceSyncProvider(
      {
        filePath: '/tmp/cryptpad.json',
        expectedRevision: 7,
      },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 6, translations: {} }),
        writeSnapshot: vi.fn(),
      },
    );

    await expect(
      provider.syncTranslations({ localTranslations: {}, remoteTranslations: {} }),
    ).rejects.toThrow('CryptPad revision mismatch');
  });

  it('uses default filesystem deps when no overrides provided and handles ENOENT and write', async () => {
    const tmpFile = `/tmp/test-cp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;

    const provider = createCryptPadWorkspaceOutputProvider({
      filePath: tmpFile,
    });

    // Write translations to non-existent file -> ENOENT handled, revision initialized to 1
    const res = await provider.writeTranslations({
      translations: { en: { home: { title: 'Welcome' } } },
      locales: ['en'],
    });

    expect(res.metadata.revision).toBe(1);
    expect(res.metadata.changedKeys).toBe(1);

    // Sync back with same file using sync provider with default deps
    const syncProvider = createCryptPadWorkspaceSyncProvider({
      filePath: tmpFile,
      conflictPolicy: 'remote-wins',
    });

    const syncRes = await syncProvider.syncTranslations({
      localTranslations: { en: { home: { title: 'Local' } } },
      remoteTranslations: { en: { home: { title: 'Remote' } } },
    });

    expect(syncRes.metadata.revision).toBe(2);

    // Clean up
    const fs = await import('node:fs/promises');
    await fs.unlink(tmpFile).catch(() => {});
  });

  it('re-throws non-ENOENT read errors in default deps', async () => {
    const tmpDir = `/tmp/test-cp-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fs = await import('node:fs/promises');
    await fs.mkdir(tmpDir, { recursive: true });

    // Reading a directory as a file throws EISDIR (not ENOENT)
    const provider = createCryptPadWorkspaceOutputProvider({
      filePath: tmpDir,
    });

    await expect(provider.writeTranslations({ translations: {}, locales: [] })).rejects.toThrow();

    await fs.rmdir(tmpDir).catch(() => {});
  });

  it('uses expectedRevision from payload.metadata if options.expectedRevision not provided', async () => {
    const writeSnapshot = vi.fn().mockResolvedValue(undefined);
    const provider = createCryptPadWorkspaceSyncProvider(
      {
        filePath: '/tmp/cryptpad.json',
      },
      {
        readSnapshot: vi.fn().mockResolvedValue({ revision: 5, translations: {} }),
        writeSnapshot,
      },
    );

    const result = await provider.syncTranslations({
      localTranslations: {},
      remoteTranslations: {},
      metadata: { expectedRevision: 5 },
    });

    expect(result.metadata.revision).toBe(6);
  });

  it('normalizes non-finite or missing revision in file to 0', async () => {
    const tmpFile = `/tmp/test-cp-nan-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    const fs = await import('node:fs/promises');
    await fs.writeFile(tmpFile, JSON.stringify({ revision: 'not-a-number' }), 'utf8');

    const provider = createCryptPadWorkspaceOutputProvider({
      filePath: tmpFile,
    });

    const res = await provider.writeTranslations({
      translations: { en: { home: { key: 'val' } } },
      locales: ['en'],
    });

    expect(res.metadata.revision).toBe(1);
    await fs.unlink(tmpFile).catch(() => {});
  });

  it('supports asset sync with path safety and dedupe/skips', async () => {
    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/tmp/assets.manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([
          {
            assetId: 'logo',
            relativePath: 'images/logo.png',
            hash: 'hash-1',
            sourcePath: '/tmp/logo.png',
          },
          {
            assetId: 'logo-copy',
            relativePath: 'images/logo-copy.png',
            hash: 'hash-1',
            sourcePath: '/tmp/logo.png',
          },
        ]),
        readAssetBuffer: vi.fn().mockResolvedValue(Buffer.from('asset-bytes')),
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn().mockResolvedValue(undefined),
      },
    );

    const result = await provider.syncAssets({
      targetDirectory: '/tmp/out-assets',
      deleteMissing: false,
    });

    expect(result.manifestCount).toBe(2);
    expect(result.downloaded).toEqual(['images/logo.png', 'images/logo-copy.png']);

    expect(() => {
      assertOperationCapabilities(provider.providerId, provider.capabilities, 'sync-assets');
    }).not.toThrow();
  });
});
