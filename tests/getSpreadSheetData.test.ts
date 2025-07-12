import { getSpreadSheetData } from '../src/getSpreadSheetData';
import { mock } from 'jest-mock-extended';
import type { GoogleSpreadsheet } from 'google-spreadsheet';
import { updateSpreadsheetWithLocalChanges } from '../src/utils/spreadsheetUpdater';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isDataJsonNewer } from '../src/utils/isDataJsonNewer';
import { readDataJson } from '../src/utils/readDataJson';
import { findLocalChanges } from '../src/utils/dataConverter/findLocalChanges';

// Mock dependencies
jest.mock('google-spreadsheet');
jest.mock('node:fs');
jest.mock('node:path');
jest.mock('../src/utils/wait', () => ({
  wait: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../src/utils/auth', () => ({
  createAuthClient: jest.fn().mockReturnValue({})
}));
jest.mock('../src/utils/validateEnv', () => ({
  validateEnv: jest.fn().mockReturnValue({
    GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
  })
}));
jest.mock('../src/utils/isDataJsonNewer', () => ({
  isDataJsonNewer: jest.fn().mockReturnValue(false)
}));
jest.mock('../src/utils/readDataJson', () => ({
  readDataJson: jest.fn().mockReturnValue(null)
}));
jest.mock('../src/utils/dataConverter/convertToDataJsonFormat', () => ({
  convertToDataJsonFormat: jest.fn().mockReturnValue([])
}));
jest.mock('../src/utils/dataConverter/findLocalChanges', () => ({
  findLocalChanges: jest.fn().mockReturnValue({})
}));
jest.mock('../src/utils/spreadsheetUpdater', () => ({
  updateSpreadsheetWithLocalChanges: jest.fn().mockResolvedValue(undefined)
}));

describe('getSpreadSheetData', () => {
  // Mock GoogleSpreadsheet
  const mockDoc = mock<GoogleSpreadsheet>();
  // Define mock sheet with proper typings for Jest mock functions
  const mockSheet = {
    getRows: jest.fn().mockResolvedValue([]),
    addRows: jest.fn().mockResolvedValue([])
  };
  // Define proper type for mock row to avoid TypeScript errors
  const mockRow = {
    toObject: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock implementations
    (mockDoc.loadInfo as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    // Use type assertion to deal with readonly property
    (mockDoc as unknown as Record<string, unknown>).sheetsByTitle = { 'home': mockSheet };
    
    // Make sure path.join includes 'translations' in one of its calls
    (path.join as jest.Mock).mockImplementation((...args) => {
      if (args.includes('translations')) {
        return '/mock/path/translations/en.json';
      }
      return args.join('/');
    });
    mockSheet.getRows.mockResolvedValue([mockRow]);
    mockRow.toObject.mockReturnValue({ 'key': 'welcome', 'en': 'Welcome', 'fr': 'Bienvenue' });
    
    // @ts-ignore - mock constructor
    require('google-spreadsheet').GoogleSpreadsheet.mockImplementation(() => mockDoc);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock filesystem methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'fr.json']);
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    
    // Mock path methods
    (path.dirname as jest.Mock).mockReturnValue('/mock/path');
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should fetch data from specified sheets', async () => {
    await getSpreadSheetData(['home']);
    
    expect(mockDoc.loadInfo).toHaveBeenCalled();
    expect(mockSheet.getRows).toHaveBeenCalled();
  });
  
  test('should use default options when none provided', async () => {
    // Mock fs.existsSync for translations directory check
    (fs.existsSync as jest.Mock).mockImplementation((path) => {
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
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await getSpreadSheetData(['home']);
    
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ recursive: true }));
  });

  test('should pass autoTranslate option to spreadsheetUpdater when local changes exist', async () => {
    // Mock the necessary values to trigger the spreadsheet update flow
    const mockLocalData = { en: { home: { welcome: 'Welcome' } } };
    (readDataJson as jest.Mock).mockReturnValue(mockLocalData);
    (isDataJsonNewer as jest.Mock).mockReturnValue(true);
    
    const mockChanges = {
      en: {
        home: {
          new_key: 'New Value'
        }
      }
    };
    (findLocalChanges as jest.Mock).mockReturnValue(mockChanges);
    
    // Call with autoTranslate = true
    await getSpreadSheetData(['home'], { autoTranslate: true });
    
    // Check that the function was called
    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalled();
    
    // Verify the arguments individually
    const mockFn = updateSpreadsheetWithLocalChanges as jest.Mock;
    const firstCall = mockFn.mock.calls[0];
    expect(firstCall[1]).toEqual(mockChanges); // changes
    expect(firstCall[3]).toBe(true); // autoTranslate
    
    // Reset and test with autoTranslate = false (default)
    jest.clearAllMocks();
    (readDataJson as jest.Mock).mockReturnValue(mockLocalData);
    (isDataJsonNewer as jest.Mock).mockReturnValue(true);
    (findLocalChanges as jest.Mock).mockReturnValue(mockChanges);
    
    await getSpreadSheetData(['home']);
    
    // Check that the function was called again
    expect(updateSpreadsheetWithLocalChanges).toHaveBeenCalled();
    
    // Verify the arguments individually for the second call
    const secondCall = (updateSpreadsheetWithLocalChanges as jest.Mock).mock.calls[0];
    expect(secondCall[1]).toEqual(mockChanges); // changes
    expect(secondCall[3]).toBe(false); // autoTranslate (default)
  });
});

// Add more focused integration tests if needed
