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

// Public types
export type {
  TranslationData,
  TranslationValue,
  SheetRow,
  GoogleEnvVars,
} from './types';

// Default export
import { getSpreadSheetData } from './getSpreadSheetData';
export default getSpreadSheetData;
