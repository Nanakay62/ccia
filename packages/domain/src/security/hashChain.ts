import type { JournalEntry } from '../ledger/types.js';

/**
 * Standard RFC 6234 SHA-256 implementation in pure TypeScript.
 * Deterministic, synchronous, zero-dependency, works identically in Browser, Node, and Vitest.
 */
export function sha256Hex(message: string): string {
  // Convert UTF-8 string to bytes
  const utf8: number[] = [];
  for (let i = 0; i < message.length; i++) {
    let charcode = message.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      // Surrogate pair
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  // Pre-processing: Padding
  const originalBitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length + 8) % 64 !== 0) {
    utf8.push(0);
  }

  // Append original length in bits as 64-bit big-endian integer
  const highBits = Math.floor(originalBitLength / 0x100000000);
  const lowBits = originalBitLength >>> 0;
  for (let i = 3; i >= 0; i--) utf8.push((highBits >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) utf8.push((lowBits >>> (i * 8)) & 0xff);

  // Initial hash values (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19)
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Round constants (first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311)
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const w = new Uint32Array(64);

  // Process each 512-bit (64-byte) chunk
  for (let chunk = 0; chunk < utf8.length; chunk += 64) {
    for (let t = 0; t < 16; t++) {
      const offset = chunk + t * 4;
      w[t] =
        ((utf8[offset]! & 0xff) << 24) |
        ((utf8[offset + 1]! & 0xff) << 16) |
        ((utf8[offset + 2]! & 0xff) << 8) |
        (utf8[offset + 3]! & 0xff);
    }
    for (let t = 16; t < 64; t++) {
      const s0 =
        ((w[t - 15]! >>> 7) | (w[t - 15]! << 25)) ^
        ((w[t - 15]! >>> 18) | (w[t - 15]! << 14)) ^
        (w[t - 15]! >>> 3);
      const s1 =
        ((w[t - 2]! >>> 17) | (w[t - 2]! << 15)) ^
        ((w[t - 2]! >>> 19) | (w[t - 2]! << 13)) ^
        (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Genesis previous hash for the first journal entry in the church ledger.
 * 64 zeros representing the start of the immutable ledger chain.
 */
export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface ChainedJournalEntry extends JournalEntry {
  readonly prevHash: string;
  readonly entryHash: string;
  readonly chainIndex: number;
}

export interface BrokenChainLink {
  readonly entryId: string;
  readonly documentNumber: string;
  readonly chainIndex: number;
  readonly expectedPrevHash: string;
  readonly actualPrevHash: string;
  readonly expectedEntryHash: string;
  readonly actualEntryHash: string;
  readonly errorType: 'HASH_MISMATCH' | 'BROKEN_LINK' | 'GENESIS_CORRUPTED';
  readonly explanation: string;
}

export interface HashChainVerificationResult {
  readonly isClean: boolean;
  readonly totalEntriesChecked: number;
  readonly verifiedChainLength: number;
  readonly brokenLinks: readonly BrokenChainLink[];
  readonly latestChainHash: string;
  readonly verificationTimestamp: string;
  readonly summary: string;
}

/**
 * Serializes the canonical deterministic payload of a journal entry for cryptographic hashing.
 * Invariant: sort lines by lineNumber, formats amounts deterministically.
 */
export function computeCanonicalEntryPayload(entry: JournalEntry, prevHash: string): string {
  const sortedLines = (entry.lines || [])
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map(
      (l) =>
        `${l.lineNumber}:${l.accountId}:${l.fundId}:${l.originalCurrency}:${l.originalAmount.toString()}:${l.exchangeRate}:${l.debitAmountGhs.toString()}:${l.creditAmountGhs.toString()}`
    )
    .join(';');

  return [
    `v1`,
    prevHash,
    entry.id,
    entry.branchId,
    entry.documentNumber,
    entry.entryDate,
    entry.entryType,
    (entry.lines || []).length.toString(),
    entry.totalDebitGhs.toString(),
    entry.totalCreditGhs.toString(),
    sortedLines,
  ].join('|');
}

/**
 * Computes the SHA-256 entry hash linking this entry to the previous entry hash.
 */
export function computeEntryHash(entry: JournalEntry, prevHash: string): string {
  const payload = computeCanonicalEntryPayload(entry, prevHash);
  return sha256Hex(payload);
}

/**
 * Chains an array of chronological journal entries together into an immutable hash chain.
 * Sorts entries deterministically by entryDate and documentNumber/createdAt.
 */
export function chainJournalEntries(entries: readonly JournalEntry[]): ChainedJournalEntry[] {
  const sorted = entries.slice().sort((a, b) => {
    if (a.entryDate !== b.entryDate) {
      return a.entryDate.localeCompare(b.entryDate);
    }
    const docCompare = (a.documentNumber || '').localeCompare(b.documentNumber || '');
    if (docCompare !== 0) return docCompare;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  let currentPrevHash = GENESIS_PREV_HASH;
  const chained: ChainedJournalEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const entryHash = computeEntryHash(entry, currentPrevHash);

    chained.push({
      ...entry,
      prevHash: currentPrevHash,
      entryHash,
      chainIndex: i,
    });

    currentPrevHash = entryHash;
  }

  return chained;
}

/**
 * Verifies an array of chained entries or recomputes and checks an existing chain.
 * If entries already have entryHash & prevHash, checks them; otherwise constructs chain and verifies continuity.
 */
export function verifyLedgerHashChain(
  entries: readonly (JournalEntry & { prevHash?: string | null; entryHash?: string | null; chainIndex?: number })[]
): HashChainVerificationResult {
  const timestamp = new Date().toISOString();

  if (entries.length === 0) {
    return {
      isClean: true,
      totalEntriesChecked: 0,
      verifiedChainLength: 0,
      brokenLinks: [],
      latestChainHash: GENESIS_PREV_HASH,
      verificationTimestamp: timestamp,
      summary: 'General ledger is empty. Hash chain is at genesis state (0 entries).',
    };
  }

  // Sort deterministically to verify chronological sequence
  const sorted = entries.slice().sort((a, b) => {
    if (a.entryDate !== b.entryDate) {
      return a.entryDate.localeCompare(b.entryDate);
    }
    const docCompare = (a.documentNumber || '').localeCompare(b.documentNumber || '');
    if (docCompare !== 0) return docCompare;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const brokenLinks: BrokenChainLink[] = [];
  let expectedPrevHash = GENESIS_PREV_HASH;
  let verifiedLength = 0;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    const chainIndex = entry.chainIndex ?? i;

    // Check genesis condition for first entry
    if (i === 0 && entry.prevHash && entry.prevHash !== GENESIS_PREV_HASH) {
      brokenLinks.push({
        entryId: entry.id,
        documentNumber: entry.documentNumber,
        chainIndex,
        expectedPrevHash: GENESIS_PREV_HASH,
        actualPrevHash: entry.prevHash,
        expectedEntryHash: computeEntryHash(entry, GENESIS_PREV_HASH),
        actualEntryHash: entry.entryHash || 'MISSING',
        errorType: 'GENESIS_CORRUPTED',
        explanation: `First entry ${entry.documentNumber} does not link to genesis hash. Expected ${GENESIS_PREV_HASH.slice(0, 12)}..., found ${entry.prevHash.slice(0, 12)}...`,
      });
    }

    // Check link continuity with prior entry
    if (entry.prevHash && entry.prevHash !== expectedPrevHash) {
      brokenLinks.push({
        entryId: entry.id,
        documentNumber: entry.documentNumber,
        chainIndex,
        expectedPrevHash,
        actualPrevHash: entry.prevHash,
        expectedEntryHash: computeEntryHash(entry, expectedPrevHash),
        actualEntryHash: entry.entryHash || 'MISSING',
        errorType: 'BROKEN_LINK',
        explanation: `Broken cryptographic link at entry ${entry.documentNumber}: previous hash does not match prior entry digest.`,
      });
    }

    // Check content integrity hash
    const expectedHash = computeEntryHash(entry, expectedPrevHash);
    if (entry.entryHash && entry.entryHash !== expectedHash) {
      brokenLinks.push({
        entryId: entry.id,
        documentNumber: entry.documentNumber,
        chainIndex,
        expectedPrevHash,
        actualPrevHash: entry.prevHash || expectedPrevHash,
        expectedEntryHash: expectedHash,
        actualEntryHash: entry.entryHash,
        errorType: 'HASH_MISMATCH',
        explanation: `Content tampering detected in ${entry.documentNumber}: payload SHA-256 digest does not match stored hash. Amounts, lines, or metadata were modified post-signing.`,
      });
    }

    // Advance chain with expected hash
    expectedPrevHash = expectedHash;
    verifiedLength++;
  }

  const isClean = brokenLinks.length === 0;

  return {
    isClean,
    totalEntriesChecked: sorted.length,
    verifiedChainLength: verifiedLength,
    brokenLinks,
    latestChainHash: expectedPrevHash,
    verificationTimestamp: timestamp,
    summary: isClean
      ? `Cryptographic Hash Chain Intact: All ${sorted.length} journal entries verified with unbroken SHA-256 links. Zero modifications or tampered records detected.`
      : `Tampering Detected: Found ${brokenLinks.length} broken cryptographic links or corrupted hashes in the general ledger.`,
  };
}
