import * as packageExports from '../src/index';
import { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from '../src/getSpreadSheetData';
import { wait } from '../src/utils/wait';
import { validateEnv } from '../src/utils/validateEnv';
import { createAuthClient } from '../src/utils/auth';
import { convertToDataJsonFormat } from '../src/utils/dataConverter/convertToDataJsonFormat';
import { convertFromDataJsonFormat } from '../src/utils/dataConverter/convertFromDataJsonFormat';
import { findLocalChanges } from '../src/utils/dataConverter/findLocalChanges';
import { updateSpreadsheetWithLocalChanges } from '../src/utils/spreadsheetUpdater';

describe('Package exports', () => {
  test('should export getSpreadSheetData as default export', () => {
    expect(packageExports.default).toBe(getSpreadSheetData);
  });

  test('should export getSpreadSheetData and DEFAULT_WAIT_SECONDS from getSpreadSheetData module', () => {
    expect(packageExports.getSpreadSheetData).toBe(getSpreadSheetData);
    expect(packageExports.DEFAULT_WAIT_SECONDS).toBe(DEFAULT_WAIT_SECONDS);
  });

  test('should export all utility functions', () => {
    expect(packageExports.wait).toBe(wait);
    expect(packageExports.validateEnv).toBe(validateEnv);
    expect(packageExports.createAuthClient).toBe(createAuthClient);
    expect(packageExports.convertToDataJsonFormat).toBe(convertToDataJsonFormat);
    expect(packageExports.convertFromDataJsonFormat).toBe(convertFromDataJsonFormat);
    expect(packageExports.findLocalChanges).toBe(findLocalChanges);
    expect(packageExports.updateSpreadsheetWithLocalChanges).toBe(updateSpreadsheetWithLocalChanges);
  });

  test('should export all types', () => {
    // Types are checked at compile time, not runtime, so we just verify the exports exist
    expect(typeof packageExports).toBe('object');
    
    // Check that all the expected keys are in the exports object
    const expectedKeys = [
      'getSpreadSheetData',
      'DEFAULT_WAIT_SECONDS',
      'wait', 
      'validateEnv',
      'createAuthClient',
      'convertToDataJsonFormat',
      'convertFromDataJsonFormat',
      'findLocalChanges',
      'updateSpreadsheetWithLocalChanges',
      'default'
    ];
    
    expectedKeys.forEach(key => {
      expect(packageExports).toHaveProperty(key);
    });
  });
});

describe('Package exports', () => {
  test('should export getSpreadSheetData as default export', () => {
    expect(packageExports.default).toBe(getSpreadSheetData);
  });

  test('should export getSpreadSheetData and DEFAULT_WAIT_SECONDS from getSpreadSheetData module', () => {
    expect(packageExports.getSpreadSheetData).toBe(getSpreadSheetData);
    expect(packageExports.DEFAULT_WAIT_SECONDS).toBe(DEFAULT_WAIT_SECONDS);
  });

  test('should export all utility functions', () => {
    expect(packageExports.wait).toBe(wait);
    expect(packageExports.validateEnv).toBe(validateEnv);
    expect(packageExports.createAuthClient).toBe(createAuthClient);
    expect(packageExports.convertToDataJsonFormat).toBe(convertToDataJsonFormat);
    expect(packageExports.convertFromDataJsonFormat).toBe(convertFromDataJsonFormat);
    expect(packageExports.findLocalChanges).toBe(findLocalChanges);
    expect(packageExports.updateSpreadsheetWithLocalChanges).toBe(updateSpreadsheetWithLocalChanges);
  });

  test('should export all types', () => {
    // Types are checked at compile time, not runtime, so we just verify the exports exist
    expect(typeof packageExports).toBe('object');
    
    // Check that all the expected keys are in the exports object
    const expectedKeys = [
      'getSpreadSheetData',
      'DEFAULT_WAIT_SECONDS',
      'wait', 
      'validateEnv',
      'createAuthClient',
      'convertToDataJsonFormat',
      'convertFromDataJsonFormat',
      'findLocalChanges',
      'updateSpreadsheetWithLocalChanges',
      'default'
    ];
    
    expectedKeys.forEach(key => {
      expect(packageExports).toHaveProperty(key);
    });
  });
});
