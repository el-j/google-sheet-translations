import crypto from 'node:crypto';
import nacl from 'tweetnacl';

export interface ParsedCryptPadUrl {
  origin: string;
  version: number;
  app: string;
  mode: 'edit' | 'view';
  seed: string;
  isPasswordProtected: boolean;
  cleanUrl: string;
}

export interface DerivedCryptPadKeys {
  channelHex: string;
  cryptKey: Uint8Array;
}

/** Decodes CryptPad base64 string (which may have '-' instead of '/' and no padding). */
export function b64Decode(str: string): Uint8Array {
  let s = str.replace(/-/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return new Uint8Array(Buffer.from(s, 'base64'));
}

/** Encodes bytes to standard base64 string. */
export function b64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/** Decodes UTF-8 string to Uint8Array. */
export function decodeUTF8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'utf8'));
}

/** Encodes Uint8Array to UTF-8 string. */
export function encodeUTF8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Parses a CryptPad URL and extracts the app type, mode, seed, and whether it requires a password.
 * Format: https://{host}/{app}/#/{version}/{app}/{mode}/{seed}[/p/]
 */
export function parsePadUrl(url: string): ParsedCryptPadUrl {
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    throw new Error(`Invalid CryptPad URL: "${url}"`);
  }

  const hash = urlObj.hash;
  const match = hash.match(/#\/(\d+)\/([^/]+)\/([^/]+)\/([^/]+)(\/p\/)?/);
  if (!match) {
    throw new Error(
      `Unsupported CryptPad URL format: "${url}". Expected "#/<version>/<app>/<mode>/<seed>[/p/]"`,
    );
  }

  const [, versionStr, app, modeRaw, seed, passwordFlag] = match;
  const mode = modeRaw === 'edit' ? 'edit' : 'view';
  const isPasswordProtected = Boolean(passwordFlag);

  return {
    origin: urlObj.origin,
    version: parseInt(versionStr, 10),
    app,
    mode,
    seed,
    isPasswordProtected,
    cleanUrl: `${urlObj.origin}/${app}/#/${versionStr}/${app}/${mode}/${seed}${isPasswordProtected ? '/p/' : ''}`,
  };
}

/**
 * Derives the Netflux channel ID (hex string) and symmetric encryption key (32 bytes)
 * from a CryptPad pad seed and optional password according to CryptPad's createEditCryptor2 / createViewCryptor2 protocol.
 */
export function deriveCryptPadKeys(seedStr: string, password?: string): DerivedCryptPadKeys {
  const seed = b64Decode(seedStr);

  if (!password) {
    // Standard unpassworded derivation
    const hash = crypto.createHash('sha512').update(seed).digest();
    const seed2 = hash.subarray(32, 64);
    const hash2 = crypto.createHash('sha512').update(seed2).digest();

    return {
      channelHex: hash2.subarray(0, 16).toString('hex'),
      cryptKey: new Uint8Array(hash2.subarray(16, 48)),
    };
  }

  // Password-protected derivation
  const pwBytes = decodeUTF8(password);
  const superSeed1 = Buffer.concat([Buffer.from(pwBytes), Buffer.from(seed)]);
  const hash1 = crypto.createHash('sha512').update(superSeed1).digest();

  const seed2 = hash1.subarray(32, 64);
  const superSeed2 = Buffer.concat([Buffer.from(pwBytes), Buffer.from(seed2)]);
  const hash2 = crypto.createHash('sha512').update(superSeed2).digest();

  return {
    channelHex: hash2.subarray(0, 16).toString('hex'),
    cryptKey: new Uint8Array(hash2.subarray(16, 48)),
  };
}

/**
 * Decrypts an encrypted CryptPad message payload formatted as `nonce|ciphertext`
 * (or optionally prefixed with a 64-byte Ed25519 signature from historyKeeper).
 */
export function decryptCryptPadPayload(payload: string, cryptKey: Uint8Array): string | null {
  if (!payload || typeof payload !== 'string') {
    return null;
  }

  const candidates: string[] = [];

  if (payload.includes('|')) {
    candidates.push(payload);
  }

  // Check if there is an outer base64-encoded signature prefix
  const rawBytes = b64Decode(payload);
  if (rawBytes.length > 64) {
    const withoutSig = rawBytes.subarray(64);
    const strWithoutSig = encodeUTF8(withoutSig);
    if (strWithoutSig.includes('|')) {
      candidates.push(strWithoutSig);
    }
  }

  for (const cand of candidates) {
    const parts = cand.split('|');
    if (parts.length === 2) {
      try {
        const nonce = b64Decode(parts[0]);
        const cipher = b64Decode(parts[1]);
        if (nonce.length === 24) {
          const opened = nacl.secretbox.open(cipher, nonce, cryptKey);
          if (opened) {
            return encodeUTF8(opened);
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
  }

  return null;
}
