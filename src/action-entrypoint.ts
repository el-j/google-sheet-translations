import * as core from '@actions/core';
import path from 'node:path';
import { getSpreadSheetData } from './getSpreadSheetData';
import type { SpreadsheetOptions } from './utils/configurationHandler';

export async function run(): Promise<void> {
	try {
		process.env.GOOGLE_CLIENT_EMAIL = core.getInput('google-client-email', { required: true });
		process.env.GOOGLE_PRIVATE_KEY = core.getInput('google-private-key', { required: true });

		const spreadsheetIdInput = core.getInput('google-spreadsheet-id');
		if (spreadsheetIdInput) {
			process.env.GOOGLE_SPREADSHEET_ID = spreadsheetIdInput;
		}

		const sheetTitles = core
			.getInput('sheet-titles', { required: true })
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		const workspaceDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
		const translationsOutputDir = core.getInput('translations-output-dir') || 'translations';
		const localesOutputPath = core.getInput('locales-output-path') || 'src/i18n/locales.ts';
		const dataJsonPath = core.getInput('data-json-path') || 'src/lib/languageData.json';

		const rowLimitInput = core.getInput('row-limit') || '100';
		const waitSecondsInput = core.getInput('wait-seconds') || '1';
		const rowLimitRaw = parseInt(rowLimitInput, 10);
		const waitSecondsRaw = parseInt(waitSecondsInput, 10);
		if (isNaN(rowLimitRaw) || rowLimitRaw <= 0) {
			throw new Error(`Invalid row-limit value: "${rowLimitInput}". Must be a positive integer.`);
		}
		if (isNaN(waitSecondsRaw) || waitSecondsRaw <= 0) {
			throw new Error(`Invalid wait-seconds value: "${waitSecondsInput}". Must be a positive integer.`);
		}

		const options: SpreadsheetOptions = {
			rowLimit: rowLimitRaw,
			waitSeconds: waitSecondsRaw,
			translationsOutputDir: path.resolve(workspaceDir, translationsOutputDir),
			localesOutputPath: path.resolve(workspaceDir, localesOutputPath),
			dataJsonPath: path.resolve(workspaceDir, dataJsonPath),
			syncLocalChanges: core.getInput('sync-local-changes') !== 'false',
			autoTranslate: core.getInput('auto-translate') === 'true',
			spreadsheetId: spreadsheetIdInput || undefined,
			autoCreate: core.getInput('auto-create') !== 'false',
			spreadsheetTitle: core.getInput('spreadsheet-title') || 'google-sheet-translations',
			sourceLocale: core.getInput('source-locale') || 'en',
			targetLocales: core
				.getInput('target-locales')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		};

		const translations = await getSpreadSheetData(sheetTitles, options);

		core.setOutput('translations-dir', path.resolve(workspaceDir, translationsOutputDir));
		core.setOutput('locales-file', path.resolve(workspaceDir, localesOutputPath));
		core.setOutput('data-json-file', path.resolve(workspaceDir, dataJsonPath));

		core.info(`✅ Fetched translations for ${Object.keys(translations).length} locales`);
	} catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

run();
