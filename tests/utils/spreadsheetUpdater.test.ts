import { mock } from 'jest-mock-extended';
import { updateSpreadsheetWithLocalChanges } from '../../src/utils/spreadsheetUpdater';
import type { GoogleSpreadsheet } from 'google-spreadsheet';
import type { TranslationData } from '../../src/types';

// Mock the wait function to speed up tests
jest.mock('../../src/utils/wait', () => ({
  wait: jest.fn().mockResolvedValue(undefined)
}));

describe('updateSpreadsheetWithLocalChanges', () => {
  // Create mock objects
  const mockSheet = {
    getRows: jest.fn(),
    addRows: jest.fn()
  };
  
  const mockRow = {
    toObject: jest.fn(),
    set: jest.fn(),
    save: jest.fn()
  };

  // Create mock document
  const mockDoc = mock<GoogleSpreadsheet>();
  // Will set sheetsByTitle in beforeEach

  beforeEach(() => {
    jest.clearAllMocks();
    // Use type assertion to handle readonly property
    (mockDoc as any).sheetsByTitle = { 'home': mockSheet as any };
    
    // Default mock implementations
    mockSheet.getRows.mockResolvedValue([mockRow]);
    mockRow.toObject.mockReturnValue({ 'key': 'welcome', 'en': 'Welcome', 'fr': 'Bienvenue' });
    mockRow.save.mockResolvedValue(undefined);
    mockSheet.addRows.mockResolvedValue([]);
    
    // Spy on console.log and console.warn
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Log mock row object to help debug
    console.log('Mock row object in beforeEach:', mockRow.toObject());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should do nothing when changes object is empty', async () => {
    const changes: TranslationData = {};
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    expect(mockSheet.getRows).not.toHaveBeenCalled();
    expect(mockSheet.addRows).not.toHaveBeenCalled();
  });

  test('should warn when sheet does not exist', async () => {
    const changes: TranslationData = {
      'en': {
        'nonexistent': {
          'welcome': 'Welcome'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found in the document')
    );
  });

  test('should warn when no rows exist in the sheet', async () => {
    mockSheet.getRows.mockResolvedValueOnce([]);
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Welcome'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('No rows found in sheet')
    );
  });

  test('should update an existing key with new translation', async () => {
    // Set up the mock to simulate an existing key
    mockRow.toObject.mockReturnValue({ 'key': 'welcome', 'en': 'Old Welcome' });
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'welcome': 'New Welcome'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    // The key already exists, so we should update it
    expect(mockRow.set).toHaveBeenCalledWith('en', 'New Welcome');
    expect(mockRow.save).toHaveBeenCalled();
    
    // No new rows should be added
    expect(mockSheet.addRows).not.toHaveBeenCalled();
  });

  test('should add a new key when it does not exist', async () => {
    // Set up the mock to simulate that the key doesn't exist
    mockRow.toObject.mockReturnValue({ 'key': 'existing_key', 'en': 'Existing Value' });
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'new_key': 'New Value'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    // A new row should be added since the key doesn't exist
    expect(mockSheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({ 'key': 'new_key', 'en': 'New Value' })
    ]);
  });

  test('should handle multiple locales and keys', async () => {
    // Set up the mock to simulate some existing keys
    const rows = [
      { toObject: jest.fn().mockReturnValue({ 'key': 'welcome', 'en': 'Welcome', 'fr': 'Bienvenue' }), set: jest.fn(), save: jest.fn() },
      { toObject: jest.fn().mockReturnValue({ 'key': 'goodbye', 'en': 'Goodbye', 'fr': 'Au revoir' }), set: jest.fn(), save: jest.fn() }
    ];
    mockSheet.getRows.mockResolvedValueOnce(rows);
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'welcome': 'Updated Welcome',
          'new_key': 'New Key'
        }
      },
      'fr': {
        'home': {
          'goodbye': 'Nouveau Au revoir',
          'new_key': 'Nouvelle Clé'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    // Should update the existing keys
    expect(rows[0].set).toHaveBeenCalledWith('en', 'Updated Welcome');
    expect(rows[1].set).toHaveBeenCalledWith('fr', 'Nouveau Au revoir');
    
    // Should add a new row for the new key with both EN and FR values
    expect(mockSheet.addRows).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ 
        'key': 'new_key',
        'en': 'New Key',
        'fr': 'Nouvelle Clé'
      })
    ]));
  });
  
  test('should process multiple sheets', async () => {
    // Add another mock sheet
    const mockAboutSheet = {
      getRows: jest.fn().mockResolvedValue([mockRow]),
      addRows: jest.fn()
    };
    // Use type assertion to deal with readonly property
    (mockDoc as any).sheetsByTitle = { 
      'home': mockSheet as any,
      'about': mockAboutSheet as any 
    };
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'new_key': 'New Home Key'
        },
        'about': {
          'new_key': 'New About Key'
        }
      }
    };
    
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    // Both sheets should be processed
    expect(mockSheet.getRows).toHaveBeenCalled();
    expect(mockAboutSheet.getRows).toHaveBeenCalled();
    expect(mockSheet.addRows).toHaveBeenCalled();
    expect(mockAboutSheet.addRows).toHaveBeenCalled();
  });

  test('should add auto-translation formulas when enabled', async () => {
    // Set up the mock with multiple language columns
    mockRow.toObject.mockReturnValue({ 'key': 'existing_key', 'en': 'Existing Value', 'fr': 'Valeur Existante', 'de': 'Vorhandener Wert' });
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'new_key': 'New Value'
        }
      }
    };
    
    // Call with autoTranslate = true
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);
    
    // Verify that a new row was added with GOOGLETRANSLATE formulas for missing languages
    expect(mockSheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({
        'key': 'new_key',
        'en': 'New Value',
        'fr': expect.stringMatching(/^=GOOGLETRANSLATE\(B\d+; "en"; "fr"\)$/),
        'de': expect.stringMatching(/^=GOOGLETRANSLATE\(B\d+; "en"; "de"\)$/)
      })
    ]);
  });

  test('should not add auto-translation formulas when disabled', async () => {
    // Set up the mock with multiple language columns
    mockRow.toObject.mockReturnValue({ 'key': 'existing_key', 'en': 'Existing Value', 'fr': 'Valeur Existante', 'de': 'Vorhandener Wert' });
    
    const changes: TranslationData = {
      'en': {
        'home': {
          'new_key': 'New Value'
        }
      }
    };
    
    // Call with default autoTranslate = false
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0);
    
    // Verify that a new row was added without GOOGLETRANSLATE formulas
    expect(mockSheet.addRows).toHaveBeenCalledWith([
      expect.objectContaining({
        'key': 'new_key',
        'en': 'New Value'
      })
    ]);
    
    // Check that the formula fields were not added
    const addedRow = mockSheet.addRows.mock.calls[0][0][0];
    expect(addedRow.fr).toBeUndefined();
    expect(addedRow.de).toBeUndefined();
  });

  test('should handle complex auto-translation scenarios with multiple source languages', async () => {
    // Set up the mock with multiple language columns
    mockRow.toObject.mockReturnValue({ 'key': 'existing_key', 'en': 'Existing Value', 'fr': 'Valeur Existante', 'de': 'Vorhandener Wert', 'es': 'Valor Existente' });
    
    const changes: TranslationData = {
      'fr': {
        'home': {
          'new_key1': 'Nouvelle Valeur'
        }
      },
      'de': {
        'home': {
          'new_key2': 'Neuer Wert'
        }
      }
    };
    
    // Call with autoTranslate = true
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);
    
    // Verify that new rows were added with correct GOOGLETRANSLATE formulas
    const addedRows = mockSheet.addRows.mock.calls[0][0];
    
    // First new key should translate from French to other languages
    expect(addedRows).toContainEqual(
      expect.objectContaining({
        'key': 'new_key1',
        'fr': 'Nouvelle Valeur',
        'en': expect.stringMatching(/^=GOOGLETRANSLATE\(C\d+; "fr"; "en"\)$/),
        'de': expect.stringMatching(/^=GOOGLETRANSLATE\(C\d+; "fr"; "de"\)$/),
        'es': expect.stringMatching(/^=GOOGLETRANSLATE\(C\d+; "fr"; "es"\)$/)
      })
    );
    
    // Second new key should translate from German to other languages
    expect(addedRows).toContainEqual(
      expect.objectContaining({
        'key': 'new_key2',
        'de': 'Neuer Wert',
        'en': expect.stringMatching(/^=GOOGLETRANSLATE\(D\d+; "de"; "en"\)$/),
        'fr': expect.stringMatching(/^=GOOGLETRANSLATE\(D\d+; "de"; "fr"\)$/),
        'es': expect.stringMatching(/^=GOOGLETRANSLATE\(D\d+; "de"; "es"\)$/)
      })
    );
  });
});
