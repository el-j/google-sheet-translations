# Doc Ingester API

Functions and types for exporting Google Docs and ingesting them into Google Spreadsheets.

```typescript
import {
  ingestDoc,
  exportDoc,
  entriesToSeedKeys,
  entriesToTranslationData
} from '@el-j/google-sheet-translations';
```

---

## Functions

### `ingestDoc(docFile, options?)`

Ingests a single Google Doc file into a Google Spreadsheet. In create mode, creates a new spreadsheet and seeds the document keys. In refresh mode, updates existing keys with new content.

```typescript
function ingestDoc(
  docFile: DriveDocFile,
  options?: DocIngesterOptions
): Promise<DocIngestResult>
```

#### Parameters

- `docFile` (`DriveDocFile`): Discovered Google Doc file descriptor from `scanDriveFolderForDocs`.
- `options` (`DocIngesterOptions`):
  - `updateMode` (`'create-if-missing' | 'refresh-if-newer' | 'always-refresh'`): Ingestion update strategy. Default: `'create-if-missing'`.
  - `keyStrategy` (`'heading' | 'marker' | 'numbered'`): Markdown parsing strategy. Default: `'heading'`.
  - `existingEntry` (`DocManifestEntry`): Prior ingestion manifest entry for incremental comparison.
  - `credentials` (`GoogleEnvVars`): Service account credentials.

#### Returns

`Promise<DocIngestResult>`:
```typescript
interface DocIngestResult {
  action: 'created' | 'refreshed' | 'skipped';
  entry: DocManifestEntry;
}
```

---

### `exportDoc(fileId, credentials?)`

Exports a Google Doc as a Markdown text string via Google Drive API v3.

```typescript
function exportDoc(
  fileId: string,
  credentials?: GoogleEnvVars
): Promise<string>
```

---

### `entriesToSeedKeys(entries)`

Converts parsed doc entries to a map of sheet-prefixed keys suitable for `createSpreadsheet`.

```typescript
function entriesToSeedKeys(
  entries: ParsedDocEntry[]
): Record<string, string>
```
