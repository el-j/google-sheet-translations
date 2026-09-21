import type {
  TranslationSyncPayload,
  TranslationSyncProvider,
  TranslationSyncResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import { CryptPadClient } from './client';
import { convertTranslationsToSheetRows } from './sheetOutputProvider';
import { resolveSyncPlan, type SyncConflictPolicy, type BuildSyncPlanInput } from '../syncEngine';
import { findLocalChanges } from '../../utils/dataConverter/findLocalChanges';
import {
  countTranslationLeafKeys,
  hasAnyTranslationChanges,
} from '../../utils/translationDataStats';
import type { TranslationData } from '../../types';

export interface CryptPadSheetSyncProviderOptions {
  /** Full CryptPad URL (e.g. https://cryptpad.fr/sheet/#/2/sheet/edit/seed/p/). */
  url?: string;
  /** Optional password if the pad is password-protected. */
  password?: string;
  /** Conflict resolution strategy used during sync. Defaults to 'manual'. Only takes
   *  effect when a real `baseTranslations` snapshot is supplied — see below. */
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
 * against a live CryptPad spreadsheet (multi-tab OnlyOffice workbook), pushing only
 * the resolved diffs back over Netflux.
 *
 * ### Two modes, chosen automatically per call
 *
 * - **Default (no `payload.metadata.baseTranslations` supplied)** — the common case,
 *   used by `gst-cryptpad sync` and anything else that doesn't track a real common-
 *   ancestor snapshot. Uses the exact same one-way "push new keys only" diff
 *   ({@link findLocalChanges}) as `createGoogleSheetsSyncProvider`, so `sync` behaves
 *   identically across providers by default: an existing key that differs between
 *   local and remote is left untouched either way, matching Google Sheets exactly.
 *   (See issue #164 — without a genuine base snapshot, three-way conflict detection
 *   degenerates to "no conflict ever detected," which is a materially different and
 *   more aggressive behavior than Google's, not an intentional feature.)
 * - **Advanced (a real `payload.metadata.baseTranslations` is supplied)** — a genuine
 *   three-way merge via {@link resolveSyncPlan}, with `conflictPolicy` controlling how
 *   keys that changed on both sides are resolved. This is an explicit opt-in for
 *   callers that track a base snapshot themselves (see the Full Sync guide).
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
      const explicitBase = payload.metadata?.baseTranslations as TranslationData | undefined;
      const client = new CryptPadClient({ url, password, timeoutMs: options.timeoutMs });
      const effectiveMapping = options.localeMapping ?? {};

      if (!explicitBase) {
        // Default mode: identical semantics to Google Sheets sync.
        const changes = findLocalChanges(payload.localTranslations, payload.remoteTranslations);

        if (!hasAnyTranslationChanges(changes)) {
          return {
            changedKeys: 0,
            skippedKeys: 0,
            metadata: { reason: 'no-local-diff', url, mode: 'new-keys-only' },
          };
        }

        const sheetRowsMap = convertTranslationsToSheetRows(changes, effectiveMapping);
        for (const [sheetName, rows] of Object.entries(sheetRowsMap)) {
          await client.writeSheetRows(sheetName, rows, { override: false });
        }

        return {
          changedKeys: countTranslationLeafKeys(changes),
          skippedKeys: 0,
          metadata: { provider: 'cryptpad-sheet', url, mode: 'new-keys-only' },
        };
      }

      // Advanced mode: genuine three-way diff against a real base snapshot.
      const syncInput: BuildSyncPlanInput = {
        baseTranslations: explicitBase,
        localTranslations: payload.localTranslations,
        remoteTranslations: payload.remoteTranslations,
      };

      const resolution = resolveSyncPlan(syncInput, options.conflictPolicy ?? 'manual');

      if (resolution.appliedLocalChanges === 0) {
        return {
          changedKeys: 0,
          skippedKeys: resolution.skippedConflicts,
          metadata: { reason: 'no-local-diff', url, policy: resolution.policy, mode: 'three-way' },
        };
      }

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
          mode: 'three-way',
        },
      };
    },
  };
}
