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
    try {
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
    } finally {
      // ChainPad.start() schedules a recurring setTimeout sync loop that never
      // clears itself; without aborting it here the Node process (e.g. the
      // gst-cryptpad CLI) hangs indefinitely after the operation completes.
      cp.abort();
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

  // Pre-seed with full mapping discovered across the complete history so cell-change
  // records can be attributed correctly even if they appear before add/rename frames.
  const preMapped = extractOnlyOfficeSheetIdMap(rtMessages);
  for (const [id, name] of Object.entries(preMapped.idToName)) {
    sheetNames.set(id, name);
  }
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
            let sid = defaultSheetId;
            if (buf[7] === 0x01) {
              const sLen = buf.readUInt32LE(8);
              if (sLen > 0 && 12 + sLen <= buf.length) {
                sid = buf.subarray(12, 12 + sLen).toString('utf16le');
              }
            }
            sheetNames.set(sid, strings[1]);
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

        // Sheet delete: magic 0x012b0200 (AscCH.historyitem_Sheet_Delete)
        if (magic === 0x012b0200) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 1) {
            const deletedId = strings[0];
            const deletedName = sheetNames.get(deletedId);
            sheetNames.delete(deletedId);
            if (deletedName) {
              const prefix = `${deletedName}!`;
              for (const key of Object.keys(cells)) {
                if (key.startsWith(prefix)) {
                  delete cells[key];
                }
              }
            }
            if (deletedId === '6') {
              for (const key of Object.keys(cells)) {
                if (!key.includes('!') || key.startsWith('Sheet1!')) {
                  delete cells[key];
                }
              }
            }
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
                      sheetNames.get(sheetIdStr) && sheetNames.get(sheetIdStr) !== 'Sheet1'
                        ? sheetNames.get(sheetIdStr)
                        : '';
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
            let sid = defaultSheetId;
            if (buf[7] === 0x01) {
              const sLen = buf.readUInt32LE(8);
              if (sLen > 0 && 12 + sLen <= buf.length) {
                sid = buf.subarray(12, 12 + sLen).toString('utf16le');
              }
            }
            const oldName = idToName[sid] || strings[0];
            delete nameToId[oldName];
            idToName[sid] = strings[1];
            nameToId[strings[1]] = sid;
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

        if (magic === 0x012b0200) {
          const strings: string[] = [];
          for (let j = 0; j < buf.length - 4; j++) {
            if (buf[j] === 0x08) {
              const len = buf.readUInt32LE(j + 1);
              if (len > 0 && j + 5 + len <= buf.length) {
                strings.push(buf.subarray(j + 5, j + 5 + len).toString('utf16le'));
              }
            }
          }
          if (strings.length >= 1) {
            const id = strings[0];
            const name = idToName[id];
            delete idToName[id];
            if (name) delete nameToId[name];
            if (id === defaultSheetId) {
              delete nameToId['Sheet1'];
            }
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

  // Header mappings: colLetter -> headerName, ordered by real spreadsheet column
  // position (A, B, C, ...) rather than by the order header cells happened to
  // appear while replaying the pad's edit history — the two can differ (e.g. a
  // locale column added in a later push), and `transformRowsToSheetData`
  // (src/core/rowTransformer.ts) picks the key column via `Object.keys(rows[0])[0]`,
  // so getting this order wrong silently picks the wrong key column.
  const orderedCols = Array.from(headerCols.entries()).sort(
    ([colA], [colB]) => letterToColIndex(colA) - letterToColIndex(colB),
  );
  const colToHeaderName = new Map<string, string>();
  for (const [col, colName] of orderedCols) {
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
  /** Literal cell text. Mutually exclusive with `formula` — exactly one must be set. */
  value?: string;
  /** Formula text (with or without a leading "="), e.g. "i18n!B1" or "=i18n!B1".
   *  Mutually exclusive with `value` — exactly one must be set. See
   *  {@link encodeOnlyOfficeFormulaCellRecord}. */
  formula?: string;
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
 * Encodes a single FORMULA cell update record into the native OnlyOffice binary format:
 * the same `AscCH.historyitem_Cell_ChangeValue` (magic 0x01291001) history item used for
 * plain-text cells — confirmed from ONLYOFFICE/sdkjs source (`cell/model/Workbook.js`
 * `setValue`/`setFormulaTemplate`, `cell/model/UndoRedo.js` `UndoRedoData_CellValueData`)
 * that OnlyOffice does NOT use a separate history item for formulas; only the `NewVal`
 * object's `formula` property differs (a UTF-16LE string instead of the Null marker).
 *
 * Layout derived by decoding this module's own byte-verified plain-text encoder
 * ({@link encodeOnlyOfficeCellRecord}) against the sdkjs-confirmed property-ID scheme —
 * every offset below was cross-checked against real, already-tested reference bytes:
 *
 * ```
 * UndoRedoData_CellSimpleData (Row=0, Col=1, NewVal=2)
 *   Row: SByte(r1&0xff)
 *   Col: SByte(c1&0xff)
 *   NewVal -> UndoRedoData_CellValueData (class byte 3) (formula=0, value=1, formulaRef=2, ca=3)
 *     formula: String(f)        <- the formula text, WITHOUT a leading "="
 *     value -> CCellValue (class byte 1) (text=0, multiText=1, number=2, type=3)
 *       text: Null, multiText: Null, number: Null, type: SByte(0) [CellValueType.Number]
 *       (a freshly-authored formula has no cached result yet — OnlyOffice's own recalc
 *       engine computes and syncs the cached value once the client evaluates the formula;
 *       this matches `Cell.prototype.cleanText()`, called synchronously before the record
 *       is built in `setFormulaTemplate`)
 *     formulaRef: Null
 *     ca: Undefined (matches the literal-cell reference bytes, which use Undefined here
 *       too rather than a Boolean default)
 * ```
 *
 * NOT yet independently verified against a real captured formula-cell record from a live
 * OnlyOffice session (unlike {@link encodeOnlyOfficeCellRecord} and
 * {@link encodeOnlyOfficeSheetAddRecord}, which both have byte-exact reference captures)
 * — see issue #165's own risk note about attempting formula encoding without a real
 * reference binary. Treat with appropriate caution until cross-checked against a live
 * capture.
 *
 * @param cellRef - Target cell, e.g. "A1" or "Sheet1!B2".
 * @param formula - Formula text, with or without a leading "=" (stripped either way,
 *   matching sdkjs's own `val[0] == "="` handling in `Workbook.js`).
 * @param sheetId - Target sheet's internal OnlyOffice sheet ID.
 */
export function encodeOnlyOfficeFormulaCellRecord(
  cellRef: string,
  formula: string,
  sheetId: string | number = 6,
): Buffer {
  let c1 = 0;
  let r1 = 0;
  const parsed = parseCellRef(cellRef);
  if (parsed) {
    c1 = letterToColIndex(parsed.col);
    r1 = Math.max(0, parsed.row - 1);
  }

  const formulaText = formula.startsWith('=') ? formula.slice(1) : formula;
  const formulaBuf = Buffer.from(formulaText, 'utf16le');
  const F = formulaBuf.length;

  const sheetIdBuf = Buffer.from(String(sheetId), 'utf16le');
  const S = sheetIdBuf.length;

  // CCellValue body: text(Null,2) + multiText(Null,2) + number(Null,2) + type(SByte,3) = 9 bytes
  const ccellValueLen = 9;
  // CellValueData body: formula(2+4+F) + value-header(2+1+4)+ccellValueLen + formulaRef(2) + ca(2)
  const cellValueDataLen = 6 + F + 7 + ccellValueLen + 2 + 2; // = 0x1a + F
  // CellSimpleData body: Row(3) + Col(3) + NewVal-header(2+1+4) + cellValueDataLen
  const cellSimpleDataLen = 3 + 3 + 7 + cellValueDataLen; // = 0x27 + F

  const body = Buffer.alloc(8 + S + 1 + 16 + 1 + 4 + cellSimpleDataLen);
  body.writeUInt32BE(0x01291001, 0); // historyitem_Cell_ChangeValue
  body.writeUInt32LE(S, 4);
  sheetIdBuf.copy(body, 8);

  let offset = 8 + S;
  body[offset] = 0x01; // range flag
  body.writeUInt32LE(c1, offset + 1);
  body.writeUInt32LE(r1, offset + 5);
  body.writeUInt32LE(c1, offset + 9);
  body.writeUInt32LE(r1, offset + 13);
  offset += 17;
  body[offset] = 0x00;
  body.writeUInt32LE(cellSimpleDataLen, offset + 1);
  offset += 5;

  // Row (id 0, SByte)
  body[offset] = 0x00;
  body[offset + 1] = 0x02;
  body[offset + 2] = r1 & 0xff;
  offset += 3;

  // Col (id 1, SByte)
  body[offset] = 0x01;
  body[offset + 1] = 0x02;
  body[offset + 2] = c1 & 0xff;
  offset += 3;

  // NewVal (id 2, Object, class byte 3 = UndoRedoData_CellValueData)
  body[offset] = 0x02;
  body[offset + 1] = 0x09;
  body[offset + 2] = 0x03;
  body.writeUInt32LE(cellValueDataLen, offset + 3);
  offset += 7;

  // formula (id 0, String)
  body[offset] = 0x00;
  body[offset + 1] = 0x08;
  body.writeUInt32LE(F, offset + 2);
  formulaBuf.copy(body, offset + 6);
  offset += 6 + F;

  // value (id 1, Object, class byte 1 = CCellValue)
  body[offset] = 0x01;
  body[offset + 1] = 0x09;
  body[offset + 2] = 0x01;
  body.writeUInt32LE(ccellValueLen, offset + 3);
  offset += 7;

  // text (id 0, Null)
  body[offset] = 0x00;
  body[offset + 1] = 0x00;
  offset += 2;
  // multiText (id 1, Null)
  body[offset] = 0x01;
  body[offset + 1] = 0x00;
  offset += 2;
  // number (id 2, Null)
  body[offset] = 0x02;
  body[offset + 1] = 0x00;
  offset += 2;
  // type (id 3, SByte, CellValueType.Number = 0)
  body[offset] = 0x03;
  body[offset + 1] = 0x02;
  body[offset + 2] = 0x00;
  offset += 3;

  // formulaRef (id 2, Null)
  body[offset] = 0x02;
  body[offset + 1] = 0x00;
  offset += 2;
  // ca (id 3, Undefined)
  body[offset] = 0x03;
  body[offset + 1] = 0x01;
  offset += 2;

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
    // Address cells by row/column only and rely on sheetId for routing.
    // This avoids silent drops when a freshly added tab name is not fully materialized
    // client-side yet, while the sheetId is already authoritative.
    const ref = `${colStr}${u.row}`;
    const sid = u.sheetId ?? defaultSheetId ?? 6;
    const rec =
      u.formula !== undefined
        ? encodeOnlyOfficeFormulaCellRecord(ref, u.formula, sid)
        : encodeOnlyOfficeCellRecord(ref, u.value ?? '', sid);
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

/**
 * Encodes a single "add worksheet tab" record into the native OnlyOffice binary format:
 * AscCH.historyitem_Workbook_SheetAdd (real op code 1, from ONLYOFFICE/sdkjs
 * `cell/model/History.js` — not a guessed name), UndoRedoDataTypes.SheetAdd (25, from
 * `cell/model/UndoRedo.js`), with a generic property list matching
 * `UndoRedoData_SheetAdd.prototype.Properties` (`name`=0, `sheetidfrom`=1, `sheetid`=2,
 * `tableNames`=3, `insertBefore`=4, `opt_sheet`=5, `opt_sheetidToAdd`=6).
 *
 * Field layout was derived and verified against two independent real "add sheet"
 * records captured from a live OnlyOffice browser session on a CryptPad pad (see
 * issue #161): the body length implied by summing the fixed structural bytes plus the
 * two variable-length UTF-16LE strings matched the actual captured body length exactly
 * in both captures, and the `insertBefore` value matched the sheet's real insert
 * position in both.
 *
 * Each optional/unused property (`sheetidfrom`, `tableNames`, `opt_sheet`,
 * `opt_sheetidToAdd`) is written as its observed constant "null" marker byte — real
 * OnlyOffice clients only populate them for operations this encoder doesn't need to
 * perform (e.g. duplicating an existing sheet).
 *
 * @param name - Display name for the new sheet tab.
 * @param sheetId - Freeform internal sheet identifier (see {@link generateOnlyOfficeSheetId}).
 * @param insertBeforeIndex - 0-based tab position to insert at (0-255; real captures never
 *   exceeded a handful of tabs, and the wire format observed here only ever used one byte).
 */
export function encodeOnlyOfficeSheetAddRecord(
  name: string,
  sheetId: string,
  insertBeforeIndex: number,
): Buffer {
  if (!Number.isInteger(insertBeforeIndex) || insertBeforeIndex < 0 || insertBeforeIndex > 255) {
    throw new Error(
      `encodeOnlyOfficeSheetAddRecord: insertBeforeIndex must be an integer 0-255 (got ${insertBeforeIndex}).`,
    );
  }

  const nameBuf = Buffer.from(name, 'utf16le');
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBuf.length, 0);

  const sheetIdBuf = Buffer.from(sheetId, 'utf16le');
  const sheetIdLen = Buffer.alloc(4);
  sheetIdLen.writeUInt32LE(sheetIdBuf.length, 0);

  const propertyBlock = Buffer.concat([
    Buffer.from([0x00, 0x08]), // property 0 "name": type tag 0x08 = string
    nameLen,
    nameBuf,
    Buffer.from([0x01, 0x00]), // property 1 "sheetidfrom": unset (null marker)
    Buffer.from([0x02, 0x08]), // property 2 "sheetid": type tag 0x08 = string
    sheetIdLen,
    sheetIdBuf,
    Buffer.from([0x03, 0x01]), // property 3 "tableNames": unset (null marker)
    Buffer.from([0x04, 0x02, insertBeforeIndex]), // property 4 "insertBefore": type tag 0x02 = number
    Buffer.from([0x05, 0x01]), // property 5 "opt_sheet": unset (null marker)
    Buffer.from([0x06, 0x01]), // property 6 "opt_sheetidToAdd": unset (null marker)
  ]);

  const remainingLen = Buffer.alloc(4);
  remainingLen.writeUInt32LE(propertyBlock.length, 0);

  const magic = Buffer.alloc(4);
  magic.writeUInt32BE(0x012b0100, 0); // historyitem_Workbook_SheetAdd

  const body = Buffer.concat([
    magic,
    Buffer.from([0x00, 0x19]), // flag, UndoRedoDataTypes.SheetAdd (25)
    remainingLen,
    propertyBlock,
  ]);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * Generates a freeform internal sheetId string in the same shape real OnlyOffice
 * clients use (`<numeric prefix>_<counter>`, e.g. `"7204278956594729_12"`, per live
 * capture in #161). The exact value doesn't need to match any specific algorithm —
 * the field is a free-form string elsewhere in the protocol — only a value that's
 * unique within the pad.
 */
export function generateOnlyOfficeSheetId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}_1`;
}

/**
 * Formats a single "add worksheet tab" operation into an OnlyOffice `saveChanges`
 * message, structured the same way as {@link buildOnlyOfficeChangePayload}
 * (txOpen marker followed by one record).
 */
export function buildOnlyOfficeSheetAddPayload(
  name: string,
  sheetId: string,
  insertBeforeIndex: number,
): string {
  const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');
  const now = Date.now();
  const rec = encodeOnlyOfficeSheetAddRecord(name, sheetId, insertBeforeIndex);

  return JSON.stringify({
    type: 'saveChanges',
    changes: [
      { change: JSON.stringify(`${txOpen.length};${txOpen.toString('base64')}`), time: now },
      { change: JSON.stringify(`${rec.length};${rec.toString('base64')}`), time: now },
    ],
    startSaveChanges: true,
    endSaveChanges: true,
    isExcel: true,
  });
}

/**
 * Encodes a single "delete worksheet tab" record into the native OnlyOffice binary format:
 * AscCH.historyitem_Workbook_SheetDelete (magic 0x012b0200), UndoRedoDataTypes.SheetDelete (26, 0x1a).
 *
 * @param sheetId - Sheet identifier to delete.
 */
export function encodeOnlyOfficeSheetDeleteRecord(sheetId: string | number): Buffer {
  const sheetIdStr = String(sheetId);
  const sheetIdBuf = Buffer.from(sheetIdStr, 'utf16le');
  const idLen = sheetIdBuf.length;

  const propertyBlock = Buffer.concat([
    Buffer.from([0x00, 0x02, 0x01]),
    Buffer.from([0x01, 0x08]),
    Buffer.alloc(4),
    sheetIdBuf,
    Buffer.from([0x02, 0x09, 0xff, 0x00, 0x00]),
  ]);
  propertyBlock.writeUInt32LE(idLen, 5);

  const remainingLen = Buffer.alloc(4);
  remainingLen.writeUInt32LE(propertyBlock.length + 2, 0);

  const magic = Buffer.alloc(4);
  magic.writeUInt32BE(0x012b0200, 0);

  const body = Buffer.concat([magic, Buffer.from([0x00, 0x1a]), remainingLen, propertyBlock]);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length + 2, 0);
  return Buffer.concat([header, body]);
}

/**
 * Formats a single "delete worksheet tab" operation into an OnlyOffice `saveChanges`
 * message, structured the same way as {@link buildOnlyOfficeChangePayload}.
 */
export function buildOnlyOfficeSheetDeletePayload(sheetId: string | number): string {
  const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');
  const now = Date.now();
  const rec = encodeOnlyOfficeSheetDeleteRecord(sheetId);

  return JSON.stringify({
    type: 'saveChanges',
    changes: [
      { change: JSON.stringify(`${txOpen.length};${txOpen.toString('base64')}`), time: now },
      { change: JSON.stringify(`${rec.length};${rec.toString('base64')}`), time: now },
    ],
    startSaveChanges: true,
    endSaveChanges: true,
    isExcel: true,
  });
}

/**
 * Encodes a single "rename worksheet tab" record into the native OnlyOffice binary format:
 * AscCH.historyitem_Worksheet_Rename (magic 0x012a1201), UndoRedoDataTypes.FromTo (5),
 * matching `UndoRedoData_FromTo` (`from` = 0, `to` = 1, `copyRange` = 2, `sheetIdTo` = 3).
 *
 * @param sheetId - Internal sheet identifier to rename (e.g. '6').
 * @param oldName - Current name of the sheet tab (e.g. 'Sheet1').
 * @param newName - Desired new name for the tab (e.g. 'i18n').
 */
export function encodeOnlyOfficeSheetRenameRecord(
  sheetId: string | number,
  oldName: string,
  newName: string,
): Buffer {
  const sheetIdBuf = Buffer.from(String(sheetId), 'utf16le');
  const sheetIdLen = Buffer.alloc(4);
  sheetIdLen.writeUInt32LE(sheetIdBuf.length, 0);

  const oldNameBuf = Buffer.from(oldName, 'utf16le');
  const oldNameLen = Buffer.alloc(4);
  oldNameLen.writeUInt32LE(oldNameBuf.length, 0);

  const newNameBuf = Buffer.from(newName, 'utf16le');
  const newNameLen = Buffer.alloc(4);
  newNameLen.writeUInt32LE(newNameBuf.length, 0);

  const propertyBlock = Buffer.concat([
    Buffer.from([0x00, 0x08]), // property 0 "from": type tag 0x08 = string
    oldNameLen,
    oldNameBuf,
    Buffer.from([0x01, 0x08]), // property 1 "to": type tag 0x08 = string
    newNameLen,
    newNameBuf,
    Buffer.from([0x02, 0x00]), // property 2 "copyRange": unset (null marker)
    Buffer.from([0x03, 0x01]), // property 3 "sheetIdTo": unset (undefined marker)
  ]);

  const propertyLen = Buffer.alloc(4);
  propertyLen.writeUInt32LE(propertyBlock.length, 0);

  const magic = Buffer.from([0x01, 0x2a, 0x12, 0x01]); // AscCH.historyitem_Worksheet_Rename with sheetId

  const body = Buffer.concat([
    magic,
    sheetIdLen,
    sheetIdBuf,
    Buffer.from([0x00]), // oRange: null (false)
    Buffer.from([0x05]), // UndoRedoDataTypes.FromTo = 5
    propertyLen,
    propertyBlock,
  ]);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * Formats a single "rename worksheet tab" operation into an OnlyOffice `saveChanges`
 * message, structured the same way as {@link buildOnlyOfficeChangePayload}.
 */
export function buildOnlyOfficeSheetRenamePayload(
  sheetId: string | number,
  oldName: string,
  newName: string,
): string {
  const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');
  const now = Date.now();
  const rec = encodeOnlyOfficeSheetRenameRecord(sheetId, oldName, newName);

  return JSON.stringify({
    type: 'saveChanges',
    changes: [
      { change: JSON.stringify(`${txOpen.length};${txOpen.toString('base64')}`), time: now },
      { change: JSON.stringify(`${rec.length};${rec.toString('base64')}`), time: now },
    ],
    startSaveChanges: true,
    endSaveChanges: true,
    isExcel: true,
  });
}
