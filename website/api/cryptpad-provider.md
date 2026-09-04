# CryptPad Providers (v3)

Factory functions for the CryptPad provider family used by the v3 [provider runtime](/api/provider-platform): CSV input (read-only MVP), workspace output/sync, and asset sync.

```typescript
import {
  createCryptPadCsvInputProvider,
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  createCryptPadAssetSyncProvider,
} from '@el-j/google-sheet-translations';
```

These are usually not called directly — `createProvidersFromRuntimeConfig` calls them for you from a `ProviderRuntimeConfig` naming `cryptpad-csv`, `cryptpad-workspace`, or `cryptpad-assets`.

---

## `createCryptPadCsvInputProvider(options, depsOverrides?)`

Read-only input provider that reads one or more CSV sources (local files or public export URLs) as canonical tables.

```typescript
function createCryptPadCsvInputProvider(
  options: CryptPadCsvInputProviderOptions,
): TranslationInputProvider
```

```typescript
interface CryptPadCsvSource {
  tableName: string;
  url?: string;       // one of url or filePath is required
  filePath?: string;
  tableId?: string;
}

interface CryptPadCsvInputProviderOptions {
  sources: CryptPadCsvSource[];
  delimiter?: string;
  providerId?: string;
  displayName?: string;
}
```

This provider has no output/sync capability — pair it with `cryptpad-workspace` (or another output/sync provider) for write-back. Public URL sources require no authentication (`publicReadNoAuth: true`).

```typescript
const input = createCryptPadCsvInputProvider({
  sources: [{ tableName: 'home', filePath: './translations/home.csv' }],
});
```

---

## `createCryptPadWorkspaceOutputProvider(options, depsOverrides?)` / `createCryptPadWorkspaceSyncProvider(options, depsOverrides?)`

Both read and write a local JSON snapshot file representing CryptPad workspace state.

```typescript
interface CryptPadWorkspaceProviderOptions {
  filePath: string;                  // path to the JSON snapshot file
  authToken?: string;
  expectedRevision?: number;         // optimistic-concurrency guard
  conflictPolicy?: 'remote-wins' | 'local-wins' | 'manual'; // sync provider only
  providerId?: string;
  displayName?: string;
}

function createCryptPadWorkspaceOutputProvider(
  options: CryptPadWorkspaceProviderOptions,
): TranslationOutputProvider

function createCryptPadWorkspaceSyncProvider(
  options: CryptPadWorkspaceProviderOptions,
): TranslationSyncProvider
```

- **Output**: reads the current snapshot, checks `expectedRevision` (if set), deep-merges new translations over the existing ones, writes back with the revision incremented by one.
- **Sync**: reconciles local changes against the snapshot using the [sync engine](/api/provider-platform#sync-engine-three-way-diff) (three-way diff against `payload.metadata.baseTranslations`, falling back to the remote snapshot as base) under the configured `conflictPolicy`, then writes back with the revision incremented.
- Both throw `CryptPad revision mismatch: expected X, received Y.` if `expectedRevision` doesn't match the on-disk revision — use this to catch concurrent writers.

---

## `createCryptPadAssetSyncProvider(options, depsOverrides?)`

Syncs binary/static assets described by a JSON manifest into a local target directory.

```typescript
function createCryptPadAssetSyncProvider(
  options: CryptPadAssetSyncProviderOptions,
): AssetSyncProvider
```

```typescript
interface CryptPadAssetSyncProviderOptions {
  manifestPath: string; // path to a JSON file containing CanonicalAssetEntry[]
  providerId?: string;
  displayName?: string;
}

interface CanonicalAssetEntry {
  assetId: string;
  relativePath: string;   // destination path, relative to the sync target directory
  hash?: string;          // known SHA-256; entries sharing a hash reuse one fetch
  sourceUrl?: string;
  sourcePath?: string;
  modifiedTime?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}
```

For each manifest entry, `syncAssets({ targetDirectory, deleteMissing? })`:

- **Downloads** a file that doesn't yet exist locally.
- **Updates** a file whose SHA-256 hash differs from the manifest entry's content.
- **Skips** a file that's already up to date.
- When `deleteMissing: true`, **deletes** local files under `targetDirectory` that aren't named by the manifest.

Every target path is checked against the target directory root and rejected with `Unsafe asset path blocked: <path>` if a manifest entry's `relativePath` would traverse outside it (e.g. via `../`).

```typescript
const assetSync = createCryptPadAssetSyncProvider({ manifestPath: './asset-manifest.json' });
const result = await assetSync.syncAssets({ targetDirectory: './public/assets', deleteMissing: true });
// { manifestCount, downloaded, updated, deleted, skipped }
```

Reachable end-to-end via the CLI:

```bash
gst-run-provider --config=provider.config.json --sheet-titles=home --asset-target-dir=public/assets
```

See the [Full Sync Operations guide](/guide/full-sync-operations-v3) for the asset-sync failure/runbook and conflict-policy cookbook.
