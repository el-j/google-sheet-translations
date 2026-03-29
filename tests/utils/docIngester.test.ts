import { exportDoc, entriesToSeedKeys, entriesToTranslationData, ingestDoc } from '../../src/utils/docIngester';
import type { DocManifestEntry } from '../../src/utils/driveProjectIndex';
import type { DriveDocFile } from '../../src/utils/driveDocScanner';

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    }),
  })),
}));

const mockCreateSpreadsheet = jest.fn();
jest.mock('../../src/utils/spreadsheetCreator', () => ({
  createSpreadsheet: (...args: unknown[]) => mockCreateSpreadsheet(...args),
}));

const mockUpdateSpreadsheet = jest.fn();
jest.mock('../../src/utils/spreadsheetUpdater', () => ({
  updateSpreadsheetWithLocalChanges: (...args: unknown[]) => mockUpdateSpreadsheet(...args),
}));

const mockLoadInfo = jest.fn();
jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
    loadInfo: mockLoadInfo,
  })),
}));

jest.mock('../../src/utils/auth', () => ({
  createAuthClient: jest.fn().mockReturnValue({ email: 'mock@test.com' }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CREDENTIALS = {
  GOOGLE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: 'mock-private-key',
  GOOGLE_SPREADSHEET_ID: 'unused',
};

const DOC_FILE: DriveDocFile = {
  id: 'doc-id-123',
  name: 'myapp_en',
  folderPath: '',
  mimeType: 'application/vnd.google-apps.document',
  modifiedTime: '2024-06-01T12:00:00.000Z',
  sourceLocale: 'en',
};

const DOC_CONTENT = `
# Hero

## title
Welcome to our app

## subtitle
Start your journey
`;

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadInfo.mockResolvedValue(undefined);
  mockCreateSpreadsheet.mockResolvedValue({
    spreadsheetId: 'new-sheet-id',
    url: 'https://docs.google.com/spreadsheets/d/new-sheet-id/edit',
  });
  mockUpdateSpreadsheet.mockResolvedValue(undefined);
});

// ── exportDoc ─────────────────────────────────────────────────────────────────

describe('exportDoc', () => {
  it('returns markdown when the markdown export succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Hello\n\n## world\nsome text',
    });

    const content = await exportDoc('doc-id', CREDENTIALS);
    expect(content).toContain('# Hello');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to plain text when markdown export fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })
      .mockResolvedValueOnce({ ok: true, text: async () => 'Plain text content' });

    const content = await exportDoc('doc-id', CREDENTIALS);
    expect(content).toBe('Plain text content');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when both markdown and plain text exports fail', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' });

    await expect(exportDoc('doc-id', CREDENTIALS)).rejects.toThrow('Failed to export doc');
  });
});

// ── entriesToSeedKeys ─────────────────────────────────────────────────────────

describe('entriesToSeedKeys', () => {
  it('prefixes keys with sheetName', () => {
    const entries = [
      { sheetName: 'hero', key: 'title', value: 'Hello' },
      { sheetName: 'nav', key: 'home', value: 'Home' },
    ];
    const keys = entriesToSeedKeys(entries);
    expect(keys).toEqual({ 'hero.title': 'Hello', 'nav.home': 'Home' });
  });

  it('disambiguates duplicate keys with a _N suffix', () => {
    const entries = [
      { sheetName: 'hero', key: 'title', value: 'First' },
      { sheetName: 'hero', key: 'title', value: 'Second' },
    ];
    const keys = entriesToSeedKeys(entries);
    expect(keys['hero.title']).toBe('First');
    expect(keys['hero.title_2']).toBe('Second');
  });

  it('returns empty object for empty entries', () => {
    expect(entriesToSeedKeys([])).toEqual({});
  });
});

// ── entriesToTranslationData ──────────────────────────────────────────────────

describe('entriesToTranslationData', () => {
  it('converts entries to TranslationData shape', () => {
    const entries = [
      { sheetName: 'hero', key: 'title', value: 'Hello' },
      { sheetName: 'nav', key: 'home', value: 'Home' },
    ];
    const data = entriesToTranslationData(entries, 'en');
    expect(data).toEqual({
      en: {
        hero: { title: 'Hello' },
        nav: { home: 'Home' },
      },
    });
  });

  it('disambiguates duplicate keys within a sheet', () => {
    const entries = [
      { sheetName: 'hero', key: 'item', value: 'First' },
      { sheetName: 'hero', key: 'item', value: 'Second' },
    ];
    const data = entriesToTranslationData(entries, 'en');
    expect((data.en.hero as Record<string, string>)['item']).toBe('First');
    expect((data.en.hero as Record<string, string>)['item_2']).toBe('Second');
  });

  it('uses the provided locale as the top-level key', () => {
    const entries = [{ sheetName: 'ui', key: 'save', value: 'Speichern' }];
    const data = entriesToTranslationData(entries, 'de');
    expect(data.de).toBeDefined();
    expect(data.en).toBeUndefined();
  });
});

// ── ingestDoc ─────────────────────────────────────────────────────────────────

describe('ingestDoc', () => {
  it('creates a new spreadsheet when no linkedSpreadsheetId exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => DOC_CONTENT,
    });

    const result = await ingestDoc(DOC_FILE, { credentials: CREDENTIALS });

    expect(result.action).toBe('created');
    expect(result.entry.linkedSpreadsheetId).toBe('new-sheet-id');
    expect(result.entry.lastIngestedAt).toBeDefined();
    expect(mockCreateSpreadsheet).toHaveBeenCalledTimes(1);
    expect(mockUpdateSpreadsheet).not.toHaveBeenCalled();
  });

  it('passes sourceLocale and targetLocales to createSpreadsheet', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => DOC_CONTENT });

    await ingestDoc(DOC_FILE, { targetLocales: ['de', 'fr'], credentials: CREDENTIALS });

    const [, options] = mockCreateSpreadsheet.mock.calls[0];
    expect(options.sourceLocale).toBe('en');
    expect(options.targetLocales).toEqual(['de', 'fr']);
  });

  it('falls back to "en" as sourceLocale when docFile has none', async () => {
    const docWithoutLocale: DriveDocFile = { ...DOC_FILE, sourceLocale: undefined };
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => DOC_CONTENT });

    const result = await ingestDoc(docWithoutLocale, { credentials: CREDENTIALS });

    expect(result.entry.sourceLocale).toBe('en');
  });

  it('skips when linkedSpreadsheetId exists and updateMode is create-only (default)', async () => {
    const existingEntry: DocManifestEntry = {
      id: 'doc-id-123',
      name: 'myapp_en',
      folderPath: '',
      generatedFromDoc: true,
      sourceLocale: 'en',
      lastIngestedAt: '2024-01-01T00:00:00.000Z',
      linkedSpreadsheetId: 'existing-sheet-id',
    };

    const result = await ingestDoc(DOC_FILE, { existingEntry });

    expect(result.action).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCreateSpreadsheet).not.toHaveBeenCalled();
  });

  it('refreshes when doc is newer than lastIngestedAt and updateMode is refresh-if-newer', async () => {
    const existingEntry: DocManifestEntry = {
      id: 'doc-id-123',
      name: 'myapp_en',
      folderPath: '',
      generatedFromDoc: true,
      sourceLocale: 'en',
      // lastIngestedAt is older than DOC_FILE.modifiedTime (2024-06-01)
      lastIngestedAt: '2024-01-01T00:00:00.000Z',
      linkedSpreadsheetId: 'existing-sheet-id',
    };

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => DOC_CONTENT });

    const result = await ingestDoc(DOC_FILE, {
      existingEntry,
      updateMode: 'refresh-if-newer',
      credentials: CREDENTIALS,
    });
    expect(result.entry.lastIngestedAt).toBeDefined();
    expect(mockUpdateSpreadsheet).toHaveBeenCalledTimes(1);
    expect(mockCreateSpreadsheet).not.toHaveBeenCalled();
  });

  it('skips refresh when doc is NOT newer than lastIngestedAt', async () => {
    const existingEntry: DocManifestEntry = {
      id: 'doc-id-123',
      name: 'myapp_en',
      folderPath: '',
      generatedFromDoc: true,
      sourceLocale: 'en',
      // lastIngestedAt is newer than DOC_FILE.modifiedTime (2024-06-01)
      lastIngestedAt: '2025-01-01T00:00:00.000Z',
      linkedSpreadsheetId: 'existing-sheet-id',
    };

    const result = await ingestDoc(DOC_FILE, {
      existingEntry,
      updateMode: 'refresh-if-newer',
    });

    expect(result.action).toBe('skipped');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('skips when exported doc produces no entries', async () => {
    // Doc with no headings or content that yields keys
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Only H1 no H2 here',
    });

    const result = await ingestDoc(DOC_FILE, { credentials: CREDENTIALS });

    expect(result.action).toBe('skipped');
    expect(mockCreateSpreadsheet).not.toHaveBeenCalled();
  });

  it('passes autoTranslate=false to updateSpreadsheet during refresh', async () => {
    const existingEntry: DocManifestEntry = {
      id: 'doc-id-123',
      name: 'myapp_en',
      folderPath: '',
      generatedFromDoc: true,
      sourceLocale: 'en',
      lastIngestedAt: '2024-01-01T00:00:00.000Z',
      linkedSpreadsheetId: 'existing-sheet-id',
    };

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => DOC_CONTENT });

    await ingestDoc(DOC_FILE, {
      existingEntry,
      updateMode: 'refresh-if-newer',
      credentials: CREDENTIALS,
    });

    // Third arg (autoTranslate) must be false — we don't want to wipe other locales
    const [, , , autoTranslate] = mockUpdateSpreadsheet.mock.calls[0];
    expect(autoTranslate).toBe(false);
  });

  it('preserves linkedSpreadsheetId in the returned entry after refresh', async () => {
    const existingEntry: DocManifestEntry = {
      id: 'doc-id-123',
      name: 'myapp_en',
      folderPath: '',
      generatedFromDoc: true,
      sourceLocale: 'en',
      lastIngestedAt: '2024-01-01T00:00:00.000Z',
      linkedSpreadsheetId: 'existing-sheet-id',
    };

    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => DOC_CONTENT });

    const result = await ingestDoc(DOC_FILE, {
      existingEntry,
      updateMode: 'refresh-if-newer',
      credentials: CREDENTIALS,
    });

    expect(result.entry.linkedSpreadsheetId).toBe('existing-sheet-id');
  });
});
