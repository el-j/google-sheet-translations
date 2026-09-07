/** Barrel for the CryptPad provider family: Sheet input (E2EE), CSV input, workspace output/sync, and asset sync. */
export { createCryptPadCsvInputProvider, CRYPTPAD_CSV_INPUT_CAPABILITIES } from './provider';

export {
  createCryptPadSheetInputProvider,
  CRYPTPAD_SHEET_INPUT_CAPABILITIES,
} from './sheetProvider';

export {
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES,
  CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES,
} from './fullProvider';

export { createCryptPadAssetSyncProvider, CRYPTPAD_ASSET_SYNC_CAPABILITIES } from './assetProvider';

export { CryptPadClient } from './client';
export { parsePadUrl, deriveCryptPadKeys, decryptCryptPadPayload } from './crypto';
export { resolveCryptPadWebsocketUrl, fetchChannelHistory } from './netflux';
export {
  extractOnlyOfficeChannelId,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
} from './sheetParser';

export type { CryptPadCsvSource, CryptPadCsvInputProviderOptions } from './provider';
export type { CryptPadSheetSource, CryptPadSheetInputProviderOptions } from './sheetProvider';
export type { CryptPadClientOptions, CryptPadSheetResult } from './client';
export type { ParsedCryptPadUrl, DerivedCryptPadKeys } from './crypto';
export type { CryptPadSheetGrid, ReconstructedSheet } from './sheetParser';

export type { CryptPadWorkspaceProviderOptions } from './fullProvider';
export type { CryptPadAssetSyncProviderOptions } from './assetProvider';
