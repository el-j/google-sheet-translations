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
