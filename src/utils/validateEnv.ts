import type { GoogleEnvVars } from "../types";

/**
 * Validates that Google service-account credentials are present.
 * Does NOT require GOOGLE_SPREADSHEET_ID — the caller may create one on first run.
 *
 * When `GOOGLE_APPLICATION_CREDENTIALS` is set (Workload Identity Federation / ADC),
 * `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` are not required.
 */
export function validateCredentials(): Pick<GoogleEnvVars, 'GOOGLE_CLIENT_EMAIL' | 'GOOGLE_PRIVATE_KEY'> {
	// WIF / ADC mode: service-account key env vars are not needed
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return {
			GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL ?? '',
			GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ?? '',
		};
	}

	const requiredVars = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] as const;
	const missing = requiredVars.filter((v) => !process.env[v]);
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(', ')}\n\nMake sure these are set in your .env file or environment.\nAlternatively, set GOOGLE_APPLICATION_CREDENTIALS for Workload Identity Federation.`,
		);
	}
	return {
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL as string,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
	};
}

/**
 * Validates all Google Sheets environment variables, including the spreadsheet ID.
 * Throws if GOOGLE_SPREADSHEET_ID is missing, or if neither service-account key
 * credentials nor GOOGLE_APPLICATION_CREDENTIALS (WIF/ADC) are set.
 */
export function validateEnv(): GoogleEnvVars {
	const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
	if (!spreadsheetId) {
		throw new Error(
			`Missing required environment variable: GOOGLE_SPREADSHEET_ID\n\nMake sure this is set in your .env file or environment.`,
		);
	}

	// WIF / ADC mode: service-account key env vars are not needed
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return {
			GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL ?? '',
			GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ?? '',
			GOOGLE_SPREADSHEET_ID: spreadsheetId,
		};
	}

	const requiredVars: Array<keyof GoogleEnvVars> = [
		'GOOGLE_CLIENT_EMAIL',
		'GOOGLE_PRIVATE_KEY',
		'GOOGLE_SPREADSHEET_ID',
	];
	const missingVars = requiredVars.filter((varName) => !process.env[varName]);
	if (missingVars.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missingVars.join(', ')}\n\nMake sure these are set in your .env file or environment.\nAlternatively, set GOOGLE_APPLICATION_CREDENTIALS for Workload Identity Federation.`,
		);
	}
	return {
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL as string,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
		GOOGLE_SPREADSHEET_ID: spreadsheetId,
	};
}

export default validateEnv;
