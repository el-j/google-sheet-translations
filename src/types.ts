/**
 * Types for translation values
 */
export type TranslationValue =
	| string
	| number
	| boolean
	| Record<string, unknown>
	| unknown[];

/**
 * Structure of translation data
 * locale -> sheet -> key -> value
 */
export type TranslationData = Record<
	string,
	Record<string, Record<string, TranslationValue>>
>;

/**
 * Structure for a Google Sheet row
 */
export type SheetRow = Record<string, string>;

/**
 * Environment variables required by the package
 */
export interface GoogleEnvVars {
	GOOGLE_CLIENT_EMAIL: string;
	GOOGLE_PRIVATE_KEY: string;
	GOOGLE_SPREADSHEET_ID: string;
}
