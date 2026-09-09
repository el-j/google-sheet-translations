import type { SheetRow } from '../../types';
import { ChainPad } from './chainpad';

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
 * Parses a cell reference into components: 'A1' -> { col: 'A', row: 1 },
 * 'Sheet1!B2' -> { sheet: 'Sheet1', col: 'B', row: 2 }.
 */
export function parseCellRef(cellRef: string): { sheet?: string; col: string; row: number } | null {
  const match = cellRef.match(/^(?:([^!]+)!)?\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return null;
  return {
    sheet: match[1],
    col: match[2].toUpperCase(),
    row: parseInt(match[3], 10),
  };
}

export interface OnlyOfficeMetadata {
  channelId: string | null;
  title: string | null;
  defaultTitle: string | null;
  userDoc?: Record<string, unknown>;
}

/**
 * Extracts the active OnlyOffice real-time collaboration channel ID and document
 * metadata from decrypted pad metadata messages.
 *
 * CryptPad metadata channels are governed by ChainPad (SmartJSONTransformer DAG).
 * Replaying the ChainPad log deterministically computes the true, latest document
 * state (userDoc.content.channel).
 */
export function extractOnlyOfficeMetadata(metadataMessages: string[]): OnlyOfficeMetadata {
  // Method 1: Reconstruct the true userDoc DAG using ChainPad SmartJSONTransformer
  try {
    const cp = ChainPad.create({
      patchTransformer: ChainPad.SmartJSONTransformer,
      logLevel: 0,
    });
    cp.start();
    for (let i = 0; i < metadataMessages.length; i++) {
      try {
        cp.message(metadataMessages[i]);
      } catch {
        // Skip unparseable message
      }
    }
    const userDocStr = cp.getUserDoc();
    if (userDocStr) {
      const userDoc = JSON.parse(userDocStr);
      const channel = userDoc?.content?.channel;
      if (channel && typeof channel === 'string') {
        return {
          channelId: channel,
          title: userDoc?.metadata?.title || null,
          defaultTitle: userDoc?.metadata?.defaultTitle || null,
          userDoc,
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // Method 2: Reverse chronological search through history messages
  for (let i = metadataMessages.length - 1; i >= 0; i--) {
    const raw = metadataMessages[i];
    try {
      const parsed = JSON.parse(raw);

      // Direct object
      if (parsed?.content?.channel && typeof parsed.content.channel === 'string') {
        return {
          channelId: parsed.content.channel,
          title: parsed.metadata?.title || null,
          defaultTitle: parsed.metadata?.defaultTitle || null,
          userDoc: parsed,
        };
      }

      // ChainPad message: [type, patchContent, lastMsgHash]
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
                      return {
                        channelId: inner.content.channel,
                        title: inner.metadata?.title || null,
                        defaultTitle: inner.metadata?.defaultTitle || null,
                        userDoc: inner,
                      };
                    }
                  } catch {}
                }
              }
            }
          }
        }

        // Check stringified patch
        const str = JSON.stringify(parsed[1]);
        const match = str.match(/"channel"\s*:\s*"([a-f0-9]{32})"/i);
        if (match) {
          return {
            channelId: match[1],
            title: null,
            defaultTitle: null,
          };
        }
      }
    } catch {
      if (typeof raw === 'string') {
        const match = raw.match(/\\?"channel\\?"\s*:\s*\\?"([a-f0-9]{32})\\?"/i);
        if (match) {
          return {
            channelId: match[1],
            title: null,
            defaultTitle: null,
          };
        }
      }
    }
  }

  return { channelId: null, title: null, defaultTitle: null };
}

/**
 * Extracts the most recently registered OnlyOffice real-time collaboration channel ID
 * from decrypted pad metadata messages.
 */
export function extractOnlyOfficeChannelId(metadataMessages: string[]): string | null {
  return extractOnlyOfficeMetadata(metadataMessages).channelId;
}

/**
 * Parses OnlyOffice incremental binary change records into cell coordinates and text values.
 * Supports dynamic sheet identifiers, tab additions, renames, and binary change frames.
 *
 * @param rtMessages - Decrypted raw change messages retrieved from the OnlyOffice RT Netflux channel.
 * @returns A mapping of cell coordinates (`A1` or `sheet!A1`) to cell text values.
 */
export function parseOnlyOfficeChanges(rtMessages: string[]): CryptPadSheetGrid {
  const cells: CryptPadSheetGrid = {};
  const sheetNames = new Map<string, string>(); // sheetId -> sheetName
  let defaultSheetId = '6';

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
        if (buf.length < 20) continue;

        const magic = buf.readUInt32BE(4);

        // Sheet rename: magic 0x012a1201 (AscCH.historyitem_Sheet_Rename)
        if (magic === 0x012a1201) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 2) {
            sheetNames.set(defaultSheetId, strings[1]);
          }
        }

        // Add sheet: magic 0x012b0100 (AscCH.historyitem_Sheet_Add)
        if (magic === 0x012b0100) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 2) {
            const name = strings[0];
            const id = strings[1];
            sheetNames.set(id, name);
          }
        }

        // Cell change: magic 0x01291001 (AscCH.historyitem_Cell_ChangeValue)
        if (magic === 0x01291001) {
          const sheetIdLen = buf.readUInt32LE(8);
          if (sheetIdLen > 0 && sheetIdLen < 200 && 12 + sheetIdLen + 17 <= buf.length) {
            const sheetIdStr = buf.subarray(12, 12 + sheetIdLen).toString('utf16le');
            const offsetAfterSheet = 12 + sheetIdLen;
            if (buf[offsetAfterSheet] === 0x01) {
              const c1 = buf.readUInt32LE(offsetAfterSheet + 1);
              const r1 = buf.readUInt32LE(offsetAfterSheet + 5);
              for (let k = offsetAfterSheet + 17; k < buf.length - 5; k++) {
                if (buf[k] === 0x08) {
                  const strLen = buf.readUInt32LE(k + 1);
                  if (strLen >= 0 && strLen < 100000 && k + 5 + strLen <= buf.length) {
                    const val = buf.subarray(k + 5, k + 5 + strLen).toString('utf16le');
                    const colLetter = colIndexToLetter(c1);
                    const tabName =
                      sheetNames.get(sheetIdStr) ||
                      (sheetIdStr === '6' ? sheetNames.get('6') || '' : '');
                    const sheetPrefix = tabName ? `${tabName}!` : '';
                    const cellRef = `${sheetPrefix}${colLetter}${r1 + 1}`;
                    cells[cellRef] = val;
                  }
                  break;
                }
              }
            }
          }
        }

        // Search for UTF-16LE string markers for legacy / Case A patterns
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
              } else if (buf.length >= 30 && i >= 40 && buf.readUInt32BE(4) === 0) {
                // Legacy Case B fallback for raw buffers where magic is 0
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
 * Extracts sheet name <-> sheet ID bidirectional mappings from OnlyOffice change messages.
 */
export function extractOnlyOfficeSheetIdMap(rtMessages: string[]): {
  nameToId: Record<string, string>;
  idToName: Record<string, string>;
} {
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};
  const defaultSheetId = '6';
  nameToId['Sheet1'] = defaultSheetId;
  idToName[defaultSheetId] = 'Sheet1';

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
        } catch {}
        const parts = changeStr.split(';');
        if (parts.length < 2) continue;
        const buf = Buffer.from(parts[1], 'base64');
        if (buf.length < 20) continue;
        const magic = buf.readUInt32BE(4);

        if (magic === 0x012a1201) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 2) {
            delete nameToId[idToName[defaultSheetId]];
            idToName[defaultSheetId] = strings[1];
            nameToId[strings[1]] = defaultSheetId;
          }
        }

        if (magic === 0x012b0100) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 2) {
            const name = strings[0];
            const id = strings[1];
            idToName[id] = name;
            nameToId[name] = id;
          }
        }
      }
    } catch {}
  }
  return { nameToId, idToName };
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
  sheetId?: string | number;
  col: string | number;
  row: number;
  value: string;
}

/**
 * Encodes a single cell update record into the native OnlyOffice binary format:
 * AscCH.historyitem_Cell_ChangeValue (magic 0x01291001) with 32-bit LE coordinates c1, r1.
 * Supports dynamic sheet ID identifiers (string or number).
 *
 * The returned buffer is a standalone, self-contained record ready to be base64-encoded
 * and placed as a single `changes` entry in an OnlyOffice `saveChanges` message.
 * Format: 4-byte LE record length + body bytes (magic, sheetId, coordinates, value).
 */
export function encodeOnlyOfficeCellRecord(
  cellRef: string,
  value: string,
  sheetId: string | number = 6,
): Buffer {
  let c1 = 0;
  let r1 = 0;
  const parsed = parseCellRef(cellRef);
  if (parsed) {
    c1 = letterToColIndex(parsed.col);
    r1 = Math.max(0, parsed.row - 1);
  }

  const valBuf = Buffer.from(value, 'utf16le');
  const L = valBuf.length;
  const sheetIdBuf = Buffer.from(String(sheetId), 'utf16le');
  const S = sheetIdBuf.length;

  const tail = Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03, 0x02, 0x01, 0x02, 0x00, 0x03, 0x01]);

  const body = Buffer.alloc(58 + S + L + tail.length);
  body.writeUInt32BE(0x01291001, 0); // 4..7 (historyitem_Cell_ChangeValue)
  body.writeUInt32LE(S, 4); // 8..11 (sheetId string byte length)
  sheetIdBuf.copy(body, 8); // 12 .. 12+S

  const offset = 8 + S;
  body[offset] = 0x01; // Flag
  body.writeUInt32LE(c1, offset + 1); // c1
  body.writeUInt32LE(r1, offset + 5); // r1
  body.writeUInt32LE(c1, offset + 9); // c2
  body.writeUInt32LE(r1, offset + 13); // r2
  body[offset + 17] = 0x00;
  body.writeUInt32LE(0x27 + L, offset + 18);
  body[offset + 22] = 0x00;
  body[offset + 23] = 0x02;
  body[offset + 24] = r1 & 0xff;
  body[offset + 25] = 0x01;
  body[offset + 26] = 0x02;
  body[offset + 27] = c1 & 0xff;
  body[offset + 28] = 0x02;
  body[offset + 29] = 0x09;
  body[offset + 30] = 0x03;
  body.writeUInt32LE(0x1a + L, offset + 31);
  body[offset + 35] = 0x00;
  body[offset + 36] = 0x00;
  body[offset + 37] = 0x01;
  body[offset + 38] = 0x09;
  body[offset + 39] = 0x01;
  body.writeUInt32LE(0x0d + L, offset + 40);
  body[offset + 44] = 0x00;
  body[offset + 45] = 0x08;
  body.writeUInt32LE(L, offset + 46);
  valBuf.copy(body, offset + 50);
  tail.copy(body, offset + 50 + L);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * Formats a list of cell updates into an OnlyOffice `saveChanges` message.
 *
 * ### OnlyOffice Real-Time Change Protocol
 * OnlyOffice broadcasts changes as a JSON `saveChanges` message with a `changes` array.
 * Each entry in `changes` is an independent document record:
 * - The first entry is always `txOpen` (transaction open marker, 14 bytes).
 * - Each subsequent entry is a single cell update record.
 *
 * Each `change` value is a JSON-encoded string of the format `"<byteLength>;<base64>"`
 * where `byteLength` is the binary buffer length and `<base64>` is the base64-encoded buffer.
 *
 * This matches the exact wire format used by real OnlyOffice collaborative sessions
 * and ensures CryptPad's OnlyOffice integration can parse each record independently.
 */
export function buildOnlyOfficeChangePayload(
  updates: OnlyOfficeCellUpdate[],
  defaultSheetId?: string | number,
): string {
  const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');
  const now = Date.now();

  const changeItems: Array<{ change: string; time: number }> = [];

  // First entry: transaction open marker
  changeItems.push({
    change: JSON.stringify(`${txOpen.length};${txOpen.toString('base64')}`),
    time: now,
  });

  // One changes entry per cell record
  for (const u of updates) {
    const colStr = typeof u.col === 'number' ? colIndexToLetter(u.col) : u.col.toUpperCase();
    const sheetPrefix = u.sheet && u.sheet.trim().length > 0 ? `${u.sheet.trim()}!` : '';
    const ref = `${sheetPrefix}${colStr}${u.row}`;
    const sid = u.sheetId ?? defaultSheetId ?? 6;
    const rec = encodeOnlyOfficeCellRecord(ref, u.value, sid);
    changeItems.push({
      change: JSON.stringify(`${rec.length};${rec.toString('base64')}`),
      time: now,
    });
  }

  return JSON.stringify({
    type: 'saveChanges',
    changes: changeItems,
    startSaveChanges: true,
    endSaveChanges: true,
    isExcel: true,
  });
}
