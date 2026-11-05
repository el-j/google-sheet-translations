# syncDriveImages

Downloads image (and other asset) files from a Google Drive folder to a local
directory, preserving the subfolder structure. Replaces ad-hoc `rclone` or
`gsutil` scripts in consumer projects.

No new runtime dependencies — uses raw `fetch` with the existing
`google-auth-library` credential flow and Node.js built-ins.

## Signature

```typescript
function syncDriveImages(
  options: DriveImageSyncOptions,
): Promise<DriveImageSyncResult>
```

## Parameters

### `options`
- **Type**: [`DriveImageSyncOptions`](#driveimagesyncoptions)
- **Required**: yes

## Returns

`Promise<DriveImageSyncResult>` — see below.

---

## DriveImageSyncOptions

```typescript
interface DriveImageSyncOptions {
  /** Google Drive root folder ID to sync images from */
  folderId: string;

  /** Local directory to download images into (created if missing) */
  outputPath: string;

  /**
   * Only download files matching these MIME types.
   * Default: all common image formats (jpeg, png, webp, avif, gif, svg, tiff, bmp, ico)
   */
  mimeTypes?: string[];

  /** Recurse into sub-folders (default: true) */
  recursive?: boolean;

  /** Only sync sub-folders whose path matches this pattern */
  folderPattern?: RegExp;

  /** Service account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;

  /**
   * Delete local files that no longer exist in Drive.
   * Default: false
   */
  cleanSync?: boolean;

  /** Max concurrent downloads (default: 3) */
  concurrency?: number;

  /**
   * When `true` (default), a file that already exists locally is only
   * re-downloaded when Drive's `modifiedTime` is strictly newer than the
   * local file's last-modified timestamp. Files that have not changed in
   * Drive are skipped without a download.
   * When `false`, any file that already exists locally is always skipped
   * regardless of whether Drive has a newer version.
   */
  incrementalSync?: boolean;

  /**
   * When `true` (default), local filenames are written with lowercase
   * file extensions and `jpeg` is normalized to `jpg`.
   * Examples: `Photo.JPEG` → `Photo.jpg`, `banner.PNG` → `banner.png`.
   * Only the extension is changed; the base name is preserved as-is.
   */
  normalizeExtensions?: boolean;
}
```

## DriveImageSyncResult

```typescript
interface DriveImageSyncResult {
  /** Local paths of newly downloaded files */
  downloaded: string[];

  /** Files that already existed locally and were skipped */
  skipped: string[];

  /** Files deleted from local disk (only when cleanSync: true) */
  deleted: string[];

  /** Per-file download errors (non-fatal) */
  errors: string[];
}
```

---

## Examples

### Basic image sync

```typescript
import { syncDriveImages } from '@el-j/google-sheet-translations';

const result = await syncDriveImages({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  outputPath: './src/assets/remote-images',
});

console.log(`Downloaded: ${result.downloaded.length}`);
console.log(`Skipped:    ${result.skipped.length}`);
```

### High-concurrency sync with cleanup

```typescript
const result = await syncDriveImages({
  folderId: 'your-folder-id',
  outputPath: './public/images',
  concurrency: 8,
  cleanSync: true,  // remove stale local images
});
```

### Incremental sync — only changed or new files

By default, `incrementalSync: true` compares Drive's `modifiedTime` with the
local file's last-modified timestamp and skips files that have not changed:

```typescript
const result = await syncDriveImages({
  folderId: 'your-folder-id',
  outputPath: './public/images',
  // incrementalSync: true is the default — only downloads new / updated files
});

console.log(`Downloaded: ${result.downloaded.length}`);  // new + updated files
console.log(`Skipped:    ${result.skipped.length}`);     // already up-to-date
```

Set `incrementalSync: false` to use the original behaviour where any file that
already exists locally is always skipped:

```typescript
await syncDriveImages({
  folderId: 'your-folder-id',
  outputPath: './public/images',
  incrementalSync: false,  // never re-download an existing file
});
```

### Extension normalisation

`normalizeExtensions: true` (the default) ensures every downloaded file has a
lowercase extension, and `jpeg` / `JPEG` is written as `jpg`:

| Drive filename    | Local filename   |
|-------------------|------------------|
| `Photo.JPEG`      | `Photo.jpg`      |
| `banner.PNG`      | `banner.png`     |
| `icon.SVG`        | `icon.svg`       |
| `image.jpg`       | `image.jpg`      |

```typescript
// Default — normalisation is on
await syncDriveImages({ folderId: 'id', outputPath: './images', credentials });

// Opt out — keep original filenames exactly as they appear in Drive
await syncDriveImages({
  folderId: 'id',
  outputPath: './images',
  normalizeExtensions: false,
  credentials,
});
```

You can also use the `normalizeExtension` helper directly:

```typescript
import { normalizeExtension } from '@el-j/google-sheet-translations';

normalizeExtension('Photo.JPEG');      // 'Photo.jpg'
normalizeExtension('banner.PNG');      // 'banner.png'
normalizeExtension('image.jpg');       // 'image.jpg'
normalizeExtension('Makefile');        // 'Makefile' (no extension → unchanged)
```

### Specific MIME types only

```typescript
await syncDriveImages({
  folderId: 'your-folder-id',
  outputPath: './src/assets',
  mimeTypes: ['image/webp', 'image/avif'],
});
```

### Sync only a specific subfolder pattern

```typescript
await syncDriveImages({
  folderId: 'your-folder-id',
  outputPath: './src/assets/projects',
  folderPattern: /^projects\//,
});
```

### Integration with Vite image optimisation

After syncing, pass the output directory to any image optimisation plugin:

```typescript
// vite.config.ts
import { imagetools } from 'vite-imagetools';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default {
  plugins: [
    imagetools(),
    ViteImageOptimizer({
      test: /\.(jpe?g|png|webp|avif)$/i,
      jpeg: { quality: 75 },
      webp: { quality: 80 },
      avif: { quality: 70 },
      png: { quality: 80 },
    }),
  ],
};
```

Use `syncDriveImages` in a `prebuild` script so images are always fresh before
Vite runs:

```json
{
  "scripts": {
    "sync-images": "node scripts/sync-images.mjs",
    "prebuild": "npm run sync-images",
    "build": "vite build"
  }
}
```

```javascript
// scripts/sync-images.mjs
import { syncDriveImages } from '@el-j/google-sheet-translations';

await syncDriveImages({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  outputPath: './src/assets/remote-images',
  cleanSync: true,
});
```

---

## walkDirectory

Async file-tree walker — returns all file paths under a directory, optionally
filtered by extension.

### Signature

```typescript
function walkDirectory(
  dir: string,
  options?: WalkDirectoryOptions,
): Promise<string[]>
```

### WalkDirectoryOptions

```typescript
interface WalkDirectoryOptions {
  /**
   * Only include files whose extension (case-insensitive, with leading dot) is
   * in this list. Example: `['.jpg', '.png']`.
   * When omitted, all files are returned.
   */
  extensions?: string[];
}
```

### Example

```typescript
import { walkDirectory } from '@el-j/google-sheet-translations';

// All files
const all = await walkDirectory('./src/assets/remote-images');

// Only images
const images = await walkDirectory('./src/assets/remote-images', {
  extensions: ['.jpg', '.png', '.webp'],
});
console.log(`Found ${images.length} image files`);
```

---

## validateImageDirectory

Inspects a local image directory and checks that it has the expected nested
structure after a `syncDriveImages` call.

Useful as a post-sync guard in CI or as part of a `prebuild` script.

### Signature

```typescript
function validateImageDirectory(
  options: ImageDirectoryValidationOptions,
): Promise<ImageDirectoryValidationResult>
```

### ImageDirectoryValidationOptions

```typescript
interface ImageDirectoryValidationOptions {
  /** Path to the root image directory to inspect */
  rootDir: string;

  /**
   * Extensions (lower-case, with dot) treated as image files.
   * Defaults to DEFAULT_IMAGE_EXTENSIONS (jpg, jpeg, png, webp, avif, gif, svg, tiff, bmp, ico).
   */
  imageExtensions?: string[];

  /**
   * When false (default), image files found directly in rootDir are an error
   * — they usually indicate the sync inadvertently flattened the folder hierarchy.
   */
  allowRootFiles?: boolean;

  /**
   * Sub-folder names expected to be present in rootDir.
   * Missing names produce a warning (not an error).
   * Example: ['projects', 'performances', 'workshops']
   */
  expectedSubfolders?: string[];
}
```

### ImageDirectoryValidationResult

```typescript
interface ImageDirectoryValidationResult {
  /** true when no errors were found. Warnings do not affect this flag. */
  valid: boolean;
  /** Fatal problems that indicate incorrect state. */
  errors: string[];
  /** Non-fatal observations that may indicate a problem. */
  warnings: string[];
  /** Names of image files found directly in rootDir (not in sub-directories). */
  rootFiles: string[];
  /** Names of all direct sub-directories found in rootDir. */
  subfolders: string[];
}
```

### Example — post-sync validation script

```javascript
// scripts/check-images.mjs
import { validateImageDirectory } from '@el-j/google-sheet-translations';

const result = await validateImageDirectory({
  rootDir: './src/assets/remote-images',
  expectedSubfolders: ['projects', 'performances', 'workshops'],
});

for (const warn of result.warnings) {
  console.warn('⚠️', warn);
}

if (!result.valid) {
  for (const err of result.errors) {
    console.error('❌', err);
  }
  process.exit(1);
}

console.log('✅ Image directory structure looks good!');
console.log(`   Sub-folders: ${result.subfolders.join(', ')}`);
```

### Combining sync + validation

```javascript
// scripts/sync-and-validate.mjs
import {
  syncDriveImages,
  validateImageDirectory,
} from '@el-j/google-sheet-translations';

const syncResult = await syncDriveImages({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  outputPath: './src/assets/remote-images',
});

console.log(`Synced ${syncResult.downloaded.length} new/changed files`);

const validation = await validateImageDirectory({
  rootDir: './src/assets/remote-images',
  expectedSubfolders: ['projects', 'performances', 'workshops'],
});

if (!validation.valid) {
  console.error('Sync produced unexpected structure:', validation.errors);
  process.exit(1);
}
```
