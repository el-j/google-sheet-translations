# Google Docs Ingestion Pipeline

`@el-j/google-sheet-translations` supports ingesting **Google Docs** directly into Google Spreadsheets as structured translation keys. This bridges copywriting and translation workflows, allowing content authors to write in standard Google Docs while developers consume translations via automated spreadsheet pipelines.

---

## 💡 Overview

When Google Docs ingestion is enabled, the package:
1. **Scans Drive Folders** for Google Docs (`application/vnd.google-apps.document`).
2. **Infers Source Locales** from document naming conventions (e.g. `homepage_en` $\rightarrow$ `en`, `privacy_policy_de` $\rightarrow$ `de`).
3. **Exports Content as Markdown** using Google Drive API v3.
4. **Parses Structural Content** into structured translation keys and values using configurable parsing strategies.
5. **Bootstraps or Updates Spreadsheets**:
   - In **create mode**, auto-creates a Google Spreadsheet and seeds the extracted keys.
   - In **refresh mode**, updates changed keys without overwriting other translations.

---

## 🛠️ Document Structure & Parsing Strategies

The ingester supports three parsing strategies:

### 1. Heading Strategy (`heading`, Default)
- `# Heading 1`: Defines the target sheet name (slugified, e.g. `# Home Page` $\rightarrow$ sheet `home_page`).
- `## Heading 2`: Defines the translation key name (slugified, e.g. `## Welcome Title` $\rightarrow$ key `welcome_title`).
- **Paragraph Text**: The body text under the `##` heading becomes the translation value.

```markdown
# Hero

## title
Welcome to our platform

## subtitle
Translate your application seamlessly
```

### 2. Marker Strategy (`marker`)
Uses inline double bracket markers `[[key:sheet.keyName]]` or `[[key:keyName]]`.

```markdown
[[key:hero.title]]
Welcome to our platform

[[key:hero.subtitle]]
Translate your application seamlessly
```

### 3. Numbered Strategy (`numbered`)
Splits the document into sequential paragraphs and generates `item_1`, `item_2`, etc. under the default sheet.

---

## 💻 Programmatic Ingestion Example

```typescript
import { manageDriveTranslations } from '@el-j/google-sheet-translations';

const result = await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  scanForDocs: true, // Enable automatic Google Doc discovery & ingestion
  docKeyStrategy: 'heading',
  docUpdateMode: 'refresh-if-newer',
});

console.log('Ingested docs:', result.docIngestResults);
```

---

## ⚙️ Advanced: Using the Low-Level Ingestion API

```typescript
import { ingestDoc, exportDoc, parseDocContent } from '@el-j/google-sheet-translations';

// 1. Export doc markdown directly
const markdown = await exportDoc('google-doc-file-id');

// 2. Parse markdown to keys
const entries = parseDocContent(markdown, {
  strategy: 'heading',
  defaultSheetName: 'content',
});

// 3. Ingest into spreadsheet
const result = await ingestDoc(
  {
    id: 'google-doc-file-id',
    name: 'onboarding_en',
    folderPath: 'docs',
    mimeType: 'application/vnd.google-apps.document',
    sourceLocale: 'en',
  },
  {
    updateMode: 'create-if-missing',
    keyStrategy: 'heading',
  }
);
```
