import { createCapabilitySet } from './capabilities';
import type { ProviderCapabilitySet } from './capabilities';

/**
 * Classification of a discoverable resource within a provider catalog.
 */
export type ProviderSourceKind = 'table' | 'asset';

/**
 * Metadata descriptor describing a discoverable data source (sheet, table, or asset manifest).
 */
export interface ProviderSourceDescriptor {
  /** Identifier of the provider that can read this source. */
  providerId: string;
  /** Unique identifier of the specific resource / document. */
  sourceId: string;
  /** Kind of resource represented by this descriptor. */
  kind: ProviderSourceKind;
  /** Human-readable display title or filename. */
  name: string;
  /** Additional provider-specific metadata (e.g. URLs, mime types). */
  metadata?: Record<string, unknown>;
}

/**
 * Filter and cancellation options for catalog source discovery.
 */
export interface ProviderDiscoveryRequest {
  /** Optional search query or filter string. */
  query?: string;
  /** Optional cancellation signal. */
  signal?: AbortSignal;
}

/**
 * Result returned by a catalog source discovery operation.
 */
export interface ProviderDiscoveryResult {
  /** Discovered source descriptors matching the request. */
  sources: ProviderSourceDescriptor[];
  /** Optional diagnostic or pagination metadata. */
  metadata?: Record<string, unknown>;
}

/** A discovery-only provider: it lists available sources, but doesn't read/write/sync them itself. */
export interface ProviderCatalogProvider {
  kind: 'catalog';
  providerId: string;
  displayName: string;
  capabilities: ProviderCapabilitySet;
  discoverSources(request?: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResult>;
}

/**
 * Options for configuring an in-memory {@link ProviderCatalogProvider}.
 */
export interface InMemoryProviderCatalogOptions {
  /** Custom provider identifier. Defaults to 'in-memory-catalog'. */
  providerId?: string;
  /** Custom human-friendly provider name. */
  displayName?: string;
  /** Fixed list of sources returned during discovery. */
  sources: ProviderSourceDescriptor[];
}

/**
 * Creates a {@link ProviderCatalogProvider} backed by a static, in-memory list of
 * sources. `discoverSources({ query })` filters that list by substring match against
 * each source's id, name, and kind (case-insensitive); an empty/absent query returns
 * every source.
 */
export function createInMemoryProviderCatalogProvider(
  options: InMemoryProviderCatalogOptions,
): ProviderCatalogProvider {
  return {
    kind: 'catalog',
    providerId: options.providerId ?? 'provider-catalog',
    displayName: options.displayName ?? 'Provider Catalog',
    capabilities: createCapabilitySet({ discoverByFolder: true }),
    async discoverSources(request?: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResult> {
      const query = request?.query?.trim().toLowerCase();
      const sources = query
        ? options.sources.filter((source) => {
            const text = `${source.sourceId} ${source.name} ${source.kind}`.toLowerCase();
            return text.includes(query);
          })
        : options.sources;

      return {
        sources,
        metadata: {
          query: request?.query,
          count: sources.length,
        },
      };
    },
  };
}

/**
 * The built-in catalog listing every provider source shipped with this package
 * (Google Drive folder discovery, CryptPad CSV export URL, CryptPad asset manifest).
 * Each entry is descriptive metadata only — actually reading from a discovered
 * source still goes through the matching input/output/sync/asset-sync provider
 * factory (see {@link createProvidersFromRuntimeConfig}).
 */
export function createDefaultProviderCatalog(): ProviderCatalogProvider {
  return createInMemoryProviderCatalogProvider({
    providerId: 'default-provider-catalog',
    displayName: 'Default Provider Catalog',
    sources: [
      {
        providerId: 'google-sheets',
        sourceId: 'google-drive-folder',
        kind: 'table',
        name: 'Google Drive Folder Discovery',
        metadata: { authRequired: true },
      },
      {
        providerId: 'cryptpad-csv',
        sourceId: 'cryptpad-csv-url',
        kind: 'table',
        name: 'CryptPad CSV Export URL',
        metadata: { authRequired: false },
      },
      {
        providerId: 'cryptpad-assets',
        sourceId: 'cryptpad-asset-manifest',
        kind: 'asset',
        name: 'CryptPad Asset Manifest',
        metadata: { authRequired: true },
      },
    ],
  });
}
