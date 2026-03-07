# Getting Started

## Prerequisites

- Node.js **≥ 14.18.0**
- A **Google Cloud service account** with the Sheets API enabled
- A **Google Spreadsheet** shared with the service account (see [Spreadsheet Setup](/guide/spreadsheet-setup))

## Install

::: code-group

```bash [npm]
npm install @el-j/google-sheet-translations
```

```bash [pnpm]
pnpm add @el-j/google-sheet-translations
```

:::

## Set environment variables

The package reads three variables. Add them to `.env` (or your CI secrets):

```dotenv
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE…\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

> [!TIP]
> The `GOOGLE_PRIVATE_KEY` value must have real newlines (`\n` in the `.env` value) and must be wrapped in quotes.

## Basic usage

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
