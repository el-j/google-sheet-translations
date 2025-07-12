# Auto-Translation Feature Guide

This guide provides detailed information about the auto-translation feature in the Google Sheet Translations package.

## Overview

The auto-translation feature automatically adds Google Translate formulas to your spreadsheet for missing translations when new keys are added. This helps streamline the translation workflow by providing initial machine translations that can be reviewed and refined by translators.

## How It Works

When enabled through the `autoTranslate: true` option:

1. The system detects new keys added to your local translation files that don't exist in the Google Sheet
2. For each new key, it checks which languages have translations and which are missing
3. For each language missing a translation:
   - It finds the first available translation in another language to use as the source
   - It adds a Google Translate formula in the appropriate cell: `=GOOGLETRANSLATE(sourceCell, "sourceLocale", "targetLocale")`

## Benefits

- **Save time**: Automatically generates initial translations for all missing languages
- **Consistent workflow**: Ensures all keys have at least a machine translation for every language
- **Easy refinement**: Translators can see and modify the machine translations directly in the spreadsheet

## Example Formula

If you add a new key "welcome_message" with an English translation in column B but no German translation in column C, the system will add:

```
=GOOGLETRANSLATE(INDIRECT("B"&ROW());$B$1;C$1)
```

Where:
- `INDIRECT("B"&ROW())` dynamically references the cell containing the source text in the same row
- `$B$1` references the header cell containing the source language code
- `C$1` references the header cell containing the target language code

This improved formula is more flexible because:
- It automatically adapts to any row position
- It uses the actual language codes from your spreadsheet headers
- It's more maintainable if you reorganize your columns

## How to Enable

```typescript
// In your code
import { getSpreadSheetData } from 'google-sheet-translations';

await getSpreadSheetData(['sheet1'], {
  autoTranslate: true  // Enable auto-translation
});
```

## Best Practices

1. **Use it during development**: Enable auto-translation when adding new features with new translation keys
2. **Review translations**: Always have a native speaker review the machine translations
3. **Combine with bidirectional sync**: Use the auto-translation feature together with bidirectional sync for the most efficient workflow

## Limitations

1. The quality of machine translations varies depending on the language pair and content
2. Complex phrases or industry-specific terminology may not translate accurately
3. Machine translations should always be reviewed by someone familiar with the target language

## Examples

See the `examples/auto-translation-example.ts` file for a complete working example of the auto-translation feature.
