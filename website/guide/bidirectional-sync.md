# Bidirectional Sync

The package supports a full read-write workflow: **pull** translations from Google Sheets into your app, and **push** new keys from your app back into the spreadsheet.

## How it works

```
┌─────────────────┐        pull         ┌──────────────────┐
│  Google Sheets  │ ──────────────────► │  languageData.json│
│   (source of    │                     │  translations/    │
│     truth)      │ ◄────────────────── │  (local files)   │
└─────────────────┘        push         └──────────────────┘
```

1. **First run** — fetches all sheets and writes `languageData.json` + per-locale JSON files.
2. **You add new keys** — edit `languageData.json` locally during development.
3. **Next run** — the package detects that `languageData.json` is newer than the JSON output files, diffs the two, and **adds** the new keys to the spreadsheet.
4. **Subsequent runs** — once translators have filled in the spreadsheet, pull again to get the completed translations.

## Enabling sync

Sync is **enabled by default** (`syncLocalChanges: true`). To disable it (read-only pull):

```typescript
await getSpreadSheetData(['home'], { syncLocalChanges: false });
```

## When does a push happen?

The package checks three conditions before pushing:

1. `syncLocalChanges` is `true`
2. `languageData.json` exists
3. `languageData.json` is **newer** than the most recent translation JSON file

Only keys present in your local data but absent from the spreadsheet are pushed — the package never overwrites existing translations.

## Combined with auto-translation

```typescript
await getSpreadSheetData(['home'], {
  syncLocalChanges: true,
  autoTranslate: true, // add GOOGLETRANSLATE formulas for missing cells
});
```

See [Auto-Translation](/guide/auto-translation) for details.

## Refresh after push

After pushing, the package automatically re-fetches the spreadsheet (once) to pick up any formulas that were just added. This ensures your local files are immediately up to date.

## Safety guarantees

- New keys are only **added** — existing rows are never deleted
- A maximum depth of 1 recursive refresh prevents infinite loops
- Each `row.save()` call is wrapped in try/catch — one failing row does not abort the entire sync
