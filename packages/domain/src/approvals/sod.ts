/**
 * Separation of Duties (SoD) Rules & Exceptions Engine (Spec Section C4).
 * Enforces built-in blocking rules, strict Treasurer override restrictions,
 * and audit exception logging.
 */

import type { Role } from '../permissions/index.js';
import type { SodCheckType, SodEvaluationResult, SodExceptionRecord } from './types.js';

export const SOD_CHECK_DESCRIPTIONS: Record<SodCheckType, string> = {
  REQUISITION_PREPARER_APPROVER: 'The officer who prepares a requisition cannot approve it.',
  PAYROLL_PREPARER_APPROVER: 'The officer who processes payroll cannot approve or authorize payment.',
  RECONCILIATION_PREPARER_APPROVER: 'The officer who prepares bank/MoMo reconciliation cannot sign it off.',
  DEPRECIATION_PREPARER_APPROVER: 'The officer who runs depreciation cannot be the sole approver.',
  ASSET_DISPOSAL_PREPARER_APPROVER: 'The officer who initiates an asset disposal cannot authorize it.',
  DUAL_COUNTERS_SAME_PERSON: 'The two counting officers for Sunday collections must be different people.',
  VENDOR_CREATOR_OR_EDITOR_PAYER:
    'The user who created a vendor or edited bank details cannot pay that vendor in the same period without a second approval.',
  YEAREND_PREPARER_SOLE_APPROVER:
    'The officer who prepares the year-end closing entries cannot be the only approver.',
};

/**
 * Evaluates whether an operation violates Separation of Duties.
 */
export function evaluateSod(params: {
  checkType: SodCheckType;
  preparerUserId: string;
  approverUserId: string;
  preparerRole?: Role;
  approverRole?: Role;
  details?: string;
}): SodEvaluationResult {
  const { checkType, preparerUserId, approverUserId } = params;

  // Basic rule: Preparer and approver cannot be the same person
  if (preparerUserId && approverUserId && preparerUserId === approverUserId) {
    return {
      allowed: false,
      isBlocked: true,
      ruleName: checkType,
      message: `Separation of Duties violation: ${SOD_CHECK_DESCRIPTIONS[checkType]}`,
      canTreasurerOverride: true,
    };
  }

  return {
    allowed: true,
    isBlocked: false,
    ruleName: checkType,
    message: 'Separation of duties satisfied.',
    canTreasurerOverride: false,
  };
}

/**
 * Validates the dual counters rule for offering and tithe collection counting.
 */
export function evaluateTwoCounters(
  firstCounterUserId: string,
  secondCounterUserId: string
): SodEvaluationResult {
  if (
    firstCounterUserId &&
    secondCounterUserId &&
    firstCounterUserId.trim().toLowerCase() === secondCounterUserId.trim().toLowerCase()
  ) {
    return {
      allowed: false,
      isBlocked: true,
      ruleName: 'DUAL_COUNTERS_SAME_PERSON',
      message: 'Separation of Duties violation: The two counters must be different people.',
      canTreasurerOverride: false, // Dual counters rule is hard-blocked and cannot be overridden
    };
  }

  return {
    allowed: true,
    isBlocked: false,
    ruleName: 'DUAL_COUNTERS_SAME_PERSON',
    message: 'Dual counters verified as distinct individuals.',
    canTreasurerOverride: false,
  };
}

/**
 * Evaluates whether a user can disburse payment to a vendor they created or modified in the same period.
 */
export function evaluateVendorPayer(params: {
  vendorCreatorId?: string;
  vendorDetailEditorId?: string;
  payerUserId: string;
  isSamePeriod: boolean;
  hasSecondApproval: boolean;
}): SodEvaluationResult {
  const { vendorCreatorId, vendorDetailEditorId, payerUserId, isSamePeriod, hasSecondApproval } =
    params;

  const isCreator = Boolean(vendorCreatorId && vendorCreatorId === payerUserId);
  const isEditor = Boolean(vendorDetailEditorId && vendorDetailEditorId === payerUserId);

  if ((isCreator || isEditor) && isSamePeriod && !hasSecondApproval) {
    return {
      allowed: false,
      isBlocked: true,
      ruleName: 'VENDOR_CREATOR_OR_EDITOR_PAYER',
      message:
        'Separation of Duties violation: A user who creates a vendor or changes their payment details cannot disburse payment to that vendor in the same period without a second approval.',
      canTreasurerOverride: true,
    };
  }

  return {
    allowed: true,
    isBlocked: false,
    ruleName: 'VENDOR_CREATOR_OR_EDITOR_PAYER',
    message: 'Vendor payment duty separation verified.',
    canTreasurerOverride: false,
  };
}

/**
 * Checks whether an actor can override an SoD block:
 * An override is possible ONLY by the Treasurer, and NEVER on their own items!
 */
export function canTreasurerOverrideSod(params: {
  actorUserId: string;
  actorRole: Role;
  preparerUserId: string;
  approverUserId?: string;
}): { allowed: boolean; reason?: string } {
  const { actorUserId, actorRole, preparerUserId, approverUserId } = params;

  if (actorRole !== 'Treasurer' && actorRole !== 'Admin') {
    return {
      allowed: false,
      reason: 'Only the Church Treasurer possesses override authority for Separation of Duties.',
    };
  }

  // The Treasurer can NEVER override their own items
  if (actorUserId === preparerUserId) {
    return {
      allowed: false,
      reason:
        'Treasurer self-override prohibited: The Treasurer cannot override Separation of Duties on their own items.',
    };
  }

  if (approverUserId && actorUserId === approverUserId) {
    return {
      allowed: false,
      reason:
        'Treasurer self-override prohibited: The Treasurer cannot override an item where they are already the primary actor.',
    };
  }

  return { allowed: true };
}

/**
 * Constructs an SoD exception audit record when an override or near-miss occurs.
 */
export function createSodExceptionRecord(params: {
  ruleType: SodCheckType;
  entityType: string;
  entityId: string;
  actorUserId: string;
  actorUserName: string;
  actorRole: Role;
  targetUserId?: string;
  targetUserName?: string;
  isOverridden: boolean;
  overriddenByTreasurerId?: string;
  overriddenByTreasurerName?: string;
  overrideReason?: string;
  details: string;
}): SodExceptionRecord {
  return {
    id: `sod-exc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ruleType: params.ruleType,
    entityType: params.entityType,
    entityId: params.entityId,
    actorUserId: params.actorUserId,
    actorUserName: params.actorUserName,
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
    targetUserName: params.targetUserName,
    isOverridden: params.isOverridden,
    overriddenByTreasurerId: params.overriddenByTreasurerId,
    overriddenByTreasurerName: params.overriddenByTreasurerName,
    overrideReason: params.overrideReason,
    details: params.details,
  };
}
