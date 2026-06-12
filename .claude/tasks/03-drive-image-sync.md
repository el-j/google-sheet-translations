## Goal
Create `src/utils/driveImageSync.ts` — a utility that downloads images (and other assets) from a Google Drive folder to a local directory, preserving the subfolder structure. This replaces the rclone-based `pull-images.mjs` workflow consumers use.

## Context
- **Repo**: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- **Auth pattern**: Same as `src/utils/driveFolderScanner.ts` — use `google-auth-library` + raw `fetch`  
  (Read `.claude/tasks/02-drive-folder-scanner.md` AND `src/utils/auth.ts` for the auth pattern)
- **Types**: `src/types.ts` → `GoogleEnvVars`
- **Existing deps**: `google-auth-library@^10.6.1`, `node:fs`, `node:path`, `node:stream` all available
- **Drive API**:
  - List files: `GET https://www.googleapis.com/drive/v3/files?q=...` 
  - Download: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
- **Constraint**: Do NOT add `googleapis` package. Use raw `fetch` + `node:fs` + `node:stream`.
- **Build**: `npm run build` → must pass; **Test**: `npm test`

## Steps

### 1. Read existing auth pattern
```bash
cat /home/runner/work/google-sheet-translations/google-sheet-translations/src/utils/auth.ts
cat /home/runner/work/google-sheet-translations/google-sheet-translations/src/utils/driveFolderScanner.ts
```

### 2. Create `src/utils/driveImageSync.ts`

Types:
```typescript
import type { GoogleEnvVars } from '../types';

export interface DriveImageSyncOptions {
  /** Google Drive root folder ID to sync images from */
  folderId: string;
  /** Local directory to download images into (will be created if missing) */
  outputPath: string;
  /** Only download files matching these MIME types (default: all image types) */
  mimeTypes?: string[];
  /** Whether to recursively sync subfolders (default: true) */
  recursive?: boolean;
  /**
   * Subfolder filter pattern. If provided, only subfolders matching this
   * pattern will be synced. Useful for patterns like "projects/*".
   */
  folderPattern?: RegExp;
  /** Google service account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;
  /** If true, delete local files that no longer exist in Drive (default: false) */
  cleanSync?: boolean;
  /** Max concurrent downloads (default: 3) */
  concurrency?: number;
}

export interface DriveImageSyncResult {
  downloaded: string[];  // Local paths of newly downloaded files
  skipped: string[];     // Files that already existed and were not re-downloaded
  deleted: string[];     // Files deleted (only if cleanSync: true)
  errors: string[];      // Files that failed to download
}

/**
 * Syncs images from a Google Drive folder to a local directory.
 * Preserves subfolder structure. Uses Drive API v3 via fetch.
 *
 * @example
 * await syncDriveImages({
 *   folderId: 'your-drive-folder-id',
 *   outputPath: './src/assets/remote-images',
 *   recursive: true,
 *   credentials: { clientEmail: '...', privateKey: '...' }
 * });
 */
export async function syncDriveImages(
  options: DriveImageSyncOptions
): Promise<DriveImageSyncResult>
```

**Default `mimeTypes`:**
```typescript
const DEFAULT_IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/avif', 'image/gif', 'image/svg+xml', 'image/tiff',
  'image/bmp', 'image/ico', 'image/x-icon'
];
```

**Implementation steps in `syncDriveImages`:**
1. Validate credentials, get access token (same auth pattern as driveFolderScanner)
2. Create `outputPath` directory if not exists (use `fs.mkdirSync(path, { recursive: true })`)
3. List all files in the folder (recursively if `recursive: true`):
   - List items in folder: both files (matching mimeTypes) AND subfolders
   - Apply `folderPattern` filter to subfolders
   - Build a flat list of `{ id, name, localPath, mimeType }` with correct relative paths
4. Download files:
   - Check if local file exists (skip if exists, unless a future `force` option)
   - Download in batches of `concurrency` (default 3) using Promise.all on chunks
   - Stream download: `GET /drive/v3/files/{id}?alt=media` → write to local file
   - Use `node:stream` for piping response to file: `Readable.fromWeb(response.body).pipe(fs.createWriteStream(localPath))`
   - Ensure parent directories exist before writing
5. If `cleanSync: true`: scan local directory, delete files not in Drive listing
6. Log progress throughout: `[driveImageSync] Downloading: ...`, `[driveImageSync] Synced X files, skipped Y`
7. Return `DriveImageSyncResult`

**Error handling:**
- Individual file download failures → add to `errors[]`, continue (don't throw)
- Auth / API failures → throw descriptive error
- Handle Node.js compatibility: use `node:fs`, `node:path`, `node:stream`

### 3. Create `tests/utils/driveImageSync.test.ts`

Mock `fetch`, `google-auth-library`, and `node:fs` operations. Tests to include:
- Downloads files and returns correct result counts
- Skips existing files (doesn't re-download)
- Recursively traverses subfolders, preserves folder structure in local paths
- Applies `folderPattern` filter
- `cleanSync: true` deletes files not in Drive
- Handles individual download errors gracefully (adds to `errors`, doesn't throw)
- Creates output directory if it doesn't exist
- Respects `concurrency` limit
- Throws on missing credentials
- Returns empty result for empty folder

For file system mocking:
```typescript
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    on: jest.fn((event, cb) => { if (event === 'finish') cb(); }),
    end: jest.fn()
  }),
  readdirSync: jest.fn().mockReturnValue([]),
  unlinkSync: jest.fn()
}));
```

### 4. Export from `src/index.ts`
Add:
```typescript
export { syncDriveImages } from './utils/driveImageSync'
export type { DriveImageSyncOptions, DriveImageSyncResult } from './utils/driveImageSync'
```

### 5. Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npm run build && npx jest tests/utils/driveImageSync.test.ts --no-coverage
```

## Acceptance criteria
- [ ] `syncDriveImages` exported from dist
- [ ] Types `DriveImageSyncOptions` and `DriveImageSyncResult` exported
- [ ] No new runtime dependencies (uses `google-auth-library` + Node.js built-ins + `fetch`)
- [ ] 8+ test cases, all passing
- [ ] Build succeeds with 0 TypeScript errors
- [ ] No existing tests broken
