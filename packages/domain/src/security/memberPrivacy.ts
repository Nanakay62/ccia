/**
 * Member Data Privacy & Ghana Data Protection Act Compliance (Spec Section C6).
 * 1. Generates complete member data dossier for data export requests.
 * 2. Anonymises former members while strictly preserving general ledger totals and fund integrity.
 */

import type { MemberGivingRecord } from '../giving/types.js';

export interface MemberProfile {
  readonly id: string;
  readonly fullName: string;
  readonly memberNumber?: string;
  readonly envelopeNumber?: string;
  readonly phoneNumber?: string;
  readonly email?: string;
  readonly address?: string;
  readonly dateJoined?: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'FORMER' | 'ANONYMISED';
}

export interface MemberPledgeRecord {
  readonly id: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly campaignName: string;
  readonly targetPesewas: bigint;
  readonly fulfilledPesewas: bigint;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface MemberAccessAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly actorRole: string;
  readonly purpose: string;
  readonly recordsViewedCount: number;
}

export interface MemberDataDossier {
  readonly memberId: string;
  readonly exportDate: string;
  readonly exportedBy: string;
  readonly exportPurpose: string;
  readonly profile: MemberProfile;
  readonly givingHistory: readonly MemberGivingRecord[];
  readonly totalGivingPesewas: bigint;
  readonly pledges: readonly MemberPledgeRecord[];
  readonly accessAuditTrail: readonly MemberAccessAuditEntry[];
  readonly ghanaDataProtectionActNotice: string;
}

/**
 * 1. Generates an official, comprehensive member data dossier.
 */
export function generateMemberDataDossier(params: {
  readonly member: MemberProfile;
  readonly givingRecords: readonly MemberGivingRecord[];
  readonly pledges: readonly MemberPledgeRecord[];
  readonly accessAuditTrail: readonly MemberAccessAuditEntry[];
  readonly exportedBy: string;
  readonly exportPurpose: string;
}): MemberDataDossier {
  const memberGiving = params.givingRecords.filter((g) => g.memberId === params.member.id);
  const memberPledges = params.pledges.filter((p) => p.memberId === params.member.id);
  const totalGiving = memberGiving.reduce((sum, g) => sum + g.amountPesewas, 0n);

  return {
    memberId: params.member.id,
    exportDate: new Date().toISOString(),
    exportedBy: params.exportedBy,
    exportPurpose: params.exportPurpose,
    profile: params.member,
    givingHistory: memberGiving,
    totalGivingPesewas: totalGiving,
    pledges: memberPledges,
    accessAuditTrail: params.accessAuditTrail,
    ghanaDataProtectionActNotice:
      'This data dossier is issued in compliance with the Ghana Data Protection Act, 2012 (Act 843). Calvary Crystal Church guarantees confidentiality and statutory data subject access rights.',
  };
}

export interface AnonymisationResult {
  readonly anonymisedMember: MemberProfile;
  readonly anonymisedGivingRecords: readonly MemberGivingRecord[];
  readonly anonymisedPledges: readonly MemberPledgeRecord[];
  readonly anonymisationAuditRecord: {
    readonly memberId: string;
    readonly timestamp: string;
    readonly executedBy: string;
    readonly reason: string;
    readonly ledgerIntactNotice: string;
  };
}

/**
 * 2. Anonymises a former member across lists and statements while strictly preserving
 * general ledger totals, fund allocations, and financial history.
 */
export function anonymiseFormerMember(params: {
  readonly member: MemberProfile;
  readonly givingRecords: readonly MemberGivingRecord[];
  readonly pledges: readonly MemberPledgeRecord[];
  readonly executedBy: string;
  readonly reason: string;
}): AnonymisationResult {
  const shortId = params.member.id.slice(-6).toUpperCase();
  const anonymisedLabel = `Former Member (Anonymised - #${shortId})`;

  const anonymisedMember: MemberProfile = {
    ...params.member,
    fullName: anonymisedLabel,
    phoneNumber: undefined,
    email: undefined,
    address: undefined,
    status: 'ANONYMISED',
  };

  const anonymisedGivingRecords = params.givingRecords.map((g) => {
    if (g.memberId !== params.member.id) return g;
    return {
      ...g,
      memberName: anonymisedLabel,
    };
  });

  const anonymisedPledges = params.pledges.map((p) => {
    if (p.memberId !== params.member.id) return p;
    return {
      ...p,
      memberName: anonymisedLabel,
    };
  });

  const auditRecord = {
    memberId: params.member.id,
    timestamp: new Date().toISOString(),
    executedBy: params.executedBy,
    reason: params.reason,
    ledgerIntactNotice:
      'Member personal identifiers anonymised. All General Ledger journal entries, tithe batches, and fund totals remain 100% intact and unaltered.',
  };

  return {
    anonymisedMember,
    anonymisedGivingRecords,
    anonymisedPledges,
    anonymisationAuditRecord: auditRecord,
  };
}
