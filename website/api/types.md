# Types

All types are available as named type imports with zero runtime cost:

```typescript
import type { SpreadsheetOptions, TranslationData } from '@el-j/google-sheet-translations';
```

---

## SpreadsheetOptions

Options passed as the second argument to `getSpreadSheetData`.

```typescript
interface SpreadsheetOptions {
  /** Maximum rows to fetch per sheet (default: 100) */
  rowLimit?: number;

  /** Seconds to wait between API calls (default: 1) */
  waitSeconds?: number;

  /** Path for languageData.json (default: 'src/lib/languageData.json') */
  dataJsonPath?: string;

  /** Path for generated locales.ts (default: 'src/i18n/locales.ts') */
  localesOutputPath?: string;

  /** Directory for per-locale JSON files (default: 'translations') */
  translationsOutputDir?: string;

  /** Push new local keys to spreadsheet (default: true) */
  syncLocalChanges?: boolean;

  /** Inject GOOGLETRANSLATE formulas for empty cells (default: false) */
  autoTranslate?: boolean;
}
```

---

## TranslationData

The return value of `getSpreadSheetData`. A nested object:

```
locale  →  sheetTitle  →  key  →  value
```

```typescript
type TranslationData = Record<
  string,
  Record<string, Record<string, TranslationValue>>
>;

// Example value:
const data: TranslationData = {
  'en-GB': {
    home:   { welcome: 'Welcome', goodbye: 'Goodbye' },
    common: { save: 'Save' },
  },
};
```

---

## TranslationValue

The type of a single translation value. Permissive to accommodate varied content:

```typescript
type TranslationValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[];
```

---

## SheetRow

A raw key-value representation of one spreadsheet row:

```typescript
type SheetRow = Record<string, string>;
```

---

## GoogleEnvVars

The object returned by `validateEnv()`:

```typescript
interface GoogleEnvVars {
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_SPREADSHEET_ID: string;
}
```
