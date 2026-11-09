import type { Currency } from '../money/index.js';

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
export type FundType = 'Unrestricted' | 'Restricted';

export interface Account {
  readonly id: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly isBankOrCash: boolean;
  readonly parentId?: string | null;
  readonly isActive: boolean;
}

export interface Fund {
  readonly id: string;
  readonly branchId: string;
  readonly code: string;
  readonly name: string;
  readonly type: FundType;
  readonly description?: string | null;
  readonly allowOverdraft: boolean;
  readonly isActive: boolean;
}

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';

export interface AccountingPeriod {
  readonly id: string;
  readonly branchId: string;
  readonly financialYearId?: string | null;
  readonly year: number;
  readonly month: number; // 1..12, or 13 for auditor adjustment period
  readonly isAdjustmentPeriod?: boolean;
  readonly status?: PeriodStatus;
  readonly startDate: string; // ISO date 'YYYY-MM-DD'
  readonly endDate: string;   // ISO date 'YYYY-MM-DD'
  readonly isClosed: boolean;
  readonly softClosedAt?: string | null;
  readonly softClosedBy?: string | null;
  readonly closedAt?: string | null;
  readonly closedBy?: string | null;
}

export interface ExchangeRate {
  readonly id: string;
  readonly branchId: string;
  readonly rateDate: string; // 'YYYY-MM-DD'
  readonly currency: 'USD';
  readonly rate: string;     // e.g. "15.5000"
  readonly enteredBy: string;
  readonly notes?: string | null;
}

export type JournalEntryType =
  | 'STANDARD'
  | 'COUNTING_SHEET'
  | 'VOUCHER'
  | 'REVALUATION'
  | 'REVERSAL'
  | 'OPENING_BALANCE'
  | 'YEAR_END_CLOSING'
  | 'ACCRUAL_PREPAYMENT'
  | 'IMPORTED';

export interface JournalLine {
  readonly id: string;
  readonly journalEntryId: string;
  readonly accountId: string;
  readonly fundId: string;
  readonly lineNumber: number;
  readonly originalCurrency: Currency;
  readonly originalAmount: bigint; // Minor units (pesewas/cents)
  readonly exchangeRate: string;   // e.g. "15.5000"
  readonly debitAmountGhs: bigint;  // Pesewas
  readonly creditAmountGhs: bigint; // Pesewas
  readonly roundingDifferencePesewas: bigint;
  readonly description?: string | null;
}

export interface JournalEntry {
  readonly id: string;
  readonly branchId: string;
  readonly financialYearId?: string | null;
  readonly documentNumber: string;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly periodId?: string | null;
  readonly isAdjustmentPeriodEntry?: boolean;
  readonly importBatchId?: string | null;
  readonly autoReverseOnDate?: string | null;
  readonly entryType: JournalEntryType;
  readonly narration: string;
  readonly lineCount: number;
  readonly totalDebitGhs: bigint;
  readonly totalCreditGhs: bigint;
  readonly isReversal: boolean;
  readonly reversalOfId?: string | null;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly createdAt: string;
  readonly lines: readonly JournalLine[];
  readonly treasurerOverride?: {
    readonly isOverridden: boolean;
    readonly reason: string;
    readonly authorizedBy: string;
  } | null;
}

export interface TrialBalanceItem {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: AccountType;
  readonly currency: Currency;
  readonly debitGhs: bigint;
  readonly creditGhs: bigint;
  readonly netBalanceGhs: bigint; // Debit - Credit for Assets/Expenses; Credit - Debit for Liabilities/Equity/Income
}

export interface FundBalanceItem {
  readonly fundId: string;
  readonly fundCode: string;
  readonly fundName: string;
  readonly fundType: FundType;
  readonly allowOverdraft: boolean;
  readonly totalDebitGhs: bigint;
  readonly totalCreditGhs: bigint;
  readonly netBalanceGhs: bigint; // Credit (Income/Equity) - Debit (Expenses/Assets allocation)
  readonly isOverdrawn: boolean;
}

export interface TrialBalanceReport {
  readonly asOfDate: string;
  readonly branchId: string;
  readonly totalDebitsGhs: bigint;
  readonly totalCreditsGhs: bigint;
  readonly differenceGhs: bigint; // totalDebitsGhs - totalCreditsGhs
  readonly isBalanced: boolean;
  readonly accounts: readonly TrialBalanceItem[];
  readonly fundBalances: readonly FundBalanceItem[];
}
