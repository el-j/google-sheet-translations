import type { GoogleEnvVars } from "../types";

/**
 * Validates required environment variables for Google Sheets API
 * @returns Object with validated environment variables
 * @throws Error if any required environment variable is missing
 */
export function validateEnv(): GoogleEnvVars {
	// Check for required environment variables
	const requiredVars: Array<keyof GoogleEnvVars> = [
		"GOOGLE_CLIENT_EMAIL",
		"GOOGLE_PRIVATE_KEY",
		"GOOGLE_SPREADSHEET_ID",
	];

	const missingVars = requiredVars.filter((varName) => !process.env[varName]);

	if (missingVars.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missingVars.join(", ")}\n
\nMake sure these are set in your .env file or environment.`,
		);
	}

	// Return validated environment variables
	return {
		GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL as string,
		GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
		GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID as string,
	};
}

export default validateEnv;
