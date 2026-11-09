import { encryptData, decryptData } from '../encryption/index.js';
import { diagnoseLedger } from '../doctor/index.js';
import type {
  Account,
  Fund,
  AccountingPeriod,
  ExchangeRate,
  JournalEntry,
} from '../ledger/types.js';
import type { EncryptedBackupBundle, BackupMetadata } from './types.js';

export interface BackupDataPayload {
  readonly branchId: string;
  readonly branchName: string;
  readonly exportedAt: string;
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly periods: readonly AccountingPeriod[];
  readonly exchangeRates: readonly ExchangeRate[];
  readonly entries: readonly JournalEntry[];
}

export interface RestoreResult {
  readonly success: boolean;
  readonly metadata: BackupMetadata;
  readonly data: BackupDataPayload;
  readonly isTrialBalanceHealthy: boolean;
  readonly summary: string;
}

async function computeSecureChecksum(str: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return `sha256-${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `chk-${Math.abs(hash).toString(16)}`;
}

function verifyLegacyChecksum(str: string, expected: string): boolean {
  if (expected.startsWith('chk-')) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `chk-${Math.abs(hash).toString(16)}` === expected;
  }
  return false;
}

function serializeWithBigInt(data: unknown): string {
  const hadBigIntToJSON = Object.prototype.hasOwnProperty.call(BigInt.prototype, 'toJSON') ||
    Boolean((BigInt.prototype as any).toJSON);
  const originalBigIntToJSON = (BigInt.prototype as any).toJSON;
  if (hadBigIntToJSON) {
    delete (BigInt.prototype as any).toJSON;
  }

  try {
    return JSON.stringify(data, (_key, value) => {
      if (typeof value === 'bigint') {
        return `${value.toString()}n`;
      }
      return value;
    });
  } finally {
    if (hadBigIntToJSON && originalBigIntToJSON) {
      (BigInt.prototype as any).toJSON = originalBigIntToJSON;
    }
  }
}

function parseWithBigInt<T>(jsonStr: string): T {
  return JSON.parse(jsonStr, (_key, value) => {
    if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as T;
}

/**
 * Creates an encrypted backup bundle using the Treasurer's passphrase.
 */
export async function createEncryptedBackup(params: {
  branchId: string;
  branchName: string;
  exportedBy: string;
  passphrase: string;
  accounts: readonly Account[];
  funds: readonly Fund[];
  periods: readonly AccountingPeriod[];
  exchangeRates: readonly ExchangeRate[];
  entries: readonly JournalEntry[];
}): Promise<EncryptedBackupBundle> {
  const payload: BackupDataPayload = {
    branchId: params.branchId,
    branchName: params.branchName,
    exportedAt: new Date().toISOString(),
    accounts: params.accounts,
    funds: params.funds,
    periods: params.periods,
    exchangeRates: params.exchangeRates,
    entries: params.entries,
  };

  const jsonStr = serializeWithBigInt(payload);
  const checksum = await computeSecureChecksum(jsonStr);

  const encrypted = await encryptData(jsonStr, params.passphrase);

  const metadata: BackupMetadata = {
    version: 1,
    branchId: params.branchId,
    branchName: params.branchName,
    createdAt: payload.exportedAt,
    exportedBy: params.exportedBy,
    entryCount: params.entries.length,
    checksum,
  };

  return {
    metadata,
    salt: encrypted.salt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
}

/**
 * Restores and verifies an encrypted backup bundle.
 * Decrypts with passphrase, validates checksum, and runs the Trial Balance Doctor
 * to verify ledger integrity immediately upon restoration.
 */
export async function restoreEncryptedBackup(
  bundle: EncryptedBackupBundle,
  passphrase: string
): Promise<RestoreResult> {
  if (bundle.metadata.version !== 1) {
    throw new Error(`Unsupported backup bundle version: ${bundle.metadata.version}`);
  }

  // Decrypt
  const decryptedJson = await decryptData(
    {
      version: 1,
      salt: bundle.salt,
      iv: bundle.iv,
      ciphertext: bundle.ciphertext,
    },
    passphrase
  );

  const checksum = await computeSecureChecksum(decryptedJson);
  if (checksum !== bundle.metadata.checksum && !verifyLegacyChecksum(decryptedJson, bundle.metadata.checksum)) {
    throw new Error(`Checksum mismatch in backup file. File may be corrupted or tampered with.`);
  }

  const payload = parseWithBigInt<BackupDataPayload>(decryptedJson);

  // Run Trial Balance Doctor check immediately on restored entries!
  const doctorReport = diagnoseLedger({
    entries: payload.entries,
    accounts: payload.accounts,
    funds: payload.funds,
    periods: payload.periods,
    exchangeRates: payload.exchangeRates,
  });

  return {
    success: true,
    metadata: bundle.metadata,
    data: payload,
    isTrialBalanceHealthy: doctorReport.isClean,
    summary: doctorReport.isClean
      ? `Backup restored successfully: ${payload.entries.length} entries restored in perfect balance.`
      : `Backup restored with warnings: ${doctorReport.plainLanguageSummary}`,
  };
}

export interface BackupSandboxVerificationResult {
  readonly isValid: boolean;
  readonly testedAt: string;
  readonly metadata: BackupMetadata;
  readonly accountsCount: number;
  readonly fundsCount: number;
  readonly entriesCount: number;
  readonly periodsCount: number;
  readonly exchangeRatesCount: number;
  readonly totalDebitsPesewas: bigint;
  readonly totalCreditsPesewas: bigint;
  readonly isTrialBalanceBalanced: boolean;
  readonly isDoctorClean: boolean;
  readonly checksumVerified: boolean;
  readonly diagnosticFindingsCount: number;
  readonly plainLanguageSummary: string;
}

/**
 * Performs a dry-run test-restore into an isolated in-memory sandbox.
 * Verifies encryption passphrase, decrypts, checks SHA-256 checksum,
 * recalculates ledger trial balance, and checks for zero corruption without touching live storage.
 */
export async function verifyBackupArchiveSandbox(
  bundle: EncryptedBackupBundle,
  passphrase: string
): Promise<BackupSandboxVerificationResult> {
  const testedAt = new Date().toISOString();

  if (bundle.metadata.version !== 1) {
    throw new Error(`Unsupported backup bundle version: ${bundle.metadata.version}`);
  }

  // 1. Decrypt into memory
  const decryptedJson = await decryptData(
    {
      version: 1,
      salt: bundle.salt,
      iv: bundle.iv,
      ciphertext: bundle.ciphertext,
    },
    passphrase
  );

  // 2. Verify checksum
  const computedChecksum = await computeSecureChecksum(decryptedJson);
  const checksumVerified =
    computedChecksum === bundle.metadata.checksum ||
    verifyLegacyChecksum(decryptedJson, bundle.metadata.checksum);

  if (!checksumVerified) {
    throw new Error('Checksum mismatch in backup archive. Data may be corrupted or modified.');
  }

  // 3. Parse in isolated sandbox
  const payload = parseWithBigInt<BackupDataPayload>(decryptedJson);

  // 4. Test ledger balance in sandbox
  let totalDebits = 0n;
  let totalCredits = 0n;
  for (const entry of payload.entries || []) {
    totalDebits += entry.totalDebitGhs || 0n;
    totalCredits += entry.totalCreditGhs || 0n;
  }
  const isTrialBalanceBalanced = totalDebits === totalCredits;

  // 5. Run diagnostic doctor on sandbox data
  const doctorReport = diagnoseLedger({
    entries: payload.entries || [],
    accounts: payload.accounts || [],
    funds: payload.funds || [],
    periods: payload.periods || [],
    exchangeRates: payload.exchangeRates || [],
  });

  const isValid = checksumVerified && isTrialBalanceBalanced && doctorReport.isClean;

  const plainLanguageSummary = isValid
    ? `Backup archive verified intact: ${payload.entries.length} journal entries reconstructed across ${payload.funds.length} funds and ${payload.accounts.length} accounts with perfect balance. Zero corruption detected.`
    : `Backup archive verified with warnings: Total debits (${totalDebits.toString()}) vs credits (${totalCredits.toString()}). Findings: ${doctorReport.findings.length}.`;

  return {
    isValid,
    testedAt,
    metadata: bundle.metadata,
    accountsCount: (payload.accounts || []).length,
    fundsCount: (payload.funds || []).length,
    entriesCount: (payload.entries || []).length,
    periodsCount: (payload.periods || []).length,
    exchangeRatesCount: (payload.exchangeRates || []).length,
    totalDebitsPesewas: totalDebits,
    totalCreditsPesewas: totalCredits,
    isTrialBalanceBalanced,
    isDoctorClean: doctorReport.isClean,
    checksumVerified,
    diagnosticFindingsCount: doctorReport.findings.length,
    plainLanguageSummary,
  };
}
