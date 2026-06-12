import { JWT } from "google-auth-library";
import { validateCredentials } from "./validateEnv";

/**
 * Creates and returns a JWT auth client for Google Sheets API
 * @returns JWT authentication client
 */
export function createAuthClient(): JWT {
	const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = validateCredentials();

	// GitHub Actions (and many CI systems) store secrets with literal `\n`
	// instead of real newlines. The PEM key must have actual newlines for
	// OpenSSL to parse it; replace any escaped sequences before use.
	const normalizedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

	return new JWT({
		email: GOOGLE_CLIENT_EMAIL,
		key: normalizedKey,
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});
}

export default createAuthClient;
