// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  colIndexToLetter,
  parseCellRef,
  extractOnlyOfficeChannelId,
  parseOnlyOfficeChanges,
  convertCellsToSheetRows,
  buildCellRef,
  groupCellsBySheet,
  convertCellsToMultiSheetRows,
  encodeOnlyOfficeCellRecord,
  buildOnlyOfficeChangePayload,
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
  });

  describe('parseOnlyOfficeChanges and binary decoding', () => {
    it('parses Case A explicit cell coordinates with sheet prefix', () => {
      const payload = buildOnlyOfficeChangePayload([
        { sheet: 'common', col: 'A', row: 1, value: 'var' },
        { sheet: 'common', col: 'B', row: 1, value: 'en' },
        { sheet: 'common', col: 'A', row: 2, value: 'save' },
        { sheet: 'common', col: 'B', row: 2, value: 'Save' },
      ]);

      const grid = parseOnlyOfficeChanges([payload]);
      expect(grid['common!A1']).toBe('var');
      expect(grid['common!B1']).toBe('en');
      expect(grid['common!A2']).toBe('save');
      expect(grid['common!B2']).toBe('Save');
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

    it('converts grid to rows and auto-aliases var to key', () => {
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
      expect(rows[0]).toEqual({
        var: 'btn.save',
        key: 'btn.save',
        en: 'Save',
        de: 'Speichern',
      });
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

    it('builds OnlyOffice change payload with string columns and sheet prefixes', async () => {
      const { buildOnlyOfficeChangePayload } =
        await import('../../../src/providers/cryptpad/sheetParser');
      const json = buildOnlyOfficeChangePayload([
        { sheet: 'Settings', col: 'b', row: 5, value: 'dark' },
      ]);
      const parsed = JSON.parse(json);
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.changes[0].change.startsWith('asc_1;')).toBe(true);
    });
  });
});
