import { createSpreadsheet } from '../../src/utils/spreadsheetCreator';
import { GoogleSpreadsheet } from 'google-spreadsheet';

vi.mock('google-spreadsheet', () => ({ GoogleSpreadsheet: vi.fn() }));
vi.mock('../../src/utils/rateLimiter', () => ({
  withRetry: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

describe('createSpreadsheet', () => {
  const mockAuthClient = {
    request: vi.fn().mockResolvedValue({
      data: { spreadsheetId: 'new-sheet-id-123' },
    }),
  };

  const mockWelcomeSheet = {
    loadCells: vi.fn().mockResolvedValue(undefined),
    getCell: vi.fn().mockReturnValue({ value: '' }),
    saveUpdatedCells: vi.fn().mockResolvedValue(undefined),
  };

  const mockI18nSheet = {
    setHeaderRow: vi.fn().mockResolvedValue(undefined),
    addRows: vi.fn().mockResolvedValue(undefined),
  };

  const mockDoc = {
    loadInfo: vi.fn().mockResolvedValue(undefined),
    sheetsByTitle: {
      '__welcome__': mockWelcomeSheet,
      'i18n': mockI18nSheet,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (GoogleSpreadsheet as unknown as Mock).mockImplementation(class { constructor() { return mockDoc as any; } } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('creates a spreadsheet and returns id + url', async () => {
    const result = await createSpreadsheet(mockAuthClient as any);
    expect(result.spreadsheetId).toBe('new-sheet-id-123');
    expect(result.url).toContain('new-sheet-id-123');
  });

  test('calls the Sheets REST API to create the document', async () => {
    await createSpreadsheet(mockAuthClient as any, { title: 'My Translations' });
    expect(mockAuthClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://sheets.googleapis.com/v4/spreadsheets',
        method: 'POST',
        data: expect.objectContaining({
          properties: { title: 'My Translations' },
        }),
      }),
    );
  });

  test('populates i18n sheet with headers and GOOGLETRANSLATE formulas', async () => {
    await createSpreadsheet(mockAuthClient as any, {
      sourceLocale: 'en',
      targetLocales: ['de', 'fr'],
      seedKeys: { 'hello': 'Hello' },
    });
    expect(mockI18nSheet.setHeaderRow).toHaveBeenCalledWith(['key', 'en', 'de', 'fr']);
    expect(mockI18nSheet.addRows).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'hello',
          en: 'Hello',
          de: expect.stringContaining('=GOOGLETRANSLATE'),
          fr: expect.stringContaining('=GOOGLETRANSLATE'),
        }),
      ]),
    );
  });

  test('populates __welcome__ sheet with instructions', async () => {
    await createSpreadsheet(mockAuthClient as any);
    expect(mockWelcomeSheet.loadCells).toHaveBeenCalled();
    expect(mockWelcomeSheet.saveUpdatedCells).toHaveBeenCalled();
    expect(mockWelcomeSheet.getCell).toHaveBeenCalled();
  });
});
