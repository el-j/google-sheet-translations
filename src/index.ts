/**
 * Google Sheet Translation Manager Package
 * Exports utilities for working with Google Sheets as a translation source
 */

// Main functionality
export { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from './spreadsheet';

// Utils
export { wait } from './utils/wait';
export { validateEnv } from './utils/validateEnv';
export { createAuthClient } from './utils/auth';
export { convertToDataJsonFormat } from './utils/dataConverter';

// Types
export type { 
  TranslationData, 
  TranslationValue, 
  SheetRow,
  GoogleEnvVars 
} from './types';

// Default export
import { getSpreadSheetData } from './spreadsheet';
export default getSpreadSheetData;
