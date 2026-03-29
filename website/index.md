---
layout: home

hero:
  name: "google-sheet-translations"
  text: "Your Google Sheets,\nas a translation backend"
  tagline: >
    Fetch, sync and auto-translate — single spreadsheet or an entire Drive folder.
    Full TypeScript safety, zero configuration overhead, built-in image sync.
  image:
    src: /logo.svg
    alt: google-sheet-translations
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/getting-started
    - theme: alt
      text: Drive Folder & Images
      link: /guide/drive-folder
    - theme: alt
      text: GitHub Action
      link: /guide/github-actions

features:
  - icon: 🗂️
    title: Google Drive Folder Management
    details: Point the package at a Drive folder and it auto-discovers every translation spreadsheet inside — across any sub-folder depth. One call, many sheets, one merged result.
    link: /guide/drive-folder
    linkText: Learn more

  - icon: 🖼️
    title: Built-in Image Sync from Drive
    details: Download images from your Drive folder to a local asset directory with incremental sync, concurrency control, extension normalisation, and optional stale-file cleanup. No rclone needed.
    link: /guide/drive-folder#image-sync
    linkText: Learn more

  - icon: 🔄
    title: Bidirectional Sync
    details: Push new translation keys from your local files straight back into the shared spreadsheet. Collaborators see your keys immediately — no manual copy-paste.
    link: /guide/bidirectional-sync
    linkText: Learn more

  - icon: 🌐
    title: Open Access (No Auth)
    details: Have a public spreadsheet? Pass spreadsheetId + publicSheet true and you're done — no service account, no API key, no invite by email. The link is enough.
    link: /guide/public-sheets
    linkText: Learn more

  - icon: 🤖
    title: Auto-Translation
    details: Missing a German translation? Enable autoTranslate and the package injects GOOGLETRANSLATE formulas automatically. Translators start from a draft, not a blank cell.
    link: /guide/auto-translation
    linkText: Learn more

  - icon: ⚙️
    title: One GitHub Action — All Modes
    details: A single action covers basic sync, multi-spreadsheet Drive folders, and image downloads. Just set drive-folder-id and sync-images to unlock the full headless CMS pipeline.
    link: /guide/github-actions
    linkText: Learn more

  - icon: 🎯
    title: Smart Locale Filtering
    details: The generated locales.ts only contains locales that carry actual content. Empty columns and config-only sheets are silently ignored.
    link: /guide/locale-filtering
    linkText: Learn more

  - icon: 🔒
    title: Fully Type-Safe
    details: Strict TypeScript throughout. Path-traversal-safe file writes, runtime type-guards on JSON, and ESLint clean with @typescript-eslint/recommended.

  - icon: ⚡
    title: Next.js Ready
    details: Drop one import into instrumentation.ts and your translations are prefetched during next build — perfect for static export workflows.
    link: /guide/nextjs
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
