/**
 * Custom VitePress theme
 *
 * Extends the default theme with:
 * - LangSwitcher component injected into the nav-bar end slot
 *   (appears on every page, synced with the demo spreadsheet locales)
 */
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import LayoutWrapper from './components/LayoutWrapper.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: LayoutWrapper,
} satisfies Theme
