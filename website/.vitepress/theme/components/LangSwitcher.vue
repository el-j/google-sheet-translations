<script setup lang="ts">
/**
 * LangSwitcher.vue
 *
 * Global language switcher for the VitePress docs site.
 * Locale selection state, localStorage persistence, and keyboard navigation
 * are handled by the `useLocaleSwitcher` composable.
 *
 * Locale display names are pre-computed at build time by translations.data.ts
 * using the `getLocaleDisplayName()` package utility.
 */
import { data } from '../../translations.data.ts'
import { useLocaleSwitcher } from '../composables/useLocaleSwitcher'

const { selectedLocale, isOpen, select, toggle, handleOptionKeydown } =
  useLocaleSwitcher({ locales: data.locales })

function getLocaleName(locale: string): string {
  return (data.localeNames as Record<string, string>)?.[locale] ?? locale
}
</script>

<template>
  <div v-if="data.locales.length > 1" class="lang-switcher">
    <button
      class="lang-switcher__trigger"
      :aria-label="`Language: ${selectedLocale}`"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggle()"
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
        @click="select(locale)"
        @keydown="handleOptionKeydown($event, locale, index)"
      >
        {{ getLocaleName(locale) }}
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
