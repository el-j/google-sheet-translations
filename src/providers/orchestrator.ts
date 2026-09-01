import { transformRowsToSheetData, type SheetProcessingResult } from '../core/rowTransformer';
import type { TranslationData } from '../types';
import { filterValidLocales } from '../utils/localeFilter';
import { createLocaleMapping } from '../utils/localeNormalizer';
import { assertOperationCapabilities } from './capabilities';
import type {
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
  TranslationOutputResult,
  TranslationSyncResult,
} from './contracts';

export interface ProviderPipelineOptions {
  inputProvider: TranslationInputProvider;
  outputProvider?: TranslationOutputProvider;
  syncProvider?: TranslationSyncProvider;
  tableNames?: string[];
  localTranslationsForSync?: TranslationData;
  signal?: AbortSignal;
}

export interface ProviderPipelineResult {
  translations: TranslationData;
  locales: string[];
  localeMapping: Record<string, string>;
  originalLocaleMapping: Record<string, string>;
  inputTableCount: number;
  outputResult?: TranslationOutputResult;
  syncResult?: TranslationSyncResult;
  metadata?: Record<string, unknown>;
}

interface OrchestratorDeps {
  transformRows: (rows: Record<string, string>[], sheetTitle: string) => SheetProcessingResult;
  logger: Pick<Console, 'warn'>;
}

function createDefaultDeps(): OrchestratorDeps {
  return {
    transformRows: (rows, sheetTitle) =>
      transformRowsToSheetData(rows, sheetTitle, {
        filterValidLocales,
        createLocaleMapping,
        logger: console,
      }),
    logger: console,
  };
}

function mergeTranslations(
  target: TranslationData,
  next: TranslationData,
): void {
  for (const [locale, sheets] of Object.entries(next)) {
    if (!target[locale]) {
      target[locale] = {};
    }

    for (const [sheetName, keys] of Object.entries(sheets)) {
      if (!target[locale][sheetName]) {
        target[locale][sheetName] = {};
      }
      target[locale][sheetName] = {
        ...target[locale][sheetName],
        ...keys,
      };
    }
  }
}

export async function runProviderPipeline(
  options: ProviderPipelineOptions,
  depsOverrides: Partial<OrchestratorDeps> = {},
): Promise<ProviderPipelineResult> {
  const deps = { ...createDefaultDeps(), ...depsOverrides };

  assertOperationCapabilities(
    options.inputProvider.providerId,
    options.inputProvider.capabilities,
    'read-input',
  );

  const inputResult = await options.inputProvider.readTables({
    tableNames: options.tableNames,
    signal: options.signal,
  });

  const mergedTranslations: TranslationData = {};
  const localeSet = new Set<string>();
  const localeMapping: Record<string, string> = {};
  const originalLocaleMapping: Record<string, string> = {};

  for (const table of inputResult.tables) {
    const processed = deps.transformRows(table.rows, table.tableName);

    if (!processed.success) {
      deps.logger.warn(
        `Skipping table "${table.tableName}" because transformation returned unsuccessful result.`,
      );
      continue;
    }

    mergeTranslations(mergedTranslations, processed.translations);

    for (const locale of processed.locales) {
      localeSet.add(locale);
    }

    for (const [normalized, original] of Object.entries(processed.localeMapping)) {
      if (!localeMapping[normalized]) {
        localeMapping[normalized] = original;
      }
    }

    for (const [original, normalized] of Object.entries(processed.originalMapping)) {
      if (!originalLocaleMapping[original]) {
        originalLocaleMapping[original] = normalized;
      }
    }
  }

  let outputResult: TranslationOutputResult | undefined;
  if (options.outputProvider) {
    assertOperationCapabilities(
      options.outputProvider.providerId,
      options.outputProvider.capabilities,
      'write-output',
    );

    outputResult = await options.outputProvider.writeTranslations({
      translations: mergedTranslations,
      locales: Array.from(localeSet),
      localeMapping,
      originalLocaleMapping,
      metadata: inputResult.metadata,
    });
  }

  let syncResult: TranslationSyncResult | undefined;
  if (options.syncProvider && options.localTranslationsForSync) {
    assertOperationCapabilities(
      options.syncProvider.providerId,
      options.syncProvider.capabilities,
      'sync-back',
    );

    syncResult = await options.syncProvider.syncTranslations({
      localTranslations: options.localTranslationsForSync,
      remoteTranslations: mergedTranslations,
      metadata: inputResult.metadata,
    });
  }

  return {
    translations: mergedTranslations,
    locales: Array.from(localeSet),
    localeMapping,
    originalLocaleMapping,
    inputTableCount: inputResult.tables.length,
    outputResult,
    syncResult,
    metadata: inputResult.metadata,
  };
}
