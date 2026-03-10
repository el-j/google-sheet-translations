import type { GoogleEnvVars } from "../types";
/**
 * Validates that the Google service-account credentials are present.
 * Does NOT require GOOGLE_SPREADSHEET_ID — the caller may create one on first run.
 */
export declare function validateCredentials(): Pick<GoogleEnvVars, 'GOOGLE_CLIENT_EMAIL' | 'GOOGLE_PRIVATE_KEY'>;
/**
 * Validates all three required Google Sheets environment variables.
 * Throws if any are missing.
 */
export declare function validateEnv(): GoogleEnvVars;
export default validateEnv;
//# sourceMappingURL=validateEnv.d.ts.map