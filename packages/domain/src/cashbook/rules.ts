import type { Currency } from '../money/index.js';
import { convertLineToBaseCurrency } from '../money/index.js';
import type {
  Account,
  Fund,
  AccountingPeriod,
  JournalEntry,
} from '../ledger/types.js';
import { createJournalEntry } from '../ledger/rules.js';
import type {
  CashAccount,
  CashbookEntry,
  CashCountLine,
  AnalysedCashbookSummary,
} from './types.js';

export interface CreateReceiptInput {
  readonly branchId: string;
  readonly cashAccount: CashAccount;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly receivedFrom: string;
  readonly fund: Fund;
  readonly incomeAccount: Account;
  readonly amount: bigint; // Minor units in cashAccount currency
  readonly exchangeRate?: string; // e.g. "15.5000" for USD
  readonly method: CashbookEntry['method'];
  readonly refNumber: string;
  readonly narration: string;
  readonly category?: string;
  readonly period?: AccountingPeriod | null;
  readonly createdBy: string;
  readonly deviceId: string;
}

export interface CreatePaymentInput {
  readonly branchId: string;
  readonly cashAccount: CashAccount;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly paidTo: string;
  readonly linkedVoucherId?: string;
  readonly fund: Fund;
  readonly expenseAccount: Account;
  readonly amount: bigint; // Minor units
  readonly exchangeRate?: string;
  readonly method: CashbookEntry['method'];
  readonly chequeNumber?: string;
  readonly narration: string;
  readonly category?: string;
  readonly isVoucherExempt?: boolean;
  readonly voucherExemptReason?: string;
  readonly period?: AccountingPeriod | null;
  readonly currentBookBalance: bigint;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly treasurerOverride?: {
    readonly isOverridden: boolean;
    readonly reason: string;
    readonly authorizedBy: string;
  } | null;
}

export interface CreateTransferInput {
  readonly branchId: string;
  readonly fromAccount: CashAccount;
  readonly toAccount: CashAccount;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly amount: bigint; // In fromAccount currency
  readonly exchangeRate?: string; // e.g. "15.5000"
  readonly destinationAmount?: bigint; // In toAccount currency (if converted)
  readonly fund: Fund;
  readonly fxGainLossAccount?: Account;
  readonly refNumber: string;
  readonly narration: string;
  readonly period?: AccountingPeriod | null;
  readonly currentSourceBalance: bigint;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly treasurerOverride?: {
    readonly isOverridden: boolean;
    readonly reason: string;
    readonly authorizedBy: string;
  } | null;
}

export interface ValidationNotice {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Calculates deterministic running balances for a list of cashbook entries.
 * Sorted chronologically by entryDate asc, then createdAt asc, then id asc.
 */
export function calculateRunningBalances(
  entries: readonly CashbookEntry[],
  openingBalance: bigint
): CashbookEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.entryDate !== b.entryDate) {
      return a.entryDate.localeCompare(b.entryDate);
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.id.localeCompare(b.id);
  });

  let currentBalance = openingBalance;
  return sorted.map((entry) => {
    if (entry.direction === 'RECEIPT') {
      currentBalance += entry.amount;
    } else if (entry.direction === 'PAYMENT') {
      currentBalance -= entry.amount;
    } else if (entry.direction === 'TRANSFER') {
      // If transfer is an inflow to this account
      if (entry.cashAccountId === entry.cashAccountId) {
        // Handled per entry context
        if (entry.amount >= 0n) {
          // positive means receipt/inflow, negative means outflow
        }
      }
      // Direction-based
      currentBalance += entry.direction === 'TRANSFER' && entry.amount < 0n ? entry.amount : entry.amount;
    }
    return {
      ...entry,
      runningBalance: currentBalance,
    };
  });
}

/**
 * Validates a proposed payment or transfer against overdraft rules.
 */
export function validateOverdraft(
  account: CashAccount,
  currentBalance: bigint,
  deductionAmount: bigint,
  treasurerOverride?: { isOverridden: boolean; reason: string; authorizedBy: string } | null
): { allowed: boolean; error?: string } {
  const resultingBalance = currentBalance - deductionAmount;
  if (resultingBalance >= 0n) {
    return { allowed: true };
  }

  // Resulting balance is negative
  if (account.kind === 'bank') {
    if (account.allowOverdraft) {
      return { allowed: true };
    }
  }

  // Cash, MoMo, or bank without overdraft setting
  if (treasurerOverride?.isOverridden && treasurerOverride.reason.trim()) {
    return { allowed: true };
  }

  const kindLabel =
    account.kind === 'mobile'
      ? 'Mobile money'
      : account.kind === 'petty'
      ? 'Petty cash'
      : account.kind === 'cash'
      ? 'Cash'
      : 'Bank';

  return {
    allowed: false,
    error: `${kindLabel} account "${account.name}" cannot be overdrawn. Payment of ${deductionAmount} would leave balance at ${resultingBalance}. Requires Treasurer override with reason.`,
  };
}

/**
 * Checks date validity against open accounting period and future dates.
 */
export function validateEntryDate(
  dateStr: string,
  period?: AccountingPeriod | null
): { isValid: boolean; error?: string; isWarning?: boolean; warning?: string } {
  if (period && period.isClosed) {
    return {
      isValid: false,
      error: `Cannot post entry on ${dateStr} into closed period ${period.year}-${String(period.month).padStart(2, '0')}.`,
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr > todayStr) {
    return {
      isValid: false,
      error: `Entry date ${dateStr} cannot be in the future (today is ${todayStr}).`,
    };
  }

  // Check if date is older than 30 days
  const entryTime = new Date(dateStr).getTime();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (entryTime < thirtyDaysAgo) {
    return {
      isValid: true,
      isWarning: true,
      warning: `Date ${dateStr} is older than 30 days. Please verify accuracy before posting.`,
    };
  }

  return { isValid: true };
}

/**
 * Creates a Cashbook Receipt posting:
 * Dr Cash/Bank Ledger Account
 * Cr Income Ledger Account
 * In the chosen fund. Balanced in base currency GHS.
 */
export function createCashbookReceipt(
  input: CreateReceiptInput
): { journalEntry: JournalEntry; cashbookEntry: CashbookEntry } {
  const dateCheck = validateEntryDate(input.entryDate, input.period);
  if (!dateCheck.isValid) {
    throw new Error(dateCheck.error);
  }

  const exchangeRate = input.cashAccount.currency === 'USD' ? (input.exchangeRate ?? '15.5000') : '1.0000';
  const conversion = convertLineToBaseCurrency(input.amount, input.cashAccount.currency, exchangeRate);

  const docNumber = input.refNumber.startsWith('RC-')
    ? input.refNumber
    : `RC-${input.entryDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const jeId = `je-cb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cbId = `cb-rc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const journalEntry = createJournalEntry({
    id: jeId,
    branchId: input.branchId,
    documentNumber: docNumber,
    entryDate: input.entryDate,
    entryType: 'CASHBOOK' as unknown as JournalEntry['entryType'],
    narration: input.narration || `Cashbook Receipt: ${input.receivedFrom}`,
    createdBy: input.createdBy,
    deviceId: input.deviceId,
    lines: [
      {
        id: `${jeId}-l1`,
        accountId: input.cashAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: input.cashAccount.currency,
        originalAmount: input.amount,
        exchangeRate,
        isDebit: true,
        description: `Receipt from ${input.receivedFrom} via ${input.method}`,
      },
      {
        id: `${jeId}-l2`,
        accountId: input.incomeAccount.id,
        fundId: input.fund.id,
        originalCurrency: input.cashAccount.currency,
        originalAmount: input.amount,
        exchangeRate,
        isDebit: false,
        description: `Income: ${input.incomeAccount.name} (${input.receivedFrom})`,
      },
    ],
  });

  const cashbookEntry: CashbookEntry = {
    id: cbId,
    branchId: input.branchId,
    journalEntryId: journalEntry.id,
    cashAccountId: input.cashAccount.id,
    direction: 'RECEIPT',
    entryDate: input.entryDate,
    refNumber: docNumber,
    details: input.receivedFrom ? `From: ${input.receivedFrom} — ${input.narration}` : input.narration,
    fundId: input.fund.id,
    fundCode: input.fund.code,
    counterpartAccountId: input.incomeAccount.id,
    counterpartAccountName: input.incomeAccount.name,
    category: input.category ?? input.incomeAccount.name,
    amount: input.amount,
    exchangeRate: input.cashAccount.currency === 'USD' ? exchangeRate : undefined,
    amountGhs: conversion.baseAmountGhs,
    method: input.method,
    source: 'MANUAL',
    isReversal: false,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  return { journalEntry, cashbookEntry };
}

/**
 * Creates a Cashbook Payment posting:
 * Dr Expense/Asset Ledger Account
 * Cr Cash/Bank Ledger Account
 * In the chosen fund. Balanced in base currency GHS.
 */
export function createCashbookPayment(
  input: CreatePaymentInput
): { journalEntry: JournalEntry; cashbookEntry: CashbookEntry } {
  const dateCheck = validateEntryDate(input.entryDate, input.period);
  if (!dateCheck.isValid) {
    throw new Error(dateCheck.error);
  }

  // Overdraft validation
  const overdraftCheck = validateOverdraft(
    input.cashAccount,
    input.currentBookBalance,
    input.amount,
    input.treasurerOverride
  );
  if (!overdraftCheck.allowed) {
    throw new Error(overdraftCheck.error);
  }

  // Voucher validation: required unless exempt or overridden
  if (!input.linkedVoucherId && !input.isVoucherExempt && !input.treasurerOverride?.isOverridden) {
    throw new Error(
      'Payment requires a linked approved voucher. Payments without a voucher are allowed only for defined fee exemptions or with a Treasurer override.'
    );
  }

  const exchangeRate = input.cashAccount.currency === 'USD' ? (input.exchangeRate ?? '15.5000') : '1.0000';
  const conversion = convertLineToBaseCurrency(input.amount, input.cashAccount.currency, exchangeRate);

  const docNumber = input.linkedVoucherId
    ? `PV-${input.linkedVoucherId.replace(/^voucher-|^pv-|^v-/i, '')}`
    : `PAY-${input.entryDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const jeId = `je-cb-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cbId = `cb-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const journalEntry = createJournalEntry({
    id: jeId,
    branchId: input.branchId,
    documentNumber: docNumber,
    entryDate: input.entryDate,
    entryType: 'CASHBOOK' as unknown as JournalEntry['entryType'],
    narration: input.narration || `Payment to ${input.paidTo}`,
    createdBy: input.createdBy,
    deviceId: input.deviceId,
    treasurerOverride: input.treasurerOverride,
    lines: [
      {
        id: `${jeId}-l1`,
        accountId: input.expenseAccount.id,
        fundId: input.fund.id,
        originalCurrency: input.cashAccount.currency,
        originalAmount: input.amount,
        exchangeRate,
        isDebit: true,
        description: `Payment to ${input.paidTo}: ${input.expenseAccount.name}`,
      },
      {
        id: `${jeId}-l2`,
        accountId: input.cashAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: input.cashAccount.currency,
        originalAmount: input.amount,
        exchangeRate,
        isDebit: false,
        description: `Disbursed from ${input.cashAccount.name} (${input.method})`,
      },
    ],
  });

  const cashbookEntry: CashbookEntry = {
    id: cbId,
    branchId: input.branchId,
    journalEntryId: journalEntry.id,
    cashAccountId: input.cashAccount.id,
    direction: 'PAYMENT',
    entryDate: input.entryDate,
    refNumber: docNumber,
    details: `To: ${input.paidTo} — ${input.narration}`,
    fundId: input.fund.id,
    fundCode: input.fund.code,
    counterpartAccountId: input.expenseAccount.id,
    counterpartAccountName: input.expenseAccount.name,
    category: input.category ?? input.expenseAccount.name,
    amount: input.amount,
    exchangeRate: input.cashAccount.currency === 'USD' ? exchangeRate : undefined,
    amountGhs: conversion.baseAmountGhs,
    method: input.method,
    chequeNumber: input.chequeNumber,
    linkedVoucherId: input.linkedVoucherId,
    source: input.linkedVoucherId ? 'VOUCHER' : 'MANUAL',
    isReversal: false,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  return { journalEntry, cashbookEntry };
}

/**
 * Creates a Contra / Inter-Account Transfer posting:
 * Dr Destination Account
 * Cr Source Account
 * Handles currency conversion and foreign exchange gain/loss when currencies differ.
 * Produces two cashbook entries (one for each cashbook account) linked to a single journal entry.
 */
export function createCashbookTransfer(
  input: CreateTransferInput
): {
  journalEntry: JournalEntry;
  sourceEntry: CashbookEntry;
  destinationEntry: CashbookEntry;
} {
  const dateCheck = validateEntryDate(input.entryDate, input.period);
  if (!dateCheck.isValid) {
    throw new Error(dateCheck.error);
  }

  // Overdraft validation on source account
  const overdraftCheck = validateOverdraft(
    input.fromAccount,
    input.currentSourceBalance,
    input.amount,
    input.treasurerOverride
  );
  if (!overdraftCheck.allowed) {
    throw new Error(overdraftCheck.error);
  }

  const docNumber = input.refNumber.startsWith('TR-')
    ? input.refNumber
    : `TR-${input.entryDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const jeId = `je-tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const lines = [];

  const isSameCurrency = input.fromAccount.currency === input.toAccount.currency;

  if (isSameCurrency) {
    // Standard same-currency contra
    lines.push({
      id: `${jeId}-l1`,
      accountId: input.toAccount.accountId,
      fundId: input.fund.id,
      originalCurrency: input.toAccount.currency,
      originalAmount: input.amount,
      exchangeRate: '1.0000',
      isDebit: true,
      description: `Transfer to ${input.toAccount.name} from ${input.fromAccount.name}`,
    });
    lines.push({
      id: `${jeId}-l2`,
      accountId: input.fromAccount.accountId,
      fundId: input.fund.id,
      originalCurrency: input.fromAccount.currency,
      originalAmount: input.amount,
      exchangeRate: '1.0000',
      isDebit: false,
      description: `Transfer from ${input.fromAccount.name} to ${input.toAccount.name}`,
    });
  } else {
    // Cross-currency transfer (e.g. USD Cash -> GHS Bank or GHS -> USD)
    const rate = input.exchangeRate ?? '15.5000';

    if (input.fromAccount.currency === 'USD' && input.toAccount.currency === 'GHS') {
      const sourceConversion = convertLineToBaseCurrency(input.amount, 'USD', rate);
      const destAmountGhs = input.destinationAmount ?? sourceConversion.baseAmountGhs;

      // Source credit in USD
      lines.push({
        id: `${jeId}-l1`,
        accountId: input.fromAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: 'USD' as Currency,
        originalAmount: input.amount,
        exchangeRate: rate,
        isDebit: false,
        description: `USD Outflow ($${Number(input.amount) / 100}) converted at ${rate}`,
      });

      // Destination debit in GHS
      lines.push({
        id: `${jeId}-l2`,
        accountId: input.toAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: 'GHS' as Currency,
        originalAmount: destAmountGhs,
        exchangeRate: '1.0000',
        isDebit: true,
        description: `GHS Inflow from USD exchange at ${rate}`,
      });

      // FX Difference if destination amount differs from converted base
      const fxDiff = destAmountGhs - sourceConversion.baseAmountGhs;
      if (fxDiff !== 0n && input.fxGainLossAccount) {
        lines.push({
          id: `${jeId}-l3`,
          accountId: input.fxGainLossAccount.id,
          fundId: input.fund.id,
          originalCurrency: 'GHS' as Currency,
          originalAmount: fxDiff > 0n ? fxDiff : -fxDiff,
          exchangeRate: '1.0000',
          isDebit: fxDiff < 0n, // Loss is Debit, Gain is Credit
          description: `Foreign Exchange Difference on conversion at ${rate}`,
        });
      }
    } else {
      // GHS to USD
      const destUsd = input.destinationAmount ?? input.amount;
      const destConversion = convertLineToBaseCurrency(destUsd, 'USD', rate);

      lines.push({
        id: `${jeId}-l1`,
        accountId: input.fromAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: 'GHS' as Currency,
        originalAmount: input.amount,
        exchangeRate: '1.0000',
        isDebit: false,
        description: `GHS Outflow for USD purchase at ${rate}`,
      });

      lines.push({
        id: `${jeId}-l2`,
        accountId: input.toAccount.accountId,
        fundId: input.fund.id,
        originalCurrency: 'USD' as Currency,
        originalAmount: destUsd,
        exchangeRate: rate,
        isDebit: true,
        description: `USD Inflow purchased at ${rate}`,
      });

      const fxDiff = input.amount - destConversion.baseAmountGhs;
      if (fxDiff !== 0n && input.fxGainLossAccount) {
        lines.push({
          id: `${jeId}-l3`,
          accountId: input.fxGainLossAccount.id,
          fundId: input.fund.id,
          originalCurrency: 'GHS' as Currency,
          originalAmount: fxDiff > 0n ? fxDiff : -fxDiff,
          exchangeRate: '1.0000',
          isDebit: fxDiff > 0n,
          description: `Foreign Exchange Difference on USD purchase at ${rate}`,
        });
      }
    }
  }

  const journalEntry = createJournalEntry({
    id: jeId,
    branchId: input.branchId,
    documentNumber: docNumber,
    entryDate: input.entryDate,
    entryType: 'CASHBOOK' as unknown as JournalEntry['entryType'],
    narration: input.narration || `Transfer from ${input.fromAccount.name} to ${input.toAccount.name}`,
    createdBy: input.createdBy,
    deviceId: input.deviceId,
    lines,
  });

  const sourceEntry: CashbookEntry = {
    id: `cb-tr-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    branchId: input.branchId,
    journalEntryId: journalEntry.id,
    cashAccountId: input.fromAccount.id,
    direction: 'PAYMENT',
    entryDate: input.entryDate,
    refNumber: docNumber,
    details: `Transfer out to ${input.toAccount.name} — ${input.narration}`,
    fundId: input.fund.id,
    fundCode: input.fund.code,
    counterpartAccountId: input.toAccount.accountId,
    counterpartAccountName: input.toAccount.name,
    category: 'Transfers',
    amount: input.amount,
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  const destAmount = isSameCurrency
    ? input.amount
    : input.destinationAmount ?? input.amount;

  const destinationEntry: CashbookEntry = {
    id: `cb-tr-in-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    branchId: input.branchId,
    journalEntryId: journalEntry.id,
    cashAccountId: input.toAccount.id,
    direction: 'RECEIPT',
    entryDate: input.entryDate,
    refNumber: docNumber,
    details: `Transfer in from ${input.fromAccount.name} — ${input.narration}`,
    fundId: input.fund.id,
    fundCode: input.fund.code,
    counterpartAccountId: input.fromAccount.accountId,
    counterpartAccountName: input.fromAccount.name,
    category: 'Transfers',
    amount: destAmount,
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  return { journalEntry, sourceEntry, destinationEntry };
}

/**
 * Checks whether a cheque is stale (exceeds 6 months from issue date).
 */
export function isChequeStale(issueDateStr: string, asOfDateStr?: string): boolean {
  const issueDate = new Date(issueDateStr);
  const targetDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  const staleLimit = new Date(issueDate);
  staleLimit.setMonth(staleLimit.getMonth() + 6);

  return targetDate > staleLimit;
}

/**
 * Calculates physical cash total from denomination counts.
 */
export function calculatePhysicalCashTotal(lines: readonly CashCountLine[]): bigint {
  return lines.reduce((acc, line) => acc + line.lineTotal, 0n);
}

/**
 * Computes analysed cashbook categories and totals.
 */
export function computeAnalysedCashbook(
  entries: readonly CashbookEntry[],
  openingBalance: bigint
): AnalysedCashbookSummary {
  const receiptsMap = new Map<string, bigint>();
  const paymentsMap = new Map<string, bigint>();

  let totalReceipts = 0n;
  let totalPayments = 0n;

  for (const e of entries) {
    const category = e.category || 'Other';
    if (e.direction === 'RECEIPT') {
      const current = receiptsMap.get(category) ?? 0n;
      receiptsMap.set(category, current + e.amount);
      totalReceipts += e.amount;
    } else if (e.direction === 'PAYMENT') {
      const current = paymentsMap.get(category) ?? 0n;
      paymentsMap.set(category, current + e.amount);
      totalPayments += e.amount;
    }
  }

  const receiptsCategories = Array.from(receiptsMap.entries()).map(([name, total]) => ({
    name,
    total,
  }));

  const paymentsCategories = Array.from(paymentsMap.entries()).map(([name, total]) => ({
    name,
    total,
  }));

  return {
    receiptsCategories,
    paymentsCategories,
    totalReceipts,
    totalPayments,
    openingBalance,
    closingBalance: openingBalance + totalReceipts - totalPayments,
  };
}

/**
 * Calculates standard Bank Reconciliation statement:
 * Balance per bank statement
 * + Deposits in transit (uncleared receipts)
 * - Unpresented cheques (uncleared payments)
 * = Adjusted bank balance
 * Compared to Cashbook closing balance.
 */
export function calculateBankReconciliation(
  statementEndingBalance: bigint,
  cashbookEntries: readonly CashbookEntry[],
  clearedEntryIds: ReadonlySet<string>,
  openingBalance: bigint
): import('./types.js').BankReconciliationCalculationResult {
  const unclearedReceipts: CashbookEntry[] = [];
  const unclearedPayments: CashbookEntry[] = [];
  const clearedReceipts: CashbookEntry[] = [];
  const clearedPayments: CashbookEntry[] = [];

  let totalReceipts = 0n;
  let totalPayments = 0n;
  let depositsInTransit = 0n;
  let unpresentedCheques = 0n;

  for (const entry of cashbookEntries) {
    const isCleared = clearedEntryIds.has(entry.id);
    if (entry.direction === 'RECEIPT') {
      totalReceipts += entry.amount;
      if (isCleared) {
        clearedReceipts.push(entry);
      } else {
        unclearedReceipts.push(entry);
        depositsInTransit += entry.amount;
      }
    } else if (entry.direction === 'PAYMENT') {
      totalPayments += entry.amount;
      if (isCleared) {
        clearedPayments.push(entry);
      } else {
        unclearedPayments.push(entry);
        unpresentedCheques += entry.amount;
      }
    }
  }

  const cashbookClosingBalance = openingBalance + totalReceipts - totalPayments;
  const adjustedBankBalance = statementEndingBalance + depositsInTransit - unpresentedCheques;
  const variance = adjustedBankBalance - cashbookClosingBalance;

  return {
    statementEndingBalance,
    cashbookClosingBalance,
    depositsInTransit,
    unpresentedCheques,
    adjustedBankBalance,
    variance,
    isBalanced: variance === 0n,
    unclearedReceipts,
    unclearedPayments,
    clearedReceipts,
    clearedPayments,
  };
}

/**
 * Validates a bank reconciliation sign-off (Finance Secretary prepare, Treasurer approve).
 */
export function validateBankReconciliationSignoff(
  variance: bigint,
  preparedByUserId?: string,
  approvedByUserId?: string
): { isValid: boolean; error?: string } {
  if (variance !== 0n) {
    return {
      isValid: false,
      error: `Bank reconciliation cannot be signed off with an unexplained variance of ${variance}. The difference must be zero.`,
    };
  }

  if (preparedByUserId && approvedByUserId && preparedByUserId === approvedByUserId) {
    return {
      isValid: false,
      error: 'Dual sign-off requires two different individuals (prepared by Finance Secretary, approved by Treasurer).',
    };
  }

  return { isValid: true };
}

/**
 * Checks whether an accounting period can be closed based on bank reconciliations.
 * Section 1.7: A month cannot be closed if a bank account has no signed-off reconciliation,
 * unless the Treasurer overrides with a reason.
 */
export function validateMonthCloseReconciliation(
  bankAccounts: readonly CashAccount[],
  reconciliations: readonly import('./types.js').BankReconciliation[],
  periodYear: number,
  periodMonth: number,
  treasurerOverride?: { isOverridden: boolean; reason: string; authorizedBy: string } | null
): { canClose: boolean; unreconciledAccounts: string[]; error?: string } {
  const targetPeriodPrefix = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;

  const unreconciledAccounts: string[] = [];

  for (const acct of bankAccounts) {
    if (acct.kind !== 'bank') continue;

    // Look for approved reconciliation whose statement date matches this month
    const approvedRec = reconciliations.find(
      (r) =>
        r.bankAccountId === acct.id &&
        r.statementDate.startsWith(targetPeriodPrefix) &&
        r.status === 'APPROVED'
    );

    if (!approvedRec) {
      unreconciledAccounts.push(acct.name);
    }
  }

  if (unreconciledAccounts.length === 0) {
    return { canClose: true, unreconciledAccounts: [] };
  }

  if (treasurerOverride?.isOverridden && treasurerOverride.reason.trim()) {
    return { canClose: true, unreconciledAccounts };
  }

  return {
    canClose: false,
    unreconciledAccounts,
    error: `Cannot close period ${targetPeriodPrefix}. The following bank accounts do not have an approved bank reconciliation: ${unreconciledAccounts.join(
      ', '
    )}. Requires Treasurer override with reason.`,
  };
}

/**
 * Computes the next sequential cheque number given existing cheques.
 */
export function getNextChequeNumber(
  existingCheques: readonly import('./types.js').ChequeItem[],
  fallbackStartNumber: number = 1
): string {
  let maxNum = fallbackStartNumber - 1;
  for (const c of existingCheques) {
    const parsed = parseInt(c.chequeNumber, 10);
    if (!isNaN(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }
  return String(maxNum + 1).padStart(6, '0');
}

/**
 * Validates a cheque number for uniqueness and potential gaps.
 */
export function validateChequeNumber(
  chequeNumber: string,
  existingCheques: readonly import('./types.js').ChequeItem[]
): { isValid: boolean; warning?: string; error?: string } {
  const trimmed = chequeNumber.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Cheque number is required.' };
  }

  const existing = existingCheques.find((c) => c.chequeNumber.trim() === trimmed);
  if (existing) {
    return {
      isValid: false,
      error: `Cheque number ${trimmed} has already been issued on ${existing.issueDate} to "${existing.payee}".`,
    };
  }

  const currentNum = parseInt(trimmed, 10);
  if (!isNaN(currentNum)) {
    const maxNum = existingCheques.reduce((max, c) => {
      const n = parseInt(c.chequeNumber, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);

    if (maxNum > 0 && currentNum > maxNum + 1) {
      return {
        isValid: true,
        warning: `Notice: Cheque number ${trimmed} creates a sequence gap (last issued was ${String(
          maxNum
        ).padStart(6, '0')}).`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Refreshes cheque statuses: flags cheques older than 6 months as STALE if still ISSUED.
 */
export function refreshChequeStatuses(
  cheques: readonly import('./types.js').ChequeItem[],
  asOfDateStr?: string
): import('./types.js').ChequeItem[] {
  return cheques.map((c) => {
    if (c.status === 'ISSUED' && isChequeStale(c.issueDate, asOfDateStr)) {
      return {
        ...c,
        status: 'STALE',
      };
    }
    return c;
  });
}

/**
 * Suggests matching between imported bank statement lines and cashbook entries.
 * Matches based on identical amount, corresponding direction, and date within 3 days.
 */
export function autoMatchStatementLines(
  statementLines: readonly import('./types.js').BankStatementLine[],
  cashbookEntries: readonly CashbookEntry[]
): Array<{ statementLineId: string; cashbookEntryId: string }> {
  const matches: Array<{ statementLineId: string; cashbookEntryId: string }> = [];
  const usedEntryIds = new Set<string>();

  for (const sLine of statementLines) {
    if (sLine.isMatched) continue;

    const sAmt = sLine.credit ?? sLine.debit ?? 0n;
    const isCredit = sLine.credit !== undefined && sLine.credit > 0n;
    const targetDirection = isCredit ? 'RECEIPT' : 'PAYMENT';

    const sTime = new Date(sLine.statementDate).getTime();

    // Find first unmatched entry matching criteria
    const match = cashbookEntries.find((e) => {
      if (usedEntryIds.has(e.id)) return false;
      if (e.direction !== targetDirection) return false;
      if (e.amount !== sAmt) return false;

      const eTime = new Date(e.entryDate).getTime();
      const diffDays = Math.abs(sTime - eTime) / (1000 * 60 * 60 * 24);
      return diffDays <= 3.5; // Within 3 days window
    });

    if (match) {
      matches.push({
        statementLineId: sLine.id,
        cashbookEntryId: match.id,
      });
      usedEntryIds.add(match.id);
    }
  }

  return matches;
}
