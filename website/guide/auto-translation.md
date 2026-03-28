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
=GOOGLETRANSLATE(INDIRECT("B"&ROW());"en";"de")
```

Where:
- `B` = the source column letter
- `"en"` = the GOOGLETRANSLATE-compatible code for the source locale (e.g. `en-US` → `"en"`)
- `"de"` = the GOOGLETRANSLATE-compatible code for the target locale (e.g. `de-DE` → `"de"`)
- `INDIRECT("B"&ROW())` dynamically references the source text in the same row

The language codes are resolved at generation time — region qualifiers (e.g. `"-TR"` in `tr-TR`) are stripped because `GOOGLETRANSLATE` only accepts bare ISO 639-1 codes for most languages. The exception is Chinese (`zh-TW` / `zh-CN`) where the region is preserved.

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
