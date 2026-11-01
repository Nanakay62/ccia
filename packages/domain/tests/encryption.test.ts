import { describe, it, expect } from 'vitest';
import {
  encryptData,
  decryptData,
  serializeEncryptedPayload,
  deserializeEncryptedPayload,
} from '../src/encryption/index.js';

describe('Web Crypto AES-GCM Column Encryption Module', () => {
  const samplePassphrase = 'church-counter-pin-9876';

  it('encrypts and decrypts a plaintext string successfully', async () => {
    const secret = 'Confidential phone number: +233 24 000 1234';
    const payload = await encryptData(secret, samplePassphrase);

    expect(payload.version).toBe(1);
    expect(payload.salt).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.ciphertext).toBeTruthy();

    const decrypted = await decryptData(payload, samplePassphrase);
    expect(decrypted).toBe(secret);
  });

  it('encrypts and decrypts a structured object payload', async () => {
    const secretObj = {
      donor: 'Kwame Mensah',
      titheAmountPesewas: 50000,
      notes: 'Tithe for October',
    };

    const payload = await encryptData(secretObj, samplePassphrase);
    const decrypted = await decryptData(payload, samplePassphrase);
    expect(JSON.parse(decrypted)).toEqual(secretObj);
  });

  it('fails decryption if an incorrect passphrase is used', async () => {
    const payload = await encryptData('Tithe record', samplePassphrase);
    await expect(decryptData(payload, 'wrong-password')).rejects.toThrow();
  });

  it('serializes and deserializes cleanly for SQLite text column storage', async () => {
    const payload = await encryptData('Sensitive member record', samplePassphrase);
    const serialized = serializeEncryptedPayload(payload);

    expect(serialized.startsWith('enc:v1:')).toBe(true);

    const deserialized = deserializeEncryptedPayload(serialized);
    expect(deserialized).toEqual(payload);

    const decrypted = await decryptData(deserialized, samplePassphrase);
    expect(decrypted).toBe('Sensitive member record');
  });
});
