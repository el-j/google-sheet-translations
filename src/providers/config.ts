import type { SpreadsheetOptions } from '../utils/configurationHandler';

/**
 * A single provider slot: which provider implementation to instantiate
 * (e.g. "google-sheets", "cryptpad-csv") and the options to pass to its factory.
 */
export interface ProviderReferenceConfig {
  provider: string;
  options?: Record<string, unknown>;
}

/**
 * Declarative runtime configuration consumed by {@link createProvidersFromRuntimeConfig}.
 * Only `input` is required; `output`, `sync`, and `assetSync` are opt-in per pipeline run.
 */
export interface ProviderRuntimeConfig {
  input: ProviderReferenceConfig;
  output?: ProviderReferenceConfig;
  sync?: ProviderReferenceConfig;
  /** Optional asset-sync provider slot (e.g. "cryptpad-assets"). See {@link AssetSyncProvider}. */
  assetSync?: ProviderReferenceConfig;
}

/**
 * Outcome returned by {@link validateProviderRuntimeConfig}.
 */
export interface ProviderConfigValidationResult {
  /** True when the configuration satisfies all syntactic and structural requirements. */
  valid: boolean;
  /** List of validation error messages encountered during inspection. */
  errors: string[];
}

/**
 * Result returned when mapping legacy spreadsheet options to a v3 provider runtime configuration.
 */
export interface LegacyConfigMappingResult {
  /** Generated modern provider runtime configuration. */
  config: ProviderRuntimeConfig;
  /** Explanatory deprecation warnings advising migration steps. */
  deprecations: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates the shape of an untrusted runtime config value (typically parsed from JSON)
 * before it is trusted as a {@link ProviderRuntimeConfig}. Collects every error found
 * rather than failing on the first one, so a config file can be fixed in one pass.
 */
export function validateProviderRuntimeConfig(
  config: unknown,
): ProviderConfigValidationResult {
  const errors: string[] = [];

  if (!isObject(config)) {
    return {
      valid: false,
      errors: ['Provider config must be an object.'],
    };
  }

  const input = config.input;
  if (!isObject(input)) {
    errors.push('Provider config must include an "input" provider object.');
  } else if (typeof input.provider !== 'string' || input.provider.trim().length === 0) {
    errors.push('Input provider must define a non-empty "provider" string.');
  }

  const output = config.output;
  if (output !== undefined) {
    if (!isObject(output)) {
      errors.push('Output provider must be an object when provided.');
    } else if (typeof output.provider !== 'string' || output.provider.trim().length === 0) {
      errors.push('Output provider must define a non-empty "provider" string.');
    }
  }

  const sync = config.sync;
  if (sync !== undefined) {
    if (!isObject(sync)) {
      errors.push('Sync provider must be an object when provided.');
    } else if (typeof sync.provider !== 'string' || sync.provider.trim().length === 0) {
      errors.push('Sync provider must define a non-empty "provider" string.');
    }
  }

  const assetSync = config.assetSync;
  if (assetSync !== undefined) {
    if (!isObject(assetSync)) {
      errors.push('Asset sync provider must be an object when provided.');
    } else if (typeof assetSync.provider !== 'string' || assetSync.provider.trim().length === 0) {
      errors.push('Asset sync provider must define a non-empty "provider" string.');
    }
  }

  if (
    isObject(input) &&
    typeof input.provider === 'string' &&
    input.provider === 'cryptpad-csv' &&
    isObject(sync) &&
    typeof sync.provider === 'string' &&
    sync.provider !== 'cryptpad-workspace'
  ) {
    errors.push(
      'Invalid provider combination: "cryptpad-csv" only supports sync mode via "cryptpad-workspace" (or use another sync-capable provider).',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Maps legacy Google-first options to the provider runtime schema.
 * This enables v3 adoption without forcing immediate option rewrites.
 */
export function mapLegacyGoogleOptionsToProviderConfig(
  options: SpreadsheetOptions = {},
): LegacyConfigMappingResult {
  const deprecations: string[] = [
    'Legacy SpreadsheetOptions are deprecated in v3 provider mode; migrate to ProviderRuntimeConfig.',
  ];

  const input: ProviderReferenceConfig = {
    provider: 'google-sheets',
    options: {
      spreadsheetId: options.spreadsheetId,
      rowLimit: options.rowLimit,
      waitSeconds: options.waitSeconds,
      publicSheet: options.publicSheet,
    },
  };

  const syncEnabled = options.syncLocalChanges !== false;
  const sync: ProviderReferenceConfig | undefined = syncEnabled
    ? {
        provider: 'google-sheets',
        options: {
          spreadsheetId: options.spreadsheetId,
          waitSeconds: options.waitSeconds,
          autoTranslate: options.autoTranslate,
          override: options.override,
        },
      }
    : undefined;

  return {
    config: {
      input,
      sync,
    },
    deprecations,
  };
}

/**
 * Validates `config` and returns it typed as {@link ProviderRuntimeConfig}, or throws
 * with all collected validation errors joined into a single message. Use this at
 * process boundaries (CLI, Action inputs) where a throw-on-invalid contract is wanted.
 */
export function assertValidProviderRuntimeConfig(config: unknown): ProviderRuntimeConfig {
  const validation = validateProviderRuntimeConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid provider configuration: ${validation.errors.join(' | ')}`);
  }
  return config as ProviderRuntimeConfig;
}
