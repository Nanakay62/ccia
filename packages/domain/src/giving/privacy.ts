import type { Role } from '../permissions/index.js';
import { canViewIndividualGiving } from '../permissions/index.js';
import type { MemberGivingRecord, Pledge } from './types.js';

export const CONFIDENTIAL_DONOR_MASK = '•••••••••••• (Confidential)';

/**
 * Applies privacy gating to a MemberGivingRecord based on the user's role.
 * Unauthorized roles receive masked donor names and stripped identifying markers.
 */
export function maskGivingRecordForRole(
  record: MemberGivingRecord,
  role: Role
): MemberGivingRecord {
  if (canViewIndividualGiving(role)) {
    return record;
  }

  return {
    ...record,
    memberId: undefined,
    memberName: CONFIDENTIAL_DONOR_MASK,
    memberNumber: undefined,
    envelopeNumber: undefined,
    notes: undefined,
  };
}

/**
 * Applies privacy gating to a Pledge record.
 */
export function maskPledgeForRole(pledge: Pledge, role: Role): Pledge {
  if (canViewIndividualGiving(role)) {
    return pledge;
  }

  return {
    ...pledge,
    memberId: 'masked',
    memberName: CONFIDENTIAL_DONOR_MASK,
    notes: undefined,
  };
}
