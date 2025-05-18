import { JWT } from "google-auth-library";
import { validateEnv } from "./validateEnv";

/**
 * Creates and returns a JWT auth client for Google Sheets API
 * @returns JWT authentication client
 */
export function createAuthClient(): JWT {
	const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = validateEnv();

	return new JWT({
		email: GOOGLE_CLIENT_EMAIL,
		key: GOOGLE_PRIVATE_KEY,
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});
}

export default createAuthClient;
