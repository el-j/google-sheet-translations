<script setup lang="ts">
/**
 * LayoutWrapper.vue
 *
 * Wraps DefaultTheme.Layout with reactive translation synchronization.
 * When the user chooses a locale from the navbar LangSwitcher:
 * 1. The document language attribute is updated (document.documentElement.lang).
 * 2. On the home page, the hero title, subtitle, tagline, CTA buttons, feature cards,
 *    and section headings are dynamically translated in-place using live translation
 *    data fetched from the demo spreadsheet.
 * 3. Selecting English (en-us) restores the original texts cleanly.
 * 4. Navigating across pages preserves the selected locale and re-applies translations.
 */
import DefaultTheme from 'vitepress/theme'
import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useData } from 'vitepress'
import LangSwitcher from './LangSwitcher.vue'
import PreviewBanner from './PreviewBanner.vue'
import { useLocaleSwitcher } from '../composables/useLocaleSwitcher'
import { data } from '../../translations.data.ts'

const { Layout } = DefaultTheme
const { frontmatter, page } = useData()
const { selectedLocale } = useLocaleSwitcher({ locales: data.locales })

// Default baseline English texts matching index.md so restoration is always pure and deterministic
interface HeroCache {
  name: string
  text: string
  tagline: string
  actions: string[]
}

interface FeatureCache {
  title: string
  details: string
}

const defaultEnglishHero: HeroCache = {
  name: 'google-sheet-translations',
  text: 'Provider-first Translation\nOperations',
  tagline:
    'Build reliable localization pipelines with explicit input, output, and sync providers. Use Google Sheets for full sync workflows and CryptPad CSV for privacy-first, zero-auth ingestion.',
  actions: [
    "What's New in v3 →",
    'Migrate from v2',
    'CryptPad & Providers',
    'GitHub Action',
    'v2 Archive',
  ],
}

const defaultEnglishFeatures: FeatureCache[] = [
  {
    title: 'Universal Provider Architecture (v3)',
    details:
      'Select input, output, and sync providers explicitly. Capability checks prevent unsupported operations before they can run.',
  },
  {
    title: 'Seamless v2 to v3 Migration',
    details:
      'Move from legacy action inputs to provider config using the gst-migrate-v3 CLI, with dry-run mode, parity checking, and workflow rewrites.',
  },
  {
    title: 'Privacy-First with CryptPad (v3)',
    details:
      'Pull translation tables from CryptPad CSV exports with zero authentication, sync with 3-way conflict policies, and download remote media assets.',
  },
  {
    title: 'Google Sheets Full Workflow',
    details:
      'Read, transform, write, and sync translation data with mature Google provider adapters and locale-aware processing.',
  },
  {
    title: 'Extensible Custom Providers',
    details:
      'Implement simple TypeScript contracts for custom backends (Airtable, Notion, CSV, local DB) without vendor lock-in.',
  },
  {
    title: 'GitHub Action Automation',
    details:
      'Run translation sync in CI with either legacy action inputs or provider config mode for v3 pipelines.',
  },
  {
    title: 'Drive Folder Discovery and Assets',
    details:
      'Discover multiple spreadsheets from Drive folders, merge output, and optionally sync remote image assets to your project.',
  },
  {
    title: 'Public Read Mode (No Auth)',
    details:
      'Ingest from public Google Sheets or CryptPad without service-account credentials for lightweight read-only workflows.',
  },
  {
    title: 'Type-safe Core and Stable Outputs',
    details:
      'Strict TypeScript, deterministic row transformation, and tested provider contracts keep output predictable across environments.',
  },
]

let originalHero: HeroCache = { ...defaultEnglishHero }
let originalFeatures: FeatureCache[] = [...defaultEnglishFeatures]
const originalHeadings: Map<Element, string> = new Map()

function cacheOriginals() {
  if (typeof document === 'undefined') return

  const nameEl =
    document.querySelector('.VPHero .name .clip') ||
    document.querySelector('.VPHero .name')
  const textEl = document.querySelector('.VPHero .text')
  const taglineEl = document.querySelector('.VPHero .tagline')
  const actionEls = document.querySelectorAll('.VPHero .actions .VPButton')
  const featureEls = document.querySelectorAll('.VPFeatures .VPFeature')

  // Only capture if currently in English
  const isEn =
    !selectedLocale.value ||
    selectedLocale.value === 'en-us' ||
    selectedLocale.value === 'en'
  if (!isEn) return

  if (nameEl && nameEl.textContent?.trim()) {
    originalHero = {
      name: nameEl.textContent.trim(),
      text: textEl?.textContent?.trim() || defaultEnglishHero.text,
      tagline: taglineEl?.textContent?.trim() || defaultEnglishHero.tagline,
      actions:
        actionEls.length > 0
          ? Array.from(actionEls).map((el) => el.textContent?.trim() || '')
          : defaultEnglishHero.actions,
    }
  }

  if (featureEls.length > 0) {
    originalFeatures = Array.from(featureEls).map((el, idx) => ({
      title:
        el.querySelector('h2.title')?.textContent?.trim() ||
        defaultEnglishFeatures[idx]?.title ||
        '',
      details:
        el.querySelector('p.details')?.textContent?.trim() ||
        defaultEnglishFeatures[idx]?.details ||
        '',
    }))
  }
}

function applyDomTranslations(locale: string) {
  if (typeof document === 'undefined') return

  document.documentElement.lang = locale

  const isHome =
    page.value.relativePath === 'index.md' ||
    frontmatter.value?.layout === 'home' ||
    window.location.pathname.replace(/\/$/, '') ===
      window.location.pathname.replace(/\/google-sheet-translations\/?$/, '/google-sheet-translations')
  if (!isHome) return

  const nameEl =
    document.querySelector('.VPHero .name .clip') ||
    document.querySelector('.VPHero .name')
  const textEl = document.querySelector('.VPHero .text')
  const taglineEl = document.querySelector('.VPHero .tagline')
  const actionEls = document.querySelectorAll('.VPHero .actions .VPButton')
  const featureEls = document.querySelectorAll('.VPFeatures .VPFeature')
  const h2Elements = document.querySelectorAll('h2')

  const translations = data.translations?.[locale]
  const lp = translations?.landingPage as Record<string, string> | undefined
  const isEnglish = !lp || locale === 'en-us' || locale === 'en'

  // 1. Hero Title
  if (nameEl) {
    nameEl.textContent = isEnglish
      ? originalHero.name
      : lp?.hero_title || originalHero.name
  }

  // 2. Hero Text / Subtitle
  if (textEl) {
    textEl.textContent = isEnglish
      ? originalHero.text
      : lp?.hero_text || originalHero.text
  }

  // 3. Hero Tagline
  if (taglineEl) {
    taglineEl.textContent = isEnglish
      ? originalHero.tagline
      : lp?.hero_tagline || originalHero.tagline
  }

  // 4. Hero CTA Actions
  if (actionEls.length > 0) {
    actionEls.forEach((el, idx) => {
      const orig = originalHero.actions[idx] || el.textContent || ''
      if (isEnglish) {
        el.textContent = orig
      } else if (idx === 0 && lp?.hero_cta_start) {
        el.textContent = `${lp.hero_cta_start} →`
      } else if (idx === 1 && lp?.hero_cta_api) {
        el.textContent = lp.hero_cta_api
      } else if (idx === 2 && lp?.hero_cta_github) {
        el.textContent = lp.hero_cta_github
      }
    })
  }

  // 5. Features
  if (featureEls.length > 0) {
    featureEls.forEach((el, idx) => {
      const titleEl = el.querySelector('h2.title')
      const detailsEl = el.querySelector('p.details')
      const orig = originalFeatures[idx]

      if (titleEl) {
        const transTitle = lp?.[`feature${idx + 1}_title`]
        titleEl.textContent = isEnglish
          ? orig?.title || titleEl.textContent
          : transTitle || orig?.title || titleEl.textContent
      }

      if (detailsEl) {
        const transDetail = lp?.[`feature${idx + 1}_detail`]
        detailsEl.textContent = isEnglish
          ? orig?.details || detailsEl.textContent
          : transDetail || orig?.details || detailsEl.textContent
      }
    })
  }

  // 6. Section Headings
  h2Elements.forEach((h2) => {
    if (!originalHeadings.has(h2)) {
      originalHeadings.set(h2, h2.textContent?.trim() || '')
    }
    const orig = originalHeadings.get(h2) || ''
    if (isEnglish) {
      h2.textContent = orig
    } else if (orig.includes('Installation') && lp?.install_title) {
      h2.textContent = lp.install_title
    } else if (orig.includes('Quick start') && lp?.quickstart_title) {
      h2.textContent = `${lp.quickstart_title} — single spreadsheet`
    }
  })
}

function scheduleApply() {
  if (typeof window === 'undefined') return
  cacheOriginals()
  applyDomTranslations(selectedLocale.value)
  nextTick(() => {
    applyDomTranslations(selectedLocale.value)
    requestAnimationFrame(() => {
      applyDomTranslations(selectedLocale.value)
    })
    setTimeout(() => {
      applyDomTranslations(selectedLocale.value)
    }, 40)
  })
}

function onLocaleEvent(e: Event) {
  const customEvent = e as CustomEvent<string>
  const targetLocale = customEvent.detail || selectedLocale.value
  applyDomTranslations(targetLocale)
  scheduleApply()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('gst-locale-changed', onLocaleEvent)
  }
  scheduleApply()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('gst-locale-changed', onLocaleEvent)
  }
})

watch(
  () => selectedLocale.value,
  () => {
    scheduleApply()
  }
)

// Re-apply when navigating between pages
watch(
  () => page.value.relativePath,
  () => {
    scheduleApply()
  }
)
</script>

<template>
  <Layout>
    <template #layout-top>
      <PreviewBanner />
    </template>
    <template #nav-bar-content-after>
      <LangSwitcher />
    </template>
  </Layout>
</template>
