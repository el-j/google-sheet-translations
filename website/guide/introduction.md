# What is @el-j/google-sheet-translations?

`@el-j/google-sheet-translations` is a **TypeScript Node.js package** that treats Google Sheets as a live translation backend.

Instead of keeping translation JSON files in your repository and asking translators to open pull requests, you keep them in a Google Spreadsheet where translators are already comfortable — and you run this package during build time (or on demand) to pull the latest strings into your app.

## Core idea

```
Google Spreadsheet  ──pull──►  JSON files  ──used by──►  Your app
Your app  ──push──►  Google Spreadsheet  ──translate──►  Translators
```

The package handles the entire roundtrip:

1. **Pull** — fetch all sheets you specify and write per-locale JSON translation files plus a typed `locales.ts`.
2. **Push** — detect new keys added locally (via `languageData.json`) and write them back to the spreadsheet.
3. **Auto-translate** — optionally inject `=GOOGLETRANSLATE(…)` formulas for every missing cell.

## When to use this package

- Your team uses Google Sheets for translation management (translators, content editors, etc.)
- You build with Next.js, Nuxt, Remix, or any Node.js framework that reads JSON translation files
- You want machine-translation drafts so translators are never starting from zero
- You want a type-safe, tested, ESLint-clean solution — not a script you copy-paste

## When NOT to use this package

- You need real-time i18n without a build step → consider a PaaS like Crowdin or Lokalise
- Your spreadsheet has thousands of rows and you need incremental syncing
