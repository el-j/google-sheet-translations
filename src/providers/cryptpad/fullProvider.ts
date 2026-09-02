import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  TranslationOutputPayload,
  TranslationOutputProvider,
  TranslationOutputResult,
  TranslationSyncPayload,
  TranslationSyncProvider,
  TranslationSyncResult,
} from '../contracts';
import { createCapabilitySet, type ProviderCapabilitySet } from '../capabilities';
import {
  resolveSyncPlan,
  type SyncConflictPolicy,
  type BuildSyncPlanInput,
} from '../syncEngine';
import type { TranslationData } from '../../types';

interface CryptPadWorkspaceSnapshot {
  revision: number;
  translations: TranslationData;
  metadata?: Record<string, unknown>;
}

export interface CryptPadWorkspaceProviderOptions {
  filePath: string;
  authToken?: string;
  expectedRevision?: number;
  conflictPolicy?: SyncConflictPolicy;
  providerId?: string;
  displayName?: string;
}

interface CryptPadWorkspaceProviderDeps {
  readSnapshot: (filePath: string, authToken?: string) => Promise<CryptPadWorkspaceSnapshot>;
  writeSnapshot: (
    filePath: string,
    snapshot: CryptPadWorkspaceSnapshot,
    authToken?: string,
  ) => Promise<void>;
}

const CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  writeTables: true,
});

const CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES: ProviderCapabilitySet = createCapabilitySet({
  syncBack: true,
  writeTables: true,
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function mergeTranslations(base: TranslationData, patch: TranslationData): TranslationData {
  const result = clone(base);

  for (const [locale, sheets] of Object.entries(patch)) {
    if (!result[locale]) result[locale] = {};
    for (const [sheet, keys] of Object.entries(sheets)) {
      if (!result[locale][sheet]) result[locale][sheet] = {};
      for (const [key, value] of Object.entries(keys)) {
        result[locale][sheet][key] = value;
      }
    }
  }

  return result;
}

function countChangedKeys(data: TranslationData): number {
  return Object.values(data)
    .flatMap((sheets) => Object.values(sheets))
    .reduce((count, keys) => count + Object.keys(keys).length, 0);
}

function normalizeRevision(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function createDefaultDeps(): CryptPadWorkspaceProviderDeps {
  return {
    async readSnapshot(filePath: string): Promise<CryptPadWorkspaceSnapshot> {
      try {
        const payload = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(payload) as Partial<CryptPadWorkspaceSnapshot>;
        return {
          revision: normalizeRevision(parsed.revision),
          translations: parsed.translations ?? {},
          metadata: parsed.metadata,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { revision: 0, translations: {} };
        }
        throw error;
      }
    },
    async writeSnapshot(filePath: string, snapshot: CryptPadWorkspaceSnapshot): Promise<void> {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    },
  };
}

function assertRevision(
  snapshot: CryptPadWorkspaceSnapshot,
  expectedRevision: number | undefined,
): void {
  if (expectedRevision === undefined) return;
  if (snapshot.revision !== expectedRevision) {
    throw new Error(
      `CryptPad revision mismatch: expected ${expectedRevision}, received ${snapshot.revision}.`,
    );
  }
}

export function createCryptPadWorkspaceOutputProvider(
  options: CryptPadWorkspaceProviderOptions,
  depsOverrides: Partial<CryptPadWorkspaceProviderDeps> = {},
): TranslationOutputProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'output',
    providerId: options.providerId ?? 'cryptpad-workspace',
    displayName: options.displayName ?? 'CryptPad Workspace Output',
    capabilities: CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES,
    async writeTranslations(payload: TranslationOutputPayload): Promise<TranslationOutputResult> {
      const snapshot = await deps.readSnapshot(options.filePath, options.authToken);
      assertRevision(snapshot, options.expectedRevision);

      const merged = mergeTranslations(snapshot.translations, payload.translations);
      const nextRevision = snapshot.revision + 1;
      await deps.writeSnapshot(
        options.filePath,
        {
          revision: nextRevision,
          translations: merged,
          metadata: {
            ...snapshot.metadata,
            lastWriteProvider: 'cryptpad-workspace-output',
          },
        },
        options.authToken,
      );

      return {
        wroteFiles: [options.filePath],
        metadata: {
          revision: nextRevision,
          changedKeys: countChangedKeys(payload.translations),
        },
      };
    },
  };
}

function buildSyncInput(payload: TranslationSyncPayload): BuildSyncPlanInput {
  const base = (payload.metadata?.baseTranslations as TranslationData | undefined) ?? payload.remoteTranslations;
  return {
    baseTranslations: base,
    localTranslations: payload.localTranslations,
    remoteTranslations: payload.remoteTranslations,
  };
}

export function createCryptPadWorkspaceSyncProvider(
  options: CryptPadWorkspaceProviderOptions,
  depsOverrides: Partial<CryptPadWorkspaceProviderDeps> = {},
): TranslationSyncProvider {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  return {
    kind: 'sync',
    providerId: options.providerId ?? 'cryptpad-workspace',
    displayName: options.displayName ?? 'CryptPad Workspace Sync',
    capabilities: CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES,
    async syncTranslations(payload: TranslationSyncPayload): Promise<TranslationSyncResult> {
      const snapshot = await deps.readSnapshot(options.filePath, options.authToken);

      const expectedRevision =
        options.expectedRevision ??
        (Number.isFinite(payload.metadata?.expectedRevision)
          ? Number(payload.metadata?.expectedRevision)
          : undefined);
      assertRevision(snapshot, expectedRevision);

      const resolution = resolveSyncPlan(
        buildSyncInput(payload),
        options.conflictPolicy ?? 'manual',
      );

      const nextRevision = snapshot.revision + 1;
      await deps.writeSnapshot(
        options.filePath,
        {
          revision: nextRevision,
          translations: resolution.mergedTranslations,
          metadata: {
            ...snapshot.metadata,
            lastSyncProvider: 'cryptpad-workspace-sync',
            policy: resolution.policy,
          },
        },
        options.authToken,
      );

      return {
        changedKeys: resolution.appliedLocalChanges,
        skippedKeys: resolution.skippedConflicts,
        metadata: {
          revision: nextRevision,
          policy: resolution.policy,
        },
      };
    },
  };
}

export {
  CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES,
  CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES,
};
