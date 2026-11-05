import { describe, expect, it, vi } from 'vitest';
import { transformRowsToSheetData } from '../../src/core/rowTransformer';
import { filterValidLocales } from '../../src/utils/localeFilter';
import { createLocaleMapping } from '../../src/utils/localeNormalizer';

describe('rowTransformer core', () => {
  it('produces stable output snapshot for mixed locale headers and sparse rows', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };

    const rows = [
      { Key: 'WELCOME', 'en-US': 'Welcome', de: 'Willkommen', note: 'ignore' },
      { Key: 'CTA', 'en-US': 'Buy', de: '' },
      { Key: 'EMPTY', 'en-US': '', de: '' },
      { Key: '', 'en-US': 'ignored', de: 'ignored' },
    ];

    const result = transformRowsToSheetData(rows, 'home', {
      filterValidLocales,
      createLocaleMapping,
      logger,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "localeMapping": {
          "de-DE": "de",
          "en-us": "en-US",
        },
        "locales": [
          "en-us",
          "de-DE",
        ],
        "originalMapping": {
          "de": "de-DE",
          "en-us": "en-us",
        },
        "success": true,
        "translations": {
          "de-DE": {
            "home": {
              "cta": "",
              "empty": "",
              "welcome": "Willkommen",
            },
          },
          "en-us": {
            "home": {
              "cta": "Buy",
              "empty": "",
              "welcome": "Welcome",
            },
          },
        },
      }
    `);
  });

  it('keeps deterministic locale conflict behavior snapshot', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };

    const rows = [{ key: 'greet', en: 'Hello', 'en-US': 'Howdy' }];

    const result = transformRowsToSheetData(rows, 'landing', {
      filterValidLocales,
      createLocaleMapping,
      logger,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "localeMapping": {
          "en-GB": "en",
          "en-us": "en-US",
        },
        "locales": [
          "en-GB",
          "en-us",
        ],
        "originalMapping": {
          "en": "en-GB",
          "en-us": "en-us",
        },
        "success": true,
        "translations": {
          "en-GB": {
            "landing": {
              "greet": "Hello",
            },
          },
          "en-us": {
            "landing": {
              "greet": "Howdy",
            },
          },
        },
      }
    `);
  });

  // Bug #1 regression: rows with an empty-string translation value must be
  // preserved in the output (they represent "key exists, needs translation").
  // Before the fix, `!row[originalHeader]` was falsy for '' and the row was dropped.
  it('preserves rows with empty-string translation values (Bug #1)', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };
    const rows = [
      { key: 'hero_title', en: 'Hero Title', de: 'Heldenbereich' },
      { key: 'hero_btn', en: 'Click Me', de: '' }, // de not yet translated
      { key: 'new_key', en: 'New Key', de: '' }, // brand-new key
    ];
    const result = transformRowsToSheetData(rows, 'hero', {
      filterValidLocales,
      createLocaleMapping,
      logger,
    });
    expect(result.success).toBe(true);
    // `en` header normalizes to `en-GB`, `de` normalizes to `de-DE`
    const en = result.translations['en-GB']['hero'];
    const de = result.translations['de-DE']['hero'];
    // All three keys must appear in both locales
    expect(en).toHaveProperty('hero_title', 'Hero Title');
    expect(en).toHaveProperty('hero_btn', 'Click Me');
    expect(en).toHaveProperty('new_key', 'New Key');
    // German untranslated keys must exist as empty string, NOT be absent
    expect(de).toHaveProperty('hero_btn', '');
    expect(de).toHaveProperty('new_key', '');
  });
});
