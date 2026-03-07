# API Overview

`@el-j/google-sheet-translations` exports a small, focused public API.

## Main function

| Export | Description |
|--------|-------------|
| [`getSpreadSheetData`](/api/get-spreadsheet-data) | Fetch translations from Google Sheets, write output files, and optionally sync local changes back |

## Utilities

| Export | Description |
|--------|-------------|
| [`validateEnv`](/api/validate-env) | Validate that all required env vars are present |
| [`isValidLocale`](/api/locale-utilities#isvalidlocale) | Check if a string is a valid locale identifier |
| [`filterValidLocales`](/api/locale-utilities#filtervalidlocales) | Filter a header row to only valid locale columns |

## Types

| Export | Description |
|--------|-------------|
| [`SpreadsheetOptions`](/api/types#spreadsheetoptions) | Options for `getSpreadSheetData` |
| [`TranslationData`](/api/types#translationdata) | The return type of `getSpreadSheetData` |
| [`TranslationValue`](/api/types#translationvalue) | A single translation value |
| [`SheetRow`](/api/types#sheetrow) | A raw row from a Google Sheet |
| [`GoogleEnvVars`](/api/types#googleenvvars) | The validated env vars object |

## Installation

```bash
npm install @el-j/google-sheet-translations
```

## Import styles

```typescript
// Default import (main function only)
import getSpreadSheetData from '@el-j/google-sheet-translations';

// Named imports
import { getSpreadSheetData, validateEnv, isValidLocale } from '@el-j/google-sheet-translations';

// Type-only imports (zero runtime cost)
import type { SpreadsheetOptions, TranslationData } from '@el-j/google-sheet-translations';
```
