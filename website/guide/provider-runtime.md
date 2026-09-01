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

### cryptpad-csv MVP

- Input: yes
- Output: no
- Sync back: no
- Public no-auth read: yes

The CryptPad provider currently supports reading CSV files/exports only. Full write-back and asset-sync support are tracked in the full-sync roadmap.

## GitHub Action provider mode

Use one of these inputs:

- `provider-config` (inline JSON)
- `provider-config-path` (path to JSON file)

These inputs are mutually exclusive.

## CLI provider mode

```bash
gst-run-provider --config=provider.config.json --sheet-titles=home,about
```

## Capability safety

Operations are guarded by capability checks:

- read-input requires `readTables`
- write-output requires `writeTables`
- sync-back requires `syncBack`

This prevents invalid combinations from silently doing partial work.
