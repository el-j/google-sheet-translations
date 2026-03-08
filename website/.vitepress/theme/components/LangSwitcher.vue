<script setup lang="ts">
/**
 * LangSwitcher.vue
 *
 * Global language switcher for the VitePress docs site.
 * Uses translation data fetched at build time from the demo spreadsheet
 * (via translations.data.ts) to let users preview UI strings in any
 * available locale. The selected locale is persisted in localStorage.
 *
 * This component is injected into the VitePress Layout slot so it appears
 * on every page. The actual page content remains in English — only the
 * i18n keys that live in the spreadsheet are translated.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { data } from '../../translations.data.ts'

const STORAGE_KEY = 'gst-lang'

const selectedLocale = ref<string>('en')
const isOpen = ref(false)

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && data.locales.includes(saved)) {
    selectedLocale.value = saved
  } else if (data.locales.length > 0) {
    selectedLocale.value = data.locales[0]
  }
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

function selectLocale(locale: string) {
  selectedLocale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  isOpen.value = false
}

function handleOptionKeydown(e: KeyboardEvent, locale: string, index: number) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    selectLocale(locale)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = index + 1 < data.locales.length ? index + 1 : 0
    focusOption(next)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = index - 1 >= 0 ? index - 1 : data.locales.length - 1
    focusOption(prev)
  }
}

function focusOption(index: number) {
  const list = document.querySelectorAll<HTMLElement>('.lang-switcher__option')
  list[index]?.focus()
}
</script>

<template>
  <div v-if="data.locales.length > 1" class="lang-switcher">
    <button
      class="lang-switcher__trigger"
      :aria-label="`Language: ${selectedLocale}`"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
    >
      🌐 {{ selectedLocale }}
    </button>
    <ul
      v-if="isOpen"
      class="lang-switcher__dropdown"
      role="listbox"
      :aria-label="'Select language'"
    >
      <li
        v-for="(locale, index) in data.locales"
        :key="locale"
        role="option"
        :aria-selected="locale === selectedLocale"
        tabindex="0"
        class="lang-switcher__option"
        :class="{ 'lang-switcher__option--active': locale === selectedLocale }"
        @click="selectLocale(locale)"
        @keydown="handleOptionKeydown($event, locale, index)"
      >
        {{ locale }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lang-switcher {
  position: relative;
  display: inline-block;
}

.lang-switcher__trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.lang-switcher__trigger:hover {
  border-color: var(--vp-c-brand-1);
}

.lang-switcher__dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 100;
  min-width: 120px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.lang-switcher__option {
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  color: var(--vp-c-text-1);
  outline-offset: -2px;
}

.lang-switcher__option:hover,
.lang-switcher__option:focus {
  background: var(--vp-c-bg-soft);
}

.lang-switcher__option--active {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
</style>
