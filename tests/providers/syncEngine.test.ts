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

    const localWins = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'local-wins',
    );
    expect(localWins.mergedTranslations.en.home.welcome).toBe('Hello local');

    const manual = resolveSyncPlan(
      { baseTranslations: base, localTranslations: local, remoteTranslations: remote },
      'manual',
    );
    expect(manual.mergedTranslations.en.home.welcome).toBe('Hello remote');
    expect(manual.skippedConflicts).toBe(1);
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
});
