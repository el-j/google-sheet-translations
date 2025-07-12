
import { getSpreadSheetData, validateEnv } from '../src';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  try {
    // Validate environment variables
    validateEnv();
    
    console.log('Environment variables validated successfully');
    
    // Define sheet titles to process
    const sheetTitles = ['Sheet1', 'Sheet2'];
    
    // Fetch translations with custom options
    const translations = await getSpreadSheetData(
      sheetTitles, 
      {
        rowLimit: 100,
        waitSeconds: 2,
        dataJsonPath: './languageData.json',
        localesOutputPath: './locales.ts',
        translationsOutputDir: './translations'
      }
    );
    
    console.log('Translations fetched successfully');
    console.log(`Found ${Object.keys(translations).length} locales`);
    
    // Print locales
    for (const locale in translations) {
      console.log(`Locale: ${locale}`);
      const sheets = Object.keys(translations[locale]);
      console.log(`  Sheets: ${sheets.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
