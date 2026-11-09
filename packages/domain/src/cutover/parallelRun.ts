import type { Account, Fund, JournalEntry } from '../ledger/types.js';
import type {
  OldBookBalanceInput,
  ParallelRunComparisonRow,
  ParallelRunMonthSummary,
  ParallelRunOverallReport,
} from './types.js';

/**
 * Generates an Excel/CSV template for entering old-book balances for a month-end.
 */
export function generateParallelRunCsvTemplate(
  accounts: readonly Account[],
  funds: readonly Fund[]
): string {
  const activeAccounts = accounts.filter((a) => a.isActive);
  const activeFunds = funds.filter((f) => f.isActive);
  const defaultFund = activeFunds[0] ?? { code: 'GEN' };

  const lines = [
    'account_code,fund_code,account_name,old_book_balance_ghs,explanation',
    '# Template for Calvary Crystal Church monthly parallel run comparison',
    '# Enter positive numbers for normal balances (Dr for Assets/Expenses, Cr for Liabilities/Equity/Income)',
  ];

  for (const acct of activeAccounts) {
    // Recommend fund based on account characteristics
    const fundCode = acct.code === '1510' || acct.code === '3020' ? 'BLD' : defaultFund.code;
    lines.push(`${acct.code},${fundCode},"${acct.name.replace(/"/g, '""')}",0.00,`);
  }

  return lines.join('\n');
}

/**
 * Parses old-book CSV data.
 */
export function parseParallelRunCsv(csvText: string): OldBookBalanceInput[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const acctIdx = headers.findIndex((h) => h === 'account_code' || h === 'accountcode' || h === 'code');
  const fundIdx = headers.findIndex((h) => h === 'fund_code' || h === 'fundcode' || h === 'fund');
  const balIdx = headers.findIndex(
    (h) => h === 'old_book_balance_ghs' || h === 'balance' || h === 'old_book_balance' || h === 'amount'
  );
  const expIdx = headers.findIndex((h) => h === 'explanation' || h === 'notes' || h === 'reason');

  const rows: OldBookBalanceInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]!;
    // Simple CSV parse handling potential quotes in name column
    const cols: string[] = [];
    let inQuotes = false;
    let cur = '';
    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c]!;
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    cols.push(cur.trim());

    const accountCode = acctIdx >= 0 ? cols[acctIdx] ?? '' : cols[0] ?? '';
    const fundCode = fundIdx >= 0 ? cols[fundIdx] ?? 'GEN' : cols[1] ?? 'GEN';
    const balRaw = (balIdx >= 0 ? cols[balIdx] : cols[3]) ?? '0.00';
    const explanation = expIdx >= 0 ? cols[expIdx] ?? '' : cols[4] ?? '';

    if (!accountCode) continue;

    const num = Number(balRaw.replace(/,/g, '').trim());
    const oldBookBalanceGhs = !isNaN(num) ? BigInt(Math.round(num * 100)) : 0n;

    rows.push({
      accountCode,
      fundCode: fundCode.toUpperCase(),
      oldBookBalanceGhs,
      explanation: explanation || undefined,
    });
  }

  return rows;
}

/**
 * Computes net system balances by (accountId, fundId) as of a given cutoff date.
 * Net balance follows Ghanaian GAAP:
 * - Assets & Expenses: Total Debit - Total Credit
 * - Liabilities, Equity & Income: Total Credit - Total Debit
 */
export function calculateSystemBalancesByAccountAndFund(params: {
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly asOfDate: string; // YYYY-MM-DD (inclusive)
}): Map<string, bigint> {
  const result = new Map<string, bigint>();
  const accountsMap = new Map(params.accounts.map((a) => [a.id, a]));

  const validEntries = params.entries.filter((e) => e.entryDate <= params.asOfDate);

  for (const entry of validEntries) {
    for (const line of entry.lines) {
      const key = `${line.accountId}|${line.fundId}`;
      const prev = result.get(key) ?? 0n;

      const acct = accountsMap.get(line.accountId);
      const isDebitNormal = acct ? acct.type === 'Asset' || acct.type === 'Expense' : true;

      const delta = isDebitNormal
        ? line.debitAmountGhs - line.creditAmountGhs
        : line.creditAmountGhs - line.debitAmountGhs;

      result.set(key, prev + delta);
    }
  }

  return result;
}

export interface CompareParallelRunMonthInput {
  readonly periodId: string;
  readonly periodLabel: string;
  readonly asOfDate: string;
  readonly oldBookRows: readonly OldBookBalanceInput[];
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly isApproved?: boolean;
  readonly approvedByTreasurer?: string | null;
  readonly approvedAt?: string | null;
}

/**
 * Compares old-book totals against system ledger totals account by account and fund by fund.
 * Classifies each row into:
 * - AGREES: difference is 0.00
 * - EXPLAINED: difference != 0.00 and a non-empty written explanation is recorded
 * - UNEXPLAINED: difference != 0.00 and explanation is missing
 */
export function compareParallelRunMonth(
  input: CompareParallelRunMonthInput
): {
  readonly summary: ParallelRunMonthSummary;
  readonly rows: readonly ParallelRunComparisonRow[];
} {
  const accountsByCode = new Map(input.accounts.map((a) => [a.code, a]));
  const fundsByCode = new Map(input.funds.map((f) => [f.code.toUpperCase(), f]));
  const defaultFund = input.funds[0] ?? { id: 'fund-gen', code: 'GEN', name: 'General Fund' };

  const systemBalances = calculateSystemBalancesByAccountAndFund({
    entries: input.entries,
    accounts: input.accounts,
    asOfDate: input.asOfDate,
  });

  const comparisonMap = new Map<
    string,
    {
      account: Account;
      fund: Fund;
      oldBookGhs: bigint;
      systemGhs: bigint;
      explanation: string;
    }
  >();

  // 1. Ingest old book entries
  for (const oldRow of input.oldBookRows) {
    const acct = accountsByCode.get(oldRow.accountCode);
    const fund = fundsByCode.get(oldRow.fundCode.toUpperCase()) ?? defaultFund;
    if (!acct) continue;

    const key = `${acct.id}|${fund.id}`;
    const sysBal = systemBalances.get(key) ?? 0n;

    comparisonMap.set(key, {
      account: acct,
      fund: fund as Fund,
      oldBookGhs: oldRow.oldBookBalanceGhs,
      systemGhs: sysBal,
      explanation: (oldRow.explanation ?? '').trim(),
    });
  }

  // 2. Include any active accounts with system ledger activity not in old-book input
  for (const [key, sysBal] of systemBalances.entries()) {
    if (sysBal !== 0n && !comparisonMap.has(key)) {
      const [acctId, fundId] = key.split('|');
      const acct = input.accounts.find((a) => a.id === acctId);
      const fund = input.funds.find((f) => f.id === fundId) ?? defaultFund;
      if (acct) {
        comparisonMap.set(key, {
          account: acct,
          fund: fund as Fund,
          oldBookGhs: 0n,
          systemGhs: sysBal,
          explanation: '',
        });
      }
    }
  }

  const comparisonRows: ParallelRunComparisonRow[] = [];
  let agreesCount = 0;
  let explainedCount = 0;
  let unexplainedCount = 0;
  let totalOldBooksGhs = 0n;
  let totalSystemGhs = 0n;

  for (const item of comparisonMap.values()) {
    const varianceGhs = item.oldBookGhs - item.systemGhs;
    let status: ParallelRunComparisonRow['status'] = 'AGREES';

    if (varianceGhs !== 0n) {
      if (item.explanation.length > 0) {
        status = 'EXPLAINED';
        explainedCount++;
      } else {
        status = 'UNEXPLAINED';
        unexplainedCount++;
      }
    } else {
      agreesCount++;
    }

    totalOldBooksGhs += item.oldBookGhs;
    totalSystemGhs += item.systemGhs;

    comparisonRows.push({
      accountId: item.account.id,
      accountCode: item.account.code,
      accountName: item.account.name,
      accountType: item.account.type,
      fundId: item.fund.id,
      fundCode: item.fund.code,
      fundName: item.fund.name,
      oldBookBalanceGhs: item.oldBookGhs,
      systemBalanceGhs: item.systemGhs,
      varianceGhs,
      status,
      explanation: item.explanation,
    });
  }

  // Sort by account code ascending, then fund code
  comparisonRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode) || a.fundCode.localeCompare(b.fundCode));

  const canApprove = unexplainedCount === 0;

  let statusSummary: string;
  if (unexplainedCount === 0) {
    statusSummary =
      explainedCount > 0
        ? `${input.periodLabel} agrees (${explainedCount} explained)`
        : `${input.periodLabel} agrees`;
  } else {
    statusSummary = `${input.periodLabel} ${unexplainedCount} unexplained ${
      unexplainedCount === 1 ? 'difference' : 'differences'
    }`;
  }

  const summary: ParallelRunMonthSummary = {
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    asOfDate: input.asOfDate,
    totalAccountsCompared: comparisonRows.length,
    agreesCount,
    explainedCount,
    unexplainedCount,
    totalOldBooksGhs,
    totalSystemGhs,
    netVarianceGhs: totalOldBooksGhs - totalSystemGhs,
    isApproved: Boolean(input.isApproved),
    approvedByTreasurer: input.approvedByTreasurer ?? null,
    approvedAt: input.approvedAt ?? null,
    canApprove,
    statusSummary,
  };

  return {
    summary,
    rows: comparisonRows,
  };
}

/**
 * Builds the top-level summary line required by Spec B4:
 * e.g., "Parallel run: October agrees, November 2 unexplained differences"
 */
export function buildParallelRunSummaryLine(
  months: readonly ParallelRunMonthSummary[]
): string {
  if (months.length === 0) {
    return 'Parallel run: No comparison months configured';
  }
  const parts = months.map((m) => m.statusSummary);
  return `Parallel run: ${parts.join(', ')}`;
}

/**
 * Evaluates the full parallel run readiness across multiple month-ends.
 */
export function evaluateParallelRunOverall(params: {
  readonly months: readonly ParallelRunMonthSummary[];
  readonly requiredMonthEnds?: number; // default 2
}): ParallelRunOverallReport {
  const required = params.requiredMonthEnds ?? 2;
  const approvedCount = params.months.filter((m) => m.isApproved).length;
  const isParallelRunComplete = approvedCount >= required;
  const summaryLine = buildParallelRunSummaryLine(params.months);

  return {
    requiredMonthEnds: required,
    approvedMonthEndsCount: approvedCount,
    isParallelRunComplete,
    summaryLine,
    months: params.months,
  };
}

/**
 * Signs off a parallel run month by the chief accountant (Treasurer).
 */
export function signOffParallelRunMonth(params: {
  readonly summary: ParallelRunMonthSummary;
  readonly treasurerName: string;
  readonly actorRole?: string;
  readonly nowIso?: string;
}): ParallelRunMonthSummary {
  if (!params.summary.canApprove) {
    throw new Error(
      `Cannot approve parallel run for ${params.summary.periodLabel}: ${params.summary.unexplainedCount} unexplained difference(s) remain. Provide a written explanation for every difference first.`
    );
  }
  if (!params.treasurerName.trim()) {
    throw new Error('Chief accountant sign-off requires the Treasurer name.');
  }
  if (params.actorRole && params.actorRole !== 'Treasurer' && params.actorRole !== 'Admin') {
    throw new Error('Only the Chief Accountant (Treasurer) or Admin can sign off on parallel run months.');
  }

  return {
    ...params.summary,
    isApproved: true,
    approvedByTreasurer: params.treasurerName.trim(),
    approvedAt: params.nowIso ?? new Date().toISOString(),
  };
}
