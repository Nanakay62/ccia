import type { Currency } from '../money/index.js';
import type { FundType, JournalEntry, TrialBalanceReport } from '../ledger/types.js';

export interface OpeningBalanceRowInput {
  readonly rowNumber: number;
  readonly accountCode: string;
  readonly fundCode: string;
  readonly currency: Currency;
  readonly debitOriginalMinor: bigint; // Pesewas (GHS) or Cents (USD)
  readonly creditOriginalMinor: bigint;
  readonly exchangeRate: string; // "1.0000" for GHS, e.g. "15.5000" for USD
  readonly rateDate?: string | null; // Required when currency === 'USD'
  readonly description?: string | null;
}

export interface StatementOrCashProofInput {
  readonly accountCode: string;
  readonly statementOrCountBalanceGhs: bigint; // Pesewas (GHS equivalent)
  readonly statementDate: string; // 'YYYY-MM-DD'
  readonly reference: string; // e.g. "GCB Oct Statement #104" or "Safe Cash Count Sheet #CC-01"
  readonly attachmentFileName?: string | null;
}

export interface CutOverSubledgerProofs {
  readonly statementAndCashProofs: readonly StatementOrCashProofInput[];
  readonly fixedAssetRegisterCostGhs?: bigint | null;
  readonly fixedAssetAccumDepreciationGhs?: bigint | null;
  readonly openPledgesByCampaignTotalGhs?: bigint | null;
  readonly payablesScheduleTotalGhs?: bigint | null;
  readonly receivablesScheduleTotalGhs?: bigint | null;
}

export interface OpeningBalanceRowDiagnostic {
  readonly rowNumber: number;
  readonly severity: 'ERROR' | 'WARNING';
  readonly accountCode: string;
  readonly fundCode: string;
  readonly message: string;
}

export interface FundOpeningBalanceSummary {
  readonly fundId: string;
  readonly fundCode: string;
  readonly fundName: string;
  readonly fundType: FundType;
  readonly lineCount: number;
  readonly totalDebitGhs: bigint;
  readonly totalCreditGhs: bigint;
  readonly differenceGhs: bigint; // Debit - Credit (never plugged automatically!)
  readonly isBalanced: boolean;
}

export interface StatementComparisonItem {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly currency: Currency;
  readonly ledgerOpeningBalanceGhs: bigint;
  readonly statementOrCountBalanceGhs: bigint;
  readonly differenceGhs: bigint;
  readonly agrees: boolean;
  readonly statementDate: string;
  readonly reference: string;
  readonly attachmentFileName?: string | null;
}

export interface SubledgerAgreementItem {
  readonly category: 'FIXED_ASSETS_COST' | 'FIXED_ASSETS_ACCUM_DEP' | 'PAYABLES' | 'RECEIVABLES' | 'OPEN_PLEDGES_MEMO';
  readonly label: string;
  readonly ledgerAmountGhs: bigint;
  readonly subledgerScheduleAmountGhs: bigint;
  readonly differenceGhs: bigint;
  readonly agrees: boolean;
}

export interface OpeningBalanceValidationReport {
  readonly isValid: boolean;
  readonly cutOverDate: string;
  readonly rowCount: number;
  readonly totalDebitGhs: bigint;
  readonly totalCreditGhs: bigint;
  readonly overallDifferenceGhs: bigint;
  readonly isOverallBalanced: boolean;
  readonly allFundsBalanced: boolean;
  readonly allStatementsAgree: boolean;
  readonly allSubledgersAgree: boolean;
  readonly fundSummaries: readonly FundOpeningBalanceSummary[];
  readonly statementComparisons: readonly StatementComparisonItem[];
  readonly subledgerAgreements: readonly SubledgerAgreementItem[];
  readonly rowDiagnostics: readonly OpeningBalanceRowDiagnostic[];
}

export interface OpeningBalanceDryRunResult {
  readonly validation: OpeningBalanceValidationReport;
  readonly proposedEntriesByFund: readonly JournalEntry[];
  readonly resultingTrialBalance: TrialBalanceReport;
}

export interface OpeningBalanceCommitParams {
  readonly dryRun: OpeningBalanceDryRunResult;
  readonly treasurerSignedBy: string;
  readonly pastorOrElderApprovedBy: string;
  readonly isPostGoLive?: boolean;
  readonly postGoLiveReason?: string;
}

// ============================================================================
// PHASE 2: IMPORT TOOL & GO-LIVE READINESS (Spec Sections B3 & B5)
// ============================================================================

export type ImportTemplateType =
  | 'MEMBERS'
  | 'OPENING_BALANCES'
  | 'FIXED_ASSETS'
  | 'PLEDGES'
  | 'PRIOR_GIVING_HISTORY'
  | 'HISTORICAL_TRANSACTIONS';

export type ImportBatchStatus = 'VALIDATED' | 'COMMITTED' | 'REVERSED';

export interface ImportTemplateDefinition {
  readonly type: ImportTemplateType;
  readonly label: string;
  readonly description: string;
  readonly isDiscouraged?: boolean;
  readonly discouragedNote?: string;
  readonly requiredFields: readonly {
    readonly key: string;
    readonly label: string;
    readonly required: boolean;
    readonly containsPii?: boolean;
  }[];
  readonly sampleCsv: string;
}

export type ImportColumnMapping = Readonly<Record<string, string>>; // templateFieldKey -> csvHeaderName

export interface ImportRowDiagnostic {
  readonly rowNumber: number;
  readonly severity: 'ERROR' | 'WARNING';
  readonly fieldKey: string;
  readonly message: string;
  readonly maskedValue?: string;
}

export interface ImportDryRunRecordSummary {
  readonly recordType: string;
  readonly count: number;
  readonly totalAmountGhs: bigint;
  readonly notes: string;
}

export interface ImportValidationAndDryRunResult {
  readonly templateType: ImportTemplateType;
  readonly fileName: string;
  readonly fileSha256: string;
  readonly isDuplicateFile: boolean;
  readonly duplicateOfBatchNumber?: string | null;
  readonly totalRows: number;
  readonly validRowCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly canCommit: boolean;
  readonly diagnostics: readonly ImportRowDiagnostic[];
  readonly mappedRows: readonly Record<string, string>[];
  readonly recordSummaries: readonly ImportDryRunRecordSummary[];
  readonly proposedJournalEntries: readonly JournalEntry[];
  readonly resultingTrialBalance: TrialBalanceReport;
}

export interface ImportBatchRecord {
  readonly id: string;
  readonly batchNumber: string; // e.g., "IMP-0001"
  readonly templateType: ImportTemplateType;
  readonly fileName: string;
  readonly fileSha256: string;
  readonly columnMapping: ImportColumnMapping;
  readonly rowCount: number;
  readonly totalImpactGhs: bigint;
  readonly status: ImportBatchStatus;
  readonly periodId: string;
  readonly createdJournalEntryIds: readonly string[];
  readonly createdRecordIds: readonly string[];
  readonly mappedRows: readonly Record<string, string>[];
  readonly committedBy: string;
  readonly committedAt: string;
  readonly postGoLiveApprovedBy?: string | null;
  readonly postGoLiveReason?: string | null;
  readonly reversedAt?: string | null;
  readonly reversedBy?: string | null;
  readonly reversalReason?: string | null;
  readonly reversalEntryIds?: readonly string[];
}

export interface RoleTrainingRecord {
  readonly userId: string;
  readonly userName: string;
  readonly role: string;
  readonly trained: boolean;
  readonly trainedDate?: string | null; // YYYY-MM-DD
  readonly trainerOrNotes?: string | null;
}

export type GoLiveCheckKey =
  | 'CHURCH_PROFILE_SET'
  | 'CHART_OF_ACCOUNTS_REVIEWED'
  | 'FUNDS_SET_UP'
  | 'BANK_MOMO_CASH_CONFIGURED'
  | 'DENOMINATIONAL_REMITTANCE_RULE_SET'
  | 'EXCHANGE_RATE_ENTERED'
  | 'OPENING_BALANCES_POSTED_AND_BALANCED'
  | 'OPENING_BANK_RECONCILIATIONS_SIGNED_OFF'
  | 'OPENING_CASH_COUNTS_SIGNED_OFF'
  | 'FIXED_ASSET_REGISTER_RECONCILED'
  | 'USERS_CREATED_MFA_ENROLLED'
  | 'APPROVAL_LIMITS_CONFIGURED'
  | 'ROLE_TRAINING_COMPLETED'
  | 'BACKUP_TAKEN_AND_RESTORE_TESTED'
  | 'PARALLEL_RUN_APPROVED'
  | 'DEMO_DATA_ABSENT';

export interface GoLiveCheckItem {
  readonly key: GoLiveCheckKey;
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly passed: boolean;
  readonly statusText: string;
  readonly targetRoute: string;
  readonly actionLabel: string;
}

export interface GoLiveReadinessReport {
  readonly isLive: boolean;
  readonly wentLiveAt?: string | null;
  readonly treasurerConfirmedBy?: string | null;
  readonly pastorOrElderConfirmedBy?: string | null;
  readonly demoModePermanentlyDisabled: boolean;
  readonly allChecksPassed: boolean;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly items: readonly GoLiveCheckItem[];
  readonly roleTrainings: readonly RoleTrainingRecord[];
}

// ============================================================================
// PHASE 3: PARALLEL RUN & COMPARISON (Spec Section B4)
// ============================================================================

export type ParallelRunRowStatus = 'AGREES' | 'EXPLAINED' | 'UNEXPLAINED';

export interface OldBookBalanceInput {
  readonly accountCode: string;
  readonly fundCode: string;
  readonly oldBookBalanceGhs: bigint; // Pesewas (positive for normal balance)
  readonly explanation?: string | null;
}

export interface ParallelRunComparisonRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: string;
  readonly fundId: string;
  readonly fundCode: string;
  readonly fundName: string;
  readonly oldBookBalanceGhs: bigint;   // in Pesewas
  readonly systemBalanceGhs: bigint;    // in Pesewas
  readonly varianceGhs: bigint;         // oldBookBalanceGhs - systemBalanceGhs
  readonly status: ParallelRunRowStatus;
  readonly explanation: string;
}

export interface ParallelRunMonthSummary {
  readonly periodId: string;
  readonly periodLabel: string; // e.g. "September 2026", "October 2026"
  readonly asOfDate: string;    // e.g. "2026-09-30"
  readonly totalAccountsCompared: number;
  readonly agreesCount: number;
  readonly explainedCount: number;
  readonly unexplainedCount: number;
  readonly totalOldBooksGhs: bigint;
  readonly totalSystemGhs: bigint;
  readonly netVarianceGhs: bigint;
  readonly isApproved: boolean;
  readonly approvedByTreasurer?: string | null;
  readonly approvedAt?: string | null;
  readonly canApprove: boolean; // true if unexplainedCount === 0
  readonly statusSummary: string; // e.g. "October agrees", "November 2 unexplained differences"
}

export interface ParallelRunOverallReport {
  readonly requiredMonthEnds: number; // default 2 (Section 5, D7)
  readonly approvedMonthEndsCount: number;
  readonly isParallelRunComplete: boolean;
  readonly summaryLine: string; // e.g. "Parallel run: September agrees, October agrees"
  readonly months: readonly ParallelRunMonthSummary[];
}


