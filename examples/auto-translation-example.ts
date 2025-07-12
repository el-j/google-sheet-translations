/**
 * Example demonstrating how to use the auto-translation feature
 * 
 * This example shows how to:
 * 1. Set up the Google Sheet Translations package with auto-translation enabled
 * 2. Demonstrate the workflow of adding new translations and having them auto-translated
 * 3. Customize the behavior with various options
 */

import { getSpreadSheetData, validateEnv } from '../src';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Output directories and files
const translationsDir = path.join(__dirname, 'translations');
const dataJsonPath = path.join(__dirname, 'languageData.json');
const localesOutputPath = path.join(__dirname, 'locales.ts');

// Sheet titles to process (update these to match your actual sheets)
const sheetTitles = ['Index'];

async function autoTranslationExample() {
  try {
    // Validate environment variables
    validateEnv();
    console.log('Environment variables validated successfully');
    
    // Step 1: Fetch initial translations
    console.log('\nStep 1: Fetching initial translations...');
    await getSpreadSheetData(sheetTitles, {
      translationsOutputDir: translationsDir,
      dataJsonPath,
      localesOutputPath
    });
    console.log('Initial translations fetched and saved to local files');
    
    // Step 2: Simulate adding new translations locally
    console.log('\nStep 2: Adding new translation keys locally...');
    await simulateAddingNewTranslations();
    
    // Step 3: Push changes back to the spreadsheet with auto-translation
    console.log('\nStep 3: Pushing changes back with auto-translation enabled...');
    const translations = await getSpreadSheetData(sheetTitles, {
      translationsOutputDir: translationsDir,
      dataJsonPath,
      localesOutputPath,
      autoTranslate: true  // Enable auto-translation feature
    });
    
    console.log('Changes pushed to spreadsheet with auto-translations!');
    console.log(`Processed ${Object.keys(translations).length} translation keys`);
    
    console.log('\nWhat happened with auto-translation enabled:');
    console.log('1. New keys found locally were added to the spreadsheet');
    console.log('2. For each new key with a translation in at least one language:');
    console.log('   - Google Translate formulas were added for all missing languages');
    console.log('   - Formula format: =GOOGLETRANSLATE(sourceCell; "sourceLocale"; "targetLocale")');
    console.log('3. These auto-translations serve as a starting point for translators');
    console.log('   who can review and refine them in the spreadsheet');
    
  } catch (error) {
    console.error('Error in auto-translation example:', error);
  }
}

/**
 * Helper function to simulate adding new translations to the local files
 * This would typically be done by developers during development
 */
async function simulateAddingNewTranslations() {
  // Read the existing languageData.json if it exists
  let data = {};
  try {
    if (fs.existsSync(dataJsonPath)) {
      const content = fs.readFileSync(dataJsonPath, 'utf8');
      data = JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading languageData.json:', error);
    data = {};
  }
  
  // Add new translation keys (simulating development work)
  data.welcome_message = {
    'en-us': 'Welcome to our application!',
    // Note: No translations for other languages, will be auto-translated
  };
  
  data.new_feature = {
    'en-us': 'Check out our new feature',
    'es': 'Mira nuestra nueva función',
    // Note: Partial translations, missing languages will be auto-translated
  };
  
  // Write back to languageData.json
  fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('New translation keys added to local languageData.json file');
}

// Run the example
autoTranslationExample();
