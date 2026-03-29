/**
 * Parses the markdown / plain-text export of a Google Doc into an array of
 * deterministic translation key-value pairs.
 *
 * Three key-derivation strategies are supported:
 *
 * - **heading** (default) – H1 headings define sheet/tab names; H2 headings
 *   define key names; the text following each H2 is the value.
 * - **marker** – Explicit `[[key:path.to.key]]` annotations in the document
 *   define key paths; all text until the next marker is the value.
 * - **numbered** – Paragraphs are numbered sequentially as `item_1`,
 *   `item_2`, etc. and all placed in a single sheet.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single parsed translation entry extracted from a Google Doc. */
export interface ParsedDocEntry {
  /** Sheet / tab name (slugified H1 heading, or the fallback sheet name) */
  sheetName: string;
  /** Translation key (slugified H2 heading, marker path segment, or ordinal) */
  key: string;
  /** Source-language text value */
  value: string;
}

/**
 * Controls how translation keys are derived from the document content.
 *
 * - `'heading'` — Structural headings define the key hierarchy.
 * - `'marker'`  — Explicit `[[key:path]]` annotations in the document body.
 * - `'numbered'` — Sequential ordinal keys (`item_1`, `item_2`, …).
 */
export type DocKeyStrategy = 'heading' | 'marker' | 'numbered';

export interface ParseDocOptions {
  /**
   * How to derive translation keys from the document content.
   * Defaults to `'heading'`.
   */
  strategy?: DocKeyStrategy;
  /**
   * Sheet name to use when no H1 heading (heading strategy) or dot prefix
   * (marker strategy) is present.
   * Defaults to `'content'`.
   */
  defaultSheetName?: string;
}

// ── Key slug utility ──────────────────────────────────────────────────────────

/**
 * Converts an arbitrary string into a valid, stable translation key:
 * lower-cases the text, replaces any run of non-word characters with a
 * single underscore, and trims leading/trailing underscores.
 *
 * @example
 * slugifyKey('Hero Section!')  // → 'hero_section'
 * slugifyKey('nav / Home')     // → 'nav_home'
 */
export function slugifyKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Parses exported Google Doc content into an array of translation entries.
 *
 * @param content          - Markdown or plain-text string exported from Drive.
 * @param options          - Parsing options (strategy, defaultSheetName).
 * @returns                Array of `{sheetName, key, value}` entries ready to
 *                         be pushed into a translation spreadsheet.
 *
 * @example
 * ```ts
 * // Heading strategy (default)
 * const entries = parseDocContent(`
 * # Hero
 * ## title
 * Welcome to our app
 * ## subtitle
 * Start your journey
 * `);
 * // → [{ sheetName: 'hero', key: 'title', value: 'Welcome to our app' },
 * //    { sheetName: 'hero', key: 'subtitle', value: 'Start your journey' }]
 * ```
 */
export function parseDocContent(
  content: string,
  options: ParseDocOptions = {},
): ParsedDocEntry[] {
  const { strategy = 'heading', defaultSheetName = 'content' } = options;

  if (strategy === 'marker') return parseWithMarkers(content, defaultSheetName);
  if (strategy === 'numbered') return parseNumbered(content, defaultSheetName);
  return parseWithHeadings(content, defaultSheetName);
}

// ── Heading strategy ──────────────────────────────────────────────────────────

/**
 * Heading strategy rules:
 * - `# Heading` → new sheet name (slugified)
 * - `## Heading` → new key within the current sheet (slugified)
 * - Lines after an `## Heading` accumulate as the value until the next heading
 * - Lines before any `##` are ignored (only structural headings matter)
 */
function parseWithHeadings(
  content: string,
  defaultSheetName: string,
): ParsedDocEntry[] {
  const lines = content.split('\n');
  const entries: ParsedDocEntry[] = [];

  let currentSheet = defaultSheetName;
  let currentKey: string | null = null;
  const valueLines: string[] = [];

  function flushEntry() {
    if (currentKey !== null) {
      const value = valueLines.join('\n').trim();
      if (value) {
        entries.push({ sheetName: currentSheet, key: currentKey, value });
      }
      currentKey = null;
      valueLines.length = 0;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('# ')) {
      flushEntry();
      currentSheet =
        slugifyKey(line.slice(2).trim()) || defaultSheetName;
      currentKey = null;
      valueLines.length = 0;
    } else if (line.startsWith('## ')) {
      flushEntry();
      currentKey = slugifyKey(line.slice(3).trim());
      valueLines.length = 0;
    } else if (currentKey !== null) {
      valueLines.push(line);
    }
  }

  flushEntry();
  return entries;
}

// ── Marker strategy ───────────────────────────────────────────────────────────

/**
 * Marker strategy rules:
 * - `[[key:sheet.keyName]]` or `[[key:keyName]]` defines the next entry.
 * - All text between this marker and the next is the value (trimmed).
 * - The key path may include one dot to specify a custom sheet name
 *   (e.g. `[[key:hero.title]]` → sheet `hero`, key `title`).
 */
function parseWithMarkers(
  content: string,
  defaultSheetName: string,
): ParsedDocEntry[] {
  const MARKER_RE = /\[\[key:([^\]]+)\]\]/g;
  const entries: ParsedDocEntry[] = [];

  // Split with capturing group: [textBefore, key1, text1, key2, text2, …]
  const segments = content.split(MARKER_RE);

  for (let i = 1; i < segments.length; i += 2) {
    const keyPath = segments[i].trim();
    const value = (segments[i + 1] ?? '').trim();
    if (!keyPath || !value) continue;

    const dotIdx = keyPath.indexOf('.');
    let sheetName: string;
    let key: string;

    if (dotIdx !== -1) {
      sheetName = slugifyKey(keyPath.slice(0, dotIdx));
      key = slugifyKey(keyPath.slice(dotIdx + 1));
    } else {
      sheetName = defaultSheetName;
      key = slugifyKey(keyPath);
    }

    if (sheetName && key) {
      entries.push({ sheetName, key, value });
    }
  }

  return entries;
}

// ── Numbered strategy ─────────────────────────────────────────────────────────

/**
 * Numbered strategy rules:
 * - Split the document into paragraphs (one or more blank lines).
 * - Markdown heading markers (`#`) are stripped from the start of each paragraph.
 * - Each non-empty paragraph becomes `item_N` in the default sheet.
 */
function parseNumbered(
  content: string,
  defaultSheetName: string,
): ParsedDocEntry[] {
  const entries: ParsedDocEntry[] = [];
  let counter = 0;

  const paragraphs = content.split(/\n{2,}/);
  for (const para of paragraphs) {
    // Strip leading markdown heading markers and whitespace
    const value = para.replace(/^[#\s]+/, '').trim();
    if (value) {
      counter++;
      entries.push({
        sheetName: defaultSheetName,
        key: `item_${counter}`,
        value,
      });
    }
  }

  return entries;
}
