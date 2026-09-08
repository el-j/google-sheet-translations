// @ts-nocheck
import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import {
  b64Decode,
  b64Encode,
  decodeUTF8,
  encodeUTF8,
  parsePadUrl,
  deriveCryptPadKeys,
  decryptCryptPadPayload,
  encryptCryptPadPayload,
} from '../../../src/providers/cryptpad/crypto';

describe('CryptPad crypto utilities', () => {
  describe('base64 and UTF-8 encoding', () => {
    it('handles standard and URL-safe base64 strings with padding variants', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 250, 255]);
      const standardB64 = b64Encode(data);
      expect(b64Decode(standardB64)).toEqual(data);

      // URL-safe '-' instead of '/'
      const urlSafeB64 = 'AQIDBAX6-w==';
      expect(b64Decode(urlSafeB64)).toEqual(data);

      // Unpadded variants (length % 4 == 2 or 3)
      const unpadded = standardB64.replace(/=+$/, '');
      expect(b64Decode(unpadded)).toEqual(data);
    });

    it('encodes and decodes UTF-8 strings accurately', () => {
      const testString = 'Hello 🌍 — Übersetzungen & special chars 日本語';
      const encoded = decodeUTF8(testString);
      expect(encodeUTF8(encoded)).toBe(testString);
    });
  });

  describe('parsePadUrl', () => {
    it('parses valid edit URL without password', () => {
      const url = 'https://cryptpad.fr/sheet/#/2/sheet/edit/J+EXDQVGUsSiBg5P1cun03BJ/';
      const parsed = parsePadUrl(url);

      expect(parsed.origin).toBe('https://cryptpad.fr');
      expect(parsed.version).toBe(2);
      expect(parsed.app).toBe('sheet');
      expect(parsed.mode).toBe('edit');
      expect(parsed.seed).toBe('J+EXDQVGUsSiBg5P1cun03BJ');
      expect(parsed.isPasswordProtected).toBe(false);
      expect(parsed.cleanUrl).toBe(
        'https://cryptpad.fr/sheet/#/2/sheet/edit/J+EXDQVGUsSiBg5P1cun03BJ',
      );
    });

    it('parses valid view URL with password flag /p/', () => {
      const url = 'https://custom.cryptpad.org/sheet/#/2/sheet/view/abc123seed/p/';
      const parsed = parsePadUrl(url);

      expect(parsed.origin).toBe('https://custom.cryptpad.org');
      expect(parsed.version).toBe(2);
      expect(parsed.app).toBe('sheet');
      expect(parsed.mode).toBe('view');
      expect(parsed.seed).toBe('abc123seed');
      expect(parsed.isPasswordProtected).toBe(true);
      expect(parsed.cleanUrl).toBe(
        'https://custom.cryptpad.org/sheet/#/2/sheet/view/abc123seed/p/',
      );
    });

    it('throws on non-URL string', () => {
      expect(() => parsePadUrl('not a valid url')).toThrow('Invalid CryptPad URL');
    });

    it('throws on URL without matching CryptPad hash structure', () => {
      expect(() => parsePadUrl('https://cryptpad.fr/sheet/')).toThrow(
        'Unsupported CryptPad URL format',
      );
      expect(() => parsePadUrl('https://cryptpad.fr/sheet/#/invalid-hash')).toThrow(
        'Unsupported CryptPad URL format',
      );
    });
  });

  describe('deriveCryptPadKeys', () => {
    const seed = 'J+EXDQVGUsSiBg5P1cun03BJ';

    it('derives deterministic channel hex and 32-byte key without password', () => {
      const keys1 = deriveCryptPadKeys(seed);
      const keys2 = deriveCryptPadKeys(seed);

      expect(keys1.channelHex).toHaveLength(32); // 16 bytes hex
      expect(keys1.cryptKey).toHaveLength(32);
      expect(keys1.channelHex).toBe(keys2.channelHex);
      expect(keys1.cryptKey).toEqual(keys2.cryptKey);
    });

    it('derives different deterministic channel and key with password', () => {
      const password = 'my-secret-password-123';
      const keysUnprotected = deriveCryptPadKeys(seed);
      const keysProtected = deriveCryptPadKeys(seed, password);

      expect(keysProtected.channelHex).toHaveLength(32);
      expect(keysProtected.cryptKey).toHaveLength(32);
      expect(keysProtected.channelHex).not.toBe(keysUnprotected.channelHex);
      expect(keysProtected.cryptKey).not.toEqual(keysUnprotected.cryptKey);

      // Verify idempotency
      const keysProtectedAgain = deriveCryptPadKeys(seed, password);
      expect(keysProtected.channelHex).toBe(keysProtectedAgain.channelHex);
      expect(keysProtected.cryptKey).toEqual(keysProtectedAgain.cryptKey);
    });
  });

  describe('encryptCryptPadPayload and decryptCryptPadPayload', () => {
    it('successfully round-trips encrypted payloads', () => {
      const key = nacl.randomBytes(32);
      const plaintext = JSON.stringify({ action: 'update', cells: { A1: 'Test Value' } });

      const ciphertext = encryptCryptPadPayload(plaintext, key);
      expect(ciphertext).toContain('|');

      const decrypted = decryptCryptPadPayload(ciphertext, key);
      expect(decrypted).toBe(plaintext);
    });

    it('decrypts payload prefixed with 64-byte Ed25519 signature', () => {
      const key = nacl.randomBytes(32);
      const plaintext = 'Inner message after historyKeeper signature';
      const innerCiphertext = encryptCryptPadPayload(plaintext, key);

      // Simulate outer signature prefix of 64 bytes
      const signatureBytes = new Uint8Array(64).fill(42);
      const innerBytes = decodeUTF8(innerCiphertext);
      const combined = Buffer.concat([Buffer.from(signatureBytes), Buffer.from(innerBytes)]);
      const signedPayload = b64Encode(new Uint8Array(combined));

      const decrypted = decryptCryptPadPayload(signedPayload, key);
      expect(decrypted).toBe(plaintext);
    });

    it('returns null for null, empty or non-string payloads', () => {
      const key = nacl.randomBytes(32);
      expect(decryptCryptPadPayload(null as any, key)).toBeNull();
      expect(decryptCryptPadPayload('' as any, key)).toBeNull();
      expect(decryptCryptPadPayload(123 as any, key)).toBeNull();
    });

    it('returns null for malformed or corrupted payloads', () => {
      const key = nacl.randomBytes(32);

      // No pipe separator and invalid base64
      expect(decryptCryptPadPayload('not a valid payload', key)).toBeNull();

      // Corrupted pipe format (3 parts)
      expect(decryptCryptPadPayload('a|b|c', key)).toBeNull();

      // Bad nonce length (< 24 bytes)
      const badNonce = b64Encode(new Uint8Array(10));
      const validCipher = b64Encode(new Uint8Array(32));
      expect(decryptCryptPadPayload(`${badNonce}|${validCipher}`, key)).toBeNull();

      // Wrong key fails decryption
      const validPlaintext = 'Confidential message';
      const cipher = encryptCryptPadPayload(validPlaintext, key);
      const wrongKey = nacl.randomBytes(32);
      expect(decryptCryptPadPayload(cipher, wrongKey)).toBeNull();

      // Exactly 64 bytes outer signature with no payload
      const exact64 = b64Encode(new Uint8Array(64));
      expect(decryptCryptPadPayload(exact64, key)).toBeNull();

      // > 64 bytes outer signature without pipe separator
      const over64NoPipe = b64Encode(
        Buffer.concat([Buffer.alloc(64), Buffer.from('no_pipe_here')]),
      );
      expect(decryptCryptPadPayload(over64NoPipe, key)).toBeNull();

      // Nonce with 25 bytes
      const nonce25 = b64Encode(new Uint8Array(25));
      expect(decryptCryptPadPayload(`${nonce25}|${validCipher}`, key)).toBeNull();
    });

    it('decodes UTF-8 with multi-byte characters and parses multi-digit URL versions', () => {
      const key = nacl.randomBytes(32);
      const utf8Text = 'こんにちは 🌍 世界';
      const enc = encodeUTF8(decodeUTF8(utf8Text));
      expect(enc).toBe(utf8Text);

      const parsedMultiDigit = parsePadUrl(
        'https://cryptpad.fr/sheet/#/12/sheet/edit/abcdef1234567890/p/',
      );
      expect(parsedMultiDigit.version).toBe(12);
    });
  });
});
