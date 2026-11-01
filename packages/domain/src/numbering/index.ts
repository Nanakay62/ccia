export type DocumentType =
  | 'JOURNAL_ENTRY'
  | 'COUNTING_SHEET'
  | 'PAYMENT_VOUCHER'
  | 'RECEIPT'
  | 'REQUISITION';

export interface DocumentNumber {
  readonly prefix: string;
  readonly sequence: number;
  readonly formatted: string;
}

export const DEFAULT_PREFIX_BY_TYPE: Record<DocumentType, string> = {
  JOURNAL_ENTRY: 'JE',
  COUNTING_SHEET: 'CS',
  PAYMENT_VOUCHER: 'PV',
  RECEIPT: 'RC',
  REQUISITION: 'RQ',
};

/**
 * Formats a document number from a device/user prefix and a numeric sequence.
 * E.g., prefix 'FS-D1', sequence 42 -> 'FS-D1-000042' (default 6 digits)
 */
export function formatDocumentNumber(
  prefix: string,
  sequence: number,
  padding: number = 6
): string {
  const cleanPrefix = prefix.trim().toUpperCase();
  if (!cleanPrefix) {
    throw new Error('Document prefix cannot be empty');
  }
  if (sequence < 1) {
    throw new Error(`Sequence must be positive integer >= 1, got: ${sequence}`);
  }
  const padded = sequence.toString().padStart(padding, '0');
  return `${cleanPrefix}-${padded}`;
}

/**
 * Parses a document number into its prefix and sequence number.
 */
export function parseDocumentNumber(docNumber: string): DocumentNumber {
  const trimmed = docNumber.trim().toUpperCase();
  const lastHyphen = trimmed.lastIndexOf('-');
  if (lastHyphen === -1) {
    throw new Error(`Invalid document number format: ${docNumber}. Expected PREFIX-0001`);
  }

  const prefix = trimmed.slice(0, lastHyphen);
  const seqStr = trimmed.slice(lastHyphen + 1);

  if (!/^\d+$/.test(seqStr)) {
    throw new Error(`Invalid document sequence in: ${docNumber}. Sequence must be numeric.`);
  }

  const sequence = parseInt(seqStr, 10);
  return {
    prefix,
    sequence,
    formatted: trimmed,
  };
}

/**
 * Derives a recommended offline prefix from document type, role shorthand, and device identifier.
 * E.g., docType: 'COUNTING_SHEET', deviceId: 'dev_01' -> 'CS-D01'
 */
export function buildDevicePrefix(
  docType: DocumentType,
  roleShorthand: string,
  deviceId: string
): string {
  const typeCode = DEFAULT_PREFIX_BY_TYPE[docType];
  const cleanRole = roleShorthand.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3);
  const cleanDevice = deviceId.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-4);
  return `${typeCode}-${cleanRole}-${cleanDevice}`;
}
