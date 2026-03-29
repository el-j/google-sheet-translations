import type { TranslationData } from '../types';
import type { MultiSpreadsheetOptions } from '../getMultipleSpreadSheetsData';
import { getMultipleSpreadSheetsData } from '../getMultipleSpreadSheetsData';
import type { ScanDriveFolderOptions } from './driveFolderScanner';
import { scanDriveFolderForSpreadsheets } from './driveFolderScanner';
import type { DriveImageSyncOptions, DriveImageSyncResult } from './driveImageSync';
import { syncDriveImages } from './driveImageSync';

export interface GoogleDriveManagerOptions {
	/**
	 * Google Drive folder ID to scan for spreadsheets and/or images.
	 * If provided without explicit spreadsheetIds, the folder is scanned
	 * automatically for spreadsheet files.
	 */
	driveFolderId?: string;

	/**
	 * When true, scans driveFolderId for all Google Spreadsheet files and
	 * fetches translations from each. Requires driveFolderId. (default: true when driveFolderId set)
	 */
	scanForSpreadsheets?: boolean;

	/**
	 * Explicit list of spreadsheet IDs to fetch from.
	 * If provided together with driveFolderId + scanForSpreadsheets, the
	 * explicit list is merged with the discovered ones (deduped).
	 */
	spreadsheetIds?: string[];

	/**
	 * Optional filter: only process spreadsheets whose name matches this pattern.
	 * Useful when the Drive folder contains non-translation spreadsheets.
	 * @example /^translations-/i
	 */
	spreadsheetNameFilter?: RegExp;

	/**
	 * When true, also sync images from driveFolderId to imageOutputPath.
	 * Requires driveFolderId. (default: false)
	 */
	syncImages?: boolean;

	/**
	 * Local directory to download Drive images into.
	 * Required when syncImages: true.
	 * @example './src/assets/remote-images'
	 */
	imageOutputPath?: string;

	/**
	 * Image sync options passed to syncDriveImages (mimeTypes, concurrency, etc.)
	 */
	imageSyncOptions?: Partial<DriveImageSyncOptions>;

	/**
	 * Options forwarded to getMultipleSpreadSheetsData (rowLimit, waitSeconds,
	 * translationsOutputDir, autoTranslate, etc.)
	 */
	translationOptions?: MultiSpreadsheetOptions;

	/** Sheet names to fetch from each discovered spreadsheet */
	docTitles?: string[];
}

export interface GoogleDriveManagerResult {
	translations: TranslationData;
	/** List of spreadsheet IDs that were processed */
	spreadsheetIds: string[];
	/** Image sync result (only present if syncImages: true) */
	imageSync?: DriveImageSyncResult;
}

/**
 * Top-level "headless CMS bridge" function.
 *
 * Scans a Google Drive folder for spreadsheets, fetches all translations,
 * optionally syncs images, and returns merged results.
 *
 * @example
 * const result = await manageDriveTranslations({
 *   driveFolderId: 'your-folder-id',
 *   scanForSpreadsheets: true,
 *   spreadsheetNameFilter: /^i18n-/,
 *   syncImages: true,
 *   imageOutputPath: './src/assets/remote-images',
 *   translationOptions: {
 *     autoTranslate: false,
 *     translationsOutputDir: './src/translations'
 *   }
 * });
 * console.log(result.translations);
 * console.log(result.imageSync?.downloaded.length + ' images downloaded');
 */
export async function manageDriveTranslations(
	options: GoogleDriveManagerOptions,
): Promise<GoogleDriveManagerResult> {
	const {
		driveFolderId,
		scanForSpreadsheets = true,
		spreadsheetIds: explicitIds = [],
		spreadsheetNameFilter,
		syncImages = false,
		imageOutputPath,
		imageSyncOptions,
		translationOptions = {},
		docTitles,
	} = options;

	if (syncImages && !imageOutputPath) {
		throw new Error(
			'[manageDriveTranslations] imageOutputPath is required when syncImages is true',
		);
	}

	// Scan Drive folder for spreadsheets if requested
	const discoveredIds: string[] = [];
	const discoveredNames: Map<string, string> = new Map();

	if (driveFolderId && scanForSpreadsheets) {
		const scanOptions: ScanDriveFolderOptions = { folderId: driveFolderId };
		const discovered = await scanDriveFolderForSpreadsheets(scanOptions);
		console.log(
			`[manageDriveTranslations] Found ${discovered.length} spreadsheet(s) in Drive folder`,
		);

		for (const file of discovered) {
			discoveredIds.push(file.id);
			discoveredNames.set(file.id, file.name);
		}
	}

	// Merge discovered IDs with explicit IDs (dedup)
	const allIds = [...new Set([...discoveredIds, ...explicitIds])];

	// Apply spreadsheetNameFilter (only filter discovered ones; explicit IDs pass through)
	const filteredIds = spreadsheetNameFilter
		? allIds.filter((id) => {
				const name = discoveredNames.get(id);
				// Explicit IDs that weren't discovered have no name — allow them through
				if (!name) return true;
				return spreadsheetNameFilter.test(name);
			})
		: allIds;

	// Fetch translations
	const translations = await getMultipleSpreadSheetsData(docTitles, {
		...translationOptions,
		spreadsheetIds: filteredIds.length > 0 ? filteredIds : undefined,
	});

	// Optionally sync images
	let imageSync: DriveImageSyncResult | undefined;
	if (syncImages && driveFolderId && imageOutputPath) {
		imageSync = await syncDriveImages({
			...imageSyncOptions,
			folderId: driveFolderId,
			outputPath: imageOutputPath,
		});
	}

	return { translations, spreadsheetIds: filteredIds, imageSync };
}
