# What is @el-j/google-sheet-translations?

`@el-j/google-sheet-translations` is a **TypeScript localization platform** that turns collaborative spreadsheets into a live translation backend for modern web applications.

Instead of manually maintaining nested JSON files in your repository and asking translators to open pull requests, translators edit strings in tools they already know (Google Sheets, CryptPad, or CSV files). During build time or CI runs, this package pulls the latest strings, parses and validates them, generates typed `locales.ts` definitions, and optionally synchronizes local changes and media assets back upstream.

---

> [!TIP] New in Version 3: Universal Provider Platform
> While Google Sheets remains a first-class citizen, **v3** introduces a modular provider architecture. You can now ingest from privacy-first, open-source services like **[CryptPad](/guide/non-google-providers)** (zero-auth CSV & workspace sync) or implement [Custom Providers](/guide/non-google-providers#building-a-custom-provider).
>
> If you are upgrading an existing project from v2, check out the **[v3 Migration Guide](/guide/provider-migration-v3)**.

---

## Core Idea

```
Spreadsheet / CryptPad  ──pull──►  JSON files  ──used by──►  Your App
Your App               ──push──►  Spreadsheet  ──translate──►  Translators
```

The package handles the entire roundtrip:

1. **Pull** — fetch all sheets/tables you specify and write per-locale JSON translation files plus a strictly typed `locales.ts`.
2. **Push / Sync** — detect new keys added locally (via `languageData.json`) and write them back with configurable conflict resolution.
3. **Auto-translate** — optionally inject machine translation formulas (`=GOOGLETRANSLATE(…)`) so translators start from drafts rather than blank cells.
4. **Asset Sync** — automatically download and version remote icons, illustrations, and images attached to translation projects.

---

## When to Use This Package

- **Collaborative Editing**: Translators, copywriters, and content editors work directly in familiar spreadsheets without needing Git access.
- **Privacy & Sovereignty**: Use [CryptPad](/guide/non-google-providers) when strings cannot be stored on US cloud infrastructure or when zero-auth ingestion is desired.
- **Framework Agnostic**: Works out of the box with Next.js, Nuxt, Remix, Vite, SvelteKit, or any Node.js application that consumes JSON translations.
- **Automation in CI/CD**: Run zero-config sync via GitHub Actions on a schedule or workflow dispatch.
- **Type Safety**: Strictly typed row parsing, locale filtering, and auto-generated TypeScript declarations prevent runtime key typos.

---

## When NOT to Use This Package

- You need real-time, in-browser translation swapping without any build step (consider SaaS platforms like Crowdin or Lokalise).
- Your translation catalog exceeds tens of thousands of dynamic keys per minute requiring streaming distributed databases.

---

## Next Steps

- **[Getting Started](/guide/getting-started)**: Quick setup guide for Google Sheets.
- **[v3 Overview](/guide/v3-overview)**: Explore the new modular provider runtime.
- **[Non-Google Providers: CryptPad](/guide/non-google-providers)**: Set up privacy-first, zero-auth translation ingestion.
- **[Migrating from v2 to v3](/guide/provider-migration-v3)**: Follow the step-by-step upgrade path.
