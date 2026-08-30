# Data Converters API

Low-level utilities for converting translation formats and finding diffs between local JSON files and remote Google Spreadsheets.

```typescript
import {
  convertToDataJsonFormat,
  convertFromDataJsonFormat,
  findLocalChanges,
  updateSpreadsheetWithLocalChanges,
  columnIndexToLetter
} from '@el-j/google-sheet-translations';
```

---

## Functions

### `convertToDataJsonFormat(translations)`

Transforms a multi-locale nested translation object into array-of-sheets format suitable for `languageData.json`.

```typescript
function convertToDataJsonFormat(
  translations: TranslationData
): Array<Record<string, Record<string, Record<string, string>>>>
```

---

### `convertFromDataJsonFormat(dataJson)`

Transforms an array from `languageData.json` back into the structured `TranslationData` record map.

```typescript
function convertFromDataJsonFormat(
  dataJson: Record<string, unknown>[]
): TranslationData
```

---

### `findLocalChanges(localData, spreadsheetData)`

Compares local `languageData.json` against fetched `spreadsheetData` to identify new keys or changes that need to be synced back up to Google Spreadsheets.

```typescript
function findLocalChanges(
  localData: TranslationData,
  spreadsheetData: TranslationData
): TranslationData
```

---

### `columnIndexToLetter(index)`

Converts a 0-based column index to its corresponding spreadsheet column letter (`0` $\rightarrow$ `'A'`, `25` $\rightarrow$ `'Z'`, `26` $\rightarrow$ `'AA'`, `27` $\rightarrow$ `'AB'`).

```typescript
function columnIndexToLetter(index: number): string
```
