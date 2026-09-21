import type {
  CanonicalTableInput,
  TranslationInputProvider,
  TranslationInputRequest,
  TranslationInputResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadClient } from './client';

/** Definition of a single CryptPad sheet source to read as a translation table. */
export interface CryptPadSheetSource {
  /** Target table name (e.g. "i18n", "translations"). */
  tableName: string;
  /** Full CryptPad URL (e.g. https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/). */
  url?: string;
  /** Optional password if the pad is password-protected. */
  password?: string;
  /** Optional unique identifier for this source. */
  tableId?: string;
}

/** Options for configuring the CryptPad Sheet input provider. */
export interface CryptPadSheetInputProviderOptions {
  /** Array of CryptPad sheet sources. */
  sources?: CryptPadSheetSource[];
  /** Convenience single-source URL. */
  url?: string;
  /** Convenience single-source password. */
  password?: string;
  /** Convenience single-source table name (defaults to 'translations'). */
  tableName?: string;
  /** Optional custom provider identifier. Defaults to 'cryptpad-sheet'. */
  providerId?: string;
  /** Optional custom provider display name. */
  displayName?: string;
  /** Optional timeout in milliseconds for WebSocket retrieval. */
  timeoutMs?: number;
}

export const CRYPTPAD_SHEET_INPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  readTables: true,
  publicReadNoAuth: false,
});

/**
 * Creates a read-only {@link TranslationInputProvider} that retrieves translation tables
 * directly from password-protected or public CryptPad spreadsheets (OnlyOffice sheets)
 * using end-to-end encrypted Netflux WebSockets without requiring a browser or bot.
 */
export function createCryptPadSheetInputProvider(
  options: CryptPadSheetInputProviderOptions,
): TranslationInputProvider {
  // Normalize sources: either array of sources or single url/tableName definition
  let sources: CryptPadSheetSource[] = options.sources ? [...options.sources] : [];

  if (sources.length === 0) {
    const singleUrl = options.url ?? process.env.CRYPTPAD_URL;
    if (singleUrl) {
      sources.push({
        tableName: options.tableName ?? 'translations',
        url: singleUrl,
        password: options.password ?? process.env.CRYPTPAD_PASSWORD,
      });
    }
  }

  if (sources.length === 0) {
    throw new Error(
      'CryptPad Sheet provider requires at least one source (either "sources" array or "url" option/CRYPTPAD_URL).',
    );
  }

  return {
    kind: 'input',
    providerId: options.providerId ?? 'cryptpad-sheet',
    displayName: options.displayName ?? 'CryptPad Sheet Input (E2EE)',
    capabilities: CRYPTPAD_SHEET_INPUT_CAPABILITIES,

    async readTables(request: TranslationInputRequest): Promise<TranslationInputResult> {
      const requested = new Set((request.tableNames ?? []).filter(Boolean));
      const selectedSources =
        requested.size === 0
          ? sources
          : sources.filter((source) => requested.has(source.tableName));

      const tables = await Promise.all(
        selectedSources.map(async (source) => {
          const url = source.url ?? options.url ?? process.env.CRYPTPAD_URL;
          if (!url) {
            throw new Error(`CryptPad sheet source "${source.tableName}" does not define a URL.`);
          }

          const password = source.password ?? options.password ?? process.env.CRYPTPAD_PASSWORD;

          const client = new CryptPadClient({
            url,
            password,
            timeoutMs: options.timeoutMs,
          });

          const sheetData = await client.fetchSheetData(request.signal);
          const sourceTables: CanonicalTableInput[] = [];

          // If the document has multiple named tabs
          if (Array.isArray(sheetData.sheetNames) && sheetData.sheetNames.length > 1) {
            for (const tabName of sheetData.sheetNames) {
              if (requested.size === 0 || requested.has(tabName)) {
                sourceTables.push({
                  tableId: `${source.tableId ?? url}#${tabName}`,
                  tableName: tabName,
                  rows: sheetData.sheets[tabName]?.rows ?? [],
                  sourcePath: url,
                  metadata: {
                    provider: 'cryptpad-sheet',
                    channelId: sheetData.metadata.channelId,
                    rtChannelId: sheetData.metadata.rtChannelId,
                    sheetTab: tabName,
                  },
                });
              }
            }
          }

          // Fallback only for genuine single-tab docs; in multi-tab docs, an
          // empty `sourceTables` with requested filters means "no match".
          if (
            sourceTables.length === 0 &&
            (!Array.isArray(sheetData.sheetNames) || sheetData.sheetNames.length <= 1)
          ) {
            sourceTables.push({
              tableId: source.tableId ?? url,
              tableName: source.tableName,
              rows: sheetData.rows,
              sourcePath: url,
              metadata: {
                provider: 'cryptpad-sheet',
                channelId: sheetData.metadata.channelId,
                rtChannelId: sheetData.metadata.rtChannelId,
                cellCount: Object.keys(sheetData.cells).length,
              },
            });
          }

          return sourceTables;
        }),
      );

      return {
        tables: tables.flat(),
        metadata: {
          provider: 'cryptpad-sheet',
          sourceCount: selectedSources.length,
        },
      };
    },
  };
}
