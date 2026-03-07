import fs from 'node:fs';
import path from 'node:path';
import { GoogleSpreadsheet } from "google-spreadsheet";
import type { TranslationData } from "./types";
import { createAuthClient } from "./utils/auth";
import { normalizeConfig, type SpreadsheetOptions } from "./utils/configurationHandler";
import { processSheet, processRawRows } from "./utils/sheetProcessor";
import { writeTranslationFiles, writeLocalesFile, writeLanguageDataFile } from "./utils/fileWriter";
import { handleBidirectionalSync } from "./utils/syncManager";
import { withRetry } from "./utils/rateLimiter";
import { readPublicSheet } from "./utils/publicSheetReader";
import { createSpreadsheet } from "./utils/spreadsheetCreator";
import { DEFAULT_WAIT_SECONDS } from "./constants";
export { DEFAULT_WAIT_SECONDS };

/**
 * Fetches and processes data from a Google Spreadsheet.
 *
 * Modes:
 * - **Authenticated** (default): uses a Google Cloud service account.
 *   Supports bidirectional sync, auto-translate, and auto-create.
 * - **Public** (`publicSheet: true`): reads via the Google Visualization API
 *   with no credentials. The spreadsheet must be shared publicly.
 *
 * **Auto-create**: when no spreadsheet ID is available and `autoCreate` is true
 * (the default), a new spreadsheet is created automatically on first run.
 */
const MAX_SYNC_REFRESH_DEPTH = 1;

/** Appends (or updates) GOOGLE_SPREADSHEET_ID in .env when the file exists. */
async function persistSpreadsheetId(id: string): Promise<void> {
	const envPath = path.join(process.cwd(), '.env');
	try {
		let content = '';
		if (fs.existsSync(envPath)) {
			content = fs.readFileSync(envPath, 'utf8');
			if (/^GOOGLE_SPREADSHEET_ID=/m.test(content)) {
				content = content.replace(/^GOOGLE_SPREADSHEET_ID=.*/m, `GOOGLE_SPREADSHEET_ID=${id}`);
			} else {
				content = content.trimEnd() + `\nGOOGLE_SPREADSHEET_ID=${id}\n`;
			}
		} else {
			content = `GOOGLE_SPREADSHEET_ID=${id}\n`;
		}
		fs.writeFileSync(envPath, content, 'utf8');
		console.log(`   Saved GOOGLE_SPREADSHEET_ID to ${envPath}`);
	} catch (err) {
		console.warn(`   Could not write .env: ${(err as Error).message}`);
	}
}

export async function getSpreadSheetData(
	_docTitle?: string[],
	options: SpreadsheetOptions = {},
	_refreshDepth = 0,
): Promise<TranslationData> {
	const config = normalizeConfig(options);
	const baseDelayMs = config.waitSeconds * 1000;

	const docTitle: string[] = _docTitle ?? [];
	if (docTitle.length === 0) {
		console.warn("No sheet titles provided, cannot process spreadsheet data");
		return {};
	}
	if (!docTitle.includes("i18n")) {
		docTitle.push("i18n");
	}

	const finalTranslations: TranslationData = {};
	const allLocales = new Set<string>();
	const localesWithContent = new Set<string>();
	const globalLocaleMapping: Record<string, string> = {};
	const globalOriginalMapping: Record<string, string> = {};

	function mergeResult(result: Awaited<ReturnType<typeof processRawRows>>, title: string) {
		if (!result.success) return;
		for (const [normalized, original] of Object.entries(result.localeMapping)) {
			if (!globalLocaleMapping[normalized]) globalLocaleMapping[normalized] = original;
		}
		for (const [original, normalized] of Object.entries(result.originalMapping)) {
			if (!globalOriginalMapping[original]) globalOriginalMapping[original] = normalized;
		}
		for (const locale of result.locales) {
			if (finalTranslations[locale]) {
				finalTranslations[locale] = { ...finalTranslations[locale], ...result.translations[locale] };
			} else {
				finalTranslations[locale] = result.translations[locale];
			}
			allLocales.add(locale);
			if (title !== "i18n" && result.translations[locale]) {
				const hasActualTranslations = Object.values(result.translations[locale]).some(
					(sheetTranslations) => Object.keys(sheetTranslations).length > 0,
				);
				if (hasActualTranslations) localesWithContent.add(locale);
			}
		}
	}

	if (config.publicSheet) {
		// ── Public (unauthenticated) path ──────────────────────────────────────
		const spreadsheetId =
			config.spreadsheetId ?? process.env.GOOGLE_SPREADSHEET_ID;

		if (!spreadsheetId) {
			throw new Error(
				"No spreadsheet ID provided. Set GOOGLE_SPREADSHEET_ID or pass spreadsheetId in options.",
			);
		}

		console.log(`Processing ${docTitle.length} sheets: ${docTitle.join(", ")}`);

		await Promise.all(
			docTitle.map(async (title) => {
				let rows;
				try {
					rows = await withRetry(
						() => readPublicSheet(spreadsheetId, title),
						`readPublicSheet: ${title}`,
						baseDelayMs,
					);
				} catch (err) {
					console.warn(`Sheet "${title}" could not be fetched: ${(err as Error).message}`);
					return;
				}
				mergeResult(await processRawRows(rows, title), title);
			}),
		);
	} else {
		// ── Authenticated path ─────────────────────────────────────────────────
		const serviceAuthClient = createAuthClient();

		// Resolve spreadsheet ID: option > env var > auto-create
		let spreadsheetId =
			config.spreadsheetId ?? process.env.GOOGLE_SPREADSHEET_ID;

		if (!spreadsheetId) {
			if (config.autoCreate) {
				const created = await createSpreadsheet(serviceAuthClient, {
					title: config.spreadsheetTitle,
					sourceLocale: config.sourceLocale,
					targetLocales: config.targetLocales,
				});
				spreadsheetId = created.spreadsheetId;
				await persistSpreadsheetId(spreadsheetId);
			} else {
				throw new Error(
					"No spreadsheet ID provided. Set GOOGLE_SPREADSHEET_ID or pass spreadsheetId in options.",
				);
			}
		}

		console.log(`Processing ${docTitle.length} sheets: ${docTitle.join(", ")}`);

		const doc = new GoogleSpreadsheet(spreadsheetId, serviceAuthClient);
		try {
			await withRetry(() => doc.loadInfo(true), "loadInfo", baseDelayMs);
		} catch (err) {
			throw new Error(`Failed to load spreadsheet "${spreadsheetId}"`, { cause: err });
		}

		await Promise.all(
			docTitle.map(async (title) => {
				const sheet = doc.sheetsByTitle[title];
				if (!sheet) {
					console.warn(`Sheet "${title}" not found in the document`);
					return;
				}
				mergeResult(await processSheet(sheet, title, config.rowLimit, baseDelayMs), title);
			}),
		);

		const syncResult = await handleBidirectionalSync(
			doc,
			config.dataJsonPath,
			config.translationsOutputDir,
			config.syncLocalChanges,
			config.autoTranslate,
			finalTranslations,
			config.waitSeconds,
			globalLocaleMapping,
		);

		if (syncResult.shouldRefresh && _refreshDepth < MAX_SYNC_REFRESH_DEPTH) {
			return getSpreadSheetData(
				_docTitle,
				{ ...options, syncLocalChanges: false },
				_refreshDepth + 1,
			);
		}
	}

	const localesForOutput =
		localesWithContent.size > 0 ? Array.from(localesWithContent) : Array.from(allLocales);
	const allLocalesArray = Array.from(allLocales);

	writeTranslationFiles(finalTranslations, allLocalesArray, config.translationsOutputDir);
	writeLocalesFile(localesForOutput, globalLocaleMapping, config.localesOutputPath);

	console.log(
		`Writing locales file with ${localesForOutput.length} locales that have actual translations:`,
		localesForOutput,
	);

	if (Object.keys(finalTranslations).length > 0) {
		writeLanguageDataFile(finalTranslations, allLocalesArray, config.dataJsonPath);
	}

	return finalTranslations;
}

export default getSpreadSheetData;
