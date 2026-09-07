import type {
  TranslationSyncPayload,
  TranslationSyncProvider,
  TranslationSyncResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadClient } from './client';
import { convertTranslationsToSheetRows } from './sheetOutputProvider';
import { resolveSyncPlan, type SyncConflictPolicy, type BuildSyncPlanInput } from '../syncEngine';
import type { TranslationData } from '../../types';

export interface CryptPadSheetSyncProviderOptions {
  /** Full CryptPad URL (e.g. https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/). */
  url?: string;
  /** Optional password if the pad is password-protected. */
  password?: string;
  /** Conflict resolution strategy used during sync. Defaults to 'manual'. */
  conflictPolicy?: SyncConflictPolicy;
  /** When true, overwrites existing remote values even on conflict. Defaults to false. */
  override?: boolean;
  /** Column header mappings for locale normalization. */
  localeMapping?: Record<string, string>;
  /** Optional custom provider identifier. Defaults to 'cryptpad-sheet'. */
  providerId?: string;
  /** Optional custom provider display name. */
  displayName?: string;
  /** Optional timeout in milliseconds for WebSocket operations. */
  timeoutMs?: number;
}

export const CRYPTPAD_SHEET_SYNC_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  syncBack: true,
  writeTables: true,
});

/**
 * Creates a {@link TranslationSyncProvider} that reconciles local translation changes
 * against a live CryptPad spreadsheet (multi-tab OnlyOffice workbook) using three-way
 * diffing and conflict policies, pushing only the resolved diffs back over Netflux.
 */
export function createCryptPadSheetSyncProvider(
  options: CryptPadSheetSyncProviderOptions = {},
): TranslationSyncProvider {
  const url = options.url ?? process.env.CRYPTPAD_URL;
  if (!url) {
    throw new Error(
      'CryptPad Sheet sync provider requires a "url" option or CRYPTPAD_URL environment variable.',
    );
  }

  const password = options.password ?? process.env.CRYPTPAD_PASSWORD;

  return {
    kind: 'sync',
    providerId: options.providerId ?? 'cryptpad-sheet',
    displayName: options.displayName ?? 'CryptPad Sheet Sync (E2EE)',
    capabilities: CRYPTPAD_SHEET_SYNC_CAPABILITIES,

    async syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult> {
      // 1. Resolve sync plan using three-way diff
      const baseTranslations =
        (payload.metadata?.baseTranslations as TranslationData | undefined) ??
        payload.remoteTranslations;

      const syncInput: BuildSyncPlanInput = {
        baseTranslations,
        localTranslations: payload.localTranslations,
        remoteTranslations: payload.remoteTranslations,
      };

      const resolution = resolveSyncPlan(syncInput, options.conflictPolicy ?? 'manual');

      if (resolution.appliedLocalChanges === 0) {
        return {
          changedKeys: 0,
          skippedKeys: resolution.skippedConflicts,
          metadata: { reason: 'no-local-diff', url, policy: resolution.policy },
        };
      }

      // 2. Convert merged translations to tabular rows and push to CryptPad
      const client = new CryptPadClient({
        url,
        password,
        timeoutMs: options.timeoutMs,
      });

      const effectiveMapping = options.localeMapping ?? {};
      const sheetRowsMap = convertTranslationsToSheetRows(
        resolution.mergedTranslations,
        effectiveMapping,
      );

      for (const [sheetName, rows] of Object.entries(sheetRowsMap)) {
        await client.writeSheetRows(sheetName, rows, {
          override: options.override ?? options.conflictPolicy === 'local-wins',
        });
      }

      return {
        changedKeys: resolution.appliedLocalChanges,
        skippedKeys: resolution.skippedConflicts,
        metadata: {
          provider: 'cryptpad-sheet',
          url,
          policy: resolution.policy,
        },
      };
    },
  };
}
