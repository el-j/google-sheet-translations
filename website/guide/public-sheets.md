# Public Sheets (No Auth Required)

By default the package uses a **Google Cloud service account** to access
spreadsheets. For spreadsheets that are already open to the world
(**"Anyone with link can view"**) you can skip the service-account setup
entirely and use the built-in *public sheet* mode.

> [!IMPORTANT]
> Public sheet mode is **read-only**. Bidirectional sync and auto-translate
> are only available when using service-account authentication.

## How it works

Public sheet mode fetches data through the
[Google Visualization API](https://developers.google.com/chart/interactive/docs/querylanguage)
(`gviz/tq` endpoint), which is available at no cost for sheets shared as
**"Anyone with link can view"**. No API key or Google Cloud project is needed.

## Demo spreadsheet

We maintain a ready-to-use example spreadsheet you can open right now:

**[📄 Open demo spreadsheet](https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit#gid=0)**

It follows the [required structure](/guide/spreadsheet-setup) — `key` column
followed by locale columns (`en`, `de`, `fr`, …).

To use it as your own starting point, click **File → Make a copy** in Google
Sheets or use the direct copy link:

```
https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/copy
```

## Quick start

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

// No .env or service-account credentials required!
const translations = await getSpreadSheetData(['home', 'common'], {
  spreadsheetId: '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0',
  publicSheet: true,
});

console.log(Object.keys(translations));
// → ['en-GB', 'de-DE', 'fr-FR', ...]
```

The only requirement is that the spreadsheet is shared as
**"Anyone with link can view"** (or "Anyone can edit").

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `publicSheet` | `boolean` | `false` | Enable unauthenticated public sheet mode |
| `spreadsheetId` | `string` | `process.env.GOOGLE_SPREADSHEET_ID` | Spreadsheet ID. Overrides the env var when provided. |

All other [configuration options](/guide/configuration) work the same way.

## Passing the spreadsheet ID

There are two ways to specify the spreadsheet ID in public mode:

### Via options (recommended for public sheets)

```typescript
await getSpreadSheetData(['home'], {
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  publicSheet: true,
});
```

### Via environment variable

```dotenv
GOOGLE_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
```

```typescript
await getSpreadSheetData(['home'], { publicSheet: true });
```

## Low-level helper

If you only need the raw rows from a sheet (without writing any output files),
the `readPublicSheet` helper is exported separately:

```typescript
import { readPublicSheet } from '@el-j/google-sheet-translations';

const rows = await readPublicSheet('SPREADSHEET_ID', 'home');
// → [{ key: 'welcome', en: 'Welcome', de: 'Willkommen' }, ...]
```

## Sharing a Google Spreadsheet publicly

1. Open your spreadsheet in Google Sheets
2. Click **Share** (top-right corner)
3. Under *General access*, choose **"Anyone with the link"**
4. Set the role to **"Viewer"** (or "Editor" for collaborative editing)
5. Copy the link — the ID is the long string between `/d/` and `/edit`

```
https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
```

## Limitations

| Feature | Service Account | Public Sheet |
|---|---|---|
| Read translations | ✅ | ✅ |
| Bidirectional sync | ✅ | ❌ |
| Auto-translate | ✅ | ❌ |
| Write access | ✅ | ❌ |
| Rate limiting | Google API quotas | Google gviz limits |
| Invite required | ✅ (share with SA email) | ❌ |

For production workloads that need write-back or auto-translation, migrate to
a [service account](/guide/environment-variables) and remove the
`publicSheet: true` option — no other code changes needed.
