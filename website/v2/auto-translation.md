# v2 Auto-Translation

::: warning v2 formula behavior
v2 auto-translation relies on Google Sheets formulas. v3 keeps this as a Google-provider capability.
:::

Enable formula injection for missing target-locale cells:

```ts
await getSpreadSheetData(['home'], {
  syncLocalChanges: true,
  autoTranslate: true,
});
```

## What happens

- New keys pushed to the sheet can get `GOOGLETRANSLATE(...)` formulas.
- Translators can edit generated values afterward.
- Formula strategy is Google-specific and depends on sheet headers/locales.

Use v3 migration docs when you are ready: [Migration to v3](/guide/provider-migration-v3).
