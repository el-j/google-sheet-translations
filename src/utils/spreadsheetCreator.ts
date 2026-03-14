import type { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { withRetry } from "./rateLimiter";

/** Column index (0-based) → spreadsheet letter (A, B…Z, AA, AB…). */
function colLetter(index: number): string {
	let result = '';
	let i = index;
	do {
		// Each digit in base-26 maps to a letter A–Z
		result = String.fromCharCode(65 + (i % 26)) + result;
		// Move to the next more-significant "digit", adjusting for 1-based indexing
		i = Math.floor(i / 26) - 1;
	} while (i >= 0);
	return result;
}

/**
 * Wraps a spreadsheet cell reference in a formula that extracts the language
 * prefix (the part before the first "-") and lowercases it.
 *
 * GOOGLETRANSLATE only accepts ISO 639-1 two-letter codes (e.g. "tr") for most
 * languages – region-qualified codes like "tr-TR" no longer work reliably.
 *
 * @param cellRef - A spreadsheet cell reference string, e.g. `$B$1` or `C$1`
 */
function langCodeFormula(cellRef: string): string {
	return `LOWER(IFERROR(LEFT(${cellRef},FIND("-",${cellRef})-1),${cellRef}))`;
}

export interface CreateSpreadsheetOptions {
	/** Spreadsheet title (default: "google-sheet-translations") */
	title?: string;
	/** Source locale column header – translations in this locale are real text (default: "en") */
	sourceLocale?: string;
	/** Additional locale columns – filled with GOOGLETRANSLATE formulas (default: common languages) */
	targetLocales?: string[];
	/** Seed keys: key → source-locale value. If omitted a starter template is used. */
	seedKeys?: Record<string, string>;
}

export interface CreatedSpreadsheetInfo {
	spreadsheetId: string;
	url: string;
}

const DEFAULT_TARGET_LOCALES = ['de', 'fr', 'es', 'it', 'pt', 'ja', 'zh'];

const STARTER_KEYS: Record<string, string> = {
	'app.name': 'My App',
	'app.description': 'A great application',
	'nav.home': 'Home',
	'nav.about': 'About',
	'nav.contact': 'Contact',
	'common.save': 'Save',
	'common.cancel': 'Cancel',
	'common.loading': 'Loading…',
	'common.error': 'An error occurred',
	'common.success': 'Success!',
};

/**
 * Creates a new Google Spreadsheet seeded with translation starter content and
 * GOOGLETRANSLATE formulas for every non-source locale.
 *
 * Returns the spreadsheet ID and URL.
 */
export async function createSpreadsheet(
	authClient: JWT,
	options: CreateSpreadsheetOptions = {},
): Promise<CreatedSpreadsheetInfo> {
	const {
		title = 'google-sheet-translations',
		sourceLocale = 'en',
		targetLocales = DEFAULT_TARGET_LOCALES,
		seedKeys = STARTER_KEYS,
	} = options;

	// ── Step 1: Create the spreadsheet via the Sheets REST API ─────────────
	// google-spreadsheet v4 does not expose a static create method, so we use
	// the underlying JWT client to make a direct API call.
	await authClient.authorize();

	const createRes = await withRetry(
		() =>
			authClient.request<{ spreadsheetId: string }>({
				url: 'https://sheets.googleapis.com/v4/spreadsheets',
				method: 'POST',
				data: {
					properties: { title },
					sheets: [
						{ properties: { title: '__welcome__', index: 0 } },
						{ properties: { title: 'i18n', index: 1 } },
					],
				},
			}),
		'createSpreadsheet',
	);

	const spreadsheetId = createRes.data.spreadsheetId;
	const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

	// ── Step 2: Open the spreadsheet with google-spreadsheet ───────────────
	const doc = new GoogleSpreadsheet(spreadsheetId, authClient);
	await withRetry(() => doc.loadInfo(), 'loadInfo after create');

	// ── Step 3: Populate __welcome__ sheet ─────────────────────────────────
	const welcomeSheet = doc.sheetsByTitle['__welcome__'];
	if (welcomeSheet) {
		await withRetry(
			() => welcomeSheet.loadCells('A1:B20'),
			'loadCells welcome',
		);

		const lines = [
			['📊 Google Sheet Translations', ''],
			['', ''],
			['Package:', '@el-j/google-sheet-translations'],
			['Docs:', 'https://el-j.github.io/google-sheet-translations/'],
			['', ''],
			['Your Spreadsheet ID:', spreadsheetId],
			['URL:', url],
			['', ''],
			['Add to your .env file:', ''],
			['GOOGLE_SPREADSHEET_ID=' + spreadsheetId, ''],
			['', ''],
			['How this works:', ''],
			['1. The "i18n" sheet (and any other sheet you add) holds your translation keys.', ''],
			['2. Column A = key, Column B = source language, other columns = auto-translated.', ''],
			['3. Run getSpreadSheetData([\'i18n\']) in your project to sync to local files.', ''],
			['4. Add more sheets for different pages/features of your app.', ''],
			['5. Use syncLocalChanges: true (default) to push new keys back to this spreadsheet.', ''],
		];

		for (let r = 0; r < lines.length; r++) {
			for (let c = 0; c < lines[r].length; c++) {
				const cell = welcomeSheet.getCell(r, c);
				cell.value = lines[r][c];
			}
		}
		await withRetry(() => welcomeSheet.saveUpdatedCells(), 'saveWelcome');
	}

	// ── Step 4: Populate i18n sheet with headers + GOOGLETRANSLATE rows ────
	const i18nSheet = doc.sheetsByTitle['i18n'];
	if (i18nSheet) {
		const allLocales = [sourceLocale, ...targetLocales];
		// Row 1 = headers
		await withRetry(
			() => i18nSheet.setHeaderRow(['key', ...allLocales]),
			'setHeaderRow',
		);

		// Build rows: source column has real text; other columns get GOOGLETRANSLATE formula.
		// Source is always column B (index 1 after 'key')
		const sourceColLetter = colLetter(1); // B
		const rows = Object.entries(seedKeys).map(([key, sourceValue]) => {
			const row: Record<string, string> = { key, [sourceLocale]: sourceValue };
			targetLocales.forEach((locale, idx) => {
				const targetColLetter = colLetter(2 + idx); // C, D, E, …
				// Use language-prefix extraction so region-qualified headers (e.g. "tr-TR")
				// are reduced to the ISO 639-1 code ("tr") that GOOGLETRANSLATE requires.
				row[locale] =
					`=GOOGLETRANSLATE(INDIRECT("${sourceColLetter}"&ROW());${langCodeFormula(`$${sourceColLetter}$1`)};${langCodeFormula(`${targetColLetter}$1`)})`;
			});
			return row;
		});

		await withRetry(() => i18nSheet.addRows(rows), 'addRows i18n');
	}

	console.log('');
	console.log('✅ New spreadsheet created!');
	console.log(`   Title  : ${title}`);
	console.log(`   URL    : ${url}`);
	console.log(`   ID     : ${spreadsheetId}`);
	console.log('');
	console.log('   Add this to your .env file (or environment):');
	console.log(`   GOOGLE_SPREADSHEET_ID=${spreadsheetId}`);
	console.log('');

	return { spreadsheetId, url };
}
