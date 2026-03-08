import { findLocalChanges } from '../../../src/utils/dataConverter/findLocalChanges';
import type { TranslationData } from '../../../src/types';

describe('findLocalChanges', () => {
  test('should return empty changes when local data is empty', () => {
    const localData: TranslationData = {};
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({});
  });

  test('should return empty changes when no new keys exist', () => {
    const localData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({});
  });

  test('should find new keys in an existing locale and sheet', () => {
    const localData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome',
          'newKey': 'New Key Value'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({
      'en': {
        'home': {
          'newKey': 'New Key Value'
        }
      }
    });
  });

  test('should find new keys in a new sheet for existing locale', () => {
    const localData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        },
        'about': {
          'title': 'About Us'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({
      'en': {
        'about': {
          'title': 'About Us'
        }
      }
    });
  });

  test('should find new keys in a new locale', () => {
    const localData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      },
      'fr': {
        'home': {
          'welcome': 'Bienvenue'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({
      'fr': {
        'home': {
          'welcome': 'Bienvenue'
        }
      }
    });
  });

  test('should handle complex scenarios with multiple new keys across locales and sheets', () => {
    const localData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome',
          'newHomeKey': 'New Home Key'
        },
        'about': {
          'title': 'About Us',
          'newAboutKey': 'New About Key'
        }
      },
      'fr': {
        'home': {
          'welcome': 'Bienvenue',
          'newHomeKey': 'Nouvelle Clé Accueil'
        }
      },
      'de': {
        'home': {
          'welcome': 'Willkommen'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({
      'en': {
        'home': {
          'newHomeKey': 'New Home Key'
        },
        'about': {
          'title': 'About Us',
          'newAboutKey': 'New About Key'
        }
      },
      'fr': {
        'home': {
          'welcome': 'Bienvenue',
          'newHomeKey': 'Nouvelle Clé Accueil'
        }
      },
      'de': {
        'home': {
          'welcome': 'Willkommen'
        }
      }
    });
  });

  test('should ignore empty sheets or locales in local data', () => {
    const localData: TranslationData = {
      'en': {
        'home': {}
      },
      '': {
        'about': {
          'title': 'About Us'
        }
      }
    };
    
    const spreadsheetData: TranslationData = {};
    
    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({
      '': {
        'about': {
          'title': 'About Us'
        }
      }
    });
  });

  // ── Locale alias / language-family resolution ──────────────────────────────

  test('locale alias: short code "en" treated as new when spreadsheet has "en-us"', () => {
    // 'en' in localData resolves to 'en-us' in spreadsheetData (language-family match),
    // but localData has the key 'nav_guide' which is absent from spreadsheetData['en-us'].
    // It should therefore appear in changes.
    const localData: TranslationData = {
      'en': { 'i18n': { 'nav_guide': 'Guide' } }
    };
    const spreadsheetData: TranslationData = {
      'en-us': { 'i18n': { 'en-us': 'English' } }
    };

    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({ 'en': { 'i18n': { 'nav_guide': 'Guide' } } });
  });

  test('locale alias: short code "en" does NOT report key as new when "en-us" already has it', () => {
    // 'en' resolves to 'en-us'; 'nav_guide' already exists → no change
    const localData: TranslationData = {
      'en': { 'i18n': { 'nav_guide': 'Guide' } }
    };
    const spreadsheetData: TranslationData = {
      'en-us': { 'i18n': { 'nav_guide': 'Guide', 'en-us': 'English' } }
    };

    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({});
  });

  test('locale alias: "en-GB" in localData resolves to "en-us" in spreadsheetData', () => {
    const localData: TranslationData = {
      'en-GB': { 'home': { 'title': 'Hello' } }
    };
    const spreadsheetData: TranslationData = {
      'en-us': { 'home': { 'title': 'Hello' } }
    };

    const result = findLocalChanges(localData, spreadsheetData);
    expect(result).toEqual({});
  });

  test('locale alias: short "de" resolves to "de-de" in spreadsheetData', () => {
    const localData: TranslationData = {
      'de': { 'home': { 'new_key': 'Neu' } }
    };
    const spreadsheetData: TranslationData = {
      'de-de': { 'home': { 'existing': 'Bestehend' } }
    };

    const result = findLocalChanges(localData, spreadsheetData);
    // 'new_key' is not in de-de/home → should be a change
    expect(result).toEqual({ 'de': { 'home': { 'new_key': 'Neu' } } });
  });
});
