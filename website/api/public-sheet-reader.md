# Public Sheet Reader API

Utility to fetch translations from publicly shared Google Spreadsheets **without requiring service account credentials or API keys**.

```typescript
import { readPublicSheet } from '@el-j/google-sheet-translations';
```

---

## Functions

### `readPublicSheet(spreadsheetId, sheetTitle)`

Fetches rows from a public Google Spreadsheet using the Google Visualization Query endpoint (`gviz/tq`).

```typescript
function readPublicSheet(
  spreadsheetId: string,
  sheetTitle: string
): Promise<SheetRow[]>
```

#### Parameters

- `spreadsheetId` (`string`): The public Google Spreadsheet ID.
- `sheetTitle` (`string`): Worksheet title (e.g. `'home'`, `'nav'`).

#### Returns

`Promise<SheetRow[]>`: Array of row objects where keys match column headers.

#### Example

```typescript
const rows = await readPublicSheet('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'home');
console.log(rows);
// [{ key: 'welcome', en: 'Welcome', de: 'Willkommen' }, ...]
```
