---
title: Live Demo
---

# Live Demo

This page is generated at **build time** by running the package against our
[demo spreadsheet](https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit).

If you can read the translation data below, the package is working end-to-end. ✅

<script setup>
import { data } from '../.vitepress/translations.data.ts'
</script>

## Fetched at

{{ data.fetchedAt ?? 'Not available (build error)' }}

## Locales found

<template v-if="data.locales.length">

| Locale | Sheets | Keys |
|--------|--------|------|
<template v-for="locale in data.locales" :key="locale">
| `{{ locale }}` | {{ data.summary[locale].map(s => s.sheet).join(', ') }} | {{ data.summary[locale].reduce((a, s) => a + s.count, 0) }} |
</template>

</template>
<template v-else>

> ⚠️ Translation data not available. Check build logs for errors.

</template>

## Static translation files

The following files are served statically from this site:

- [`/translations/languageData.json`](/google-sheet-translations/translations/languageData.json)
- [`/translations/locales.json`](/google-sheet-translations/translations/locales.json)

These are regenerated on every push to `main`.
