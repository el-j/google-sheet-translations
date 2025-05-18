import { convertToDataJsonFormat } from '../../src/utils/dataConverter/convertToDataJsonFormat';
import type { TranslationData } from '../../src/types';

// Define more specific types for test assertions
interface SheetData {
  [sheetName: string]: {
    [locale: string]: {
      [key: string]: string;
    }
  }
}

// Mock console.log to avoid cluttering test output
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('convertToDataJsonFormat', () => {
  test('should convert empty translation data to empty array', () => {
    const translationObj: TranslationData = {};
    const locales: string[] = [];
    const result = convertToDataJsonFormat(translationObj, locales);
    expect(result).toEqual([]);
  });

  test('should handle a single locale and sheet', () => {
    const translationObj: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome',
          'hello': 'Hello'
        }
      }
    };
    const locales = ['en'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    
    // Type assertion to help TypeScript understand the structure
    const typedResult = result[0] as SheetData;
    expect(typedResult).toHaveProperty('home');
    expect(typedResult.home).toHaveProperty('en');
    expect(typedResult.home.en).toEqual({
      'welcome': 'Welcome',
      'hello': 'Hello'
    });
  });

  test('should handle multiple locales and sheets', () => {
    const translationObj: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome',
          'hello': 'Hello'
        },
        'about': {
          'title': 'About us'
        }
      },
      'de': {
        'home': {
          'welcome': 'Willkommen',
          'hello': 'Hallo'
        }
      }
    };
    
    const locales = ['en', 'de'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    // Should have 2 entries (one per sheet)
    expect(result).toHaveLength(2);
    
    // Find the 'home' sheet result
    const homeSheet = result.find(item => 'home' in item) as SheetData | undefined;
    expect(homeSheet).toBeDefined();
    if (homeSheet) {
      expect(homeSheet.home).toHaveProperty('en');
      expect(homeSheet.home).toHaveProperty('de');
      expect(homeSheet.home.en).toEqual({
        'welcome': 'Welcome',
        'hello': 'Hello'
      });
      expect(homeSheet.home.de).toEqual({
        'welcome': 'Willkommen',
        'hello': 'Hallo'
      });
    }
    
    // Find the 'about' sheet result
    const aboutSheet = result.find(item => 'about' in item) as SheetData | undefined;
    expect(aboutSheet).toBeDefined();
    if (aboutSheet) {
      expect(aboutSheet.about).toHaveProperty('en');
      expect(aboutSheet.about.en).toEqual({
        'title': 'About us'
      });
      expect(aboutSheet.about).not.toHaveProperty('de');
    }
  });
  
  test('should handle case sensitivity correctly in locales', () => {
    const translationObj: TranslationData = {
      'en': { // Note: Using lowercase 'en' to match what the code is looking for
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const locales = ['EN']; // Using uppercase in the locales array
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    // The locale should be lowercased in the output
    const typedResult = result[0] as SheetData;
    expect(typedResult.home).toHaveProperty('en');
  });
  
  test('should include empty sheets with empty objects', () => {
    const translationObj: TranslationData = {
      'en': {
        'home': {},
        'about': {
          'title': 'About us'
        }
      }
    };
    
    const locales = ['en'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    // Both sheets should be included (even empty ones have locale entries)
    expect(result).toHaveLength(2);
    
    // Find the 'home' sheet result (which should be empty)
    const homeSheet = result.find(item => 'home' in item) as SheetData | undefined;
    expect(homeSheet).toBeDefined();
    if (homeSheet) {
      expect(homeSheet.home).toHaveProperty('en');
      expect(Object.keys(homeSheet.home.en)).toHaveLength(0);
    }
    
    // Find the 'about' sheet
    const aboutSheet = result.find(item => 'about' in item) as SheetData | undefined;
    expect(aboutSheet).toBeDefined();
    if (aboutSheet) {
      expect(aboutSheet.about).toHaveProperty('en');
      expect(aboutSheet.about.en).toEqual({
        'title': 'About us'
      });
    }
  });

  test('should handle missing locales gracefully', () => {
    const translationObj: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const locales = ['en', 'fr', 'es'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    const typedResult = result[0] as SheetData;
    expect(typedResult.home).toHaveProperty('en');
    expect(typedResult.home).not.toHaveProperty('fr');
    expect(typedResult.home).not.toHaveProperty('es');
  });
});
