# getSpreadSheetData

The primary entry point of the package. Fetches translation data from a Google Spreadsheet, writes output files, and optionally syncs local changes back.

## Signature

```typescript
function getSpreadSheetData(
  sheetTitles?: string[],
  options?: SpreadsheetOptions,
): Promise<TranslationData>
```

## Parameters

### `sheetTitles`
- **Type**: `string[]`
- **Optional**: yes (defaults to `[]`)
- **Description**: Names of the sheets to process. If empty, the function logs a warning and returns `{}`. The `i18n` sheet is always appended automatically if not already present.

### `options`
- **Type**: [`SpreadsheetOptions`](/api/types#spreadsheetoptions)
- **Optional**: yes
- **Description**: Configuration overrides. See [Configuration](/guide/configuration) for the full reference.

## Returns

`Promise<TranslationData>` — an object keyed by normalised locale code:

```typescript
{
  'en-GB': {
    home:   { welcome: 'Welcome', goodbye: 'Goodbye' },
    common: { save: 'Save', cancel: 'Cancel' },
  },
  'de-DE': {
    home:   { welcome: 'Willkommen', goodbye: 'Auf Wiedersehen' },
    common: { save: 'Speichern', cancel: 'Abbrechen' },
  },
}
```

## Side effects

In addition to returning data, the function writes these files:

| File | Controlled by option |
|------|---------------------|
| `translations/{locale}.json` | `translationsOutputDir` |
| `src/i18n/locales.ts` | `localesOutputPath` |
| `src/lib/languageData.json` | `dataJsonPath` |

## Errors

| Condition | Error message |
|-----------|--------------|
| Missing env var | `Missing required environment variables: GOOGLE_*` |
| Spreadsheet not accessible | `Failed to load spreadsheet "…": …` |
| File I/O failure | `Failed to write translation file for locale "…"` |

## Examples

### Minimal

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

const data = await getSpreadSheetData(['home']);
```

### Custom paths

```typescript
const data = await getSpreadSheetData(['home', 'products'], {
  translationsOutputDir: 'public/i18n',
  localesOutputPath: 'src/config/locales.ts',
  dataJsonPath: '.data/languageData.json',
});
```

### Read-only pull

```typescript
const data = await getSpreadSheetData(['home'], {
  syncLocalChanges: false,
});
```

### Push + auto-translate

```typescript
const data = await getSpreadSheetData(['home'], {
  syncLocalChanges: true,
  autoTranslate: true,
  waitSeconds: 2,
});
```
