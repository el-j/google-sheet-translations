import type { GoogleAuth } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import type {
  TranslationInputProvider,
  TranslationInputRequest,
  TranslationInputResult,
  TranslationOutputPayload,
  TranslationOutputProvider,
  TranslationOutputResult,
  TranslationSyncPayload,
  TranslationSyncProvider,
  TranslationSyncResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { createAuthClient } from '../../utils/auth';
import { readPublicSheet } from '../../utils/publicSheetReader';
import { withRetry } from '../../utils/rateLimiter';
import { updateSpreadsheetWithLocalChanges } from '../../utils/spreadsheetUpdater';
import { findLocalChanges } from '../../utils/dataConverter/findLocalChanges';
import type { SheetRow, TranslationData } from '../../types';
import { DEFAULT_WAIT_SECONDS } from '../../constants';

/**
 * Options for creating a Google Sheets input provider.
 */
export interface GoogleSheetsInputProviderOptions {
  /** Target spreadsheet ID. If omitted, falls back to GOOGLE_SPREADSHEET_ID env var. */
  spreadsheetId?: string;
  /** Maximum number of rows to retrieve per sheet tab. Defaults to 100. */
  rowLimit?: number;
  /** Throttling delay in seconds between API requests. */
  waitSeconds?: number;
  /** When true, fetches public spreadsheet without requiring authentication. */
  publicSheet?: boolean;
  /** Custom provider identifier. Defaults to 'google-sheets'. */
  providerId?: string;
  /** Custom provider display name. */
  displayName?: string;
}

/**
 * Options for creating a Google Sheets output provider.
 */
export interface GoogleSheetsOutputProviderOptions {
  /** Target spreadsheet ID. If omitted, falls back to GOOGLE_SPREADSHEET_ID env var. */
  spreadsheetId?: string;
  /** Throttling delay in seconds between API requests. */
  waitSeconds?: number;
  /** When true, automatically inserts GOOGLETRANSLATE formulas for missing translations. */
  autoTranslate?: boolean;
  /** When true with autoTranslate, overwrites existing manual translations with formulas. */
  override?: boolean;
  /** Column header mappings for locale normalization. */
  localeMapping?: Record<string, string>;
  /** Custom provider identifier. Defaults to 'google-sheets'. */
  providerId?: string;
  /** Custom provider display name. */
  displayName?: string;
}

/**
 * Options for creating a Google Sheets sync provider.
 */
export interface GoogleSheetsSyncProviderOptions {
  /** Target spreadsheet ID. If omitted, falls back to GOOGLE_SPREADSHEET_ID env var. */
  spreadsheetId?: string;
  /** Throttling delay in seconds between API requests. */
  waitSeconds?: number;
  /** When true, automatically inserts GOOGLETRANSLATE formulas for missing translations. */
  autoTranslate?: boolean;
  /** When true with autoTranslate, overwrites existing manual translations with formulas. */
  override?: boolean;
  /** Column header mappings for locale normalization. */
  localeMapping?: Record<string, string>;
  /** Custom provider identifier. Defaults to 'google-sheets'. */
  providerId?: string;
  /** Custom provider display name. */
  displayName?: string;
}

interface GoogleSheetsProviderDeps {
  createAuthClient: () => GoogleAuth;
  createSpreadsheetClient: (spreadsheetId: string, authClient: GoogleAuth) => GoogleSpreadsheet;
  readPublicSheet: (spreadsheetId: string, sheetName: string) => Promise<SheetRow[]>;
  withRetry: typeof withRetry;
  updateSpreadsheetWithLocalChanges: typeof updateSpreadsheetWithLocalChanges;
  findLocalChanges: typeof findLocalChanges;
  logger: Pick<Console, 'warn' | 'log'>;
}

const INPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  readTables: true,
  publicReadNoAuth: true,
  discoverByFolder: true,
});

const OUTPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  writeTables: true,
  autoTranslateFormula: true,
});

const SYNC_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  syncBack: true,
  writeTables: true,
  autoTranslateFormula: true,
});

function createDefaultDeps(): GoogleSheetsProviderDeps {
  return {
    createAuthClient,
    createSpreadsheetClient: (spreadsheetId, authClient) =>
      new GoogleSpreadsheet(spreadsheetId, authClient),
    readPublicSheet,
    withRetry,
    updateSpreadsheetWithLocalChanges,
    findLocalChanges,
    logger: console,
  };
}

function resolveSpreadsheetId(spreadsheetId?: string): string {
  const resolved = spreadsheetId ?? process.env.GOOGLE_SPREADSHEET_ID;
  if (!resolved) {
    throw new Error(
      'No spreadsheet ID provided. Set GOOGLE_SPREADSHEET_ID or pass spreadsheetId in provider options.',
    );
  }
  return resolved;
}

function getWaitSeconds(waitSeconds?: number): number {
  return waitSeconds ?? DEFAULT_WAIT_SECONDS;
}

function countTranslationLeafKeys(data: TranslationData): number {
  return Object.values(data)
    .flatMap((localeData) => Object.values(localeData))
    .reduce((total, sheetData) => total + Object.keys(sheetData).length, 0);
}

function hasAnyChanges(data: TranslationData): boolean {
  return Object.keys(data).length > 0 && Object.values(data).some((l) => Object.keys(l).length > 0);
}

/**
 * Creates a {@link TranslationInputProvider} backed by Google Sheets. When
 * `options.publicSheet` is true, reads via the no-auth public CSV export path
 * (`publicReadNoAuth` capability); otherwise authenticates via
 * {@link createAuthClient} and reads through the Google Sheets API, skipping
 * (and warning about) any requested table name that has no matching sheet.
 */
export function createGoogleSheetsInputProvider(
  options: GoogleSheetsInputProviderOptions = {},
  depsOverrides: Partial<GoogleSheetsProviderDeps> = {},
): TranslationInputProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'input',
    providerId: options.providerId ?? 'google-sheets',
    displayName: options.displayName ?? 'Google Sheets Input',
    capabilities: INPUT_CAPABILITIES,
    async readTables(request: TranslationInputRequest): Promise<TranslationInputResult> {
      const tableNames = (request.tableNames ?? []).filter(Boolean);
      if (tableNames.length === 0) {
        return { tables: [] };
      }

      const spreadsheetId = resolveSpreadsheetId(options.spreadsheetId);
      const baseDelayMs = getWaitSeconds(options.waitSeconds) * 1000;

      if (options.publicSheet) {
        const tables = await Promise.all(
          tableNames.map(async (tableName) => {
            const rows = await deps.withRetry(
              () => deps.readPublicSheet(spreadsheetId, tableName),
              `readPublicSheet: ${tableName}`,
              baseDelayMs,
            );

            return {
              tableId: `${spreadsheetId}:${tableName}`,
              tableName,
              rows,
              metadata: { sourceMode: 'public' },
            };
          }),
        );

        return {
          tables,
          metadata: { spreadsheetId, sourceMode: 'public' },
        };
      }

      const authClient = deps.createAuthClient();
      const doc = deps.createSpreadsheetClient(spreadsheetId, authClient);

      await deps.withRetry(() => doc.loadInfo(true), 'loadInfo', baseDelayMs);

      const tables: TranslationInputResult['tables'] = [];

      for (const tableName of tableNames) {
        const sheet = doc.sheetsByTitle[tableName];
        if (!sheet) {
          deps.logger.warn(`Sheet "${tableName}" not found in the document`);
          continue;
        }

        const googleRows = await deps.withRetry(
          () => sheet.getRows({ limit: options.rowLimit ?? 100 }),
          `getRows: ${tableName}`,
          baseDelayMs,
        );

        tables.push({
          tableId: `${spreadsheetId}:${tableName}`,
          tableName,
          rows: googleRows.map((row) => row.toObject() as SheetRow),
          metadata: { sourceMode: 'authenticated' },
        });
      }

      return {
        tables,
        metadata: { spreadsheetId, sourceMode: 'authenticated' },
      };
    },
  };
}

/**
 * Creates a {@link TranslationOutputProvider} that authenticates and writes the full
 * translation set to a Google Sheets spreadsheet via {@link updateSpreadsheetWithLocalChanges},
 * optionally auto-translating missing cells with a formula (`autoTranslate`) and
 * optionally overwriting existing non-empty cells (`override`).
 */
export function createGoogleSheetsOutputProvider(
  options: GoogleSheetsOutputProviderOptions = {},
  depsOverrides: Partial<GoogleSheetsProviderDeps> = {},
): TranslationOutputProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'output',
    providerId: options.providerId ?? 'google-sheets',
    displayName: options.displayName ?? 'Google Sheets Output',
    capabilities: OUTPUT_CAPABILITIES,
    async writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult> {
      const spreadsheetId = resolveSpreadsheetId(options.spreadsheetId);
      const authClient = deps.createAuthClient();
      const doc = deps.createSpreadsheetClient(spreadsheetId, authClient);

      await deps.withRetry(
        () => doc.loadInfo(true),
        'loadInfo',
        getWaitSeconds(options.waitSeconds) * 1000,
      );

      await deps.updateSpreadsheetWithLocalChanges(
        doc,
        payload.translations,
        getWaitSeconds(options.waitSeconds),
        options.autoTranslate ?? false,
        options.localeMapping ?? payload.localeMapping ?? {},
        options.override ?? false,
      );

      const updatedSheets = new Set(
        Object.values(payload.translations).flatMap((localeData) => Object.keys(localeData)),
      );

      return {
        wroteFiles: [],
        metadata: {
          spreadsheetId,
          updatedSheets: Array.from(updatedSheets),
          estimatedUpdatedKeys: countTranslationLeafKeys(payload.translations),
        },
      };
    },
  };
}

/**
 * Creates a {@link TranslationSyncProvider} that computes local-only changes via
 * {@link findLocalChanges} (comparing `localTranslations` against `remoteTranslations`)
 * and, if any exist, writes just those changed keys back to the spreadsheet. Returns
 * early with `changedKeys: 0` when there is no local diff, avoiding an unnecessary
 * authenticated round-trip.
 */
export function createGoogleSheetsSyncProvider(
  options: GoogleSheetsSyncProviderOptions = {},
  depsOverrides: Partial<GoogleSheetsProviderDeps> = {},
): TranslationSyncProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'sync',
    providerId: options.providerId ?? 'google-sheets',
    displayName: options.displayName ?? 'Google Sheets Sync',
    capabilities: SYNC_CAPABILITIES,
    async syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult> {
      const changes = deps.findLocalChanges(payload.localTranslations, payload.remoteTranslations);

      if (!hasAnyChanges(changes)) {
        return {
          changedKeys: 0,
          skippedKeys: 0,
          metadata: { reason: 'no-local-diff' },
        };
      }

      const spreadsheetId = resolveSpreadsheetId(options.spreadsheetId);
      const authClient = deps.createAuthClient();
      const doc = deps.createSpreadsheetClient(spreadsheetId, authClient);

      await deps.withRetry(
        () => doc.loadInfo(true),
        'loadInfo',
        getWaitSeconds(options.waitSeconds) * 1000,
      );

      await deps.updateSpreadsheetWithLocalChanges(
        doc,
        changes,
        getWaitSeconds(options.waitSeconds),
        options.autoTranslate ?? false,
        options.localeMapping ?? {},
        options.override ?? false,
      );

      return {
        changedKeys: countTranslationLeafKeys(changes),
        skippedKeys: 0,
        metadata: { spreadsheetId },
      };
    },
  };
}

/**
 * Static capability sets declared for Google Sheets input, output, and sync providers.
 */
export const GOOGLE_SHEETS_PROVIDER_CAPABILITIES = {
  input: INPUT_CAPABILITIES,
  output: OUTPUT_CAPABILITIES,
  sync: SYNC_CAPABILITIES,
} as const;
