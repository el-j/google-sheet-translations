import { GoogleAuth } from 'google-auth-library';
import type { GoogleEnvVars } from '../types';

export interface DriveDocFile {
  /** Google Drive file ID */
  id: string;
  /** Human-readable file name (no extension for Google Docs) */
  name: string;
  /** Relative path within the Drive folder (e.g. "subproject/copy") */
  folderPath: string;
  mimeType: string;
  /** ISO timestamp of last Drive modification */
  modifiedTime?: string;
  /**
   * Locale inferred from the filename using the `_[lang]` suffix convention.
   * E.g. `"myapp_en"` → `"en"`, `"landing_zh-TW"` → `"zh-TW"`.
   * `undefined` when the filename contains no recognisable locale suffix.
   */
  sourceLocale?: string;
}

export interface ScanDriveFolderForDocsOptions {
  /** Google Drive folder ID to scan */
  folderId: string;
  /** Whether to recursively scan sub-folders (default: true) */
  recursive?: boolean;
  /** Only return docs whose names match this pattern (optional) */
  nameFilter?: RegExp;
  /** Google service-account credentials (falls back to env vars) */
  credentials?: GoogleEnvVars;
}

// ── Internal types ────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_MIME = 'application/vnd.google-apps.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAccessToken(credentials?: GoogleEnvVars): Promise<string> {
  const clientEmail =
    credentials?.GOOGLE_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    credentials?.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive credentials required: GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY',
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

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function listFilesInFolder(
  folderId: string,
  mimeType: string,
  token: string,
): Promise<DriveFile[]> {
  const results: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = `'${folderId}' in parents and mimeType = '${mimeType}' and trashed = false`;
    const params = new URLSearchParams({
      q: query,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
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

// ── Locale inference ──────────────────────────────────────────────────────────

/**
 * Infers a locale code from a Google Doc filename using the `_[lang]` suffix
 * convention:
 *
 * - `"myapp_en"`       → `"en"`
 * - `"landing-page_de"` → `"de"`
 * - `"site_zh-TW"`    → `"zh-TW"`
 * - `"project_fr-FR"` → `"fr-FR"`
 *
 * Returns `undefined` when the filename contains no recognisable locale suffix.
 */
export function inferLocaleFromDocName(name: string): string | undefined {
  // Strip any file extension (Google Docs normally have none, but be defensive)
  const baseName = name.replace(/\.[^.]+$/, '');

  // Match _[lang] or _[lang-REGION] at the very end of the base name
  const match = baseName.match(/_([a-zA-Z]{2,3}(?:[-_][a-zA-Z]{2,4})?)$/);
  if (!match) return undefined;

  const candidate = match[1].replace('_', '-');

  const parts = candidate.split('-');
  if (parts.length === 2) {
    // Normalise to BCP-47 form: lang lowercase, REGION uppercase (e.g. zh-TW)
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }
  return parts[0].toLowerCase();
}

// ── Recursive folder scanner ──────────────────────────────────────────────────

async function scanFolder(
  folderId: string,
  folderPath: string,
  token: string,
  recursive: boolean,
  nameFilter?: RegExp,
  seen = new Set<string>(),
): Promise<DriveDocFile[]> {
  console.log(
    `[driveDocScanner] Scanning folder: ${folderId} (path: "${folderPath}")`,
  );

  const docs = await listFilesInFolder(folderId, DOC_MIME, token);
  const results: DriveDocFile[] = [];

  for (const file of docs) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);

    if (nameFilter && !nameFilter.test(file.name)) continue;

    results.push({
      id: file.id,
      name: file.name,
      folderPath,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      sourceLocale: inferLocaleFromDocName(file.name),
    });
  }

  if (recursive) {
    const subfolders = await listFilesInFolder(folderId, FOLDER_MIME, token);
    for (const folder of subfolders) {
      const subPath = folderPath
        ? `${folderPath}/${folder.name}`
        : folder.name;
      const subResults = await scanFolder(
        folder.id,
        subPath,
        token,
        recursive,
        nameFilter,
        seen,
      );
      results.push(...subResults);
    }
  }

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scans a Google Drive folder for Google Document files.
 *
 * Each discovered document is returned with its Drive metadata plus an
 * inferred `sourceLocale` derived from the filename `_[lang]` suffix
 * convention (e.g. `"myapp_en"` → `"en"`).
 *
 * @example
 * ```ts
 * const docs = await scanDriveFolderForDocs({
 *   folderId: 'your-drive-folder-id',
 *   nameFilter: /^content_/,
 * });
 * // docs[0].sourceLocale === 'en'  (if name is "content_en")
 * ```
 */
export async function scanDriveFolderForDocs(
  options: ScanDriveFolderForDocsOptions,
): Promise<DriveDocFile[]> {
  const { folderId, recursive = true, nameFilter, credentials } = options;
  const token = await getAccessToken(credentials);
  return scanFolder(folderId, '', token, recursive, nameFilter);
}
