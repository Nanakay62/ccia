import type { PettyCashFloat, PettyCashTransaction } from './types.js';
import type { JournalEntry, JournalLine } from '../ledger/types.js';
import { validateJournalEntry } from '../ledger/rules.js';

export interface PettyCashStatusReport {
  readonly targetFloatPesewas: bigint;
  readonly cashInBoxPesewas: bigint;
  readonly unreimbursedReceiptsPesewas: bigint;
  readonly replenishmentNeededPesewas: bigint;
  readonly transactionCount: number;
  readonly isHealthy: boolean;
}

/**
 * Computes current Imprest system float status.
 */
export function calculatePettyCashStatus(
  float: PettyCashFloat,
  transactions: readonly PettyCashTransaction[]
): PettyCashStatusReport {
  const unreimbursed = transactions.filter((t) => !t.isReplenished);
  const unreimbursedPesewas = unreimbursed.reduce((acc, t) => acc + t.amountPesewas, 0n);

  const cashInBoxPesewas = float.targetFloatPesewas - unreimbursedPesewas;
  const isHealthy = cashInBoxPesewas >= 0n;

  return {
    targetFloatPesewas: float.targetFloatPesewas,
    cashInBoxPesewas: isHealthy ? cashInBoxPesewas : 0n,
    unreimbursedReceiptsPesewas: unreimbursedPesewas,
    replenishmentNeededPesewas: unreimbursedPesewas,
    transactionCount: unreimbursed.length,
    isHealthy,
  };
}

export interface ReplenishmentJournalParams {
  readonly replenishmentNumber: string;
  readonly transactions: readonly PettyCashTransaction[];
  readonly paymentAccountId: string; // e.g. "acct-1030" Bank Account (GHS)
  readonly fundId: string; // e.g. "fund-gen"
  readonly branchId: string;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly date: string;
}

/**
 * Automatically creates a balanced double-entry JournalEntry for Petty Cash replenishment.
 * Debits each individual expense category incurred.
 * Credits the source Bank/Cash account to restore the float to its full target.
 */
export function generateReplenishmentJournalEntry(params: ReplenishmentJournalParams): JournalEntry {
  const { replenishmentNumber, transactions, paymentAccountId, fundId, branchId, createdBy, deviceId, date } = params;

  if (transactions.length === 0) {
    throw new Error('No unreimbursed petty cash transactions to replenish.');
  }

  const lines: JournalLine[] = [];
  let lineNumber = 1;
  let totalDebitGhs = 0n;

  // Aggregate by expense account
  const accountTotals = new Map<string, { amount: bigint; descriptions: string[] }>();
  for (const t of transactions) {
    const existing = accountTotals.get(t.expenseAccountId) || { amount: 0n, descriptions: [] };
    existing.amount += t.amountPesewas;
    existing.descriptions.push(t.description);
    accountTotals.set(t.expenseAccountId, existing);
  }

  // 1. Debit individual expense accounts
  for (const [accId, data] of accountTotals.entries()) {
    lines.push({
      id: `line-pc-repl-${lineNumber}`,
      journalEntryId: replenishmentNumber,
      accountId: accId,
      fundId,
      lineNumber: lineNumber++,
      description: `Petty Cash Replenishment: ${data.descriptions.slice(0, 3).join(', ')}`,
      originalCurrency: 'GHS',
      originalAmount: data.amount,
      exchangeRate: '1.0000',
      debitAmountGhs: data.amount,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
    });
    totalDebitGhs += data.amount;
  }

  // 2. Credit the source bank/cash account
  lines.push({
    id: `line-pc-repl-credit`,
    journalEntryId: replenishmentNumber,
    accountId: paymentAccountId,
    fundId,
    lineNumber: lineNumber++,
    description: `Petty Cash Float Replenishment (${transactions.length} receipts)`,
    originalCurrency: 'GHS',
    originalAmount: totalDebitGhs,
    exchangeRate: '1.0000',
    debitAmountGhs: 0n,
    creditAmountGhs: totalDebitGhs,
    roundingDifferencePesewas: 0n,
  });

  const entry: JournalEntry = {
    id: replenishmentNumber,
    branchId,
    documentNumber: replenishmentNumber,
    entryDate: date,
    entryType: 'STANDARD',
    narration: `Petty Cash Imprest Replenishment (${transactions.length} receipts total GHS ${(Number(totalDebitGhs) / 100).toFixed(2)})`,
    lineCount: lines.length,
    totalDebitGhs,
    totalCreditGhs: totalDebitGhs,
    isReversal: false,
    createdBy,
    deviceId,
    createdAt: new Date().toISOString(),
    lines,
  };

  const validation = validateJournalEntry(entry);
  if (!validation.isValid) {
    throw new Error(`Replenishment journal failed validation: ${validation.errors.join('; ')}`);
  }

  return entry;
}
