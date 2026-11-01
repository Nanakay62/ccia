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

function computeSimpleChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `chk-${Math.abs(hash).toString(16)}`;
}

function serializeWithBigInt(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }
    return value;
  });
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
  const checksum = computeSimpleChecksum(jsonStr);

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

  const checksum = computeSimpleChecksum(decryptedJson);
  if (checksum !== bundle.metadata.checksum) {
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
