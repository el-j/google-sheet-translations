/**
 * Google Sheet Translation Manager Package
 * Exports utilities for working with Google Sheets as a translation source
 */

// Main functionality
export { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from './getSpreadSheetData';

// Utils
export { wait } from './utils/wait';
export { validateEnv } from './utils/validateEnv';
export { createAuthClient } from './utils/auth';
export { 
  convertToDataJsonFormat
} from './utils/dataConverter/convertToDataJsonFormat';
export { 
  convertFromDataJsonFormat
} from './utils/dataConverter/convertFromDataJsonFormat';
export { 
  findLocalChanges
} from './utils/dataConverter/findLocalChanges';
export { default as updateSpreadsheetWithLocalChanges } from './utils/spreadsheetUpdater';

// Types
export type { 
  TranslationData, 
  TranslationValue, 
  SheetRow,
  GoogleEnvVars 
} from './types';

// Default export
import { getSpreadSheetData } from './getSpreadSheetData';
export default getSpreadSheetData;
