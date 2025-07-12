import fs from 'node:fs';
import path from 'node:path';
import { isDataJsonNewer } from '../../src/utils/isDataJsonNewer';
import { getFileLastModified } from '../../src/utils/getFileLastModified';

// Mock the fs module and getFileLastModified
jest.mock('node:fs');
jest.mock('../../src/utils/getFileLastModified');

describe('isDataJsonNewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return false if languageData.json does not exist', () => {
    // Mock getFileLastModified to return null (file doesn't exist)
    (getFileLastModified as jest.Mock).mockReturnValue(null);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(getFileLastModified).toHaveBeenCalledWith('/path/to/languageData.json');
    expect(result).toBe(false);
  });

  test('should return true if there are no translation files', () => {
    // Mock getFileLastModified to return a date for languageData.json
    const dataJsonDate = new Date('2023-01-02T12:00:00Z');
    (getFileLastModified as jest.Mock).mockReturnValue(dataJsonDate);
    
    // Mock readdirSync to return an empty array (no translation files)
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(fs.readdirSync).toHaveBeenCalledWith('/path/to/translations');
    expect(result).toBe(true);
  });

  test('should return true if languageData.json is newer than all translation files', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-10T12:00:00Z'); // Newer date
    const translationDate1 = new Date('2023-01-01T12:00:00Z');
    const translationDate2 = new Date('2023-01-05T12:00:00Z');
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath === '/path/to/translations/en.json') return translationDate1;
      if (filePath === '/path/to/translations/fr.json') return translationDate2;
      return null;
    });
    
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'fr.json']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(result).toBe(true);
  });

  test('should return false if any translation file is newer than languageData.json', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-05T12:00:00Z');
    const translationDate1 = new Date('2023-01-01T12:00:00Z');
    const translationDate2 = new Date('2023-01-10T12:00:00Z'); // Newer than languageData.json
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath === '/path/to/translations/en.json') return translationDate1;
      if (filePath === '/path/to/translations/fr.json') return translationDate2;
      return null;
    });
    
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'fr.json']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(result).toBe(false);
  });

  test('should return false and log warning if an error occurs', () => {
    // Mock getFileLastModified to return a date for languageData.json
    (getFileLastModified as jest.Mock).mockReturnValue(new Date());
    
    // Mock readdirSync to throw an error
    (fs.readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Directory not found');
    });

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test('should filter only JSON files when checking translations', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-10T12:00:00Z');
    const translationDate = new Date('2023-01-01T12:00:00Z');
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath.endsWith('.json')) return translationDate;
      return null;
    });
    
    // Return a mix of JSON and non-JSON files
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'README.md', '.gitignore']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    // Should only check the JSON file
    expect(getFileLastModified).toHaveBeenCalledWith('/path/to/translations/en.json');
    expect(getFileLastModified).not.toHaveBeenCalledWith('/path/to/translations/README.md');
    expect(getFileLastModified).not.toHaveBeenCalledWith('/path/to/translations/.gitignore');
    expect(result).toBe(true);
  });
});

describe('isDataJsonNewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return false if languageData.json does not exist', () => {
    // Mock getFileLastModified to return null (file doesn't exist)
    (getFileLastModified as jest.Mock).mockReturnValue(null);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(getFileLastModified).toHaveBeenCalledWith('/path/to/languageData.json');
    expect(result).toBe(false);
  });

  test('should return true if there are no translation files', () => {
    // Mock getFileLastModified to return a date for languageData.json
    const dataJsonDate = new Date('2023-01-02T12:00:00Z');
    (getFileLastModified as jest.Mock).mockReturnValue(dataJsonDate);
    
    // Mock readdirSync to return an empty array (no translation files)
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(fs.readdirSync).toHaveBeenCalledWith('/path/to/translations');
    expect(result).toBe(true);
  });

  test('should return true if languageData.json is newer than all translation files', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-10T12:00:00Z'); // Newer date
    const translationDate1 = new Date('2023-01-01T12:00:00Z');
    const translationDate2 = new Date('2023-01-05T12:00:00Z');
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath === '/path/to/translations/en.json') return translationDate1;
      if (filePath === '/path/to/translations/fr.json') return translationDate2;
      return null;
    });
    
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'fr.json']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(result).toBe(true);
  });

  test('should return false if any translation file is newer than languageData.json', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-05T12:00:00Z');
    const translationDate1 = new Date('2023-01-01T12:00:00Z');
    const translationDate2 = new Date('2023-01-10T12:00:00Z'); // Newer than languageData.json
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath === '/path/to/translations/en.json') return translationDate1;
      if (filePath === '/path/to/translations/fr.json') return translationDate2;
      return null;
    });
    
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'fr.json']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(result).toBe(false);
  });

  test('should return false and log warning if an error occurs', () => {
    // Mock getFileLastModified to return a date for languageData.json
    (getFileLastModified as jest.Mock).mockReturnValue(new Date());
    
    // Mock readdirSync to throw an error
    (fs.readdirSync as jest.Mock).mockImplementation(() => {
      throw new Error('Directory not found');
    });

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test('should filter only JSON files when checking translations', () => {
    // Mock dates for comparison
    const dataJsonDate = new Date('2023-01-10T12:00:00Z');
    const translationDate = new Date('2023-01-01T12:00:00Z');
    
    // Setup mocks
    (getFileLastModified as jest.Mock).mockImplementation((filePath) => {
      if (filePath === '/path/to/languageData.json') return dataJsonDate;
      if (filePath.endsWith('.json')) return translationDate;
      return null;
    });
    
    // Return a mix of JSON and non-JSON files
    (fs.readdirSync as jest.Mock).mockReturnValue(['en.json', 'README.md', '.gitignore']);

    const result = isDataJsonNewer('/path/to/languageData.json', '/path/to/translations');
    
    // Should only check the JSON file
    expect(getFileLastModified).toHaveBeenCalledWith('/path/to/translations/en.json');
    expect(getFileLastModified).not.toHaveBeenCalledWith('/path/to/translations/README.md');
    expect(getFileLastModified).not.toHaveBeenCalledWith('/path/to/translations/.gitignore');
    expect(result).toBe(true);
  });
});
