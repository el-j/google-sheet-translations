# Google Sheets Provider (v3)

Factory functions that create the Google Sheets input/output/sync providers used by the v3 [provider runtime](/api/provider-platform).

```typescript
import {
  createGoogleSheetsInputProvider,
  createGoogleSheetsOutputProvider,
  createGoogleSheetsSyncProvider,
  GOOGLE_SHEETS_PROVIDER_CAPABILITIES,
} from '@el-j/google-sheet-translations';
```

These are usually not called directly — `createProvidersFromRuntimeConfig` calls them for you from a `ProviderRuntimeConfig` with `provider: 'google-sheets'`. Call them directly only when composing providers programmatically.

---

## `createGoogleSheetsInputProvider(options?, depsOverrides?)`

```typescript
function createGoogleSheetsInputProvider(
  options?: GoogleSheetsInputProviderOptions,
): TranslationInputProvider
```

```typescript
interface GoogleSheetsInputProviderOptions {
  spreadsheetId?: string; // falls back to GOOGLE_SPREADSHEET_ID
  rowLimit?: number;      // default: 100
  waitSeconds?: number;
  publicSheet?: boolean;  // read via public export, no auth required
  providerId?: string;
  displayName?: string;
}
```

- When `publicSheet: true`, reads via the no-auth public export path and declares `publicReadNoAuth: true`.
- Otherwise authenticates via Application Default Credentials / service account and reads through the Google Sheets API.
- A requested table name with no matching sheet is skipped with a warning rather than failing the whole read.

---

## `createGoogleSheetsOutputProvider(options?, depsOverrides?)`

```typescript
function createGoogleSheetsOutputProvider(
  options?: GoogleSheetsOutputProviderOptions,
): TranslationOutputProvider
```

```typescript
interface GoogleSheetsOutputProviderOptions {
  spreadsheetId?: string;
  waitSeconds?: number;
  autoTranslate?: boolean;      // fill missing cells with a translate formula
  override?: boolean;           // overwrite existing non-empty cells
  localeMapping?: Record<string, string>;
  providerId?: string;
  displayName?: string;
}
```

Authenticates and writes the full translation set to the spreadsheet.

---

## `createGoogleSheetsSyncProvider(options?, depsOverrides?)`

```typescript
function createGoogleSheetsSyncProvider(
  options?: GoogleSheetsSyncProviderOptions,
): TranslationSyncProvider
```

Takes the same options shape as the output provider. Computes local-only changes (comparing local translations against the remote spreadsheet) and writes back only the changed keys — returning `{ changedKeys: 0, skippedKeys: 0, metadata: { reason: 'no-local-diff' } }` without an authenticated round-trip when there is no local diff.

---

## `GOOGLE_SHEETS_PROVIDER_CAPABILITIES`

The static capability sets each factory declares, exported for inspection/testing:

```typescript
const GOOGLE_SHEETS_PROVIDER_CAPABILITIES: {
  input: ProviderCapabilitySet;   // readTables, publicReadNoAuth, discoverByFolder
  output: ProviderCapabilitySet;  // writeTables, autoTranslateFormula
  sync: ProviderCapabilitySet;    // syncBack, writeTables, autoTranslateFormula
};
```
