export type TitheBatchStatus = 'DRAFT' | 'RECONCILED' | 'POSTED';

export type TithePaymentMethod = 'ENVELOPE' | 'MOMO' | 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';

export interface TitheBatch {
  id: string;
  branchId: string;
  countingSheetId: string;
  serviceDate: string; // YYYY-MM-DD
  serviceName: string;
  currency: string; // 'GHS' | 'USD'
  countedTotal: bigint; // from counting sheet tithe allocation
  allocatedTotal: bigint; // sum of valid records
  unallocatedTotal: bigint; // counted - allocated
  explainedUnallocated: bigint; // unallocated amount with explanation (e.g. anonymous/unreadable)
  unallocatedReason?: string;
  status: TitheBatchStatus;
  reconciledBy?: string;
  reconciledAt?: string;
  postedBy?: string;
  postedAt?: string;
  recordsCount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TitheRecord {
  id: string;
  branchId: string;
  batchId?: string | null; // null for non-service direct tithes
  memberId: string;
  memberName: string;
  envelopeNumber?: string;
  recordDate: string; // YYYY-MM-DD
  amount: bigint; // minor units (pesewas/cents)
  currency: string;
  exchangeRate?: string;
  method: TithePaymentMethod;
  journalEntryId?: string; // set if direct tithe created a GL receipt
  cashAccountId?: string; // for direct tithe receipt
  notes?: string;
  recordedBy: string;
  isReversal?: boolean;
  reversalOfId?: string;
  reversalReason?: string;
  createdAt: string;
}

export interface TitheBatchReconciliationResult {
  countedTotal: bigint;
  allocatedTotal: bigint;
  unallocatedTotal: bigint;
  explainedUnallocated: bigint;
  unexplainedVariance: bigint;
  isBalanced: boolean;
  canReconcile: boolean;
  canPost: boolean;
  message: string;
}

export interface TitheDistributionBand {
  id: string;
  label: string; // e.g. '< 50 GHS'
  minAmount: bigint;
  maxAmount: bigint | null;
  count: number;
  percentage: number;
  totalAmount: bigint;
}

export interface TitheParticipationStats {
  period: string; // e.g. '2026-10' or '2026'
  currency: string;
  totalTitheAmount: bigint;
  totalPayers: number;
  activeMemberCount: number;
  participationPercentage: number; // e.g. 78.5
  averageTitheAmount: bigint;
  medianTitheAmount: bigint;
  bands: TitheDistributionBand[];
}

export interface MemberTitheSummary {
  memberId: string;
  memberName: string;
  envelopeNumber?: string;
  currency: string;
  ytdTotal: bigint;
  monthsPaidCount: number;
  monthsElapsedCount: number;
  consistencyPercentage: number;
  lastTitheDate?: string;
  lastTitheAmount?: bigint;
  monthlyTotals: Record<number, bigint>; // 1-12 month -> total minor units
  records: TitheRecord[];
}

export interface TitheSettings {
  allowPastorViewIndividual: boolean;
  allowElderViewIndividual: boolean;
  distributionBandsGhs: { label: string; min: bigint; max: bigint | null }[];
  defaultCurrency: string;
  requireTwoSignaturesToPost: boolean;
  showLapsedGivers: boolean;
}

export type TitheRemittanceBasis = 'PERCENTAGE' | 'FIXED';
export type TitheRemittanceStatus = 'ACCRUED' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERDUE';

export interface TitheRemittanceRule {
  id: string;
  branchId: string;
  name: string; // e.g. "District Headquarters Assessment"
  basis: TitheRemittanceBasis;
  percentageOrAmount: string; // e.g. "10" for 10% or "250000" for fixed GHS 2,500.00
  currency: string; // 'GHS' | 'USD'
  frequency: 'MONTHLY' | 'QUARTERLY';
  dueDayOfMonth: number; // e.g. 10
  effectiveFrom: string; // YYYY-MM-DD
  payeeName: string; // e.g. "Accra District Office"
  isActive: boolean;
  createdAt: string;
}

export interface TitheRemittance {
  id: string;
  branchId: string;
  ruleId: string;
  ruleName?: string;
  period: string; // YYYY-MM (e.g. '2026-10')
  tithesBasisGhs: bigint; // minor units
  tithesBasisUsd?: bigint;
  rateUsed?: string;
  amountDue: bigint; // in rule currency minor units
  amountPaid: bigint; // in rule currency minor units
  balanceOutstanding: bigint; // amountDue - amountPaid
  currency: string;
  status: TitheRemittanceStatus;
  dueDate: string; // YYYY-MM-DD
  voucherIds: string[]; // linked vouchers
  journalEntryId?: string; // accrual journal entry
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RemittanceCalculationResult {
  period: string;
  tithesBasis: bigint;
  ruleName: string;
  rateOrAmount: string;
  amountDue: bigint;
  dueDate: string;
  currency: string;
}
