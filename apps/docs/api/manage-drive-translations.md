# manageDriveTranslations

Top-level "headless CMS bridge" function that combines Drive folder scanning,
multi-spreadsheet translation fetching, and image synchronisation into a single call.

## Signature

```typescript
function manageDriveTranslations(
  options: GoogleDriveManagerOptions,
): Promise<GoogleDriveManagerResult>
```

## Parameters

### `options`
- **Type**: [`GoogleDriveManagerOptions`](#googledrivemangeroptions)
- **Required**: yes

## Returns

`Promise<GoogleDriveManagerResult>` — see [`GoogleDriveManagerResult`](#googledrivemanaagerresult) below.

---

## GoogleDriveManagerOptions

```typescript
interface GoogleDriveManagerOptions {
  /** Google Drive folder ID to scan for spreadsheets and/or images */
  driveFolderId?: string;

  /**
   * Scan driveFolderId for all Google Spreadsheet files automatically.
   * Default: true when driveFolderId is set.
   */
  scanForSpreadsheets?: boolean;

  /**
   * Explicit list of spreadsheet IDs to include.
   * Merged with discovered ones (deduped).
   */
  spreadsheetIds?: string[];

  /**
   * Only process spreadsheets whose name matches this pattern.
   * @example /^i18n-/i
   */
  spreadsheetNameFilter?: RegExp;

  /**
   * Download image assets from driveFolderId to imageOutputPath.
   * Requires driveFolderId. Default: false.
   */
  syncImages?: boolean;

  /**
   * Local directory to write downloaded images into.
   * Required when syncImages: true.
   */
  imageOutputPath?: string;

  /** Image sync options (mimeTypes, concurrency, cleanSync, etc.) */
  imageSyncOptions?: Partial<DriveImageSyncOptions>;

  /** Options forwarded to getMultipleSpreadSheetsData */
  translationOptions?: MultiSpreadsheetOptions;

  /** Sheet tab names to fetch from each spreadsheet */
  docTitles?: string[];

  /**
   * When `false`, each spreadsheet writes translations to its own subdirectory
   * inside `translationsOutputDir`, named after the spreadsheet (sanitized).
   * When `true` (default), all spreadsheets are merged into a flat output directory.
   * Default: true.
   */
  flatten?: boolean;

  /**
   * Write an `i18n-manifest.json` index file after each run.
   * Default: `true` when `driveFolderId` is set, `false` otherwise.
   */
  createManifest?: boolean;

  /**
   * Path for the manifest file.
   * Default: `path.join(translationsOutputDir, 'i18n-manifest.json')`
   */
  manifestPath?: string;

  /** Human-readable project name stored in the manifest */
  projectName?: string;

  /** Site domain / URL stored in the manifest */
  domain?: string;

  /** Primary locale code stored in the manifest (e.g. "en") */
  defaultLocale?: string;

  /** Arbitrary metadata stored in the manifest */
  projectMetadata?: Record<string, unknown>;
}
```

## GoogleDriveManagerResult

```typescript
interface GoogleDriveManagerResult {
  /** Merged translations from all discovered spreadsheets */
  translations: TranslationData;

  /** IDs of every spreadsheet that was processed */
  spreadsheetIds: string[];

  /** Image sync result — only present when syncImages: true */
  imageSync?: DriveImageSyncResult;

  /** Project manifest written during this run — only present when createManifest: true */
  manifest?: DriveProjectManifest;
}
```

---

## Examples

### Scan a Drive folder for all translation spreadsheets

```typescript
import { manageDriveTranslations } from '@el-j/google-sheet-translations';

const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  scanForSpreadsheets: true,
  spreadsheetNameFilter: /^i18n-/i,
  translationOptions: {
    translationsOutputDir: './src/translations',
  },
});
```

### Scan + image sync

```typescript
const result = await manageDriveTranslations({
  driveFolderId: 'your-folder-id',
  scanForSpreadsheets: true,
  syncImages: true,
  imageOutputPath: './src/assets/remote-images',
  imageSyncOptions: { concurrency: 5, cleanSync: true },
  translationOptions: {
    autoTranslate: false,
  },
});

console.log(`Downloaded ${result.imageSync?.downloaded.length} images`);
```

### Explicit spreadsheet IDs only (no Drive scan)

```typescript
const result = await manageDriveTranslations({
  spreadsheetIds: ['1abc…', '1def…', '1ghi…'],
  translationOptions: { waitSeconds: 2 },
});
```

### Mix Drive scan + explicit IDs

```typescript
const result = await manageDriveTranslations({
  driveFolderId: 'folder-id',
  spreadsheetIds: ['1extra-sheet-not-in-folder…'],
  spreadsheetNameFilter: /^translations-/i,
});
// IDs are merged and deduped before fetching
```

---

## Project Manifest

When `createManifest: true` (the default when `driveFolderId` is set), `manageDriveTranslations` writes an `i18n-manifest.json` file to the output directory. This file acts as a single source of truth for the project's i18n layout.

### Manifest shape

```typescript
interface DriveProjectManifest {
  version: '1';
  generatedAt: string;         // ISO timestamp of last run
  projectName?: string;
  domain?: string;
  locales: string[];           // sorted list of all locale codes
  defaultLocale?: string;
  spreadsheets: SpreadsheetManifestEntry[];
  outputDirectory: string;
  flatten: boolean;
  projectMetadata?: Record<string, unknown>;
}

interface SpreadsheetManifestEntry {
  id: string;
  name: string;
  folderPath: string;
  sheets: string[];
  modifiedTime?: string;
  outputSubDirectory?: string; // only present when flatten: false
}
```

The manifest can be imported and consumed directly from the package:

```typescript
import { buildManifest, writeManifest } from '@el-j/google-sheet-translations';
import type { DriveProjectManifest, SpreadsheetManifestEntry, BuildManifestOptions } from '@el-j/google-sheet-translations';
```

### Examples

#### Folder-structured output (flatten: false)

When `flatten: false`, each spreadsheet's translations are written to their own subdirectory named after the spreadsheet:

```
translations/
  app-i18n/
    en.json
    de.json
  marketing/
    en.json
    de.json
```

```typescript
const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  flatten: false,
  translationOptions: {
    translationsOutputDir: './src/translations',
  },
});
// result.translations contains merged data from all spreadsheets
```

#### Project manifest

```typescript
const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  createManifest: true,
  manifestPath: './src/translations/i18n-manifest.json',
  projectName: 'my-app-i18n',
  domain: 'https://example.com',
  defaultLocale: 'en',
  projectMetadata: { owner: 'team-i18n', version: '2.0' },
});

console.log(result.manifest?.locales); // ['de', 'en', 'fr']
```

#### Full Drive project setup

```typescript
const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  scanForSpreadsheets: true,
  spreadsheetNameFilter: /^i18n-/i,
  flatten: false,
  syncImages: true,
  imageOutputPath: './src/assets/remote-images',
  imageSyncOptions: { concurrency: 5, cleanSync: true },
  translationOptions: {
    translationsOutputDir: './src/translations',
    autoTranslate: false,
  },
  createManifest: true,
  projectName: 'my-app',
  domain: 'https://example.com',
  defaultLocale: 'en',
});

console.log(`Processed ${result.spreadsheetIds.length} spreadsheets`);
console.log(`Downloaded ${result.imageSync?.downloaded.length} images`);
console.log(`Available locales: ${result.manifest?.locales.join(', ')}`);
```
