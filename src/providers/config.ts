import type { SpreadsheetOptions } from '../utils/configurationHandler';

export interface ProviderReferenceConfig {
  provider: string;
  options?: Record<string, unknown>;
}

export interface ProviderRuntimeConfig {
  input: ProviderReferenceConfig;
  output?: ProviderReferenceConfig;
  sync?: ProviderReferenceConfig;
}

export interface ProviderConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export interface LegacyConfigMappingResult {
  config: ProviderRuntimeConfig;
  deprecations: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

  if (
    isObject(input) &&
    typeof input.provider === 'string' &&
    input.provider === 'cryptpad-csv' &&
    isObject(sync) &&
    typeof sync.provider === 'string' &&
    sync.provider === 'cryptpad-csv'
  ) {
    errors.push(
      'Invalid provider combination: "cryptpad-csv" does not support sync mode. Use a sync-capable provider (for example "google-sheets") or omit sync.',
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

export function assertValidProviderRuntimeConfig(config: unknown): ProviderRuntimeConfig {
  const validation = validateProviderRuntimeConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid provider configuration: ${validation.errors.join(' | ')}`);
  }
  return config as ProviderRuntimeConfig;
}
