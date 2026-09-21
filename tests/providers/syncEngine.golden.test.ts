import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSyncPlan } from '../../src/providers/syncEngine';
import type { TranslationData } from '../../src/types';

describe('sync engine golden fixtures', () => {
  it('matches golden conflict plan output', () => {
    const base: TranslationData = {
      en: { home: { welcome: 'Hello' } },
    };

    const local: TranslationData = {
      en: { home: { welcome: 'Hello local' } },
    };

    const remote: TranslationData = {
      en: { home: { welcome: 'Hello remote' } },
    };

    const plan = buildSyncPlan({
      baseTranslations: base,
      localTranslations: local,
      remoteTranslations: remote,
    });

    const expected = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../fixtures/providers/sync-conflict-golden.json'),
        'utf8',
      ),
    );

    expect(plan).toEqual(expected);
  });
});
