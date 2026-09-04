/**
 * Public barrel for the v3 provider platform: capability model, provider contracts
 * (translation + asset), the built-in Google and CryptPad provider factories, the
 * catalog/discovery API, the sync engine, the orchestrator, and the runtime config
 * layer that wires a {@link ProviderRuntimeConfig} into concrete provider instances.
 */
export {
  PROVIDER_CAPABILITIES,
  EMPTY_PROVIDER_CAPABILITIES,
  OPERATION_CAPABILITY_REQUIREMENTS,
  createCapabilitySet,
  missingCapabilities,
  hasRequiredCapabilities,
  assertRequiredCapabilities,
  assertOperationCapabilities,
} from './capabilities';

export type {
  ProviderCapability,
  ProviderCapabilitySet,
  ProviderOperation,
} from './capabilities';

export type {
  ProviderKind,
  ProviderMetadata,
  CanonicalTableInput,
  TranslationInputRequest,
  TranslationInputResult,
  TranslationOutputPayload,
  TranslationOutputResult,
  TranslationSyncPayload,
  TranslationSyncResult,
  TranslationInputProvider,
  TranslationOutputProvider,
  TranslationSyncProvider,
  AnyTranslationProvider,
  ProviderRegistry,
  SegmentedProviderRegistry,
} from './contracts';

export type {
  AssetProviderKind,
  CanonicalAssetEntry,
  AssetManifestResult,
  AssetSyncRequest,
  AssetSyncResult,
  AssetInputProvider,
  AssetOutputProvider,
  AssetSyncProvider,
} from './assetContracts';

export type {
  ProviderSourceKind,
  ProviderSourceDescriptor,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResult,
  ProviderCatalogProvider,
  InMemoryProviderCatalogOptions,
} from './catalog';

export {
  createGoogleSheetsInputProvider,
  createGoogleSheetsOutputProvider,
  createGoogleSheetsSyncProvider,
  GOOGLE_SHEETS_PROVIDER_CAPABILITIES,
} from './google';

export type {
  GoogleSheetsInputProviderOptions,
  GoogleSheetsOutputProviderOptions,
  GoogleSheetsSyncProviderOptions,
} from './google';

export {
  createCryptPadCsvInputProvider,
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  createCryptPadAssetSyncProvider,
  CRYPTPAD_CSV_INPUT_CAPABILITIES,
  CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES,
  CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES,
  CRYPTPAD_ASSET_SYNC_CAPABILITIES,
} from './cryptpad';

export type {
  CryptPadCsvSource,
  CryptPadCsvInputProviderOptions,
  CryptPadWorkspaceProviderOptions,
  CryptPadAssetSyncProviderOptions,
} from './cryptpad';

export {
  createInMemoryProviderCatalogProvider,
  createDefaultProviderCatalog,
} from './catalog';

export {
  buildSyncPlan,
  resolveSyncPlan,
} from './syncEngine';

export type {
  SyncConflictPolicy,
  SyncChangeType,
  SyncEntryChange,
  SyncConflict,
  SyncPlan,
  ResolveSyncPlanResult,
  BuildSyncPlanInput,
} from './syncEngine';

export { runProviderPipeline } from './orchestrator';
export type { ProviderPipelineOptions, ProviderPipelineResult } from './orchestrator';

export {
  validateProviderRuntimeConfig,
  assertValidProviderRuntimeConfig,
  mapLegacyGoogleOptionsToProviderConfig,
} from './config';

export type {
  ProviderReferenceConfig,
  ProviderRuntimeConfig,
  ProviderConfigValidationResult,
  LegacyConfigMappingResult,
} from './config';

export {
  createProvidersFromRuntimeConfig,
  requiresGoogleAuthForRuntimeConfig,
} from './runtime';

export type { ProviderRuntimeSelection } from './runtime';
