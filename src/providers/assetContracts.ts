import type { ProviderCapabilitySet } from './capabilities';

export type AssetProviderKind = 'asset-input' | 'asset-output' | 'asset-sync';

export interface CanonicalAssetEntry {
  assetId: string;
  relativePath: string;
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

export interface AssetInputProvider extends AssetProviderMetadata {
  kind: 'asset-input';
  readAssetManifest(): Promise<AssetManifestResult>;
}

export interface AssetOutputProvider extends AssetProviderMetadata {
  kind: 'asset-output';
  writeAssets(manifest: CanonicalAssetEntry[], targetDirectory: string): Promise<AssetSyncResult>;
}

export interface AssetSyncProvider extends AssetProviderMetadata {
  kind: 'asset-sync';
  syncAssets(request: AssetSyncRequest): Promise<AssetSyncResult>;
}
