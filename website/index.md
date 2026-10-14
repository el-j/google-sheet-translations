---
layout: home

hero:
  name: "google-sheet-translations"
  text: "Provider-first Translation\nOperations"
  tagline: >
    Build reliable localization pipelines with explicit input, output, and sync providers.
    Use Google Sheets for full sync workflows and CryptPad CSV for privacy-first, zero-auth ingestion.
  image:
    src: /logo.svg
    alt: google-sheet-translations
  actions:
    - theme: brand
      text: What's New in v3 →
      link: /guide/v3-overview
    - theme: alt
      text: Migrate from v2
      link: /guide/provider-migration-v3
    - theme: alt
      text: CryptPad Full Sync
      link: /guide/cryptpad-full-sync
    - theme: alt
      text: GitHub Action
      link: /guide/github-actions
    - theme: alt
      text: v2 Archive
      link: /v2/

features:
  - title: Universal Provider Architecture (v3)
    details: Select input, output, and sync providers explicitly. Capability checks prevent unsupported operations before they can run.
    link: /guide/provider-runtime
    linkText: Learn more

  - title: Seamless v2 to v3 Migration
    details: Move from legacy action inputs to provider config using the gst-migrate-v3 CLI, with dry-run mode, parity checking, and workflow rewrites.
    link: /guide/provider-migration-v3
    linkText: Learn more

  - title: Privacy-First CryptPad Sheets & Drive (v3)
    details: Full bidirectional E2EE push/pull with password protection, pure Netflux WebSockets, headless auto-initialization, multi-sheet tabs, and encrypted Drive discovery.
    link: /guide/cryptpad-full-sync
    linkText: Learn more

  - title: Google Sheets Full Workflow
    details: Read, transform, write, and sync translation data with mature Google provider adapters and locale-aware processing.
    link: /guide/bidirectional-sync
    linkText: Learn more

  - title: Extensible Custom Providers
    details: Implement simple TypeScript contracts for custom backends (Airtable, Notion, CSV, local DB) without vendor lock-in.
    link: /guide/non-google-providers#building-a-custom-provider
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
    details: Ingest from public Google Sheets or CryptPad without service-account credentials for lightweight read-only workflows.
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

See [Provider Runtime (v3)](/guide/provider-runtime), [Non-Google Providers](/guide/non-google-providers), and the [v3 migration guide](/guide/provider-migration-v3).

## Docs versioning

::: warning Seamless Transition to v3
Migrating from v2? Follow the [Step-by-Step Migration Guide](/guide/provider-migration-v3) or use `npx gst-migrate-v3 --dry-run` to test your setup.
Need the old v2 reference documentation? The complete [v2 docs archive](/v2/) is permanently preserved.
:::
