## Goal
Create `src/utils/driveFolderScanner.ts` — a utility that scans a Google Drive folder to discover all spreadsheet files within it (including subfolders), returning their IDs and names so they can be passed to `getMultipleSpreadSheetsData`.

## Context
- **Repo**: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- **Auth utility**: `src/utils/auth.ts` — exports `createAuthClient(env?: GoogleEnvVars)` which returns a `JWT` client from `google-auth-library`. Look at how it works.
- **Types**: `src/types.ts` → `GoogleEnvVars` (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)
- **Existing deps**: `google-auth-library@^10.6.1` (already installed) — has `GoogleAuth`, `JWT`
- **Build**: `npm run build` → must pass
- **Test**: `npm test`
- **Drive API**: Uses Google Drive REST API v3 (https://www.googleapis.com/drive/v3) via plain `fetch` with Bearer token from `google-auth-library`. NO new packages needed.
- **Constraint**: Do NOT add `googleapis` as a dependency. Use raw `fetch` calls with the JWT token.

## Steps

### 1. Read `src/utils/auth.ts` to understand the auth pattern
```bash
cat /home/runner/work/google-sheet-translations/google-sheet-translations/src/utils/auth.ts
```

### 2. Create `src/utils/driveFolderScanner.ts`

The utility must:
1. Accept a `folderId` (Google Drive folder ID) and auth credentials
2. Use `google-auth-library` to get an access token (same approach as `auth.ts`)
3. Use `fetch` to call `https://www.googleapis.com/drive/v3/files` with the Bearer token
4. Recursively list spreadsheets in the folder AND subfolders
5. Return `DriveSpreadsheetFile[]`

```typescript
import type { GoogleEnvVars } from '../types';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  /** Relative path within the Drive folder (e.g., "subproject/translations") */
  folderPath: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface ScanDriveFolderOptions {
  /** Google Drive folder ID to scan */
  folderId: string;
  /** Whether to recursively scan subfolders (default: true) */
  recursive?: boolean;
  /** Only return spreadsheets with names matching this pattern (optional) */
  nameFilter?: RegExp;
  /** Google service account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;
}

/**
 * Scans a Google Drive folder for Google Spreadsheet files.
 * Returns all spreadsheets found (recursively by default).
 * Uses Drive API v3 via authenticated fetch (no googleapis package needed).
 */
export async function scanDriveFolderForSpreadsheets(
  options: ScanDriveFolderOptions
): Promise<DriveSpreadsheetFile[]>
```

**Implementation details for `scanDriveFolderForSpreadsheets`:**
- Auth: Use `google-auth-library` `GoogleAuth` or `JWT` to get a bearer token. Look at how `auth.ts` uses `GoogleAuth`. The scopes needed are: `['https://www.googleapis.com/auth/drive.readonly']`
- Credentials: Get from `options.credentials` → fallback to env `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY`
- Drive API call: `GET https://www.googleapis.com/drive/v3/files?q=...&fields=files(id,name,mimeType,modifiedTime,parents)&pageToken=...`
- Query for spreadsheets: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
- Query for subfolders: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
- Handle pagination: follow `nextPageToken` until exhausted
- When `recursive: true` (default): also recurse into subfolders, track `folderPath` 
- Apply `nameFilter` if provided
- Log progress: `console.log('[driveFolderScanner] Scanning folder: ...')`

**Error handling:**
- If Drive API returns non-2xx: throw descriptive error with status + message
- If credentials missing: throw `Error('Google Drive credentials required: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY')`

### 3. Create `tests/utils/driveFolderScanner.test.ts`

Mock the global `fetch` and `google-auth-library`. Tests to include:
- Returns empty array when folder has no spreadsheets
- Returns spreadsheets found in root folder
- Recursively scans subfolders and builds correct `folderPath`
- Applies `nameFilter` correctly
- Follows pagination (`nextPageToken`)
- Non-recursive mode: does NOT recurse into subfolders
- Throws on missing credentials
- Throws on Drive API error response (non-2xx)
- Handles duplicate IDs (deduplication)

Pattern for mocking fetch:
```typescript
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ files: [...], nextPageToken: undefined })
});
```

For google-auth-library mock:
```typescript
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));
```

### 4. Export from `src/index.ts`
Add:
```typescript
export { scanDriveFolderForSpreadsheets } from './utils/driveFolderScanner'
export type { DriveSpreadsheetFile, ScanDriveFolderOptions } from './utils/driveFolderScanner'
```

### 5. Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npm run build && npx jest tests/utils/driveFolderScanner.test.ts --no-coverage
```

## Acceptance criteria
- [ ] `scanDriveFolderForSpreadsheets` exported from dist
- [ ] Types `DriveSpreadsheetFile` and `ScanDriveFolderOptions` exported
- [ ] No new runtime dependencies added (uses existing `google-auth-library` + `fetch`)
- [ ] 8+ test cases, all passing
- [ ] Build succeeds with 0 TypeScript errors
- [ ] No existing tests broken
