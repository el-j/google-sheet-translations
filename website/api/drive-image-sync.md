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
