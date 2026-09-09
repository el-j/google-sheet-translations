/** Barrel for the CryptPad provider family: Sheet input/output/sync (E2EE), CSV input, workspace output/sync, Drive catalog, and asset sync. */
export { createCryptPadCsvInputProvider, CRYPTPAD_CSV_INPUT_CAPABILITIES } from './provider';

export {
  createCryptPadSheetInputProvider,
  CRYPTPAD_SHEET_INPUT_CAPABILITIES,
} from './sheetProvider';

export {
  createCryptPadSheetOutputProvider,
  CRYPTPAD_SHEET_OUTPUT_CAPABILITIES,
  convertTranslationsToSheetRows,
} from './sheetOutputProvider';

export {
  createCryptPadSheetSyncProvider,
  CRYPTPAD_SHEET_SYNC_CAPABILITIES,
} from './sheetSyncProvider';

export {
  createCryptPadDriveCatalogProvider,
  CRYPTPAD_DRIVE_CATALOG_CAPABILITIES,
} from './driveCatalogProvider';

export {
  createCryptPadWorkspaceOutputProvider,
  createCryptPadWorkspaceSyncProvider,
  CRYPTPAD_WORKSPACE_OUTPUT_CAPABILITIES,
  CRYPTPAD_WORKSPACE_SYNC_CAPABILITIES,
} from './fullProvider';

export { createCryptPadAssetSyncProvider, CRYPTPAD_ASSET_SYNC_CAPABILITIES } from './assetProvider';

export { CryptPadClient } from './client';
export { CryptPadDriveClient } from './driveClient';
export {
  parsePadUrl,
  deriveCryptPadKeys,
  decryptCryptPadPayload,
  encryptCryptPadPayload,
} from './crypto';
export {
  resolveCryptPadWebsocketUrl,
  fetchChannelHistory,
  broadcastChannelMessage,
} from './netflux';
export {
  extractOnlyOfficeChannelId,
  extractOnlyOfficeMetadata,
  extractOnlyOfficeSheetIdMap,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  convertCellsToMultiSheetRows,
  groupCellsBySheet,
  buildCellRef,
  buildOnlyOfficeChangePayload,
  encodeOnlyOfficeCellRecord,
  colIndexToLetter,
  letterToColIndex,
  parseCellRef,
} from './sheetParser';

export type { CryptPadCsvSource, CryptPadCsvInputProviderOptions } from './provider';
export type { CryptPadSheetSource, CryptPadSheetInputProviderOptions } from './sheetProvider';
export type { CryptPadSheetOutputProviderOptions } from './sheetOutputProvider';
export type { CryptPadSheetSyncProviderOptions } from './sheetSyncProvider';
export type { CryptPadDriveCatalogOptions } from './driveCatalogProvider';
export type { CryptPadDriveItem, CryptPadDriveClientOptions } from './driveClient';
export type { CryptPadClientOptions, CryptPadSheetResult } from './client';
export type { ParsedCryptPadUrl, DerivedCryptPadKeys } from './crypto';
export type { CryptPadSheetGrid, ReconstructedSheet, OnlyOfficeCellUpdate } from './sheetParser';

export type { CryptPadWorkspaceProviderOptions } from './fullProvider';
export type { CryptPadAssetSyncProviderOptions } from './assetProvider';
