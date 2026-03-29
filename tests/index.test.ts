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

  test('should export all public API symbols', () => {
    // Types are checked at compile time; here we verify every runtime export is present.
    const expectedKeys: string[] = [
      // core
      'getSpreadSheetData',
      'DEFAULT_WAIT_SECONDS',
      'default',
      // utils
      'wait',
      'withRetry',
      'validateEnv',
      'validateCredentials',
      'createAuthClient',
      // data converters
      'convertToDataJsonFormat',
      'convertFromDataJsonFormat',
      'findLocalChanges',
      // spreadsheet I/O
      'updateSpreadsheetWithLocalChanges',
      'readPublicSheet',
      'createSpreadsheet',
      'processRawRows',
      // locale normalisation
      'isValidLocale',
      'filterValidLocales',
      'getLanguagePrefix',
      'getGoogleTranslateCode',
      'normalizeLocaleCode',
      'createLocaleMapping',
      'getOriginalHeaderForLocale',
      'getNormalizedLocaleForHeader',
      'resolveLocaleWithFallback',
      // translation helpers
      'getTranslationSummary',
      'getLocaleDisplayName',
      'mergeSheets',
      // file writers
      'writeTranslationFiles',
      'writeLocalesFile',
      'writeLanguageDataFile',
      // sync
      'handleBidirectionalSync',
      // multi-spreadsheet
      'getMultipleSpreadSheetsData',
      'mergeMultipleTranslationData',
      // Drive folder scanner
      'scanDriveFolderForSpreadsheets',
      // Drive image sync
      'syncDriveImages',
      'normalizeExtension',
      'walkDirectory',
      'validateImageDirectory',
      'DEFAULT_IMAGE_EXTENSIONS',
      // Drive translations orchestrator
      'manageDriveTranslations',
      // Drive project manifest
      'buildManifest',
      'writeManifest',
      'readManifest',
      // Drive Docs scanner
      'scanDriveFolderForDocs',
      'inferLocaleFromDocName',
      // Doc content parser
      'parseDocContent',
      'slugifyKey',
      // Doc ingester
      'ingestDoc',
      'exportDoc',
      'entriesToSeedKeys',
      'entriesToTranslationData',
    ];

    expectedKeys.forEach(key => {
      expect(packageExports).toHaveProperty(key);
    });
  });
});
