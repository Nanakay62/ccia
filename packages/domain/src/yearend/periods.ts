import type { Account, AccountingPeriod, Fund, JournalEntry, PeriodStatus } from '../ledger/types.js';
import { calculateTrialBalance } from '../ledger/rules.js';
import type {
  ComparativeLineItem,
  FinancialYear,
  FinancialYearWithPeriods,
  PeriodPostingPermission,
} from './types.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function getMonthName(month: number): string {
  if (month === 13) return 'Period 13 (Auditor Adjustment)';
  return MONTH_NAMES[(month - 1 + 12) % 12] ?? `Month ${month}`;
}

/**
 * Financial year start month can only be changed before the first ledger posting (Spec A1).
 */
export function canChangeFiscalYearStartMonth(postedEntriesCount: number): {
  readonly allowed: boolean;
  readonly reason?: string;
} {
  if (postedEntriesCount > 0) {
    return {
      allowed: false,
      reason: 'The financial year start month cannot be changed after the first journal entry has been posted.',
    };
  }
  return { allowed: true };
}

function getLastDayOfMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function formatIsoDate(year: number, month1Based: number, day: number): string {
  return `${year}-${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Generates a FinancialYear and its 12 monthly periods plus an optional Period 13
 * (adjustment period used for auditor adjustments after the 12th month is closed).
 */
export function generateFinancialYearWithPeriods(params: {
  readonly id: string;
  readonly branchId: string;
  readonly label: string; // e.g. "FY2026"
  readonly startYear: number; // e.g. 2026
  readonly startMonth?: number; // 1..12 (default 1 = January)
  readonly hasAdjustmentPeriod?: boolean; // default true (D4)
  readonly initialClosedMonthsCount?: number; // optional helper for seed/demo
}): FinancialYearWithPeriods {
  const startMonth = params.startMonth ?? 1;
  if (startMonth < 1 || startMonth > 12) {
    throw new Error(`Invalid financial year start month: ${startMonth}. Must be between 1 and 12.`);
  }
  const hasAdjustmentPeriod = params.hasAdjustmentPeriod ?? true;
  const closedCount = params.initialClosedMonthsCount ?? 0;

  const periods: AccountingPeriod[] = [];
  let fyStartDate = '';
  let fyEndDate = '';

  for (let i = 0; i < 12; i++) {
    const calendarMonth = ((startMonth - 1 + i) % 12) + 1;
    const calendarYear = params.startYear + Math.floor((startMonth - 1 + i) / 12);
    const lastDay = getLastDayOfMonth(calendarYear, calendarMonth);
    const periodStart = formatIsoDate(calendarYear, calendarMonth, 1);
    const periodEnd = formatIsoDate(calendarYear, calendarMonth, lastDay);

    if (i === 0) fyStartDate = periodStart;
    if (i === 11) fyEndDate = periodEnd;

    const isClosed = i < closedCount;
    const status: PeriodStatus = isClosed ? 'CLOSED' : 'OPEN';

    periods.push({
      id: `per-${params.label.toLowerCase()}-${String(i + 1).padStart(2, '0')}`,
      branchId: params.branchId,
      financialYearId: params.id,
      year: calendarYear,
      month: calendarMonth,
      isAdjustmentPeriod: false,
      status,
      startDate: periodStart,
      endDate: periodEnd,
      isClosed,
      closedAt: isClosed ? `${periodEnd}T23:59:59Z` : null,
      closedBy: isClosed ? 'Kofi Mensah (Treasurer)' : null,
    });
  }

  if (hasAdjustmentPeriod) {
    // Period 13 shares the final date of the financial year for auditor adjustments after Month 12 is closed
    const lastRegular = periods[11]!;
    periods.push({
      id: `per-${params.label.toLowerCase()}-13`,
      branchId: params.branchId,
      financialYearId: params.id,
      year: lastRegular.year,
      month: 13,
      isAdjustmentPeriod: true,
      status: 'OPEN',
      startDate: fyEndDate,
      endDate: fyEndDate,
      isClosed: false,
      closedAt: null,
      closedBy: null,
    });
  }

  const financialYear: FinancialYear = {
    id: params.id,
    branchId: params.branchId,
    label: params.label,
    startMonth,
    startDate: fyStartDate,
    endDate: fyEndDate,
    hasAdjustmentPeriod,
    status: 'OPEN',
  };

  return {
    financialYear,
    periods,
  };
}

/**
 * Evaluates whether a user with `userRole` is permitted to post an entry into `period` and `financialYear`.
 * Implements Spec A1 and A3.4:
 * - Locked year rejects all postings (offline entries go to Needs Attention).
 * - Reopened year allows postings ONLY into Period 13 (adjustment period).
 * - Closed period rejects postings.
 * - Soft-closed period permits ONLY the Treasurer to post.
 */
export function canPostToPeriod(params: {
  readonly period: AccountingPeriod;
  readonly financialYear?: FinancialYear | null;
  readonly userRole: string;
  readonly isOfflineSync?: boolean;
}): PeriodPostingPermission {
  const { period, financialYear, userRole, isOfflineSync } = params;

  if (financialYear) {
    if (financialYear.status === 'LOCKED') {
      return {
        allowed: false,
        reason: `Financial year ${financialYear.label} is locked. No entries can be posted into a locked year.`,
        routeOfflineToNeedsAttention: Boolean(isOfflineSync),
      };
    }

    if (financialYear.status === 'REOPENED_ADJUSTMENT_ONLY' && !period.isAdjustmentPeriod && period.month !== 13) {
      return {
        allowed: false,
        reason: `Financial year ${financialYear.label} was reopened for auditor adjustments only. Postings are restricted to Period 13.`,
        routeOfflineToNeedsAttention: Boolean(isOfflineSync),
      };
    }
  }

  const effectiveStatus: PeriodStatus = period.status ?? (period.isClosed ? 'CLOSED' : 'OPEN');

  if (effectiveStatus === 'CLOSED' || period.isClosed) {
    return {
      allowed: false,
      reason: `Period ${period.year}-${String(period.month).padStart(2, '0')} is closed and locked.`,
      routeOfflineToNeedsAttention: Boolean(isOfflineSync),
    };
  }

  if (effectiveStatus === 'SOFT_CLOSED' && userRole !== 'Treasurer') {
    return {
      allowed: false,
      reason: `Period ${period.year}-${String(period.month).padStart(2, '0')} is soft-closed. Only the Treasurer can post entries.`,
      routeOfflineToNeedsAttention: Boolean(isOfflineSync),
    };
  }

  return { allowed: true };
}

/**
 * Transitions a period between OPEN, SOFT_CLOSED, and CLOSED states.
 */
export function transitionPeriodStatus(params: {
  readonly period: AccountingPeriod;
  readonly nextStatus: PeriodStatus;
  readonly actorName: string;
  readonly actorRole: string;
  readonly nowIso?: string;
}): AccountingPeriod {
  const now = params.nowIso ?? new Date().toISOString();

  if (params.nextStatus === 'SOFT_CLOSED' || params.nextStatus === 'CLOSED') {
    if (params.actorRole !== 'Treasurer' && params.actorRole !== 'Finance Secretary') {
      throw new Error('Only the Treasurer or Finance Secretary can soft-close or close an accounting period.');
    }
  }

  if (params.period.status === 'CLOSED' && params.nextStatus !== 'CLOSED') {
    if (params.actorRole !== 'Treasurer') {
      throw new Error('Only the Treasurer can reopen a closed period.');
    }
  }

  return {
    ...params.period,
    status: params.nextStatus,
    isClosed: params.nextStatus === 'CLOSED',
    softClosedAt: params.nextStatus === 'SOFT_CLOSED' ? now : params.period.softClosedAt ?? null,
    softClosedBy: params.nextStatus === 'SOFT_CLOSED' ? params.actorName : params.period.softClosedBy ?? null,
    closedAt: params.nextStatus === 'CLOSED' ? now : null,
    closedBy: params.nextStatus === 'CLOSED' ? params.actorName : null,
  };
}

/**
 * Computes account-level comparatives between the selected financial year and the previous financial year (Spec A1).
 */
export function calculateYearOverYearComparatives(params: {
  readonly currentYearEntries: readonly JournalEntry[];
  readonly priorYearEntries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
}): readonly ComparativeLineItem[] {
  const currentTb = calculateTrialBalance(params.currentYearEntries, params.accounts, params.funds);
  const priorTb = calculateTrialBalance(params.priorYearEntries, params.accounts, params.funds);

  const priorByAccount = new Map(priorTb.accounts.map((a) => [a.accountId, a.netBalanceGhs]));
  const currentByAccount = new Map(currentTb.accounts.map((a) => [a.accountId, a.netBalanceGhs]));

  return params.accounts.map((acct) => {
    const currentYearGhs = currentByAccount.get(acct.id) ?? 0n;
    const priorYearGhs = priorByAccount.get(acct.id) ?? 0n;
    const varianceGhs = currentYearGhs - priorYearGhs;
    const variancePercent =
      priorYearGhs !== 0n
        ? Math.round((Number(varianceGhs) / Math.abs(Number(priorYearGhs))) * 1000) / 10
        : null;

    return {
      accountId: acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.type,
      currentYearGhs,
      priorYearGhs,
      varianceGhs,
      variancePercent,
    };
  });
}
