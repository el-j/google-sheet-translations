import { buildGoogleAuth, normalizePrivateKey } from './auth';

/** Turns a spreadsheet name / ID into a safe directory segment */
export function sanitizeFolderName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'sheet'
  );
}

/**
 * Moves a Google Spreadsheet (identified by `spreadsheetId`) into the given
 * Drive folder by calling the Drive Files API with the `drive.file` scope.
 *
 * The service-account must have been granted edit access to the target folder.
 * Uses the same credential detection order as `createAuthClient` (WIF first,
 * then `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`).
 */
export async function moveSpreadsheetToFolder(
  spreadsheetId: string,
  folderId: string,
): Promise<void> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

  let credentials: { client_email: string; private_key: string } | undefined;
  if (clientEmail && rawPrivateKey) {
    credentials = { client_email: clientEmail, private_key: normalizePrivateKey(rawPrivateKey) };
  }
  // When no key credentials are present, buildGoogleAuth falls back to WIF / ADC
  // (GOOGLE_APPLICATION_CREDENTIALS), which google-auth-library picks up automatically.

  const driveAuth = buildGoogleAuth(
    ['https://www.googleapis.com/auth/drive.file'],
    credentials,
  );

  // Step 1: fetch current parents so we can remove them after the move
  const fileRes = await driveAuth.request<{ parents?: string[] }>({
    url: `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
    params: { fields: 'parents' },
  });
  const parentIds = fileRes.data.parents ?? [];

  // Step 2: move the file by adding the target folder and removing previous parents
  await driveAuth.request({
    url: `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
    method: 'PATCH',
    params: {
      addParents: folderId,
      ...(parentIds.length > 0 ? { removeParents: parentIds.join(',') } : {}),
      fields: 'id,parents',
    },
  });
}
