import type { Currency } from '../money/index.js';

export type FixedAssetCategoryCode =
  | 'LAND'
  | 'BUILDINGS'
  | 'FURNITURE'
  | 'SOUND_AV'
  | 'MUSICAL_INSTRUMENTS'
  | 'VEHICLES'
  | 'COMPUTERS_IT'
  | 'GENERATORS'
  | 'KITCHEN'
  | 'OTHER';

export interface FixedAssetCategory {
  readonly id: string;
  readonly code: FixedAssetCategoryCode;
  readonly name: string;
  readonly defaultUsefulLifeMonths: number;
  readonly isDepreciable: boolean;
  readonly costAccountCode: string; // e.g. '1500', '1510'
  readonly accumulatedDepAccountCode?: string; // e.g. '1511'
  readonly depExpenseAccountCode?: string; // e.g. '5210'
  readonly description?: string;
}

export type FixedAssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type FixedAssetStatus = 'IN_USE' | 'UNDER_REPAIR' | 'STORED' | 'DISPOSED' | 'MISSING';

export type AcquisitionType = 'PURCHASED' | 'DONATED' | 'TRANSFERRED_IN';

export type AssetEventType =
  | 'ACQUISITION'
  | 'TRANSFER'
  | 'MAINTENANCE_REPAIR'
  | 'IMPROVEMENT'
  | 'DISPOSAL'
  | 'VERIFICATION'
  | 'DEPRECIATION'
  | 'CORRECTION';

export interface AssetEvent {
  readonly id: string;
  readonly assetId: string;
  readonly eventType: AssetEventType;
  readonly date: string; // YYYY-MM-DD
  readonly performedBy: string;
  readonly details: string;
  readonly fromLocation?: string;
  readonly toLocation?: string;
  readonly fromCustodian?: string;
  readonly toCustodian?: string;
  readonly costPesewas?: bigint;
  readonly voucherId?: string;
  readonly journalEntryId?: string;
  readonly approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
  readonly approvedBy?: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export type DisposalType =
  | 'SOLD'
  | 'SCRAPPED'
  | 'DONATED_AWAY'
  | 'LOST_OR_STOLEN'
  | 'WRITTEN_OFF';

export interface AssetDisposalDetails {
  readonly disposalType: DisposalType;
  readonly disposalDate: string; // YYYY-MM-DD
  readonly reason: string;
  readonly proceedsPesewas: bigint;
  readonly currency: Currency;
  readonly buyerOrRecipient?: string;
  readonly approvedByPastorOrElder: string;
  readonly postedByTreasurer: string;
  readonly gainOrLossPesewas: bigint; // positive = gain, negative = loss
  readonly journalEntryId?: string;
  readonly attachments?: readonly string[];
}

export interface AssetPolicySettings {
  readonly capitalisationThresholdGhsPesewas: bigint; // default 100,000n = GHS 1,000.00
  readonly capitalisationThresholdUsdCents: bigint; // default 10,000n = USD 100.00
  readonly depreciationEnabled: boolean; // default true
  readonly defaultDepreciationMethod: 'STRAIGHT_LINE';
  readonly depreciationFrequency: 'MONTHLY' | 'YEARLY'; // default 'YEARLY'
  readonly verificationPeriodMonths: number; // default 12
}

export interface FixedAssetRecord {
  readonly id: string;
  readonly branchId: string;
  readonly assetNumber: string; // e.g. "AST-2026-0001" or "FA-0001"
  readonly description: string;
  readonly categoryCode: FixedAssetCategoryCode;
  readonly categoryName: string;
  readonly serialOrModelNumber?: string;
  readonly location: string;
  readonly custodian: string;
  readonly department: string;
  readonly supplier?: string;
  readonly acquisitionType: AcquisitionType;
  readonly acquisitionDate: string; // YYYY-MM-DD
  readonly currency: Currency; // 'GHS' | 'USD'
  readonly exchangeRate: string; // e.g. '15.50'
  readonly costInOriginalCurrency: bigint;
  readonly costInGhsPesewas: bigint; // historical cost in GHS, never overwritten
  readonly fundId: string;
  readonly fundName: string;
  readonly invoiceOrReceiptNumber?: string;
  readonly voucherId?: string;
  readonly journalEntryId?: string;
  readonly photos: readonly string[];
  readonly attachments?: readonly string[];
  readonly valuationBasis?: string; // For donated assets
  readonly warrantyExpiry?: string;
  readonly insurancePolicy?: string;
  readonly insuranceExpiry?: string;
  readonly condition: FixedAssetCondition;
  readonly status: FixedAssetStatus;
  readonly usefulLifeMonths: number;
  readonly residualValuePesewas: bigint;
  readonly depreciationStartDate: string; // YYYY-MM-DD
  readonly accumulatedDepreciationPesewas: bigint;
  readonly netBookValuePesewas: bigint;
  readonly disposalDetails?: AssetDisposalDetails;
  readonly events: readonly AssetEvent[];
  readonly createdAt: string;
  readonly createdBy: string;
  readonly deviceId: string;

  // Compatibility aliases for older FixedAsset interface in expenses
  readonly assetTag: string; // equals assetNumber
  readonly name: string; // equals description
  readonly purchaseCostPesewas: bigint; // equals costInGhsPesewas
  readonly purchaseDate: string; // equals acquisitionDate
  readonly usefulLifeYears: number; // Math.round(usefulLifeMonths / 12)
  readonly category: string; // equals categoryName
}

export interface FixedAssetSummary {
  readonly totalAssetsCount: number;
  readonly totalCostPesewas: bigint;
  readonly totalAccumulatedDepreciationPesewas: bigint;
  readonly totalNetBookValuePesewas: bigint;
  readonly countByCategory: Record<FixedAssetCategoryCode, number>;
  readonly costByCategory: Record<FixedAssetCategoryCode, bigint>;
  readonly netBookValueByCategory: Record<FixedAssetCategoryCode, bigint>;
}

export type DepreciationLineStatus = 'ACTIVE' | 'SKIPPED';
export type DepreciationSkipReason =
  | 'LAND_NON_DEPRECIABLE'
  | 'NOT_YET_IN_SERVICE'
  | 'FULLY_DEPRECIATED'
  | 'DISPOSED';

export interface DepreciationLine {
  readonly id: string;
  readonly assetId: string;
  readonly assetNumber: string;
  readonly description: string;
  readonly categoryCode: FixedAssetCategoryCode;
  readonly categoryName: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly costPesewas: bigint;
  readonly residualValuePesewas: bigint;
  readonly priorAccumulatedDepreciationPesewas: bigint;
  readonly chargePesewas: bigint;
  readonly newAccumulatedDepreciationPesewas: bigint;
  readonly projectedNetBookValuePesewas: bigint;
  readonly assetAccountCode: string;
  readonly accumulatedDepreciationAccountCode: string;
  readonly depreciationExpenseAccountCode: string;
  readonly status: DepreciationLineStatus;
  readonly skipReason?: DepreciationSkipReason;
}

export type DepreciationRunStatus = 'POSTED' | 'REVERSED';

export interface DepreciationRun {
  readonly id: string;
  readonly runNumber: string; // e.g. "DEP-2026-10" or "DEP-2026-ANNUAL"
  readonly period: string; // e.g. "2026-10" or "2026"
  readonly periodType: 'MONTHLY' | 'YEARLY';
  readonly runDate: string; // YYYY-MM-DD
  readonly totalEligibleAssets: number;
  readonly totalSkippedAssets: number;
  readonly totalChargePesewas: bigint;
  readonly lines: readonly DepreciationLine[];
  readonly journalEntryId?: string;
  readonly preparedBy: string;
  readonly approvedByTreasurer: string;
  readonly status: DepreciationRunStatus;
  readonly reversalReason?: string;
  readonly reversedBy?: string;
  readonly reversalJournalEntryId?: string;
  readonly reversedAt?: string;
  readonly createdAt: string;
}

export interface MovementScheduleCategoryRow {
  readonly categoryCode: FixedAssetCategoryCode;
  readonly categoryName: string;
  readonly costAtStartPesewas: bigint;
  readonly additionsCostPesewas: bigint;
  readonly disposalsCostPesewas: bigint;
  readonly costAtEndPesewas: bigint;
  readonly accumulatedDepreciationAtStartPesewas: bigint;
  readonly chargeForPeriodPesewas: bigint;
  readonly disposalsAccumulatedDepreciationPesewas: bigint;
  readonly accumulatedDepreciationAtEndPesewas: bigint;
  readonly netBookValueAtStartPesewas: bigint;
  readonly netBookValueAtEndPesewas: bigint;
}

export interface FixedAssetMovementSchedule {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly rows: readonly MovementScheduleCategoryRow[];
  readonly totals: MovementScheduleCategoryRow;
}

export interface RegisterLedgerReconciliationCategoryRow {
  readonly categoryCode: FixedAssetCategoryCode;
  readonly categoryName: string;
  readonly assetAccountCode: string;
  readonly registerCostPesewas: bigint;
  readonly ledgerCostPesewas: bigint;
  readonly costDifferencePesewas: bigint;
  readonly accumulatedDepreciationAccountCode: string;
  readonly registerAccDepPesewas: bigint;
  readonly ledgerAccDepPesewas: bigint;
  readonly accDepDifferencePesewas: bigint;
  readonly isInBalance: boolean;
}

export interface RegisterLedgerReconciliation {
  readonly asOfDate: string;
  readonly rows: readonly RegisterLedgerReconciliationCategoryRow[];
  readonly totalRegisterCostPesewas: bigint;
  readonly totalLedgerCostPesewas: bigint;
  readonly totalCostDifferencePesewas: bigint;
  readonly totalRegisterAccDepPesewas: bigint;
  readonly totalLedgerAccDepPesewas: bigint;
  readonly totalAccDepDifferencePesewas: bigint;
  readonly isFullyInBalance: boolean;
}

export type VerificationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VerificationScope = 'ALL' | 'LOCATION' | 'CUSTODIAN' | 'CATEGORY';
export type VerificationItemStatus = 'PENDING' | 'FOUND' | 'MOVED' | 'DAMAGED' | 'MISSING';

export interface AssetVerificationLine {
  readonly id: string;
  readonly verificationId: string;
  readonly assetId?: string; // undefined if unrecorded item found on site
  readonly assetNumber: string;
  readonly description: string;
  readonly categoryName: string;
  readonly expectedLocation: string;
  readonly actualLocation?: string;
  readonly expectedCustodian: string;
  readonly actualCustodian?: string;
  readonly costPesewas: bigint;
  readonly netBookValuePesewas: bigint;
  readonly status: VerificationItemStatus;
  readonly condition?: FixedAssetCondition;
  readonly isUnrecordedFound: boolean;
  readonly notes?: string;
  readonly photoUrl?: string;
  readonly verifiedAt?: string;
  readonly verifiedBy?: string;
}

export interface AssetVerificationSignoff {
  readonly verifierName: string;
  readonly verifierRole: string;
  readonly verifierSignedAt: string;
  readonly officerName: string;
  readonly officerRole: 'Treasurer' | 'Pastor / Elder';
  readonly officerSignedAt: string;
  readonly notes?: string;
}

export interface AssetVerification {
  readonly id: string;
  readonly verificationNumber: string; // e.g. "VER-2026-001" or "PV-2026-ANNUAL"
  readonly title: string;
  readonly scope: VerificationScope;
  readonly scopeValue?: string;
  readonly startDate: string; // YYYY-MM-DD
  readonly completedDate?: string; // YYYY-MM-DD
  readonly status: VerificationStatus;
  readonly totalExpectedAssets: number;
  readonly pendingCount: number;
  readonly foundCount: number;
  readonly movedCount: number;
  readonly damagedCount: number;
  readonly missingCount: number;
  readonly unrecordedFoundCount: number;
  readonly lines: readonly AssetVerificationLine[];
  readonly signoff?: AssetVerificationSignoff;
  readonly createdAt: string;
  readonly createdBy: string;
}
