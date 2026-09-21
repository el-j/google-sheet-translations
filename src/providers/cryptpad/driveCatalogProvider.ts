import type {
  ProviderCatalogProvider,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResult,
  ProviderSourceDescriptor,
} from '../catalog';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadDriveClient, type CryptPadDriveItem } from './driveClient';

export interface CryptPadDriveCatalogOptions {
  /** Full CryptPad Drive URL (e.g. https://cryptpad.fr/drive/#/2/drive/edit/seed/p/). */
  driveUrl?: string;
  /** Optional master password for the drive pad. */
  password?: string;
  /** Optional map of passwords keyed by pad URL or title. */
  passwords?: Record<string, string>;
  /** Optional custom provider identifier. Defaults to 'cryptpad-drive'. */
  providerId?: string;
  /** Optional custom provider display name. */
  displayName?: string;
  /** Optional timeout in milliseconds for WebSocket retrieval. */
  timeoutMs?: number;
}

export const CRYPTPAD_DRIVE_CATALOG_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  discoverByFolder: true,
});

/**
 * Creates a {@link ProviderCatalogProvider} that inspects an encrypted CryptPad Drive folder,
 * discovering all spreadsheets, document pads, and file assets within the directory tree.
 */
export function createCryptPadDriveCatalogProvider(
  options: CryptPadDriveCatalogOptions = {},
): ProviderCatalogProvider {
  const driveUrl = options.driveUrl ?? process.env.CRYPTPAD_DRIVE_URL;
  if (!driveUrl) {
    throw new Error(
      'CryptPad Drive catalog provider requires a "driveUrl" option or CRYPTPAD_DRIVE_URL environment variable.',
    );
  }

  const client = new CryptPadDriveClient({
    url: driveUrl,
    password: options.password,
    passwords: options.passwords,
    timeoutMs: options.timeoutMs,
  });

  return {
    kind: 'catalog',
    providerId: options.providerId ?? 'cryptpad-drive',
    displayName: options.displayName ?? 'CryptPad Drive Folder Discovery',
    capabilities: CRYPTPAD_DRIVE_CATALOG_CAPABILITIES,

    async discoverSources(request?: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResult> {
      const items = await client.listDriveItems(request?.signal);
      const query = request?.query?.toLowerCase().trim();

      const filteredItems = query
        ? items.filter(
            (item) =>
              item.title.toLowerCase().includes(query) ||
              item.path.toLowerCase().includes(query) ||
              item.type.toLowerCase().includes(query),
          )
        : items;

      const sources: ProviderSourceDescriptor[] = filteredItems.map((item: CryptPadDriveItem) => {
        const isSheet = item.type === 'sheet' || item.url.includes('/sheet/');
        const kind = isSheet ? 'table' : 'asset';
        const providerId = isSheet ? 'cryptpad-sheet' : 'cryptpad-assets';

        return {
          providerId,
          sourceId: item.id || item.url,
          kind,
          name: item.title,
          metadata: {
            url: item.url,
            password: item.password,
            type: item.type,
            channel: item.channel,
            path: item.path,
          },
        };
      });

      return {
        sources,
        metadata: {
          driveUrl,
          totalDiscovered: sources.length,
        },
      };
    },
  };
}
