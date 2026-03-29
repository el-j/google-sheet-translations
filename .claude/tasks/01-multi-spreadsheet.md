## Goal
Add `getMultipleSpreadSheetsData()` — a function that fetches translations from multiple spreadsheet IDs and merges the results into a single `TranslationData` object.

## Context
- **Repo**: `/home/runner/work/google-sheet-translations/google-sheet-translations`
- **Core function to reuse**: `src/getSpreadSheetData.ts` → `getSpreadSheetData(docTitle, options)`
- **Types**: `src/types.ts` → `TranslationData = { [locale]: { [sheet]: { [key]: value } } }`
- **Config**: `src/utils/configurationHandler.ts` → `SpreadsheetOptions`
- **Index exports**: `src/index.ts`
- **Tests pattern**: `tests/utils/*.test.ts` → use `jest` + `ts-jest`
- **Build**: `npm run build` → tsc + esbuild (cjs + esm), must output to `dist/`
- **Test**: `npm test`
- **Constraint**: Do NOT modify existing function signatures or break existing tests

## Steps

### 1. Create `src/utils/multiSpreadsheetMerger.ts`

Create a utility that merges multiple `TranslationData` objects:
```typescript
/**
 * Merges multiple TranslationData results (from different spreadsheets) into one.
 * Sheets/keys from later spreadsheets override earlier ones if collisions occur.
 */
export function mergeMultipleTranslationData(results: TranslationData[]): TranslationData
```
- Deep-merges: locale → sheet → key; later values win on key collision
- Handles empty input gracefully (returns `{}`)

### 2. Create `src/getMultipleSpreadSheetsData.ts`

```typescript
export interface MultiSpreadsheetOptions extends SpreadsheetOptions {
  /** Array of spreadsheet IDs to fetch from. Overrides spreadsheetId if provided. */
  spreadsheetIds?: string[];
  /**
   * How to merge same-locale same-sheet keys from different spreadsheets.
   * 'later-wins': keys from later spreadsheets override earlier (default)
   * 'first-wins': keep first occurrence of each key
   */
  mergeStrategy?: 'later-wins' | 'first-wins';
}

/**
 * Fetches translations from multiple Google Spreadsheets and merges them.
 * When spreadsheetIds is not provided, falls back to options.spreadsheetId
 * or GOOGLE_SPREADSHEET_ID env var (same as getSpreadSheetData).
 */
export async function getMultipleSpreadSheetsData(
  docTitles?: string[],
  options: MultiSpreadsheetOptions = {}
): Promise<TranslationData>
```

Implementation:
- If `options.spreadsheetIds` is an array, iterate each ID, call `getSpreadSheetData(docTitles, { ...options, spreadsheetId: id })` for each one serially (to avoid rate limiting)
- If `spreadsheetIds` is empty / not set, fall back to calling `getSpreadSheetData(docTitles, options)` once (backward-compatible)
- Apply merge strategy (`mergeStrategy = 'later-wins'` by default)
- Log progress: `console.log(`[getMultipleSpreadSheetsData] Fetching ${n} spreadsheets...`)`
- Log each: `console.log(`[getMultipleSpreadSheetsData] (1/3) "${id}"...`)`

### 3. Create `tests/getMultipleSpreadSheetsData.test.ts`

Write comprehensive unit tests that mock `getSpreadSheetData`:
```typescript
jest.mock('../src/getSpreadSheetData', () => ({ getSpreadSheetData: jest.fn() }));
```

Tests to cover:
- Merges two spreadsheets with different locales
- Merges two spreadsheets with same locale → deep-merges sheets/keys
- `mergeStrategy: 'first-wins'` keeps first occurrence
- `mergeStrategy: 'later-wins'` overrides with last value  
- Falls back to single-spreadsheet path when no `spreadsheetIds` provided
- Empty `spreadsheetIds: []` returns empty `{}`
- Handles single-item `spreadsheetIds` array
- Passes per-spreadsheet options correctly (each call gets `spreadsheetId: id`)

### 4. Update `src/index.ts`

Add exports:
```typescript
export { getMultipleSpreadSheetsData } from './getMultipleSpreadSheetsData'
export type { MultiSpreadsheetOptions } from './getMultipleSpreadSheetsData'
export { mergeMultipleTranslationData } from './utils/multiSpreadsheetMerger'
```

### 5. Verify
```bash
cd /home/runner/work/google-sheet-translations/google-sheet-translations
npm run build && npx jest tests/getMultipleSpreadSheetsData.test.ts --no-coverage
```

## Acceptance criteria
- [ ] `getMultipleSpreadSheetsData` is exported from `dist/cjs/index.js` and `dist/esm/index.js`
- [ ] `MultiSpreadsheetOptions` type is exported
- [ ] `mergeMultipleTranslationData` is exported
- [ ] 8+ test cases in new test file, all passing
- [ ] `npm run build` → 0 TypeScript errors
- [ ] No existing tests broken
