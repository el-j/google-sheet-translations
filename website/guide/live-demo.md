---
title: Live Demo
---

# Live Demo

This page is generated at **build time** by running the package against our
[demo spreadsheet](https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit).
Translation keys from this documentation's own landing page are synced to the
spreadsheet and auto-translated via `GOOGLETRANSLATE` formulas — demonstrating
the package working end-to-end on its own docs. ✅

<script setup>
import { ref, computed } from 'vue'
import { data } from '../.vitepress/translations.data.ts'

const selectedLocale = ref(data.locales[0] ?? 'en')

const t = computed(() => {
  const loc = selectedLocale.value
  if (!data.translations?.[loc]) return {}
  return {
    ...data.translations[loc].landingPage,
    ...data.translations[loc].i18n,
  }
})
</script>

## Fetched at build time

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

## Language switcher

<template v-if="data.locales.length">

Click a locale to preview the landing-page content translated by the spreadsheet:

<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:1rem 0">
  <button
    v-for="locale in data.locales"
    :key="locale"
    @click="selectedLocale = locale"
    :style="{
      padding:'4px 14px',
      borderRadius:'6px',
      border:'1px solid var(--vp-c-divider)',
      background: selectedLocale === locale ? 'var(--vp-c-brand-1)' : 'transparent',
      color: selectedLocale === locale ? '#fff' : 'inherit',
      cursor:'pointer',
      fontWeight: selectedLocale === locale ? '600' : '400'
    }"
  >{{ locale }}</button>
</div>

### Hero — `{{ selectedLocale }}`

<div v-if="t.hero_title" style="padding:1.5rem;background:var(--vp-c-bg-soft);border-radius:8px;margin:1rem 0">
  <p style="margin:0 0 0.25rem;font-size:1.4rem;font-weight:700">{{ t.hero_title }}</p>
  <p style="margin:0 0 0.5rem;font-size:1.1rem;font-weight:600;color:var(--vp-c-text-1)">{{ t.hero_text }}</p>
  <p style="margin:0;color:var(--vp-c-text-2)">{{ t.hero_tagline }}</p>
  <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap">
    <span style="padding:6px 16px;background:var(--vp-c-brand-1);color:#fff;border-radius:4px;font-size:0.9rem">{{ t.hero_cta_start }}</span>
    <span style="padding:6px 16px;border:1px solid var(--vp-c-divider);border-radius:4px;font-size:0.9rem">{{ t.hero_cta_api }}</span>
    <span style="padding:6px 16px;border:1px solid var(--vp-c-divider);border-radius:4px;font-size:0.9rem">{{ t.hero_cta_github }}</span>
  </div>
</div>
<div v-else>

> ⚠️ No translation data for locale `{{ selectedLocale }}`.

</div>

### Features — `{{ selectedLocale }}`

<div v-if="t.feature1_title" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;margin-top:1rem">
  <div v-for="i in 7" :key="i" style="padding:1rem;background:var(--vp-c-bg-soft);border-radius:6px">
    <strong>{{ t[`feature${i}_title`] }}</strong>
    <p style="margin:0.4rem 0 0;font-size:0.875rem;color:var(--vp-c-text-2);line-height:1.5">{{ t[`feature${i}_detail`] }}</p>
  </div>
</div>

</template>

## Static translation files

The following files are served statically from this site:

- [`/translations/languageData.json`](/google-sheet-translations/translations/languageData.json)
- [`/translations/locales.json`](/google-sheet-translations/translations/locales.json)

These are regenerated on every push to `main`.

