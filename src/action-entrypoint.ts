import * as core from '@actions/core';
import path from 'node:path';
import { getSpreadSheetData } from './getSpreadSheetData';
import { manageDriveTranslations } from './utils/getDriveTranslations';
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
			override: core.getInput('override') === 'true',
			cleanPush: core.getInput('clean-push') === 'true',
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

		const driveFolderId = core.getInput('drive_folder_id') || undefined;
		const scanForSpreadsheets = core.getInput('scan_for_spreadsheets') !== 'false';
		const spreadsheetIdsRaw = core.getInput('spreadsheet_ids');
		const spreadsheetIds = spreadsheetIdsRaw
			? spreadsheetIdsRaw
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: undefined;
		const syncImages = core.getInput('sync_images') === 'true';
		const imageOutputPath = core.getInput('image_output_path') || './public/remote-images';

		let localeCount: number;

		if (driveFolderId || (spreadsheetIds && spreadsheetIds.length > 0)) {
			const driveResult = await manageDriveTranslations({
				driveFolderId,
				scanForSpreadsheets,
				spreadsheetIds,
				syncImages,
				imageOutputPath: syncImages ? imageOutputPath : undefined,
				docTitles: sheetTitles,
				translationOptions: options,
			});
			localeCount = Object.keys(driveResult.translations).length;
		} else {
			const translations = await getSpreadSheetData(sheetTitles, options);
			localeCount = Object.keys(translations).length;
		}

		core.setOutput('translations-dir', path.resolve(workspaceDir, translationsOutputDir));
		core.setOutput('locales-file', path.resolve(workspaceDir, localesOutputPath));
		core.setOutput('data-json-file', path.resolve(workspaceDir, dataJsonPath));

		core.info(`✅ Fetched translations for ${localeCount} locales`);
	} catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

run();
