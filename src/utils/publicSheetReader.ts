import https from "node:https";
import http from "node:http";
import type { SheetRow } from "../types";

interface GvizColumn {
	id: string;
	label: string;
	type: string;
}

interface GvizCell {
	v: string | number | boolean | null;
}

interface GvizRow {
	c: (GvizCell | null)[];
}

interface GvizTable {
	cols: GvizColumn[];
	rows: GvizRow[];
}

interface GvizResponse {
	status: string;
	errors?: Array<{ message: string }>;
	table: GvizTable;
}

/**
 * Fetches the raw response body from a URL using the built-in http/https module.
 * Follows a single redirect if the server issues one (3xx).
 */
function fetchUrl(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const client = url.startsWith("https") ? https : http;
		const req = client.get(url, (res) => {
			// Follow one redirect (e.g. Google auth redirect)
			if (
				res.statusCode !== undefined &&
				res.statusCode >= 300 &&
				res.statusCode < 400 &&
				res.headers.location
			) {
				fetchUrl(res.headers.location).then(resolve).catch(reject);
				return;
			}

			if (res.statusCode !== undefined && res.statusCode >= 400) {
				reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
				return;
			}

			let data = "";
			res.on("data", (chunk: Buffer) => {
				data += chunk.toString();
			});
			res.on("end", () => resolve(data));
			res.on("error", reject);
		});
		req.on("error", reject);
		req.end();
	});
}

/**
 * Strips the JSONP wrapper that the Google Visualization API adds and parses
 * the inner JSON object.
 *
 * Expected wrapper format:
 *   `/*O_o*\/\ngoogle.visualization.Query.setResponse({...});`
 */
function parseGvizResponse(raw: string): GvizResponse {
	const match = raw.match(/google\.visualization\.Query\.setResponse\((\{[\s\S]*\})\)/);
	if (!match) {
		throw new Error(
			'Unexpected response format from Google Visualization API. ' +
				'Make sure the spreadsheet is shared as "Anyone with link can view".',
		);
	}
	return JSON.parse(match[1]) as GvizResponse;
}

/**
 * Reads rows from a *publicly accessible* Google Spreadsheet sheet without
 * requiring any service-account credentials or API key.
 *
 * The spreadsheet must be shared with **"Anyone with link can view"** (or
 * broader). Works via Google's Visualization (gviz) query endpoint which
 * is available at no cost for public sheets.
 *
 * @param spreadsheetId - The Google Spreadsheet ID (from the URL)
 * @param sheetName     - The sheet tab name to fetch
 * @returns An array of row objects keyed by column header
 * @throws  If the sheet is not accessible or the response cannot be parsed
 */
export async function readPublicSheet(
	spreadsheetId: string,
	sheetName: string,
): Promise<SheetRow[]> {
	const url =
		`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}` +
		`/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

	let raw: string;
	try {
		raw = await fetchUrl(url);
	} catch (err) {
		throw new Error(
			`Failed to fetch public sheet "${sheetName}" from spreadsheet "${spreadsheetId}"`,
			{ cause: err },
		);
	}

	let data: GvizResponse;
	try {
		data = parseGvizResponse(raw);
	} catch (err) {
		throw new Error(
			`Failed to parse response for sheet "${sheetName}" in spreadsheet "${spreadsheetId}"`,
			{ cause: err },
		);
	}

	if (data.status !== "ok") {
		const message = data.errors?.[0]?.message ?? "Unknown error";
		throw new Error(
			`Google Visualization API returned an error for sheet "${sheetName}": ${message}`,
		);
	}

	if (!data.table) {
		return [];
	}

	const { cols, rows } = data.table;
	const headers = cols.map((col) => col.label || col.id);

	return rows
		.filter((row) => row && row.c)
		.map((row): SheetRow => {
			const obj: SheetRow = {};
			for (let i = 0; i < headers.length; i++) {
				const cell = row.c?.[i];
				obj[headers[i]] = cell?.v != null ? String(cell.v) : "";
			}
			return obj;
		});
}

export default readPublicSheet;
