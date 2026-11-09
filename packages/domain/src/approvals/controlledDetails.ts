/**
 * Controlled Payment Details Manager (Spec Section C4).
 * Vendor, staff, and member payment details (bank account, MoMo number) are controlled data:
 * Any change needs a second person's approval before it can be used in a payment.
 * The change is highlighted on the next payment ("Details changed 2 days ago"),
 * and the historical value is preserved.
 */

import type { Role } from '../permissions/index.js';
import type {
  ControlledEntityType,
  ControlledDetailType,
  ControlledPaymentDetailChange,
} from './types.js';

export function createControlledDetailChange(params: {
  id?: string;
  entityType: ControlledEntityType;
  entityId: string;
  entityName: string;
  detailType: ControlledDetailType;
  oldValue: string;
  newValue: string;
  changedByUserId: string;
  changedByUserName: string;
}): ControlledPaymentDetailChange {
  return {
    id: params.id || `chg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    detailType: params.detailType,
    oldValue: params.oldValue,
    newValue: params.newValue,
    changedByUserId: params.changedByUserId,
    changedByUserName: params.changedByUserName,
    changedAt: new Date().toISOString(),
    status: 'PENDING_APPROVAL',
  };
}

/**
 * Validates and applies a second-person approval on controlled payment details.
 */
export function approveControlledDetailChange(params: {
  change: ControlledPaymentDetailChange;
  approverUserId: string;
  approverUserName: string;
  approverRole: Role;
}): ControlledPaymentDetailChange {
  const { change, approverUserId, approverUserName, approverRole } = params;

  // Rule: Approver CANNOT be the person who changed the detail
  if (approverUserId === change.changedByUserId) {
    throw new Error(
      'Dual-control violation: The person who modified payment details cannot approve their own change.'
    );
  }

  // Must have Treasurer, Finance Secretary, or Pastor/Elder role
  if (
    approverRole !== 'Treasurer' &&
    approverRole !== 'Finance Secretary' &&
    approverRole !== 'Pastor / Elder' &&
    approverRole !== 'Admin'
  ) {
    throw new Error(
      'Insufficient privileges: Only financial officers can approve payment detail modifications.'
    );
  }

  return {
    ...change,
    status: 'APPROVED',
    approvedByUserId: approverUserId,
    approvedByUserName: approverUserName,
    approvedAt: new Date().toISOString(),
  };
}

/**
 * Formats a human-readable banner / tag for payments involving recently changed details:
 * e.g. "Details changed 2 days ago by Akosua Osei (Approved by Kofi Mensah)"
 */
export function formatPaymentDetailHighlight(
  change: ControlledPaymentDetailChange,
  now: Date = new Date()
): {
  isPendingApproval: boolean;
  canDisburse: boolean;
  bannerText: string;
} {
  if (change.status === 'PENDING_APPROVAL') {
    return {
      isPendingApproval: true,
      canDisburse: false,
      bannerText: `Payment details changed on ${change.changedAt.slice(0, 10)} by ${
        change.changedByUserName
      }. Pending second-person approval before disbursement.`,
    };
  }

  if (change.status === 'REJECTED') {
    return {
      isPendingApproval: false,
      canDisburse: false,
      bannerText: `Payment details change was rejected. Revert to original details before disbursement.`,
    };
  }

  const changeDate = new Date(change.approvedAt || change.changedAt);
  const diffMs = now.getTime() - changeDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeDesc =
    diffDays === 0
      ? 'today'
      : diffDays === 1
      ? 'yesterday'
      : `${diffDays} days ago`;

  return {
    isPendingApproval: false,
    canDisburse: true,
    bannerText: `Payment details changed ${timeDesc} by ${change.changedByUserName} (Approved by ${
      change.approvedByUserName || 'Officer'
    })`,
  };
}
