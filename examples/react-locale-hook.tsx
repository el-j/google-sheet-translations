/**
 * React hook: useLocaleSwitcher
 *
 * A React equivalent of the Vue `useLocaleSwitcher` composable.
 * Encapsulates locale selection state, localStorage persistence, and
 * keyboard navigation (Escape to close) for a locale-switcher dropdown.
 *
 * Usage
 * -----
 * ```tsx
 * import { useLocaleSwitcher } from './react-locale-hook';
 *
 * // Locales come from the generated locales.ts (or from your API)
 * import { locales } from '@/i18n/locales';
 *
 * export function LocaleSwitcher() {
 *   const { selectedLocale, isOpen, select, toggle } = useLocaleSwitcher({ locales });
 *
 *   return (
 *     <div>
 *       <button onClick={toggle}>🌐 {selectedLocale}</button>
 *       {isOpen && (
 *         <ul role="listbox">
 *           {locales.map(locale => (
 *             <li
 *               key={locale}
 *               role="option"
 *               aria-selected={locale === selectedLocale}
 *               onClick={() => select(locale)}
 *             >
 *               {locale}
 *             </li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * Dependencies: react ≥ 18 (uses the `use client` directive for Next.js App Router)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseLocaleSwitcherOptions {
  /** All available locale codes, e.g. from the generated `locales.ts`. */
  locales: string[];
  /** localStorage key used to persist the selection (default: `'gst-lang'`). */
  storageKey?: string;
}

export interface UseLocaleSwitcherResult {
  /** Currently selected locale code. */
  selectedLocale: string;
  /** Whether the dropdown is open. */
  isOpen: boolean;
  /** Select a locale, persist it to localStorage, and close the dropdown. */
  select: (locale: string) => void;
  /** Toggle the dropdown open/closed. */
  toggle: () => void;
  /** Close the dropdown. */
  close: () => void;
}

export function useLocaleSwitcher({
  locales,
  storageKey = 'gst-lang',
}: UseLocaleSwitcherOptions): UseLocaleSwitcherResult {
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    // Only read localStorage in the browser (guard against SSR)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved && locales.includes(saved)) return saved;
    }
    return locales[0] ?? '';
  });

  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  const select = useCallback(
    (locale: string) => {
      setSelectedLocale(locale);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, locale);
      }
      setIsOpen(false);
    },
    [storageKey],
  );

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Close the dropdown on Escape (only when open, to avoid unnecessary state updates)
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) close();
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [close, isOpen]);

  return { selectedLocale, isOpen, select, toggle, close };
}
