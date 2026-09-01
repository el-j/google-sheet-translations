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
  CRYPTPAD_CSV_INPUT_CAPABILITIES,
} from './cryptpad';

export type {
  CryptPadCsvSource,
  CryptPadCsvInputProviderOptions,
} from './cryptpad';

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
