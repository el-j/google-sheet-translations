import type { SheetRow, TranslationData } from '../types';

/**
 * Result of processing a single sheet.
 */
export interface SheetProcessingResult {
  translations: TranslationData;
  locales: string[];
  localeMapping: Record<string, string>; // normalized -> original header
  originalMapping: Record<string, string>; // original header -> normalized
  success: boolean;
}

export interface LocaleMappingResult {
  normalizedLocales: string[];
  localeMapping: Record<string, string>;
  originalMapping: Record<string, string>;
}

export interface RowTransformerDependencies {
  filterValidLocales: (headerRow: string[], keyColumn: string) => string[];
  createLocaleMapping: (
    originalHeaders: string[],
    keyColumn: string,
  ) => LocaleMappingResult;
  logger?: Pick<Console, 'warn' | 'error' | 'log'>;
}

/**
 * Pure transformation core: converts canonical rows into TranslationData for one sheet.
 */
export function transformRowsToSheetData(
  rows: SheetRow[],
  sheetTitle: string,
  deps: RowTransformerDependencies,
): SheetProcessingResult {
  const logger = deps.logger ?? console;

  const result: SheetProcessingResult = {
    translations: {},
    locales: [],
    localeMapping: {},
    originalMapping: {},
    success: false,
  };

  try {
    if (!rows || rows.length === 0) {
      logger.warn(`No rows found in sheet "${sheetTitle}"`);
      return result;
    }

    const headerRow: string[] = Object.keys(rows[0]).map((key) => key.toLowerCase());
    logger.log(`Header row for sheet "${sheetTitle}":`, headerRow);

    const keyColumn = headerRow[0];
    const validLocales = deps.filterValidLocales(headerRow, keyColumn);

    if (validLocales.length === 0) {
      logger.warn(`No valid locale columns found in sheet "${sheetTitle}"`);
      return result;
    }

    const originalHeaders = Object.keys(rows[0]);
    const { normalizedLocales, localeMapping, originalMapping } = deps.createLocaleMapping(
      originalHeaders,
      keyColumn,
    );

    result.localeMapping = localeMapping;
    result.originalMapping = originalMapping;

    for (const normalizedLocale of normalizedLocales) {
      const originalHeader = localeMapping[normalizedLocale];
      if (!originalHeader) continue;

      const languageCells = rows.map((row: SheetRow) => {
        const keyField = Object.keys(row).find((k) => k.toLowerCase() === keyColumn);

        if (!keyField || !row[keyField] || !row[originalHeader]) {
          return {};
        }

        const rowLocal: SheetRow = {};
        rowLocal[row[keyField].toString().toLowerCase()] = row[originalHeader];
        return rowLocal;
      });

      const nonEmptyLanguageCells = languageCells.filter(
        (cell) => Object.keys(cell).length > 0,
      );

      const prepareObj: Record<string, Record<string, string>> = {};
      prepareObj[sheetTitle] = nonEmptyLanguageCells.reduce<Record<string, string>>(
        (acc, cell) => Object.assign(acc, cell),
        {},
      );

      if (result.translations[normalizedLocale]) {
        result.translations[normalizedLocale] = {
          ...result.translations[normalizedLocale],
          ...prepareObj,
        };
      } else {
        result.translations[normalizedLocale] = { ...prepareObj };
      }
    }

    result.locales = normalizedLocales;
    result.success = true;
  } catch (error) {
    logger.error(`Error processing sheet "${sheetTitle}":`, error);
  }

  return result;
}
