# Google Drive Folder Management

The package can act as a **headless CMS bridge** between Google Drive and your
static build pipeline. Point it at a Drive folder and it will:

1. **Auto-discover** every Google Spreadsheet in the folder (and sub-folders)
2. **Fetch & merge** all translations into one `TranslationData` object
3. **Download images** from the same folder to a local asset directory

This is ideal for large projects with many sub-projects, each having its own
translation spreadsheet, all living under one shared Drive folder.

---

## Quick start

```typescript
import { manageDriveTranslations } from '@el-j/google-sheet-translations';

const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,

  // auto-discover all spreadsheets in the folder
  scanForSpreadsheets: true,

  // only process sheets whose name matches this pattern
  spreadsheetNameFilter: /^i18n-/i,

  // also download images from Drive
  syncImages: true,
  imageOutputPath: './src/assets/remote-images',

  // options forwarded to each spreadsheet fetch
  translationOptions: {
    translationsOutputDir: './src/translations',
    autoTranslate: false,
  },
});

console.log(result.translations);
// → { 'en-GB': { home: {...}, about: {...} }, 'de-DE': { ... } }

console.log(result.imageSync?.downloaded.length, 'images downloaded');
```

---

## Environment variables

You need the same service-account credentials as for single-spreadsheet mode,
plus the Drive folder ID:

```dotenv
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

The `driveFolderId` option overrides the `GOOGLE_DRIVE_FOLDER_ID` env var if
both are set.

---

## Multiple spreadsheets without Drive scanning

If you know your spreadsheet IDs upfront, skip Drive scanning and pass them
directly:

```typescript
import { getMultipleSpreadSheetsData } from '@el-j/google-sheet-translations';

const translations = await getMultipleSpreadSheetsData(['home', 'about'], {
  spreadsheetIds: [
    '1abc…_main_site',
    '1def…_blog',
    '1ghi…_shop',
  ],
  mergeStrategy: 'later-wins', // default
});
```

Each spreadsheet is fetched in sequence (to respect API rate limits) and the
results are deep-merged by locale → sheet → key.

### Merge strategies

| Strategy | Behaviour |
|----------|-----------|
| `'later-wins'` (default) | Keys from spreadsheets listed later override earlier ones |
| `'first-wins'` | The first spreadsheet that defines a key wins; later ones are ignored |

---

## Drive folder scanner

Discover spreadsheets in a Drive folder without fetching translations:

```typescript
import { scanDriveFolderForSpreadsheets } from '@el-j/google-sheet-translations';

const sheets = await scanDriveFolderForSpreadsheets({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  recursive: true,           // include sub-folders (default: true)
  nameFilter: /^translations-/i,
});

console.log(sheets);
// → [{ id: '1abc…', name: 'translations-home', folderPath: 'projects/website' }, …]
```

The scanner follows pagination automatically and works with any folder depth.

---

## Image sync

Replace a custom `rclone` or `gsutil` script with the built-in image sync:

```typescript
import { syncDriveImages } from '@el-j/google-sheet-translations';

const result = await syncDriveImages({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  outputPath: './src/assets/remote-images',

  // only download image formats (defaults to all common image types)
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],

  // limit concurrent downloads (default: 3)
  concurrency: 5,

  // delete local files that no longer exist in Drive
  cleanSync: true,

  // only sync files inside sub-folders matching this pattern
  folderPattern: /^projects\//,
});

console.log(result.downloaded); // ['src/assets/remote-images/projects/hero.jpg', …]
console.log(result.skipped);    // already-present files that were not re-downloaded
console.log(result.deleted);    // files removed because they were gone from Drive
console.log(result.errors);     // per-file errors (never fatal)
```

The subfolder hierarchy from Drive is preserved in the local output path.

---

## GitHub Action

The GitHub Action exposes all Drive features as workflow inputs:

```yaml
- uses: el-j/google-sheet-translations@main
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    sheet-titles: 'home,about,common'

    # ── Drive folder management ──────────────────────────────
    drive-folder-id: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
    scan-for-spreadsheets: 'true'          # auto-discover all spreadsheets
    spreadsheet-ids: '1abc…,1def…'         # optional: explicit additional IDs
    sync-images: 'true'                    # download images from Drive
    image-output-path: './public/images'   # where to put downloaded images
```

When `drive-folder-id` **or** `spreadsheet-ids` is set, the action calls
`manageDriveTranslations` instead of `getSpreadSheetData`.
The existing single-spreadsheet path is unchanged when neither input is set.

---

## Folder structure example

```
📁 My Drive
└── 📁 MyPortfolio                   ← drive-folder-id points here
    ├── 📄 i18n-main (spreadsheet)
    ├── 📄 i18n-blog (spreadsheet)
    ├── 📁 projects
    │   ├── 📄 i18n-projectA (spreadsheet)
    │   └── 📄 i18n-projectB (spreadsheet)
    └── 📁 images
        ├── 📁 hero
        │   └── 🖼 hero.webp
        └── 📁 projects
            ├── 🖼 projectA-cover.jpg
            └── 🖼 projectB-cover.png
```

```typescript
await manageDriveTranslations({
  driveFolderId: 'root-folder-id',
  spreadsheetNameFilter: /^i18n-/i,   // skip non-translation sheets
  syncImages: true,
  imageOutputPath: './src/assets/remote-images',
  imageSyncOptions: {
    folderPattern: /^images\//,
    concurrency: 4,
    cleanSync: true,
  },
  translationOptions: {
    translationsOutputDir: './src/translations',
  },
});
```

---

## API reference

| Function | Description |
|----------|-------------|
| [`manageDriveTranslations`](/api/manage-drive-translations) | Top-level orchestrator — scan, fetch, sync images |
| [`getMultipleSpreadSheetsData`](/api/get-multiple-spreadsheets-data) | Fetch from multiple spreadsheet IDs |
| [`scanDriveFolderForSpreadsheets`](/api/drive-folder-scanner) | List spreadsheet files in a Drive folder |
| [`syncDriveImages`](/api/drive-image-sync) | Download images from a Drive folder |
