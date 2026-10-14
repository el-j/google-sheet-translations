import type { GoogleSpreadsheet } from 'google-spreadsheet';

/**
 * Converts a 0-based column index to a spreadsheet column letter (A, B, ..., Z, AA, AB, ...)
 *
 * @param index - 0-based index of the column
 * @returns Spreadsheet column letter (e.g. 0 -> 'A', 26 -> 'AA')
 */
export function columnIndexToLetter(index: number): string {
  let result = '';
  let i = index;
  do {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
}

/**
 * Determines the formula argument separator based on the spreadsheet's locale.
 *
 * Google Sheets uses `,` for English, CJK and a few other locales, but `;` for
 * the majority of European locales (German, French, Spanish, Italian, …).
 * The Google Sheets API (`valueInputOption: USER_ENTERED`) parses formulas
 * according to the spreadsheet's locale, so we must match the separator.
 *
 * @param doc - GoogleSpreadsheet document instance
 * @returns `","` or `";"` – the argument separator to use in generated formulas.
 */
export function getFormulaSeparator(doc: GoogleSpreadsheet): string {
  try {
    // google-spreadsheet stores the raw Sheets API properties after loadInfo()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locale: string = (doc as any)._rawProperties?.locale || '';
    // English, Japanese, Korean, Chinese, Thai, Indonesian, Malay use comma
    if (/^(en|ja|ko|zh|th|id|ms)/i.test(locale)) return ',';
  } catch {
    // Fall through to default
  }
  // Default: semicolon (covers German, French, Spanish, Italian, Russian,
  // Turkish, Polish, and most other locales)
  return ';';
}

/**
 * Wraps a spreadsheet cell reference in a formula that extracts the
 * GOOGLETRANSLATE-compatible language code from a locale header cell.
 *
 * For most locales the ISO 639-1 prefix before the first `"-"` is extracted
 * (e.g. header `"tr-TR"` → `"tr"`, `"en-US"` → `"en"`).
 *
 * For Chinese variants (`zh-TW`, `zh-CN`) the full lowercased code is
 * preserved because GOOGLETRANSLATE distinguishes Simplified from Traditional
 * Chinese.
 *
 * Bare codes without a `"-"` are returned as-is (e.g. `"en"` → `"en"`).
 *
 * All inner function calls use the supplied `sep` so the generated fragment
 * is consistent with the spreadsheet's locale.
 *
 * @param cellRef - A spreadsheet cell reference string, e.g. `$B$1` or `C$1`
 * @param sep     - Formula argument separator (`","` or `";"`)
 * @returns Formula fragment string for language code extraction
 */
export function langCodeFormula(cellRef: string, sep: string): string {
  // Strip the region part: LOWER(IFERROR(LEFT(ref, FIND("-",ref)-1), ref))
  const prefix = `LOWER(IFERROR(LEFT(${cellRef}${sep}FIND("-"${sep}${cellRef})-1)${sep}${cellRef}))`;
  // Keep the full lowercased value for Chinese variants
  const full = `LOWER(${cellRef})`;
  // IF the code starts with "zh-", keep the full code; otherwise extract the prefix
  return `IF(LOWER(LEFT(${cellRef}${sep}3))="zh-"${sep}${full}${sep}${prefix})`;
}

/**
 * Constructs a full `=GOOGLETRANSLATE(...)` formula for dynamic cell translation.
 *
 * @param sourceColLetter - Source column letter (e.g. 'B')
 * @param targetColLetter - Target column letter (e.g. 'C')
 * @param sep             - Argument separator (',' or ';')
 * @returns `=GOOGLETRANSLATE(INDIRECT("B"&ROW()); langCodeFormula($B$1); langCodeFormula(C$1))`
 */
export function buildGoogleTranslateFormula(
  sourceColLetter: string,
  targetColLetter: string,
  sep: string,
): string {
  return `=GOOGLETRANSLATE(INDIRECT("${sourceColLetter}"&ROW())${sep}${langCodeFormula(`$${sourceColLetter}$1`, sep)}${sep}${langCodeFormula(`${targetColLetter}$1`, sep)})`;
}
