# scanDriveFolderForSpreadsheets

Scans a Google Drive folder (recursively by default) for all Google Spreadsheet files
and returns their metadata. Use the returned IDs with
[`getMultipleSpreadSheetsData`](/api/get-multiple-spreadsheets-data) or
[`manageDriveTranslations`](/api/manage-drive-translations).

No new runtime dependencies — uses raw `fetch` with the existing
`google-auth-library` credential flow.

## Signature

```typescript
function scanDriveFolderForSpreadsheets(
  options: ScanDriveFolderOptions,
): Promise<DriveSpreadsheetFile[]>
```

## Parameters

### `options`
- **Type**: [`ScanDriveFolderOptions`](#scandrivefolderoptions)
- **Required**: yes

## Returns

`Promise<DriveSpreadsheetFile[]>` — one entry per spreadsheet discovered.

---

## ScanDriveFolderOptions

```typescript
interface ScanDriveFolderOptions {
  /** Google Drive folder ID to scan */
  folderId: string;

  /** Recurse into sub-folders (default: true) */
  recursive?: boolean;

  /** Only return spreadsheets whose name matches this regex */
  nameFilter?: RegExp;

  /** Service account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;
}
```

## DriveSpreadsheetFile

```typescript
interface DriveSpreadsheetFile {
  id: string;
  name: string;
  /** Relative path within the Drive folder, e.g. "projects/website" */
  folderPath: string;
  mimeType: string;
  modifiedTime?: string;
}
```

---

## Examples

### List all spreadsheets in a folder

```typescript
import { scanDriveFolderForSpreadsheets } from '@el-j/google-sheet-translations';

const sheets = await scanDriveFolderForSpreadsheets({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
});

for (const sheet of sheets) {
  console.log(`${sheet.folderPath}/${sheet.name}  →  ${sheet.id}`);
}
```

### Filter by name

```typescript
const translationSheets = await scanDriveFolderForSpreadsheets({
  folderId: 'your-folder-id',
  nameFilter: /^i18n-/i,
});
```

### Non-recursive (top-level only)

```typescript
const topLevel = await scanDriveFolderForSpreadsheets({
  folderId: 'your-folder-id',
  recursive: false,
});
```

### Explicit credentials

```typescript
const sheets = await scanDriveFolderForSpreadsheets({
  folderId: 'your-folder-id',
  credentials: {
    GOOGLE_CLIENT_EMAIL: 'svc@project.iam.gserviceaccount.com',
    GOOGLE_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\n…',
    GOOGLE_SPREADSHEET_ID: '',
  },
});
```
