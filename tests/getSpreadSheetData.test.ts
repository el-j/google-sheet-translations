import { getSpreadSheetData } from '../src/getSpreadSheetData';
import { mock } from 'vitest-mock-extended';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { updateSpreadsheetWithLocalChanges } from '../src/utils/spreadsheetUpdater';
import { createAuthClient } from '../src/utils/auth';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isDataJsonNewer } from '../src/utils/isDataJsonNewer';
import { readDataJson } from '../src/utils/readDataJson';
import { findLocalChanges } from '../src/utils/dataConverter/findLocalChanges';

// Mock dependencies
vi.mock('google-spreadsheet');
vi.mock('node:fs');
vi.mock('node:path');
vi.mock('../src/utils/rateLimiter', () => ({
  withRetry: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));
vi.mock('../src/utils/auth', () => ({
  createAuthClient: vi.fn().mockReturnValue({})
}));
vi.mock('../src/utils/validateEnv', () => ({
  validateEnv: vi.fn().mockReturnValue({
    GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
  })
}));
vi.mock('../src/utils/isDataJsonNewer', () => ({
  isDataJsonNewer: vi.fn().mockReturnValue(false)
}));
vi.mock('../src/utils/readDataJson', () => ({
  readDataJson: vi.fn().mockReturnValue(null)
}));
vi.mock('../src/utils/dataConverter/convertToDataJsonFormat', () => ({
  convertToDataJsonFormat: vi.fn().mockReturnValue([])
}));
vi.mock('../src/utils/dataConverter/findLocalChanges', () => ({
  findLocalChanges: vi.fn().mockReturnValue({})
}));
vi.mock('../src/utils/spreadsheetUpdater', () => ({
  updateSpreadsheetWithLocalChanges: vi.fn().mockResolvedValue(undefined)
}));

describe('getSpreadSheetData', () => {
  // Mock GoogleSpreadsheet
  const mockDoc = mock<GoogleSpreadsheet>();
  // Define mock sheet with proper typings for Jest mock functions
  const mockSheet = {
    getRows: vi.fn().mockResolvedValue([]),
    addRows: vi.fn().mockResolvedValue([])
  };
  // Define proper type for mock row to avoid TypeScript errors
  const mockRow = {
    toObject: vi.fn()
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SPREADSHEET_ID = 'test-spreadsheet-id';
    (mockDoc.loadInfo as Mock) = vi.fn().mockResolvedValue(undefined);
    // Use type assertion to deal with readonly property
    (mockDoc as unknown as Record<string, unknown>).sheetsByTitle = { 'home': mockSheet };
    
    // Make sure path.join includes 'translations' in one of its calls
    (path.join as Mock).mockImplementation((...args) => {
      if (args.includes('translations')) {
        return '/mock/path/translations/en.json';
      }
      return args.join('/');
    });
    mockSheet.getRows.mockResolvedValue([mockRow]);
    mockRow.toObject.mockReturnValue({ 'key': 'welcome', 'en': 'Welcome', 'fr': 'Bienvenue' });
    
    // @ts-ignore - mock constructor
    vi.mocked(GoogleSpreadsheet).mockImplementation(class { constructor() { return mockDoc as any; } } as any);
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock filesystem methods
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.statSync as Mock).mockReturnValue({ mtime: new Date() });
    (fs.readdirSync as Mock).mockReturnValue(['en.json', 'fr.json']);
    (fs.readFileSync as Mock).mockReturnValue('{}');
    (fs.writeFileSync as Mock).mockReturnValue(undefined);
    (fs.mkdirSync as Mock).mockReturnValue(undefined);
    
    // Mock path methods
    (path.dirname as Mock).mockReturnValue('/mock/path');
    (path.join as Mock).mockImplementation((...args) => args.join('/'));
  });
  
  afterEach(() => {
    delete process.env.GOOGLE_SPREADSHEET_ID;
    vi.restoreAllMocks();
  });

  test('should fetch data from specified sheets', async () => {
    await getSpreadSheetData(['home']);
    
    expect(mockDoc.loadInfo).toHaveBeenCalled();
    expect(mockSheet.getRows).toHaveBeenCalled();
  });
  
  test('should use default options when none provided', async () => {
    // Mock fs.existsSync for translations directory check
    (fs.existsSync as Mock).mockImplementation((path) => {
      return path.includes('translations');
    });
    
    await getSpreadSheetData(['home']);
    
    // Check paths are using defaults
    expect(path.join).toHaveBeenCalledWith(expect.anything(), 'src/lib/languageData.json');
    // Instead of checking for path.join with translations, check for mkdir call
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  test('should use custom options when provided', async () => {
    await getSpreadSheetData(['home'], {
      dataJsonPath: '/custom/languageData.json',
      translationsOutputDir: '/custom/translations',
      localesOutputPath: '/custom/locales.ts',
      waitSeconds: 2
    });
    
    // Paths should use custom locations
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('/custom/locales.ts'),
      expect.any(String),
      expect.any(String)
    );
  });

  test('should handle empty sheet titles array', async () => {
    const result = await getSpreadSheetData([]);
    
    expect(result).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No sheet titles provided'));
  });

  test('should warn when sheet is not found', async () => {
    // Use type assertion to handle readonly property
    (mockDoc as unknown as Record<string, unknown>).sheetsByTitle = {};
    
    await getSpreadSheetData(['nonexistent']);
    
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not found in the document'));
  });

  test('should warn when no rows found in sheet', async () => {
    mockSheet.getRows.mockResolvedValueOnce([]);
    
    await getSpreadSheetData(['home']);
    
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No rows found in sheet'));
  });

  test('should create output directories if they do not exist', async () => {
    (fs.existsSync as Mock).mockReturnValue(false);
    
    await getSpreadSheetData(['home']);
    
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ recursive: true }));
  });

  test('should pass autoTranslate option to spreadsheetUpdater when local changes exist', async () => {
    // Mock the necessary values to trigger the spreadsheet update flow
    const mockLocalData = { en: { home: { welcome: 'Welcome' } } };
    (readDataJson as Mock).mockReturnValue(mockLocalData);
    (isDataJsonNewer as Mock).mockReturnValue(true);
    
    const mockChanges = {
      en: {
        home: {
          new_key: 'New Value'
        }
      }
    };
    (findLocalChanges as Mock).mockReturnValue(mockChanges);
    
    // Call with autoTranslate = true
    await getSpreadSheetData(['home'], { autoTranslate: true });
    
    // Check that the function was called
    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalled();
    
    // Verify the arguments individually
    const mockFn = updateSpreadsheetWithLocalChanges as Mock;
    const firstCall = mockFn.mock.calls[0];
    expect(firstCall[1]).toEqual(mockChanges); // changes
    expect(firstCall[3]).toBe(true); // autoTranslate
    
    // Reset and test with autoTranslate = false (default)
    vi.clearAllMocks();
    (readDataJson as Mock).mockReturnValue(mockLocalData);
    (isDataJsonNewer as Mock).mockReturnValue(true);
    (findLocalChanges as Mock).mockReturnValue(mockChanges);
    
    await getSpreadSheetData(['home']);
    
    // Check that the function was called again
    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalled();
    
    // Verify the arguments individually for the second call
    const secondCall = (updateSpreadsheetWithLocalChanges as Mock).mock.calls[0];
    expect(secondCall[1]).toEqual(mockChanges); // changes
    expect(secondCall[3]).toBe(false); // autoTranslate (default)
  });
});

// ---------------------------------------------------------------------------
// Public sheet path tests
// ---------------------------------------------------------------------------

vi.mock('../src/utils/publicSheetReader', () => ({
  readPublicSheet: vi.fn(),
}));

import { readPublicSheet } from '../src/utils/publicSheetReader';

describe('getSpreadSheetData (publicSheet mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fs / path mocks that are already mocked at module level above
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.statSync as Mock).mockReturnValue({ mtime: new Date() });
    (fs.readdirSync as Mock).mockReturnValue([]);
    (fs.readFileSync as Mock).mockReturnValue('{}');
    (fs.writeFileSync as Mock).mockReturnValue(undefined);
    (fs.mkdirSync as Mock).mockReturnValue(undefined);

    (path.join as Mock).mockImplementation((...args: string[]) => args.join('/'));
    (path.dirname as Mock).mockReturnValue('/mock/path');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('uses readPublicSheet instead of the authenticated path when publicSheet=true', async () => {
    (readPublicSheet as Mock).mockResolvedValue([
      { key: 'welcome', en: 'Welcome', de: 'Willkommen' },
    ]);

    await getSpreadSheetData(['home'], {
      spreadsheetId: 'PUBLIC_SHEET_ID',
      publicSheet: true,
    });

    expect(readPublicSheet).toHaveBeenCalled();
    // createAuthClient / GoogleSpreadsheet should NOT be called
    expect(createAuthClient).not.toHaveBeenCalled();
  });

  test('uses spreadsheetId from options instead of env var', async () => {
    (readPublicSheet as Mock).mockResolvedValue([]);

    await getSpreadSheetData(['home'], {
      spreadsheetId: 'OPTION_SHEET_ID',
      publicSheet: true,
    });

    expect(readPublicSheet).toHaveBeenCalledWith('OPTION_SHEET_ID', expect.any(String));
  });

  test('warns and continues when a sheet cannot be fetched in public mode', async () => {
    (readPublicSheet as Mock).mockRejectedValue(new Error('Not public'));

    const result = await getSpreadSheetData(['home'], {
      spreadsheetId: 'PUBLIC_SHEET_ID',
      publicSheet: true,
    });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('could not be fetched'));
    expect(result).toEqual({});
  });

  test('throws when no spreadsheetId is available in public mode', async () => {
    // Remove the env var for this test
    const original = process.env.GOOGLE_SPREADSHEET_ID;
    delete process.env.GOOGLE_SPREADSHEET_ID;

    await expect(
      getSpreadSheetData(['home'], { publicSheet: true }),
    ).rejects.toThrow(/No spreadsheet ID provided/);

    process.env.GOOGLE_SPREADSHEET_ID = original;
  });
});
