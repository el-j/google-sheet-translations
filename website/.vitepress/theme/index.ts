/**
 * Custom VitePress theme
 *
 * Extends the default theme with:
 * - LangSwitcher component injected into the nav-bar end slot
 *   (appears on every page, synced with the demo spreadsheet locales)
 */
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import LangSwitcher from './components/LangSwitcher.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(LangSwitcher),
    })
  },
} satisfies Theme
