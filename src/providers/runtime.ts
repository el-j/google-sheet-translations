import {
  createGoogleSheetsInputProvider,
  createGoogleSheetsOutputProvider,
  createGoogleSheetsSyncProvider,
} from './google';
import {
  createCryptPadCsvInputProvider,
  type CryptPadCsvInputProviderOptions,
  type CryptPadCsvSource,
} from './cryptpad';
import type {
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
} from './contracts';
import type { ProviderRuntimeConfig } from './config';

export interface ProviderRuntimeSelection {
  inputProvider: TranslationInputProvider;
  outputProvider?: TranslationOutputProvider;
  syncProvider?: TranslationSyncProvider;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}

function createInputProvider(
  providerId: string,
  options: Record<string, unknown>,
): TranslationInputProvider {
  switch (providerId) {
    case 'google-sheets':
      return createGoogleSheetsInputProvider(options);
    case 'cryptpad-csv': {
      const sources = options.sources;
      if (!Array.isArray(sources)) {
        throw new Error('cryptpad-csv input provider requires an array "sources" option.');
      }

      const typedOptions: CryptPadCsvInputProviderOptions = {
        sources: sources as CryptPadCsvSource[],
        delimiter: typeof options.delimiter === 'string' ? options.delimiter : undefined,
        providerId: typeof options.providerId === 'string' ? options.providerId : undefined,
        displayName: typeof options.displayName === 'string' ? options.displayName : undefined,
      };

      return createCryptPadCsvInputProvider(typedOptions);
    }
    default:
      throw new Error(`Unsupported input provider: "${providerId}"`);
  }
}

function createOutputProvider(
  providerId: string,
  options: Record<string, unknown>,
): TranslationOutputProvider {
  switch (providerId) {
    case 'google-sheets':
      return createGoogleSheetsOutputProvider(options);
    default:
      throw new Error(`Unsupported output provider: "${providerId}"`);
  }
}

function createSyncProvider(
  providerId: string,
  options: Record<string, unknown>,
): TranslationSyncProvider {
  switch (providerId) {
    case 'google-sheets':
      return createGoogleSheetsSyncProvider(options);
    default:
      throw new Error(`Unsupported sync provider: "${providerId}"`);
  }
}

export function createProvidersFromRuntimeConfig(
  config: ProviderRuntimeConfig,
): ProviderRuntimeSelection {
  const inputProvider = createInputProvider(
    config.input.provider,
    asRecord(config.input.options),
  );

  const outputProvider = config.output
    ? createOutputProvider(config.output.provider, asRecord(config.output.options))
    : undefined;

  const syncProvider = config.sync
    ? createSyncProvider(config.sync.provider, asRecord(config.sync.options))
    : undefined;

  return {
    inputProvider,
    outputProvider,
    syncProvider,
  };
}

export function requiresGoogleAuthForRuntimeConfig(config: ProviderRuntimeConfig): boolean {
  const inputProviderId = config.input.provider;
  const inputOptions = asRecord(config.input.options);
  const outputProviderId = config.output?.provider;
  const syncProviderId = config.sync?.provider;

  if (outputProviderId === 'google-sheets' || syncProviderId === 'google-sheets') {
    return true;
  }

  if (inputProviderId !== 'google-sheets') {
    return false;
  }

  return inputOptions.publicSheet !== true;
}
