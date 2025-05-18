# Google Sheet Translations

A Node.js package for managing translations stored in Google Sheets.

## Installation

```bash
npm install google-sheet-translations
```

## Environment Variables

Make sure to set the following environment variables:

- `GOOGLE_CLIENT_EMAIL`: Your Google service account email
- `GOOGLE_PRIVATE_KEY`: Your Google service account private key
- `GOOGLE_SPREADSHEET_ID`: ID of the Google Spreadsheet containing translations

## Usage

```typescript
import { getSpreadSheetData, validateEnv } from 'google-sheet-translations';

// Ensure environment variables are set
validateEnv();

// Fetch translations
async function fetchTranslations() {
  try {
    const translations = await getSpreadSheetData(
      ['sheet1', 'sheet2'], // Array of sheet names to process
      {
        100, // Optional: rowLimit parameter (standard is 100 if not set)
        waitSeconds: 3, // Optional: Time to wait between API calls
        dataJsonPath: 'path/to/data.json', // Optional: Custom path for data.json
        localesOutputPath: 'path/to/locales.ts', // Optional: Custom path for locales.ts
        translationsOutputDir: 'path/to/translations', // Optional: Custom translations output directory
      }
    );

    console.log('Translations fetched successfully');
  } catch (error) {
    console.error('Error fetching translations:', error);
  }
}

fetchTranslations();
```

## API Reference

### `getSpreadSheetData(range, sheetTitles, options?)`

Fetches and processes data from a Google Spreadsheet.

#### Parameters

- `range`: String (not used but kept for API compatibility)
- `sheetTitles`: Array of sheet titles to process
- `options`: (Optional) Configuration object
  - `waitSeconds`: Time to wait between API calls (default: 5)
  - `dataJsonPath`: Path for data.json file (default: 'src/lib/data.json')
  - `localesOutputPath`: Path for locales.ts file (default: 'src/i18n/locales.ts')
  - `translationsOutputDir`: Directory for translations output (default: 'translations')

#### Returns

A Promise resolving to the processed translation data object.

### `validateEnv()`

Validates that all required environment variables are set.

#### Returns

An object containing the validated environment variables.

#### Throws

Error if any required environment variable is missing.

## License

MIT
