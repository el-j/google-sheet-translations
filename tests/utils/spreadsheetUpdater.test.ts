import { mock } from 'jest-mock-extended';
import { updateSpreadsheetWithLocalChanges } from '../../src/utils/spreadsheetUpdater';
import type { GoogleSpreadsheet } from 'google-spreadsheet';
import type { TranslationData } from '../../src/types';

// Mock the rateLimiter to speed up tests
jest.mock('../../src/utils/rateLimiter', () => ({
  withRetry: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
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
    
    // Verify that a new row was added with GOOGLETRANSLATE formulas for missing languages.
    // The formula dynamically extracts the language code from the header cell using
    // IF(LOWER(LEFT(...))="zh-"...) with consistent separators.
    const addedRows = mockSheet.addRows.mock.calls[0][0];
    expect(addedRows).toHaveLength(1);
    const addedRow = addedRows[0];
    expect(addedRow['key']).toBe('new_key');
    expect(addedRow['en']).toBe('New Value');
    // Formulas must contain dynamic language-code extraction (IFERROR+FIND pattern)
    // and reference the correct source (B) and target (C/D) column letters
    expect(addedRow['fr']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("B"&ROW\(\)\)/);
    expect(addedRow['fr']).toContain('IFERROR');
    expect(addedRow['fr']).toContain('FIND("-"');
    expect(addedRow['fr']).toContain('C$1');
    expect(addedRow['de']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("B"&ROW\(\)\)/);
    expect(addedRow['de']).toContain('D$1');
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
    
    // Verify that new rows were added with correct GOOGLETRANSLATE formulas.
    // Formulas now embed the correct language codes directly.
    const addedRows = mockSheet.addRows.mock.calls[0][0];
    
    // First new key should translate from French (column C) to other languages
    const row1 = addedRows.find((r: Record<string, string>) => r['key'] === 'new_key1');
    expect(row1['fr']).toBe('Nouvelle Valeur');
    expect(row1['en']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("C"&ROW\(\)\)/);
    expect(row1['en']).toContain('B$1');
    expect(row1['de']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("C"&ROW\(\)\)/);
    expect(row1['de']).toContain('D$1');
    expect(row1['es']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("C"&ROW\(\)\)/);
    expect(row1['es']).toContain('E$1');
    
    // Second new key should translate from German (column D) to other languages
    const row2 = addedRows.find((r: Record<string, string>) => r['key'] === 'new_key2');
    expect(row2['de']).toBe('Neuer Wert');
    expect(row2['en']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("D"&ROW\(\)\)/);
    expect(row2['en']).toContain('B$1');
    expect(row2['fr']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("D"&ROW\(\)\)/);
    expect(row2['fr']).toContain('C$1');
    expect(row2['es']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("D"&ROW\(\)\)/);
    expect(row2['es']).toContain('E$1');
  });

  test('should generate GOOGLETRANSLATE formulas when source locale header is mixed-case', async () => {
    // Regression test: sourceHeader was looked up with headerRow.indexOf(sourceHeader)
    // but headerRow is fully lowercased, causing indexOf to return -1 for mixed-case
    // headers like 'en-GB' → the formula was silently skipped.
    mockRow.toObject.mockReturnValue({
      'key': 'existing_key',
      'en-GB': 'Existing Value',
      'de-DE': 'Bestehender Wert',
      'fr-FR': 'Valeur Existante',
    });

    const changes: TranslationData = {
      'en-GB': {
        'home': {
          'new_key': 'New Value',
        },
      },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    expect(addedRows).toHaveLength(1);
    const addedRow = addedRows[0];

    // English value should be present as the source (stored under original-case header)
    expect(addedRow['key']).toBe('new_key');
    expect(addedRow['en-GB']).toBe('New Value');

    // Both other locales must have GOOGLETRANSLATE formulas stored under original-case keys
    expect(addedRow['de-DE']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\(/);
    expect(addedRow['fr-FR']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\(/);
    // Must NOT be stored under lowercase keys
    expect(addedRow['de-de']).toBeUndefined();
    expect(addedRow['fr-fr']).toBeUndefined();
  });

  test('should skip formula generation for locales that already have a mixed-case key in rowData', async () => {
    // Regression test: rowData[localeHeader] used a direct key lookup but rowData keys
    // may be original-case (e.g. "en-GB") while localeHeader is lowercase ("en-gb"),
    // causing the check to always evaluate to falsy → formulas added for locales that
    // already have a value.
    mockRow.toObject.mockReturnValue({
      'key': 'existing_key',
      'en-GB': 'Existing Value',
      'de-DE': 'Bestehender Wert',
    });

    // Provide translations for BOTH locales — neither should get a GOOGLETRANSLATE formula
    const changes: TranslationData = {
      'en-GB': { 'home': { 'new_key': 'New Value' } },
      'de-DE': { 'home': { 'new_key': 'Neuer Wert' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    expect(addedRows).toHaveLength(1);
    const addedRow = addedRows[0];

    // Both locales have actual values — stored under original-case headers, no formulas
    expect(addedRow['en-GB']).toBe('New Value');
    expect(addedRow['de-DE']).toBe('Neuer Wert');
    expect(addedRow['en-GB']).not.toMatch(/^=GOOGLETRANSLATE/);
    expect(addedRow['de-DE']).not.toMatch(/^=GOOGLETRANSLATE/);
  });

  // ── Language-family locale fallback (regression for "only keys pushed, no translations") ──

  test('should write translation when locale is short code "en" but sheet header is "en-US"', async () => {
    // Regression: when languageData.json uses locale 'en' but the spreadsheet column is
    // 'en-US', getOriginalHeaderForLocale() previously returned undefined (no match),
    // causing the row to be added with only the key column and no translation value.
    mockRow.toObject.mockReturnValue({
      'key': 'existing_key',
      'en-US': 'Existing Value',
      'de-DE': 'Bestehender Wert',
    });

    const changes: TranslationData = {
      'en': {   // <── short locale code, spreadsheet header is 'en-US'
        'home': { 'nav_guide': 'Navigation Guide' }
      }
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false);

    // A new row must be added because 'nav_guide' is not in existingKeys
    expect(mockSheet.addRows).toHaveBeenCalled();
    const addedRow = mockSheet.addRows.mock.calls[0][0][0];

    expect(addedRow['key']).toBe('nav_guide');
    // The translation value must be present under the 'en-US' column header
    // (matched via language-family fallback: 'en' → 'en-us' prefix 'en' == 'en-us' prefix 'en')
    expect(addedRow['en-US']).toBe('Navigation Guide');
  });

  test('should update existing row translation when locale "en" resolves to "en-US" header', async () => {
    // Same locale-family scenario but key already exists in the sheet (update path)
    mockRow.toObject.mockReturnValue({
      'key': 'hero_title',
      'en-US': '',        // empty – should be updated
      'de-DE': 'Held Titel',
    });

    const changes: TranslationData = {
      'en': { 'home': { 'hero_title': 'Hero Title' } }
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false);

    // The existing row should be updated, not a new row added
    expect(mockRow.set).toHaveBeenCalledWith('en-US', 'Hero Title');
    expect(mockRow.save).toHaveBeenCalled();
    expect(mockSheet.addRows).not.toHaveBeenCalled();
  });

  // ── Auto-create missing sheet ─────────────────────────────────────────────

  test('should auto-create sheet when it does not exist and localeMapping is non-empty', async () => {
    // Simulates the scenario where 'ui' sheet does not yet exist in the spreadsheet
    // but localeMapping is available from the previously processed 'i18n' sheet.
    const mockNewSheet = {
      getRows: jest.fn().mockResolvedValue([]),  // newly created — no data rows
      addRows: jest.fn().mockResolvedValue([]),
    };
    (mockDoc as any).addSheet = jest.fn().mockResolvedValue(mockNewSheet);

    const changes: TranslationData = {
      'en-us': { 'ui': { 'nav_guide': 'Guide', 'nav_api': 'API' } },
    };
    const localeMapping: Record<string, string> = { 'en-us': 'en-US', 'de-de': 'de-DE' };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false, localeMapping);

    // The sheet should have been created with the locale headers
    expect((mockDoc as any).addSheet).toHaveBeenCalledWith({
      title: 'ui',
      headerValues: ['key', 'en-US', 'de-DE'],
    });

    // New keys should be added to the newly created sheet
    expect(mockNewSheet.addRows).toHaveBeenCalled();
    const addedRows: Record<string, string>[] = mockNewSheet.addRows.mock.calls[0][0];
    expect(addedRows).toContainEqual(expect.objectContaining({ key: 'nav_guide', 'en-US': 'Guide' }));
    expect(addedRows).toContainEqual(expect.objectContaining({ key: 'nav_api', 'en-US': 'API' }));
  });

  test('should warn when sheet does not exist and localeMapping is empty', async () => {
    // When no localeMapping is available, auto-creation is not possible
    const changes: TranslationData = {
      'en': { 'missing': { 'key1': 'Value' } },
    };

    // localeMapping defaults to {} — should still warn, not try to create
    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false, {});

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found in the document')
    );
  });

  test('should add new keys to an empty (newly created) sheet using localeMapping for headers', async () => {
    // The sheet exists but has 0 data rows (just created with headerValues)
    mockSheet.getRows.mockResolvedValueOnce([]);

    const changes: TranslationData = {
      'en-us': { 'home': { 'hello': 'Hello', 'bye': 'Goodbye' } },
    };
    const localeMapping: Record<string, string> = { 'en-us': 'en-US', 'de-de': 'de-DE' };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false, localeMapping);

    // No new sheet should be created (sheet 'home' already exists)
    expect((mockDoc as any).addSheet).not.toHaveBeenCalled();

    // Keys should be added using the reconstructed headers from localeMapping
    expect(mockSheet.addRows).toHaveBeenCalled();
    const addedRows: Record<string, string>[] = mockSheet.addRows.mock.calls[0][0];
    expect(addedRows).toContainEqual(expect.objectContaining({ key: 'hello', 'en-US': 'Hello' }));
    expect(addedRows).toContainEqual(expect.objectContaining({ key: 'bye', 'en-US': 'Goodbye' }));
  });

  // ── i18n sheet protection ─────────────────────────────────────────────────

  test('should never push keys to the reserved "i18n" metadata sheet', async () => {
    // The i18n sheet holds locale display names and must be excluded from all push operations.
    const changes: TranslationData = {
      'en': {
        'i18n': { 'en': 'English', 'de': 'German' },  // must be skipped
        'home': { 'welcome': 'Welcome' },               // must be processed normally
      },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false);

    // 'home' sheet is processed; 'i18n' sheet is skipped entirely
    expect(mockSheet.getRows).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Skipping reserved metadata sheet "i18n"')
    );
  });

  test('should ONLY skip i18n sheet, not other sheets with similar names', async () => {
    // Sheets named e.g. "i18nExtras" or "myI18n" should not be skipped
    const mockOtherSheet = {
      getRows: jest.fn().mockResolvedValue([]),
      addRows: jest.fn().mockResolvedValue([]),
    };
    (mockDoc as any).sheetsByTitle = {
      'home': mockSheet as any,
      'i18nExtras': mockOtherSheet as any,
    };
    const localeMapping: Record<string, string> = { 'en': 'en' };
    const changes: TranslationData = {
      'en': {
        'i18n': { 'en': 'English' },        // skipped
        'home': { 'welcome': 'Welcome' },    // processed
        'i18nExtras': { 'key1': 'Value' },   // processed (not the reserved sheet)
      },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false, localeMapping);

    expect(mockSheet.getRows).toHaveBeenCalledTimes(1);
    expect(mockOtherSheet.getRows).toHaveBeenCalledTimes(1);
  });

  // ── autoTranslate on existing keys ───────────────────────────────────────

  test('should add GOOGLETRANSLATE formulas to empty cells of existing key when autoTranslate=true', async () => {
    // Row exists: 'en' has a value, 'fr' and 'de' are empty
    mockRow.toObject.mockReturnValue({ key: 'hero_title', en: 'Hero Title', fr: '', de: '' });

    const changes: TranslationData = {
      en: { home: { hero_title: 'Hero Title Updated' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    // Source locale should be updated with the actual value
    expect(mockRow.set).toHaveBeenCalledWith('en', 'Hero Title Updated');
    // Empty columns should receive GOOGLETRANSLATE formulas
    expect(mockRow.set).toHaveBeenCalledWith('fr', expect.stringMatching(/^=GOOGLETRANSLATE\(INDIRECT\(/));
    expect(mockRow.set).toHaveBeenCalledWith('de', expect.stringMatching(/^=GOOGLETRANSLATE\(INDIRECT\(/));
    expect(mockRow.save).toHaveBeenCalled();
  });

  test('should NOT overwrite non-empty cells of existing key when autoTranslate=true and override=false', async () => {
    // Row exists: 'en' has a value, 'fr' has a translation, 'de' is empty
    mockRow.toObject.mockReturnValue({ key: 'nav_home', en: 'Home', fr: 'Accueil', de: '' });

    const changes: TranslationData = {
      en: { home: { nav_home: 'Home Updated' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true, {}, false);

    expect(mockRow.set).toHaveBeenCalledWith('en', 'Home Updated');
    // 'fr' already has a value and override=false → must NOT be overwritten with a formula
    const frCalls = (mockRow.set as jest.Mock).mock.calls.filter(([h]: [string]) => h === 'fr');
    expect(frCalls).toHaveLength(0);
    // 'de' is empty → should get a formula
    expect(mockRow.set).toHaveBeenCalledWith('de', expect.stringMatching(/^=GOOGLETRANSLATE\(INDIRECT\(/));
  });

  test('should overwrite non-empty cells of existing key when autoTranslate=true and override=true', async () => {
    // Row exists: all cells have values
    mockRow.toObject.mockReturnValue({ key: 'nav_home', en: 'Home', fr: 'Accueil', de: 'Startseite' });

    const changes: TranslationData = {
      en: { home: { nav_home: 'Home Revised' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true, {}, true);

    expect(mockRow.set).toHaveBeenCalledWith('en', 'Home Revised');
    // Both non-empty columns must be overwritten with formulas
    expect(mockRow.set).toHaveBeenCalledWith('fr', expect.stringMatching(/^=GOOGLETRANSLATE\(INDIRECT\(/));
    expect(mockRow.set).toHaveBeenCalledWith('de', expect.stringMatching(/^=GOOGLETRANSLATE\(INDIRECT\(/));
    expect(mockRow.save).toHaveBeenCalled();
  });

  test('should NOT add autoTranslate formulas to existing key when autoTranslate=false', async () => {
    mockRow.toObject.mockReturnValue({ key: 'cta', en: 'Click me', fr: '', de: '' });

    const changes: TranslationData = {
      en: { home: { cta: 'Click me now' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, false);

    expect(mockRow.set).toHaveBeenCalledWith('en', 'Click me now');
    // autoTranslate=false → other columns must not be touched
    const otherCalls = (mockRow.set as jest.Mock).mock.calls.filter(([h]: [string]) => h !== 'en');
    expect(otherCalls).toHaveLength(0);
  });

  test('should not add formula for a locale that is also being pushed in the same batch', async () => {
    // Both 'en' and 'fr' are being pushed for the same existing key.
    // When processing 'en', the auto-translate logic must NOT add a formula for 'fr'
    // because 'fr' will be set to an actual value in the same batch.
    const rowEn = { toObject: jest.fn(), set: jest.fn(), save: jest.fn() };
    rowEn.toObject.mockReturnValue({ key: 'title', en: 'Old', fr: '' });
    rowEn.save.mockResolvedValue(undefined);

    mockSheet.getRows.mockResolvedValueOnce([rowEn]);

    const changes: TranslationData = {
      en: { home: { title: 'Title EN' } },
      fr: { home: { title: 'Titre FR' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    // 'fr' should have been set with the actual value (from the 'fr' locale iteration),
    // not a GOOGLETRANSLATE formula (which would have come from the 'en' locale iteration).
    const frCalls = (rowEn.set as jest.Mock).mock.calls.filter(([h]: [string]) => h === 'fr');
    // All 'fr' calls must be actual string values, not GOOGLETRANSLATE formulas
    frCalls.forEach(([, val]: [string, string]) => {
      expect(val).not.toMatch(/^=GOOGLETRANSLATE/);
    });
    expect(rowEn.set).toHaveBeenCalledWith('fr', 'Titre FR');
  });

  // ── Language-prefix extraction in GOOGLETRANSLATE formula ────────────────

  test('should use dynamic language-code extraction in formula for region-qualified headers like tr-TR', async () => {
    // Regression: GOOGLETRANSLATE does not accept region-qualified codes like "tr-TR" –
    // only bare ISO 639-1 codes (e.g. "tr") work.  The formula dynamically extracts
    // the prefix from the header cell using IF(LOWER(LEFT(...))="zh-",...,IFERROR(LEFT(...),...))
    // with all separators matching the spreadsheet's locale.
    mockRow.toObject.mockReturnValue({
      key: 'existing',
      'en-US': 'Existing',
      'tr-TR': '',
    });

    const changes: TranslationData = {
      'en-US': { home: { new_key: 'Hello' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    expect(addedRows).toHaveLength(1);
    const addedRow = addedRows[0];

    expect(addedRow['en-US']).toBe('Hello');
    // The formula for tr-TR must contain dynamic extraction (IFERROR+FIND pattern)
    expect(addedRow['tr-TR']).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\(/);
    expect(addedRow['tr-TR']).toContain('IFERROR');
    expect(addedRow['tr-TR']).toContain('FIND("-"');
    // Must reference the header cell, NOT hard-code the language code
    expect(addedRow['tr-TR']).toContain('$1');
    // Must NOT use the old broken format with raw header cell references
    // (the old format was ;$B$1;C$1 without any extraction)
    expect(addedRow['tr-TR']).not.toMatch(/;\$B\$1;C\$1\)$/);
  });

  test('should use consistent semicolons for European-locale spreadsheets (default)', async () => {
    // When no locale is detected (mock doc has no _rawProperties), default to ";"
    mockRow.toObject.mockReturnValue({
      key: 'existing',
      en: 'Existing',
      de: '',
    });

    const changes: TranslationData = {
      en: { home: { new_key: 'Hello' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    const addedRow = addedRows[0];
    const formula = addedRow['de'];

    // All separators in the formula must be semicolons (European locale default)
    // The formula must NOT contain commas as argument separators
    expect(formula).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("B"&ROW\(\)\);/);
    // Inner IFERROR/LEFT/FIND must also use semicolons
    expect(formula).toContain('FIND("-";');
    expect(formula).toContain('IFERROR(LEFT(');
  });

  test('should use commas for English-locale spreadsheets', async () => {
    // Simulate an en_US locale spreadsheet
    (mockDoc as any)._rawProperties = { locale: 'en_US' };

    mockRow.toObject.mockReturnValue({
      key: 'existing',
      en: 'Existing',
      de: '',
    });

    const changes: TranslationData = {
      en: { home: { new_key: 'Hello' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    const addedRow = addedRows[0];
    const formula = addedRow['de'];

    // All separators must be commas for English locale
    expect(formula).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("B"&ROW\(\)\),/);
    // Inner IFERROR/LEFT/FIND must also use commas
    expect(formula).toContain('FIND("-",');
    expect(formula).toContain('IFERROR(LEFT(');

    // Clean up
    delete (mockDoc as any)._rawProperties;
  });

  test('should preserve zh-TW in formula via IF(LOWER(LEFT(...))="zh-"...) guard', async () => {
    mockRow.toObject.mockReturnValue({
      key: 'existing',
      en: 'Existing',
      'zh-TW': '',
    });

    const changes: TranslationData = {
      en: { home: { new_key: 'Hello' } },
    };

    await updateSpreadsheetWithLocalChanges(mockDoc, changes, 0, true);

    const addedRows = mockSheet.addRows.mock.calls[0][0];
    const addedRow = addedRows[0];
    const formula = addedRow['zh-TW'];

    // The formula must contain the zh- guard to preserve Chinese variant codes
    expect(formula).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\(/);
    expect(formula).toContain('="zh-"');
    // The guard ensures zh-TW → "zh-tw" (full) rather than just "zh"
    expect(formula).toContain('LOWER(');
  });
});
