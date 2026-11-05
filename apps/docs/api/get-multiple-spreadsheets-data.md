# getMultipleSpreadSheetsData

Fetches translations from multiple Google Spreadsheet IDs and deep-merges the results into a single `TranslationData` object.

## Signature

```typescript
function getMultipleSpreadSheetsData(
  docTitles?: string[],
  options?: MultiSpreadsheetOptions,
): Promise<TranslationData>
```

## Parameters

### `docTitles`
- **Type**: `string[]`
- **Optional**: yes
- **Description**: Sheet tab names to fetch from each spreadsheet.

### `options`
- **Type**: [`MultiSpreadsheetOptions`](#multispreadsheetoptions)
- **Optional**: yes

## Returns

`Promise<TranslationData>` — merged translations from all spreadsheets.

---

## MultiSpreadsheetOptions

Extends [`SpreadsheetOptions`](/api/types#spreadsheetoptions) with:

```typescript
interface MultiSpreadsheetOptions extends SpreadsheetOptions {
  /**
   * Array of spreadsheet IDs to fetch from.
   * Falls back to options.spreadsheetId / GOOGLE_SPREADSHEET_ID when not set.
   */
  spreadsheetIds?: string[];

  /**
   * How to handle key collisions across spreadsheets.
   * 'later-wins' (default): keys from later spreadsheets overwrite earlier.
   * 'first-wins': the first occurrence of a key is kept.
   */
  mergeStrategy?: 'later-wins' | 'first-wins';
}
```

---

## Examples

### Fetch from three spreadsheets

```typescript
import { getMultipleSpreadSheetsData } from '@el-j/google-sheet-translations';

const translations = await getMultipleSpreadSheetsData(['home', 'common'], {
  spreadsheetIds: [
    '1abc…',  // main site
    '1def…',  // blog
    '1ghi…',  // shop
  ],
});
```

### First-wins merge strategy

```typescript
const translations = await getMultipleSpreadSheetsData(undefined, {
  spreadsheetIds: ['1base…', '1override…'],
  mergeStrategy: 'first-wins',  // base sheet's keys are never overwritten
});
```

### Single-spreadsheet fallback

When `spreadsheetIds` is not set, the function behaves identically to
`getSpreadSheetData` (uses `spreadsheetId` option or `GOOGLE_SPREADSHEET_ID`
env var):

```typescript
const translations = await getMultipleSpreadSheetsData(['home']);
```
