/**
 * Phase 5 Domain Types: Approval Limits Matrix, Separation of Duties (SoD),
 * and Controlled Payment Details (Spec Sections C3 & C4).
 */

import type { Role } from '../permissions/index.js';
import type { Currency } from '../money/index.js';

export type ApprovalTransactionType =
  | 'requisition'
  | 'voucher_payment'
  | 'payroll_run'
  | 'tithe_remittance'
  | 'asset_disposal'
  | 'manual_journal'
  | 'cash_or_fund_override'
  | 'period_reopening'
  | 'backup_restore';

export const ALL_APPROVAL_TRANSACTION_TYPES: readonly ApprovalTransactionType[] = [
  'requisition',
  'voucher_payment',
  'payroll_run',
  'tithe_remittance',
  'asset_disposal',
  'manual_journal',
  'cash_or_fund_override',
  'period_reopening',
  'backup_restore',
] as const;

export interface AmountBand {
  readonly id: string;
  readonly label: string;
  readonly minAmountPesewas: bigint;
  readonly maxAmountPesewas: bigint | null; // null represents unbounded ("Above X")
  readonly requiredApprovalsCount: number;
  readonly requiredRoles: readonly Role[];
}

export interface ApprovalMatrixRule {
  readonly id: string;
  readonly transactionType: ApprovalTransactionType;
  readonly transactionLabel: string;
  readonly bands: readonly AmountBand[];
}

export interface ApprovalMatrixVersion {
  readonly version: number;
  readonly effectiveFrom: string; // ISO Date YYYY-MM-DD
  readonly proposedBy: string; // Treasurer
  readonly proposedAt: string; // ISO DateTime
  readonly approvedBy?: string; // Pastor / Elder
  readonly approvedAt?: string;
  readonly status: 'PROPOSED' | 'ACTIVE' | 'ARCHIVED';
  readonly rules: readonly ApprovalMatrixRule[];
}

export interface ApprovalStepRecord {
  readonly id: string;
  readonly stepNumber: number;
  readonly requiredRole: Role;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly approverUserId?: string;
  readonly approverUserName?: string;
  readonly approverRole?: Role;
  readonly approvedAt?: string;
  readonly comments?: string;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly transactionType: ApprovalTransactionType;
  readonly entityId: string;
  readonly entityNumber: string; // e.g. "REQ-D01-000014", "PV-FS-D01-000042"
  readonly amountPesewas: bigint;
  readonly currency: Currency;
  readonly amountGhsEquivalentPesewas: bigint;
  readonly requesterUserId: string;
  readonly requesterUserName: string;
  readonly requesterRole: Role;
  readonly requestedAt: string;
  readonly lastEditedAt: string; // Void step if request edited after approval
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  readonly steps: readonly ApprovalStepRecord[];
  readonly requiredApprovalsCount: number;
  readonly completedApprovalsCount: number;
}

export type SodCheckType =
  | 'REQUISITION_PREPARER_APPROVER'
  | 'PAYROLL_PREPARER_APPROVER'
  | 'RECONCILIATION_PREPARER_APPROVER'
  | 'DEPRECIATION_PREPARER_APPROVER'
  | 'ASSET_DISPOSAL_PREPARER_APPROVER'
  | 'DUAL_COUNTERS_SAME_PERSON'
  | 'VENDOR_CREATOR_OR_EDITOR_PAYER'
  | 'YEAREND_PREPARER_SOLE_APPROVER';

export interface SodEvaluationResult {
  readonly allowed: boolean;
  readonly isBlocked: boolean;
  readonly ruleName: SodCheckType;
  readonly message: string;
  readonly canTreasurerOverride: boolean;
}

export interface SodExceptionRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly ruleType: SodCheckType;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorUserId: string;
  readonly actorUserName: string;
  readonly actorRole: Role;
  readonly targetUserId?: string;
  readonly targetUserName?: string;
  readonly isOverridden: boolean;
  readonly overriddenByTreasurerId?: string;
  readonly overriddenByTreasurerName?: string;
  readonly overrideReason?: string;
  readonly details: string;
}

export type ControlledEntityType = 'VENDOR' | 'STAFF' | 'MEMBER';
export type ControlledDetailType = 'BANK_ACCOUNT' | 'MOMO_NUMBER';

export interface ControlledPaymentDetailChange {
  readonly id: string;
  readonly entityType: ControlledEntityType;
  readonly entityId: string;
  readonly entityName: string;
  readonly detailType: ControlledDetailType;
  readonly oldValue: string;
  readonly newValue: string;
  readonly changedByUserId: string;
  readonly changedByUserName: string;
  readonly changedAt: string;
  readonly status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  readonly approvedByUserId?: string;
  readonly approvedByUserName?: string;
  readonly approvedAt?: string;
}
