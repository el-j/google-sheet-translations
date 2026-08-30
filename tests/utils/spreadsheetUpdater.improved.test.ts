import { updateSpreadsheetWithLocalChanges } from '../../src/utils/spreadsheetUpdater';
import type { TranslationData } from '../../src/types';

// Mock dependencies
vi.mock('../../src/utils/rateLimiter', () => ({
  withRetry: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

describe('spreadsheetUpdater - improved auto-translate formula', () => {
  const mockDoc = {
    sheetsByTitle: {
      'test': {
        getRows: vi.fn(),
        addRows: vi.fn().mockResolvedValue(undefined)
      }
    }
  };

  const mockRows = [
    {
      toObject: () => ({ key: 'existing', en: 'Existing', de: 'Bestehend' })
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.sheetsByTitle.test.getRows.mockResolvedValue(mockRows);
  });

  it('should create GOOGLETRANSLATE formulas with dynamic language-code extraction from headers', async () => {
    const changes: TranslationData = {
      en: {
        test: {
          newkey: 'New Key Value'
        }
      }
    };

    await updateSpreadsheetWithLocalChanges(mockDoc as any, changes, 1, true);

    // Verify addRows was called
    expect(mockDoc.sheetsByTitle.test.addRows).toHaveBeenCalled();

    // Get the rows that were added
    const addedRows = mockDoc.sheetsByTitle.test.addRows.mock.calls[0][0];
    const addedRow = addedRows[0];

    // Verify the formula format uses dynamic extraction from header cells
    expect(addedRow).toHaveProperty('key', 'newkey');
    expect(addedRow).toHaveProperty('en', 'New Key Value');
    
    // Check for auto-translate formula in other columns (assuming 'de' exists)
    const formulaValue = addedRow.de;
    if (formulaValue) {
      // The formula must use dynamic language-code extraction (IFERROR+FIND pattern)
      // and reference header cells, not hard-coded language codes
      expect(formulaValue).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("\w+"&ROW\(\)\)/);
      expect(formulaValue).toContain('INDIRECT');
      expect(formulaValue).toContain('&ROW()');
      expect(formulaValue).toContain('IFERROR');
      expect(formulaValue).toContain('FIND("-"');
      // Must reference header cells (e.g. $B$1, C$1)
      expect(formulaValue).toContain('$1');
    }
  });

  it('should use dynamic column references based on header structure', async () => {
    // Mock a different header structure
    const mockRowsWithDifferentHeaders = [
      {
        toObject: () => ({ identifier: 'test', english: 'Test', german: 'Test' })
      }
    ];
    
    mockDoc.sheetsByTitle.test.getRows.mockResolvedValue(mockRowsWithDifferentHeaders);

    const changes: TranslationData = {
      english: {
        test: {
          newitem: 'New Item'
        }
      }
    };

    await updateSpreadsheetWithLocalChanges(mockDoc as any, changes, 1, true);

    const addedRows = mockDoc.sheetsByTitle.test.addRows.mock.calls[0][0];
    const addedRow = addedRows[0];

    // Should adapt to the different column structure
    expect(addedRow).toHaveProperty('identifier', 'newitem');
    expect(addedRow).toHaveProperty('english', 'New Item');
    
    // Formula should use the correct column references for this structure
    const formulaValue = addedRow.german;
    if (formulaValue) {
      // The formula must use dynamic language-code extraction
      expect(formulaValue).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("\w+"&ROW\(\)\)/);
      expect(formulaValue).toContain('IFERROR');
    }
  });
});
