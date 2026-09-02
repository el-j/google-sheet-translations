# v2 Getting Started

::: warning v2 Legacy API
This page documents the legacy v2 usage style. Prefer v3 for new projects.
:::

## Install

```bash
npm install @el-j/google-sheet-translations
```

## Required environment variables

```dotenv
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
```

## v2 usage example

```ts
import { getSpreadSheetData } from '@el-j/google-sheet-translations';

const translations = await getSpreadSheetData(['home', 'about'], {
  rowLimit: 100,
  waitSeconds: 2,
  syncLocalChanges: true,
  autoTranslate: false,
});

console.log(Object.keys(translations));
```

## Next step

When ready, migrate this setup using [Migration to v3](/guide/provider-migration-v3).
