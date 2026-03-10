/**
 * Google Sheet Translation Manager Package
 * Public API surface – see package.json for current version
 */
export { getSpreadSheetData, DEFAULT_WAIT_SECONDS } from './getSpreadSheetData';
export type { SpreadsheetOptions } from './utils/configurationHandler';
export { wait } from './utils/wait';
export { withRetry } from './utils/rateLimiter';
export { validateEnv } from './utils/validateEnv';
export { createAuthClient } from './utils/auth';
export { convertToDataJsonFormat } from './utils/dataConverter/convertToDataJsonFormat';
export { convertFromDataJsonFormat } from './utils/dataConverter/convertFromDataJsonFormat';
export { findLocalChanges } from './utils/dataConverter/findLocalChanges';
export { updateSpreadsheetWithLocalChanges } from './utils/spreadsheetUpdater';
export { readPublicSheet } from './utils/publicSheetReader';
export { createSpreadsheet } from './utils/spreadsheetCreator';
export { validateCredentials } from './utils/validateEnv';
export { isValidLocale, filterValidLocales } from './utils/localeFilter';
export { getLanguagePrefix, normalizeLocaleCode, createLocaleMapping, getOriginalHeaderForLocale, getNormalizedLocaleForHeader, resolveLocaleWithFallback, } from './utils/localeNormalizer';
export { processRawRows } from './utils/sheetProcessor';
export type { SheetProcessingResult } from './utils/sheetProcessor';
export { getTranslationSummary, getLocaleDisplayName, mergeSheets } from './utils/translationHelpers';
export type { TranslationSummary, SheetSummary } from './utils/translationHelpers';
export { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from './utils/fileWriter';
export { handleBidirectionalSync } from './utils/syncManager';
export type { SyncResult } from './utils/syncManager';
export type { TranslationData, TranslationValue, SheetRow, GoogleEnvVars, } from './types';
import { getSpreadSheetData } from './getSpreadSheetData';
export default getSpreadSheetData;
