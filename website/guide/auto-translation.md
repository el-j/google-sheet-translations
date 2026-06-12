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
2. For every other locale that is **missing** a translation, it injects a formula like:

```
=GOOGLETRANSLATE(INDIRECT("B"&ROW());IF(LOWER(LEFT($B$1;3))="zh-";LOWER($B$1);LOWER(IFERROR(LEFT($B$1;FIND("-";$B$1)-1);$B$1)));IF(LOWER(LEFT(C$1;3))="zh-";LOWER(C$1);LOWER(IFERROR(LEFT(C$1;FIND("-";C$1)-1);C$1))))
```

Where:
- `B` = the source column letter
- `C` = the target column letter
- `INDIRECT("B"&ROW())` dynamically references the source text in the same row
- The `IF(…)` wrapper extracts the GOOGLETRANSLATE-compatible code from the header cells:
  - For Chinese variants (`zh-TW`, `zh-CN`): preserves the full code
  - For all others: extracts the ISO 639-1 prefix (e.g. `"tr-TR"` → `"tr"`)
- All separators (`;` or `,`) are matched to the spreadsheet's locale

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
