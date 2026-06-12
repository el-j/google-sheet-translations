import type { GoogleEnvVars } from "../types";

/**
 * Validates that the Google service-account credentials are present.
 * Does NOT require GOOGLE_SPREADSHEET_ID — the caller may create one on first run.
 */
export function validateCredentials(): Pick<GoogleEnvVars, 'GOOGLE_CLIENT_EMAIL' | 'GOOGLE_PRIVATE_KEY'> {
	const requiredVars = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] as const;
	const missing = requiredVars.filter((v) => !process.env[v]);
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(', ')}\n\nMake sure these are set in your .env file or environment.`,
		);
	}
	return {
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL as string,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
	};
}

/**
 * Validates all three required Google Sheets environment variables.
 * Throws if any are missing.
 */
export function validateEnv(): GoogleEnvVars {
	const requiredVars: Array<keyof GoogleEnvVars> = [
		'GOOGLE_CLIENT_EMAIL',
		'GOOGLE_PRIVATE_KEY',
		'GOOGLE_SPREADSHEET_ID',
	];
	const missingVars = requiredVars.filter((varName) => !process.env[varName]);
	if (missingVars.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missingVars.join(', ')}\n\nMake sure these are set in your .env file or environment.`,
		);
	}
	return {
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL as string,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
		GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID as string,
	};
}

export default validateEnv;
