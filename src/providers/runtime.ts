import {
  createGoogleSheetsInputProvider,
  createGoogleSheetsOutputProvider,
  createGoogleSheetsSyncProvider,
} from './google';
import {
  createCryptPadCsvInputProvider,
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  createCryptPadAssetSyncProvider,
  type CryptPadCsvInputProviderOptions,
  type CryptPadWorkspaceProviderOptions,
  type CryptPadCsvSource,
  type CryptPadAssetSyncProviderOptions,
} from './cryptpad';
import type {
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
} from './contracts';
import type { AssetSyncProvider } from './assetContracts';
import type { ProviderRuntimeConfig } from './config';

export interface ProviderRuntimeSelection {
  inputProvider: TranslationInputProvider;
  outputProvider?: TranslationOutputProvider;
  syncProvider?: TranslationSyncProvider;
  assetSyncProvider?: AssetSyncProvider;
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
    case 'cryptpad-workspace': {
      if (typeof options.filePath !== 'string' || options.filePath.trim().length === 0) {
        throw new Error('cryptpad-workspace output provider requires a non-empty "filePath" option.');
      }

      const typedOptions: CryptPadWorkspaceProviderOptions = {
        filePath: options.filePath,
        authToken: typeof options.authToken === 'string' ? options.authToken : undefined,
        expectedRevision:
          typeof options.expectedRevision === 'number' ? options.expectedRevision : undefined,
        providerId: typeof options.providerId === 'string' ? options.providerId : undefined,
        displayName: typeof options.displayName === 'string' ? options.displayName : undefined,
      };

      return createCryptPadWorkspaceOutputProvider(typedOptions);
    }
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
    case 'cryptpad-workspace': {
      if (typeof options.filePath !== 'string' || options.filePath.trim().length === 0) {
        throw new Error('cryptpad-workspace sync provider requires a non-empty "filePath" option.');
      }

      const typedOptions: CryptPadWorkspaceProviderOptions = {
        filePath: options.filePath,
        authToken: typeof options.authToken === 'string' ? options.authToken : undefined,
        expectedRevision:
          typeof options.expectedRevision === 'number' ? options.expectedRevision : undefined,
        conflictPolicy:
          options.conflictPolicy === 'remote-wins' ||
          options.conflictPolicy === 'local-wins' ||
          options.conflictPolicy === 'manual'
            ? options.conflictPolicy
            : undefined,
        providerId: typeof options.providerId === 'string' ? options.providerId : undefined,
        displayName: typeof options.displayName === 'string' ? options.displayName : undefined,
      };

      return createCryptPadWorkspaceSyncProvider(typedOptions);
    }
    default:
      throw new Error(`Unsupported sync provider: "${providerId}"`);
  }
}

function createAssetSyncProvider(
  providerId: string,
  options: Record<string, unknown>,
): AssetSyncProvider {
  switch (providerId) {
    case 'cryptpad-assets': {
      if (typeof options.manifestPath !== 'string' || options.manifestPath.trim().length === 0) {
        throw new Error('cryptpad-assets sync provider requires a non-empty "manifestPath" option.');
      }

      const typedOptions: CryptPadAssetSyncProviderOptions = {
        manifestPath: options.manifestPath,
        providerId: typeof options.providerId === 'string' ? options.providerId : undefined,
        displayName: typeof options.displayName === 'string' ? options.displayName : undefined,
      };

      return createCryptPadAssetSyncProvider(typedOptions);
    }
    default:
      throw new Error(`Unsupported asset sync provider: "${providerId}"`);
  }
}

/**
 * Builds a {@link ProviderRuntimeSelection} by resolving each configured provider slot
 * (`input`, `output`, `sync`, `assetSync`) to a concrete provider instance via its factory.
 * Throws if a slot names a provider ID with no matching factory, or if a provider's
 * required options are missing.
 */
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

  const assetSyncProvider = config.assetSync
    ? createAssetSyncProvider(config.assetSync.provider, asRecord(config.assetSync.options))
    : undefined;

  return {
    inputProvider,
    outputProvider,
    syncProvider,
    assetSyncProvider,
  };
}

/**
 * Determines whether a runtime config needs authenticated Google credentials, i.e.
 * whether Google Sheets is used for output/sync, or for input without `publicSheet: true`.
 * Used to skip Google auth bootstrapping entirely for CryptPad-only pipelines.
 */
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
