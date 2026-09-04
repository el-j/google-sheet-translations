import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

const { mockFilterValidLocales, mockCreateLocaleMapping, mockWithRetry } = vi.hoisted(() => ({
  mockFilterValidLocales: vi.fn(),
  mockCreateLocaleMapping: vi.fn(),
  mockWithRetry: vi.fn(),
}));

vi.mock('../../src/utils/localeFilter', () => ({
  filterValidLocales: mockFilterValidLocales,
}));

vi.mock('../../src/utils/localeNormalizer', () => ({
  createLocaleMapping: mockCreateLocaleMapping,
}));

vi.mock('../../src/utils/rateLimiter', () => ({
  withRetry: mockWithRetry,
}));

import { processRawRows, processSheet } from '../../src/utils/sheetProcessor';

describe('sheetProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRetry.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('processRawRows returns empty result when rows are empty', async () => {
    const result = await processRawRows([], 'home');

    expect(result).toEqual({
      translations: {},
      locales: [],
      localeMapping: {},
      originalMapping: {},
      success: false,
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('No rows found in sheet "home"'),
    );
  });

  test('processRawRows returns empty result when no valid locale columns exist', async () => {
    mockFilterValidLocales.mockReturnValueOnce([]);

    const result = await processRawRows([{ key: 'hello' }], 'home');

    expect(result.success).toBe(false);
    expect(result.translations).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('No valid locale columns found in sheet "home"'),
    );
  });

  test('processRawRows builds translations and skips invalid rows', async () => {
    mockFilterValidLocales.mockReturnValueOnce(['en']);
    mockCreateLocaleMapping.mockReturnValueOnce({
      normalizedLocales: ['en'],
      localeMapping: { en: 'en' },
      originalMapping: { en: 'en' },
    });

    const result = await processRawRows(
      [{ key: 'WELCOME', en: 'Welcome' }, { key: 'MISSING_TRANSLATION' }, { en: 'Missing key' }],
      'home',
    );

    expect(result.success).toBe(true);
    expect(result.locales).toEqual(['en']);
    expect(result.translations.en.home).toEqual({ welcome: 'Welcome' });
  });

  test('processRawRows tolerates locale entries without mapping', async () => {
    mockFilterValidLocales.mockReturnValueOnce(['en', 'fr']);
    mockCreateLocaleMapping.mockReturnValueOnce({
      normalizedLocales: ['en', 'fr'],
      localeMapping: { en: 'en' },
      originalMapping: { en: 'en' },
    });

    const result = await processRawRows([{ key: 'HELLO', en: 'Hello' }], 'home');

    expect(result.success).toBe(true);
    expect(result.locales).toEqual(['en', 'fr']);
    expect(result.translations.en.home.hello).toBe('Hello');
    expect(result.translations.fr).toBeUndefined();
  });

  test('processRawRows catches parsing failures and returns unsuccessful result', async () => {
    mockFilterValidLocales.mockReturnValueOnce(['en']);
    mockCreateLocaleMapping.mockImplementationOnce(() => {
      throw new Error('mapping failed');
    });

    const result = await processRawRows([{ key: 'k', en: 'v' }], 'home');

    expect(result.success).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing sheet "home"'),
      expect.any(Error),
    );
  });

  test('processSheet returns empty result when worksheet has no rows', async () => {
    const sheet = {
      getRows: vi.fn().mockResolvedValue([]),
    };

    const result = await processSheet(sheet as never, 'home', 100);

    expect(result.success).toBe(false);
    expect(result.translations).toEqual({});
    expect(mockWithRetry).toHaveBeenCalled();
  });

  test('processSheet catches API errors and returns empty result', async () => {
    mockWithRetry.mockRejectedValueOnce(new Error('rate limited forever'));
    const sheet = {
      getRows: vi.fn(),
    };

    const result = await processSheet(sheet as never, 'home', 100);

    expect(result.success).toBe(false);
    expect(result.translations).toEqual({});
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing sheet "home"'),
      expect.any(Error),
    );
  });

  test('processSheet maps worksheet rows and reuses processRawRows logic', async () => {
    mockFilterValidLocales.mockReturnValueOnce(['en']);
    mockCreateLocaleMapping.mockReturnValueOnce({
      normalizedLocales: ['en'],
      localeMapping: { en: 'en' },
      originalMapping: { en: 'en' },
    });

    const sheet = {
      getRows: vi.fn().mockResolvedValue([{ toObject: () => ({ key: 'HELLO', en: 'Hello' }) }]),
    };

    const result = await processSheet(sheet as never, 'home', 100);

    expect(result.success).toBe(true);
    expect(result.translations.en.home.hello).toBe('Hello');
    expect(result.localeMapping).toEqual({ en: 'en' });
  });

  test('processRawRows merges translations when multiple headers normalize to the same locale', async () => {
    mockFilterValidLocales.mockReturnValueOnce(['en', 'en-US']);
    mockCreateLocaleMapping.mockReturnValueOnce({
      normalizedLocales: ['en', 'en'],
      localeMapping: { en: 'en', 'en-US': 'en' },
      originalMapping: { en: 'en', 'en-US': 'en' },
    });

    const rows = [{ key: 'greet', en: 'Hello', 'en-US': 'Hello US' }];

    const result = await processRawRows(rows, 'home');
    expect(result.success).toBe(true);
    expect(result.translations.en.home).toEqual({
      greet: 'Hello',
    });
  });
});
