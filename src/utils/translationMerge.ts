import type { TranslationData } from '../types';

/**
 * Deep-merges `additions` into a copy of `base`.
 *
 * Merge semantics (per `locale → sheet → key`):
 * - Key exists in **both** → `base` value wins (remote-authoritative for `pull`, remote snapshot
 *   for `sync`).
 * - Key exists **only in `additions`** → added to result (preserves local-only additions so they
 *   are not silently discarded when writing output files after a pull or sync).
 * - Key exists **only in `base`** → kept as-is.
 *
 * The result is always a deep clone; neither input is mutated.
 *
 * @param base       The authoritative source (e.g. what was fetched from CryptPad).
 * @param additions  Keys to add only where absent in `base` (e.g. local developer additions).
 */
export function deepMergeTranslations(
  base: TranslationData,
  additions: TranslationData,
): TranslationData {
  const result: TranslationData = JSON.parse(JSON.stringify(base));

  for (const [locale, sheets] of Object.entries(additions)) {
    if (!result[locale]) result[locale] = {};

    for (const [sheet, keys] of Object.entries(sheets)) {
      if (!result[locale][sheet]) result[locale][sheet] = {};

      for (const [key, value] of Object.entries(keys)) {
        // Only add if the key is genuinely absent — undefined, not just falsy.
        if (result[locale][sheet][key] === undefined) {
          result[locale][sheet][key] = value;
        }
      }
    }
  }

  return result;
}
