import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCryptPadAssetSyncProvider } from '../../../src/providers/cryptpad/assetProvider';
import type { CanonicalAssetEntry } from '../../../src/providers/assetContracts';

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'gst-asset-provider-'));
}

function entry(overrides: Partial<CanonicalAssetEntry> = {}): CanonicalAssetEntry {
  return {
    assetId: 'logo',
    relativePath: 'images/logo.png',
    ...overrides,
  };
}

describe('createCryptPadAssetSyncProvider', () => {
  it('declares asset-sync and discover-by-folder capabilities', () => {
    const provider = createCryptPadAssetSyncProvider({ manifestPath: '/manifest.json' });

    expect(provider.kind).toBe('asset-sync');
    expect(provider.providerId).toBe('cryptpad-assets');
    expect(provider.displayName).toBe('CryptPad Asset Sync');
    expect(provider.capabilities.assetSync).toBe(true);
    expect(provider.capabilities.discoverByFolder).toBe(true);
  });

  it('honors custom providerId and displayName options', () => {
    const provider = createCryptPadAssetSyncProvider({
      manifestPath: '/manifest.json',
      providerId: 'custom-assets',
      displayName: 'Custom Assets',
    });

    expect(provider.providerId).toBe('custom-assets');
    expect(provider.displayName).toBe('Custom Assets');
  });

  it('downloads new assets that do not yet exist locally', async () => {
    const content = Buffer.from('new-file');
    const writeFile = vi.fn().mockResolvedValue(undefined);

    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        readAssetBuffer: vi.fn().mockResolvedValue(content),
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        writeFile,
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn(),
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out' });

    expect(result.manifestCount).toBe(1);
    expect(result.downloaded).toEqual(['images/logo.png']);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('images/logo.png'),
      content,
    );
  });

  it('updates an existing asset when content hash differs', async () => {
    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        readAssetBuffer: vi.fn().mockResolvedValue(Buffer.from('new-content')),
        fileExists: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(Buffer.from('old-content')),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn(),
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out' });

    expect(result.updated).toEqual(['images/logo.png']);
    expect(result.downloaded).toEqual([]);
  });

  it('skips an existing asset when content hash matches', async () => {
    const sameContent = Buffer.from('unchanged');
    const writeFile = vi.fn();

    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        readAssetBuffer: vi.fn().mockResolvedValue(sameContent),
        fileExists: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(sameContent),
        writeFile,
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn(),
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out' });

    expect(result.skipped).toEqual(['images/logo.png']);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reuses cached content for assets sharing the same declared hash', async () => {
    const readAssetBuffer = vi.fn().mockResolvedValue(Buffer.from('shared'));

    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([
          entry({ assetId: 'a', relativePath: 'a.png', hash: 'shared-hash' }),
          entry({ assetId: 'b', relativePath: 'b.png', hash: 'shared-hash' }),
        ]),
        readAssetBuffer,
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        deleteFile: vi.fn(),
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out' });

    expect(readAssetBuffer).toHaveBeenCalledTimes(1);
    expect(result.downloaded).toEqual(['a.png', 'b.png']);
  });

  it('deletes local files not present in the manifest when deleteMissing is set', async () => {
    const deleteFile = vi.fn().mockResolvedValue(undefined);

    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        readAssetBuffer: vi.fn().mockResolvedValue(Buffer.from('x')),
        fileExists: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(Buffer.from('x')),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue(['/out/images/logo.png', '/out/stale/orphan.png']),
        deleteFile,
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out', deleteMissing: true });

    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(result.deleted).toEqual(['stale/orphan.png']);
  });

  it('does not delete anything when deleteMissing is not set', async () => {
    const deleteFile = vi.fn();

    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        readAssetBuffer: vi.fn().mockResolvedValue(Buffer.from('x')),
        fileExists: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(Buffer.from('x')),
        writeFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn(),
        deleteFile,
      },
    );

    const result = await provider.syncAssets({ targetDirectory: '/out' });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });

  it('blocks path traversal outside the target directory', async () => {
    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([
          entry({ relativePath: '../../etc/passwd' }),
        ]),
        readAssetBuffer: vi.fn(),
        fileExists: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        listFiles: vi.fn(),
        deleteFile: vi.fn(),
      },
    );

    await expect(provider.syncAssets({ targetDirectory: '/out' })).rejects.toThrow(
      'Unsafe asset path blocked',
    );
  });

  it('throws when an asset has neither sourcePath nor sourceUrl (default readAssetBuffer)', async () => {
    const provider = createCryptPadAssetSyncProvider(
      { manifestPath: '/manifest.json' },
      {
        readManifest: vi.fn().mockResolvedValue([entry()]),
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        listFiles: vi.fn(),
        deleteFile: vi.fn(),
      },
    );

    await expect(provider.syncAssets({ targetDirectory: '/out' })).rejects.toThrow(
      'must define sourcePath or sourceUrl',
    );
  });

  it('throws when the manifest file does not contain a JSON array (default readManifest)', async () => {
    const fs = await import('node:fs/promises');
    const readFileSpy = vi.spyOn(fs.default, 'readFile').mockResolvedValue('{}' as any);

    const provider = createCryptPadAssetSyncProvider({ manifestPath: '/manifest.json' });

    await expect(provider.syncAssets({ targetDirectory: '/out' })).rejects.toThrow(
      'CryptPad asset manifest must be a JSON array.',
    );

    readFileSpy.mockRestore();
  });

  describe('default dependencies (real filesystem + fetch)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('reads manifest, sourcePath assets, and writes nested target files on disk', async () => {
      const workDir = await createTempDir();
      const sourceDir = path.join(workDir, 'source');
      const targetDir = path.join(workDir, 'target');
      await fs.mkdir(sourceDir, { recursive: true });

      const sourceFile = path.join(sourceDir, 'logo.png');
      await fs.writeFile(sourceFile, 'logo-bytes');

      const manifestPath = path.join(workDir, 'manifest.json');
      const manifest: CanonicalAssetEntry[] = [
        { assetId: 'logo', relativePath: 'nested/logo.png', sourcePath: sourceFile },
      ];
      await fs.writeFile(manifestPath, JSON.stringify(manifest));

      const provider = createCryptPadAssetSyncProvider({ manifestPath });
      const result = await provider.syncAssets({ targetDirectory: targetDir });

      expect(result.manifestCount).toBe(1);
      expect(result.downloaded).toEqual(['nested/logo.png']);

      const written = await fs.readFile(path.join(targetDir, 'nested', 'logo.png'), 'utf8');
      expect(written).toBe('logo-bytes');
    });

    it('fetches sourceUrl assets and throws on a non-ok response', async () => {
      const workDir = await createTempDir();
      const manifestPath = path.join(workDir, 'manifest.json');

      const okManifest: CanonicalAssetEntry[] = [
        { assetId: 'remote', relativePath: 'remote.png', sourceUrl: 'https://example.com/remote.png' },
      ];
      await fs.writeFile(manifestPath, JSON.stringify(okManifest));

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: async () => new TextEncoder().encode('remote-bytes').buffer,
        }),
      );

      const provider = createCryptPadAssetSyncProvider({ manifestPath });
      const result = await provider.syncAssets({ targetDirectory: path.join(workDir, 'target') });
      expect(result.downloaded).toEqual(['remote.png']);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      const failingProvider = createCryptPadAssetSyncProvider({ manifestPath });
      await expect(
        failingProvider.syncAssets({ targetDirectory: path.join(workDir, 'target2') }),
      ).rejects.toThrow('Failed to fetch asset from https://example.com/remote.png (HTTP 404)');
    });

    it('walks nested directories and deletes stale files when deleteMissing is set', async () => {
      const workDir = await createTempDir();
      const targetDir = path.join(workDir, 'target');
      await fs.mkdir(path.join(targetDir, 'stale-dir'), { recursive: true });
      await fs.writeFile(path.join(targetDir, 'stale-dir', 'orphan.png'), 'old');

      const sourceFile = path.join(workDir, 'kept.png');
      await fs.writeFile(sourceFile, 'kept-bytes');

      const manifestPath = path.join(workDir, 'manifest.json');
      const manifest: CanonicalAssetEntry[] = [
        { assetId: 'kept', relativePath: 'kept.png', sourcePath: sourceFile },
      ];
      await fs.writeFile(manifestPath, JSON.stringify(manifest));

      const provider = createCryptPadAssetSyncProvider({ manifestPath });
      const result = await provider.syncAssets({ targetDirectory: targetDir, deleteMissing: true });

      expect(result.downloaded).toEqual(['kept.png']);
      expect(result.deleted).toEqual([path.join('stale-dir', 'orphan.png')]);
      await expect(fs.access(path.join(targetDir, 'stale-dir', 'orphan.png'))).rejects.toThrow();
    });

    it('skips re-downloading an asset that already exists with matching content', async () => {
      const workDir = await createTempDir();
      const targetDir = path.join(workDir, 'target');
      const sourceFile = path.join(workDir, 'kept.png');
      await fs.writeFile(sourceFile, 'kept-bytes');

      const manifestPath = path.join(workDir, 'manifest.json');
      const manifest: CanonicalAssetEntry[] = [
        { assetId: 'kept', relativePath: 'kept.png', sourcePath: sourceFile },
      ];
      await fs.writeFile(manifestPath, JSON.stringify(manifest));

      const provider = createCryptPadAssetSyncProvider({ manifestPath });
      const first = await provider.syncAssets({ targetDirectory: targetDir });
      expect(first.downloaded).toEqual(['kept.png']);

      const second = await provider.syncAssets({ targetDirectory: targetDir });
      expect(second.skipped).toEqual(['kept.png']);
      expect(second.downloaded).toEqual([]);
    });

    it('returns an empty file list when walking a directory that does not exist yet', async () => {
      const workDir = await createTempDir();
      const manifestPath = path.join(workDir, 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify([]));

      const provider = createCryptPadAssetSyncProvider({ manifestPath });
      const result = await provider.syncAssets({
        targetDirectory: path.join(workDir, 'does-not-exist'),
        deleteMissing: true,
      });

      expect(result.manifestCount).toBe(0);
      expect(result.deleted).toEqual([]);
    });
  });
});
