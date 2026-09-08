// @ts-nocheck
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

      // Format 1: direct object
      if (parsed?.content?.channel && typeof parsed.content.channel === 'string') {
        return parsed.content.channel;
      }

      // Format 2: ChainPad message [type, patchContent, lastMsgHash]
      // Where patchContent is either [operations, parentHash] (ChainPad PATCH/CHECKPOINT)
      // or legacy/mock operations array [[offset, len, jsonStr]]
      if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
        const candidateContainers = [
          parsed[1],
          Array.isArray(parsed[1][0]) ? parsed[1][0] : null,
        ].filter(Boolean) as unknown[][];

        for (const container of candidateContainers) {
          for (const item of container) {
            if (Array.isArray(item)) {
              for (const elem of item) {
                if (typeof elem === 'string' && elem.includes('channel')) {
                  try {
                    const inner = JSON.parse(elem);
                    if (inner?.content?.channel && typeof inner.content.channel === 'string') {
                      return inner.content.channel;
                    }
                  } catch {
                    // Continue to regex
                  }
                }
              }
            }
          }
        }
      }

      // Format 3: Regex match for 32-hex channel ID in payload (handles escaped or raw JSON)
      if (typeof raw === 'string') {
        const match = raw.match(/\\?"channel\\?"\s*:\s*\\?"([a-f0-9]{32})\\?"/i);
        if (match) {
          return match[1];
        }
      }
    } catch {
      if (typeof raw === 'string') {
        const match = raw.match(/\\?"channel\\?"\s*:\s*\\?"([a-f0-9]{32})\\?"/i);
        if (match) {
          return match[1];
        }
      }
    }
  }

  return null;
}

/**
 * Parses OnlyOffice incremental binary change records into cell coordinates and text values.
 *
 * ### OnlyOffice Document Server / CryptPad Binary Protocol Specification
 * OnlyOffice collaborative document changes are broadcast over Netflux real-time channels.
 * Each message contains a `changes` array of transaction objects.
 *
 * Inside each transaction, `change` is formatted with a command prefix followed by base64 binary:
 * `asc_<version>;<base64_binary_payload>` (e.g., `asc_1;<base64>`).
 *
 * The decoded binary stream represents OnlyOffice document AST changes:
 * - Text and identifiers are serialized as length-prefixed UTF-16LE strings.
 * - The marker byte `0x08` indicates the start of a UTF-16LE string entry, followed by a 4-byte
 *   little-endian unsigned integer (`UInt32LE`) specifying byte length, followed by the UTF-16LE payload.
 *
 * Two layout patterns are supported:
 * - **Case A (Explicit coordinate reference)**: A string matching coordinate syntax (e.g. `A1` or `sheet!B2`)
 *   followed closely (within 30 bytes) by another `0x08` marker holding the cell's UTF-16LE text value.
 * - **Case B (Binary header coordinates)**: Header packets store 0-based column index `c1` at byte 14
 *   and row index `r1` at byte 18 as `UInt32LE`, followed by string values starting at byte 40+.
 *
 * @param rtMessages - Decrypted raw change messages retrieved from the OnlyOffice RT Netflux channel.
 * @returns A mapping of cell coordinates (`A1` or `sheet!A1`) to cell text values.
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
              // OnlyOffice stores r1, c1, r2, c2 at bytes 15..30 when magic header is 0x01291001 (AscCH.historyitem_Cell_ChangeValue)
              if (buf.length >= 31 && buf.readUInt32BE(4) === 0x01291001 && buf[14] === 0x01) {
                try {
                  const c1 = buf.readUInt32LE(15);
                  const r1 = buf.readUInt32LE(19);
                  if (r1 < 100000 && c1 < 200) {
                    const colLetter = colIndexToLetter(c1);
                    const cellRef = `${colLetter}${r1 + 1}`;
                    if (str.trim().length > 0 && !str.includes('!')) {
                      cells[cellRef] = str;
                    }
                  }
                } catch {
                  // Ignore
                }
              } else if (buf.length >= 30 && i >= 40 && buf.readUInt32BE(4) === 0) {
                try {
                  const c1 = buf.readUInt32LE(14);
                  const r1 = buf.readUInt32LE(18);
                  if (r1 < 100000 && c1 < 200) {
                    const colLetter = colIndexToLetter(c1);
                    const cellRef = `${colLetter}${r1 + 1}`;
                    if (str.trim().length > 0 && !str.includes('!')) {
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
 * Encodes a single cell update record into OnlyOffice binary format:
 * - Native AscCH.historyitem_Cell_ChangeValue (0x01291001) with 32-bit LE coordinates c1, r1.
 * - Explicit UTF-16LE cell reference tags for backward-compatibility and multi-sheet routing.
 */
export function encodeOnlyOfficeCellRecord(cellRef: string, value: string, sheetId = 6): Buffer {
  let c1 = 0;
  let r1 = 0;
  const parsed = parseCellRef(cellRef);
  if (parsed) {
    c1 = letterToColIndex(parsed.col);
    r1 = Math.max(0, parsed.row - 1);
  }

  const valBuf = Buffer.from(value, 'utf16le');
  const L = valBuf.length;

  const tail = Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03, 0x02, 0x01, 0x02, 0x00, 0x03, 0x01]);

  const body = Buffer.alloc(60 + L + tail.length);
  body.writeUInt32BE(0x01291001, 0); // 4..7 (historyitem_Cell_ChangeValue)
  body.writeUInt32LE(0x02, 4); // 8..11
  body[8] = 0x30 + (sheetId % 10); // 12 (ascii sheet ID digit)
  body[9] = 0x00; // 13
  body[10] = 0x01; // 14
  body.writeUInt32LE(c1, 11); // 15..18 (c1)
  body.writeUInt32LE(r1, 15); // 19..22 (r1)
  body.writeUInt32LE(c1, 19); // 23..26 (c2)
  body.writeUInt32LE(r1, 23); // 27..30 (r2)
  body[27] = 0x00; // 31
  body.writeUInt32LE(0x27 + L, 28); // 32..35
  body[32] = 0x00; // 36
  body[33] = 0x02; // 37
  body[34] = r1 & 0xff; // 38
  body[35] = 0x01; // 39
  body[36] = 0x02; // 40
  body[37] = c1 & 0xff; // 41
  body[38] = 0x02; // 42
  body[39] = 0x09; // 43
  body[40] = 0x03; // 44
  body.writeUInt32LE(0x1a + L, 41); // 45..48
  body[45] = 0x00; // 49
  body[46] = 0x00; // 50
  body[47] = 0x01; // 51
  body[48] = 0x09; // 52
  body[49] = 0x01; // 53
  body.writeUInt32LE(0x0d + L, 50); // 54..57
  body[54] = 0x00; // 58
  body[55] = 0x08; // 59 (UTF-16LE string tag)
  body.writeUInt32LE(L, 56); // 60..63 (string byte length)
  valBuf.copy(body, 60); // 64..64+L
  tail.copy(body, 60 + L);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  const nativeBuf = Buffer.concat([header, body]);

  const refBuf = Buffer.from(cellRef, 'utf16le');
  const refHeader = Buffer.alloc(5);
  refHeader[0] = 0x08;
  refHeader.writeUInt32LE(refBuf.length, 1);

  const valHeader = Buffer.alloc(5);
  valHeader[0] = 0x08;
  valHeader.writeUInt32LE(valBuf.length, 1);

  return Buffer.concat([nativeBuf, refHeader, refBuf, valHeader, valBuf]);
}

/**
 * Formats a list of cell updates into an OnlyOffice change transaction JSON string.
 */
export function buildOnlyOfficeChangePayload(updates: OnlyOfficeCellUpdate[]): string {
  const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');

  const records = updates.map((u) => {
    const colStr = typeof u.col === 'number' ? colIndexToLetter(u.col) : u.col.toUpperCase();
    const sheetPrefix = u.sheet && u.sheet.trim().length > 0 ? `${u.sheet.trim()}!` : '';
    const ref = `${sheetPrefix}${colStr}${u.row}`;
    return encodeOnlyOfficeCellRecord(ref, u.value);
  });

  const fullPayload = Buffer.concat([txOpen, ...records]);
  const base64Data = fullPayload.toString('base64');
  const changeEntry = `asc_1;${base64Data}`;

  return JSON.stringify({
    type: 'saveChanges',
    changes: [
      {
        change: changeEntry,
      },
    ],
    startSaveChanges: true,
    endSaveChanges: true,
    isExcel: true,
  });
}
