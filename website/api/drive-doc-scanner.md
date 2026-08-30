# Drive Doc Scanner API

Functions for discovering Google Docs inside Google Drive folders and inferring source locales from document filenames.

```typescript
import { scanDriveFolderForDocs, inferLocaleFromDocName } from '@el-j/google-sheet-translations';
```

---

## Functions

### `scanDriveFolderForDocs(options)`

Scans a Google Drive folder recursively for Google Docs (`application/vnd.google-apps.document`).

```typescript
function scanDriveFolderForDocs(
  options: ScanDriveFolderForDocsOptions
): Promise<DriveDocFile[]>
```

#### Parameters

- `options` (`ScanDriveFolderForDocsOptions`):
  - `folderId` (`string`): Google Drive root folder ID.
  - `recursive` (`boolean`): Whether to scan subfolders recursively. Default: `true`.
  - `docNameFilter` (`RegExp`): Optional regular expression to filter document filenames.
  - `credentials` (`GoogleEnvVars`): Optional Google service account credentials.

#### Returns

`Promise<DriveDocFile[]>`:
```typescript
interface DriveDocFile {
  id: string;
  name: string;
  folderPath: string;
  mimeType: string;
  modifiedTime?: string;
  sourceLocale?: string;
}
```

---

### `inferLocaleFromDocName(filename)`

Infers the source locale code from a document filename by inspecting trailing `_[locale]` suffixes (e.g. `homepage_en` $\rightarrow$ `'en'`, `privacy_policy_zh-TW` $\rightarrow$ `'zh-TW'`).

```typescript
function inferLocaleFromDocName(filename: string): string | undefined
```
