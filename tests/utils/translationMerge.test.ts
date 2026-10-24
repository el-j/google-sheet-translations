import { describe, it, expect } from 'vitest';
import { deepMergeTranslations } from '../../src/utils/translationMerge';
import type { TranslationData } from '../../src/types';

describe('deepMergeTranslations', () => {
  it('returns a copy of base when additions is empty', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello' } },
    };
    const result = deepMergeTranslations(base, {});
    expect(result).toEqual(base);
    expect(result).not.toBe(base); // deep clone, not same reference
  });

  it('adds keys that exist only in additions (local-only additions)', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello' } },
    };
    const additions: TranslationData = {
      'en-gb': { common: { goodbye: 'Goodbye' } },
    };
    const result = deepMergeTranslations(base, additions);
    expect(result['en-gb']['common']['hello']).toBe('Hello');
    expect(result['en-gb']['common']['goodbye']).toBe('Goodbye');
  });

  it('does NOT overwrite existing base values (remote wins for existing keys)', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello from remote' } },
    };
    const additions: TranslationData = {
      'en-gb': { common: { hello: 'Hello from local' } },
    };
    const result = deepMergeTranslations(base, additions);
    expect(result['en-gb']['common']['hello']).toBe('Hello from remote');
  });

  it('preserves empty-string base values (empty translation is valid)', () => {
    const base: TranslationData = {
      'de-de': { common: { untranslated: '' } },
    };
    const additions: TranslationData = {
      'de-de': { common: { untranslated: 'some local value' } },
    };
    const result = deepMergeTranslations(base, additions);
    // Empty string in base is a defined value — it should NOT be overwritten
    expect(result['de-de']['common']['untranslated']).toBe('');
  });

  it('adds locale that exists only in additions', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello' } },
    };
    const additions: TranslationData = {
      'de-de': { common: { hello: 'Hallo' } },
    };
    const result = deepMergeTranslations(base, additions);
    expect(result['en-gb']['common']['hello']).toBe('Hello');
    expect(result['de-de']['common']['hello']).toBe('Hallo');
  });

  it('adds sheet that exists only in additions', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello' } },
    };
    const additions: TranslationData = {
      'en-gb': { auth: { login: 'Log in' } },
    };
    const result = deepMergeTranslations(base, additions);
    expect(result['en-gb']['common']['hello']).toBe('Hello');
    expect(result['en-gb']['auth']['login']).toBe('Log in');
  });

  it('does not mutate the base or additions inputs', () => {
    const base: TranslationData = {
      'en-gb': { common: { hello: 'Hello' } },
    };
    const additions: TranslationData = {
      'en-gb': { common: { goodbye: 'Goodbye' } },
    };
    const baseCopy = JSON.stringify(base);
    const additionsCopy = JSON.stringify(additions);
    deepMergeTranslations(base, additions);
    expect(JSON.stringify(base)).toBe(baseCopy);
    expect(JSON.stringify(additions)).toBe(additionsCopy);
  });

  it('handles complex realistic scenario: remote has untranslated keys, local has new keys', () => {
    // Simulates: developer added hero_btn_new locally (only en-gb value),
    // CryptPad has hero_title in en-gb and de-de but hero_btn_existing only in en-gb (de-de untranslated="")
    const remote: TranslationData = {
      'en-gb': {
        hero: {
          hero_title: 'Hero Title',
          hero_btn_existing: 'Click Me',
        },
      },
      'de-de': {
        hero: {
          hero_title: 'Heldenbereich',
          hero_btn_existing: '', // untranslated in CryptPad
        },
      },
    };
    const local: TranslationData = {
      'en-gb': {
        hero: {
          hero_title: 'Hero Title (stale local)',
          hero_btn_existing: 'Click Me (stale local)',
          hero_btn_new: 'New Button', // only in local, not yet pushed
        },
      },
      'de-de': {
        hero: {
          hero_title: 'Heldenbereich (stale local)',
          hero_btn_existing: 'Klick mich (stale local)',
          hero_btn_new: '', // local placeholder for new key
        },
      },
    };

    const result = deepMergeTranslations(remote, local);

    // Remote values win for existing keys
    expect(result['en-gb']['hero']['hero_title']).toBe('Hero Title');
    expect(result['en-gb']['hero']['hero_btn_existing']).toBe('Click Me');

    // Remote empty string wins (translator hasn't filled it yet)
    expect(result['de-de']['hero']['hero_btn_existing']).toBe('');

    // Local-only keys are preserved
    expect(result['en-gb']['hero']['hero_btn_new']).toBe('New Button');
    expect(result['de-de']['hero']['hero_btn_new']).toBe('');
  });
});
