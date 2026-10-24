# v2 Configuration

::: warning Legacy configuration model
These options describe the v2 Google-first API surface. For new builds, use v3 provider runtime config.
:::

All options are passed as the second argument to `getSpreadSheetData`.

```ts
await getSpreadSheetData(['home', 'common'], {
  rowLimit: 200,
  waitSeconds: 2,
  dataJsonPath: 'src/lib/languageData.json',
  localesOutputPath: 'src/i18n/locales.ts',
  translationsOutputDir: 'translations',
  syncLocalChanges: true,
  autoTranslate: false,
});
```

## Core options

- `rowLimit` (default `100`)
- `waitSeconds` (default `1`)
- `dataJsonPath` (default `src/lib/languageData.json`)
- `localesOutputPath` (default `src/i18n/locales.ts`)
- `translationsOutputDir` (default `translations`)
- `syncLocalChanges` (default `true`)
- `autoTranslate` (default `false`)

## Important v2 behavior

- Sync only pushes new local keys back to spreadsheet rows.
- Existing translated values are not blindly replaced in normal sync mode.
- Auto-translation requires sync mode.

See [v2 Bidirectional Sync](/v2/bidirectional-sync) and [v2 Auto-Translation](/v2/auto-translation).
