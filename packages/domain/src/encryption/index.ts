/**
 * Web Crypto API AES-GCM column encryption module.
 * Designed for encrypting sensitive fields (such as member contacts and individual giving amounts)
 * in offline SQLite storage using a key derived from the user's PIN or passphrase.
 */

export interface EncryptedPayload {
  readonly version: 1;
  readonly salt: string; // Base64 salt (16 bytes)
  readonly iv: string; // Base64 IV (12 bytes)
  readonly ciphertext: string; // Base64 ciphertext + GCM auth tag
}

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const ALGORITHM = 'AES-GCM';

function getCryptoSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (subtle) is not available in the current runtime environment.');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  throw new Error('Web Crypto API (getRandomValues) is not available.');
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32KB chunks prevent call stack limit and intermediate string explosion
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM CryptoKey from a user passphrase/PIN and salt using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getCryptoSubtle();
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = new Uint8Array(salt.buffer as ArrayBuffer, salt.byteOffset, salt.byteLength);

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string or serializable object into an EncryptedPayload.
 */
export async function encryptData(
  plainData: string | Record<string, unknown>,
  passphrase: string
): Promise<EncryptedPayload> {
  const subtle = getCryptoSubtle();
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);
  const text = typeof plainData === 'string' ? plainData : JSON.stringify(plainData);
  const encodedText = new TextEncoder().encode(text);

  const ivBuffer = new Uint8Array(iv.buffer as ArrayBuffer, iv.byteOffset, iv.byteLength);

  const encryptedBuffer = await subtle.encrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    encodedText
  );

  return {
    version: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuffer),
  };
}

/**
 * Decrypts an EncryptedPayload back into plaintext or parsed JSON.
 */
export async function decryptData(
  payload: EncryptedPayload,
  passphrase: string
): Promise<string> {
  if (payload.version !== 1) {
    throw new Error(`Unsupported encrypted payload version: ${payload.version}`);
  }

  const subtle = getCryptoSubtle();
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKey(passphrase, salt);

  const ivBuffer = new Uint8Array(iv.buffer as ArrayBuffer, iv.byteOffset, iv.byteLength);
  const ciphertextBuffer = new Uint8Array(ciphertext.buffer as ArrayBuffer, ciphertext.byteOffset, ciphertext.byteLength);

  const decryptedBuffer = await subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    ciphertextBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Serializes an EncryptedPayload to a single compact string (for storing in a SQLite text column).
 */
export function serializeEncryptedPayload(payload: EncryptedPayload): string {
  return `enc:v1:${payload.salt}:${payload.iv}:${payload.ciphertext}`;
}

/**
 * Deserializes an encrypted column string back to an EncryptedPayload.
 */
export function deserializeEncryptedPayload(serialized: string): EncryptedPayload {
  const parts = serialized.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Invalid serialized encrypted payload format.');
  }
  return {
    version: 1,
    salt: parts[2]!,
    iv: parts[3]!,
    ciphertext: parts[4]!,
  };
}
