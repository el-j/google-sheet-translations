import fs from "node:fs";

/**
 * Gets the last modified time of a file
 * @param filePath - Path to the file
 * @returns The last modified time as a Date object, or null if file doesn't exist
 */
export function getFileLastModified(filePath: string): Date | null {
	try {
		const stats = fs.statSync(filePath);
		return stats.mtime;
	} catch (error) {
		return null;
	}
}
