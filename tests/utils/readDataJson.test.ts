import fs from 'node:fs';
import { readDataJson } from '../../src/utils/readDataJson';
import { convertFromDataJsonFormat } from '../../src/utils/dataConverter/convertFromDataJsonFormat';

// Mock fs and convertFromDataJsonFormat
jest.mock('node:fs');
jest.mock('../../src/utils/dataConverter/convertFromDataJsonFormat');

describe('readDataJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return null if languageData.json does not exist', () => {
    // Mock existsSync to return false (file doesn't exist)
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = readDataJson('/path/to/languageData.json');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/languageData.json');
    expect(result).toBeNull();
  });

  test('should read and parse languageData.json successfully', () => {
    // Mock file existence and content
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    const mockData = [
      { home: { en: { welcome: 'Welcome' } } },
      { about: { en: { title: 'About Us' } } }
    ];
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));

    // Mock conversion result
    const mockConversionResult = {
      en: {
        home: { welcome: 'Welcome' },
        about: { title: 'About Us' }
      }
    };
    (convertFromDataJsonFormat as jest.Mock).mockReturnValue(mockConversionResult);

    const result = readDataJson('/path/to/languageData.json');
    
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/languageData.json', 'utf8');
    expect(convertFromDataJsonFormat).toHaveBeenCalledWith(mockData);
    expect(result).toEqual(mockConversionResult);
  });

  test('should return null and log warning if JSON parsing fails', () => {
    // Mock file existence but with invalid JSON content
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('Invalid JSON');

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should return null and log warning if file reading fails', () => {
    // Mock file existence but readFileSync throws error
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should return null and log warning if conversion fails', () => {
    // Mock successful file read but conversion failure
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('[]');
    
    // Mock conversion throwing an error
    (convertFromDataJsonFormat as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid format');
    });

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe('readDataJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return null if languageData.json does not exist', () => {
    // Mock existsSync to return false (file doesn't exist)
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = readDataJson('/path/to/languageData.json');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/languageData.json');
    expect(result).toBeNull();
  });

  test('should read and parse languageData.json successfully', () => {
    // Mock file existence and content
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    const mockData = [
      { home: { en: { welcome: 'Welcome' } } },
      { about: { en: { title: 'About Us' } } }
    ];
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));

    // Mock conversion result
    const mockConversionResult = {
      en: {
        home: { welcome: 'Welcome' },
        about: { title: 'About Us' }
      }
    };
    (convertFromDataJsonFormat as jest.Mock).mockReturnValue(mockConversionResult);

    const result = readDataJson('/path/to/languageData.json');
    
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/languageData.json', 'utf8');
    expect(convertFromDataJsonFormat).toHaveBeenCalledWith(mockData);
    expect(result).toEqual(mockConversionResult);
  });

  test('should return null and log warning if JSON parsing fails', () => {
    // Mock file existence but with invalid JSON content
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('Invalid JSON');

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should return null and log warning if file reading fails', () => {
    // Mock file existence but readFileSync throws error
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should return null and log warning if conversion fails', () => {
    // Mock successful file read but conversion failure
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('[]');
    
    // Mock conversion throwing an error
    (convertFromDataJsonFormat as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid format');
    });

    const result = readDataJson('/path/to/languageData.json');
    
    expect(console.warn).toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
