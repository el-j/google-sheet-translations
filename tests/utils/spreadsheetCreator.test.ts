import { createSpreadsheet } from '../../src/utils/spreadsheetCreator';
import { GoogleSpreadsheet } from 'google-spreadsheet';

jest.mock('google-spreadsheet');
jest.mock('../../src/utils/rateLimiter', () => ({
  withRetry: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

describe('createSpreadsheet', () => {
  const mockAuthClient = {
    request: jest.fn().mockResolvedValue({
      data: { spreadsheetId: 'new-sheet-id-123' },
    }),
  };

  const mockWelcomeSheet = {
    loadCells: jest.fn().mockResolvedValue(undefined),
    getCell: jest.fn().mockReturnValue({ value: '' }),
    saveUpdatedCells: jest.fn().mockResolvedValue(undefined),
  };

  const mockI18nSheet = {
    setHeaderRow: jest.fn().mockResolvedValue(undefined),
    addRows: jest.fn().mockResolvedValue(undefined),
  };

  const mockDoc = {
    loadInfo: jest.fn().mockResolvedValue(undefined),
    sheetsByTitle: {
      '__welcome__': mockWelcomeSheet,
      'i18n': mockI18nSheet,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (GoogleSpreadsheet as unknown as jest.Mock).mockImplementation(() => mockDoc);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
