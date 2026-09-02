---
layout: home

hero:
  name: "google-sheet-translations"
  text: "Provider-first Translation\nOperations"
  tagline: >
    Build reliable localization pipelines with explicit input, output, and sync providers.
    Use Google Sheets for full sync workflows and CryptPad CSV for no-auth ingestion.
  image:
    src: /logo.svg
    alt: google-sheet-translations
  actions:
    - theme: brand
      text: Start with v3 Runtime →
      link: /guide/provider-runtime
    - theme: alt
      text: Migrate from v2
      link: /guide/provider-migration-v3
    - theme: alt
      text: GitHub Action
      link: /guide/github-actions
    - theme: alt
      text: v2 Archive
      link: /v2/

features:
  - title: Provider Runtime Architecture (v3)
    details: Select input, output, and sync providers explicitly. Capability checks prevent unsupported operations before they can run.
    link: /guide/provider-runtime
    linkText: Learn more

  - title: Migration Command and Transition Path
    details: Move from legacy action inputs to provider config using gst-migrate-v3, with dry-run mode and optional workflow rewrites.
    link: /guide/provider-migration-v3
    linkText: Learn more

  - title: CryptPad CSV Input (v3)
    details: Pull translation tables from CryptPad CSV exports or public endpoints and process them through the same transformation core.
    link: /guide/provider-runtime#cryptpad-csv-mvp
    linkText: Learn more

  - title: Google Sheets Full Workflow
    details: Read, transform, write, and sync translation data with mature Google provider adapters and locale-aware processing.
    link: /guide/bidirectional-sync
    linkText: Learn more

  - title: GitHub Action Automation
    details: Run translation sync in CI with either legacy action inputs or provider config mode for v3 pipelines.
    link: /guide/github-actions
    linkText: Learn more

  - title: Drive Folder Discovery and Assets
    details: Discover multiple spreadsheets from Drive folders, merge output, and optionally sync remote image assets to your project.
    link: /guide/drive-folder
    linkText: Learn more

  - title: Public Read Mode (No Auth)
    details: Ingest from public Google Sheets without service-account credentials for lightweight read-only workflows.
    link: /guide/public-sheets
    linkText: Learn more

  - title: Type-safe Core and Stable Outputs
    details: Strict TypeScript, deterministic row transformation, and tested provider contracts keep output predictable across environments.
    link: /api/
    linkText: Learn more
---

## Installation

::: code-group

```bash [npm]
npm install @el-j/google-sheet-translations
```

```bash [pnpm]
pnpm add @el-j/google-sheet-translations
```

```bash [yarn]
yarn add @el-j/google-sheet-translations
```

:::

## Quick start — single spreadsheet

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

const translations = await getSpreadSheetData(['home', 'common']);
// → { 'en-GB': { home: { ... }, common: { ... } }, 'de-DE': { ... } }
```

Three required environment variables:

```dotenv
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GOOGLE_SPREADSHEET_ID=1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0
```

> **New to service accounts?** Follow the [step-by-step setup guide →](/guide/service-account-setup)

## Quick start — Drive folder (headless CMS)

```typescript
import { manageDriveTranslations } from '@el-j/google-sheet-translations';

const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,

  // auto-discover every spreadsheet in the folder and sub-folders
  scanForSpreadsheets: true,

  // download images from the same Drive folder
  syncImages: true,
  imageOutputPath: './public/remote-images',

  translationOptions: {
    translationsOutputDir: './src/translations',
  },
});

console.log(result.translations);
// → { 'en-GB': { home: {...}, about: {...} }, 'de-DE': { ... } }
console.log(result.imageSync?.downloaded.length, 'images downloaded');
```

> **Need Drive API access?** See [service account setup with Drive →](/guide/service-account-setup#enabling-the-drive-api-for-folder--image-usage)

## Quick start — provider runtime (v3)

```typescript
import {
  assertValidProviderRuntimeConfig,
  createProvidersFromRuntimeConfig,
  runProviderPipeline,
} from '@el-j/google-sheet-translations';

const config = assertValidProviderRuntimeConfig({
  input: {
    provider: 'cryptpad-csv',
    options: {
      sources: [
        { tableName: 'home', url: 'https://cryptpad.fr/.../export.csv' },
      ],
    },
  },
});

const providers = createProvidersFromRuntimeConfig(config);
const result = await runProviderPipeline({
  inputProvider: providers.inputProvider,
  tableNames: ['home'],
});

console.log(result.locales);
```

See [Provider Runtime (v3)](/guide/provider-runtime) and the [v3 migration guide](/guide/provider-migration-v3).

## Docs versioning

::: warning Legacy docs still available
Need the old integration model? Use the [v2 docs archive](/v2/) for legacy setup and workflows. New projects should use v3 provider runtime docs.
:::
