# v2 Bidirectional Sync

::: warning Legacy sync flow
This page documents the v2 sync model. v3 provider runtime gives clearer capability controls.
:::

v2 supports pull and push loops with `getSpreadSheetData`.

## Typical flow

1. Pull spreadsheet content into local files.
2. Add keys in local `languageData.json`.
3. Run again to push missing keys back to spreadsheet.
4. Pull again to retrieve completed translations.

```ts
await getSpreadSheetData(['home'], {
  syncLocalChanges: true,
});
```

## Safety notes

- New keys are added; existing sheet data is not broadly overwritten in standard mode.
- Sync checks whether `languageData.json` is newer before pushing incremental changes.
- Errors during sync are handled and logged to avoid uncontrolled crashes.

For migration guidance: [v2 Migration Notes](/v2/migration-notes).
