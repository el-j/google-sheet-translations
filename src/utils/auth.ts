import { GoogleAuth } from "google-auth-library";
import { validateCredentials } from "./validateEnv";

/**
 * Low-level factory: creates a `GoogleAuth` instance for a given set of scopes.
 *
 * - When `credentials` are supplied, uses them directly (service-account key mode).
 * - When `credentials` is omitted, the instance relies on Application Default
 *   Credentials, i.e. the file pointed to by `GOOGLE_APPLICATION_CREDENTIALS`
 *   (Workload Identity Federation, `gcloud auth application-default login`, etc.).
 *
 * @internal Shared by Drive utilities and `createAuthClient()`. Import
 *   `createAuthClient()` for the standard Sheets use-case.
 */
export function buildGoogleAuth(
	scopes: string[],
	credentials?: { client_email: string; private_key: string },
): GoogleAuth {
	if (credentials) {
		return new GoogleAuth({ credentials, scopes });
	}
	return new GoogleAuth({ scopes });
}

/**
 * Creates and returns a GoogleAuth client for Google Sheets API.
 *
 * Supports two authentication modes (checked in order):
 *
 * 1. **Workload Identity Federation / Application Default Credentials (ADC)**:
 *    Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a credential JSON file
 *    (e.g. written by `google-github-actions/auth`). No service-account key needed.
 *
 * 2. **Service account key** (classic):
 *    Set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` environment variables.
 *
 * @returns GoogleAuth client usable with google-spreadsheet and other Google APIs
 */
export function createAuthClient(): GoogleAuth {
	// ── WIF / ADC path ─────────────────────────────────────────────────────
	// GOOGLE_APPLICATION_CREDENTIALS is set automatically by google-github-actions/auth
	// when using Workload Identity Federation. google-auth-library picks up the
	// federation credential file and exchanges the OIDC token for a short-lived
	// Google access token transparently.
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return buildGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
	}

	// ── Classic service-account key path ───────────────────────────────────
	const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = validateCredentials();

	// GitHub Actions (and many CI systems) store secrets with literal `\n`
	// instead of real newlines. The PEM key must have actual newlines for
	// OpenSSL to parse it; replace any escaped sequences before use.
	const normalizedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

	return buildGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"], {
		client_email: GOOGLE_CLIENT_EMAIL,
		private_key: normalizedKey,
	});
}

export default createAuthClient;
