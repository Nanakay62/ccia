import type { Currency } from '../money/index.js';

export type RequisitionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';

export type VoucherPaymentMethod =
  | 'CASH_GHS'
  | 'CASH_USD'
  | 'BANK_GHS'
  | 'BANK_USD'
  | 'MOMO'
  | 'CHEQUE';

export type WithholdingTaxRate = 0 | 3 | 5 | 7.5 | 10;

export interface Requisition {
  readonly id: string;
  readonly branchId: string;
  readonly reqNumber: string; // e.g. "REQ-D01-000014"
  readonly departmentId: string;
  readonly departmentName: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly purpose: string;
  readonly currency: Currency;
  readonly estimatedAmountPesewas: bigint;
  readonly submittedById: string;
  readonly submittedByName: string;
  readonly status: RequisitionStatus;
  readonly quotesNotes?: string;
  readonly approvalComments?: string;
  readonly approvedById?: string;
  readonly approvedByName?: string;
  readonly approvedAt?: string;
  readonly createdAt: string;
}

export interface Vendor {
  readonly id: string;
  readonly branchId: string;
  readonly name: string;
  readonly category: string; // e.g. "Utilities", "Maintenance", "Musical Equipment", "Printing", "Audio/Visual"
  readonly contactPhone?: string;
  readonly tinOrGhanaCard?: string;
  readonly momoNumber?: string;
  readonly bankDetails?: string;
  readonly isActive: boolean;
  readonly totalPaidGhsPesewas: bigint;
  readonly createdAt: string;
}

export interface PaymentVoucher {
  readonly id: string;
  readonly branchId: string;
  readonly voucherNumber: string; // e.g. "PV-FS-D01-000042"
  readonly requisitionId?: string;
  readonly requisitionNumber?: string;
  readonly vendorId?: string;
  readonly payeeName: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly expenseAccountId: string; // e.g. "acct-5020" Utilities, "acct-5030" Maintenance
  readonly expenseAccountName: string;
  readonly purpose: string;
  readonly paymentMethod: VoucherPaymentMethod;
  readonly currency: Currency;
  readonly grossAmountPesewas: bigint;
  readonly withholdingTaxRate: WithholdingTaxRate;
  readonly withholdingTaxPesewas: bigint;
  readonly netPayablePesewas: bigint;
  readonly voucherDate: string;
  readonly chequeNumber?: string;
  readonly momoNetwork?: string;
  readonly momoReference?: string;
  readonly momoRecipientPhone?: string;
  readonly preparedById: string;
  readonly preparedByName: string;
  readonly authorizedById?: string;
  readonly authorizedByName?: string;
  readonly journalEntryId?: string;
  readonly createdAt: string;
}

export interface PettyCashTransaction {
  readonly id: string;
  readonly branchId: string;
  readonly date: string;
  readonly description: string;
  readonly category: string;
  readonly expenseAccountId: string;
  readonly amountPesewas: bigint;
  readonly receiptNumber?: string;
  readonly paidTo: string;
  readonly disbursedBy: string;
  readonly isReplenished: boolean;
  readonly replenishmentVoucherId?: string;
}

export interface PettyCashFloat {
  readonly branchId: string;
  readonly targetFloatPesewas: bigint; // e.g. 100,000p = GHS 1,000.00
  readonly custodianName: string;
  readonly cashOnHandPesewas: bigint;
  readonly unreimbursedReceiptsPesewas: bigint;
  readonly lastReplenishedAt?: string;
}

export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR' | 'DISPOSED';

export type AssetCategory =
  | 'Buildings & Infrastructure'
  | 'Musical Instruments'
  | 'Audio / Visual Equipment'
  | 'Vehicles & Transport'
  | 'Office Furniture & Computers'
  | 'Power & Generators';

export interface FixedAsset {
  readonly id: string;
  readonly branchId: string;
  readonly assetTag: string; // e.g. "AST-MUS-001"
  readonly name: string;
  readonly category: AssetCategory;
  readonly location: string;
  readonly purchaseDate: string;
  readonly purchaseCostPesewas: bigint;
  readonly currency: Currency;
  readonly fundId: string;
  readonly fundName: string;
  readonly usefulLifeYears: number; // e.g. 5
  readonly residualValuePesewas: bigint; // e.g. 0
  readonly condition: AssetCondition;
  readonly serialNumber?: string;
  readonly notes?: string;
}

export interface AssetDepreciationResult {
  readonly assetId: string;
  readonly assetTag: string;
  readonly purchaseCostPesewas: bigint;
  readonly usefulLifeYears: number;
  readonly annualDepreciationPesewas: bigint;
  readonly monthlyDepreciationPesewas: bigint;
  readonly ageMonths: number;
  readonly accumulatedDepreciationPesewas: bigint;
  readonly netBookValuePesewas: bigint;
}
