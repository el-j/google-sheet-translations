# Migrating from v2 to v3

This guide provides a comprehensive, step-by-step walkthrough for migrating projects from **v2 (Google-first)** to the **v3 (Universal Provider Platform)**.

Whether you have a simple single-spreadsheet setup or a complex multi-folder CI pipeline with image synchronization, v3 provides automated tooling and runtime backward compatibility to ensure **zero downtime**.

---

## Why Migrate to v3?

1. **Vendor Independence**: In v2, your translation pipeline was locked to Google Sheets. In v3, you can switch or combine data sources — including [CryptPad](/guide/non-google-providers) (privacy-first / no-auth), local CSV/JSON files, and custom backends.
2. **Safer Execution**: Providers declare capabilities explicitly (`readTables`, `writeTables`, `syncBack`, `assetSync`). Unsupported operations fail validation immediately before running.
3. **Cleaner CI/CD**: Replace dozens of flat Action inputs with a single version-controlled `provider.config.json` file.
4. **Fine-Grained Conflict Resolution**: Control 3-way merge behavior with explicit policies (`remote-wins`, `local-wins`, `fail-on-conflict`).

---

## Backward Compatibility Guarantee

> [!NOTE]
> All v2 APIs (`getSpreadSheetData`, `manageDriveTranslations`, legacy GitHub Action inputs) continue to work in v3 without breaking changes.
>
> You can migrate gradually: leave production builds untouched while validating v3 provider pipelines in a preview branch.

---

## Migration Path Options

You can migrate your project in three different ways:

| Approach | Best For | Effort |
| :--- | :--- | :--- |
| **1. Automated CLI Tool** (`gst-migrate-v3`) | Most projects; automatically writes configs and rewrites workflows | **Low (5 mins)** |
| **2. Options Mapper Helper** | Codebases with dynamic JavaScript/TypeScript option generation | **Low (10 mins)** |
| **3. Manual Provider Config** | Custom setups, multi-provider, or transitioning to CryptPad | **Medium (15 mins)** |

---

## Option 1: Automated Migration with `gst-migrate-v3`

v3 ships with an interactive CLI migration assistant that inspects your repository, detects your v2 configuration or GitHub Action workflows, and generates valid v3 configurations.

### Step 1: Preview Migration (Dry Run)

Run `gst-migrate-v3` in dry-run mode to inspect what will change without touching any files:

```bash
npx gst-migrate-v3 --dry-run
```

The CLI outputs:
- Detected Google credentials and spreadsheet references.
- Proposed `provider.config.json` structure.
- Deprecated options and their modern v3 equivalents.

### Step 2: Parity Check

To verify that the generated v3 config produces the exact same translation output as your current v2 configuration, run:

```bash
npx gst-migrate-v3 --dry-run --parity-check
```

The tool fetches translation data using both pipelines in-memory and verifies that the resulting JSON files and `locales.ts` match bit-for-bit.

### Step 3: Generate Config & Rewrite Workflows

Once satisfied, generate the configuration file and automatically update your GitHub Action workflow files:

```bash
npx gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
```

This creates:
- `.github/provider.config.json` with your input and sync settings.
- Updates `.github/workflows/translations.yml` to use `provider-config-path`.

---

## Option 2: Code Migration in TypeScript

If your project invokes `@el-j/google-sheet-translations` programmatically in Node.js or Next.js build scripts, you can migrate from `getSpreadSheetData` to `runProviderPipeline`.

### Side-by-Side Comparison

#### v2 (Legacy)

```typescript
import getSpreadSheetData from '@el-j/google-sheet-translations';

const translations = await getSpreadSheetData(['home', 'common'], {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
  syncLocalChanges: true,
  autoTranslate: true,
  waitSeconds: 2,
});
```

#### v3 (Provider Runtime)

```typescript
import {
  createGoogleSheetsInputProvider,
  createGoogleSheetsSyncProvider,
  runProviderPipeline,
} from '@el-j/google-sheet-translations';

const inputProvider = createGoogleSheetsInputProvider({
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
  credentials: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY,
  },
  waitSeconds: 2,
});

const syncProvider = createGoogleSheetsSyncProvider({
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
  credentials: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY,
  },
  autoTranslate: true,
});

const result = await runProviderPipeline({
  inputProvider,
  syncProvider,
  tableNames: ['home', 'common'],
});
```

### Using the Runtime Mapping Helper

If you have existing code that constructs v2 options objects, use `mapLegacyGoogleOptionsToProviderConfig` to convert them dynamically:

```typescript
import {
  mapLegacyGoogleOptionsToProviderConfig,
  createProvidersFromRuntimeConfig,
  runProviderPipeline,
} from '@el-j/google-sheet-translations';

const legacyOptions = {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  syncLocalChanges: true,
  autoTranslate: true,
};

const { config, deprecations } = mapLegacyGoogleOptionsToProviderConfig(legacyOptions);

// Log any deprecated flags in development
if (process.env.NODE_ENV !== 'production' && deprecations.length > 0) {
  console.warn('Deprecated v2 translation options:', deprecations);
}

const providers = createProvidersFromRuntimeConfig(config);
const result = await runProviderPipeline({
  inputProvider: providers.inputProvider,
  syncProvider: providers.syncProvider,
  tableNames: ['home'],
});
```

---

## Option 3: GitHub Action Migration

### v2 Workflow (Legacy)

```yaml
name: Sync Translations
on: [workflow_dispatch]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: el-j/google-sheet-translations@v2
        with:
          google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
          google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          sheet-titles: 'home,common,checkout'
          sync-local-changes: 'true'
          auto-translate: 'true'
```

### v3 Workflow (Provider Mode)

#### With External Config File (Recommended)

Store your configuration in `.github/provider.config.json`:

```json
{
  "input": {
    "provider": "google-sheets",
    "options": {
      "spreadsheetId": "${{ secrets.GOOGLE_SPREADSHEET_ID }}"
    }
  },
  "sync": {
    "provider": "google-sheets",
    "options": {
      "spreadsheetId": "${{ secrets.GOOGLE_SPREADSHEET_ID }}",
      "autoTranslate": true
    }
  }
}
```

Then reference it cleanly in your GitHub Actions workflow:

```yaml
name: Sync Translations (v3)
on: [workflow_dispatch]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: el-j/google-sheet-translations@v3
        with:
          provider-config-path: .github/provider.config.json
          sheet-titles: 'home,common,checkout'
        env:
          GOOGLE_SPREADSHEET_ID: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
          GOOGLE_CLIENT_EMAIL: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
```

---

## Transitioning to Non-Google Sources (e.g. CryptPad)

Once on v3, you can migrate away from Google Sheets entirely without changing how your application consumes translations:

1. Export or publish your CryptPad spreadsheet as a public CSV link.
2. Change your `input.provider` from `google-sheets` to `cryptpad-csv`:

```json
{
  "input": {
    "provider": "cryptpad-csv",
    "options": {
      "csvUrl": "https://cryptpad.fr/file/export.csv",
      "tableName": "home"
    }
  },
  "sync": {
    "provider": "cryptpad-workspace",
    "options": {
      "workspacePath": ".translations/workspace.json",
      "conflictPolicy": "fail-on-conflict"
    }
  }
}
```

3. Remove all Google credentials and Service Accounts from your repository secrets.
4. Run `npm run translations`: your application continues to receive identical JSON files and `locales.ts`!

For details, see the [Non-Google Providers Guide](/guide/non-google-providers).

---

## Options Mapping Reference

| v2 Legacy Option | v3 Provider Runtime Equivalent | Notes |
| :--- | :--- | :--- |
| `spreadsheetId` | `input.options.spreadsheetId` | Now scoped to provider options |
| `googleClientEmail` | `input.options.credentials.clientEmail` | Or set `GOOGLE_CLIENT_EMAIL` env |
| `googlePrivateKey` | `input.options.credentials.privateKey` | Or set `GOOGLE_PRIVATE_KEY` env |
| `publicSheet: true` | `input.options.publicSheet: true` | Works with Google Sheets & CryptPad |
| `syncLocalChanges: true` | Configure `sync` provider block | Enables write-back |
| `autoTranslate: true` | `sync.options.autoTranslate: true` | Injects machine translation formulas |
| `syncDriveImages: true` | Configure `assetSync` provider block | Modular asset pipeline |
| `waitSeconds` | `input.options.waitSeconds` | Rate-limiting delay |

---

## Recommended Staged Rollout

1. **Phase 1 — Local Verification**: Run `npx gst-migrate-v3 --dry-run --parity-check` in a feature branch.
2. **Phase 2 — Non-Production CI**: Deploy the generated `.github/provider.config.json` in a pull request workflow. Compare output diffs.
3. **Phase 3 — Production Cutover**: Merge the provider config to `main` and switch default CI workflows to `provider-config-path`.
4. **Phase 4 — Explore New Providers**: Take advantage of v3 capabilities like [CryptPad integration](/guide/non-google-providers) or asset manifests.
