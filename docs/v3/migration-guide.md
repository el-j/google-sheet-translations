# v3 Migration Guide: Google-First API to Provider API

## Summary

v3 introduces a provider runtime model where input/output/sync are configured explicitly.
Legacy `SpreadsheetOptions` still work during transition, but are deprecated.

## Before and After

### Before (legacy)

```ts
import { getSpreadSheetData } from '@el-j/google-sheet-translations';

await getSpreadSheetData(['home', 'about'], {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  syncLocalChanges: true,
  autoTranslate: true,
  waitSeconds: 2,
});
```

### After (provider runtime)

```ts
import {
  createProvidersFromRuntimeConfig,
  runProviderPipeline,
  assertValidProviderRuntimeConfig,
} from '@el-j/google-sheet-translations';

const config = assertValidProviderRuntimeConfig({
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
});

const providers = createProvidersFromRuntimeConfig(config);
const result = await runProviderPipeline({
  inputProvider: providers.inputProvider,
  syncProvider: providers.syncProvider,
  tableNames: ['home', 'about'],
});
```

## Legacy Option Mapping

`mapLegacyGoogleOptionsToProviderConfig(options)` converts legacy options to provider config.

| Legacy option | v3 target |
|---|---|
| `spreadsheetId` | `input.options.spreadsheetId`, `sync.options.spreadsheetId` |
| `rowLimit` | `input.options.rowLimit` |
| `waitSeconds` | `input.options.waitSeconds`, `sync.options.waitSeconds` |
| `publicSheet` | `input.options.publicSheet` |
| `syncLocalChanges` | controls whether `sync` provider is present |
| `autoTranslate` | `sync.options.autoTranslate` |
| `override` | `sync.options.override` |

## Provider Capability Matrix

| Provider | readTables | writeTables | syncBack | autoTranslateFormula | discoverByFolder | assetSync | publicReadNoAuth |
|---|---:|---:|---:|---:|---:|---:|---:|
| `google-sheets` input | yes | no | no | no | yes | no | yes |
| `google-sheets` output | no | yes | no | yes | no | no | no |
| `google-sheets` sync | no | yes | yes | yes | no | no | no |
| `cryptpad-csv` input | yes | no | no | no | no | no | yes |

## Cookbook Scenarios

### 1) Google full workflow (read + sync)

- Input provider: `google-sheets`
- Sync provider: `google-sheets`
- Auth required: yes (except fully public read-only mode)

### 2) CryptPad read-only workflow

- Input provider: `cryptpad-csv`
- Output provider: optional (filesystem handled by caller/action integration)
- Sync provider: none
- Auth required: no

### 3) Mixed mode: CryptPad input + Google output

- Input provider: `cryptpad-csv`
- Output provider: `google-sheets`
- Sync provider: optional `google-sheets`
- Auth required: yes (because Google output/sync is enabled)

## GitHub Action Migration

You can now pass either:

- `provider-config`: inline JSON string
- `provider-config-path`: path to JSON file in the repo

These are mutually exclusive.

## CLI Migration

Use the migration command to auto-generate provider config from legacy GitHub Action usage:

```bash
gst-migrate-v3 --dry-run
```

Apply migration and rewrite compatible workflow steps:

```bash
gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
```

If the config file already exists and you want to replace it:

```bash
gst-migrate-v3 --force --provider-config-path=.github/provider.config.json
```

After migration, run provider mode directly:

```bash
gst-run-provider --config=.github/provider.config.json --sheet-titles=home,about
```

## Known Constraints

- `cryptpad-csv` is intentionally read-only in MVP.
- Formula-based auto translation remains a Google-specific sync/output capability.
- Legacy `getSpreadSheetData()` is still available during transition and will emit deprecation guidance in v3 rollout updates.
