# Getting Started

## Prerequisites

- Node.js **≥ 14.18.0**
- A **Google Spreadsheet** (see [Spreadsheet Setup](/guide/spreadsheet-setup))

> [!TIP]
> **No service account?** If your spreadsheet is shared publicly, jump straight
> to the [Public Sheets (No Auth)](/guide/public-sheets) guide and skip all
> the credential steps below.

## Install

::: code-group

```bash [npm]
npm install @el-j/google-sheet-translations
```

```bash [pnpm]
pnpm add @el-j/google-sheet-translations
```

:::

## Option A — Public spreadsheet (no credentials)

If the spreadsheet is shared as **"Anyone with link can view"**, no Google Cloud
service account is required.  Use our [demo spreadsheet](https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit)
or any publicly accessible sheet:

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

const translations = await getSpreadSheetData(['home', 'common'], {
  spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
  publicSheet: true,
});
```

No `.env` file or environment variables are needed for this mode.

See the full [Public Sheets guide](/guide/public-sheets) for details.

---

## Option B — Private spreadsheet (service account)

For private spreadsheets, or when you need bidirectional sync or
auto-translation, use a Google Cloud service account.

### Additional prerequisites

- A **Google Cloud service account** with the Sheets API enabled
- The spreadsheet shared with the service account email

### Set environment variables

Add the three required variables to `.env` (or your CI secrets):

```dotenv
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE…\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

> [!TIP]
> **Local `.env`**: wrap the key in quotes and use `\n` to represent newlines.  
> **GitHub Secrets / CI**: paste the key as-is from the service-account JSON — the package automatically converts literal `\n` sequences to real newlines.

### Basic usage

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

// Fetch translations from the 'home' and 'common' sheets
const translations = await getSpreadSheetData(['home', 'common']);

console.log(Object.keys(translations));
// → ['en-GB', 'de-DE', 'fr-FR', ...]
```

### What gets written

After the call completes, the package creates:

| File | Default path | Content |
|------|-------------|---------|
| Per-locale JSON | `translations/{locale}.json` | `{ "key": "value", … }` |
| Locales list | `src/i18n/locales.ts` | `export const locales = ['en-GB', 'de-DE']` |
| Language data | `src/lib/languageData.json` | Internal format for bidirectional sync |

All paths are configurable — see [Configuration](/guide/configuration).

## Validate env vars explicitly

```typescript
import { validateEnv } from '@el-j/google-sheet-translations';

validateEnv(); // throws descriptively if any var is missing
```

## Named import

```typescript
import { getSpreadSheetData } from '@el-j/google-sheet-translations';
```
