/**
 * The full set of capability flags a provider can declare. A provider that
 * doesn't support an operation simply leaves the corresponding flag `false`
 * (see {@link EMPTY_PROVIDER_CAPABILITIES}), rather than omitting it.
 */
export const PROVIDER_CAPABILITIES = [
  'readTables',
  'writeTables',
  'syncBack',
  'readAssets',
  'writeAssets',
  'autoTranslateFormula',
  'discoverByFolder',
  'assetSync',
  'publicReadNoAuth',
] as const;

/**
 * Union of capability flag identifiers supported by the provider platform.
 */
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

/**
 * Record mapping each {@link ProviderCapability} to a boolean indicating whether it is supported.
 */
export type ProviderCapabilitySet = Record<ProviderCapability, boolean>;

/**
 * Baseline capability set where all capabilities are explicitly disabled (`false`).
 */
export const EMPTY_PROVIDER_CAPABILITIES: ProviderCapabilitySet = {
  readTables: false,
  writeTables: false,
  syncBack: false,
  readAssets: false,
  writeAssets: false,
  autoTranslateFormula: false,
  discoverByFolder: false,
  assetSync: false,
  publicReadNoAuth: false,
};

/**
 * A named pipeline operation (e.g. "read-input") that requires one or more
 * capabilities to be present before it can run. See {@link OPERATION_CAPABILITY_REQUIREMENTS}.
 */
export type ProviderOperation =
  | 'read-input'
  | 'write-output'
  | 'sync-back'
  | 'read-assets'
  | 'write-assets'
  | 'discover-sources'
  | 'sync-assets'
  | 'public-read';

/**
 * Mapping defining which capabilities are mandatory for each {@link ProviderOperation}.
 */
export const OPERATION_CAPABILITY_REQUIREMENTS: Record<
  ProviderOperation,
  ProviderCapability[]
> = {
  'read-input': ['readTables'],
  'write-output': ['writeTables'],
  'sync-back': ['syncBack'],
  'read-assets': ['readAssets'],
  'write-assets': ['writeAssets'],
  'discover-sources': ['discoverByFolder'],
  'sync-assets': ['assetSync'],
  'public-read': ['readTables', 'publicReadNoAuth'],
};

/**
 * Builds a full {@link ProviderCapabilitySet}, defaulting every unspecified
 * capability to `false`. Provider factories use this so they only need to
 * name the capabilities they actually support.
 */
export function createCapabilitySet(
  overrides: Partial<ProviderCapabilitySet> = {},
): ProviderCapabilitySet {
  return {
    ...EMPTY_PROVIDER_CAPABILITIES,
    ...overrides,
  };
}

/** Returns the subset of `required` that `capabilities` does not have set to `true`. */
export function missingCapabilities(
  capabilities: ProviderCapabilitySet,
  required: ProviderCapability[],
): ProviderCapability[] {
  return required.filter((capability) => !capabilities[capability]);
}

/** Returns `true` only if every capability in `required` is set to `true` on `capabilities`. */
export function hasRequiredCapabilities(
  capabilities: ProviderCapabilitySet,
  required: ProviderCapability[],
): boolean {
  return missingCapabilities(capabilities, required).length === 0;
}

/**
 * Throws a descriptive error naming `providerName`, `operation` (if given), and every
 * missing capability, unless `capabilities` already satisfies all of `required`.
 */
export function assertRequiredCapabilities(
  providerName: string,
  capabilities: ProviderCapabilitySet,
  required: ProviderCapability[],
  operation?: string,
): void {
  const missing = missingCapabilities(capabilities, required);
  if (missing.length === 0) return;

  const operationPart = operation ? ` for operation "${operation}"` : '';
  throw new Error(
    `Provider "${providerName}" is missing required capabilities${operationPart}: ${missing.join(', ')}`,
  );
}

/**
 * Convenience wrapper around {@link assertRequiredCapabilities} that looks up the
 * required capabilities for a named {@link ProviderOperation} via
 * {@link OPERATION_CAPABILITY_REQUIREMENTS}. This is the gate every pipeline stage
 * (read/write/sync/asset-sync/discovery) runs through before it executes.
 */
export function assertOperationCapabilities(
  providerName: string,
  capabilities: ProviderCapabilitySet,
  operation: ProviderOperation,
): void {
  assertRequiredCapabilities(
    providerName,
    capabilities,
    OPERATION_CAPABILITY_REQUIREMENTS[operation],
    operation,
  );
}
