import type {
  TranslationOutputPayload,
  TranslationOutputProvider,
  TranslationOutputResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadClient } from './client';
import type { SheetRow, TranslationData } from '../../types';
import { I18N_SHEET_NAME } from '../../constants';

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
  /** Optional key column name in row 1 (e.g. 'var' or 'key'). Defaults to 'key', matching
   *  the header a brand-new Google Sheets sheet is created with (see spreadsheetUpdater.ts)
   *  and the documented spreadsheet convention (website/guide/spreadsheet-setup.md). Only
   *  used when creating a sheet from scratch — writes to an existing sheet always respect
   *  whichever of 'var'/'key' that sheet's own header already uses. */
  keyColumnName?: 'var' | 'key' | string;
  /** When true (default false — opt-in, not yet live-verified against a real OnlyOffice
   *  session, see `encodeOnlyOfficeFormulaCellRecord`), a brand-new sheet's header row is
   *  written as formula cells linking to the reserved `i18n` sheet's header row
   *  (`=i18n!A1`, ...) instead of duplicated literal text, so header text stays visually
   *  in sync across sheets — see issue #165. Auto-creates the `i18n` sheet's own header
   *  row if it doesn't exist yet. Never rewrites an existing sheet's header on a later
   *  push. */
  linkHeadersToI18nSheet?: boolean;
  /** When true, converts and pushes the reserved `i18n` sheet if present in translations.
   *  Defaults to false for backward compatibility with Google Sheets sync. */
  includeI18nSheet?: boolean;
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
  includeI18nSheet: boolean = false,
): Record<string, SheetRow[]> {
  const sheetRowsMap: Record<string, Map<string, SheetRow>> = {};

  for (const [locale, sheets] of Object.entries(translations)) {
    // `localeMapping` is already normalizedLocale -> originalHeader (see
    // src/utils/localeNormalizer.ts's createLocaleMapping: `localeMapping[normalized] = header`,
    // the same shape rowTransformer.ts's SheetProcessingResult.localeMapping documents and
    // Google's getOriginalHeaderForLocale expects). No reversal needed — a previous version
    // of this function incorrectly reversed it, which silently wrote the normalized locale
    // code (e.g. "en-GB") as the header instead of the real original header (e.g. "en")
    // whenever they differed (issue #165).
    const colHeader = localeMapping[locale] ?? locale;

    for (const [sheetName, keys] of Object.entries(sheets)) {
      // The i18n sheet is a reserved metadata sheet (locale display names).
      // Unless explicitly requested, translation key pushes omit it to match Google Sheets.
      if (!includeI18nSheet && sheetName === I18N_SHEET_NAME) continue;

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
        options.includeI18nSheet ?? false,
      );
      const updatedSheets: string[] = [];
      let totalUpdatedCells = 0;

      // Process i18n sheet first if present so other sheets can link headers or establish base tab
      const sheetEntries = Object.entries(sheetRowsMap).sort(([a], [b]) => {
        if (a === I18N_SHEET_NAME) return -1;
        if (b === I18N_SHEET_NAME) return 1;
        return 0;
      });

      for (const [sheetName, rows] of sheetEntries) {
        const count = await client.writeSheetRows(sheetName, rows, {
          override: options.override ?? false,
          linkHeadersToI18nSheet: options.linkHeadersToI18nSheet ?? false,
        });
        updatedSheets.push(sheetName);
        totalUpdatedCells += count;
        // Brief quiet period to avoid rate-limiting on multi-sheet operations
        await new Promise((r) => setTimeout(r, 1200));
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
