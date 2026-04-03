import { getSpreadSheetData } from '../src/getSpreadSheetData';
import { mock } from 'vitest-mock-extended';
import { GoogleSpreadsheet } from 'google-spreadsheet';

import * as fs from 'node:fs';
import * as path from 'node:path';

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
  __esModule: true,
  default: vi.fn().mockResolvedValue(undefined)
}));

describe('getSpreadSheetData', () => {
  // Mock GoogleSpreadsheet
  const mockDoc = mock<GoogleSpreadsheet>();
  const mockSheet = {
    getRows: vi.fn(),
    addRows: vi.fn()
  } as unknown as any;
  const mockRow = {
    toObject: vi.fn()
  } as unknown as any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SPREADSHEET_ID = 'test-spreadsheet-id';
    // Set up mock implementations
    (mockDoc.loadInfo as Mock) = vi.fn().mockResolvedValue(undefined);
    // Use type assertion to deal with readonly property
    (mockDoc as any).sheetsByTitle = { 'home': mockSheet };
    
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
    (mockDoc as any).sheetsByTitle = {};
    
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
});

// Add more focused integration tests if needed
