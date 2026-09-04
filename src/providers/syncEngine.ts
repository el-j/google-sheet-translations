import type { TranslationData } from '../types';

/**
 * Three-way sync engine: given a common ancestor ("base") and two divergent copies
 * ("local" and "remote"), computes per-key changes on each side, flags keys changed
 * on both sides as conflicts, and resolves the merge according to a chosen
 * {@link SyncConflictPolicy}. Used by sync-capable providers (e.g. CryptPad workspace)
 * to reconcile local translation edits against the remote snapshot before writing back.
 */
export type SyncConflictPolicy = 'remote-wins' | 'local-wins' | 'manual';
export type SyncChangeType = 'insert' | 'update' | 'delete';

export interface SyncEntryChange {
  path: string;
  locale: string;
  sheet: string;
  key: string;
  type: SyncChangeType;
  before?: string;
  after?: string;
}

export interface SyncConflict {
  path: string;
  locale: string;
  sheet: string;
  key: string;
  baseValue?: string;
  localValue?: string;
  remoteValue?: string;
  reason: 'diverged-update' | 'delete-vs-update';
}

export interface SyncPlan {
  localChanges: SyncEntryChange[];
  remoteChanges: SyncEntryChange[];
  conflicts: SyncConflict[];
}

export interface ResolveSyncPlanResult {
  policy: SyncConflictPolicy;
  mergedTranslations: TranslationData;
  appliedLocalChanges: number;
  appliedRemoteChanges: number;
  skippedConflicts: number;
}

export interface BuildSyncPlanInput {
  baseTranslations: TranslationData;
  localTranslations: TranslationData;
  remoteTranslations: TranslationData;
}

interface FlatValue {
  locale: string;
  sheet: string;
  key: string;
  value: string;
}

function pathKey(locale: string, sheet: string, key: string): string {
  return `${locale}::${sheet}::${key}`;
}

function splitPath(key: string): { locale: string; sheet: string; key: string } {
  const [locale, sheet, nestedKey] = key.split('::');
  return { locale, sheet, key: nestedKey };
}

function flattenTranslations(translations: TranslationData): Map<string, FlatValue> {
  const result = new Map<string, FlatValue>();

  for (const [locale, sheets] of Object.entries(translations)) {
    for (const [sheet, entries] of Object.entries(sheets)) {
      for (const [key, rawValue] of Object.entries(entries)) {
        result.set(pathKey(locale, sheet, key), {
          locale,
          sheet,
          key,
          value: String(rawValue ?? ''),
        });
      }
    }
  }

  return result;
}

function getChangeType(beforeValue: string | undefined, afterValue: string | undefined): SyncChangeType {
  if (beforeValue === undefined && afterValue !== undefined) {
    return 'insert';
  }
  if (beforeValue !== undefined && afterValue === undefined) {
    return 'delete';
  }
  return 'update';
}

function diffChanges(base: Map<string, FlatValue>, next: Map<string, FlatValue>): SyncEntryChange[] {
  const keys = new Set<string>([...base.keys(), ...next.keys()]);
  const changes: SyncEntryChange[] = [];

  for (const key of keys) {
    const baseValue = base.get(key)?.value;
    const nextValue = next.get(key)?.value;

    if (baseValue === nextValue) continue;

    const details = splitPath(key);
    changes.push({
      path: key,
      locale: details.locale,
      sheet: details.sheet,
      key: details.key,
      type: getChangeType(baseValue, nextValue),
      before: baseValue,
      after: nextValue,
    });
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

function isConflict(
  baseValue: string | undefined,
  localValue: string | undefined,
  remoteValue: string | undefined,
): SyncConflict['reason'] | undefined {
  if (localValue === remoteValue) {
    return undefined;
  }

  if (baseValue === localValue || baseValue === remoteValue) {
    return undefined;
  }

  if (localValue === undefined || remoteValue === undefined) {
    return 'delete-vs-update';
  }

  return 'diverged-update';
}

function setValue(
  target: TranslationData,
  locale: string,
  sheet: string,
  key: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    if (!target[locale]?.[sheet]) return;
    delete target[locale][sheet][key];
    if (Object.keys(target[locale][sheet]).length === 0) {
      delete target[locale][sheet];
    }
    if (Object.keys(target[locale]).length === 0) {
      delete target[locale];
    }
    return;
  }

  if (!target[locale]) target[locale] = {};
  if (!target[locale][sheet]) target[locale][sheet] = {};
  target[locale][sheet][key] = value;
}

function cloneTranslations(input: TranslationData): TranslationData {
  return JSON.parse(JSON.stringify(input));
}

/**
 * Diffs `localTranslations` and `remoteTranslations` each against `baseTranslations`
 * (flattened to `locale::sheet::key` paths) and returns the resulting local changes,
 * remote changes, and any keys that changed on both sides to a genuinely different
 * value (conflicts). Does not merge anything — see {@link resolveSyncPlan} for that.
 */
export function buildSyncPlan(input: BuildSyncPlanInput): SyncPlan {
  const base = flattenTranslations(input.baseTranslations);
  const local = flattenTranslations(input.localTranslations);
  const remote = flattenTranslations(input.remoteTranslations);

  const localChanges = diffChanges(base, local);
  const remoteChanges = diffChanges(base, remote);

  const localChanged = new Map(localChanges.map((change) => [change.path, change]));
  const remoteChanged = new Map(remoteChanges.map((change) => [change.path, change]));
  const overlap = new Set([...localChanged.keys()].filter((path) => remoteChanged.has(path)));

  const conflicts: SyncConflict[] = [];
  for (const path of overlap) {
    const details = splitPath(path);
    const baseValue = base.get(path)?.value;
    const localValue = local.get(path)?.value;
    const remoteValue = remote.get(path)?.value;
    const reason = isConflict(baseValue, localValue, remoteValue);

    if (!reason) continue;

    conflicts.push({
      path,
      locale: details.locale,
      sheet: details.sheet,
      key: details.key,
      baseValue,
      localValue,
      remoteValue,
      reason,
    });
  }

  return {
    localChanges,
    remoteChanges,
    conflicts: conflicts.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/**
 * Runs {@link buildSyncPlan} and merges the result into a copy of `remoteTranslations`
 * according to `policy`:
 * - `remote-wins` — non-conflicting local changes apply; conflicting keys keep the remote value.
 * - `local-wins` — every local change applies, including over conflicts.
 * - `manual` — non-conflicting local changes apply; conflicts are left as-is and counted in `skippedConflicts` for human review.
 */
export function resolveSyncPlan(
  input: BuildSyncPlanInput,
  policy: SyncConflictPolicy,
): ResolveSyncPlanResult {
  const plan = buildSyncPlan(input);
  const merged = cloneTranslations(input.remoteTranslations);

  const conflictMap = new Map(plan.conflicts.map((conflict) => [conflict.path, conflict]));

  let appliedLocalChanges = 0;
  for (const change of plan.localChanges) {
    const conflict = conflictMap.get(change.path);
    if (conflict) {
      if (policy === 'remote-wins' || policy === 'manual') {
        continue;
      }
      setValue(merged, change.locale, change.sheet, change.key, change.after);
      appliedLocalChanges++;
      continue;
    }

    setValue(merged, change.locale, change.sheet, change.key, change.after);
    appliedLocalChanges++;
  }

  if (policy === 'local-wins') {
    return {
      policy,
      mergedTranslations: merged,
      appliedLocalChanges,
      appliedRemoteChanges: 0,
      skippedConflicts: 0,
    };
  }

  return {
    policy,
    mergedTranslations: merged,
    appliedLocalChanges,
    appliedRemoteChanges: 0,
    skippedConflicts: policy === 'manual' ? plan.conflicts.length : 0,
  };
}
