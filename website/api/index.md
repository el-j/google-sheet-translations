# API Overview

`@el-j/google-sheet-translations` exports a small, focused public API.

## Main functions

| Export | Description |
|--------|-------------|
| [`getSpreadSheetData`](/api/get-spreadsheet-data) | Fetch translations from a single Google Spreadsheet, write output files, and optionally sync local changes back |
| [`getMultipleSpreadSheetsData`](/api/get-multiple-spreadsheets-data) | Fetch from multiple spreadsheet IDs and deep-merge results |
| [`manageDriveTranslations`](/api/manage-drive-translations) | Top-level orchestrator — scan a Drive folder, fetch all spreadsheets, and optionally sync images |

## Provider runtime (v3)

See [Provider Platform (v3)](/api/provider-platform) for the full API reference (capability model, config validation, orchestration, discovery, sync engine).

| Export | Description |
|--------|-------------|
| [`assertValidProviderRuntimeConfig`](/api/provider-platform#assertvalidproviderruntimeconfig-config) | Validate and type-check provider runtime config before execution |
| [`createProvidersFromRuntimeConfig`](/api/provider-platform#resolving-providers) | Build concrete input/output/sync/asset-sync providers from config |
| [`runProviderPipeline`](/api/provider-platform#running-the-pipeline) | Execute provider-driven pull/transform/write/sync/asset-sync flow |
| [`createGoogleSheetsInputProvider` / `createGoogleSheetsOutputProvider` / `createGoogleSheetsSyncProvider`](/api/google-provider) | Google Sheets provider factories |
| [`createCryptPadCsvInputProvider`](/api/cryptpad-provider#createcryptpadcsvinputprovider-options-depsoverrides) | CryptPad CSV input factory (read-only MVP) |
| [`createCryptPadWorkspaceOutputProvider` / `createCryptPadWorkspaceSyncProvider`](/api/cryptpad-provider) | CryptPad workspace output/sync factories |
| [`createCryptPadAssetSyncProvider`](/api/cryptpad-provider#createcryptpadassetsyncprovider-options-depsoverrides) | CryptPad asset-manifest sync factory |
| [`createDefaultProviderCatalog`](/api/provider-platform#source-discovery-catalog) | Discover built-in provider sources |
| [`migrateProjectToV3`](/api/migrate-v3) | Programmatic API behind `gst-migrate-v3` |

## Google Drive utilities

| Export | Description |
|--------|-------------|
| [`scanDriveFolderForSpreadsheets`](/api/drive-folder-scanner) | Discover all spreadsheet files in a Google Drive folder (recursive) |
| [`syncDriveImages`](/api/drive-image-sync) | Download images from a Drive folder to a local directory |
| [`walkDirectory`](/api/drive-image-sync#walkdirectory) | Async recursive file-tree walker |
| [`validateImageDirectory`](/api/drive-image-sync#validateimagedirectory) | Validate the structure of a synced image directory |

## Other utilities

| Export | Description |
|--------|-------------|
| [`validateEnv`](/api/validate-env) | Validate that all required env vars are present |
| [`isValidLocale`](/api/locale-utilities#isvalidlocale) | Check if a string is a valid locale identifier |
| [`filterValidLocales`](/api/locale-utilities#filtervalidlocales) | Filter a header row to only valid locale columns |

## Types

| Export | Description |
|--------|-------------|
| [`SpreadsheetOptions`](/api/types#spreadsheetoptions) | Options for `getSpreadSheetData` |
| [`MultiSpreadsheetOptions`](/api/get-multiple-spreadsheets-data#multispreadsheetoptions) | Options for `getMultipleSpreadSheetsData` |
| [`GoogleDriveManagerOptions`](/api/manage-drive-translations#googledrivemangeroptions) | Options for `manageDriveTranslations` |
| [`GoogleDriveManagerResult`](/api/manage-drive-translations#googledrivemanaagerresult) | Return type of `manageDriveTranslations` |
| [`DriveSpreadsheetFile`](/api/drive-folder-scanner#drivespreadsheetfile) | A discovered spreadsheet file entry |
| [`ScanDriveFolderOptions`](/api/drive-folder-scanner#scandrivefolderoptions) | Options for `scanDriveFolderForSpreadsheets` |
| [`DriveImageSyncOptions`](/api/drive-image-sync#driveimagesyncoptions) | Options for `syncDriveImages` |
| [`DriveImageSyncResult`](/api/drive-image-sync#driveimagesyncresult) | Return type of `syncDriveImages` |
| [`WalkDirectoryOptions`](/api/drive-image-sync#walkdirectoryoptions) | Options for `walkDirectory` |
| [`ImageDirectoryValidationOptions`](/api/drive-image-sync#imagedirectoryvalidationoptions) | Options for `validateImageDirectory` |
| [`ImageDirectoryValidationResult`](/api/drive-image-sync#imagedirectoryvalidationresult) | Return type of `validateImageDirectory` |
| [`TranslationData`](/api/types#translationdata) | The return type of `getSpreadSheetData` |
| [`TranslationValue`](/api/types#translationvalue) | A single translation value |
| [`SheetRow`](/api/types#sheetrow) | A raw row from a Google Sheet |
| [`GoogleEnvVars`](/api/types#googleenvvars) | The validated env vars object |

## Installation

```bash
npm install @el-j/google-sheet-translations
```

## Import styles

```typescript
// Default import (main function only)
import getSpreadSheetData from '@el-j/google-sheet-translations';

// Named imports
import {
  getSpreadSheetData,
  getMultipleSpreadSheetsData,
  manageDriveTranslations,
  scanDriveFolderForSpreadsheets,
  syncDriveImages,
  validateEnv,
} from '@el-j/google-sheet-translations';

// Type-only imports (zero runtime cost)
import type {
  SpreadsheetOptions,
  MultiSpreadsheetOptions,
  GoogleDriveManagerOptions,
  TranslationData,
} from '@el-j/google-sheet-translations';
```
