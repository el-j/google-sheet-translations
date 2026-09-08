// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { buildSyncPlan, resolveSyncPlan } from '../../src/providers/syncEngine';
import type { TranslationData } from '../../src/types';

describe('sync engine', () => {
  it('builds deterministic conflict set for diverged updates', () => {
    const base: TranslationData = {
      en: { home: { welcome: 'Hello', subtitle: 'Base subtitle' } },
    };

    const local: TranslationData = {
      en: { home: { welcome: 'Hello local', subtitle: 'Base subtitle' } },
    };

    const remote: TranslationData = {
      en: { home: { welcome: 'Hello remote', subtitle: 'Base subtitle' } },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(plan.localChanges.map((c) => c.path)).toEqual(['en::home::welcome']);
    expect(plan.remoteChanges.map((c) => c.path)).toEqual(['en::home::welcome']);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      path: 'en::home::welcome',
      reason: 'diverged-update',
      baseValue: 'Hello',
      localValue: 'Hello local',
      remoteValue: 'Hello remote',
    });
  });

  it('resolves conflicts according to policy', () => {
    const base: TranslationData = { en: { home: { welcome: 'Hello' } } };
    const local: TranslationData = { en: { home: { welcome: 'Hello local' } } };
    const remote: TranslationData = { en: { home: { welcome: 'Hello remote' } } };

    const remoteWins = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'remote-wins',
    );
    expect(remoteWins.mergedTranslations.en.home.welcome).toBe('Hello remote');
    expect(remoteWins.policy).toBe('remote-wins');

    const localWins = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'local-wins',
    );
    expect(localWins.mergedTranslations.en.home.welcome).toBe('Hello local');
    expect(localWins.policy).toBe('local-wins');
    expect(localWins.appliedRemoteChanges).toBe(0);
    expect(localWins.skippedConflicts).toBe(0);

    const manual = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'manual',
    );
    expect(manual.mergedTranslations.en.home.welcome).toBe('Hello remote');
    expect(manual.skippedConflicts).toBe(1);
    expect(manual.policy).toBe('manual');
  });

  it('determines insert, update, and delete change types and sorts them alphabetically by path', () => {
    const base: TranslationData = {
      en: {
        zoo: { animal: 'Lion' },
        alpha: { kept: 'Old', removed: 'Gone' },
      },
    };
    const updated: TranslationData = {
      en: {
        zoo: { animal: 'Tiger', bird: 'Parrot' },
        alpha: { kept: 'New' },
      },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: updated,
      remoteTranslations: base,
    });

    expect(plan.localChanges).toHaveLength(4);
    // alphabetical ordering
    expect(plan.localChanges[0].path).toBe('en::alpha::kept');
    expect(plan.localChanges[0].type).toBe('update');

    expect(plan.localChanges[1].path).toBe('en::alpha::removed');
    expect(plan.localChanges[1].type).toBe('delete');

    expect(plan.localChanges[2].path).toBe('en::zoo::animal');
    expect(plan.localChanges[2].type).toBe('update');

    expect(plan.localChanges[3].path).toBe('en::zoo::bird');
    expect(plan.localChanges[3].type).toBe('insert');
  });

  it('sorts multiple conflicts alphabetically by path', () => {
    const base: TranslationData = {
      en: {
        zoo: { animal: 'Lion' },
        alpha: { greeting: 'Hi' },
      },
    };
    const local: TranslationData = {
      en: {
        zoo: { animal: 'Tiger' },
        alpha: { greeting: 'Hey' },
      },
    };
    const remote: TranslationData = {
      en: {
        zoo: { animal: 'Bear' },
        alpha: { greeting: 'Hello' },
      },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(plan.conflicts).toHaveLength(2);
    expect(plan.conflicts[0].path).toBe('en::alpha::greeting');
    expect(plan.conflicts[1].path).toBe('en::zoo::animal');
  });

  it('applies non-conflicting inserts from local', () => {
    const base: TranslationData = { en: { home: { welcome: 'Hello' } } };
    const local: TranslationData = { en: { home: { welcome: 'Hello', newCta: 'Buy now' } } };
    const remote: TranslationData = { en: { home: { welcome: 'Hello' } } };

    const resolution = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'manual',
    );

    expect(resolution.mergedTranslations.en.home.newCta).toBe('Buy now');
    expect(resolution.appliedLocalChanges).toBe(1);
    expect(resolution.skippedConflicts).toBe(0);
  });

  it('detects delete-vs-update conflicts when one side deletes and other updates', () => {
    const base: TranslationData = {
      en: {
        home: {
          key1: 'Base 1',
          key2: 'Base 2',
        },
      },
    };

    // local deletes key1, updates key2
    const local: TranslationData = {
      en: {
        home: {
          key2: 'Local updated 2',
        },
      },
    };

    // remote updates key1, deletes key2
    const remote: TranslationData = {
      en: {
        home: {
          key1: 'Remote updated 1',
        },
      },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(plan.conflicts).toHaveLength(2);
    expect(plan.conflicts[0]).toMatchObject({
      path: 'en::home::key1',
      reason: 'delete-vs-update',
      localValue: undefined,
      remoteValue: 'Remote updated 1',
    });
    expect(plan.conflicts[1]).toMatchObject({
      path: 'en::home::key2',
      reason: 'delete-vs-update',
      localValue: 'Local updated 2',
      remoteValue: undefined,
    });
  });

  it('treats identical local and remote changes as non-conflicting', () => {
    const base: TranslationData = {
      en: { home: { welcome: 'Old' } },
    };

    // Both changed to 'Same'
    const local: TranslationData = {
      en: { home: { welcome: 'Same' } },
    };
    const remote: TranslationData = {
      en: { home: { welcome: 'Same' } },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(plan.conflicts).toHaveLength(0);
  });

  it('prunes empty sheets and empty locales when local deletes all keys', () => {
    const base: TranslationData = {
      en: { home: { key1: 'Val 1', key2: 'Val 2' } },
    };
    // Local deletes both keys
    const local: TranslationData = {
      en: { home: {} },
    };
    const remote: TranslationData = {
      en: { home: { key1: 'Val 1', key2: 'Val 2' } },
    };

    const res = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'local-wins',
    );

    // en should be completely pruned
    expect(res.mergedTranslations.en).toBeUndefined();
  });

  it('detects no conflict when only local or only remote changed compared to base', () => {
    const base: TranslationData = {
      en: { home: { k1: 'base1', k2: 'base2' } },
    };
    // k1 changed only locally, k2 changed only remotely
    const local: TranslationData = {
      en: { home: { k1: 'local-changed', k2: 'base2' } },
    };
    const remote: TranslationData = {
      en: { home: { k1: 'base1', k2: 'remote-changed' } },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.localChanges.map((c) => c.key)).toEqual(['k1']);
    expect(plan.remoteChanges.map((c) => c.key)).toEqual(['k2']);
  });
});
