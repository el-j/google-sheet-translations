/**
 * Example demonstrating bidirectional sync with Google Sheets
 * 
 * This example shows how to:
 * 1. Pull data from a Google Sheet
 * 2. Make local modifications to translation files
 * 3. Push those changes back to the Google Sheet
 */

import { getSpreadSheetData } from '../src';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sheet titles to process (update these to match your actual sheets)
const sheetTitles = ['Index'];

// Output directories
const translationsDir = path.join(__dirname, 'translations');
const dataJsonPath = path.join(__dirname, 'data.json');

async function bidirectionalSyncExample() {
  console.log('Step 1: Pulling initial data from Google Sheets...');
  
  // Pull data from Google Sheets
  await getSpreadSheetData(sheetTitles, {
    translationsOutputDir: translationsDir,
    dataJsonPath,
    syncLocalChanges: false // Don't sync changes on first pull
  });
  
  console.log('\nStep 2: Simulating local development - adding a new key...');
  
  // Wait a moment to ensure file timestamps will be different
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Read the data.json file
  const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
  const dataJson = JSON.parse(dataJsonContent);
  
  // Add a new key to the first sheet's first language
  const firstSheet = Object.keys(dataJson[0])[0];
  const firstLocale = Object.keys(dataJson[0][firstSheet])[0];
  
  console.log(`Adding new key to sheet "${firstSheet}" in locale "${firstLocale}"...`);
  
  // Add a new test key
  const timestamp = new Date().toISOString();
  dataJson[0][firstSheet][firstLocale][`test_key_${timestamp}`] = `This is a test value added at ${timestamp}`;
  
  // Write the modified data back to data.json
  fs.writeFileSync(dataJsonPath, JSON.stringify(dataJson, null, 2), 'utf8');
  
  console.log('\nStep 3: Syncing local changes back to Google Sheets...');
  
  // Sync changes back to Google Sheets
  await getSpreadSheetData(sheetTitles, {
    translationsOutputDir: translationsDir,
    dataJsonPath,
    syncLocalChanges: true // Enable sync
  });
  
  console.log('\nBidirectional sync example completed!');
}

bidirectionalSyncExample().catch(error => {
  console.error('Error in bidirectional sync example:', error);
  process.exit(1);
});
