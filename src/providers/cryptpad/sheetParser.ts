import type { SheetRow } from '../../types';

export interface CryptPadSheetGrid {
  [cellRef: string]: string;
}

export interface ReconstructedSheet {
  cells: CryptPadSheetGrid;
  rows: SheetRow[];
  sheetNames: string[];
}

/** Converts column index (0-based) to letter: 0 -> 'A', 25 -> 'Z', 26 -> 'AA'. */
export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/** Converts column letter to 0-based index: 'A' -> 0, 'Z' -> 25, 'AA' -> 26. */
export function letterToColIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parses cell coordinates from a reference like "A1", "Sheet1!B2", or "$C$5".
 */
export function parseCellRef(ref: string): { sheet?: string; col: string; row: number } | null {
  const match = ref.match(/^(?:([^!]+)!)?\$?([A-Z]+)\$?(\d+)$/i);
  if (!match) return null;
  return {
    sheet: match[1],
    col: match[2].toUpperCase(),
    row: parseInt(match[3], 10),
  };
}

/**
 * Extracts the OnlyOffice real-time collaboration channel ID from decrypted pad metadata messages.
 */
export function extractOnlyOfficeChannelId(metadataMessages: string[]): string | null {
  for (const raw of metadataMessages) {
    try {
      const parsed = JSON.parse(raw);
      // Format 1: [seq, [[offset, len, jsonStr]]]
      if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
        for (const edit of parsed[1]) {
          if (Array.isArray(edit) && typeof edit[2] === 'string') {
            try {
              const inner = JSON.parse(edit[2]);
              if (inner?.content?.channel && typeof inner.content.channel === 'string') {
                return inner.content.channel;
              }
            } catch {
              // Continue
            }
          }
        }
      }

      // Format 2: direct object
      if (parsed?.content?.channel && typeof parsed.content.channel === 'string') {
        return parsed.content.channel;
      }
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Parses OnlyOffice incremental binary change records into cell coordinates and text values.
 */
export function parseOnlyOfficeChanges(rtMessages: string[]): CryptPadSheetGrid {
  const cells: CryptPadSheetGrid = {};

  for (const raw of rtMessages) {
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.changes)) continue;

      for (const ch of data.changes) {
        if (!ch?.change) continue;
        let changeStr = ch.change;
        if (typeof changeStr !== 'string') continue;

        try {
          changeStr = JSON.parse(changeStr);
        } catch {
          // Use as is
        }

        const parts = changeStr.split(';');
        if (parts.length < 2) continue;

        const b64 = parts[1];
        const buf = Buffer.from(b64, 'base64');
        if (buf.length === 0) continue;

        // Search for UTF-16LE string markers (0x08 prefix with 4-byte LE length)
        for (let i = 0; i < buf.length - 5; i++) {
          if (buf[i] === 0x08) {
            const strLen = buf.readUInt32LE(i + 1);
            if (strLen > 0 && strLen < 4000 && i + 5 + strLen <= buf.length) {
              const strBuf = buf.subarray(i + 5, i + 5 + strLen);
              const str = strBuf.toString('utf16le');

              // Case A: explicit cell coordinate reference (e.g. Sheet1!A1, auth!B2)
              const cellMatch = str.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)$/);
              if (cellMatch) {
                const sheetPrefix = cellMatch[1] ? `${cellMatch[1]}!` : '';
                const cellRef = `${sheetPrefix}${cellMatch[2]}${cellMatch[3]}`;
                // Look forward within next 30 bytes for the text value
                const searchStart = i + 5 + strLen;
                for (let j = searchStart; j < Math.min(searchStart + 30, buf.length - 5); j++) {
                  if (buf[j] === 0x08) {
                    const nextLen = buf.readUInt32LE(j + 1);
                    if (nextLen > 0 && nextLen < 10000 && j + 5 + nextLen <= buf.length) {
                      const val = buf.subarray(j + 5, j + 5 + nextLen).toString('utf16le');
                      cells[cellRef] = val;
                    }
                    break;
                  }
                }
              }

              // Case B: binary range coordinates in change header (r1, c1, r2, c2)
              // OnlyOffice stores r1, c1, r2, c2 at bytes 14..29 in certain change packets
              if (buf.length >= 30 && i >= 40) {
                try {
                  const c1 = buf.readUInt32LE(14);
                  const r1 = buf.readUInt32LE(18);
                  if (r1 < 100000 && c1 < 200) {
                    const colLetter = colIndexToLetter(c1);
                    const cellRef = `${colLetter}${r1 + 1}`;
                    if (!cells[cellRef] && str.trim().length > 0 && !str.includes('!')) {
                      cells[cellRef] = str;
                    }
                  }
                } catch {
                  // Ignore
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore unparseable message
    }
  }

  return cells;
}

/**
 * Converts a grid of cell references (e.g. { A1: 'key', B1: 'en', A2: 'btn.save', B2: 'Save' })
 * into structured `SheetRow[]` objects using row 1 as the header column keys.
 */
export function convertCellsToSheetRows(cells: CryptPadSheetGrid): SheetRow[] {
  const rowMap = new Map<number, Map<string, string>>();

  for (const [cellRef, val] of Object.entries(cells)) {
    const parsed = parseCellRef(cellRef);
    if (!parsed) continue;

    const { col, row } = parsed;
    if (!rowMap.has(row)) {
      rowMap.set(row, new Map());
    }
    rowMap.get(row)!.set(col, val);
  }

  if (rowMap.size === 0) {
    return [];
  }

  const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const headerRowIdx = sortedRowIndices[0];
  const headerCols = rowMap.get(headerRowIdx)!;

  // Header mappings: colLetter -> headerName
  const colToHeaderName = new Map<string, string>();
  for (const [col, colName] of headerCols.entries()) {
    const trimmed = colName.trim();
    if (trimmed.length > 0) {
      colToHeaderName.set(col, trimmed);
    }
  }

  const resultRows: SheetRow[] = [];

  for (const rowIdx of sortedRowIndices) {
    if (rowIdx === headerRowIdx) continue; // Skip header row

    const rowCells = rowMap.get(rowIdx)!;
    const sheetRow: SheetRow = {};

    for (const [col, headerName] of colToHeaderName.entries()) {
      sheetRow[headerName] = rowCells.get(col) ?? '';
    }

    // Support 'var' as key column header for consumers expecting .key
    if (sheetRow.var !== undefined && sheetRow.key === undefined) {
      sheetRow.key = sheetRow.var;
    }

    // Only include rows that have at least one non-empty value
    const hasValue = Object.values(sheetRow).some(
      (v) => typeof v === 'string' && v.trim().length > 0,
    );
    if (hasValue) {
      resultRows.push(sheetRow);
    }
  }

  return resultRows;
}

/**
 * Builds a cell reference string such as "A1" or "Sheet1!B2".
 */
export function buildCellRef(
  sheetName: string | undefined,
  col: string | number,
  row: number,
): string {
  const colLetter = typeof col === 'number' ? colIndexToLetter(col) : col.toUpperCase();
  return sheetName ? `${sheetName}!${colLetter}${row}` : `${colLetter}${row}`;
}

/**
 * Groups a flat grid of cell coordinates by sheet tab name.
 * Cells without an explicit sheet prefix are assigned to `defaultSheet` (defaults to 'Sheet1').
 */
export function groupCellsBySheet(
  cells: CryptPadSheetGrid,
  defaultSheet = 'Sheet1',
): Record<string, CryptPadSheetGrid> {
  const result: Record<string, CryptPadSheetGrid> = {};

  for (const [cellRef, val] of Object.entries(cells)) {
    const parsed = parseCellRef(cellRef);
    if (!parsed) continue;

    const sheetName =
      parsed.sheet && parsed.sheet.trim().length > 0 ? parsed.sheet.trim() : defaultSheet;
    if (!result[sheetName]) {
      result[sheetName] = {};
    }

    const flatRef = `${parsed.col}${parsed.row}`;
    result[sheetName][flatRef] = val;
  }

  // Ensure at least defaultSheet exists if input was non-empty
  if (Object.keys(result).length === 0 && Object.keys(cells).length > 0) {
    result[defaultSheet] = { ...cells };
  }

  return result;
}

/**
 * Converts a grid of cell references into a dictionary of SheetRow arrays keyed by sheet tab name.
 */
export function convertCellsToMultiSheetRows(
  cells: CryptPadSheetGrid,
  defaultSheet = 'Sheet1',
): Record<string, SheetRow[]> {
  const grouped = groupCellsBySheet(cells, defaultSheet);
  const result: Record<string, SheetRow[]> = {};

  for (const [sheetName, sheetGrid] of Object.entries(grouped)) {
    result[sheetName] = convertCellsToSheetRows(sheetGrid);
  }

  return result;
}

export interface OnlyOfficeCellUpdate {
  sheet?: string;
  col: string | number;
  row: number;
  value: string;
}

/**
 * Encodes a single cell update record into OnlyOffice binary format (0x08 prefix + UTF-16LE string).
 */
export function encodeOnlyOfficeCellRecord(cellRef: string, value: string): Buffer {
  const refBuf = Buffer.from(cellRef, 'utf16le');
  const valBuf = Buffer.from(value, 'utf16le');

  const refHeader = Buffer.alloc(5);
  refHeader[0] = 0x08;
  refHeader.writeUInt32LE(refBuf.length, 1);

  const valHeader = Buffer.alloc(5);
  valHeader[0] = 0x08;
  valHeader.writeUInt32LE(valBuf.length, 1);

  return Buffer.concat([refHeader, refBuf, valHeader, valBuf]);
}

/**
 * Formats a list of cell updates into an OnlyOffice change transaction JSON string.
 */
export function buildOnlyOfficeChangePayload(updates: OnlyOfficeCellUpdate[]): string {
  const records = updates.map((u) => {
    const colStr = typeof u.col === 'number' ? colIndexToLetter(u.col) : u.col.toUpperCase();
    const sheetPrefix = u.sheet && u.sheet.trim().length > 0 ? `${u.sheet.trim()}!` : '';
    const ref = `${sheetPrefix}${colStr}${u.row}`;
    return encodeOnlyOfficeCellRecord(ref, u.value);
  });

  const fullPayload = Buffer.concat(records);
  const base64Data = fullPayload.toString('base64');
  const changeEntry = `asc_1;${base64Data}`;

  return JSON.stringify({
    changes: [
      {
        change: changeEntry,
      },
    ],
  });
}
