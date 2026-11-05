# Locale Filtering

The package applies automatic filtering to decide which locales appear in the generated `locales.ts` file.

## The problem

Imagine your spreadsheet has columns `key | en | de | fr | es`. Only `en` and `de` have content in your actual content sheets; `fr` and `es` are placeholders that are only partially filled in the `i18n` config sheet. You probably **don't** want to ship `fr` and `es` as supported app locales.

## How filtering works

The generated `locales.ts` only lists locales that:

1. Have actual translation content in a **non-`i18n`** sheet, **and**
2. Are recognised as valid locale identifiers (see formats below)

## Supported locale formats

| Pattern | Example |
|---------|---------|
| Two-letter code | `en`, `de`, `fr` |
| Language-country hyphen | `en-us`, `de-DE` |
| Language-country underscore | `en_us`, `zh_cn` |
| Extended code | `en-us-traditional` |

## Filtered-out keywords

These column names are never treated as locales:

`key` · `keys` · `id` · `identifier` · `name` · `title` · `label` · `description` · `comment` · `note` · `context` · `category` · `type` · `status` · `updated` · `created` · `modified` · `version` · `source` · `i18n` · `translation` · `namespace` · `section`

## Use the utilities directly

```typescript
import { isValidLocale, filterValidLocales } from '@el-j/google-sheet-translations';

isValidLocale('en-us');       // → true
isValidLocale('description'); // → false
isValidLocale('key');         // → false

filterValidLocales(['key', 'en', 'description', 'de'], 'key');
// → ['en', 'de']
```
