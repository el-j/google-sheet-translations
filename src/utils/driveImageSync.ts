import { createWriteStream, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { GoogleAuth } from 'google-auth-library';
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
   * Subfolder filter pattern. If provided, only subfolders whose relative path
   * (from the root folderId) matches this pattern will be synced.
   * The pattern is tested against the full relative path, e.g. "projects/icons".
   * Useful for patterns like `/^projects\//` or `/icons$/`.
   */
  folderPattern?: RegExp;
  /** Google service account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;
  /** If true, delete local files that no longer exist in Drive (default: false) */
  cleanSync?: boolean;
  /** Max concurrent downloads (default: 3) */
  concurrency?: number;
  /**
   * When `true` (default), a file that already exists locally is re-downloaded
   * only when Drive's `modifiedTime` is strictly newer than the local file's
   * last-modified timestamp. This avoids re-downloading unchanged assets on
   * every run. When `false`, any file that already exists locally is always
   * skipped regardless of whether Drive has a newer version.
   */
  incrementalSync?: boolean;
  /**
   * When `true` (default), local filenames are written with lowercase file
   * extensions and `jpeg` is normalized to `jpg`.
   * Examples: `Photo.JPEG` → `Photo.jpg`, `banner.PNG` → `banner.png`,
   *           `icon.Svg` → `icon.svg`.
   * Applies only to the extension; the base name is left unchanged.
   */
  normalizeExtensions?: boolean;
}

export interface DriveImageSyncResult {
  downloaded: string[];
  skipped: string[];
  deleted: string[];
  errors: string[];
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

interface DriveFilesResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

interface FileEntry {
  id: string;
  name: string;
  localPath: string;
  mimeType: string;
  driveModifiedTime?: string;
}

const DEFAULT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/ico',
  'image/x-icon',
];

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

/**
 * Normalises a filename's extension:
 * - Converts the extension to lowercase
 * - Canonicalises `jpeg` → `jpg`
 *
 * The base name is left unchanged so that `MyPhoto.JPEG` becomes `MyPhoto.jpg`.
 */
export function normalizeExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return name;
  const base = name.slice(0, dot);
  let ext = name.slice(dot + 1).toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  return `${base}.${ext}`;
}

async function getAccessToken(credentials?: GoogleEnvVars): Promise<string> {
  const clientEmail =
    credentials?.GOOGLE_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    credentials?.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials required: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY'
    );
  }

  const normalizedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: normalizedKey },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token as string;
}

async function listFilesInFolder(
  folderId: string,
  token: string,
  mimeTypeFilter?: string
): Promise<DriveFile[]> {
  const results: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const mimeClause = mimeTypeFilter
      ? ` and mimeType = '${mimeTypeFilter}'`
      : '';
    const query = `'${folderId}' in parents${mimeClause} and trashed = false`;
    const params = new URLSearchParams({
      q: query,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,parents)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Drive API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as DriveFilesResponse;
    results.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

async function collectFiles(
  folderId: string,
  folderRelPath: string,
  outputPath: string,
  token: string,
  allowedMimeTypes: string[],
  recursive: boolean,
  folderPattern?: RegExp,
  normalizeExts = true
): Promise<FileEntry[]> {
  console.log(`[driveImageSync] Scanning folder: ${folderId} (path: "${folderRelPath}")`);

  const allItems = await listFilesInFolder(folderId, token);
  const entries: FileEntry[] = [];

  for (const item of allItems) {
    if (item.mimeType === FOLDER_MIME) {
      if (!recursive) continue;
      const subRelPath = folderRelPath ? `${folderRelPath}/${item.name}` : item.name;
      if (folderPattern && !folderPattern.test(subRelPath)) continue;
      const subEntries = await collectFiles(
        item.id,
        subRelPath,
        outputPath,
        token,
        allowedMimeTypes,
        recursive,
        folderPattern,
        normalizeExts
      );
      entries.push(...subEntries);
    } else if (allowedMimeTypes.includes(item.mimeType)) {
      const localName = normalizeExts ? normalizeExtension(item.name) : item.name;
      const localPath = folderRelPath
        ? join(outputPath, folderRelPath, localName)
        : join(outputPath, localName);
      entries.push({
        id: item.id,
        name: item.name,
        localPath,
        mimeType: item.mimeType,
        driveModifiedTime: item.modifiedTime,
      });
    }
  }

  return entries;
}

async function downloadFile(fileId: string, localPath: string, token: string): Promise<void> {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    throw new Error(`Failed to download ${fileId}: ${response.status}`);
  }

  mkdirSync(dirname(localPath), { recursive: true });
  const dest = createWriteStream(localPath);
  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), dest);
}

function collectLocalFiles(dir: string, base: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectLocalFiles(fullPath, base));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map((t) => t());
    results.push(...(await Promise.all(batch)));
  }
  return results;
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
 *   credentials: { GOOGLE_CLIENT_EMAIL: '...', GOOGLE_PRIVATE_KEY: '...', GOOGLE_SPREADSHEET_ID: '' }
 * });
 */
export async function syncDriveImages(
  options: DriveImageSyncOptions
): Promise<DriveImageSyncResult> {
  const {
    folderId,
    outputPath,
    mimeTypes = DEFAULT_IMAGE_MIME_TYPES,
    recursive = true,
    folderPattern,
    credentials,
    cleanSync = false,
    concurrency = 3,
    incrementalSync = true,
    normalizeExtensions = true,
  } = options;

  const token = await getAccessToken(credentials);

  mkdirSync(outputPath, { recursive: true });

  const entries = await collectFiles(
    folderId,
    '',
    outputPath,
    token,
    mimeTypes,
    recursive,
    folderPattern,
    normalizeExtensions
  );

  const downloaded: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const tasks = entries.map((entry) => async () => {
    const localExists = existsSync(entry.localPath);

    if (localExists) {
      if (incrementalSync && entry.driveModifiedTime) {
        // Compare Drive's modifiedTime with the local file's mtime.
        // Re-download only when Drive is strictly newer.
        try {
          const localMtimeMs = statSync(entry.localPath).mtimeMs;
          const driveMtimeMs = new Date(entry.driveModifiedTime).getTime();
          if (driveMtimeMs <= localMtimeMs) {
            console.log(`[driveImageSync] Skipping (up to date): ${entry.localPath}`);
            skipped.push(entry.localPath);
            return;
          }
          console.log(`[driveImageSync] Re-downloading (changed in Drive): ${entry.localPath}`);
        } catch {
          // If stat fails for any reason, proceed to download to be safe.
          console.log(`[driveImageSync] Downloading (could not stat local): ${entry.localPath}`);
        }
      } else {
        // incrementalSync disabled or no modifiedTime available → skip existing files.
        console.log(`[driveImageSync] Skipping (exists): ${entry.localPath}`);
        skipped.push(entry.localPath);
        return;
      }
    }

    console.log(`[driveImageSync] Downloading: ${entry.localPath}`);
    try {
      await downloadFile(entry.id, entry.localPath, token);
      downloaded.push(entry.localPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[driveImageSync] Error downloading ${entry.localPath}: ${msg}`);
      errors.push(entry.localPath);
    }
  });

  await runConcurrent(tasks, concurrency);

  const deleted: string[] = [];
  if (cleanSync) {
    const driveLocalPaths = new Set(entries.map((e) => e.localPath));
    const localFiles = collectLocalFiles(outputPath, outputPath);
    for (const localFile of localFiles) {
      if (!driveLocalPaths.has(localFile)) {
        console.log(`[driveImageSync] Deleting (not in Drive): ${localFile}`);
        unlinkSync(localFile);
        deleted.push(localFile);
      }
    }
  }

  console.log(
    `[driveImageSync] Synced ${downloaded.length} files, skipped ${skipped.length}, deleted ${deleted.length}, errors ${errors.length}`
  );

  return { downloaded, skipped, deleted, errors };
}
