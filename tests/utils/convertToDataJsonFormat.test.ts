import { convertToDataJsonFormat } from '../../src/utils/dataConverter/convertToDataJsonFormat';
import type { TranslationData } from '../../src/types';

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
    expect(result[0].home).toHaveProperty('en');
    expect(result[0].home.en).toEqual({
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
    const homeSheet = result.find(item => 'home' in item);
    expect(homeSheet).toBeDefined();
    expect(homeSheet!.home).toHaveProperty('en');
    expect(homeSheet!.home).toHaveProperty('de');
    expect(homeSheet!.home.en).toEqual({
      'welcome': 'Welcome',
      'hello': 'Hello'
    });
    expect(homeSheet!.home.de).toEqual({
      'welcome': 'Willkommen',
      'hello': 'Hallo'
    });
    
    // Find the 'about' sheet result
    const aboutSheet = result.find(item => 'about' in item);
    expect(aboutSheet).toBeDefined();
    expect(aboutSheet!.about).toHaveProperty('en');
    expect(aboutSheet!.about.en).toEqual({
      'title': 'About us'
    });
    expect(aboutSheet!.about).not.toHaveProperty('de');
  });
  
  test('should handle case sensitivity correctly in locales', () => {
    const translationObj: TranslationData = {
      'EN': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const locales = ['en'];
    const result = convertToDataJsonFormat(translationObj, locales);
    
    expect(result).toHaveLength(1);
    // The locale should be lowercased in the output
    expect(result[0].home).toHaveProperty('en');
  });
  
  test('should skip empty sheets', () => {
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
    
    // The empty home sheet should be skipped
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('about');
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
    expect(result[0].home).toHaveProperty('en');
    expect(result[0].home).not.toHaveProperty('fr');
    expect(result[0].home).not.toHaveProperty('es');
  });
});
