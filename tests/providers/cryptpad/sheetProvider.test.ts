import { describe, expect, it, vi } from 'vitest';
import nacl from 'tweetnacl';
import {
  parsePadUrl,
  deriveCryptPadKeys,
  decryptCryptPadPayload,
  b64Encode,
  decodeUTF8,
} from '../../../src/providers/cryptpad/crypto';
import {
  colIndexToLetter,
  letterToColIndex,
  parseCellRef,
  extractOnlyOfficeChannelId,
  convertCellsToSheetRows,
} from '../../../src/providers/cryptpad/sheetParser';
import {
  createCryptPadSheetInputProvider,
  CRYPTPAD_SHEET_INPUT_CAPABILITIES,
} from '../../../src/providers/cryptpad/sheetProvider';
import { CryptPadClient } from '../../../src/providers/cryptpad/client';

describe('cryptpad sheet crypto & url parsing', () => {
  const testUrlWithPassword =
    'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/';
  const testUrlNoPassword = 'https://cryptpad.fr/sheet/#/2/sheet/view/eVLpL7jMyV8n-lz0aR-N2Qbz/';

  it('correctly parses password-protected CryptPad sheet URLs', () => {
    const parsed = parsePadUrl(testUrlWithPassword);
    expect(parsed.origin).toBe('https://cryptpad.fr');
    expect(parsed.app).toBe('sheet');
    expect(parsed.mode).toBe('edit');
    expect(parsed.seed).toBe('1Mkpyf9OK3nMCVcMVp2WssQ1');
    expect(parsed.isPasswordProtected).toBe(true);
  });

  it('correctly parses unpassworded CryptPad view URLs', () => {
    const parsed = parsePadUrl(testUrlNoPassword);
    expect(parsed.origin).toBe('https://cryptpad.fr');
    expect(parsed.app).toBe('sheet');
    expect(parsed.mode).toBe('view');
    expect(parsed.seed).toBe('eVLpL7jMyV8n-lz0aR-N2Qbz');
    expect(parsed.isPasswordProtected).toBe(false);
  });

  it('throws on malformed CryptPad URLs', () => {
    expect(() => parsePadUrl('not-a-url')).toThrow('Invalid CryptPad URL');
    expect(() => parsePadUrl('https://cryptpad.fr/sheet/invalid')).toThrow(
      'Unsupported CryptPad URL format',
    );
  });

  it('derives correct channelHex and cryptKey from seed and password', () => {
    const derived = deriveCryptPadKeys('1Mkpyf9OK3nMCVcMVp2WssQ1', 'test-test');
    expect(derived.channelHex).toBe('89f46131586f54a4e0aef4feeb4ed932');
    expect(Buffer.from(derived.cryptKey).toString('hex')).toBe(
      '41d4ec035a385dbf5f40064caa6867fd18a62d3d34a6fc2427f523521470a11c',
    );
  });

  it('derives consistent keys without password', () => {
    const derived1 = deriveCryptPadKeys('eVLpL7jMyV8n-lz0aR-N2Qbz');
    const derived2 = deriveCryptPadKeys('eVLpL7jMyV8n-lz0aR-N2Qbz');
    expect(derived1.channelHex).toBe(derived2.channelHex);
    expect(derived1.cryptKey).toEqual(derived2.cryptKey);
  });

  it('encrypts and decrypts payload roundtrip', () => {
    const key = nacl.randomBytes(32);
    const plaintext = JSON.stringify({ hello: 'cryptpad', timestamp: 12345678 });
    const nonce = nacl.randomBytes(24);
    const cipher = nacl.secretbox(decodeUTF8(plaintext), nonce, key);
    const encStr = `${b64Encode(nonce)}|${b64Encode(cipher)}`;

    const decrypted = decryptCryptPadPayload(encStr, key);
    expect(decrypted).toBe(plaintext);
  });

  it('decrypts payload prefixed with dummy 64-byte Ed25519 signature', () => {
    const key = nacl.randomBytes(32);
    const plaintext = 'signed message content';
    const nonce = nacl.randomBytes(24);
    const cipher = nacl.secretbox(decodeUTF8(plaintext), nonce, key);
    const innerEncStr = `${b64Encode(nonce)}|${b64Encode(cipher)}`;

    // Prefix with 64 bytes of signature
    const sig = nacl.randomBytes(64);
    const innerBytes = Buffer.from(innerEncStr, 'utf8');
    const signedPayload = Buffer.concat([Buffer.from(sig), innerBytes]);
    const payloadWithSig = signedPayload.toString('base64');

    const decrypted = decryptCryptPadPayload(payloadWithSig, key);
    expect(decrypted).toBe(plaintext);
  });

  it('returns null on corrupted ciphertext', () => {
    const key = nacl.randomBytes(32);
    expect(decryptCryptPadPayload('corrupted|data', key)).toBeNull();
    expect(decryptCryptPadPayload('', key)).toBeNull();
  });
});

describe('cryptpad sheet coordinate and cell parser', () => {
  it('converts column index to letter and back', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(1)).toBe('B');
    expect(colIndexToLetter(25)).toBe('Z');
    expect(colIndexToLetter(26)).toBe('AA');

    expect(letterToColIndex('A')).toBe(0);
    expect(letterToColIndex('B')).toBe(1);
    expect(letterToColIndex('Z')).toBe(25);
    expect(letterToColIndex('AA')).toBe(26);
  });

  it('parses cell references correctly', () => {
    expect(parseCellRef('A1')).toEqual({ sheet: undefined, col: 'A', row: 1 });
    expect(parseCellRef('Sheet1!B2')).toEqual({ sheet: 'Sheet1', col: 'B', row: 2 });
    expect(parseCellRef('$C$10')).toEqual({ sheet: undefined, col: 'C', row: 10 });
    expect(parseCellRef('invalid')).toBeNull();
  });

  it('extracts OnlyOffice channel ID from metadata messages', () => {
    const metadataMessages = [
      JSON.stringify([
        2,
        [
          [
            0,
            0,
            JSON.stringify({
              content: { channel: 'e880999db565837bc7368946ab6351b2', ctime: 1788798772987 },
            }),
          ],
        ],
      ]),
    ];

    const channelId = extractOnlyOfficeChannelId(metadataMessages);
    expect(channelId).toBe('e880999db565837bc7368946ab6351b2');
  });

  it('converts cells grid into structured SheetRow array', () => {
    const cells = {
      A1: 'key',
      B1: 'en',
      C1: 'de',
      A2: 'login.title',
      B2: 'Welcome',
      C2: 'Willkommen',
      A3: 'btn.submit',
      B3: 'Submit',
      C3: 'Absenden',
    };

    const rows = convertCellsToSheetRows(cells);
    expect(rows).toEqual([
      { key: 'login.title', en: 'Welcome', de: 'Willkommen' },
      { key: 'btn.submit', en: 'Submit', de: 'Absenden' },
    ]);
  });
});

describe('cryptpad sheet input provider', () => {
  it('declares proper capabilities', () => {
    expect(CRYPTPAD_SHEET_INPUT_CAPABILITIES.readTables).toBe(true);
    expect(CRYPTPAD_SHEET_INPUT_CAPABILITIES.publicReadNoAuth).toBe(false);
    expect(CRYPTPAD_SHEET_INPUT_CAPABILITIES.writeTables).toBe(false);
  });

  it('throws when no sources or url provided', () => {
    expect(() => createCryptPadSheetInputProvider({})).toThrow(
      'CryptPad Sheet provider requires at least one source',
    );
  });

  it('reads tables using CryptPadClient mock', async () => {
    const mockFetchSheetData = vi.fn().mockResolvedValue({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      cells: { A1: 'key', B1: 'en', A2: 'greeting', B2: 'Hello' },
      rows: [{ key: 'greeting', en: 'Hello' }],
      metadata: { app: 'sheet', mode: 'edit', channelId: 'chan123' },
    });

    vi.spyOn(CryptPadClient.prototype, 'fetchSheetData').mockImplementation(mockFetchSheetData);

    const provider = createCryptPadSheetInputProvider({
      url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
      password: 'test-test',
      tableName: 'i18n',
    });

    const result = await provider.readTables({});
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].tableName).toBe('i18n');
    expect(result.tables[0].rows).toEqual([{ key: 'greeting', en: 'Hello' }]);
    expect(result.tables[0].metadata.provider).toBe('cryptpad-sheet');
  });

  it('CryptPadClient throws if password is required but not provided', () => {
    expect(
      () =>
        new CryptPadClient({
          url: 'https://cryptpad.fr/sheet/#/2/sheet/edit/1Mkpyf9OK3nMCVcMVp2WssQ1/p/',
        }),
    ).toThrow('is password protected, but no password was provided');
  });
});
