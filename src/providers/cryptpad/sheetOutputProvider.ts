import type {
  TranslationOutputPayload,
  TranslationOutputProvider,
  TranslationOutputResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadClient } from './client';
import type { SheetRow, TranslationData } from '../../types';

export interface CryptPadSheetOutputProviderOptions {
  /** Full CryptPad URL (e.g. https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/). */
  url?: string;
  /** Optional password if the pad is password-protected. */
  password?: string;
  /** When true, overwrites existing non-empty cells. Defaults to false. */
  override?: boolean;
  /** Column header mappings for locale normalization. */
  localeMapping?: Record<string, string>;
  /** Optional custom provider identifier. Defaults to 'cryptpad-sheet'. */
  providerId?: string;
  /** Optional custom provider display name. */
  displayName?: string;
  /** Optional key column name in row 1 (e.g. 'var' or 'key'). Defaults to 'var'. */
  keyColumnName?: 'var' | 'key' | string;
  /** Optional timeout in milliseconds for WebSocket operations. */
  timeoutMs?: number;
}

export const CRYPTPAD_SHEET_OUTPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  writeTables: true,
});

/**
 * Converts nested TranslationData `[locale][sheet][key] = value` into
 * tabular rows `Record<sheetName, SheetRow[]>`.
 */
export function convertTranslationsToSheetRows(
  translations: TranslationData,
  localeMapping: Record<string, string> = {},
  keyColumnName: string = 'key',
): Record<string, SheetRow[]> {
  // Map reverse: normalizedLocale -> originalHeader
  const reverseMapping: Record<string, string> = {};
  for (const [header, norm] of Object.entries(localeMapping)) {
    reverseMapping[norm] = header;
  }

  const sheetRowsMap: Record<string, Map<string, SheetRow>> = {};

  for (const [locale, sheets] of Object.entries(translations)) {
    const colHeader = reverseMapping[locale] ?? locale;

    for (const [sheetName, keys] of Object.entries(sheets)) {
      if (!sheetRowsMap[sheetName]) {
        sheetRowsMap[sheetName] = new Map();
      }

      for (const [key, value] of Object.entries(keys)) {
        if (!sheetRowsMap[sheetName].has(key)) {
          sheetRowsMap[sheetName].set(key, { [keyColumnName]: key });
        }
        sheetRowsMap[sheetName].get(key)![colHeader] = String(value);
      }
    }
  }

  const result: Record<string, SheetRow[]> = {};
  for (const [sheetName, keyMap] of Object.entries(sheetRowsMap)) {
    result[sheetName] = Array.from(keyMap.values());
  }

  return result;
}

/**
 * Creates a {@link TranslationOutputProvider} that writes translation data directly
 * into password-protected or public CryptPad spreadsheets (multi-tab OnlyOffice workbooks)
 * using end-to-end encrypted Netflux WebSockets.
 */
export function createCryptPadSheetOutputProvider(
  options: CryptPadSheetOutputProviderOptions = {},
): TranslationOutputProvider {
  const url = options.url ?? process.env.CRYPTPAD_URL;
  if (!url) {
    throw new Error(
      'CryptPad Sheet output provider requires a "url" option or CRYPTPAD_URL environment variable.',
    );
  }

  const password = options.password ?? process.env.CRYPTPAD_PASSWORD;

  return {
    kind: 'output',
    providerId: options.providerId ?? 'cryptpad-sheet',
    displayName: options.displayName ?? 'CryptPad Sheet Output (E2EE)',
    capabilities: CRYPTPAD_SHEET_OUTPUT_CAPABILITIES,

    async writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult> {
      const client = new CryptPadClient({
        url,
        password,
        timeoutMs: options.timeoutMs,
      });

      const effectiveMapping = options.localeMapping ?? payload.localeMapping ?? {};
      const sheetRowsMap = convertTranslationsToSheetRows(
        payload.translations,
        effectiveMapping,
        options.keyColumnName ?? 'key',
      );
      const updatedSheets: string[] = [];
      let totalUpdatedCells = 0;

      for (const [sheetName, rows] of Object.entries(sheetRowsMap)) {
        const count = await client.writeSheetRows(sheetName, rows, {
          override: options.override ?? false,
        });
        updatedSheets.push(sheetName);
        totalUpdatedCells += count;
      }

      return {
        wroteFiles: [url],
        metadata: {
          provider: 'cryptpad-sheet',
          url,
          updatedSheets,
          totalUpdatedCells,
        },
      };
    },
  };
}
