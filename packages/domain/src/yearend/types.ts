import type { AccountingPeriod, PeriodStatus, JournalEntry, FundType } from '../ledger/types.js';

export type FinancialYearStatus =
  | 'OPEN'
  | 'CLOSING_IN_PROGRESS'
  | 'LOCKED'
  | 'REOPENED_ADJUSTMENT_ONLY';

export interface FinancialYear {
  readonly id: string;
  readonly branchId: string;
  readonly label: string; // e.g. 'FY2026'
  readonly startMonth: number; // 1..12 (1 = January)
  readonly startDate: string; // 'YYYY-MM-DD'
  readonly endDate: string; // 'YYYY-MM-DD'
  readonly hasAdjustmentPeriod: boolean; // Period 13
  readonly status: FinancialYearStatus;
  readonly lockedAt?: string | null;
  readonly lockedBy?: string | null;
  readonly reopenedAt?: string | null;
  readonly reopenedBy?: string | null;
  readonly reopenApprovedBy?: string | null;
  readonly reopenReason?: string | null;
}

export interface FinancialYearWithPeriods {
  readonly financialYear: FinancialYear;
  readonly periods: readonly AccountingPeriod[];
}

export interface PeriodPostingPermission {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly routeOfflineToNeedsAttention?: boolean;
}

export interface ComparativeLineItem {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  readonly currentYearGhs: bigint;
  readonly priorYearGhs: bigint;
  readonly varianceGhs: bigint;
  readonly variancePercent: number | null;
}

export { type PeriodStatus };

// Year-End Checklist (Spec Section A2)
export type YearEndCheckKey =
  // 11 Blocking checks
  | 'ALL_MONTHS_CLOSED'
  | 'BANK_MOMO_RECONCILED'
  | 'CASH_COUNTS_DONE'
  | 'PAYROLL_POSTED_PAID'
  | 'USD_REVALUATION_RUN'
  | 'DEPRECIATION_RUN'
  | 'INTEGRITY_CHECK_PASS'
  | 'TRIAL_BALANCE_BALANCED'
  | 'SUSPENSE_CLEARING_ZERO'
  | 'NEEDS_ATTENTION_EMPTY'
  | 'REMITTANCE_PAYABLE_AGREES'
  // 4 Advisory checks
  | 'NEXT_YEAR_BUDGET_CREATED'
  | 'ASSET_VERIFICATION_DONE'
  | 'OPEN_REQUISITIONS_PENDING'
  | 'OUTSTANDING_PLEDGES_REVIEW';

export type YearEndCheckStatus = 'PASS' | 'FAIL' | 'OVERRIDDEN' | 'WARNING';

export interface YearEndCheckResult {
  readonly key: YearEndCheckKey;
  readonly title: string;
  readonly description: string;
  readonly category: 'BLOCKING' | 'ADVISORY';
  readonly status: YearEndCheckStatus;
  readonly targetRoute?: string;
  readonly details?: string;
  readonly overrideReason?: string;
  readonly overriddenBy?: string;
  readonly overriddenAt?: string;
}

export interface YearEndOverride {
  readonly checkKey: YearEndCheckKey;
  readonly reason: string;
  readonly overriddenByTreasurerId: string;
  readonly overriddenByTreasurerName: string;
  readonly timestamp: string;
}

export interface YearEndChecklistEvaluation {
  readonly isCloseAllowed: boolean;
  readonly blockingFailedCount: number;
  readonly blockingOverriddenCount: number;
  readonly advisoryWarningCount: number;
  readonly checks: readonly YearEndCheckResult[];
  readonly overrides: readonly YearEndOverride[];
}

// Fund Closing Preview (Spec Section A3)
export interface FundClosingSummary {
  readonly fundId: string;
  readonly fundName: string;
  readonly fundType: FundType;
  readonly totalIncomePesewas: bigint;
  readonly totalExpensePesewas: bigint;
  readonly netSurplusPesewas: bigint;
  readonly broughtForwardPesewas: bigint;
  readonly carriedForwardPesewas: bigint;
  readonly hasDeficitWarning: boolean;
}

export interface YearEndClosingPreview {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly fundSummaries: readonly FundClosingSummary[];
  readonly totalIncomePesewas: bigint;
  readonly totalExpensePesewas: bigint;
  readonly totalNetSurplusPesewas: bigint;
  readonly totalCarriedForwardPesewas: bigint;
  readonly netAssetsPesewas: bigint;
  readonly isReconciledToNetAssets: boolean;
  readonly restrictedFundsWithDeficits: readonly string[];
}

// Year-End Closing Entry & Approvals (Spec Section A3)
export interface YearEndClosingSignOff {
  readonly executedByTreasurerId: string;
  readonly executedByTreasurerName: string;
  readonly executedAt: string;
  readonly approvedByPastorId: string;
  readonly approvedByPastorName: string;
  readonly approvedAt: string;
  readonly auditorSignOffId?: string | null;
  readonly auditorSignOffName?: string | null;
  readonly auditorSignOffAt?: string | null;
}

export interface YearEndCloseRunResult {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly closingEntries: readonly JournalEntry[];
  readonly signOff: YearEndClosingSignOff;
  readonly issuedPackId: string;
  readonly lockedAt: string;
}

// Issued Year-End Pack (Spec Section A3)
export type IssuedReportType =
  | 'INCOME_AND_EXPENDITURE'
  | 'BALANCE_SHEET'
  | 'FUND_BALANCES'
  | 'CASH_FLOW'
  | 'TRIAL_BALANCE_PRE_CLOSE'
  | 'TRIAL_BALANCE_POST_CLOSE'
  | 'FIXED_ASSET_MOVEMENT'
  | 'BANK_RECONCILIATIONS'
  | 'REMITTANCE_STATEMENT'
  | 'OVERRIDES_SUMMARY'
  | 'PAYROLL_YEAR_SUMMARY';

export interface IssuedReportRecord {
  readonly id: string;
  readonly reportType: IssuedReportType;
  readonly reportTitle: string;
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly sha256Hash: string;
  readonly summaryFigures: Record<string, string>;
  readonly payloadSnapshotJson: string;
}

export interface IssuedYearEndPack {
  readonly id: string;
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly reports: readonly IssuedReportRecord[];
  readonly overridesCount: number;
  readonly packSha256Checksum: string;
}

// Accruals and Prepayments (Spec Section A2 & D3)
export type AccrualPrepaymentType =
  | 'EXPENSE_ACCRUAL' // Dr Expense, Cr Accrued Expenses (Current Liability)
  | 'REVENUE_PREPAYMENT' // Dr Revenue Received, Cr Deferred Income (Current Liability)
  | 'EXPENSE_PREPAYMENT'; // Dr Prepaid Expense (Current Asset), Cr Expense

export interface AccrualPrepaymentEntry {
  readonly id: string;
  readonly type: AccrualPrepaymentType;
  readonly date: string; // Year-end date, e.g. 2026-12-31
  readonly autoReverseDate: string; // First day of next year, e.g. 2027-01-01
  readonly description: string;
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  readonly amountPesewas: bigint;
  readonly fundId: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

// Brought-forward delta notice for Period 13 adjustments (Spec Section A3)
export interface AccountDeltaItem {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly oldBroughtForwardPesewas: bigint;
  readonly newBroughtForwardPesewas: bigint;
  readonly deltaPesewas: bigint;
}

export interface BroughtForwardDeltaNotice {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly adjustedPeriodNumber: 13;
  readonly postedAt: string;
  readonly actorName: string;
  readonly reason: string;
  readonly accountDeltas: readonly AccountDeltaItem[];
  readonly totalNetAssetsDeltaPesewas: bigint;
}

