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

/**
 * Result returned when retrieving an asset manifest.
 */
export interface AssetManifestResult {
  /** List of asset entries contained in the manifest. */
  assets: CanonicalAssetEntry[];
  /** Optional manifest-level metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for performing an asset synchronization operation.
 */
export interface AssetSyncRequest {
  /** Local target directory where assets will be synchronized. */
  targetDirectory: string;
  /** When true, local files under `targetDirectory` not named in the manifest are deleted. */
  deleteMissing?: boolean;
  /** Optional abort signal for early cancellation. */
  signal?: AbortSignal;
}

/**
 * Statistics and affected paths resulting from an asset sync execution.
 */
export interface AssetSyncResult {
  /** Total number of assets listed in the input manifest. */
  manifestCount: number;
  /** Relative paths of assets downloaded fresh. */
  downloaded: string[];
  /** Relative paths of assets modified / updated. */
  updated: string[];
  /** Relative paths of orphaned local assets deleted (when deleteMissing was true). */
  deleted: string[];
  /** Relative paths of unchanged assets skipped due to matching hash or size. */
  skipped: string[];
  /** Optional provider-specific execution metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Common metadata attributes shared across all asset provider interfaces.
 */
export interface AssetProviderMetadata {
  /** Unique provider identifier (e.g. 'cryptpad-assets'). */
  providerId: string;
  /** Human-readable provider name. */
  displayName: string;
  /** Capability set declaring which asset operations are supported. */
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
