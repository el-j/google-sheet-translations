# Locale Utilities

Utility functions for validating and filtering locale identifiers.

## isValidLocale

```typescript
function isValidLocale(value: string): boolean
```

Returns `true` if `value` looks like a valid locale identifier.

### Recognised patterns

| Pattern | Example | Result |
|---------|---------|--------|
| Two-letter code | `en` | ✅ |
| Language-country hyphen | `en-us` | ✅ |
| Language-country underscore | `zh_cn` | ✅ |
| Extended code | `en-us-traditional` | ✅ |
| Common non-locale word | `description` | ❌ |
| Keyword | `key`, `id`, `name` | ❌ |

### Examples

```typescript
import { isValidLocale } from '@el-j/google-sheet-translations';

isValidLocale('en');          // true
isValidLocale('en-us');       // true
isValidLocale('zh_cn');       // true
isValidLocale('description'); // false
isValidLocale('key');         // false
isValidLocale('');            // false
```

---

## filterValidLocales

```typescript
function filterValidLocales(
  headerRow: string[],
  keyColumn: string,
): string[]
```

Filters an array of column names (from a sheet header row) to only those that are valid locale identifiers, excluding the key column.

### Parameters

- `headerRow` — all column names in the header row (e.g. `['key', 'en', 'description', 'de']`)
- `keyColumn` — the name of the key column to exclude (e.g. `'key'`)

### Returns

`string[]` — locale names in **lowercase**, e.g. `['en', 'de']`

### Example

```typescript
import { filterValidLocales } from '@el-j/google-sheet-translations';

filterValidLocales(['key', 'en', 'description', 'de', 'fr'], 'key');
// → ['en', 'de', 'fr']

filterValidLocales(['Key', 'EN', 'DE', 'comment'], 'key');
// → ['en', 'de']
```
