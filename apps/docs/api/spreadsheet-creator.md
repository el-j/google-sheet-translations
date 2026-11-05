# Spreadsheet Creator API

Utility to programmatically create structured Google Spreadsheets initialized with i18n configurations, header rows, and automatic GOOGLETRANSLATE formulas.

```typescript
import { createSpreadsheet } from '@el-j/google-sheet-translations';
```

---

## Functions

### `createSpreadsheet(authClient, options?)`

Creates a new Google Spreadsheet in Google Drive with pre-configured `i18n` locale mappings and translation sheets.

```typescript
function createSpreadsheet(
  authClient: OAuth2Client | JWT | GoogleAuth,
  options?: CreateSpreadsheetOptions
): Promise<CreateSpreadsheetResult>
```

#### Parameters

- `authClient`: Authenticated Google Auth client.
- `options`:
  - `title` (`string`): Spreadsheet title.
  - `sourceLocale` (`string`): Primary authoring locale (default: `'en'`).
  - `targetLocales` (`string[]`): Target translation locales (e.g. `['de', 'fr', 'es']`).
  - `seedKeys` (`Record<string, string>`): Optional initial translation key/value pairs to populate.

#### Returns

`Promise<CreateSpreadsheetResult>`:
```typescript
interface CreateSpreadsheetResult {
  spreadsheetId: string;
  url: string;
}
```
