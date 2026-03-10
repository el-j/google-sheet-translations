import type { TranslationData } from "./types";
import { type SpreadsheetOptions } from "./utils/configurationHandler";
import { DEFAULT_WAIT_SECONDS } from "./constants";
export { DEFAULT_WAIT_SECONDS };
export declare function getSpreadSheetData(_docTitle?: string[], options?: SpreadsheetOptions, _refreshDepth?: number): Promise<TranslationData>;
export default getSpreadSheetData;
