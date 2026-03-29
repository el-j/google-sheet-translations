# Google Service Account Setup

This guide walks you through creating a Google Cloud service account that the
package uses to read (and optionally write) your spreadsheets and Drive folder.

There are two levels of API access:

| Use case | APIs needed |
|----------|-------------|
| Basic translation sync (single spreadsheet) | Google Sheets API |
| Drive folder management + image sync | Google Sheets API **+** Google Drive API |

Follow **Part 1** for any usage. If you plan to use
[Drive Folder Management](/guide/drive-folder), also complete **Part 2**.

---

## Part 1 — Basic setup (Sheets API only)

### Step 1 — Create a Google Cloud project

1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project selector (top-left) → **New Project**.
3. Enter a name (e.g. `my-i18n-bot`) and click **Create**.
4. Make sure the new project is selected before continuing.

### Step 2 — Enable the Google Sheets API

1. In the left sidebar go to **APIs & Services → Library**.
2. Search for **Google Sheets API** and click on it.
3. Click **Enable**.

### Step 3 — Create a service account

1. Go to **IAM & Admin → Service Accounts**.
2. Click **Create Service Account**.
3. Fill in a name (e.g. `translations-bot`) — the email is auto-generated.
4. Click **Create and Continue**, skip the optional role steps, click **Done**.

### Step 4 — Generate a JSON key

1. Click on your new service account in the list.
2. Go to the **Keys** tab → **Add Key → Create new key**.
3. Choose **JSON** and click **Create** — a file is downloaded.
4. **Keep this file secret** — it is a private credential.

### Step 5 — Extract the credentials

Open the downloaded JSON file. You need two values:

```json
{
  "client_email": "translations-bot@my-i18n-bot.iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIE…\n-----END RSA PRIVATE KEY-----\n"
}
```

These map directly to the two required environment variables:

```dotenv
GOOGLE_CLIENT_EMAIL=translations-bot@my-i18n-bot.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE…\n-----END RSA PRIVATE KEY-----\n"
```

### Step 6 — Share the spreadsheet with the service account

1. Open your Google Spreadsheet.
2. Click **Share** (top-right).
3. Paste the `client_email` address into the "Add people" field.
4. Set the permission level:
   - **Viewer** — for read-only translation pulls
   - **Editor** — for bidirectional sync and auto-translation (write access required)
5. Click **Send** (or **Share**).

> [!TIP]
> You do not need to send a notification email — the service account has no inbox.
> Uncheck "Notify people" when sharing.

### Step 7 — Add the spreadsheet ID

Find your spreadsheet ID in the URL:

```
https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        GOOGLE_SPREADSHEET_ID
```

Add it to your environment variables:

```dotenv
GOOGLE_SPREADSHEET_ID=1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0
```

### Step 8 — Verify it works

```typescript
import { validateEnv } from '@el-j/google-sheet-translations';
import getSpreadSheetData from '@el-j/google-sheet-translations';

validateEnv(); // throws if any variable is missing

const translations = await getSpreadSheetData(['home', 'common']);
console.log(Object.keys(translations));
// → ['en-GB', 'de-DE', ...]
```

---

## Part 2 — Enabling the Drive API (for folder & image usage)

If you want to use [Drive Folder Management](/guide/drive-folder) — scanning a
Drive folder for spreadsheets, fetching translations from all of them, or
downloading images — you must also enable the **Google Drive API** and grant
the service account access to the Drive folder.

### Step 1 — Enable the Google Drive API

1. Go back to **APIs & Services → Library** in your Cloud Console project.
2. Search for **Google Drive API** and click on it.
3. Click **Enable**.

> [!IMPORTANT]
> You must enable the Drive API on the **same project** as the service account.
> The Sheets API alone is not sufficient for Drive folder operations.

### Step 2 — Share the Drive folder with the service account

1. Open [drive.google.com](https://drive.google.com) and navigate to your
   target folder (create one if needed).
2. Right-click the folder → **Share**.
3. Paste the `client_email` address.
4. Set **Viewer** (read-only — the package only reads spreadsheets and
   downloads images, never writes to Drive).
5. Click **Share**.

> [!TIP]
> Sharing the parent folder automatically gives access to everything inside it,
> including sub-folders. You do **not** need to share every spreadsheet
> individually when they are inside the shared folder.

### Step 3 — Add the Drive folder ID

Find the folder ID in its URL:

```
https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        GOOGLE_DRIVE_FOLDER_ID
```

```dotenv
GOOGLE_DRIVE_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

### Step 4 — Verify Drive access

```typescript
import { scanDriveFolderForSpreadsheets } from '@el-j/google-sheet-translations';

const sheets = await scanDriveFolderForSpreadsheets({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  recursive: true,
});

console.log(sheets);
// → [{ id: '1abc…', name: 'i18n-home', folderPath: '' }, …]
```

If you see your spreadsheets listed, the Drive API is properly configured.

---

## Using credentials in CI / GitHub Actions

Store the three (or four) values as
**repository secrets** (Settings → Secrets and variables → Actions):

| Secret name | Value |
|-------------|-------|
| `GOOGLE_CLIENT_EMAIL` | `client_email` from the JSON file |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON file (paste as-is) |
| `GOOGLE_SPREADSHEET_ID` | Your spreadsheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | Your Drive folder ID (Drive usage only) |

> [!IMPORTANT]
> When you paste the private key into a GitHub Secret the literal string `\n`
> is stored instead of real newlines. The package **automatically converts**
> `\n` → real newlines at runtime, so paste the key exactly as it appears in
> the JSON file — no manual editing needed.

Reference them in your workflow:

```yaml
- uses: el-j/google-sheet-translations@v2
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,common'
```

See the full [GitHub Actions guide →](/guide/github-actions) for Drive and
image-sync examples.

---

## Troubleshooting

### "The caller does not have permission"

- The spreadsheet (or Drive folder) is not shared with the service account email.
- Double-check the email address — copy it directly from the Cloud Console, not from the JSON file.

### "Google Drive API has not been used in project … before or it is disabled"

- The Drive API is not enabled on your Cloud project. Follow [Part 2, Step 1](#step-1-enable-the-google-drive-api) above.

### "DECODER routines::unsupported" or key format errors

- The private key has been mangled by your shell or CI provider.
- Paste the raw value from the JSON file. The package handles `\n` → newline conversion automatically.

### "Quota exceeded" / HTTP 429

- You're hitting Google API rate limits. Increase the `waitSeconds` option (default `1`) to throttle writes:
  ```dotenv
  # action input
  wait-seconds: '3'
  ```
  See [Configuration](/guide/configuration) for all throttle options.
