# Provider Runtime (v3)

The v3 runtime separates translation workflows into explicit providers:

- Input provider
- Output provider
- Sync provider

This architecture makes it possible to combine different data sources and destinations while keeping one shared transformation pipeline.

## Why this matters

- Clear capability boundaries: unsupported operations fail before a run starts.
- Pluggable providers: Google-first today, multi-provider tomorrow.
- Migration-friendly: legacy options can be mapped into provider config.

## Runtime config shape

```ts
interface ProviderRuntimeConfig {
  input: { provider: string; options?: Record<string, unknown> };
  output?: { provider: string; options?: Record<string, unknown> };
  sync?: { provider: string; options?: Record<string, unknown> };
  assetSync?: { provider: string; options?: Record<string, unknown> };
}
```

Validate config before execution:

```typescript
import { assertValidProviderRuntimeConfig } from '@el-j/google-sheet-translations';

const config = assertValidProviderRuntimeConfig({
  input: { provider: 'google-sheets', options: { spreadsheetId: '...' } },
});
```

## Running a pipeline

```typescript
import {
  createProvidersFromRuntimeConfig,
  runProviderPipeline,
} from '@el-j/google-sheet-translations';

const providers = createProvidersFromRuntimeConfig(config);
const result = await runProviderPipeline({
  inputProvider: providers.inputProvider,
  outputProvider: providers.outputProvider,
  syncProvider: providers.syncProvider,
  tableNames: ['home', 'about'],
});

console.log(result.locales);
```

## Current provider support

### google-sheets

- Input: yes
- Output: yes
- Sync back: yes
- Public no-auth read: yes (when `publicSheet: true`)

### cryptpad-csv MVP (input only)

- Input: yes
- Output: no
- Sync back: no
- Public no-auth read: yes

The `cryptpad-csv` provider reads CSV files/exports only. Pair it with `cryptpad-workspace` for write-back.

### cryptpad-workspace

- Output: yes (writes a local JSON snapshot file)
- Sync back: yes (three-way diff with configurable conflict policy)

### cryptpad-assets

- Asset sync: yes — downloads/updates/skips manifest-listed files into a target directory, with optional deletion of local files not in the manifest

See [CryptPad Providers](/api/cryptpad-provider) for full options, and the [Full Sync Operations guide](/guide/full-sync-operations-v3) for the conflict-policy cookbook and asset-sync runbook.

## GitHub Action provider mode

Use one of these inputs to specify provider configuration:

- `provider-config` (inline JSON)
- `provider-config-path` (path to JSON file)

These inputs are mutually exclusive. To trigger asset synchronization in Action workflows, configure `assetSync` in your config or supply:

- `asset-target-dir` (target directory for downloaded media assets)
- `asset-delete-missing` (optional boolean, delete untracked local assets)

## CLI provider mode

```bash
gst-run-provider --config=provider.config.json --sheet-titles=home,about
```

Add `--asset-target-dir` (and optionally `--asset-delete-missing`) to also run asset sync, when `assetSync` is configured (or define `targetDirectory` directly in `config.assetSync.options`):

```bash
gst-run-provider --config=provider.config.json --sheet-titles=home,about --asset-target-dir=public/assets
```

## Implementing custom providers

The v3 platform is designed to be easily extensible. Any storage backend (Airtable, Notion, custom REST API, SQLite, local files) can be plugged directly into the pipeline by implementing a provider interface and declaring its capabilities:

```typescript
import {
  createCapabilitySet,
  runProviderPipeline,
  type TranslationInputProvider,
} from '@el-j/google-sheet-translations';

// 1. Implement a custom input provider
export function createAirtableInputProvider(apiKey: string, baseId: string): TranslationInputProvider {
  return {
    kind: 'input',
    providerId: 'airtable-input',
    displayName: 'Airtable Translations',
    capabilities: createCapabilitySet({ readTables: true }),
    async readTables({ tableNames }) {
      // Fetch records from your backend
      const records = await fetchAirtableRecords(apiKey, baseId, tableNames);
      return {
        tables: records.map((table) => ({
          tableId: table.id,
          tableName: table.name,
          rows: table.rows, // Array of { key: 'hello', en: 'Hello', de: 'Hallo' }
        })),
      };
    },
  };
}

// 2. Run through the canonical transformation & output pipeline
const result = await runProviderPipeline({
  inputProvider: createAirtableInputProvider(process.env.AIRTABLE_KEY!, 'app123'),
  tableNames: ['home', 'nav'],
});
```

See the [Provider Contracts reference](/api/provider-contracts) for complete type definitions and contracts for `TranslationInputProvider`, `TranslationOutputProvider`, `TranslationSyncProvider`, and `AssetSyncProvider`.

## Capability safety

Operations are guarded by capability checks:

- read-input requires `readTables`
- write-output requires `writeTables`
- sync-back requires `syncBack`
- sync-assets requires `assetSync`

This prevents invalid combinations from silently doing partial work.

## Full API reference

See [Provider Platform (v3)](/api/provider-platform) for the complete API, [Provider Contracts](/api/provider-contracts) for interface contracts, or jump straight to the [Google Sheets Provider](/api/google-provider) or [CryptPad Providers](/api/cryptpad-provider) reference.
