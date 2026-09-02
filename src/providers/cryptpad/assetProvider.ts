import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import type {
  AssetSyncProvider,
  AssetSyncRequest,
  AssetSyncResult,
  CanonicalAssetEntry,
} from '../assetContracts';

export interface CryptPadAssetSyncProviderOptions {
  manifestPath: string;
  providerId?: string;
  displayName?: string;
}

interface CryptPadAssetSyncProviderDeps {
  readManifest: (manifestPath: string) => Promise<CanonicalAssetEntry[]>;
  readAssetBuffer: (asset: CanonicalAssetEntry, signal?: AbortSignal) => Promise<Buffer>;
  fileExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<Buffer>;
  writeFile: (filePath: string, content: Buffer) => Promise<void>;
  listFiles: (directory: string) => Promise<string[]>;
  deleteFile: (filePath: string) => Promise<void>;
}

const CRYPTPAD_ASSET_SYNC_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  assetSync: true,
  discoverByFolder: true,
});

function toSha256(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isSafePath(targetDirectory: string, relativePath: string): boolean {
  const resolvedRoot = path.resolve(targetDirectory);
  const resolvedTarget = path.resolve(targetDirectory, relativePath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

async function walkFiles(directory: string): Promise<string[]> {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function createDefaultDeps(): CryptPadAssetSyncProviderDeps {
  return {
    async readManifest(manifestPath: string): Promise<CanonicalAssetEntry[]> {
      const content = await fsp.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('CryptPad asset manifest must be a JSON array.');
      }
      return parsed as CanonicalAssetEntry[];
    },
    async readAssetBuffer(asset: CanonicalAssetEntry, signal?: AbortSignal): Promise<Buffer> {
      if (asset.sourcePath) {
        return fsp.readFile(asset.sourcePath);
      }
      if (asset.sourceUrl) {
        const response = await fetch(asset.sourceUrl, { signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch asset from ${asset.sourceUrl} (HTTP ${response.status})`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer;
      }
      throw new Error(`Asset "${asset.assetId}" must define sourcePath or sourceUrl.`);
    },
    async fileExists(filePath: string): Promise<boolean> {
      try {
        await fsp.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    readFile: (filePath: string) => fsp.readFile(filePath),
    async writeFile(filePath: string, content: Buffer): Promise<void> {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, content);
    },
    listFiles: walkFiles,
    deleteFile: (filePath: string) => fsp.unlink(filePath),
  };
}

export function createCryptPadAssetSyncProvider(
  options: CryptPadAssetSyncProviderOptions,
  depsOverrides: Partial<CryptPadAssetSyncProviderDeps> = {},
): AssetSyncProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'asset-sync',
    providerId: options.providerId ?? 'cryptpad-assets',
    displayName: options.displayName ?? 'CryptPad Asset Sync',
    capabilities: CRYPTPAD_ASSET_SYNC_CAPABILITIES,
    async syncAssets(request: AssetSyncRequest): Promise<AssetSyncResult> {
      const manifest = await deps.readManifest(options.manifestPath);
      const downloaded: string[] = [];
      const updated: string[] = [];
      const skipped: string[] = [];
      const deleted: string[] = [];
      const desiredTargets = new Set<string>();
      const hashCache = new Map<string, Buffer>();

      for (const asset of manifest) {
        if (!isSafePath(request.targetDirectory, asset.relativePath)) {
          throw new Error(`Unsafe asset path blocked: ${asset.relativePath}`);
        }

        const targetPath = path.resolve(request.targetDirectory, asset.relativePath);
        desiredTargets.add(targetPath);

        let content: Buffer;
        if (asset.hash && hashCache.has(asset.hash)) {
          content = hashCache.get(asset.hash) as Buffer;
        } else {
          content = await deps.readAssetBuffer(asset, request.signal);
          const hash = asset.hash ?? toSha256(content);
          hashCache.set(hash, content);
        }

        const exists = await deps.fileExists(targetPath);
        if (exists) {
          const current = await deps.readFile(targetPath);
          if (toSha256(current) === toSha256(content)) {
            skipped.push(asset.relativePath);
            continue;
          }
          await deps.writeFile(targetPath, content);
          updated.push(asset.relativePath);
          continue;
        }

        await deps.writeFile(targetPath, content);
        downloaded.push(asset.relativePath);
      }

      if (request.deleteMissing) {
        const existingFiles = await deps.listFiles(request.targetDirectory);
        for (const existingFile of existingFiles) {
          const resolved = path.resolve(existingFile);
          if (!desiredTargets.has(resolved)) {
            await deps.deleteFile(resolved);
            deleted.push(path.relative(request.targetDirectory, resolved));
          }
        }
      }

      return {
        manifestCount: manifest.length,
        downloaded,
        updated,
        deleted,
        skipped,
      };
    },
  };
}

export { CRYPTPAD_ASSET_SYNC_CAPABILITIES };
