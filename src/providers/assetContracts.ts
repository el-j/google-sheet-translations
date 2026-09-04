import type { ProviderCapabilitySet } from './capabilities';

/**
 * Provider-side contracts for binary/static asset handling, parallel to the
 * table-oriented contracts in {@link ./contracts}. An asset provider deals in
 * files described by a manifest rather than translation rows.
 */
export type AssetProviderKind = 'asset-input' | 'asset-output' | 'asset-sync';

/** One file entry in an asset manifest: where it lives locally/remotely and where it should land. */
export interface CanonicalAssetEntry {
  assetId: string;
  /** Destination path relative to the sync target directory. */
  relativePath: string;
  /** SHA-256 hash, if already known; used to dedupe fetches across entries. */
  hash?: string;
  sourceUrl?: string;
  sourcePath?: string;
  modifiedTime?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface AssetManifestResult {
  assets: CanonicalAssetEntry[];
  metadata?: Record<string, unknown>;
}

export interface AssetSyncRequest {
  targetDirectory: string;
  /** When true, local files under `targetDirectory` not named in the manifest are deleted. */
  deleteMissing?: boolean;
  signal?: AbortSignal;
}

export interface AssetSyncResult {
  manifestCount: number;
  downloaded: string[];
  updated: string[];
  deleted: string[];
  skipped: string[];
  metadata?: Record<string, unknown>;
}

export interface AssetProviderMetadata {
  providerId: string;
  displayName: string;
  capabilities: ProviderCapabilitySet;
}

/** An asset provider that can list a manifest of assets available to read. */
export interface AssetInputProvider extends AssetProviderMetadata {
  kind: 'asset-input';
  readAssetManifest(): Promise<AssetManifestResult>;
}

/** An asset provider that can write a given manifest of assets to a target directory. */
export interface AssetOutputProvider extends AssetProviderMetadata {
  kind: 'asset-output';
  writeAssets(manifest: CanonicalAssetEntry[], targetDirectory: string): Promise<AssetSyncResult>;
}

/**
 * An asset provider that owns both reading its manifest and syncing assets to a
 * target directory in one call. This is the shape used by the CryptPad asset
 * sync provider and by {@link ProviderPipelineOptions.assetSyncProvider}.
 */
export interface AssetSyncProvider extends AssetProviderMetadata {
  kind: 'asset-sync';
  syncAssets(request: AssetSyncRequest): Promise<AssetSyncResult>;
}
