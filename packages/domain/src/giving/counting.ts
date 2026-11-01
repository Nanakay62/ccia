import type {
  CashDenominationCount,
  ChequeRecord,
  MoMoRecord,
  CountingSheet,
} from './types.js';
import type { JournalEntry, JournalLine } from '../ledger/types.js';
import { validateJournalEntry } from '../ledger/rules.js';

export const GHS_STANDARD_DENOMINATIONS = [
  200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1,
] as const;

export const USD_STANDARD_DENOMINATIONS = [
  100, 50, 20, 10, 5, 2, 1,
] as const;

/**
 * Calculates total minor units (pesewas/cents) from denomination counts.
 */
export function calculateDenominationTotal(
  counts: readonly CashDenominationCount[]
): bigint {
  let totalMinor = 0n;
  for (const item of counts) {
    if (item.count <= 0) continue;
    // Denomination in major units converted to minor units (e.g. 200 GHS -> 20,000 pesewas; 0.50 GHS -> 50 pesewas)
    const minorPerUnit = BigInt(Math.round(item.denomination * 100));
    totalMinor += minorPerUnit * BigInt(item.count);
  }
  return totalMinor;
}

/**
 * Calculates total cheque collections.
 */
export function calculateChequeTotal(cheques: readonly ChequeRecord[]): bigint {
  return cheques.reduce((acc, c) => acc + c.amountPesewas, 0n);
}

/**
 * Calculates total Mobile Money collections.
 */
export function calculateMomoTotal(momoList: readonly MoMoRecord[]): bigint {
  return momoList.reduce((acc, m) => acc + m.amountPesewas, 0n);
}

/**
 * Validates the two-counter sign-off security rule.
 * Requires two distinct counter user UUIDs.
 */
export function validateTwoCounterSignOff(
  firstCounterId?: string | null,
  secondCounterId?: string | null
): { valid: boolean; error?: string } {
  if (!firstCounterId || !firstCounterId.trim()) {
    return { valid: false, error: 'First counter signature is required.' };
  }
  if (!secondCounterId || !secondCounterId.trim()) {
    return { valid: false, error: 'Second counter signature is required.' };
  }
  if (firstCounterId.trim() === secondCounterId.trim()) {
    return {
      valid: false,
      error: 'Dual-control violation: Two distinct counters are required to sign off service collections.',
    };
  }
  return { valid: true };
}

export interface CountingJournalEntryParams {
  readonly sheet: CountingSheet;
  readonly branchId: string;
  readonly documentNumber: string;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly exchangeRateUsd?: string; // Default to 1.0000 if no USD
}

/**
 * Automatically creates a balanced double-entry JournalEntry from a signed CountingSheet.
 * Debits the appropriate receiving Asset accounts:
 *   - 1010: Cash on Hand (GHS)
 *   - 1020: Cash on Hand (USD)
 *   - 1030: Bank Account (GHS) for cheques
 *   - 1050: Mobile Money Wallet
 * Credits the corresponding Revenue/Income accounts per Fund allocation.
 */
export function generateJournalEntryFromCountingSheet(
  params: CountingJournalEntryParams
): JournalEntry {
  const { sheet, branchId, documentNumber, createdBy, deviceId } = params;
  const rateUsd = params.exchangeRateUsd || '15.5000';

  // Ensure two counters signed
  const signCheck = validateTwoCounterSignOff(sheet.firstCounterId, sheet.secondCounterId);
  if (!signCheck.valid) {
    throw new Error(signCheck.error);
  }

  const lines: JournalLine[] = [];
  let lineNumber = 1;

  // Primary fund for cash deposits (default to General Fund if allocations present)
  const defaultFundId = sheet.fundAllocations[0]?.fundId || 'fund-gen';

  // 1. Debit Cash on Hand (GHS) if cash received
  if (sheet.totalCashGhsPesewas > 0n) {
    lines.push({
      id: `line-${sheet.id}-cash-ghs`,
      journalEntryId: sheet.id,
      accountId: 'acct-1010', // Cash on Hand (GHS)
      fundId: defaultFundId,
      lineNumber: lineNumber++,
      description: `Service Offering Cash (GHS) - ${sheet.serviceType}`,
      originalCurrency: 'GHS',
      originalAmount: sheet.totalCashGhsPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: sheet.totalCashGhsPesewas,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
    });
  }

  // 2. Debit Cash on Hand (USD) if USD cash received
  if (sheet.totalCashUsdCents > 0n) {
    // Convert USD cents to GHS pesewas at exchange rate
    // e.g. 10000 cents ($100.00) * 15.50 = 155,000 pesewas (GHS 1,550.00)
    const rateFloat = parseFloat(rateUsd);
    const ghsBasePesewas = BigInt(Math.round(Number(sheet.totalCashUsdCents) * rateFloat));

    lines.push({
      id: `line-${sheet.id}-cash-usd`,
      journalEntryId: sheet.id,
      accountId: 'acct-1020', // Cash on Hand (USD)
      fundId: defaultFundId,
      lineNumber: lineNumber++,
      description: `Service Offering Cash (USD) - ${sheet.serviceType} ($${(Number(sheet.totalCashUsdCents) / 100).toFixed(2)})`,
      originalCurrency: 'USD',
      originalAmount: sheet.totalCashUsdCents,
      exchangeRate: rateUsd,
      debitAmountGhs: ghsBasePesewas,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
    });
  }

  // 3. Debit Bank Account (GHS) for Cheques
  if (sheet.totalChequesGhsPesewas > 0n) {
    lines.push({
      id: `line-${sheet.id}-cheques`,
      journalEntryId: sheet.id,
      accountId: 'acct-1030', // Bank Account (GHS)
      fundId: defaultFundId,
      lineNumber: lineNumber++,
      description: `Service Offering Cheques Deposit (${sheet.cheques.length} cheques)`,
      originalCurrency: 'GHS',
      originalAmount: sheet.totalChequesGhsPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: sheet.totalChequesGhsPesewas,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
    });
  }

  // 4. Debit Mobile Money (MoMo) for electronic collections
  if (sheet.totalMomoGhsPesewas > 0n) {
    lines.push({
      id: `line-${sheet.id}-momo`,
      journalEntryId: sheet.id,
      accountId: 'acct-1050', // Mobile Money Wallet
      fundId: defaultFundId,
      lineNumber: lineNumber++,
      description: `Service Offering MoMo Collections (${sheet.momoTransactions.length} transfers)`,
      originalCurrency: 'GHS',
      originalAmount: sheet.totalMomoGhsPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: sheet.totalMomoGhsPesewas,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
    });
  }

  // 5. Credit Revenue accounts per Fund Allocation
  for (const alloc of sheet.fundAllocations) {
    if (alloc.amountPesewas <= 0n) continue;

    let accountId = 'acct-4020'; // General Offerings
    if (alloc.category === 'Tithe') {
      accountId = 'acct-4010'; // Tithes
    } else if (alloc.category === 'Special Offering') {
      accountId = 'acct-4030'; // Special Offerings
    } else if (alloc.category === 'Building Pledge') {
      accountId = 'acct-4040'; // Pledge Payments
    }

    lines.push({
      id: `line-${sheet.id}-alloc-${lineNumber}`,
      journalEntryId: sheet.id,
      accountId,
      fundId: alloc.fundId,
      lineNumber: lineNumber++,
      description: `${alloc.category} - ${sheet.serviceType}`,
      originalCurrency: 'GHS',
      originalAmount: alloc.amountPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: 0n,
      creditAmountGhs: alloc.amountPesewas,
      roundingDifferencePesewas: 0n,
    });
  }

  // Compute control totals
  const totalDebitGhs = lines.reduce((acc, l) => acc + l.debitAmountGhs, 0n);
  const totalCreditGhs = lines.reduce((acc, l) => acc + l.creditAmountGhs, 0n);

  const entry: JournalEntry = {
    id: sheet.id,
    branchId,
    documentNumber,
    entryDate: sheet.serviceDate,
    entryType: 'STANDARD',
    narration: `${sheet.serviceType} Collection Sign-off (Counters: ${sheet.firstCounterName} & ${sheet.secondCounterName})`,
    lineCount: lines.length,
    totalDebitGhs,
    totalCreditGhs,
    isReversal: false,
    createdBy,
    deviceId,
    createdAt: new Date().toISOString(),
    lines,
  };

  // Run ledger rules validation
  const validation = validateJournalEntry(entry);
  if (!validation.isValid) {
    throw new Error(`Ledger posting failed: ${validation.errors.join('; ')}`);
  }

  return entry;
}
