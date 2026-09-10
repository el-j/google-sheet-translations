import type { TranslationData } from '../types';

/**
 * Counts total leaf translation keys across all locales and sheets.
 * Shared by every sync-capable provider so "how many keys changed" is
 * reported the same way regardless of provider.
 */
export function countTranslationLeafKeys(data: TranslationData): number {
  return Object.values(data)
    .flatMap((localeData) => Object.values(localeData))
    .reduce((total, sheetData) => total + Object.keys(sheetData).length, 0);
}

/**
 * Returns true if `data` contains at least one locale with at least one sheet
 * containing at least one key — i.e. there is something to act on.
 */
export function hasAnyTranslationChanges(data: TranslationData): boolean {
  return Object.keys(data).length > 0 && Object.values(data).some((l) => Object.keys(l).length > 0);
}
