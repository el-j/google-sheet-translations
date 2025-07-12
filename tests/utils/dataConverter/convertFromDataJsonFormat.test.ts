import { convertFromDataJsonFormat } from '../../../src/utils/dataConverter/convertFromDataJsonFormat';
import type { TranslationData } from '../../../src/types';

describe('convertFromDataJsonFormat', () => {
  test('should convert empty languageData.json to empty translation data', () => {
    const dataJson: Record<string, unknown>[] = [];
    const result = convertFromDataJsonFormat(dataJson);
    expect(result).toEqual({});
  });

  test('should handle a single sheet with a single locale', () => {
    const dataJson = [
      {
        'home': {
          'en': {
            'welcome': 'Welcome',
            'hello': 'Hello'
          }
        }
      }
    ];
    
    const result = convertFromDataJsonFormat(dataJson);
    
    expect(result).toHaveProperty('en');
    expect(result.en).toHaveProperty('home');
    expect(result.en.home).toEqual({
      'welcome': 'Welcome',
      'hello': 'Hello'
    });
  });

  test('should handle multiple sheets with multiple locales', () => {
    const dataJson = [
      {
        'home': {
          'en': {
            'welcome': 'Welcome',
            'hello': 'Hello'
          },
          'de': {
            'welcome': 'Willkommen',
            'hello': 'Hallo'
          }
        }
      },
      {
        'about': {
          'en': {
            'title': 'About us'
          },
          'de': {
            'title': 'Über uns'
          }
        }
      }
    ];
    
    const result = convertFromDataJsonFormat(dataJson);
    
    // Check English translations
    expect(result).toHaveProperty('en');
    expect(result.en).toHaveProperty('home');
    expect(result.en).toHaveProperty('about');
    expect(result.en.home).toEqual({
      'welcome': 'Welcome',
      'hello': 'Hello'
    });
    expect(result.en.about).toEqual({
      'title': 'About us'
    });
    
    // Check German translations
    expect(result).toHaveProperty('de');
    expect(result.de).toHaveProperty('home');
    expect(result.de).toHaveProperty('about');
    expect(result.de.home).toEqual({
      'welcome': 'Willkommen',
      'hello': 'Hallo'
    });
    expect(result.de.about).toEqual({
      'title': 'Über uns'
    });
  });

  test('should handle complex translation values', () => {
    const dataJson = [
      {
        'home': {
          'en': {
            'welcome': 'Welcome',
            'count': 5,
            'enabled': true,
            'config': { 'showHeader': true }
          }
        }
      }
    ];
    
    const result = convertFromDataJsonFormat(dataJson);
    
    expect(result.en.home).toEqual({
      'welcome': 'Welcome',
      'count': 5,
      'enabled': true,
      'config': { 'showHeader': true }
    });
  });

  test('should handle empty sheets', () => {
    const dataJson = [
      {
        'home': {}
      }
    ];
    
    const result = convertFromDataJsonFormat(dataJson);
    expect(result).toEqual({});
  });
});
