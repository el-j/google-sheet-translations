# Provider Contracts (v3)

TypeScript contracts and interfaces for implementing custom translation providers, asset sync providers, and provider registries in `@el-j/google-sheet-translations`.

```typescript
import type {
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
  AnyTranslationProvider,
  ProviderRegistry,
  SegmentedProviderRegistry,
  CanonicalTableInput,
  TranslationInputRequest,
  TranslationInputResult,
  TranslationOutputPayload,
  TranslationOutputResult,
  TranslationSyncPayload,
  TranslationSyncResult,
  AssetSyncProvider,
  AssetInputProvider,
  AssetOutputProvider,
  CanonicalAssetEntry,
  AssetManifestResult,
  AssetSyncRequest,
  AssetSyncResult,
  ProviderSourceDescriptor,
  ProviderCatalogProvider,
} from '@el-j/google-sheet-translations';
```

---

## Translation Provider Contracts

Translation providers handle tabular data (keys and localized values) across different storage systems.

### `TranslationInputProvider`

Reads tables from a remote or local data source (e.g. Google Sheets, CryptPad CSV, SQL database).

```typescript
interface TranslationInputProvider extends ProviderMetadata {
  kind: 'input';
  readTables(request: TranslationInputRequest): Promise<TranslationInputResult>;
}

interface TranslationInputRequest {
  /** Table names to fetch. If omitted, all available tables are retrieved. */
  tableNames?: string[];
  /** Optional cancellation signal. */
  signal?: AbortSignal;
}

interface TranslationInputResult {
  tables: CanonicalTableInput[];
  metadata?: Record<string, unknown>;
}
```

### `CanonicalTableInput`

The normalized table structure returned by all input providers.

```typescript
interface CanonicalTableInput {
  /** Unique table identifier. */
  tableId: string;
  /** Human-readable sheet tab or table title. */
  tableName: string;
  /** Array of row objects with column headers as keys. */
  rows: SheetRow[];
  /** Optional source location path or URL. */
  sourcePath?: string;
  /** ISO-8601 modified timestamp. */
  modifiedTime?: string;
  metadata?: Record<string, unknown>;
}
```

### `TranslationOutputProvider`

Writes processed, canonical translations to an external system or workspace.

```typescript
interface TranslationOutputProvider extends ProviderMetadata {
  kind: 'output';
  writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult>;
}

interface TranslationOutputPayload {
  translations: TranslationData;
  locales: string[];
  localeMapping?: Record<string, string>;
  originalLocaleMapping?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

interface TranslationOutputResult {
  wroteFiles: string[];
  metadata?: Record<string, unknown>;
}
```

### `TranslationSyncProvider`

Reconciles local translation edits back to a remote source, performing two-way or three-way merge.

```typescript
interface TranslationSyncProvider extends ProviderMetadata {
  kind: 'sync';
  syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult>;
}

interface TranslationSyncPayload {
  localTranslations: TranslationData;
  remoteTranslations: TranslationData;
  metadata?: Record<string, unknown>;
}

interface TranslationSyncResult {
  changedKeys: number;
  skippedKeys: number;
  metadata?: Record<string, unknown>;
}
```

### `AnyTranslationProvider`

Union of all standard translation providers:

```typescript
type AnyTranslationProvider =
  | TranslationInputProvider
  | TranslationOutputProvider
  | TranslationSyncProvider;
```

---

## Asset Provider Contracts

Asset providers manage non-tabular media files (e.g. images, icons, illustrations) associated with translations.

### `AssetSyncProvider`

Fetches and synchronizes assets from a manifest to a local directory in one step.

```typescript
interface AssetSyncProvider extends AssetProviderMetadata {
  kind: 'asset-sync';
  syncAssets(request: AssetSyncRequest): Promise<AssetSyncResult>;
}

interface AssetSyncRequest {
  targetDirectory: string;
  /** When true, local files not in the manifest are removed. */
  deleteMissing?: boolean;
  signal?: AbortSignal;
}

interface AssetSyncResult {
  manifestCount: number;
  downloaded: string[];
  updated: string[];
  deleted: string[];
  skipped: string[];
  metadata?: Record<string, unknown>;
}
```

### `CanonicalAssetEntry`

Represents a single asset described in an asset manifest.

```typescript
interface CanonicalAssetEntry {
  assetId: string;
  /** Path relative to the target directory. */
  relativePath: string;
  /** SHA-256 content hash for deduplication. */
  hash?: string;
  sourceUrl?: string;
  sourcePath?: string;
  modifiedTime?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}
```

### `AssetInputProvider` & `AssetOutputProvider`

Modular interfaces for separate manifest reading and writing stages:

```typescript
interface AssetInputProvider extends AssetProviderMetadata {
  kind: 'asset-input';
  readAssetManifest(): Promise<AssetManifestResult>;
}

interface AssetOutputProvider extends AssetProviderMetadata {
  kind: 'asset-output';
  writeAssets(manifest: CanonicalAssetEntry[], targetDirectory: string): Promise<AssetSyncResult>;
}
```

---

## Catalog & Discovery Contracts

Used to discover available spreadsheets and asset manifests.

### `ProviderCatalogProvider`

```typescript
interface ProviderCatalogProvider {
  kind: 'catalog';
  providerId: string;
  displayName: string;
  capabilities: ProviderCapabilitySet;
  discoverSources(request?: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResult>;
}

interface ProviderSourceDescriptor {
  providerId: string;
  sourceId: string;
  kind: 'table' | 'asset';
  name: string;
  metadata?: Record<string, unknown>;
}
```

---

## Registry Contracts

Container contracts for managing collections of provider implementations.

```typescript
interface ProviderRegistry {
  register(provider: AnyTranslationProvider): void;
  get(providerId: string): AnyTranslationProvider | undefined;
  list(): AnyTranslationProvider[];
}

interface SegmentedProviderRegistry {
  registerInput(provider: TranslationInputProvider): void;
  registerOutput(provider: TranslationOutputProvider): void;
  registerSync(provider: TranslationSyncProvider): void;
  getInput(providerId: string): TranslationInputProvider | undefined;
  getOutput(providerId: string): TranslationOutputProvider | undefined;
  getSync(providerId: string): TranslationSyncProvider | undefined;
}
```
