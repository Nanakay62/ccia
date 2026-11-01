/**
 * Operational & Administrative Report Generators.
 * Budget vs Actual, Giving Summary, Pledge Status, Bank Reconciliation, and Audit Log Reports.
 */

import type { Role } from '../permissions/index.js';
import { canViewIndividualGiving } from '../permissions/index.js';
import type { Member, Pledge, MemberGivingRecord, CountingSheet } from '../giving/types.js';
import type { JournalEntry, Account, Fund } from '../ledger/types.js';
import type { AuditLogEntry } from '../audit/index.js';
import type {
  BudgetVsActualReport,
  BudgetVsActualItem,
  GivingSummaryReport,
  GivingCategoryBreakdown,
  GivingChannelBreakdown,
  PledgeStatusReport,
  CampaignPledgeSummary,
  PledgeStatusItem,
  BankReconciliationReport,
  AuditLogReport,
  AuditLogReportItem,
} from './types.js';

export interface BudgetDefinition {
  readonly accountCode: string;
  readonly accountName: string;
  readonly category: 'INCOME' | 'EXPENSE';
  readonly annualBudgetPesewas: bigint;
}

export interface GenerateBudgetVsActualInput {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly budgets: readonly BudgetDefinition[];
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
}

/**
 * Generates the Budget vs Actual Report.
 */
export function generateBudgetVsActualReport(
  input: GenerateBudgetVsActualInput
): BudgetVsActualReport {
  const { periodStart, periodEnd, budgets, entries, accounts } = input;

  const periodEntries = entries.filter(
    (e) => e.entryDate >= periodStart && e.entryDate <= periodEnd
  );

  const actualsMap = new Map<string, bigint>();

  for (const entry of periodEntries) {
    for (const line of entry.lines) {
      const acct = accounts.find((a) => a.id === line.accountId);
      if (!acct) continue;

      const current = actualsMap.get(acct.code) || 0n;
      if (acct.type === 'Income') {
        actualsMap.set(acct.code, current + (line.creditAmountGhs - line.debitAmountGhs));
      } else if (acct.type === 'Expense') {
        actualsMap.set(acct.code, current + (line.debitAmountGhs - line.creditAmountGhs));
      }
    }
  }

  let totalBudgetIncomePesewas = 0n;
  let totalActualIncomePesewas = 0n;
  let totalBudgetExpensePesewas = 0n;
  let totalActualExpensePesewas = 0n;

  const items: BudgetVsActualItem[] = budgets.map((b) => {
    const actual = actualsMap.get(b.accountCode) || 0n;
    const isIncome = b.category === 'INCOME';

    if (isIncome) {
      totalBudgetIncomePesewas += b.annualBudgetPesewas;
      totalActualIncomePesewas += actual;
    } else {
      totalBudgetExpensePesewas += b.annualBudgetPesewas;
      totalActualExpensePesewas += actual;
    }

    // Variance:
    // For Income: positive if Actual > Budget (Favourable)
    // For Expense: positive if Budget > Actual (Favourable - spent less than budgeted)
    const variancePesewas = isIncome
      ? actual - b.annualBudgetPesewas
      : b.annualBudgetPesewas - actual;

    const isFavourable = variancePesewas >= 0n;

    let variancePercentage = 0;
    if (b.annualBudgetPesewas > 0n) {
      variancePercentage =
        Number((actual * 10000n) / b.annualBudgetPesewas) / 100;
    }

    return {
      accountCode: b.accountCode,
      accountName: b.accountName,
      category: b.category,
      budgetPesewas: b.annualBudgetPesewas,
      actualPesewas: actual,
      variancePesewas,
      variancePercentage,
      isFavourable,
    };
  });

  return {
    title: 'Departmental Budget vs. Actual Expenditure Report',
    periodStart,
    periodEnd,
    currency: 'GHS',
    items,
    totalBudgetIncomePesewas,
    totalActualIncomePesewas,
    totalBudgetExpensePesewas,
    totalActualExpensePesewas,
    netBudgetSurplusPesewas: totalBudgetIncomePesewas - totalBudgetExpensePesewas,
    netActualSurplusPesewas: totalActualIncomePesewas - totalActualExpensePesewas,
  };
}

export interface GenerateGivingSummaryInput {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly countingSheets: readonly CountingSheet[];
  readonly givingRecords: readonly MemberGivingRecord[];
  readonly funds: readonly Fund[];
}

/**
 * Generates the Giving Summary Report by Category, Fund, and Channel.
 */
export function generateGivingSummaryReport(
  input: GenerateGivingSummaryInput
): GivingSummaryReport {
  const { periodStart, periodEnd, countingSheets, givingRecords, funds } = input;

  const validSheets = countingSheets.filter(
    (s) => s.serviceDate >= periodStart && s.serviceDate <= periodEnd
  );

  const categoryTotals = new Map<string, { count: number; total: bigint }>();
  const fundTotals = new Map<string, bigint>();
  for (const f of funds) {
    fundTotals.set(f.name, 0n);
  }

  let totalCashGhs = 0n;
  let totalCashGhsCount = 0;
  let totalCashUsdGhs = 0n;
  let totalCashUsdCount = 0;
  let totalChequeGhs = 0n;
  let totalChequeCount = 0;
  let totalMoMoGhs = 0n;
  let totalMoMoCount = 0;

  for (const sheet of validSheets) {
    totalCashGhs += sheet.totalCashGhsPesewas;
    totalCashGhsCount++;

    if (sheet.totalCashUsdCents > 0n) {
      totalCashUsdCount++;
    }

    totalChequeGhs += sheet.totalChequesGhsPesewas;
    if (sheet.cheques.length > 0) totalChequeCount += sheet.cheques.length;

    totalMoMoGhs += sheet.totalMomoGhsPesewas;
    if (sheet.momoTransactions.length > 0) totalMoMoCount += sheet.momoTransactions.length;

    // Fund allocation lines
    for (const alloc of sheet.fundAllocations) {
      const fund = funds.find((f) => f.id === alloc.fundId);
      const fName = fund?.name || alloc.fundName || 'General Fund';
      const cur = fundTotals.get(fName) || 0n;
      fundTotals.set(fName, cur + alloc.amountPesewas);

      // Category attribution
      const catKey = alloc.category || 'General Offering';
      const catVal = categoryTotals.get(catKey) || { count: 0, total: 0n };
      catVal.count++;
      catVal.total += alloc.amountPesewas;
      categoryTotals.set(catKey, catVal);
    }
  }

  // Include individual member tithes/pledges recorded in the period
  const validRecords = givingRecords.filter(
    (r) => r.serviceDate >= periodStart && r.serviceDate <= periodEnd
  );

  for (const rec of validRecords) {
    const cur = categoryTotals.get(rec.category) || { count: 0, total: 0n };
    cur.count++;
    cur.total += rec.amountPesewas;
    categoryTotals.set(rec.category, cur);
  }

  const grandTotal =
    totalCashGhs + totalCashUsdGhs + totalChequeGhs + totalMoMoGhs;

  const byCategory: GivingCategoryBreakdown[] = Array.from(categoryTotals.entries()).map(
    ([category, data]) => ({
      category,
      count: data.count,
      totalPesewas: data.total,
      percentage:
        grandTotal > 0n ? Number((data.total * 10000n) / grandTotal) / 100 : 0,
    })
  );

  const byFund = Array.from(fundTotals.entries()).map(([fundName, totalPesewas]) => ({
    fundName,
    totalPesewas,
    percentage:
      grandTotal > 0n ? Number((totalPesewas * 10000n) / grandTotal) / 100 : 0,
  }));

  const byChannel: GivingChannelBreakdown[] = [
    {
      channel: 'CASH_GHS',
      channelLabel: 'Physical Cash (Ghana Cedis)',
      count: totalCashGhsCount,
      totalPesewas: totalCashGhs,
    },
    {
      channel: 'CASH_USD',
      channelLabel: 'Foreign Currency Cash (USD)',
      count: totalCashUsdCount,
      totalPesewas: totalCashUsdGhs,
    },
    {
      channel: 'CHEQUE',
      channelLabel: 'Bank Cheques Cleared',
      count: totalChequeCount,
      totalPesewas: totalChequeGhs,
    },
    {
      channel: 'MOMO',
      channelLabel: 'Mobile Money (MTN / Vodafone / Telecel)',
      count: totalMoMoCount,
      totalPesewas: totalMoMoGhs,
    },
  ];

  return {
    title: 'Giving Summary & Revenue Channel Report',
    periodStart,
    periodEnd,
    currency: 'GHS',
    byCategory,
    byFund,
    byChannel,
    totalGivingPesewas: grandTotal,
    totalTransactions: validSheets.length + validRecords.length,
  };
}

export interface GeneratePledgeStatusInput {
  readonly asOfDate: string;
  readonly pledges: readonly Pledge[];
  readonly members: readonly Member[];
  readonly role: Role;
}

/**
 * Generates the Pledge Status Report with strict privacy masking.
 */
export function generatePledgeStatusReport(
  input: GeneratePledgeStatusInput
): PledgeStatusReport {
  const { asOfDate, pledges, members, role } = input;
  const membersMap = new Map(members.map((m) => [m.id, m]));
  const canViewNames = canViewIndividualGiving(role);

  const campaignsMap = new Map<
    string,
    {
      fundName: string;
      target: bigint;
      pledged: bigint;
      fulfilled: bigint;
      donors: Set<string>;
    }
  >();

  let totalPledgedPesewas = 0n;
  let totalFulfilledPesewas = 0n;

  const pledgeItems: PledgeStatusItem[] = [];

  for (const p of pledges) {
    const member = membersMap.get(p.memberId);
    const donorName = canViewNames
      ? member?.fullName || p.memberName || 'Church Member'
      : '•••••••••••• (Confidential)';

    const outstanding = p.targetAmountPesewas > p.paidAmountPesewas
      ? p.targetAmountPesewas - p.paidAmountPesewas
      : 0n;

    totalPledgedPesewas += p.targetAmountPesewas;
    totalFulfilledPesewas += p.paidAmountPesewas;

    pledgeItems.push({
      pledgeId: p.id,
      donorName,
      campaignName: p.campaignName,
      pledgedPesewas: p.targetAmountPesewas,
      fulfilledPesewas: p.paidAmountPesewas,
      outstandingPesewas: outstanding,
      status: p.status,
    });

    const cData = campaignsMap.get(p.campaignName) || {
      fundName: p.fundName || 'Building Fund',
      target: 25000000n, // GHS 250,000 default target
      pledged: 0n,
      fulfilled: 0n,
      donors: new Set<string>(),
    };
    cData.pledged += p.targetAmountPesewas;
    cData.fulfilled += p.paidAmountPesewas;
    cData.donors.add(p.memberId);
    campaignsMap.set(p.campaignName, cData);
  }

  const campaigns: CampaignPledgeSummary[] = Array.from(campaignsMap.entries()).map(
    ([campaignName, data]) => {
      const outstanding =
        data.pledged > data.fulfilled ? data.pledged - data.fulfilled : 0n;
      const fulfillmentPercentage =
        data.pledged > 0n
          ? Number((data.fulfilled * 10000n) / data.pledged) / 100
          : 0;

      return {
        campaignName,
        fundName: data.fundName,
        targetPesewas: data.target,
        totalPledgedPesewas: data.pledged,
        totalFulfilledPesewas: data.fulfilled,
        outstandingPesewas: outstanding,
        fulfillmentPercentage,
        donorCount: data.donors.size,
      };
    }
  );

  return {
    title: 'Building & Special Pledge Campaign Status Report',
    asOfDate,
    campaigns,
    pledges: pledgeItems,
    totalPledgedPesewas,
    totalFulfilledPesewas,
    totalOutstandingPesewas:
      totalPledgedPesewas > totalFulfilledPesewas
        ? totalPledgedPesewas - totalFulfilledPesewas
        : 0n,
  };
}

export interface GenerateBankReconciliationInput {
  readonly bankAccount: Account;
  readonly asOfDate: string;
  readonly entries: readonly JournalEntry[];
  readonly bankStatementBalancePesewas: bigint;
  readonly outstandingCheques?: readonly { readonly reference: string; readonly payee: string; readonly amountPesewas: bigint }[];
  readonly depositsInTransit?: readonly { readonly reference: string; readonly source: string; readonly amountPesewas: bigint }[];
}

/**
 * Generates the Bank & Cash Reconciliation Report.
 */
export function generateBankReconciliationReport(
  input: GenerateBankReconciliationInput
): BankReconciliationReport {
  const {
    bankAccount,
    asOfDate,
    entries,
    bankStatementBalancePesewas,
    outstandingCheques = [],
    depositsInTransit = [],
  } = input;

  // Calculate book balance as of date
  let bookBalancePesewas = 0n;

  for (const entry of entries) {
    if (entry.entryDate > asOfDate) continue;
    for (const line of entry.lines) {
      if (line.accountId === bankAccount.id) {
        bookBalancePesewas += line.debitAmountGhs - line.creditAmountGhs;
      }
    }
  }

  const totalOutstandingChequesPesewas = outstandingCheques.reduce(
    (sum, chq) => sum + chq.amountPesewas,
    0n
  );
  const totalDepositsInTransitPesewas = depositsInTransit.reduce(
    (sum, dep) => sum + dep.amountPesewas,
    0n
  );

  // Adjusted Bank Balance = Statement Balance + Deposits in Transit - Outstanding Cheques
  const adjustedBankBalance =
    bankStatementBalancePesewas +
    totalDepositsInTransitPesewas -
    totalOutstandingChequesPesewas;

  const discrepancyPesewas = bookBalancePesewas - adjustedBankBalance;

  return {
    title: `Bank & Cash Reconciliation Report - ${bankAccount.name}`,
    bankAccountId: bankAccount.id,
    bankAccountName: bankAccount.name,
    asOfDate,
    currency: 'GHS',
    bookBalancePesewas,
    outstandingCheques,
    totalOutstandingChequesPesewas,
    depositsInTransit,
    totalDepositsInTransitPesewas,
    adjustedBookBalancePesewas: adjustedBankBalance,
    bankStatementBalancePesewas,
    discrepancyPesewas,
    isReconciled: discrepancyPesewas === 0n,
  };
}

export interface GenerateAuditLogReportInput {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly auditLogs: readonly AuditLogEntry[];
}

/**
 * Generates the Append-Only Audit Trail Report.
 */
export function generateAuditLogReport(
  input: GenerateAuditLogReportInput
): AuditLogReport {
  const { periodStart, periodEnd, auditLogs } = input;

  const validLogs = auditLogs.filter((l) => {
    const logDate = l.performedAt.substring(0, 10);
    return logDate >= periodStart && logDate <= periodEnd;
  });

  const entries: AuditLogReportItem[] = validLogs.map((l) => ({
    id: l.id,
    timestamp: l.performedAt,
    userId: l.performedBy,
    userName: l.performedBy === 'usr-001' ? 'Elder Kofi Mensah' : 'Finance Officer',
    userRole: l.action === 'REVERSAL' ? 'Treasurer' : 'Finance Staff',
    deviceId: l.deviceId,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    details: l.reason || JSON.stringify(l.afterState || {}),
  }));

  return {
    title: 'Append-Only Ledger Audit & Compliance Trail',
    periodStart,
    periodEnd,
    entries,
    totalEvents: entries.length,
  };
}
