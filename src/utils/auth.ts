import { GoogleAuth } from "google-auth-library";
import { validateCredentials } from "./validateEnv";

/**
 * Normalizes a private key string from the many different ways secret-storage
 * systems (GitHub Secrets, CI env vars, secret managers) encode it.
 *
 * Handles all of the following formats so the caller doesn't need to care
 * whether the value came from a GitHub Secret, a plain env var, a `.env` file
 * or any other source:
 *
 * - Real newlines  →  left as-is
 * - Literal `\n` two-char sequences  →  converted to real newlines
 * - Surrounding double or single quotes added by some tools  →  stripped
 *   (leading/trailing whitespace outside the quotes is also stripped)
 * - Windows-style `\r\n` line endings  →  normalised to `\n`
 */
export function normalizePrivateKey(key: string): string {
	let normalized = key;

	// Check for surrounding quotes on the trimmed version so that values like
	// `  "-----BEGIN…"  ` (spaces outside the quotes) are also handled correctly.
	// We only use trim() to detect/strip the quotes; we don't trim the whole key
	// unconditionally to preserve any trailing newline that is part of the PEM.
	const outer = key.trim();
	if (
		(outer.startsWith('"') && outer.endsWith('"')) ||
		(outer.startsWith("'") && outer.endsWith("'"))
	) {
		normalized = outer.slice(1, -1);
	}

	// Replace the literal two-character sequence backslash+n with a real newline.
	// GitHub Actions (and many CI systems) store multi-line secrets this way.
	normalized = normalized.replace(/\\n/g, "\n");

	// Normalise Windows-style CRLF line endings.
	normalized = normalized.replace(/\r\n/g, "\n");

	return normalized;
}

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

	const normalizedKey = normalizePrivateKey(GOOGLE_PRIVATE_KEY);

	return buildGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"], {
		client_email: GOOGLE_CLIENT_EMAIL,
		private_key: normalizedKey,
	});
}

export default createAuthClient;
