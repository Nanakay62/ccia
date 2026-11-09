/**
 * Approval Limits Matrix Engine (Spec Section C3).
 * Enforces tiered approval rules by transaction type and GHS amount band.
 * Server authority for locks, approvals, and role validation.
 */

import Big from 'big.js';
import type { Role } from '../permissions/index.js';
import type { Currency } from '../money/index.js';
import type {
  ApprovalTransactionType,
  AmountBand,
  ApprovalMatrixRule,
  ApprovalMatrixVersion,
  ApprovalRequest,
  ApprovalStepRecord,
} from './types.js';

export const TRANSACTION_TYPE_LABELS: Record<ApprovalTransactionType, string> = {
  requisition: 'Expenditure Requisition',
  voucher_payment: 'Voucher Payment',
  payroll_run: 'Staff Payroll Run',
  tithe_remittance: 'Head Office Tithe Remittance',
  asset_disposal: 'Fixed Asset Disposal / Write-Off',
  manual_journal: 'Manual Journal Entry',
  cash_or_fund_override: 'Cash / Fund Limit Override',
  period_reopening: 'Period Reopening',
  backup_restore: 'Encrypted Backup Restore',
};

/**
 * Standard default approval limits matrix for Calvary Crystal Church.
 * Tier 1: Departmental / Treasurer up to GHS 1,000
 * Tier 2: Treasurer up to GHS 5,000
 * Tier 3: Pastor / Elder dual-control above GHS 5,000
 */
export const DEFAULT_APPROVAL_MATRIX_RULES: readonly ApprovalMatrixRule[] = [
  {
    id: 'rule-req',
    transactionType: 'requisition',
    transactionLabel: TRANSACTION_TYPE_LABELS.requisition,
    bands: [
      {
        id: 'band-req-1',
        label: 'Up to GHS 1,000.00',
        minAmountPesewas: 0n,
        maxAmountPesewas: 100000n, // GHS 1,000.00
        requiredApprovalsCount: 1,
        requiredRoles: ['Department Head', 'Treasurer'],
      },
      {
        id: 'band-req-2',
        label: 'GHS 1,000.01 to GHS 5,000.00',
        minAmountPesewas: 100001n,
        maxAmountPesewas: 500000n, // GHS 5,000.00
        requiredApprovalsCount: 1,
        requiredRoles: ['Treasurer'],
      },
      {
        id: 'band-req-3',
        label: 'Above GHS 5,000.00',
        minAmountPesewas: 500001n,
        maxAmountPesewas: null, // Unbounded
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-pv',
    transactionType: 'voucher_payment',
    transactionLabel: TRANSACTION_TYPE_LABELS.voucher_payment,
    bands: [
      {
        id: 'band-pv-1',
        label: 'Up to GHS 5,000.00',
        minAmountPesewas: 0n,
        maxAmountPesewas: 500000n,
        requiredApprovalsCount: 1,
        requiredRoles: ['Treasurer'],
      },
      {
        id: 'band-pv-2',
        label: 'Above GHS 5,000.00',
        minAmountPesewas: 500001n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-pay',
    transactionType: 'payroll_run',
    transactionLabel: TRANSACTION_TYPE_LABELS.payroll_run,
    bands: [
      {
        id: 'band-pay-all',
        label: 'All Payroll Runs',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-rem',
    transactionType: 'tithe_remittance',
    transactionLabel: TRANSACTION_TYPE_LABELS.tithe_remittance,
    bands: [
      {
        id: 'band-rem-all',
        label: 'All Head Office Remittances',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-disp',
    transactionType: 'asset_disposal',
    transactionLabel: TRANSACTION_TYPE_LABELS.asset_disposal,
    bands: [
      {
        id: 'band-disp-all',
        label: 'All Asset Disposals & Write-Offs',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-mj',
    transactionType: 'manual_journal',
    transactionLabel: TRANSACTION_TYPE_LABELS.manual_journal,
    bands: [
      {
        id: 'band-mj-1',
        label: 'Up to GHS 2,000.00',
        minAmountPesewas: 0n,
        maxAmountPesewas: 200000n,
        requiredApprovalsCount: 1,
        requiredRoles: ['Treasurer'],
      },
      {
        id: 'band-mj-2',
        label: 'Above GHS 2,000.00',
        minAmountPesewas: 200001n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-ovr',
    transactionType: 'cash_or_fund_override',
    transactionLabel: TRANSACTION_TYPE_LABELS.cash_or_fund_override,
    bands: [
      {
        id: 'band-ovr-all',
        label: 'All Limit & Interfund Overrides',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-reopen',
    transactionType: 'period_reopening',
    transactionLabel: TRANSACTION_TYPE_LABELS.period_reopening,
    bands: [
      {
        id: 'band-reopen-all',
        label: 'All Period & Year Reopenings',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
  {
    id: 'rule-restore',
    transactionType: 'backup_restore',
    transactionLabel: TRANSACTION_TYPE_LABELS.backup_restore,
    bands: [
      {
        id: 'band-restore-all',
        label: 'All Database Restores',
        minAmountPesewas: 0n,
        maxAmountPesewas: null,
        requiredApprovalsCount: 2,
        requiredRoles: ['Treasurer', 'Pastor / Elder'],
      },
    ],
  },
];

export const INITIAL_APPROVAL_MATRIX_VERSION: ApprovalMatrixVersion = {
  version: 1,
  effectiveFrom: '2026-01-01',
  proposedBy: 'Kofi Mensah (Treasurer)',
  proposedAt: '2026-01-01T08:00:00Z',
  approvedBy: 'Rev. Emmanuel Addo (Pastor / Elder)',
  approvedAt: '2026-01-01T09:30:00Z',
  status: 'ACTIVE',
  rules: DEFAULT_APPROVAL_MATRIX_RULES,
};

/**
 * Converts transaction amount to GHS equivalent pesewas for USD conversion.
 */
export function calculateGhsEquivalentPesewas(
  amountPesewas: bigint,
  currency: Currency,
  exchangeRateUsd: string = '15.5000'
): bigint {
  if (currency === 'GHS') {
    return amountPesewas;
  }
  // USD -> GHS: amountPesewas * rate
  const rateBig = new Big(exchangeRateUsd);
  const amountBig = new Big(amountPesewas.toString());
  const convertedBig = amountBig.times(rateBig).round(0);
  return BigInt(convertedBig.toFixed(0));
}

/**
 * Resolves the matching amount band for a transaction type and GHS equivalent amount.
 */
export function resolveAmountBand(
  rules: readonly ApprovalMatrixRule[],
  type: ApprovalTransactionType,
  ghsEquivalentPesewas: bigint
): AmountBand {
  const rule = rules.find((r) => r.transactionType === type);
  if (!rule || rule.bands.length === 0) {
    // Default fallback if church enters none: requires Treasurer approval
    return {
      id: `fallback-${type}`,
      label: 'Standard Approval',
      minAmountPesewas: 0n,
      maxAmountPesewas: null,
      requiredApprovalsCount: 1,
      requiredRoles: ['Treasurer'],
    };
  }

  for (const band of rule.bands) {
    const isAboveMin = ghsEquivalentPesewas >= band.minAmountPesewas;
    const isBelowMax = band.maxAmountPesewas === null || ghsEquivalentPesewas <= band.maxAmountPesewas;
    if (isAboveMin && isBelowMax) {
      return band;
    }
  }

  // If beyond all specified bands, return highest band
  return rule.bands[rule.bands.length - 1]!;
}

/**
 * Creates an ApprovalRequest with initial pending steps according to the active matrix.
 */
export function createApprovalRequest(params: {
  id: string;
  transactionType: ApprovalTransactionType;
  entityId: string;
  entityNumber: string;
  amountPesewas: bigint;
  currency: Currency;
  exchangeRateUsd?: string;
  requesterUserId: string;
  requesterUserName: string;
  requesterRole: Role;
  rules?: readonly ApprovalMatrixRule[];
}): ApprovalRequest {
  const {
    id,
    transactionType,
    entityId,
    entityNumber,
    amountPesewas,
    currency,
    exchangeRateUsd,
    requesterUserId,
    requesterUserName,
    requesterRole,
    rules = DEFAULT_APPROVAL_MATRIX_RULES,
  } = params;

  const ghsEquivalent = calculateGhsEquivalentPesewas(amountPesewas, currency, exchangeRateUsd);
  const band = resolveAmountBand(rules, transactionType, ghsEquivalent);

  const steps: ApprovalStepRecord[] = [];
  for (let i = 0; i < band.requiredApprovalsCount; i++) {
    const roleForStep = band.requiredRoles[i] || band.requiredRoles[0] || 'Treasurer';
    steps.push({
      id: `step-${id}-${i + 1}`,
      stepNumber: i + 1,
      requiredRole: roleForStep,
      status: 'PENDING',
    });
  }

  const now = new Date().toISOString();

  return {
    id,
    transactionType,
    entityId,
    entityNumber,
    amountPesewas,
    currency,
    amountGhsEquivalentPesewas: ghsEquivalent,
    requesterUserId,
    requesterUserName,
    requesterRole,
    requestedAt: now,
    lastEditedAt: now,
    status: 'PENDING',
    steps,
    requiredApprovalsCount: band.requiredApprovalsCount,
    completedApprovalsCount: 0,
  };
}

/**
 * Evaluates approval progress and plain-language waiting status (Spec Section C3):
 * e.g. "1 of 2 approvals, waiting for Treasurer"
 */
export function evaluateApprovalProgress(request: ApprovalRequest): {
  isFullyApproved: boolean;
  statusLabel: string;
  nextPendingStep?: ApprovalStepRecord;
} {
  const approvedSteps = request.steps.filter((s) => s.status === 'APPROVED');
  const rejectedSteps = request.steps.filter((s) => s.status === 'REJECTED');

  if (rejectedSteps.length > 0) {
    return {
      isFullyApproved: false,
      statusLabel: `Rejected by ${rejectedSteps[0]?.approverUserName || 'Approver'}`,
    };
  }

  const completedCount = approvedSteps.length;
  const totalNeeded = request.requiredApprovalsCount;

  if (completedCount >= totalNeeded) {
    return {
      isFullyApproved: true,
      statusLabel: 'Fully authorized',
    };
  }

  const nextPending = request.steps.find((s) => s.status === 'PENDING');
  const nextRole = nextPending?.requiredRole || 'Treasurer';

  const statusLabel =
    totalNeeded > 1
      ? `${completedCount} of ${totalNeeded} approvals, waiting for ${nextRole}`
      : `Pending approval, waiting for ${nextRole}`;

  return {
    isFullyApproved: false,
    statusLabel,
    nextPendingStep: nextPending,
  };
}

/**
 * Validates an approval attempt against Section C3 strict rules:
 * 1. Self-approval rule: No one approves their own request.
 * 2. Uniqueness rule: The same person cannot satisfy two approvals.
 * 3. Role verification: Approver must have the required role at the time.
 * 4. Tamper invalidation: Approval is void if request was edited afterwards.
 */
export function validateApprovalStep(params: {
  request: ApprovalRequest;
  approverUserId: string;
  approverUserName: string;
  approverRole: Role;
  stepNumber?: number;
  requestEditedAt?: string;
}): { valid: boolean; error?: string } {
  const { request, approverUserId, approverRole, stepNumber, requestEditedAt } = params;

  // 1. Tamper check: If request was edited after any approval, existing approvals are void
  if (
    requestEditedAt &&
    request.steps.some((s) => s.status === 'APPROVED' && s.approvedAt && s.approvedAt < requestEditedAt)
  ) {
    return {
      valid: false,
      error: 'Approval void: Request was modified after approval. Re-approval required.',
    };
  }

  // 2. Self-approval check
  if (approverUserId === request.requesterUserId) {
    return {
      valid: false,
      error: 'Self-approval prohibited: Requesters cannot approve their own requests.',
    };
  }

  // 3. Uniqueness check: Same person cannot approve twice on same request
  const alreadyApprovedByThisUser = request.steps.some(
    (s) => s.status === 'APPROVED' && s.approverUserId === approverUserId
  );
  if (alreadyApprovedByThisUser) {
    return {
      valid: false,
      error: 'Dual-control violation: The same person cannot count as two approvals.',
    };
  }

  // Find target step
  const targetStep = stepNumber
    ? request.steps.find((s) => s.stepNumber === stepNumber)
    : request.steps.find((s) => s.status === 'PENDING');

  if (!targetStep) {
    return {
      valid: false,
      error: 'No pending approval steps remaining for this request.',
    };
  }

  // 4. Role check
  if (targetStep.requiredRole !== approverRole && approverRole !== 'Admin') {
    return {
      valid: false,
      error: `Role mismatch: Step requires ${targetStep.requiredRole} approval, but current user is ${approverRole}.`,
    };
  }

  return { valid: true };
}

/**
 * Applies an approval to the request and returns the updated request.
 */
export function applyApprovalStep(params: {
  request: ApprovalRequest;
  approverUserId: string;
  approverUserName: string;
  approverRole: Role;
  comments?: string;
}): ApprovalRequest {
  const { request, approverUserId, approverUserName, approverRole, comments } = params;

  const validation = validateApprovalStep({
    request,
    approverUserId,
    approverUserName,
    approverRole,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Approval validation failed.');
  }

  const nextPendingIndex = request.steps.findIndex((s) => s.status === 'PENDING');
  if (nextPendingIndex === -1) {
    return request;
  }

  const now = new Date().toISOString();
  const updatedSteps = request.steps.map((step, idx) => {
    if (idx === nextPendingIndex) {
      return {
        ...step,
        status: 'APPROVED' as const,
        approverUserId,
        approverUserName,
        approverRole,
        approvedAt: now,
        comments,
      };
    }
    return step;
  });

  const completedCount = updatedSteps.filter((s) => s.status === 'APPROVED').length;
  const isFullyApproved = completedCount >= request.requiredApprovalsCount;

  return {
    ...request,
    steps: updatedSteps,
    completedApprovalsCount: completedCount,
    status: isFullyApproved ? 'APPROVED' : 'PENDING',
  };
}

/**
 * Proposes a new version of the approval limits matrix.
 * Must be proposed by the Treasurer.
 */
export function proposeApprovalMatrix(params: {
  currentVersion: number;
  rules: readonly ApprovalMatrixRule[];
  proposedBy: string;
  proposerRole: Role;
  effectiveFrom: string;
}): ApprovalMatrixVersion {
  const { currentVersion, rules, proposedBy, proposerRole, effectiveFrom } = params;

  if (proposerRole !== 'Treasurer' && proposerRole !== 'Admin') {
    throw new Error('Only the Church Treasurer can propose modifications to approval limits.');
  }

  return {
    version: currentVersion + 1,
    effectiveFrom,
    proposedBy,
    proposedAt: new Date().toISOString(),
    status: 'PROPOSED',
    rules,
  };
}

/**
 * Approves a proposed approval limits matrix version.
 * Requires Pastor or Elder role (dual-custody governance).
 */
export function approveApprovalMatrix(params: {
  matrixVersion: ApprovalMatrixVersion;
  approverName: string;
  approverRole: Role;
}): ApprovalMatrixVersion {
  const { matrixVersion, approverName, approverRole } = params;

  if (approverRole !== 'Pastor / Elder' && approverRole !== 'Admin') {
    throw new Error('Approval limit modifications require sign-off by a Pastor or Elder.');
  }

  if (matrixVersion.status !== 'PROPOSED') {
    throw new Error('Only proposed approval limit versions can be approved.');
  }

  return {
    ...matrixVersion,
    approvedBy: approverName,
    approvedAt: new Date().toISOString(),
    status: 'ACTIVE',
  };
}
