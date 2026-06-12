## Goal
Add `flatten` option and Drive project manifest to `getDriveTranslations.ts`, update `index.ts` exports, update tests, and update API docs.

## Context
- Working directory: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- `src/utils/driveProjectIndex.ts` already exists (created by parallel agent) with:
  - `DriveProjectManifest`, `SpreadsheetManifestEntry`, `BuildManifestOptions` interfaces
  - `buildManifest(options: BuildManifestOptions): DriveProjectManifest`
  - `writeManifest(manifest: DriveProjectManifest, manifestPath: string): void`
- Current `manageDriveTranslations` imports: `getMultipleSpreadSheetsData`, `scanDriveFolderForSpreadsheets`, `syncDriveImages`
- `getSpreadSheetData` is in `src/getSpreadSheetData.ts`
- `mergeMultipleTranslationData` is in `src/utils/multiSpreadsheetMerger.ts`
- Console prefix pattern: `[manageDriveTranslations]`
- Path separator: use `node:path`
- Sanitize folder names: lowercase, replace non-alphanumeric (except `-`) with `-`, trim leading/trailing dashes

## Files to modify

### 1. `src/utils/getDriveTranslations.ts` — full rewrite

Add to `GoogleDriveManagerOptions`:
```typescript
/**
 * When `false`, each discovered spreadsheet's translations are written to its
 * own subdirectory inside `translationOptions.translationsOutputDir`, named
 * after the spreadsheet (sanitized). For example:
 *   `translations/app-i18n/en.json`
 *   `translations/marketing/de.json`
 *
 * When `true` (default), all translations are merged into a single flat set of
 * locale files in `translationsOutputDir`:
 *   `translations/en.json` (merged from all spreadsheets)
 */
flatten?: boolean;

/**
 * When `true` (default when `driveFolderId` is set), writes an `i18n-manifest.json`
 * file to `manifestPath` after every run. The manifest holds project metadata,
 * the list of locales, and all processed spreadsheets — useful as a machine-readable
 * index for other tools.
 */
createManifest?: boolean;

/**
 * Path to write the manifest file.
 * Default: `path.join(translationsOutputDir, 'i18n-manifest.json')`
 */
manifestPath?: string;

/** Human-readable project name stored in the manifest (e.g. "my-app-i18n") */
projectName?: string;

/** Site URL / domain stored in the manifest (e.g. "https://example.com") */
domain?: string;

/** Primary locale code stored in the manifest (e.g. "en") */
defaultLocale?: string;

/** Arbitrary key/value metadata stored in the manifest */
projectMetadata?: Record<string, unknown>;
```

Add to `GoogleDriveManagerResult`:
```typescript
/** Project manifest written during this run (only present when `createManifest: true`) */
manifest?: DriveProjectManifest;
```

Helper function (add inside the file, not exported):
```typescript
/** Turns a spreadsheet name / ID into a safe directory name */
function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'sheet';
}
```

Logic changes in `manageDriveTranslations`:

1. Destructure new options: `flatten = true`, `createManifest`, `projectName`, `domain`, `defaultLocale`, `projectMetadata`, `manifestPath`
2. Set `shouldCreateManifest = createManifest ?? (driveFolderId !== undefined)`
3. Build `spreadsheetEntries: SpreadsheetManifestEntry[]` during processing
4. When `flatten: false` (non-flatten mode):
   - Import `getSpreadSheetData` from `'../getSpreadSheetData'`
   - Import `mergeMultipleTranslationData` from `'./multiSpreadsheetMerger'`
   - Loop through `filteredIds` individually:
     - Look up the name from `discoveredNames` or fall back to the ID
     - Compute `subDir = sanitizeFolderName(name)`
     - Compute the effective `baseOutputDir = translationOptions.translationsOutputDir ?? 'translations'`
     - Call `getSpreadSheetData(docTitles, { ...translationOptions, spreadsheetId: id, translationsOutputDir: path.join(baseOutputDir, subDir) })`
     - Collect per-spreadsheet results
     - Push `SpreadsheetManifestEntry { id, name, folderPath, sheets: docTitles ?? [], outputSubDirectory: subDir }`
   - Merge with `mergeMultipleTranslationData`
5. When `flatten: true` (default): keep existing behaviour, build `SpreadsheetManifestEntry` without `outputSubDirectory`
6. After fetching: if `shouldCreateManifest`:
   - Compute `resolvedManifestPath = manifestPath ?? path.join(translationOptions.translationsOutputDir ?? 'translations', 'i18n-manifest.json')`
   - Call `buildManifest(...)` and `writeManifest(manifest, resolvedManifestPath)`
   - Include in return
7. Return `{ translations, spreadsheetIds: filteredIds, imageSync, manifest }`

### 2. `src/index.ts`

Add after the existing Drive exports:
```typescript
// Drive project manifest
export { buildManifest, writeManifest } from './utils/driveProjectIndex';
export type { DriveProjectManifest, SpreadsheetManifestEntry, BuildManifestOptions } from './utils/driveProjectIndex';
```

### 3. `tests/utils/getDriveTranslations.test.ts`

Add new test cases (append to the existing `describe('manageDriveTranslations')`):

```typescript
// At the top, also mock driveProjectIndex
jest.mock('../../src/utils/driveProjectIndex');
import { buildManifest, writeManifest } from '../../src/utils/driveProjectIndex';
const mockBuildManifest = buildManifest as jest.MockedFunction<typeof buildManifest>;
const mockWriteManifest = writeManifest as jest.MockedFunction<typeof writeManifest>;

// In beforeEach, add:
mockBuildManifest.mockReturnValue({ version: '1', generatedAt: '2026-01-01T00:00:00.000Z', locales: ['en'], spreadsheets: [], outputDirectory: './translations', flatten: true });
mockWriteManifest.mockImplementation(() => {});
```

New test cases:
- `flatten: false` calls getMultipleSpreadSheetsData individually per spreadsheet with subdir outputDir
- `flatten: true` (default) uses existing merged approach
- `createManifest: true` calls `buildManifest` and `writeManifest`
- `createManifest: false` does NOT call `writeManifest`
- `createManifest` defaults to true when `driveFolderId` is set, false otherwise
- `manifestPath` custom path is passed to `writeManifest`
- `projectName`, `domain`, `defaultLocale`, `projectMetadata` are passed to `buildManifest`
- Result includes `manifest` when `createManifest: true`
- Result `manifest` is undefined when `createManifest: false`

### 4. `website/api/manage-drive-translations.md`

Update the `GoogleDriveManagerOptions` interface block to include all new fields. Add a `GoogleDriveManagerResult` update showing `manifest`. Add new example sections:
- "Folder-structured output (flatten: false)"
- "Project manifest / index file"
- "Full project with manifest + flatten"

## Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npm run build 2>&1 | tail -20
npx jest tests/utils/getDriveTranslations.test.ts --no-coverage 2>&1 | tail -30
```

## Acceptance criteria
- [x] `src/utils/getDriveTranslations.ts` TypeScript compiles
- [x] `src/index.ts` exports all new types
- [x] All existing + new tests in `getDriveTranslations.test.ts` pass
- [x] API docs updated with all new options
