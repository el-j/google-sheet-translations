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

If you add a new key "welcome_message" with an English translation but no German translation, the system will add something like:

```
=GOOGLETRANSLATE(B23, "en-us", "de")
```

Where:
- `B23` references the cell containing the English text
- `"en-us"` is the source language code
- `"de"` is the target language code

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
