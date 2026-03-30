# Configuration

All options are optional. Pass them as the second argument to `getSpreadSheetData`.

```typescript
const translations = await getSpreadSheetData(['home', 'common'], {
  rowLimit: 200,
  waitSeconds: 2,
  dataJsonPath: 'src/lib/languageData.json',
  localesOutputPath: 'src/i18n/locales.ts',
  translationsOutputDir: 'public/translations',
  syncLocalChanges: true,
  autoTranslate: false,
});
```

## Options reference

### `rowLimit`
- **Type**: `number`
- **Default**: `100`

Maximum number of rows fetched per sheet. Increase if your sheets are tall.

---

### `waitSeconds`
- **Type**: `number`
- **Default**: `1`

Seconds to wait between Google Sheets API calls. Increase if you hit rate-limit errors (`429`).

---

### `dataJsonPath`
- **Type**: `string`
- **Default**: `src/lib/languageData.json`

Path where the package writes (and reads for diffing) the internal `languageData.json` file. This file drives bidirectional sync — it records the last known state of the spreadsheet.

---

### `localesOutputPath`
- **Type**: `string`
- **Default**: `src/i18n/locales.ts`

Path for the generated TypeScript file that exports the locale list and header mapping:

```typescript
export const locales = ['en-GB', 'de-DE', 'fr-FR'];
export const localeHeaderMapping = { 'en-GB': 'en', 'de-DE': 'de', 'fr-FR': 'fr' };
export default locales;
```

---

### `translationsOutputDir`
- **Type**: `string`
- **Default**: `translations`

Directory where per-locale JSON files are written. The filename is `{locale}.json` (e.g. `en-GB.json`).

---

### `syncLocalChanges`
- **Type**: `boolean`
- **Default**: `true`

When `true`, the package compares `languageData.json` with the live spreadsheet data and pushes any new keys back to the spreadsheet. Set to `false` for a read-only pull.

See [Bidirectional Sync](/guide/bidirectional-sync) for the full workflow.

---

### `autoTranslate`
- **Type**: `boolean`
- **Default**: `false`

When `true`, the package injects `=GOOGLETRANSLATE(…)` formulas for any cells that are missing a translation when a new key is added. Requires `syncLocalChanges: true`.

See [Auto-Translation](/guide/auto-translation) for details.

## TypeScript type

```typescript
import type { SpreadsheetOptions } from '@el-j/google-sheet-translations';

const options: SpreadsheetOptions = {
  waitSeconds: 2,
  autoTranslate: true,
};
```

---

## Drive folder options

For multi-spreadsheet and Drive folder workflows, use
[`manageDriveTranslations`](/api/manage-drive-translations) or
[`getMultipleSpreadSheetsData`](/api/get-multiple-spreadsheets-data).
The options above can be passed via their `translationOptions` parameter.

```typescript
import { manageDriveTranslations } from '@el-j/google-sheet-translations';

await manageDriveTranslations({
  driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  syncImages: true,
  imageOutputPath: './src/assets/remote-images',
  translationOptions: {          // ← same SpreadsheetOptions here
    waitSeconds: 2,
    translationsOutputDir: './src/translations',
  },
});
```
