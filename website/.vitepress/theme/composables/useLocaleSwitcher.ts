/**
 * useLocaleSwitcher
 *
 * Vue composable that encapsulates locale selection state, localStorage
 * persistence, and keyboard navigation for a locale-switcher dropdown.
 *
 * Extracted from LangSwitcher.vue so the same behaviour can be reused in
 * other components or app-level locale contexts.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useLocaleSwitcher } from './composables/useLocaleSwitcher'
 *
 * const locales = ['en-us', 'de-de', 'fr-fr']
 * const { selectedLocale, isOpen, select, toggle, close, handleOptionKeydown } =
 *   useLocaleSwitcher({ locales })
 * </script>
 * ```
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export interface UseLocaleSwitcherOptions {
  /** All available locale codes. */
  locales: string[]
  /** localStorage key used to persist the selection (default: `'gst-lang'`). */
  storageKey?: string
  /**
   * CSS selector used to find focusable option elements for keyboard navigation.
   * Defaults to `'.lang-switcher__option'`.
   */
  optionSelector?: string
}

export interface UseLocaleSwitcherReturn {
  /** Currently selected locale code. */
  selectedLocale: ReturnType<typeof ref<string>>
  /** Whether the dropdown is open. */
  isOpen: ReturnType<typeof ref<boolean>>
  /** Select a locale, persist it, and close the dropdown. */
  select: (locale: string) => void
  /** Toggle the dropdown open/closed. */
  toggle: () => void
  /** Close the dropdown. */
  close: () => void
  /**
   * Keyboard handler for individual option elements.
   * Supports: Enter/Space to select, ArrowDown/ArrowUp to navigate,
   * Escape to close (handled globally).
   */
  handleOptionKeydown: (e: KeyboardEvent, locale: string, index: number) => void
}

export function useLocaleSwitcher({
  locales,
  storageKey = 'gst-lang',
  optionSelector = '.lang-switcher__option',
}: UseLocaleSwitcherOptions): UseLocaleSwitcherReturn {
  const selectedLocale = ref<string>(locales[0] ?? '')
  const isOpen = ref(false)

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }

  onMounted(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved && locales.includes(saved)) {
      selectedLocale.value = saved
    } else if (locales.length > 0) {
      selectedLocale.value = locales[0]
    }
    document.addEventListener('keydown', handleGlobalKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
  })

  function select(locale: string) {
    selectedLocale.value = locale
    localStorage.setItem(storageKey, locale)
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function close() {
    isOpen.value = false
  }

  function focusOption(index: number) {
    const list = document.querySelectorAll<HTMLElement>(optionSelector)
    list[index]?.focus()
  }

  function handleOptionKeydown(e: KeyboardEvent, locale: string, index: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(locale)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = index + 1 < locales.length ? index + 1 : 0
      focusOption(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = index - 1 >= 0 ? index - 1 : locales.length - 1
      focusOption(prev)
    }
  }

  return {
    selectedLocale,
    isOpen,
    select,
    toggle,
    close,
    handleOptionKeydown,
  }
}
