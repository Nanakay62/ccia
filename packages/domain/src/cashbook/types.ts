import type { Currency } from '../money/index.js';
import type { PaymentMethod } from '../giving/types.js';

export type CashAccountKind = 'cash' | 'bank' | 'mobile' | 'petty';
export type CashbookDirection = 'RECEIPT' | 'PAYMENT' | 'TRANSFER';
export type CashbookSource = 'MANUAL' | 'COUNTING_SHEET' | 'VOUCHER' | 'GIVING' | 'TRANSFER';
export type ChequeStatus = 'ISSUED' | 'PRESENTED' | 'CANCELLED' | 'STALE';

export interface CashAccount {
  readonly id: string;
  readonly branchId: string;
  readonly accountId: string; // Refers to Account.id
  readonly code: string;       // e.g. "1010"
  readonly name: string;       // e.g. "Cash on Hand (GHS)"
  readonly kind: CashAccountKind;
  readonly currency: Currency;
  readonly bankName?: string;
  readonly branchName?: string;
  readonly accountNumberMasked?: string;
  readonly allowOverdraft: boolean;
  readonly openingBalance: bigint; // Minor units (pesewas/cents)
  readonly openingDate: string;     // 'YYYY-MM-DD'
  readonly isActive: boolean;
}

export interface CashbookEntry {
  readonly id: string;
  readonly branchId: string;
  readonly journalEntryId: string;
  readonly cashAccountId: string;
  readonly direction: CashbookDirection;
  readonly entryDate: string; // 'YYYY-MM-DD'
  readonly refNumber: string;
  readonly details: string;
  readonly fundId: string;
  readonly fundCode: string;
  readonly counterpartAccountId: string;
  readonly counterpartAccountName: string;
  readonly category?: string; // For analysed view: Tithes, Offerings, Salaries, etc.
  readonly amount: bigint;    // Minor units in cashbook account currency
  readonly exchangeRate?: string; // e.g. "15.5000" for USD accounts
  readonly amountGhs?: bigint;    // Converted to base currency
  readonly method: PaymentMethod;
  readonly chequeNumber?: string;
  readonly linkedVoucherId?: string;
  readonly linkedCountingSheetId?: string;
  readonly source: CashbookSource;
  readonly isReversal: boolean;
  readonly reversalOfId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly runningBalance?: bigint;
}

export interface CashCountLine {
  readonly denomination: number; // e.g. 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10
  readonly quantity: number;
  readonly lineTotal: bigint;    // in pesewas
}

export interface CashCountSignatory {
  readonly userId: string;
  readonly fullName: string;
  readonly role: string;
  readonly signedAt: string;
}

export interface CashCount {
  readonly id: string;
  readonly branchId: string;
  readonly cashAccountId: string;
  readonly countDate: string; // 'YYYY-MM-DD'
  readonly countTime: string; // 'HH:MM'
  readonly bookBalance: bigint;
  readonly physicalBalance: bigint;
  readonly difference: bigint; // physical - book
  readonly reason?: string;
  readonly firstSignatory: CashCountSignatory;
  readonly secondSignatory: CashCountSignatory;
  readonly status: 'BALANCED' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED';
  readonly journalEntryId?: string;
  readonly lines: readonly CashCountLine[];
}

export interface ChequeItem {
  readonly id: string;
  readonly branchId: string;
  readonly bankAccountId: string;
  readonly chequeNumber: string;
  readonly payee: string;
  readonly amount: bigint;
  readonly currency: Currency;
  readonly issueDate: string; // 'YYYY-MM-DD'
  readonly status: ChequeStatus;
  readonly presentedDate?: string;
  readonly staleDate: string; // 'YYYY-MM-DD' (typically 6 months after issueDate)
  readonly cancelReason?: string;
  readonly cashbookEntryId?: string;
}

export type BankReconciliationStatus = 'DRAFT' | 'PREPARED' | 'APPROVED';

export interface BankStatementLine {
  readonly id: string;
  readonly branchId: string;
  readonly bankAccountId: string;
  readonly statementDate: string; // 'YYYY-MM-DD'
  readonly description: string;
  readonly reference?: string;
  readonly debit?: bigint; // Outflow (charges, withdrawals)
  readonly credit?: bigint; // Inflow (deposits, interest)
  readonly isMatched: boolean;
  readonly matchedCashbookEntryId?: string;
  readonly createdAt: string;
}

export interface BankReconciliationSignoff {
  readonly userId: string;
  readonly fullName: string;
  readonly role: string;
  readonly signedAt: string;
}

export interface BankReconciliation {
  readonly id: string;
  readonly branchId: string;
  readonly bankAccountId: string;
  readonly statementDate: string; // 'YYYY-MM-DD'
  readonly statementEndingBalance: bigint;
  readonly cashbookClosingBalance: bigint;
  readonly depositsInTransit: bigint;
  readonly unpresentedCheques: bigint;
  readonly adjustedBankBalance: bigint;
  readonly variance: bigint; // adjustedBankBalance - cashbookClosingBalance
  readonly clearedEntryIds: readonly string[];
  readonly status: BankReconciliationStatus;
  readonly preparedBy?: BankReconciliationSignoff;
  readonly approvedBy?: BankReconciliationSignoff;
  readonly pdfSnapshotUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BankReconciliationCalculationResult {
  readonly statementEndingBalance: bigint;
  readonly cashbookClosingBalance: bigint;
  readonly depositsInTransit: bigint;
  readonly unpresentedCheques: bigint;
  readonly adjustedBankBalance: bigint;
  readonly variance: bigint;
  readonly isBalanced: boolean;
  readonly unclearedReceipts: readonly CashbookEntry[];
  readonly unclearedPayments: readonly CashbookEntry[];
  readonly clearedReceipts: readonly CashbookEntry[];
  readonly clearedPayments: readonly CashbookEntry[];
}

export interface ChequeBookRange {
  readonly id: string;
  readonly bankAccountId: string;
  readonly startNumber: number;
  readonly endNumber: number;
  readonly active: boolean;
}

export interface AnalysedCategoryTotal {
  readonly name: string;
  readonly total: bigint;
}

export interface AnalysedCashbookSummary {
  readonly receiptsCategories: readonly AnalysedCategoryTotal[];
  readonly paymentsCategories: readonly AnalysedCategoryTotal[];
  readonly totalReceipts: bigint;
  readonly totalPayments: bigint;
  readonly openingBalance: bigint;
  readonly closingBalance: bigint;
}
