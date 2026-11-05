# Provider Platform (v3)

Core APIs for the v3 provider runtime: capability model, config validation, provider resolution, pipeline orchestration, source discovery, and the three-way sync engine.

```typescript
import {
  createCapabilitySet,
  assertOperationCapabilities,
  validateProviderRuntimeConfig,
  assertValidProviderRuntimeConfig,
  mapLegacyGoogleOptionsToProviderConfig,
  createProvidersFromRuntimeConfig,
  requiresGoogleAuthForRuntimeConfig,
  runProviderPipeline,
  createDefaultProviderCatalog,
  buildSyncPlan,
  resolveSyncPlan,
} from '@el-j/google-sheet-translations';
```

For a narrative walkthrough of the runtime, see the [Provider Runtime guide](/guide/provider-runtime). For the concrete Google/CryptPad provider factories, see [Google Sheets Provider](/api/google-provider) and [CryptPad Providers](/api/cryptpad-provider).

---

## Capability model

Every provider declares a fixed set of boolean capability flags, and every pipeline operation is gated behind the capabilities it needs — so an unsupported combination (e.g. syncing back to a read-only provider) fails immediately with a clear error instead of doing partial work.

```typescript
type ProviderCapability =
  | 'readTables' | 'writeTables' | 'syncBack'
  | 'readAssets' | 'writeAssets' | 'assetSync'
  | 'autoTranslateFormula' | 'discoverByFolder' | 'publicReadNoAuth';

type ProviderCapabilitySet = Record<ProviderCapability, boolean>;

type ProviderOperation =
  | 'read-input' | 'write-output' | 'sync-back'
  | 'read-assets' | 'write-assets' | 'sync-assets'
  | 'discover-sources' | 'public-read';
```

### `createCapabilitySet(overrides?)`

Builds a full capability set, defaulting every unspecified flag to `false`.

```typescript
const capabilities = createCapabilitySet({ readTables: true, publicReadNoAuth: true });
```

### `assertOperationCapabilities(providerName, capabilities, operation)`

Throws if `capabilities` is missing any capability required by `operation` (see `OPERATION_CAPABILITY_REQUIREMENTS`, also exported). This is what `runProviderPipeline` calls internally before each stage.

```typescript
assertOperationCapabilities('cryptpad-assets', provider.capabilities, 'sync-assets');
// throws: Provider "cryptpad-assets" is missing required capabilities for operation "sync-assets": assetSync
```

---

## Runtime config

### `ProviderRuntimeConfig`

Declarative shape consumed by `createProvidersFromRuntimeConfig`. Only `input` is required.

```typescript
interface ProviderReferenceConfig {
  provider: string;
  options?: Record<string, unknown>;
}

interface ProviderRuntimeConfig {
  input: ProviderReferenceConfig;
  output?: ProviderReferenceConfig;
  sync?: ProviderReferenceConfig;
  assetSync?: ProviderReferenceConfig;
}
```

| Slot | Supported `provider` values |
|------|------------------------------|
| `input` | `google-sheets`, `cryptpad-csv` |
| `output` | `google-sheets`, `cryptpad-workspace` |
| `sync` | `google-sheets`, `cryptpad-workspace` |
| `assetSync` | `cryptpad-assets` |

### `validateProviderRuntimeConfig(config)`

Validates an untrusted value (typically parsed from JSON) and returns every error found, rather than stopping at the first one.

```typescript
function validateProviderRuntimeConfig(config: unknown): {
  valid: boolean;
  errors: string[];
}
```

```typescript
const result = validateProviderRuntimeConfig({ input: {} });
// { valid: false, errors: ['Input provider must define a non-empty "provider" string.'] }
```

### `assertValidProviderRuntimeConfig(config)`

Validates and returns `config` typed as `ProviderRuntimeConfig`, or throws with all errors joined into one message. Used at CLI/Action boundaries.

```typescript
function assertValidProviderRuntimeConfig(config: unknown): ProviderRuntimeConfig
```

### `mapLegacyGoogleOptionsToProviderConfig(options?)`

Maps legacy `SpreadsheetOptions` (as used by `getSpreadSheetData`) to the equivalent `ProviderRuntimeConfig`, for incremental migration.

```typescript
function mapLegacyGoogleOptionsToProviderConfig(
  options?: SpreadsheetOptions,
): { config: ProviderRuntimeConfig; deprecations: string[] }
```

```typescript
const { config, deprecations } = mapLegacyGoogleOptionsToProviderConfig({
  spreadsheetId: 'abc123',
  syncLocalChanges: true,
  autoTranslate: true,
});
```

---

## Resolving providers

### `createProvidersFromRuntimeConfig(config)`

Resolves each configured slot to a concrete provider instance via its factory.

```typescript
function createProvidersFromRuntimeConfig(config: ProviderRuntimeConfig): {
  inputProvider: TranslationInputProvider;
  outputProvider?: TranslationOutputProvider;
  syncProvider?: TranslationSyncProvider;
  assetSyncProvider?: AssetSyncProvider;
}
```

Throws if a slot names a provider ID with no matching factory (`Unsupported input/output/sync/asset sync provider: "..."`), or if a provider's required options are missing (e.g. `cryptpad-workspace` without `filePath`, or `cryptpad-assets` without `manifestPath`).

### `requiresGoogleAuthForRuntimeConfig(config)`

Returns `true` if the config needs authenticated Google credentials — i.e. Google Sheets is used for `output`/`sync`, or for `input` without `publicSheet: true`. Use this to skip Google auth bootstrapping entirely for CryptPad-only pipelines.

```typescript
function requiresGoogleAuthForRuntimeConfig(config: ProviderRuntimeConfig): boolean
```

---

## Running the pipeline

### `runProviderPipeline(options, depsOverrides?)`

Runs the full pipeline: read tables → transform → optional write → optional sync-back → optional asset sync. Each optional stage only runs if both its provider *and* its request payload are supplied, and is gated by a capability check first.

```typescript
interface ProviderPipelineOptions {
  inputProvider: TranslationInputProvider;
  outputProvider?: TranslationOutputProvider;
  syncProvider?: TranslationSyncProvider;
  assetSyncProvider?: AssetSyncProvider;
  assetSync?: { targetDirectory: string; deleteMissing?: boolean };
  tableNames?: string[];
  localTranslationsForSync?: TranslationData;
  signal?: AbortSignal;
}

interface ProviderPipelineResult {
  translations: TranslationData;
  locales: string[];
  localeMapping: Record<string, string>;
  originalLocaleMapping: Record<string, string>;
  inputTableCount: number;
  outputResult?: { wroteFiles: string[]; metadata?: Record<string, unknown> };
  syncResult?: { changedKeys: number; skippedKeys: number; metadata?: Record<string, unknown> };
  assetSyncResult?: AssetSyncResult;
  metadata?: Record<string, unknown>;
}
```

```typescript
const providers = createProvidersFromRuntimeConfig(config);

const result = await runProviderPipeline({
  inputProvider: providers.inputProvider,
  outputProvider: providers.outputProvider,
  syncProvider: providers.syncProvider,
  assetSyncProvider: providers.assetSyncProvider,
  assetSync: { targetDirectory: './public/assets' },
  tableNames: ['home', 'about'],
});

console.log(result.locales, result.assetSyncResult);
```

---

## Source discovery (catalog)

### `createDefaultProviderCatalog()`

Returns a `ProviderCatalogProvider` listing every built-in provider source (Google Drive folder discovery, CryptPad CSV export URL, CryptPad asset manifest) as descriptive metadata. Discovering a source here does not read it — pair it with the matching provider factory for that.

```typescript
const catalog = createDefaultProviderCatalog();
const { sources } = await catalog.discoverSources({ query: 'cryptpad' });
```

### `createInMemoryProviderCatalogProvider(options)`

Builds a catalog over a custom, static list of `ProviderSourceDescriptor` entries. `discoverSources({ query })` filters by case-insensitive substring match against each source's id, name, and kind.

---

## Sync engine (three-way diff)

Used internally by sync-capable providers (e.g. `cryptpad-workspace`) to reconcile local edits against a remote snapshot.

### `buildSyncPlan(input)`

Diffs `localTranslations` and `remoteTranslations`, each against `baseTranslations`, and returns local changes, remote changes, and any keys that changed on both sides to a genuinely different value (conflicts).

```typescript
function buildSyncPlan(input: {
  baseTranslations: TranslationData;
  localTranslations: TranslationData;
  remoteTranslations: TranslationData;
}): {
  localChanges: SyncEntryChange[];
  remoteChanges: SyncEntryChange[];
  conflicts: SyncConflict[];
}
```

### `resolveSyncPlan(input, policy)`

Runs `buildSyncPlan` and merges the result into a copy of `remoteTranslations`.

| `policy` | Behavior |
|----------|----------|
| `remote-wins` | Non-conflicting local changes apply; conflicting keys keep the remote value. |
| `local-wins` | Every local change applies, including over conflicts. |
| `manual` | Non-conflicting local changes apply; conflicts are left as-is, counted in `skippedConflicts` for human review. |

```typescript
function resolveSyncPlan(
  input: BuildSyncPlanInput,
  policy: 'remote-wins' | 'local-wins' | 'manual',
): {
  policy: SyncConflictPolicy;
  mergedTranslations: TranslationData;
  appliedLocalChanges: number;
  appliedRemoteChanges: number;
  skippedConflicts: number;
}
```
