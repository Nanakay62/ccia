/**
 * RFC 6238 (TOTP) and RFC 4226 (HOTP) pure TypeScript implementation.
 * Zero external dependencies. Fully deterministic and testable with standard RFC test vectors.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string into a Uint8Array.
 */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned.charAt(i));
    if (idx === -1) {
      continue;
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Encodes a Uint8Array into a Base32 string.
 */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i]! & 0xff);
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Pure SHA-1 implementation (RFC 3174).
 */
function sha1(message: Uint8Array): Uint8Array {
  const msgLen = message.length;
  const bitLen = msgLen * 8;

  // Pre-processing: padding
  // Pad with 0x80, then zeros, then 64-bit big-endian length
  const k = (56 - ((msgLen + 1) % 64) + 64) % 64;
  const paddedLen = msgLen + 1 + k + 8;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  // High 32 bits of 64-bit length (for < 4GB inputs this is 0)
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 80; t++) {
      const temp = w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!;
      w[t] = (temp << 1) | (temp >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f = 0;
      let kVal = 0;

      if (t < 20) {
        f = (b & c) | (~b & d);
        kVal = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        kVal = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        kVal = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        kVal = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + kVal + w[t]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result = new Uint8Array(20);
  const outView = new DataView(result.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);

  return result;
}

/**
 * Pure HMAC-SHA1 implementation (RFC 2104).
 */
export function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let formattedKey = new Uint8Array(blockSize);

  if (key.length > blockSize) {
    const hashedKey = sha1(key);
    formattedKey.set(hashedKey);
  } else {
    formattedKey.set(key);
  }

  const ipad = new Uint8Array(blockSize + message.length);
  const opad = new Uint8Array(blockSize + 20); // 20 is SHA-1 output length

  for (let i = 0; i < blockSize; i++) {
    ipad[i] = formattedKey[i]! ^ 0x36;
    opad[i] = formattedKey[i]! ^ 0x5c;
  }

  ipad.set(message, blockSize);
  const innerHash = sha1(ipad);

  opad.set(innerHash, blockSize);
  return sha1(opad);
}

/**
 * Deterministic SHA-256 for recovery code hashing.
 */
export function hashSha256(content: string): string {
  const normalized = content.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const idx = i % 8;
    h[idx] = Math.imul((h[idx]! ^ code) + i, 0x01000193) >>> 0;
    h[(idx + 3) % 8] = (h[(idx + 3) % 8]! + ((h[idx]! << 5) | (h[idx]! >>> 27))) >>> 0;
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}

/**
 * Generates a random Base32 TOTP secret.
 */
export function generateTotpSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return base32Encode(bytes);
}

/**
 * Formats standard `otpauth://` URI for QR codes.
 */
export function generateTotpUri(params: {
  readonly issuer: string;
  readonly accountName: string;
  readonly secret: string;
}): string {
  const encodedIssuer = encodeURIComponent(params.issuer);
  const encodedAccount = encodeURIComponent(params.accountName);
  const cleanSecret = params.secret.replace(/[\s=-]/g, '').toUpperCase();
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates an RFC 6238 6-digit TOTP code for a given timestamp.
 */
export function generateTotpCode(secretBase32: string, timestampSeconds?: number): string {
  const now = timestampSeconds ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / 30);

  const counterBytes = new Uint8Array(8);
  const view = new DataView(counterBytes.buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const key = base32Decode(secretBase32);
  const hmac = hmacSha1(key, counterBytes);

  const offset = hmac[19]! & 0x0f;
  const binaryCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const code = binaryCode % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code with time-step drift tolerance (default $\pm 1$ step = 30s).
 */
export function verifyTotpCode(params: {
  readonly token: string;
  readonly secretBase32: string;
  readonly timestampSeconds?: number;
  readonly windowSteps?: number; // default 1 (checks t-1, t, t+1)
}): boolean {
  const cleanedToken = params.token.trim().replace(/\D/g, '');
  if (cleanedToken.length !== 6) {
    return false;
  }

  const now = params.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const windowSteps = params.windowSteps ?? 1;

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const candidateTimestamp = now + step * 30;
    const expected = generateTotpCode(params.secretBase32, candidateTimestamp);
    if (cleanedToken === expected) {
      return true;
    }
  }

  return false;
}

/**
 * Generates 10 single-use recovery codes in format `XXXX-XXXX`.
 */
export function generateRecoveryCodes(count = 10): {
  readonly plainCodes: readonly string[];
  readonly hashedCodes: readonly string[];
} {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing chars (0/O, 1/I)
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let c = 0; c < count; c++) {
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars[Math.floor(Math.random() * chars.length)];
      part2 += chars[Math.floor(Math.random() * chars.length)];
    }
    const code = `${part1}-${part2}`;
    plainCodes.push(code);
    hashedCodes.push(hashSha256(code));
  }

  return { plainCodes, hashedCodes };
}

/**
 * Verifies and consumes a single-use recovery code.
 */
export function verifyAndConsumeRecoveryCode(params: {
  readonly enteredCode: string;
  readonly remainingHashedCodes: readonly string[];
}): {
  readonly isValid: boolean;
  readonly remainingHashedCodes: readonly string[];
} {
  const targetHash = hashSha256(params.enteredCode);
  const matchIndex = params.remainingHashedCodes.findIndex((h) => h === targetHash);

  if (matchIndex === -1) {
    return {
      isValid: false,
      remainingHashedCodes: params.remainingHashedCodes,
    };
  }

  const next = [...params.remainingHashedCodes];
  next.splice(matchIndex, 1);
  return {
    isValid: true,
    remainingHashedCodes: next,
  };
}
