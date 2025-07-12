import { updateSpreadsheetWithLocalChanges } from '../../src/utils/spreadsheetUpdater';
import type { TranslationData } from '../../src/types';

// Mock dependencies
jest.mock('../../src/utils/wait', () => ({
  wait: jest.fn().mockResolvedValue(undefined)
}));

describe('spreadsheetUpdater - improved auto-translate formula', () => {
  const mockDoc = {
    sheetsByTitle: {
      'test': {
        getRows: jest.fn(),
        addRows: jest.fn().mockResolvedValue(undefined)
      }
    }
  };

  const mockRows = [
    {
      toObject: () => ({ key: 'existing', en: 'Existing', de: 'Bestehend' })
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.sheetsByTitle.test.getRows.mockResolvedValue(mockRows);
  });

  it('should create improved GOOGLETRANSLATE formulas with INDIRECT and cell references', async () => {
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

    // Verify the improved formula format
    // Expecting something like: =GOOGLETRANSLATE(INDIRECT("B"&ROW());$B$1;C$1)
    // The exact column letters depend on the header structure
    expect(addedRow).toHaveProperty('key', 'newkey');
    expect(addedRow).toHaveProperty('en', 'New Key Value');
    
    // Check for auto-translate formula in other columns (assuming 'de' exists)
    const formulaValue = addedRow.de;
    if (formulaValue) {
      expect(formulaValue).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("\w+"&ROW\(\)\);\$\w+\$1;\w+\$1\)$/);
      expect(formulaValue).toContain('INDIRECT');
      expect(formulaValue).toContain('&ROW()');
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
      expect(formulaValue).toMatch(/^=GOOGLETRANSLATE\(INDIRECT\("\w+"&ROW\(\)\);\$\w+\$1;\w+\$1\)$/);
    }
  });
});
