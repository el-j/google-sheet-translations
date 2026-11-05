# Drive Project Index API

Utilities for building, reading, and writing `i18n-manifest.json` project manifests when managing multiple spreadsheets or Google Docs inside Google Drive folders.

```typescript
import {
  buildManifest,
  writeManifest,
  readManifest,
  type DriveProjectManifest,
  type SpreadsheetManifestEntry,
  type DocManifestEntry
} from '@el-j/google-sheet-translations';
```

---

## Functions

### `buildManifest(options)`

Constructs a structured `DriveProjectManifest` indexing all discovered spreadsheets, ingested Google Docs, locales, and directory mappings.

```typescript
function buildManifest(
  options: BuildManifestOptions
): DriveProjectManifest
```

---

### `writeManifest(manifest, outputPath)`

Writes the manifest object to the designated JSON file path.

```typescript
function writeManifest(
  manifest: DriveProjectManifest,
  outputPath: string
): void
```

---

### `readManifest(manifestPath)`

Reads and parses an existing manifest JSON file. Returns `undefined` if file does not exist or contains invalid JSON.

```typescript
function readManifest(
  manifestPath: string
): DriveProjectManifest | undefined
```
