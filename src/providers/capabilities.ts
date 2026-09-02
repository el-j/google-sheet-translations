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

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export type ProviderCapabilitySet = Record<ProviderCapability, boolean>;

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

export type ProviderOperation =
  | 'read-input'
  | 'write-output'
  | 'sync-back'
  | 'read-assets'
  | 'write-assets'
  | 'discover-sources'
  | 'sync-assets'
  | 'public-read';

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

export function createCapabilitySet(
  overrides: Partial<ProviderCapabilitySet> = {},
): ProviderCapabilitySet {
  return {
    ...EMPTY_PROVIDER_CAPABILITIES,
    ...overrides,
  };
}

export function missingCapabilities(
  capabilities: ProviderCapabilitySet,
  required: ProviderCapability[],
): ProviderCapability[] {
  return required.filter((capability) => !capabilities[capability]);
}

export function hasRequiredCapabilities(
  capabilities: ProviderCapabilitySet,
  required: ProviderCapability[],
): boolean {
  return missingCapabilities(capabilities, required).length === 0;
}

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
