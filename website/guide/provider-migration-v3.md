# Migration to v3 Provider Runtime

This guide helps existing users migrate from Google-first options to the v3 provider runtime.

## Migration principle

- Legacy API remains available during transition.
- New integrations should use provider config.
- Existing behavior can be mapped with helper utilities.

## From legacy to provider config

### Legacy call

```typescript
await getSpreadSheetData(['home'], {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  syncLocalChanges: true,
  autoTranslate: true,
  waitSeconds: 2,
});
```

### Provider runtime equivalent

```typescript
const config = {
  input: {
    provider: 'google-sheets',
    options: {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      waitSeconds: 2,
    },
  },
  sync: {
    provider: 'google-sheets',
    options: {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      autoTranslate: true,
    },
  },
};
```

## Mapping helper

Use `mapLegacyGoogleOptionsToProviderConfig` for incremental migration:

```typescript
import { mapLegacyGoogleOptionsToProviderConfig } from '@el-j/google-sheet-translations';

const { config, deprecations } = mapLegacyGoogleOptionsToProviderConfig({
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  syncLocalChanges: true,
  autoTranslate: true,
});

console.log(deprecations);
```

## Action migration

### Old

- `google-client-email`
- `google-private-key`
- `google-spreadsheet-id`
- `sheet-titles`

### New provider mode

- `provider-config` or `provider-config-path`
- still keep `sheet-titles`

## CLI migration

Preview migration without writing files:

```bash
gst-migrate-v3 --dry-run
```

Run config parity validation against legacy option mapping:

```bash
gst-migrate-v3 --dry-run --parity-check
```

Generate provider config and rewrite compatible workflows:

```bash
gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
```

Overwrite existing config if needed:

```bash
gst-migrate-v3 --force --provider-config-path=.github/provider.config.json
```

Then run provider mode:

```bash
gst-run-provider --config=.github/provider.config.json --sheet-titles=home,about
```

## Suggested staged rollout

1. Keep legacy in production.
2. Add provider config in CI preview.
3. Compare output snapshots.
4. Switch default automation to provider mode.
5. Remove legacy flow after confidence window.

## Notes

- `cryptpad-csv` is read-only in MVP.
- For full sync/write-back and asset sync planning, follow the provider full-sync roadmap.
