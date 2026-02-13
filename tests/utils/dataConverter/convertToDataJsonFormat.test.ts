import { convertToDataJsonFormat } from '../../../src/utils/dataConverter/convertToDataJsonFormat';
import type { TranslationData } from '../../../src/types';

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
    expect(result[0]).toHaveProperty('home');
    
    // Type assertions to help TypeScript understand the structure
    const homeSheet = result[0] as { home: Record<string, Record<string, string>> };
    expect(homeSheet.home).toHaveProperty('en');
    expect(homeSheet.home.en).toEqual({
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
    
    // Type declaration for sheet objects
    type SheetResult = Record<string, Record<string, Record<string, string>>>;
    
    // Find the 'home' sheet result
    const homeSheet = result.find(item => 'home' in item) as SheetResult | undefined;
    expect(homeSheet).toBeDefined();
    
    // Safe way to check properties when we know homeSheet is defined
    if (homeSheet) {
      const homeData = homeSheet.home as Record<string, Record<string, string>>;
      expect(homeData).toHaveProperty('en');
      expect(homeData).toHaveProperty('de');
      expect(homeData.en).toEqual({
        'welcome': 'Welcome',
        'hello': 'Hello'
      });
      expect(homeData.de).toEqual({
        'welcome': 'Willkommen',
        'hello': 'Hallo'
      });
    }
    
    // Find the 'about' sheet result
    const aboutSheet = result.find(item => 'about' in item) as SheetResult | undefined;
    expect(aboutSheet).toBeDefined();
    
    // Safe way to check properties when we know aboutSheet is defined
    if (aboutSheet) {
      const aboutData = aboutSheet.about as Record<string, Record<string, string>>;
      expect(aboutData).toHaveProperty('en');
      expect(aboutData.en).toEqual({
        'title': 'About us'
      });
      expect(aboutData).not.toHaveProperty('de');
    }
  });
  
  test('should preserve locale case exactly as provided', () => {
    const translationObj: TranslationData = {
      // The translationObj keys should match the case passed in the locales array
      'en-GB': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    // The locale case should be preserved exactly
    const locales = ['en-GB'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    
    // Type assertion to help TypeScript understand the structure
    const homeSheet = result[0] as { home: Record<string, unknown> };
    // The locale should be exactly as provided, not lowercased
    expect(homeSheet.home).toHaveProperty('en-GB');
  });

  test('should handle normalized locales with mixed case (LANGUAGE_TO_COUNTRY_MAP format)', () => {
    const translationObj: TranslationData = {
      'en-GB': {
        'home': {
          'welcome': 'Welcome',
          'hello': 'Hello'
        },
        'about': {
          'title': 'About us'
        }
      },
      'de-DE': {
        'home': {
          'welcome': 'Willkommen',
          'hello': 'Hallo'
        }
      },
      'pl-PL': {
        'home': {
          'welcome': 'Witaj'
        }
      }
    };
    
    const locales = ['en-GB', 'de-DE', 'pl-PL'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    // Should have 2 entries (home and about sheets)
    expect(result).toHaveLength(2);
    
    // Find the 'home' sheet result
    const homeSheet = result.find(item => 'home' in item) as Record<string, Record<string, Record<string, string>>> | undefined;
    expect(homeSheet).toBeDefined();
    
    if (homeSheet) {
      const homeData = homeSheet.home;
      // Verify all locales are preserved with exact case
      expect(homeData).toHaveProperty('en-GB');
      expect(homeData).toHaveProperty('de-DE');
      expect(homeData).toHaveProperty('pl-PL');
      
      // Verify content
      expect(homeData['en-GB']).toEqual({
        'welcome': 'Welcome',
        'hello': 'Hello'
      });
      expect(homeData['de-DE']).toEqual({
        'welcome': 'Willkommen',
        'hello': 'Hallo'
      });
      expect(homeData['pl-PL']).toEqual({
        'welcome': 'Witaj'
      });
    }
    
    // Find the 'about' sheet result
    const aboutSheet = result.find(item => 'about' in item) as Record<string, Record<string, Record<string, string>>> | undefined;
    expect(aboutSheet).toBeDefined();
    
    if (aboutSheet) {
      const aboutData = aboutSheet.about;
      expect(aboutData).toHaveProperty('en-GB');
      expect(aboutData['en-GB']).toEqual({
        'title': 'About us'
      });
      // Should not have de-DE or pl-PL as they don't have 'about' translations
      expect(aboutData).not.toHaveProperty('de-DE');
      expect(aboutData).not.toHaveProperty('pl-PL');
    }
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
    
    // Both sheets should be included in the result
    expect(result).toHaveLength(2);
    
    // There should be both 'home' and 'about' sheets
    const homeSheet = result.find(item => 'home' in item);
    const aboutSheet = result.find(item => 'about' in item);
    
    expect(homeSheet).toBeDefined();
    expect(aboutSheet).toBeDefined();
    
    // TypeScript-friendly assertions
    if (homeSheet) {
      const homeData = homeSheet as { home: Record<string, unknown> };
      expect(homeData.home).toHaveProperty('en');
      expect(Object.keys(homeData.home.en as Record<string, unknown>)).toHaveLength(0);
    }
    
    if (aboutSheet) {
      const aboutData = aboutSheet as { about: Record<string, unknown> };
      expect(aboutData.about).toHaveProperty('en');
      expect((aboutData.about.en as Record<string, unknown>).title).toBe('About us');
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
    
    // Type assertion for the home sheet
    const homeData = (result[0] as { home: Record<string, unknown> }).home;
    expect(homeData).toHaveProperty('en');
    expect(homeData).not.toHaveProperty('fr');
    expect(homeData).not.toHaveProperty('es');
  });

  test('should handle normalized locale codes with mixed case (e.g., en-GB, pl-PL)', () => {
    // This test verifies the bug fix where translationObj has keys in normalized format
    // (e.g., "en-GB", "pl-PL") but the function was lowercasing the lookup key
    const translationObj: TranslationData = {
      'en-GB': {
        'home': {
          'welcome': 'Welcome',
          'hello': 'Hello'
        }
      },
      'pl-PL': {
        'home': {
          'welcome': 'Witaj',
          'hello': 'Cześć'
        }
      },
      'de-DE': {
        'home': {
          'welcome': 'Willkommen',
          'hello': 'Hallo'
        }
      }
    };
    
    const locales = ['en-GB', 'pl-PL', 'de-DE'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('home');
    
    // Type assertion for the home sheet
    const homeSheet = result[0] as { home: Record<string, Record<string, string>> };
    
    // The output should preserve the case from the locales array
    expect(homeSheet.home).toHaveProperty('en-GB');
    expect(homeSheet.home).toHaveProperty('pl-PL');
    expect(homeSheet.home).toHaveProperty('de-DE');
    
    // Verify the translations are correctly copied
    expect(homeSheet.home['en-GB']).toEqual({
      'welcome': 'Welcome',
      'hello': 'Hello'
    });
    expect(homeSheet.home['pl-PL']).toEqual({
      'welcome': 'Witaj',
      'hello': 'Cześć'
    });
    expect(homeSheet.home['de-DE']).toEqual({
      'welcome': 'Willkommen',
      'hello': 'Hallo'
    });
  });
});
