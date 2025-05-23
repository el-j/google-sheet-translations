# Google Sheet Translations

A Node.js package for managing translations stored in Google Sheets.

## Installation

```bash
npm install google-sheet-translations
```

## Prepare Google Spreadsheet
1. Create Google Spreadsheet(s) with the following structure:
   - **First Row**: Header Row with Key | [language(-country)] | [language(-country)] | ... 
   - **Subsequent Rows**: Translation Rows with Key used as variable name and corresponding translations.
   
2. Auto-translation for missing translations can be managed in two ways:
   - Manually, by using the `=GOOGLETRANSLATE()` function in the spreadsheet
   - Automatically, by enabling the `autoTranslate` option when using this package (see API Reference)

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
        rowLimit: 100, // Optional: rowLimit parameter (standard is 100 if not set)
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

### Useage with NEXTJS 

for nextjs, you can use the package in your `instrumentation.ts` file. This is useful for pre-fetching translations during the build process
and storing them in a JSON file. Practically for `static:export` in `next build`

```typescript:instrumentation.ts
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const getData = await import("google-sheet-translations");
		await getData.getSpreadSheetData(["Index"]);
		console.log("register done");
	}
}
```

read more (internationalization with nextjs)[https://nextjs.org/docs/pages/building-your-application/routing/internationalization]

## API Reference

### `getSpreadSheetData(range, sheetTitles, options?)`

Fetches and processes data from a Google Spreadsheet.

#### Parameters

- `sheetTitles`: Array of sheet titles to process
- `options`: (Optional) Configuration object
  - `rowLimit`: String (not used but kept for API compatibility)
  - `waitSeconds`: Time to wait between API calls (default: 5)
  - `dataJsonPath`: Path for data.json file (default: 'src/lib/data.json')
  - `localesOutputPath`: Path for locales.ts file (default: 'src/i18n/locales.ts')
  - `translationsOutputDir`: Directory for translations output (default: 'translations')
  - `syncLocalChanges`: Whether to sync local changes back to the spreadsheet (default: true)
  - `autoTranslate`: Whether to auto-generate Google Translate formulas for missing translations (default: false)

#### Returns

A Promise resolving to the processed translation data object.

### `validateEnv()`

Validates that all required environment variables are set.

#### Returns

An object containing the validated environment variables.

#### Throws

Error if any required environment variable is missing.

## Bidirectional Sync Feature

This package supports bidirectional synchronization between local translation files and the Google Spreadsheet:

1. **Pull from Spreadsheet**: Fetches translations from Google Sheets and saves them to local JSON files.
2. **Push to Spreadsheet**: Detects changes in local files and pushes them back to the spreadsheet.

### How Bidirectional Sync Works

1. The system checks if `data.json` has been modified more recently than the translation output files.
2. If so, it compares the local `data.json` content with the data fetched from the spreadsheet.
3. Any new keys found in the local data that don't exist in the spreadsheet will be added to the spreadsheet.
4. If auto-translation is enabled, Google Translate formulas will be automatically added for missing translations when new keys are added.

This workflow allows developers to:

1. Add new translation keys in local files during development.
2. Run `getSpreadSheetData()` to push those new keys to the shared spreadsheet.
3. Run it again later to pull the completed translations once they're filled in by translators.

### Auto-Translation Feature

When enabled, the auto-translation feature automatically adds Google Translate formulas for missing translations when new keys are added to the spreadsheet. This helps translators by providing initial machine translations as a starting point.

The formula follows this format:
```
=GOOGLETRANSLATE(originalCell; "sourceLocale"; "targetLocale")
```

For example, if you add a new key with an English translation but no German translation, the system will automatically add:
```
=GOOGLETRANSLATE(B23; "en-us"; "de")
```

Where:
- `B23` references the cell containing the English text
- `"en-us"` is the source language code
- `"de"` is the target language code

[View the complete Auto-Translation Guide](docs/auto-translation-guide.md) for more details and best practices.

### Example Workflow

```typescript
// During development: add new keys to local translation files

// Then run this to sync changes back to the spreadsheet
await getSpreadSheetData(['sheet1'], {
  syncLocalChanges: true  // This is true by default
});

// Later, run again to pull completed translations
await getSpreadSheetData(['sheet1']);

// Example with auto-translation enabled
await getSpreadSheetData(['sheet1'], {
  autoTranslate: true  // Automatically generate Google Translate formulas for missing translations
});
```

For more detailed examples, check out the [examples directory](examples) where you'll find working code samples for all features including:
- Basic usage
- Bidirectional sync
- Auto-translation
- Next.js integration

## License

MIT
