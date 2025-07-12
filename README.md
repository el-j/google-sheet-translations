# Google Sheet Translations

A Node.js package for managing translations stored in Google Sheets.

## Features

- ✅ **Bidirectional Sync**: Sync changes from local files back to Google Sheets
- ✅ **Auto-Translation**: Automatic Google Translate formula generation for missing translations
- ✅ **Smart Locale Filtering**: Only valid locale identifiers are included in output files
- ✅ **TypeScript Support**: Full TypeScript definitions included
- ✅ **Modular Architecture**: Well-tested, maintainable codebase with clear separation of concerns
- ✅ **Next.js Integration**: Built-in support for Next.js static export workflows
- ✅ **Flexible Configuration**: Customizable paths, wait times, and processing options

## Installation

```bash
npm install @el-j/google-sheet-translations
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
import { getSpreadSheetData, validateEnv } from '@el-j/google-sheet-translations';

// Ensure environment variables are set
validateEnv();

// Fetch translations
async function fetchTranslations() {
  try {
    const translations = await getSpreadSheetData(
      ['sheet1', 'sheet2'], // Array of sheet names to process
      {
        rowLimit: 100, // Optional: rowLimit parameter (default is 100)
        waitSeconds: 3, // Optional: Time to wait between API calls (default is 1)
        dataJsonPath: 'path/to/languageData.json', // Optional: Custom path for languageData.json
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

### Usage with NEXTJS 

for nextjs, you can use the package in your `instrumentation.ts` file. This is useful for pre-fetching translations during the build process
and storing them in a JSON file. Practically for `static:export` in `next build`

```typescript:instrumentation.ts
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const getData = await import("@el-j/google-sheet-translations");
		await getData.getSpreadSheetData(["Index"]);
		console.log("register done");
	}
}
```

read more [internationalization with nextjs](https://nextjs.org/docs/pages/building-your-application/routing/internationalization)

## API Reference

### `getSpreadSheetData(sheetTitles?, options?)`

Fetches and processes data from a Google Spreadsheet.

#### Parameters

- `sheetTitles`: (Optional) Array of sheet titles to process. If not provided, only the "i18n" sheet will be processed.
- `options`: (Optional) Configuration object
  - `rowLimit`: Number - Maximum number of rows to fetch (default: 100)
  - `waitSeconds`: Number - Time to wait between API calls (default: 1)
  - `dataJsonPath`: String - Path for languageData.json file (default: 'src/lib/languageData.json')
  - `localesOutputPath`: String - Path for locales.ts file (default: 'src/i18n/locales.ts')
  - `translationsOutputDir`: String - Directory for translations output (default: 'translations')
  - `syncLocalChanges`: Boolean - Whether to sync local changes back to the spreadsheet (default: true)
  - `autoTranslate`: Boolean - Whether to auto-generate Google Translate formulas for missing translations (default: false)

#### Returns

A Promise resolving to the processed translation data object.

### `validateEnv()`

Validates that all required environment variables are set.

#### Returns

An object containing the validated environment variables.

#### Throws

Error if any required environment variable is missing.

## Locale Filtering

The package now includes intelligent locale filtering to ensure only valid locale identifiers are included in the generated `locales.ts` file. This prevents common spreadsheet column names like 'key', 'description', 'status', etc., from being treated as locales.

### Supported Locale Formats

- Two-letter language codes: `en`, `de`, `fr`, `ja`
- Language-country codes with hyphens: `en-us`, `de-de`, `fr-ca`
- Language-country codes with underscores: `en_us`, `de_de`, `zh_cn`
- Extended locale codes: `en-us-traditional`, `zh-cn-simplified`

### Filtered Keywords

The following common spreadsheet column names are automatically filtered out:
- `key`, `keys`, `id`, `identifier`, `name`, `title`, `label`
- `description`, `comment`, `note`, `context`, `category`, `type`
- `status`, `updated`, `created`, `modified`, `version`, `source`
- `i18n`, `translation`, `namespace`, `section`

## Additional Utilities

The package exports several utility functions that can be used independently:

```typescript
import { 
  validateEnv,
  isValidLocale,
  filterValidLocales,
  normalizeConfig,
  processSheet,
  writeTranslationFiles,
  convertToDataJsonFormat,
  convertFromDataJsonFormat,
  findLocalChanges
} from '@el-j/google-sheet-translations';

// Validate locale identifiers
console.log(isValidLocale('en-us')); // true
console.log(isValidLocale('description')); // false

// Filter valid locales from header row
const validLocales = filterValidLocales(['key', 'en', 'description', 'de'], 'key');
console.log(validLocales); // ['en', 'de']

// Normalize configuration with defaults
const config = normalizeConfig({ waitSeconds: 2 });
```

## Bidirectional Sync Feature

This package supports bidirectional synchronization between local translation files and the Google Spreadsheet:

1. **Pull from Spreadsheet**: Fetches translations from Google Sheets and saves them to local JSON files.
2. **Push to Spreadsheet**: Detects changes in local files and pushes them back to the spreadsheet.

### How Bidirectional Sync Works

1. The system checks if `languageData.json` has been modified more recently than the translation output files.
2. If so, it compares the local `languageData.json` content with the data fetched from the spreadsheet.
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
