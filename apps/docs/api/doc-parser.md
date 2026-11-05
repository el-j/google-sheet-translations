# Doc Parser API

Utilities for parsing Markdown content exported from Google Docs into structured translation key-value entries.

```typescript
import { parseDocContent, slugifyKey } from '@el-j/google-sheet-translations';
```

---

## Functions

### `parseDocContent(markdownContent, options?)`

Parses Markdown string into structured translation entries according to the chosen key extraction strategy.

```typescript
function parseDocContent(
  markdownContent: string,
  options?: ParseDocOptions
): ParsedDocEntry[]
```

#### Parameters

- `markdownContent` (`string`): Markdown text content.
- `options` (`ParseDocOptions`):
  - `strategy` (`'heading' | 'marker' | 'numbered'`): Extraction rule strategy. Default: `'heading'`.
  - `defaultSheetName` (`string`): Default sheet name if none specified in document. Default: `'content'`.

#### Returns

`ParsedDocEntry[]`:
```typescript
interface ParsedDocEntry {
  sheetName: string;
  key: string;
  value: string;
}
```

---

### `slugifyKey(input)`

Converts any arbitrary text string (headings, names) into a clean, snake_case translation key.

```typescript
function slugifyKey(input: string): string
```

#### Example

```typescript
slugifyKey('Hero Banner Title!'); // Returns: 'hero_banner_title'
slugifyKey('nav / home');         // Returns: 'nav_home'
```
