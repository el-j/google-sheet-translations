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
