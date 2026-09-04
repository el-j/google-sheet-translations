# Migrate to v3 API

Programmatic API behind the `gst-migrate-v3` CLI. See the [Migration to v3 guide](/guide/provider-migration-v3) for the narrative walkthrough and CLI examples.

```typescript
import { migrateProjectToV3 } from '@el-j/google-sheet-translations';
```

## `migrateProjectToV3(options?)`

Auto-migrates a project from the legacy GitHub Action inputs to the v3 provider runtime: scans `.github/workflows/*.yml` for steps using the legacy action inputs, generates a `ProviderRuntimeConfig` from the first legacy step found, writes it to `providerConfigPath`, and — when `writeWorkflows` is set — rewrites each matching step in place to reference that config file instead of the legacy inputs.

```typescript
function migrateProjectToV3(options?: MigrateV3Options): MigrateV3Result
```

```typescript
interface MigrateV3Options {
  projectRoot?: string;          // default: process.cwd()
  providerConfigPath?: string;   // default: 'provider.config.json'
  dryRun?: boolean;              // preview changes without writing any files
  writeWorkflows?: boolean;      // rewrite legacy workflow steps to provider-config-path mode
  force?: boolean;               // overwrite an existing provider config file
  parityCheck?: boolean;         // cross-check generated config against legacy option mapping
}

interface MigrateV3Result {
  projectRoot: string;
  providerConfigPath: string;
  providerConfig: ProviderRuntimeConfig;
  legacyWorkflowsFound: string[];
  rewrittenWorkflows: string[];
  createdFiles: string[];
  warnings: string[];
  parityCheck?: {
    passed: boolean;
    differences: string[];
    expectedConfig: ProviderRuntimeConfig;
  };
}
```

### Behavior notes

- Throws `No workflow files found under .github/workflows.` if the project has no `.github/workflows/` directory.
- Throws `No legacy action usage found to migrate.` if no workflow step uses the legacy action inputs.
- Workflows using Drive-folder mode (`drive-folder-id`, `spreadsheet-ids`, `sync-images`) have no v3 equivalent yet — these are left untouched with a warning rather than being rewritten, even when `writeWorkflows` is set.
- If a provider config already exists at `providerConfigPath` and `force` is not set, the existing file is left alone and a warning is added to `warnings` (`createdFiles` stays empty).
- `parityCheck` compares the generated config against what `mapLegacyGoogleOptionsToProviderConfig` would produce from the same legacy inputs; any `differences` are also appended to `warnings`.

### Example

```typescript
const result = migrateProjectToV3({
  projectRoot: process.cwd(),
  providerConfigPath: '.github/provider.config.json',
  writeWorkflows: true,
  parityCheck: true,
});

if (result.parityCheck && !result.parityCheck.passed) {
  console.warn(result.parityCheck.differences);
}
```

Equivalent CLI invocation:

```bash
gst-migrate-v3 --provider-config-path=.github/provider.config.json --write-workflows --parity-check
```
