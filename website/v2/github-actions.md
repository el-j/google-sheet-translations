# v2 GitHub Action

::: warning v2 Action Compatibility
The action continues to support v2-style inputs for transition, but v3 provider config is the long-term path.
:::

## Typical v2 step

```yaml
- name: Fetch translations
  uses: el-j/google-sheet-translations@v2
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,about,pricing'
    sync-local-changes: 'true'
```

## Migration-ready option

You can replace legacy input sets with:

- `provider-config`
- `provider-config-path`

Then execute via provider runtime docs: [Provider Runtime](/guide/provider-runtime).
