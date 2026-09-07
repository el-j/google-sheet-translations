# Non-Google Providers: CryptPad & Custom Data Sources

One of the defining innovations in **v3** is removing vendor lock-in. You are no longer restricted to Google Spreadsheets or Google Cloud Service Accounts. 

This guide demonstrates how to use **CryptPad** as a secure, open-source data source, and how to create custom providers for any backend (Airtable, Notion, local files, internal APIs).

---

## Why Non-Google Providers?

While Google Sheets is ubiquitous, many teams have requirements that Google Cloud cannot satisfy:

- **Privacy & Sovereignty**: Translations for medical, legal, or proprietary software often cannot be stored on third-party US cloud infrastructure.
- **Open-Source & Self-Hosted**: Teams utilizing self-hosted collaboration suites like [CryptPad](https://cryptpad.org) or Nextcloud want their CI pipelines to consume strings directly from their sovereign instances.
- **Zero-Auth Simplicity**: Ingesting from public or team-shared CSV exports removes the overhead of Google Cloud project setup, Service Account JSON keys, and Workload Identity Federation.

---

## CryptPad Integration

[CryptPad](https://cryptpad.org) is an open-source, end-to-end encrypted collaboration suite. In v3, `@el-j/google-sheet-translations` offers a complete triad of CryptPad providers:

```
                      ┌────────────────────────┐
                      │   CryptPad Instance    │
                      └───────────┬────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  cryptpad-csv    │    │cryptpad-workspace│    │ cryptpad-assets  │
│  (Input Provider)│    │(Output & Sync)   │    │  (Asset Sync)    │
│  • Public CSV    │    │  • 3-Way Diff    │    │  • Remote Images │
│  • Zero Auth     │    │  • Snapshots     │    │  • Manifest Sync │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 1. Ingesting Tables: `cryptpad-csv`

The `cryptpad-csv` provider reads spreadsheet exports or raw CSV files without needing any authentication keys.

#### Configuration in `provider.config.json`

```json
{
  "input": {
    "provider": "cryptpad-csv",
    "options": {
      "csvUrl": "https://cryptpad.fr/file/your-sheet-export.csv",
      "tableName": "common",
      "timeoutMs": 10000
    }
  }
}
```

#### TypeScript API Example

```typescript
import {
  createCryptPadCsvInputProvider,
  runProviderPipeline,
} from '@el-j/google-sheet-translations';

const inputProvider = createCryptPadCsvInputProvider({
  csvUrl: 'https://cryptpad.example.org/export/translations.csv',
  tableName: 'common',
});

const result = await runProviderPipeline({
  inputProvider,
  tableNames: ['common'],
});

console.log('Ingested locales:', result.locales);
```

### 2. Bidirectional Synchronization: `cryptpad-workspace`

When you want to maintain a local baseline and detect conflicts between local code changes and remote CryptPad edits, pair your input provider with `cryptpad-workspace`:

- **Snapshot tracking**: Preserves a `.cryptpad-workspace.json` snapshot of the last known state.
- **3-way diffing**: Compares the previous snapshot, incoming CryptPad data, and local translation files.
- **Configurable conflict policies**:
  - `remote-wins`: Remote CryptPad edits override conflicting local edits.
  - `local-wins`: Local code changes take precedence over remote edits.
  - `fail-on-conflict`: The pipeline exits with a non-zero exit code if overlapping keys conflict, preventing accidental data loss.

```json
{
  "input": {
    "provider": "cryptpad-csv",
    "options": {
      "csvUrl": "https://cryptpad.fr/export/common.csv",
      "tableName": "common"
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

### 3. Media & Asset Sync: `cryptpad-assets`

If your translators or content editors attach localized banners, illustrations, or screenshots in CryptPad, the `cryptpad-assets` provider downloads and manages them incrementally:

```json
{
  "assetSync": {
    "provider": "cryptpad-assets",
    "options": {
      "manifestUrl": "https://cryptpad.fr/export/assets-manifest.json",
      "targetDirectory": "public/assets/translations",
      "deleteMissing": false
    }
  }
}
```

Run asset sync directly through the CLI:

```bash
gst-run-provider --config=provider.config.json --asset-target-dir=public/assets/translations
```

---

## Building a Custom Provider

The v3 platform is strictly modular. Any data source can become a translation provider by implementing standard TypeScript interfaces and declaring capabilities via `createCapabilitySet`.

Here is a complete custom provider reading from an internal REST API or database:

```typescript
import {
  createCapabilitySet,
  runProviderPipeline,
  type TranslationInputProvider,
  type TranslationTable,
} from '@el-j/google-sheet-translations';

export function createCustomApiInputProvider(endpoint: string, authToken: string): TranslationInputProvider {
  return {
    kind: 'input',
    providerId: 'custom-api',
    displayName: 'Internal Localization API',
    capabilities: createCapabilitySet({
      readTables: true,
      publicRead: false,
    }),
    async readTables({ tableNames }) {
      const response = await fetch(`${endpoint}/translations?tables=${tableNames.join(',')}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch translations: ${response.statusText}`);
      }

      const payload = await response.json();
      // Transform into standard TranslationTable[] shape:
      // rows: [{ key: 'navbar.home', en: 'Home', de: 'Startseite' }]
      const tables: TranslationTable[] = payload.map((item: any) => ({
        tableId: item.id,
        tableName: item.name,
        rows: item.records,
      }));

      return { tables };
    },
  };
}

// Execute the pipeline with your custom provider
const result = await runProviderPipeline({
  inputProvider: createCustomApiInputProvider('https://api.internal.org', process.env.API_KEY!),
  tableNames: ['home', 'checkout'],
});

console.log('Resulting locales:', result.locales);
```

### Supported Capabilities

Providers explicitly declare capabilities so the runtime can validate requests upfront:

| Capability | Interface | Description |
| :--- | :--- | :--- |
| `readTables` | `TranslationInputProvider` | Provider can read and return raw translation rows |
| `publicRead` | `TranslationInputProvider` | Supports unauthenticated reads |
| `writeTables` | `TranslationOutputProvider` | Provider can write translated structures |
| `syncBack` | `TranslationSyncProvider` | Provider supports pushing local updates back upstream |
| `assetSync` | `AssetSyncProvider` | Provider manages remote image and file asset downloads |

---

## Next Steps

- Check out the [Migration Guide from v2 to v3](/guide/provider-migration-v3) to convert your existing project.
- Read the [Provider Runtime Guide](/guide/provider-runtime) to understand pipeline execution.
- Explore the [Provider Contracts Reference](/api/provider-contracts) for complete TypeScript interface definitions.
- Review [CryptPad Providers API](/api/cryptpad-provider) for advanced configuration options.
