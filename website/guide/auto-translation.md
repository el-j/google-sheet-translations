# Auto-Translation

When `autoTranslate: true` is set, the package automatically injects `=GOOGLETRANSLATE(…)` formulas into any cell that is missing a translation when a new key is added to the spreadsheet.

## Enable

```typescript
await getSpreadSheetData(['home', 'common'], {
  syncLocalChanges: true,  // required: sync must be enabled
  autoTranslate: true,
});
```

## What it does

For every new key pushed to the spreadsheet:

1. It picks the **first locale** that already has a translation as the **source**.
2. For every other locale that is **missing** a translation, it injects:

```
=GOOGLETRANSLATE(INDIRECT("B"&ROW());$B$1;C$1)
```

Where:
- `B` = the source column letter
- `C` = the target column letter
- `INDIRECT("B"&ROW())` dynamically references the source text in the same row
- `$B$1` / `C$1` reference the language-code headers

The formula uses the actual language codes in your header row, so the translation is always correct regardless of which row it's in.

> [!NOTE]
> The package supports spreadsheets with more than 26 columns — column letters are generated correctly up to ZZ and beyond.

## Best practices

1. **Review machine translations** — `=GOOGLETRANSLATE` produces drafts, not final copy.
2. **Use for speed** — let auto-translation give translators a starting point.
3. **Combine with bidirectional sync** — push new keys and immediately get translated drafts pulled back.

## Limitations

- Quality varies by language pair and content domain.
- Complex phrases, idioms, and technical jargon may not translate accurately.
- Google Sheets has a daily limit on `GOOGLETRANSLATE` calls.
