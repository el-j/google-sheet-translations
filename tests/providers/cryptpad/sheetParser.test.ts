import { describe, expect, it } from 'vitest';
import {
  colIndexToLetter,
  parseCellRef,
  extractOnlyOfficeChannelId,
  extractOnlyOfficeMetadata,
  extractOnlyOfficeSheetIdMap,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  buildCellRef,
  groupCellsBySheet,
  convertCellsToMultiSheetRows,
  encodeOnlyOfficeCellRecord,
  encodeOnlyOfficeFormulaCellRecord,
  buildOnlyOfficeChangePayload,
  encodeOnlyOfficeSheetAddRecord,
  generateOnlyOfficeSheetId,
  buildOnlyOfficeSheetAddPayload,
} from '../../../src/providers/cryptpad/sheetParser';

describe('CryptPad sheetParser unit tests', () => {
  describe('column and coordinate utilities', () => {
    it('converts column index to column letter (single and double letters)', () => {
      expect(colIndexToLetter(0)).toBe('A');
      expect(colIndexToLetter(25)).toBe('Z');
      expect(colIndexToLetter(26)).toBe('AA');
      expect(colIndexToLetter(27)).toBe('AB');
    });

    it('parses valid cell references with and without sheet name', () => {
      expect(parseCellRef('A1')).toEqual({ sheet: undefined, col: 'A', row: 1 });
      expect(parseCellRef('common!B12')).toEqual({ sheet: 'common', col: 'B', row: 12 });
      expect(parseCellRef('Auth Sheet!AA99')).toEqual({
        sheet: 'Auth Sheet',
        col: 'AA',
        row: 99,
      });
    });

    it('returns null for invalid cell references', () => {
      expect(parseCellRef('invalid')).toBeNull();
      expect(parseCellRef('123')).toBeNull();
      expect(parseCellRef('')).toBeNull();
    });

    it('builds cell references with and without sheet name, numeric and letter columns', () => {
      expect(buildCellRef(undefined, 'A', 1)).toBe('A1');
      expect(buildCellRef(undefined, 0, 1)).toBe('A1');
      expect(buildCellRef('i18n', 'b', 5)).toBe('i18n!B5');
      expect(buildCellRef('i18n', 26, 10)).toBe('i18n!AA10');
    });
  });

  describe('extractOnlyOfficeChannelId', () => {
    it('extracts channel from Format 1 nested edit array', () => {
      const metadata = [
        JSON.stringify([1, [[0, 0, JSON.stringify({ content: { channel: 'channel-abc-123' } })]]]),
      ];
      expect(extractOnlyOfficeChannelId(metadata)).toBe('channel-abc-123');
    });

    it('extracts channel from Format 2 direct object', () => {
      const metadata = [JSON.stringify({ content: { channel: 'channel-format-2' } })];
      expect(extractOnlyOfficeChannelId(metadata)).toBe('channel-format-2');
    });

    it('handles malformed JSON and messages without channel gracefully', () => {
      expect(extractOnlyOfficeChannelId(['NOT_JSON', '{"other":"value"}'])).toBeNull();
      expect(extractOnlyOfficeChannelId([])).toBeNull();
      // Nested format with bad inner JSON
      const badInner = [JSON.stringify([1, [[0, 0, 'NOT_JSON']]])];
      expect(extractOnlyOfficeChannelId(badInner)).toBeNull();
    });

    it('returns the LAST registered channel when multiple registrations exist (append-only log)', () => {
      // Simulates initializeRtChannel() appending a new channel to the metadata history
      const metadata = [
        JSON.stringify({ content: { channel: 'aaaabbbbccccdddd0000111122223333' } }),
        JSON.stringify({ content: { channel: 'deadbeef00112233445566778899aabb' } }),
        JSON.stringify([
          2,
          [
            [[0, 0, JSON.stringify({ content: { channel: 'ffff0000111122223333444455556666' } })]],
            'hashA',
          ],
          'hashB',
        ]),
      ];
      expect(extractOnlyOfficeChannelId(metadata)).toBe('ffff0000111122223333444455556666');
    });
  });

  describe('parseOnlyOfficeChanges and binary decoding', () => {
    it('parses cell coordinates from native binary (Case B: coordinates in header)', () => {
      // The corrected encodeOnlyOfficeCellRecord produces native OnlyOffice binary
      // where coordinates are stored as 32-bit LE integers at bytes 15/19, NOT as
      // UTF-16LE string refs. Sheet prefix routing happens at the websocket message
      // level, not inside the binary record — so round-trip yields bare A1-style refs.
      const payload = buildOnlyOfficeChangePayload([
        { sheet: 'common', col: 'A', row: 1, value: 'var' },
        { sheet: 'common', col: 'B', row: 1, value: 'en' },
        { sheet: 'common', col: 'A', row: 2, value: 'save' },
        { sheet: 'common', col: 'B', row: 2, value: 'Save' },
      ]);

      const grid = parseOnlyOfficeChanges([payload]);
      // Case B decodes binary coordinates: c1=0→A, r1=0→row1 etc.
      expect(grid['A1']).toBe('var');
      expect(grid['B1']).toBe('en');
      expect(grid['A2']).toBe('save');
      expect(grid['B2']).toBe('Save');
    });

    it('parses Case B binary range coordinates in change header (r1, c1)', () => {
      // Build a buffer >= 80 bytes where bytes 14..29 store c1 (col) and r1 (row)
      const buf = Buffer.alloc(80);
      // c1 = 1 (B)
      buf.writeUInt32LE(1, 14);
      // r1 = 3 (Row 4)
      buf.writeUInt32LE(3, 18);

      // At byte 40, write 0x08 marker with UTF-16LE string "BinaryVal"
      buf[40] = 0x08;
      const strBuf = Buffer.from('BinaryVal', 'utf16le');
      buf.writeUInt32LE(strBuf.length, 41);
      strBuf.copy(buf, 45);

      const b64 = buf.toString('base64');
      const changeEntry = `asc_1;${b64}`;
      const rtMsg = JSON.stringify({
        changes: [{ change: changeEntry }],
      });

      const grid = parseOnlyOfficeChanges([rtMsg]);
      expect(grid['B4']).toBe('BinaryVal');
    });

    it('ignores unparseable messages or non-conforming changes', () => {
      expect(parseOnlyOfficeChanges(['NOT_JSON'])).toEqual({});
      expect(parseOnlyOfficeChanges([JSON.stringify({ changes: 'not-an-array' })])).toEqual({});
      expect(parseOnlyOfficeChanges([JSON.stringify({ changes: [{ change: 123 }] })])).toEqual({});
      expect(
        parseOnlyOfficeChanges([JSON.stringify({ changes: [{ change: 'no-semicolon' }] })]),
      ).toEqual({});
      expect(parseOnlyOfficeChanges([JSON.stringify({ changes: [{ change: 'asc_1;' }] })])).toEqual(
        {},
      );
    });
  });

  describe('convertCellsToSheetRows and multi-sheet grouping', () => {
    it('returns empty array when no valid cells provided', () => {
      expect(convertCellsToSheetRows({})).toEqual([]);
      expect(convertCellsToSheetRows({ invalid: 'val' })).toEqual([]);
    });

    it('converts grid to rows, preserving the real header name (no synthetic key alias)', () => {
      const grid = {
        A1: 'var',
        B1: 'en',
        C1: 'de',
        A2: 'btn.save',
        B2: 'Save',
        C2: 'Speichern',
      };

      const rows = convertCellsToSheetRows(grid);
      expect(rows).toHaveLength(1);
      // Matches google-spreadsheet's row.toObject() shape: only the sheet's
      // real header names appear, no synthetic 'key' alias for 'var'.
      expect(rows[0]).toEqual({
        var: 'btn.save',
        en: 'Save',
        de: 'Speichern',
      });
    });

    it('orders header columns by real spreadsheet position, not by edit-history insertion order', () => {
      // Simulates a header row whose cells were first written to CryptPad's
      // history out of left-to-right order (e.g. a locale column added in a
      // later push) — object key insertion order below is deliberately B, C,
      // then A, to verify the fix does not depend on Object.entries() order.
      const grid = {
        B1: 'en',
        C1: 'de',
        A1: 'var',
        A2: 'btn.save',
        B2: 'Save',
        C2: 'Speichern',
      };

      const rows = convertCellsToSheetRows(grid);
      expect(rows).toHaveLength(1);
      // Object.keys() must come back in real column order (var, en, de) so that
      // transformRowsToSheetData's `Object.keys(rows[0])[0]` picks the true key
      // column, matching how google-spreadsheet's row.toObject() always reflects
      // the sheet's real column order.
      expect(Object.keys(rows[0])).toEqual(['var', 'en', 'de']);
    });

    it('groups cells by sheet and converts to multi-sheet rows', () => {
      const grid = {
        'auth!A1': 'key',
        'auth!B1': 'en',
        'auth!A2': 'login',
        'auth!B2': 'Log in',
        'common!A1': 'var',
        'common!B1': 'en',
        'common!A2': 'cancel',
        'common!B2': 'Cancel',
        A1: 'key',
        B1: 'en',
        A2: 'default_key',
        B2: 'Default Value',
      };

      const multi = convertCellsToMultiSheetRows(grid, 'Main');
      expect(multi.auth).toBeDefined();
      expect(multi.common).toBeDefined();
      expect(multi.Main).toBeDefined();
      expect(multi.auth[0].key).toBe('login');
      expect(multi.common[0].var).toBe('cancel');
      expect(multi.Main[0].key).toBe('default_key');
    });

    it('falls back to defaultSheet when all cells have invalid coordinates (line 268 fallback)', () => {
      const invalidGrid = {
        'not-a-cell': 'foo',
      };
      const grouped = groupCellsBySheet(invalidGrid, 'FallbackSheet');
      expect(grouped.FallbackSheet).toEqual(invalidGrid);
    });

    it('handles sparse row cells with empty string fallback and ignores all-empty rows', () => {
      const sparseGrid = {
        A1: 'key',
        B1: 'en',
        C1: 'fr',
        // Row 2: missing col C
        A2: 'only_en',
        B2: 'Hello',
        // Row 3: only whitespace
        A3: '   ',
        B3: '',
      };
      const rows = convertCellsToSheetRows(sparseGrid);
      expect(rows).toHaveLength(1);
      expect(rows[0].fr).toBe('');
      expect(rows[0].en).toBe('Hello');
    });

    it('builds OnlyOffice change payload with correct per-record format', async () => {
      const { buildOnlyOfficeChangePayload } =
        await import('../../../src/providers/cryptpad/sheetParser');
      const updates = [
        { sheet: 'Settings', col: 'b', row: 5, value: 'dark' },
        { sheet: '', col: 0, row: 2, value: 'zero_col' },
        { sheet: '   ', col: 1, row: 3, value: 'trimmed_col' },
      ];
      const json = buildOnlyOfficeChangePayload(updates);
      const parsed = JSON.parse(json);

      // One txOpen + one entry per cell update
      expect(parsed.changes).toHaveLength(updates.length + 1);
      expect(parsed.type).toBe('saveChanges');
      expect(parsed.startSaveChanges).toBe(true);
      expect(parsed.endSaveChanges).toBe(true);

      // txOpen entry: format is JSON-encoded "<byteLen>;<base64>"
      const txOpenStr = JSON.parse(parsed.changes[0].change);
      expect(txOpenStr).toMatch(/^\d+;[A-Za-z0-9+/]+=*$/);

      // Cell entries: each is a separate JSON-encoded "<byteLen>;<base64>"
      for (let i = 1; i < parsed.changes.length; i++) {
        const cellStr = JSON.parse(parsed.changes[i].change);
        expect(cellStr).toMatch(/^\d+;[A-Za-z0-9+/]+=*$/);
      }
    });

    it('encodeOnlyOfficeCellRecord matches known-good reference binary for A1="Key"', () => {
      const ref = Buffer.from(
        'TQAAAAEpEAECAAAANgABAAAAAAAAAAAAAAAAAAAAAAAtAAAAAAIAAQIAAgkDIAAAAAAAAQkBEwAAAAAIBgAAAEsAZQB5AAEAAgADAgECAAMB',
        'base64',
      );
      const result = encodeOnlyOfficeCellRecord('A1', 'Key');
      expect(result.equals(ref)).toBe(true);
    });
  });

  describe('encodeOnlyOfficeSheetAddRecord / buildOnlyOfficeSheetAddPayload (issue #161)', () => {
    // Both reference binaries below were captured live from a real OnlyOffice
    // browser session adding a sheet tab on a CryptPad pad (see issue #161),
    // not guessed. Byte-for-byte match against two independent captures
    // (different name/sheetId/insertBefore values) is the strongest evidence
    // the field layout is correct, the same standard already applied to
    // encodeOnlyOfficeCellRecord above.
    it('matches a live-captured "add sheet" reference binary (insertBefore=1)', () => {
      const ref = Buffer.from(
        '51000000012b010000194700000000080c000000530068006500650074003200010002082400000037003200300034003200370038003900350036003500390034003700320039005f003300030104020105010601',
        'hex',
      );
      const result = encodeOnlyOfficeSheetAddRecord('Sheet2', '7204278956594729_3', 1);
      expect(result.equals(ref)).toBe(true);
    });

    it('matches a second live-captured "add sheet" reference binary (insertBefore=2, longer sheetId)', () => {
      const ref = Buffer.from(
        '53000000012b010000194900000000080c000000530068006500650074003200010002082600000037003200300034003200370038003900350036003500390034003700320039005f0031003200030104020205010601',
        'hex',
      );
      const result = encodeOnlyOfficeSheetAddRecord('Sheet2', '7204278956594729_12', 2);
      expect(result.equals(ref)).toBe(true);
    });

    it('rejects an out-of-range insertBeforeIndex instead of silently truncating it', () => {
      expect(() => encodeOnlyOfficeSheetAddRecord('Sheet2', 'id', -1)).toThrow(/insertBeforeIndex/);
      expect(() => encodeOnlyOfficeSheetAddRecord('Sheet2', 'id', 256)).toThrow(
        /insertBeforeIndex/,
      );
      expect(() => encodeOnlyOfficeSheetAddRecord('Sheet2', 'id', 1.5)).toThrow(
        /insertBeforeIndex/,
      );
    });

    it('generateOnlyOfficeSheetId produces unique, freeform id-shaped strings', () => {
      const a = generateOnlyOfficeSheetId();
      const b = generateOnlyOfficeSheetId();
      expect(a).toMatch(/^\d+_1$/);
      expect(b).toMatch(/^\d+_1$/);
      expect(a).not.toBe(b);
    });

    it('buildOnlyOfficeSheetAddPayload wraps the record in a saveChanges envelope with a txOpen marker first', () => {
      const payload = JSON.parse(buildOnlyOfficeSheetAddPayload('common', 'sheet-id-1', 0));
      expect(payload.type).toBe('saveChanges');
      expect(payload.startSaveChanges).toBe(true);
      expect(payload.endSaveChanges).toBe(true);
      expect(payload.isExcel).toBe(true);
      expect(payload.changes).toHaveLength(2);

      const txOpen = Buffer.from('0a0000000129000000ff00000000', 'hex');
      const firstChange = JSON.parse(payload.changes[0].change) as string;
      expect(firstChange).toBe(`${txOpen.length};${txOpen.toString('base64')}`);

      const rec = encodeOnlyOfficeSheetAddRecord('common', 'sheet-id-1', 0);
      const secondChange = JSON.parse(payload.changes[1].change) as string;
      expect(secondChange).toBe(`${rec.length};${rec.toString('base64')}`);
    });

    it('ignores empty and whitespace-only column headers in convertCellsToSheetRows', () => {
      const grid = {
        A1: 'key',
        B1: '   ',
        C1: 'en',
        A2: 'item.one',
        B2: 'ignored_val',
        C2: 'Item One',
      };
      const rows = convertCellsToSheetRows(grid);
      expect(rows).toEqual([{ key: 'item.one', en: 'Item One' }]);
    });

    it('skips binary cells containing exclamation mark or whitespace', () => {
      // Buffer >= 80 bytes with r1=0, c1=0 (A1)
      const buf = Buffer.alloc(80);
      buf.writeUInt32LE(0, 14);
      buf.writeUInt32LE(0, 18);

      buf[40] = 0x08;
      const strBuf = Buffer.from('Sheet1!Ref', 'utf16le');
      buf.writeUInt32LE(strBuf.length, 41);
      strBuf.copy(buf, 45);

      const changeStr = JSON.stringify(`10;${buf.toString('base64')}`);
      const rtMessages = [JSON.stringify({ changes: [{ change: changeStr }] })];

      const cells = parseOnlyOfficeChanges(rtMessages);
      expect(cells['A1']).toBeUndefined();
    });

    it('extractOnlyOfficeSheetIdMap correctly resolves sheet renames and additions', () => {
      // 1. Rename Sheet1 (id 6) -> translations (magic 0x012a1201)
      const renameBuf = Buffer.alloc(80);
      renameBuf.writeUInt32BE(0x012a1201, 4);
      // Write old name: "Sheet1"
      renameBuf[10] = 0x08;
      const oldBuf = Buffer.from('Sheet1', 'utf16le');
      renameBuf.writeUInt32LE(oldBuf.length, 11);
      oldBuf.copy(renameBuf, 15);
      // Write new name: "translations"
      const offset2 = 15 + oldBuf.length;
      renameBuf[offset2] = 0x08;
      const newBuf = Buffer.from('translations', 'utf16le');
      renameBuf.writeUInt32LE(newBuf.length, offset2 + 1);
      newBuf.copy(renameBuf, offset2 + 5);

      // 2. Add sheet "i18n" with id "8200316732097412_745" (magic 0x012b0100)
      const addBuf = Buffer.alloc(100);
      addBuf.writeUInt32BE(0x012b0100, 4);
      addBuf[10] = 0x08;
      const nameBuf = Buffer.from('i18n', 'utf16le');
      addBuf.writeUInt32LE(nameBuf.length, 11);
      nameBuf.copy(addBuf, 15);
      const offsetId = 15 + nameBuf.length;
      addBuf[offsetId] = 0x08;
      const idBuf = Buffer.from('8200316732097412_745', 'utf16le');
      addBuf.writeUInt32LE(idBuf.length, offsetId + 1);
      idBuf.copy(addBuf, offsetId + 5);

      const msg = JSON.stringify({
        changes: [
          { change: JSON.stringify(`10;${renameBuf.toString('base64')}`) },
          { change: JSON.stringify(`10;${addBuf.toString('base64')}`) },
        ],
      });

      const map = extractOnlyOfficeSheetIdMap([msg]);
      expect(map.nameToId['translations']).toBe('6');
      expect(map.nameToId['i18n']).toBe('8200316732097412_745');
      expect(map.idToName['6']).toBe('translations');
      expect(map.idToName['8200316732097412_745']).toBe('i18n');
    });

    it('encodeOnlyOfficeCellRecord encodes custom sheetId string', () => {
      const rec = encodeOnlyOfficeCellRecord('A1', 'TestVal', '8200316732097412_745');
      expect(rec.length).toBeGreaterThan(60);
      // Magic at offset 8 (4 bytes length + 4 bytes)
      expect(rec.readUInt32BE(4)).toBe(0x01291001);
      // SheetId len at offset 8
      const sheetIdLen = rec.readUInt32LE(8);
      const sheetIdStr = rec.subarray(12, 12 + sheetIdLen).toString('utf16le');
      expect(sheetIdStr).toBe('8200316732097412_745');
    });

    it('encodeOnlyOfficeFormulaCellRecord (issue #165) encodes the expected property layout', () => {
      // No live-captured reference binary exists yet for formula cells (see the encoder's
      // own doc comment) — this test structurally decodes the record against the property
      // scheme confirmed from ONLYOFFICE/sdkjs source, cross-checked against this module's
      // own byte-verified plain-text encoder (encodeOnlyOfficeCellRecord).
      const rec = encodeOnlyOfficeFormulaCellRecord('B1', '=i18n!B1', '6');

      // header (4-byte LE length) + magic
      expect(rec.readUInt32LE(0)).toBe(rec.length - 4);
      expect(rec.readUInt32BE(4)).toBe(0x01291001);

      const sheetIdLen = rec.readUInt32LE(8);
      expect(rec.subarray(12, 12 + sheetIdLen).toString('utf16le')).toBe('6');

      let offset = 12 + sheetIdLen;
      expect(rec[offset]).toBe(0x01); // range flag
      expect(rec.readUInt32LE(offset + 1)).toBe(1); // c1 = B
      expect(rec.readUInt32LE(offset + 5)).toBe(0); // r1 = row 1
      offset += 17;
      expect(rec[offset]).toBe(0x00);
      offset += 5; // skip cellSimpleDataLen

      // Row (id 0, SByte)
      expect(rec[offset]).toBe(0x00);
      expect(rec[offset + 1]).toBe(0x02);
      offset += 3;
      // Col (id 1, SByte)
      expect(rec[offset]).toBe(0x01);
      expect(rec[offset + 1]).toBe(0x02);
      offset += 3;
      // NewVal (id 2, Object, class byte 3 = UndoRedoData_CellValueData)
      expect(rec[offset]).toBe(0x02);
      expect(rec[offset + 1]).toBe(0x09);
      expect(rec[offset + 2]).toBe(0x03);
      offset += 7;

      // formula (id 0, String) — leading "=" stripped
      expect(rec[offset]).toBe(0x00);
      expect(rec[offset + 1]).toBe(0x08);
      const fLen = rec.readUInt32LE(offset + 2);
      const formulaStr = rec.subarray(offset + 6, offset + 6 + fLen).toString('utf16le');
      expect(formulaStr).toBe('i18n!B1');
      offset += 6 + fLen;

      // value (id 1, Object, class byte 1 = CCellValue)
      expect(rec[offset]).toBe(0x01);
      expect(rec[offset + 1]).toBe(0x09);
      expect(rec[offset + 2]).toBe(0x01);
      offset += 7;

      // text: Null, multiText: Null, number: Null, type: SByte(0)
      expect(rec.subarray(offset, offset + 9)).toEqual(
        Buffer.from([0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x03, 0x02, 0x00]),
      );
      offset += 9;

      // formulaRef: Null, ca: Undefined
      expect(rec.subarray(offset, offset + 4)).toEqual(Buffer.from([0x02, 0x00, 0x03, 0x01]));
      offset += 4;

      expect(offset).toBe(rec.length);
    });

    it('encodeOnlyOfficeFormulaCellRecord strips a leading "=" the same way with or without it', () => {
      const withEquals = encodeOnlyOfficeFormulaCellRecord('A1', '=i18n!A1', '6');
      const withoutEquals = encodeOnlyOfficeFormulaCellRecord('A1', 'i18n!A1', '6');
      expect(withEquals).toEqual(withoutEquals);
    });

    it('buildOnlyOfficeChangePayload dispatches to the formula encoder when `formula` is set (issue #165)', () => {
      const payload = buildOnlyOfficeChangePayload([
        { sheet: 'common', sheetId: '6', col: 'B', row: 1, formula: 'i18n!B1' },
      ]);
      const parsed = JSON.parse(payload);
      const cellChange = JSON.parse(parsed.changes[1].change);
      const buf = Buffer.from(cellChange.split(';')[1], 'base64');
      expect(buf.readUInt32BE(4)).toBe(0x01291001);
      expect(buf).toEqual(encodeOnlyOfficeFormulaCellRecord('B1', 'i18n!B1', '6'));
    });

    it('buildOnlyOfficeChangePayload respects custom sheetId', () => {
      const payload = buildOnlyOfficeChangePayload(
        [{ col: 'A', row: 1, value: 'Hello', sheetId: 'custom_sheet_id' }],
        'fallback_id',
      );
      const parsed = JSON.parse(payload);
      expect(parsed.changes.length).toBe(2); // txOpen + cell
      const cellChange = JSON.parse(parsed.changes[1].change);
      const b64 = cellChange.split(';')[1];
      const buf = Buffer.from(b64, 'base64');
      const sheetIdLen = buf.readUInt32LE(8);
      const sheetIdStr = buf.subarray(12, 12 + sheetIdLen).toString('utf16le');
      expect(sheetIdStr).toBe('custom_sheet_id');
    });
  });
});
