## Goal
Create `src/utils/getDriveTranslations.ts` — the top-level "headless CMS" orchestrator function that combines Drive folder scanning + multi-spreadsheet fetching into a single ergonomic API. Also update `action.yml` + `action-entrypoint.ts` with new Drive-related inputs.

## Context
- **Repo**: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- **Depends on (must be completed first)**:
  - Task 01: `src/getMultipleSpreadSheetsData.ts` → `getMultipleSpreadSheetsData`, `MultiSpreadsheetOptions`
  - Task 02: `src/utils/driveFolderScanner.ts` → `scanDriveFolderForSpreadsheets`, `ScanDriveFolderOptions`
  - Task 03: `src/utils/driveImageSync.ts` → `syncDriveImages`, `DriveImageSyncOptions`
- **Types**: `src/types.ts`, `src/utils/configurationHandler.ts`
- **Action**: `action.yml`, `src/action-entrypoint.ts`
- **Build**: `npm run build && npm test` → must all pass

## Steps

### 1. Create `src/utils/getDriveTranslations.ts`

This is the main "headless CMS bridge" function:

```typescript
import type { TranslationData } from '../types';
import type { MultiSpreadsheetOptions } from '../getMultipleSpreadSheetsData';
import type { ScanDriveFolderOptions } from './driveFolderScanner';
import type { DriveImageSyncOptions, DriveImageSyncResult } from './driveImageSync';

export interface GoogleDriveManagerOptions {
  /**
   * Google Drive folder ID to scan for spreadsheets and/or images.
   * If provided without explicit spreadsheetIds, the folder is scanned
   * automatically for spreadsheet files.
   */
  driveFolderId?: string;

  /**
   * When true, scans driveFolderId for all Google Spreadsheet files and
   * fetches translations from each. Requires driveFolderId. (default: true when driveFolderId set)
   */
  scanForSpreadsheets?: boolean;

  /**
   * Explicit list of spreadsheet IDs to fetch from.
   * If provided together with driveFolderId + scanForSpreadsheets, the
   * explicit list is merged with the discovered ones (deduped).
   */
  spreadsheetIds?: string[];

  /**
   * Optional filter: only process spreadsheets whose name matches this pattern.
   * Useful when the Drive folder contains non-translation spreadsheets.
   * @example /^translations-/i
   */
  spreadsheetNameFilter?: RegExp;

  /**
   * When true, also sync images from driveFolderId to imageOutputPath.
   * Requires driveFolderId. (default: false)
   */
  syncImages?: boolean;

  /**
   * Local directory to download Drive images into.
   * Required when syncImages: true.
   * @example './src/assets/remote-images'
   */
  imageOutputPath?: string;

  /**
   * Image sync options passed to syncDriveImages (mimeTypes, concurrency, etc.)
   */
  imageSyncOptions?: Partial<DriveImageSyncOptions>;

  /**
   * Options forwarded to getMultipleSpreadSheetsData (rowLimit, waitSeconds,
   * translationsOutputDir, autoTranslate, etc.)
   */
  translationOptions?: MultiSpreadsheetOptions;

  /** Sheet names to fetch from each discovered spreadsheet */
  docTitles?: string[];
}

export interface GoogleDriveManagerResult {
  translations: TranslationData;
  /** List of discovered spreadsheet IDs that were processed */
  spreadsheetIds: string[];
  /** Image sync result (only present if syncImages: true) */
  imageSync?: DriveImageSyncResult;
}

/**
 * Top-level "headless CMS bridge" function.
 * 
 * Scans a Google Drive folder for spreadsheets, fetches all translations,
 * optionally syncs images, and returns merged results.
 *
 * @example
 * const result = await manageDriveTranslations({
 *   driveFolderId: 'your-folder-id',
 *   scanForSpreadsheets: true,
 *   spreadsheetNameFilter: /^i18n-/,
 *   syncImages: true,
 *   imageOutputPath: './src/assets/remote-images',
 *   translationOptions: {
 *     autoTranslate: false,
 *     translationsOutputDir: './src/translations'
 *   }
 * });
 * console.log(result.translations);
 * console.log(result.imageSync?.downloaded.length + ' images downloaded');
 */
export async function manageDriveTranslations(
  options: GoogleDriveManagerOptions
): Promise<GoogleDriveManagerResult>
```

**Implementation:**
1. Validate: if `syncImages: true` but no `imageOutputPath`, throw clear error
2. If `driveFolderId` + `scanForSpreadsheets !== false`: call `scanDriveFolderForSpreadsheets`
3. Merge discovered IDs with `options.spreadsheetIds` (dedup by ID)
4. Apply `spreadsheetNameFilter` if provided
5. Call `getMultipleSpreadSheetsData(docTitles, { ...translationOptions, spreadsheetIds })`
6. If `syncImages: true`: call `syncDriveImages({ folderId: driveFolderId, outputPath: imageOutputPath, ...imageSyncOptions })`
7. Return `GoogleDriveManagerResult`
8. Log: `[manageDriveTranslations] Found N spreadsheet(s) in Drive folder`

### 2. Create `tests/utils/getDriveTranslations.test.ts`

Mock:
- `../getMultipleSpreadSheetsData`
- `./driveFolderScanner`
- `./driveImageSync`

Tests:
- Scans folder + fetches translations when `driveFolderId` + `scanForSpreadsheets: true`
- Skips folder scan when `scanForSpreadsheets: false`
- Merges discovered + explicit `spreadsheetIds` (deduplication)
- Applies `spreadsheetNameFilter`
- Syncs images when `syncImages: true`
- Skips image sync when `syncImages: false`
- Throws when `syncImages: true` but no `imageOutputPath`
- Returns correct shape `{ translations, spreadsheetIds, imageSync? }`
- Falls back gracefully when folder has no spreadsheets (no throw, empty translations)

### 3. Update `action.yml`

Add new optional inputs to the GitHub Action:
```yaml
inputs:
  # ... existing inputs ...
  drive_folder_id:
    description: 'Google Drive folder ID to scan for spreadsheets and/or images'
    required: false
  scan_for_spreadsheets:
    description: 'Scan Drive folder for spreadsheets automatically (default: true when drive_folder_id set)'
    required: false
    default: 'true'
  spreadsheet_ids:
    description: 'Comma-separated list of additional spreadsheet IDs to include'
    required: false
  sync_images:
    description: 'Download images from Drive folder to image_output_path'
    required: false
    default: 'false'
  image_output_path:
    description: 'Local path to download Drive images into'
    required: false
    default: './public/remote-images'
```

### 4. Update `src/action-entrypoint.ts`

Read the new inputs using `@actions/core`:
```typescript
const driveFolderId = core.getInput('drive_folder_id') || undefined;
const scanForSpreadsheets = core.getInput('scan_for_spreadsheets') !== 'false';
const spreadsheetIdsRaw = core.getInput('spreadsheet_ids');
const spreadsheetIds = spreadsheetIdsRaw ? spreadsheetIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;
const syncImages = core.getInput('sync_images') === 'true';
const imageOutputPath = core.getInput('image_output_path') || './public/remote-images';
```

If `driveFolderId` or `spreadsheetIds?.length > 1` is set, call `manageDriveTranslations`; otherwise keep existing `getSpreadSheetData` call.

### 5. Update `src/index.ts`

Add:
```typescript
export { manageDriveTranslations } from './utils/getDriveTranslations'
export type { GoogleDriveManagerOptions, GoogleDriveManagerResult } from './utils/getDriveTranslations'
```

### 6. Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npm run build && npm test
```

## Acceptance criteria
- [ ] `manageDriveTranslations` exported from dist
- [ ] Types `GoogleDriveManagerOptions`, `GoogleDriveManagerResult` exported
- [ ] `action.yml` has 5 new inputs
- [ ] `action-entrypoint.ts` reads + uses new inputs
- [ ] 8+ test cases in new test file, all passing
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm test` → ALL existing + new tests pass
