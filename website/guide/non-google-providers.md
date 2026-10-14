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

[CryptPad](https://cryptpad.org) is an open-source, end-to-end encrypted collaboration suite. In v3, `@el-j/google-sheet-translations` offers native, zero-browser tooling and a complete suite of CryptPad providers:

```
                            ┌────────────────────────┐
                            │   CryptPad Instance    │
                            │ (Zero-Knowledge E2EE)  │
                            └───────────┬────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  cryptpad-sheet  │          │cryptpad-workspace│          │ cryptpad-assets  │
│ (Native E2EE API)│          │ (Output & Sync)  │          │  (Asset Sync)    │
│ • Netflux WS     │          │ • 3-Way Diff     │          │ • Remote Images  │
│ • Passwords (/p/)│          │ • Snapshots      │          │ • Manifest Sync  │
│ • OnlyOffice OOXML          │ • Conflict Policy│          │ • Content Hashes │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

### 1. Native E2EE Sheets: `cryptpad-sheet` & `CryptPadClient`

Unlike traditional cloud APIs, CryptPad stores **zero plaintext data** on the server. `@el-j/google-sheet-translations` brings native client-side cryptographic tooling directly to Node.js / CI without requiring a browser or bot!

It performs:
1. **Client-Side Key Derivation**: Uses SHA-512 dual hashing to derive symmetric XSalsa20-Poly1305 encryption keys and Netflux channel identifiers, supporting **password-protected** pads (`.../p/`).
2. **Netflux Protocol Streaming**: Connects directly via WebSocket (`wss://{host}/cryptpad_websocket`) to the instance, joins the channel, and requests document history from the `historyKeeper` daemon.
3. **Decryption & Change Processing**: Decrypts incremental OnlyOffice patches in memory via TweetNaCl, reconstructing the spreadsheet cell grid (`A1`, `B1`, `C1`, ...) into canonical translation rows.

#### Configuration in `provider.config.json`

```json
{
  "input": {
    "provider": "cryptpad-sheet",
    "options": {
      "url": "https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/",
      "password": "my-sheet-password",
      "tableName": "common"
    }
  }
}
```

Or via environment variables in CI:

```bash
CRYPTPAD_URL="https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/"
CRYPTPAD_PASSWORD="my-sheet-password"
```

#### Standalone `CryptPadClient` Programmatic Usage

You can also use the underlying `CryptPadClient` directly in any backend or automation script (just like the Google API client, but for CryptPad!):

```typescript
import { CryptPadClient } from '@el-j/google-sheet-translations';

const client = new CryptPadClient({
  url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
  password: 'my-sheet-password',
});

// Fetch raw decrypted cells and metadata
const { cells, metadata } = await client.fetchSheetData();
console.log('Decrypted cell A1:', cells['A1']);

// Or fetch structured translation rows: [ { key: '...', en: '...', de: '...' } ]
const rows = await client.fetchSheetRows();
console.log('Rows count:', rows.length);
```

---

### 2. Public CSV Ingestion: `cryptpad-csv`

For unencrypted or public spreadsheet CSV exports where password protection is not required, use `cryptpad-csv`:

#### Configuration in `provider.config.json`

```json
{
  "input": {
    "provider": "cryptpad-csv",
    "options": {
      "sources": [
        {
          "tableName": "common",
          "url": "https://cryptpad.fr/file/your-sheet-export.csv"
        }
      ]
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
  sources: [
    {
      tableName: 'common',
      url: 'https://cryptpad.example.org/export/translations.csv',
    },
  ],
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
