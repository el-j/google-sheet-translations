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
              "welcome": "Willkommen",
            },
          },
          "en-us": {
            "home": {
              "cta": "Buy",
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
});
