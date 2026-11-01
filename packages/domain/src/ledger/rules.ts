import Big from 'big.js';
import { convertLineToBaseCurrency } from '../money/index.js';
import type {
  Account,
  Fund,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
  TrialBalanceReport,
  TrialBalanceItem,
  FundBalanceItem,
} from './types.js';

export interface CreateLineInput {
  readonly id: string;
  readonly accountId: string;
  readonly fundId: string;
  readonly originalCurrency: 'GHS' | 'USD';
  readonly originalAmount: bigint; // Minor units
  readonly exchangeRate: string;   // "1.0000" or e.g. "15.5000"
  readonly isDebit: boolean;
  readonly description?: string | null;
}

export interface CreateJournalEntryInput {
  readonly id: string;
  readonly branchId: string;
  readonly documentNumber: string;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly entryType?: JournalEntry['entryType'];
  readonly narration: string;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly lines: readonly CreateLineInput[];
  readonly autoBalanceRounding?: boolean;
  readonly roundingAccountId?: string;
  readonly defaultFundId?: string;
  readonly period?: AccountingPeriod | null;
  readonly treasurerOverride?: {
    readonly isOverridden: boolean;
    readonly reason: string;
    readonly authorizedBy: string;
  } | null;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates a journal entry against double-entry and fund accounting rules.
 */
export function validateJournalEntry(
  entry: JournalEntry,
  accountsMap?: ReadonlyMap<string, Account>,
  fundsMap?: ReadonlyMap<string, Fund>,
  period?: AccountingPeriod | null
): ValidationResult {
  const errors: string[] = [];

  // 1. Period Closed Check
  if (period && period.isClosed) {
    errors.push(`Cannot post entry ${entry.documentNumber} into closed period ${period.year}-${String(period.month).padStart(2, '0')}.`);
  }

  // 2. Minimum Line Count
  if (entry.lines.length < 2) {
    errors.push(`Journal entry must have at least 2 lines, found ${entry.lines.length}.`);
  }
  if (entry.lines.length !== entry.lineCount) {
    errors.push(`Header line count (${entry.lineCount}) does not match actual lines (${entry.lines.length}).`);
  }

  let totalDebit = 0n;
  let totalCredit = 0n;
  const fundTotals = new Map<string, { debit: bigint; credit: bigint }>();

  for (let i = 0; i < entry.lines.length; i++) {
    const line = entry.lines[i]!;

    // Account existence
    if (accountsMap) {
      const account = accountsMap.get(line.accountId);
      if (!account) {
        errors.push(`Line ${i + 1}: Account ${line.accountId} does not exist.`);
      } else if (!account.isActive) {
        errors.push(`Line ${i + 1}: Account ${account.name} (${account.code}) is inactive.`);
      }
    }

    // Fund existence
    if (fundsMap) {
      const fund = fundsMap.get(line.fundId);
      if (!fund) {
        errors.push(`Line ${i + 1}: Fund ${line.fundId} does not exist.`);
      } else if (!fund.isActive) {
        errors.push(`Line ${i + 1}: Fund ${fund.name} (${fund.code}) is inactive.`);
      }
    }

    // Amount checks
    if (line.originalAmount <= 0n) {
      errors.push(`Line ${i + 1}: Original amount must be positive, got ${line.originalAmount}.`);
    }

    const hasDebit = line.debitAmountGhs > 0n;
    const hasCredit = line.creditAmountGhs > 0n;

    if (!hasDebit && !hasCredit) {
      errors.push(`Line ${i + 1}: Must specify either a debit or credit amount.`);
    }
    if (hasDebit && hasCredit) {
      errors.push(`Line ${i + 1}: Line cannot have both debit and credit amounts.`);
    }

    // Currency consistency check
    if (line.originalCurrency === 'GHS') {
      const lineGhs = hasDebit ? line.debitAmountGhs : line.creditAmountGhs;
      if (line.originalAmount !== lineGhs) {
        errors.push(`Line ${i + 1}: GHS line base amount (${lineGhs}) must equal original amount (${line.originalAmount}).`);
      }
    }

    totalDebit += line.debitAmountGhs;
    totalCredit += line.creditAmountGhs;

    // Track per-fund totals
    const currentFundTotal = fundTotals.get(line.fundId) ?? { debit: 0n, credit: 0n };
    fundTotals.set(line.fundId, {
      debit: currentFundTotal.debit + line.debitAmountGhs,
      credit: currentFundTotal.credit + line.creditAmountGhs,
    });
  }

  // 3. Double-entry equality (Debits == Credits in base currency)
  if (totalDebit !== totalCredit) {
    errors.push(`Entry is unbalanced in base currency: Total Debits (${totalDebit} pesewas) <> Total Credits (${totalCredit} pesewas). Difference: ${totalDebit - totalCredit}.`);
  }

  // 4. Header Control Totals
  if (entry.totalDebitGhs !== totalDebit || entry.totalCreditGhs !== totalCredit) {
    errors.push(`Header control totals (Dr: ${entry.totalDebitGhs}, Cr: ${entry.totalCreditGhs}) do not match line sums (Dr: ${totalDebit}, Cr: ${totalCredit}).`);
  }

  // 5. Fund Accounting Balancing Rule
  // In fund accounting, each fund must balance on its own, or use interfund accounts
  for (const [fundId, fTotals] of fundTotals.entries()) {
    if (fTotals.debit !== fTotals.credit) {
      const fName = fundsMap?.get(fundId)?.name ?? fundId;
      errors.push(`Fund "${fName}" is unbalanced in this entry (Dr: ${fTotals.debit}, Cr: ${fTotals.credit}). Interfund clearing requires balancing lines.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a validated JournalEntry, converting dual-currency lines and handling rounding remainders.
 */
export function createJournalEntry(input: CreateJournalEntryInput): JournalEntry {
  const lines: JournalLine[] = [];
  let totalDebit = 0n;
  let totalCredit = 0n;

  for (let i = 0; i < input.lines.length; i++) {
    const rawLine = input.lines[i]!;
    const conversion = convertLineToBaseCurrency(
      rawLine.originalAmount,
      rawLine.originalCurrency,
      rawLine.exchangeRate
    );

    const debitAmount = rawLine.isDebit ? conversion.baseAmountGhs : 0n;
    const creditAmount = rawLine.isDebit ? 0n : conversion.baseAmountGhs;

    totalDebit += debitAmount;
    totalCredit += creditAmount;

    lines.push({
      id: rawLine.id,
      journalEntryId: input.id,
      accountId: rawLine.accountId,
      fundId: rawLine.fundId,
      lineNumber: i + 1,
      originalCurrency: rawLine.originalCurrency,
      originalAmount: rawLine.originalAmount,
      exchangeRate: conversion.exchangeRate,
      debitAmountGhs: debitAmount,
      creditAmountGhs: creditAmount,
      roundingDifferencePesewas: conversion.roundingDifference,
      description: rawLine.description ?? null,
    });
  }

  // Check balancing difference
  const difference = totalDebit - totalCredit;

  // Auto-balance rounding differences (if 1-2 pesewas discrepancy caused by rate conversion)
  if (difference !== 0n && input.autoBalanceRounding && input.roundingAccountId && input.defaultFundId) {
    const absDiff = difference < 0n ? -difference : difference;
    if (absDiff <= 2n) {
      const isDebitDiff = difference < 0n; // Credits > Debits -> Need Debit to Rounding Differences
      const roundingLineNumber = lines.length + 1;

      lines.push({
        id: `rounding-${input.id}`,
        journalEntryId: input.id,
        accountId: input.roundingAccountId,
        fundId: input.defaultFundId,
        lineNumber: roundingLineNumber,
        originalCurrency: 'GHS',
        originalAmount: absDiff,
        exchangeRate: '1.0000',
        debitAmountGhs: isDebitDiff ? absDiff : 0n,
        creditAmountGhs: isDebitDiff ? 0n : absDiff,
        roundingDifferencePesewas: absDiff,
        description: 'Automatic FX / Line Rounding Adjustment',
      });

      if (isDebitDiff) {
        totalDebit += absDiff;
      } else {
        totalCredit += absDiff;
      }
    }
  }

  return {
    id: input.id,
    branchId: input.branchId,
    documentNumber: input.documentNumber,
    entryDate: input.entryDate,
    periodId: input.period?.id ?? null,
    entryType: input.entryType ?? 'STANDARD',
    narration: input.narration,
    lineCount: lines.length,
    totalDebitGhs: totalDebit,
    totalCreditGhs: totalCredit,
    isReversal: false,
    reversalOfId: null,
    createdBy: input.createdBy,
    deviceId: input.deviceId,
    createdAt: new Date().toISOString(),
    lines: Object.freeze(lines),
    treasurerOverride: input.treasurerOverride ?? null,
  };
}

/**
 * Creates an immutable linked reversal entry.
 * Exactly flips debits and credits from the original entry, maintaining the original amounts.
 */
export function createReversalEntry(params: {
  reversalEntryId: string;
  originalEntry: JournalEntry;
  documentNumber: string;
  reversalDate: string; // 'YYYY-MM-DD'
  reason: string;
  reversedBy: string;
  deviceId: string;
  period?: AccountingPeriod | null;
}): JournalEntry {
  const orig = params.originalEntry;

  const reversedLines: JournalLine[] = orig.lines.map((line, idx) => ({
    id: `rev-${params.reversalEntryId}-${idx + 1}`,
    journalEntryId: params.reversalEntryId,
    accountId: line.accountId,
    fundId: line.fundId,
    lineNumber: idx + 1,
    originalCurrency: line.originalCurrency,
    originalAmount: line.originalAmount,
    exchangeRate: line.exchangeRate,
    // Flipped!
    debitAmountGhs: line.creditAmountGhs,
    creditAmountGhs: line.debitAmountGhs,
    roundingDifferencePesewas: line.roundingDifferencePesewas,
    description: `Reversal: ${line.description ?? ''}`.trim(),
  }));

  return {
    id: params.reversalEntryId,
    branchId: orig.branchId,
    documentNumber: params.documentNumber,
    entryDate: params.reversalDate,
    periodId: params.period?.id ?? null,
    entryType: 'REVERSAL',
    narration: `Reversal of ${orig.documentNumber}. Reason: ${params.reason}`,
    lineCount: reversedLines.length,
    totalDebitGhs: orig.totalCreditGhs,
    totalCreditGhs: orig.totalDebitGhs,
    isReversal: true,
    reversalOfId: orig.id,
    createdBy: params.reversedBy,
    deviceId: params.deviceId,
    createdAt: new Date().toISOString(),
    lines: Object.freeze(reversedLines),
  };
}

/**
 * Computes a full double-entry Trial Balance and Fund Balances from journal entries.
 */
export function calculateTrialBalance(
  entries: readonly JournalEntry[],
  accounts: readonly Account[],
  funds: readonly Fund[],
  asOfDate?: string
): TrialBalanceReport {
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  const accountDebits = new Map<string, bigint>();
  const accountCredits = new Map<string, bigint>();

  // Fund tracking: track revenue inflows (Income/Equity) and expenditure outflows (Expense)
  const fundInflows = new Map<string, bigint>();
  const fundOutflows = new Map<string, bigint>();
  const fundTotalDebits = new Map<string, bigint>();
  const fundTotalCredits = new Map<string, bigint>();

  let totalDebitsGhs = 0n;
  let totalCreditsGhs = 0n;

  for (const entry of entries) {
    if (asOfDate && entry.entryDate > asOfDate) {
      continue;
    }

    for (const line of entry.lines) {
      const curDr = accountDebits.get(line.accountId) ?? 0n;
      const curCr = accountCredits.get(line.accountId) ?? 0n;
      accountDebits.set(line.accountId, curDr + line.debitAmountGhs);
      accountCredits.set(line.accountId, curCr + line.creditAmountGhs);

      const fDr = fundTotalDebits.get(line.fundId) ?? 0n;
      const fCr = fundTotalCredits.get(line.fundId) ?? 0n;
      fundTotalDebits.set(line.fundId, fDr + line.debitAmountGhs);
      fundTotalCredits.set(line.fundId, fCr + line.creditAmountGhs);

      const account = accountsMap.get(line.accountId);
      if (account) {
        if (account.type === 'Income' || account.type === 'Equity') {
          // Inflows: Credit adds to fund, Debit subtracts
          const curInflow = fundInflows.get(line.fundId) ?? 0n;
          fundInflows.set(line.fundId, curInflow + line.creditAmountGhs - line.debitAmountGhs);
        } else if (account.type === 'Expense') {
          // Outflows: Debit is expense
          const curOutflow = fundOutflows.get(line.fundId) ?? 0n;
          fundOutflows.set(line.fundId, curOutflow + line.debitAmountGhs - line.creditAmountGhs);
        }
      }

      totalDebitsGhs += line.debitAmountGhs;
      totalCreditsGhs += line.creditAmountGhs;
    }
  }

  // Account rows
  const trialBalanceAccounts: TrialBalanceItem[] = accounts.map((account) => {
    const dr = accountDebits.get(account.id) ?? 0n;
    const cr = accountCredits.get(account.id) ?? 0n;

    let net = 0n;
    if (account.type === 'Asset' || account.type === 'Expense') {
      net = dr - cr;
    } else {
      net = cr - dr;
    }

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      currency: account.currency,
      debitGhs: dr,
      creditGhs: cr,
      netBalanceGhs: net,
    };
  });

  // Fund balance rows (Fund Accounting: Net Balance = Inflows - Outflows)
  const fundBalanceItems: FundBalanceItem[] = funds.map((fund) => {
    const inflows = fundInflows.get(fund.id) ?? 0n;
    const outflows = fundOutflows.get(fund.id) ?? 0n;
    const net = inflows - outflows;
    const isOverdrawn = !fund.allowOverdraft && net < 0n;

    return {
      fundId: fund.id,
      fundCode: fund.code,
      fundName: fund.name,
      fundType: fund.type,
      allowOverdraft: fund.allowOverdraft,
      totalDebitGhs: fundTotalDebits.get(fund.id) ?? 0n,
      totalCreditGhs: fundTotalCredits.get(fund.id) ?? 0n,
      netBalanceGhs: net,
      isOverdrawn,
    };
  });

  const difference = totalDebitsGhs - totalCreditsGhs;

  return {
    asOfDate: asOfDate ?? new Date().toISOString().slice(0, 10),
    branchId: entries[0]?.branchId ?? '00000000-0000-0000-0000-000000000001',
    totalDebitsGhs,
    totalCreditsGhs,
    differenceGhs: difference,
    isBalanced: difference === 0n,
    accounts: trialBalanceAccounts,
    fundBalances: fundBalanceItems,
  };
}

/**
 * Calculates Month-End USD Revaluation.
 * Revalues USD bank and cash balances at the period closing exchange rate.
 * Generates preview lines for Foreign Exchange Gain/Loss.
 */
export function calculateRevaluation(params: {
  entries: readonly JournalEntry[];
  usdAccounts: readonly Account[];
  closingRate: string; // e.g. "16.0000"
  revaluationDate: string;
  fxGainLossAccountId: string;
  generalFundId: string;
}): {
  readonly revaluationLines: readonly {
    accountId: string;
    accountName: string;
    usdBalanceCents: bigint;
    currentGhsBookValue: bigint;
    newGhsValue: bigint;
    differenceGhs: bigint;
    isGain: boolean;
  }[];
  readonly totalAdjustmentGhs: bigint;
  readonly isNetGain: boolean;
} {
  const rate = new Big(params.closingRate);

  const lines: {
    accountId: string;
    accountName: string;
    usdBalanceCents: bigint;
    currentGhsBookValue: bigint;
    newGhsValue: bigint;
    differenceGhs: bigint;
    isGain: boolean;
  }[] = [];

  let totalAdjustment = 0n;

  for (const acct of params.usdAccounts) {
    if (acct.currency !== 'USD' || !acct.isBankOrCash) {
      continue;
    }

    let usdBalance = 0n;
    let currentGhs = 0n;

    for (const entry of params.entries) {
      if (entry.entryDate > params.revaluationDate) continue;

      for (const line of entry.lines) {
        if (line.accountId === acct.id) {
          if (line.debitAmountGhs > 0n) {
            usdBalance += line.originalAmount;
            currentGhs += line.debitAmountGhs;
          } else {
            usdBalance -= line.originalAmount;
            currentGhs -= line.creditAmountGhs;
          }
        }
      }
    }

    if (usdBalance === 0n && currentGhs === 0n) {
      continue;
    }

    // New GHS value at closing rate
    const exactNewGhs = new Big(usdBalance.toString()).times(rate).round(0, Big.roundHalfEven);
    const newGhs = BigInt(exactNewGhs.toFixed(0));
    const diff = newGhs - currentGhs;

    if (diff !== 0n) {
      const isGain = diff > 0n;
      lines.push({
        accountId: acct.id,
        accountName: acct.name,
        usdBalanceCents: usdBalance,
        currentGhsBookValue: currentGhs,
        newGhsValue: newGhs,
        differenceGhs: diff < 0n ? -diff : diff,
        isGain,
      });

      totalAdjustment += diff;
    }
  }

  return {
    revaluationLines: lines,
    totalAdjustmentGhs: totalAdjustment < 0n ? -totalAdjustment : totalAdjustment,
    isNetGain: totalAdjustment > 0n,
  };
}
