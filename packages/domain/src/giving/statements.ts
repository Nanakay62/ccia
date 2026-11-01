/**
 * Member Giving Statements Generator.
 * Generates comprehensive official financial contribution statements for church members
 * with Ghanaian legal tender phrasing, category breakdowns, and pledge fulfillment summaries.
 */

import type { Role } from '../permissions/index.js';
import { canViewIndividualGiving } from '../permissions/index.js';
import { numberToWordsGhs } from './receipts.js';
import type { Member, MemberGivingRecord, Pledge, GivingCategory } from './types.js';

export interface MemberGivingStatementLine {
  readonly receiptNumber: string;
  readonly serviceDate: string;
  readonly category: GivingCategory;
  readonly fundName: string;
  readonly paymentMethod: string;
  readonly amountPesewas: bigint;
}

export interface MemberGivingStatement {
  readonly statementNumber: string;
  readonly churchName: string;
  readonly branchName: string;
  readonly statementDate: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly memberNumber?: string;
  readonly envelopeNumber?: string;
  readonly lines: readonly MemberGivingStatementLine[];
  readonly byCategory: readonly { readonly category: GivingCategory; readonly totalPesewas: bigint }[];
  readonly byFund: readonly { readonly fundName: string; readonly totalPesewas: bigint }[];
  readonly totalContributedPesewas: bigint;
  readonly totalContributedFigures: string;
  readonly totalContributedWords: string;
  readonly pledgeCampaigns: readonly {
    readonly campaignName: string;
    readonly pledgedPesewas: bigint;
    readonly fulfilledPesewas: bigint;
    readonly outstandingPesewas: bigint;
  }[];
  readonly officialGratitudeText: string;
  readonly certifyingOfficer: string;
  readonly certifyingOfficerRole: string;
}

export interface GenerateStatementInput {
  readonly member: Member;
  readonly records: readonly MemberGivingRecord[];
  readonly pledges: readonly Pledge[];
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly requestingRole: Role;
  readonly certifyingOfficer?: string;
  readonly certifyingOfficerRole?: string;
  readonly churchName?: string;
  readonly branchName?: string;
}

/**
 * Generates an official Member Giving Statement.
 */
export function generateMemberGivingStatement(
  input: GenerateStatementInput
): MemberGivingStatement {
  const {
    member,
    records,
    pledges,
    periodStart,
    periodEnd,
    requestingRole,
    certifyingOfficer = 'Elder Kofi Mensah',
    certifyingOfficerRole = 'Church Treasurer',
    churchName = 'Accra Central Grace Chapel',
    branchName = 'Accra Main Branch',
  } = input;

  const canSeeDetails = canViewIndividualGiving(requestingRole);

  const memberName = canSeeDetails
    ? member.fullName
    : '•••••••••••• (Confidential)';
  const memberNumber = canSeeDetails ? member.memberNumber : undefined;
  const envelopeNumber = canSeeDetails ? member.envelopeNumber : undefined;

  // Filter records belonging to this member in the specified period
  const memberRecords = records.filter((r) => {
    const isThisMember =
      r.memberId === member.id ||
      (r.envelopeNumber && r.envelopeNumber === member.envelopeNumber);
    return isThisMember && r.serviceDate >= periodStart && r.serviceDate <= periodEnd;
  });

  const lines: MemberGivingStatementLine[] = memberRecords.map((r) => ({
    receiptNumber: r.receiptNumber,
    serviceDate: r.serviceDate,
    category: r.category,
    fundName: r.fundName,
    paymentMethod: r.paymentMethod,
    amountPesewas: r.amountPesewas,
  })).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));

  let totalContributedPesewas = 0n;
  const categoryMap = new Map<GivingCategory, bigint>();
  const fundMap = new Map<string, bigint>();

  for (const line of lines) {
    totalContributedPesewas += line.amountPesewas;

    const catCur = categoryMap.get(line.category) || 0n;
    categoryMap.set(line.category, catCur + line.amountPesewas);

    const fCur = fundMap.get(line.fundName) || 0n;
    fundMap.set(line.fundName, fCur + line.amountPesewas);
  }

  const byCategory = Array.from(categoryMap.entries()).map(([category, totalPesewas]) => ({
    category,
    totalPesewas,
  }));

  const byFund = Array.from(fundMap.entries()).map(([fundName, totalPesewas]) => ({
    fundName,
    totalPesewas,
  }));

  // Member's pledges
  const memberPledges = pledges.filter((p) => p.memberId === member.id);
  const pledgeCampaigns = memberPledges.map((p) => {
    const outstanding =
      p.targetAmountPesewas > p.paidAmountPesewas
        ? p.targetAmountPesewas - p.paidAmountPesewas
        : 0n;
    return {
      campaignName: p.campaignName,
      pledgedPesewas: p.targetAmountPesewas,
      fulfilledPesewas: p.paidAmountPesewas,
      outstandingPesewas: outstanding,
    };
  });

  const now = new Date().toISOString().substring(0, 10);
  const totalFigures = `GHS ${(Number(totalContributedPesewas) / 100).toFixed(2)}`;
  const totalWords = numberToWordsGhs(totalContributedPesewas);

  const officialGratitudeText =
    'We gratefully acknowledge and thank you for your faithful, consistent, and generous financial support toward the ministry and work of the Lord at Accra Central Grace Chapel. May the Lord richly bless and reward your labor of love.';

  return {
    statementNumber: `STMT-${member.memberNumber || 'MEM'}-${now.replace(/-/g, '')}`,
    churchName,
    branchName,
    statementDate: now,
    periodStart,
    periodEnd,
    memberId: member.id,
    memberName,
    memberNumber,
    envelopeNumber,
    lines,
    byCategory,
    byFund,
    totalContributedPesewas,
    totalContributedFigures: totalFigures,
    totalContributedWords: totalWords,
    pledgeCampaigns,
    officialGratitudeText,
    certifyingOfficer,
    certifyingOfficerRole,
  };
}
