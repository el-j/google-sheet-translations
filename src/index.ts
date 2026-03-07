/**
 * Google Sheet Translation Manager Package
 * v2.0.0 – public API surface
 */

// Main entry point
export { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from './getSpreadSheetData';

// Configuration types (needed by callers of getSpreadSheetData)
export type { SpreadsheetOptions } from './utils/configurationHandler';

// Utility functions required by dependents
export { wait } from './utils/wait';
export { validateEnv } from './utils/validateEnv';
export { createAuthClient } from './utils/auth';
export { convertToDataJsonFormat } from './utils/dataConverter/convertToDataJsonFormat';
export { convertFromDataJsonFormat } from './utils/dataConverter/convertFromDataJsonFormat';
export { findLocalChanges } from './utils/dataConverter/findLocalChanges';
export { updateSpreadsheetWithLocalChanges } from './utils/spreadsheetUpdater';

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
