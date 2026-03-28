/**
 * Google Sheet Translation Manager Package
 * Public API surface – see package.json for current version
 */

// Main entry point
export { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from './getSpreadSheetData';

// Configuration types (needed by callers of getSpreadSheetData)
export type { SpreadsheetOptions } from './utils/configurationHandler';

// Utility functions required by dependents
export { wait } from './utils/wait';
export { withRetry } from './utils/rateLimiter';
export { validateEnv } from './utils/validateEnv';
export { createAuthClient } from './utils/auth';
export { convertToDataJsonFormat } from './utils/dataConverter/convertToDataJsonFormat';
export { convertFromDataJsonFormat } from './utils/dataConverter/convertFromDataJsonFormat';
export { findLocalChanges } from './utils/dataConverter/findLocalChanges';
export { updateSpreadsheetWithLocalChanges } from './utils/spreadsheetUpdater';

// Public (unauthenticated) sheet reader
export { readPublicSheet } from './utils/publicSheetReader';

// Auto-create spreadsheet utility
export { createSpreadsheet } from './utils/spreadsheetCreator';
export { validateCredentials } from './utils/validateEnv';

// Locale validation utilities (useful standalone)
export { isValidLocale, filterValidLocales } from './utils/localeFilter';

// Locale normalisation utilities
export {
  getLanguagePrefix,
  normalizeLocaleCode,
  createLocaleMapping,
  getOriginalHeaderForLocale,
  getNormalizedLocaleForHeader,
  resolveLocaleWithFallback,
} from './utils/localeNormalizer';

// Sheet processing (pure row-processing core, no API calls)
export { processRawRows } from './utils/sheetProcessor';
export type { SheetProcessingResult } from './utils/sheetProcessor';

// Higher-level translation helpers
export { getTranslationSummary, getLocaleDisplayName, mergeSheets } from './utils/translationHelpers';
export type { TranslationSummary, SheetSummary } from './utils/translationHelpers';

// File-writing utilities (custom output pipelines)
export { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from './utils/fileWriter';

// Bidirectional sync manager
export { handleBidirectionalSync } from './utils/syncManager';
export type { SyncResult } from './utils/syncManager';

// Public types
export type {
  TranslationData,
  TranslationValue,
  SheetRow,
  GoogleEnvVars,
} from './types';

// Multi-spreadsheet support
export { getMultipleSpreadSheetsData } from './getMultipleSpreadSheetsData';
export type { MultiSpreadsheetOptions } from './getMultipleSpreadSheetsData';
export { mergeMultipleTranslationData } from './utils/multiSpreadsheetMerger';

// Drive folder scanner (discover spreadsheets in a Drive folder)
export { scanDriveFolderForSpreadsheets } from './utils/driveFolderScanner';
export type { DriveSpreadsheetFile, ScanDriveFolderOptions } from './utils/driveFolderScanner';

// Drive image sync (download images/assets from a Drive folder to local disk)
export { syncDriveImages } from './utils/driveImageSync';
export type { DriveImageSyncOptions, DriveImageSyncResult } from './utils/driveImageSync';

// Drive translations orchestrator (headless CMS bridge)
export { manageDriveTranslations } from './utils/getDriveTranslations';
export type { GoogleDriveManagerOptions, GoogleDriveManagerResult } from './utils/getDriveTranslations';

// Default export
import { getSpreadSheetData } from './getSpreadSheetData';
export default getSpreadSheetData;
