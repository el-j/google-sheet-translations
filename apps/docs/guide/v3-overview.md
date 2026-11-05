# What's New in v3: Universal Provider Platform

Version 3.0 represents a major evolutionary leap for `@el-j/google-sheet-translations`. What began as a dedicated Google Sheets synchronization script has evolved into a **universal, provider-first localization platform**.

While first-class support for Google Sheets remains fully maintained and enhanced, v3 completely decouples data sources, storage targets, and synchronization engines. This unlocks sovereign, privacy-first alternatives like **CryptPad**, local file workflows, and custom enterprise backends.

---

## The Paradigm Shift

In v2, the library was tightly coupled to Google's APIs. Every configuration option assumed Google Service Accounts, Google Drive IDs, and Google Sheets structures:

```
[v2 Architecture]
Google Sheets API ──(monolithic client)──► Local JSON Files
```

In v3, the architecture is broken down into clean, composable **providers**:

```
[v3 Architecture]
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Input Providers                               │
│  Google Sheets │ CryptPad Sheet (E2EE) │ CryptPad CSV │ Local │ Custom │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
               ▼                           ▼
        ┌─────────────────────────────────────────────────────────┐
        │               Universal Translation Core                │
        │          (Parsing, Validation, Interpolation)           │
        └──────┬───────────────────────────┬──────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────┐          ┌───────────────────────────┐
│       Output Providers       │          │       Sync Providers      │
│  JSON Files │ CryptPad Work. │          │ Google Sheets │ CryptPad  │
└──────────────────────────────┘          └───────────────────────────┘
```

---

## Why Version 3?

### 1. Beyond Google: Privacy-First & Sovereign Sources
Many organizations, open-source communities, and privacy-conscious teams cannot store translation copies or project strings on Google Cloud due to data sovereignty, GDPR constraints, or organizational policies.

v3 introduces built-in support for **CryptPad**, the open-source, end-to-end encrypted collaboration suite:
- **`cryptpad-sheet`**: Ingest directly from password-protected (`.../p/`) or public CryptPad OnlyOffice spreadsheets using native Netflux WebSockets and TweetNaCl decryption in pure Node.js. No browser automation, bots, or Playwright overhead needed!
- **`CryptPadClient`**: A standalone, headless TypeScript API client for CryptPad, bringing an open-source SDK to interact with encrypted CryptPad documents directly in backends and CI.
- **`cryptpad-csv`**: Ingest translations from publicly exported or team-shared CryptPad CSV files with zero authentication required.
- **`cryptpad-workspace`**: Maintain bidirectional sync with local snapshot files and automated 3-way conflict resolution.
- **`cryptpad-assets`**: Download and sync remote media, icons, and localized screenshots directly without Google Drive.

### 2. Plug Any Data Source in TypeScript
Have translations in Airtable, Notion, local YAML/CSV files, or an internal database? With v3's provider contracts, you can implement a custom provider in less than 50 lines of TypeScript:
- Implement `TranslationInputProvider`, `TranslationOutputProvider`, or `TranslationSyncProvider`.
- Explicit capabilities prevent unsupported operations before any network request or disk write occurs.

### 3. Automated, Frictionless Migration from v2
You don't need to rewrite your application or CI workflows manually. v3 includes:
- **`gst-migrate-v3` CLI**: Automatically inspects your existing v2 setup, checks parity, outputs a validated `provider.config.json`, and rewrites GitHub Action workflow files.
- **`mapLegacyGoogleOptionsToProviderConfig`**: Programmatically translates legacy v2 options to v3 provider configuration at runtime with deprecation warnings.
- **Full backwards compatibility**: Existing v2 methods remain functional during the v3 transition window.

---

## v2 vs v3 Comparison Matrix

| Feature | v2 (Legacy) | v3 (Current) |
| :--- | :--- | :--- |
| **Supported Data Sources** | Google Sheets only | Google Sheets, CryptPad, Local CSV/JSON, Custom Providers |
| **E2EE / Password Protected** | Not supported | Supported natively via CryptPad (`cryptpad-sheet`) |
| **Architecture** | Monolithic option bag | Composable Input, Output, Sync, and AssetSync providers |
| **Privacy / No Google Cloud** | Not supported | Supported via CryptPad (E2EE / open-source) |
| **Asset & Image Sync** | Google Drive only | Google Drive + CryptPad manifest + Custom asset providers |
| **Configuration** | Flat options object | Strongly-typed provider configuration schema |
| **Conflict Resolution** | Basic overwrite | Configurable 3-way policies (`remote-wins`, `local-wins`, `fail-on-conflict`) |
| **CLI Tooling** | Run scripts only | `gst-run-provider`, `gst-migrate-v3`, parity checkers |
| **Extensibility** | Forking required | Implement standard TypeScript interfaces |

---

## Where to Go Next

- **[Migrating from v2 to v3](/guide/provider-migration-v3)**: Step-by-step migration guide with automated CLI commands and code snippets.
- **[Non-Google Providers: CryptPad & Custom](/guide/non-google-providers)**: Learn how to set up CryptPad as your primary data source and build custom providers.
- **[Provider Runtime Architecture](/guide/provider-runtime)**: Understand provider lifecycle, capability checks, and execution pipelines.
- **[Full Sync Operations & Conflict Policies](/guide/full-sync-operations-v3)**: Dive into bidirectional synchronization and asset management.
- **[Provider Contracts API](/api/provider-contracts)**: Full TypeScript types and interface specifications.
