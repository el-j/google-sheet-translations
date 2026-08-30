import type { GoogleEnvVars } from '../types';
import { buildGoogleAuth, normalizePrivateKey } from './auth';

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

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

async function getAccessToken(credentials?: GoogleEnvVars): Promise<string> {
  const clientEmail =
    credentials?.GOOGLE_CLIENT_EMAIL ?? process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    credentials?.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY;

  let driveCredentials: { client_email: string; private_key: string } | undefined;

  if (clientEmail && privateKey) {
    driveCredentials = { client_email: clientEmail, private_key: normalizePrivateKey(privateKey) };
  } else if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Google Drive credentials required: set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY, ' +
      'or set GOOGLE_APPLICATION_CREDENTIALS for Workload Identity Federation.'
    );
  }

  // WIF / ADC path (driveCredentials is undefined) or service-account key path
  const auth = buildGoogleAuth(DRIVE_SCOPES, driveCredentials);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token as string;
}

async function listFilesInFolder(
  folderId: string,
  mimeType: string,
  token: string
): Promise<DriveFile[]> {
  const results: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = `'${folderId}' in parents and mimeType = '${mimeType}' and trashed = false`;
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
      throw new Error(
        `Drive API error ${response.status}: ${text}`
      );
    }

    const data = (await response.json()) as DriveFilesResponse;
    results.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

async function scanFolder(
  folderId: string,
  folderPath: string,
  token: string,
  recursive: boolean,
  nameFilter?: RegExp,
  seen = new Set<string>()
): Promise<DriveSpreadsheetFile[]> {
  console.log(`[driveFolderScanner] Scanning folder: ${folderId} (path: "${folderPath}")`);

  const spreadsheets = await listFilesInFolder(folderId, SPREADSHEET_MIME, token);
  const results: DriveSpreadsheetFile[] = [];

  for (const file of spreadsheets) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);

    if (nameFilter && !nameFilter.test(file.name)) continue;

    results.push({
      id: file.id,
      name: file.name,
      folderPath,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
    });
  }

  if (recursive) {
    const subfolders = await listFilesInFolder(folderId, FOLDER_MIME, token);
    for (const folder of subfolders) {
      const subPath = folderPath ? `${folderPath}/${folder.name}` : folder.name;
      const subResults = await scanFolder(
        folder.id,
        subPath,
        token,
        recursive,
        nameFilter,
        seen
      );
      results.push(...subResults);
    }
  }

  return results;
}

/**
 * Scans a Google Drive folder for Google Spreadsheet files.
 * Returns all spreadsheets found (recursively by default).
 * Uses Drive API v3 via authenticated fetch (no googleapis package needed).
 */
export async function scanDriveFolderForSpreadsheets(
  options: ScanDriveFolderOptions
): Promise<DriveSpreadsheetFile[]> {
  const { folderId, recursive = true, nameFilter, credentials } = options;

  const token = await getAccessToken(credentials);
  return scanFolder(folderId, '', token, recursive, nameFilter);
}
