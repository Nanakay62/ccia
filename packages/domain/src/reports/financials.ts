/**
 * Financial Statement Generators.
 * Income & Expenditure Statement, Balance Sheet, Fund Balance Report, and Cash Flow Summary.
 */

import type { Account, Fund, JournalEntry } from '../ledger/types.js';
import type {
  IncomeExpenditureReport,
  BalanceSheetReport,
  FundBalanceReport,
  CashFlowReport,
  ReportLineItem,
  FundBalanceItemReport,
} from './types.js';

export interface GenerateFinancialsInput {
  readonly churchName?: string;
  readonly branchName?: string;
  readonly periodStart: string; // 'YYYY-MM-DD'
  readonly periodEnd: string;   // 'YYYY-MM-DD'
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
}

/**
 * Generates an Income & Expenditure Statement for the specified period.
 */
export function generateIncomeExpenditureStatement(
  input: GenerateFinancialsInput
): IncomeExpenditureReport {
  const {
    churchName = 'Calvary Crystal Church',
    branchName = 'Main Branch',
    periodStart,
    periodEnd,
    entries,
    accounts,
    funds,
  } = input;

  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  // Filter entries within date range
  const periodEntries = entries.filter(
    (e) => e.entryDate >= periodStart && e.entryDate <= periodEnd
  );

  const incomeMap = new Map<string, { code: string; name: string; amount: bigint }>();
  const expenseMap = new Map<string, { code: string; name: string; amount: bigint }>();
  const fundTotals = new Map<string, { income: bigint; expense: bigint }>();

  for (const fund of funds) {
    fundTotals.set(fund.id, { income: 0n, expense: 0n });
  }

  for (const entry of periodEntries) {
    for (const line of entry.lines) {
      const acct = accountsMap.get(line.accountId);
      if (!acct) continue;

      if (acct.type === 'Income') {
        // Income is normally credited: net credit = creditAmountGhs - debitAmountGhs
        const netIncome = line.creditAmountGhs - line.debitAmountGhs;
        const existing = incomeMap.get(acct.id) || { code: acct.code, name: acct.name, amount: 0n };
        existing.amount += netIncome;
        incomeMap.set(acct.id, existing);

        const fTot = fundTotals.get(line.fundId);
        if (fTot) fTot.income += netIncome;
      } else if (acct.type === 'Expense') {
        // Expense is normally debited: net debit = debitAmountGhs - creditAmountGhs
        const netExpense = line.debitAmountGhs - line.creditAmountGhs;
        const existing = expenseMap.get(acct.id) || { code: acct.code, name: acct.name, amount: 0n };
        existing.amount += netExpense;
        expenseMap.set(acct.id, existing);

        const fTot = fundTotals.get(line.fundId);
        if (fTot) fTot.expense += netExpense;
      }
    }
  }

  const incomes: ReportLineItem[] = Array.from(incomeMap.values())
    .map((item) => ({
      accountCode: item.code,
      accountName: item.name,
      amountPesewas: item.amount,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const expenses: ReportLineItem[] = Array.from(expenseMap.values())
    .map((item) => ({
      accountCode: item.code,
      accountName: item.name,
      amountPesewas: item.amount,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalIncomePesewas = incomes.reduce((sum, item) => sum + item.amountPesewas, 0n);
  const totalExpensePesewas = expenses.reduce((sum, item) => sum + item.amountPesewas, 0n);
  const netSurplusDeficitPesewas = totalIncomePesewas - totalExpensePesewas;

  const fundBreakdown = funds.map((f) => {
    const tot = fundTotals.get(f.id) || { income: 0n, expense: 0n };
    return {
      fundId: f.id,
      fundName: f.name,
      fundType: f.type,
      incomePesewas: tot.income,
      expensePesewas: tot.expense,
      netPesewas: tot.income - tot.expense,
    };
  });

  return {
    title: 'Statement of Income and Expenditure',
    churchName,
    branchName,
    periodStart,
    periodEnd,
    currency: 'GHS',
    incomes,
    totalIncomePesewas,
    expenses,
    totalExpensePesewas,
    netSurplusDeficitPesewas,
    fundBreakdown,
  };
}

export interface GenerateBalanceSheetInput {
  readonly churchName?: string;
  readonly branchName?: string;
  readonly asOfDate: string;
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
}

/**
 * Generates a Balance Sheet / Statement of Financial Position as of a specified date.
 */
export function generateBalanceSheet(
  input: GenerateBalanceSheetInput
): BalanceSheetReport {
  const {
    churchName = 'Calvary Crystal Church',
    branchName = 'Main Branch',
    asOfDate,
    entries,
    accounts,
    funds,
  } = input;

  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  // Entries up to and including asOfDate
  const validEntries = entries.filter((e) => e.entryDate <= asOfDate);

  // Compute account balances (cumulative)
  const balances = new Map<string, bigint>();
  // Compute fund balances: Equity + Income - Expense per fund
  const fundEquity = new Map<string, bigint>();
  const fundIncome = new Map<string, bigint>();
  const fundExpense = new Map<string, bigint>();

  for (const fund of funds) {
    fundEquity.set(fund.id, 0n);
    fundIncome.set(fund.id, 0n);
    fundExpense.set(fund.id, 0n);
  }

  for (const entry of validEntries) {
    for (const line of entry.lines) {
      const acct = accountsMap.get(line.accountId);
      if (!acct) continue;

      const current = balances.get(acct.id) || 0n;

      if (acct.type === 'Asset') {
        // Asset net debit
        balances.set(acct.id, current + (line.debitAmountGhs - line.creditAmountGhs));
      } else if (acct.type === 'Liability') {
        // Liability net credit
        balances.set(acct.id, current + (line.creditAmountGhs - line.debitAmountGhs));
      } else if (acct.type === 'Equity') {
        // Equity net credit
        balances.set(acct.id, current + (line.creditAmountGhs - line.debitAmountGhs));
        fundEquity.set(
          line.fundId,
          (fundEquity.get(line.fundId) || 0n) + (line.creditAmountGhs - line.debitAmountGhs)
        );
      } else if (acct.type === 'Income') {
        fundIncome.set(
          line.fundId,
          (fundIncome.get(line.fundId) || 0n) + (line.creditAmountGhs - line.debitAmountGhs)
        );
      } else if (acct.type === 'Expense') {
        fundExpense.set(
          line.fundId,
          (fundExpense.get(line.fundId) || 0n) + (line.debitAmountGhs - line.creditAmountGhs)
        );
      }
    }
  }

  // Current Assets vs Non-Current Assets
  const currentAssets: ReportLineItem[] = [];
  const nonCurrentAssets: ReportLineItem[] = [];
  let totalAssetsPesewas = 0n;

  // Current Liabilities vs Non-Current Liabilities
  const currentLiabilities: ReportLineItem[] = [];
  const nonCurrentLiabilities: ReportLineItem[] = [];
  let totalLiabilitiesPesewas = 0n;

  for (const acct of accounts) {
    const bal = balances.get(acct.id) || 0n;
    if (bal === 0n && !acct.isBankOrCash) continue;

    if (acct.type === 'Asset') {
      const lineItem: ReportLineItem = {
        accountCode: acct.code,
        accountName: acct.name,
        amountPesewas: bal,
      };

      if (acct.code.startsWith('15')) {
        // Fixed assets (1510, 1520)
        nonCurrentAssets.push(lineItem);
      } else {
        // Cash, Bank, MoMo, Receivables
        currentAssets.push(lineItem);
      }
      totalAssetsPesewas += bal;
    } else if (acct.type === 'Liability') {
      const lineItem: ReportLineItem = {
        accountCode: acct.code,
        accountName: acct.name,
        amountPesewas: bal,
      };

      if (acct.code.startsWith('25')) {
        nonCurrentLiabilities.push(lineItem);
      } else {
        currentLiabilities.push(lineItem);
      }
      totalLiabilitiesPesewas += bal;
    }
  }

  // Distribute fund balances
  let unrestrictedFundBalancesPesewas = 0n;
  let restrictedFundBalancesPesewas = 0n;

  const fundBalances = funds.map((f) => {
    const eq = fundEquity.get(f.id) || 0n;
    const inc = fundIncome.get(f.id) || 0n;
    const exp = fundExpense.get(f.id) || 0n;
    const bal = eq + inc - exp;

    if (f.type === 'Unrestricted') {
      unrestrictedFundBalancesPesewas += bal;
    } else {
      restrictedFundBalancesPesewas += bal;
    }
    return {
      fundId: f.id,
      fundName: f.name,
      fundType: f.type,
      balancePesewas: bal,
    };
  });

  const totalFundBalancesPesewas = unrestrictedFundBalancesPesewas + restrictedFundBalancesPesewas;
  const totalLiabilitiesAndFundsPesewas = totalLiabilitiesPesewas + totalFundBalancesPesewas;
  const isBalanced = totalAssetsPesewas === totalLiabilitiesAndFundsPesewas;

  return {
    title: 'Statement of Financial Position (Balance Sheet)',
    churchName,
    branchName,
    asOfDate,
    currency: 'GHS',
    currentAssets,
    nonCurrentAssets,
    totalAssetsPesewas,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilitiesPesewas,
    unrestrictedFundBalancesPesewas,
    restrictedFundBalancesPesewas,
    fundBalances,
    totalFundBalancesPesewas,
    totalLiabilitiesAndFundsPesewas,
    isBalanced,
  };
}

export interface GenerateFundBalanceInput {
  readonly asOfDate: string;
  readonly entries: readonly JournalEntry[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
}

/**
 * Generates the Fund Balance Report (Restricted vs Unrestricted).
 */
export function generateFundBalanceReport(
  input: GenerateFundBalanceInput
): FundBalanceReport {
  const { asOfDate, entries, accounts, funds } = input;
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  const validEntries = entries.filter((e) => e.entryDate <= asOfDate);

  const fundStats = new Map<
    string,
    {
      opening: bigint;
      receipts: bigint;
      disbursements: bigint;
      transfers: bigint;
    }
  >();

  for (const f of funds) {
    fundStats.set(f.id, { opening: 0n, receipts: 0n, disbursements: 0n, transfers: 0n });
  }

  for (const entry of validEntries) {
    const isOpening = entry.entryType === 'OPENING_BALANCE';
    for (const line of entry.lines) {
      const stats = fundStats.get(line.fundId);
      if (!stats) continue;

      const acct = accountsMap.get(line.accountId);

      if (isOpening) {
        if (acct?.type === 'Equity') {
          stats.opening += line.creditAmountGhs - line.debitAmountGhs;
        }
      } else if (acct?.type === 'Income') {
        stats.receipts += line.creditAmountGhs - line.debitAmountGhs;
      } else if (acct?.type === 'Expense') {
        stats.disbursements += line.debitAmountGhs - line.creditAmountGhs;
      } else if (acct?.code === '2040' || acct?.code === '3010') {
        // Interfund transfers
        stats.transfers += line.creditAmountGhs - line.debitAmountGhs;
      }
    }
  }

  let totalUnrestrictedPesewas = 0n;
  let totalRestrictedPesewas = 0n;

  const fundsReport: FundBalanceItemReport[] = funds.map((f) => {
    const st = fundStats.get(f.id) || { opening: 0n, receipts: 0n, disbursements: 0n, transfers: 0n };
    // Closing = Opening + Receipts - Disbursements + Transfers
    const closing = st.opening + st.receipts - st.disbursements + st.transfers;

    if (f.type === 'Unrestricted') {
      totalUnrestrictedPesewas += closing;
    } else {
      totalRestrictedPesewas += closing;
    }

    return {
      fundId: f.id,
      fundCode: f.code,
      fundName: f.name,
      fundType: f.type,
      openingBalancePesewas: st.opening,
      receiptsPesewas: st.receipts,
      disbursementsPesewas: st.disbursements,
      interfundTransfersPesewas: st.transfers,
      closingBalancePesewas: closing,
      isOverdrawn: closing < 0n && !f.allowOverdraft,
    };
  });

  return {
    title: 'Fund Balance Report (Restricted vs Unrestricted)',
    asOfDate,
    currency: 'GHS',
    funds: fundsReport,
    totalUnrestrictedPesewas,
    totalRestrictedPesewas,
    grandTotalPesewas: totalUnrestrictedPesewas + totalRestrictedPesewas,
  };
}

/**
 * Generates a Cash Flow Summary (Direct method) for the specified period.
 */
export function generateCashFlowSummary(
  input: GenerateFinancialsInput
): CashFlowReport {
  const { periodStart, periodEnd, entries, accounts } = input;
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  const periodEntries = entries.filter(
    (e) => e.entryDate >= periodStart && e.entryDate <= periodEnd
  );

  const operatingInflowsMap = new Map<string, { code: string; name: string; amount: bigint }>();
  const operatingOutflowsMap = new Map<string, { code: string; name: string; amount: bigint }>();
  const investingOutflowsMap = new Map<string, { code: string; name: string; amount: bigint }>();
  const financingInflowsMap = new Map<string, { code: string; name: string; amount: bigint }>();

  let totalOperatingInflowsPesewas = 0n;
  let totalOperatingOutflowsPesewas = 0n;
  let netCashFromInvestingPesewas = 0n;
  let netCashFromFinancingPesewas = 0n;

  // Track cash accounts (1010, 1020, 1030, 1040, 1050)
  for (const entry of periodEntries) {
    const hasCashMovement = entry.lines.some((l) => {
      const a = accountsMap.get(l.accountId);
      return a?.isBankOrCash;
    });

    if (!hasCashMovement) continue;

    for (const line of entry.lines) {
      const acct = accountsMap.get(line.accountId);
      if (!acct || acct.isBankOrCash) continue;

      if (acct.type === 'Income') {
        const amt = line.creditAmountGhs - line.debitAmountGhs;
        const cur = operatingInflowsMap.get(acct.code) || { code: acct.code, name: acct.name, amount: 0n };
        cur.amount += amt;
        operatingInflowsMap.set(acct.code, cur);
        totalOperatingInflowsPesewas += amt;
      } else if (acct.type === 'Expense') {
        const amt = line.debitAmountGhs - line.creditAmountGhs;
        const cur = operatingOutflowsMap.get(acct.code) || { code: acct.code, name: acct.name, amount: 0n };
        cur.amount += amt;
        operatingOutflowsMap.set(acct.code, cur);
        totalOperatingOutflowsPesewas += amt;
      } else if (acct.code.startsWith('15')) {
        // Fixed asset purchase (Investing)
        const amt = line.debitAmountGhs - line.creditAmountGhs;
        const cur = investingOutflowsMap.get(acct.code) || { code: acct.code, name: acct.name, amount: 0n };
        cur.amount += amt;
        investingOutflowsMap.set(acct.code, cur);
        netCashFromInvestingPesewas -= amt;
      } else if (acct.type === 'Equity' || acct.code === '3010') {
        // Capital / Financing
        const amt = line.creditAmountGhs - line.debitAmountGhs;
        const cur = financingInflowsMap.get(acct.code) || { code: acct.code, name: acct.name, amount: 0n };
        cur.amount += amt;
        financingInflowsMap.set(acct.code, cur);
        netCashFromFinancingPesewas += amt;
      }
    }
  }

  const operatingInflows: ReportLineItem[] = Array.from(operatingInflowsMap.values())
    .map((x) => ({ accountCode: x.code, accountName: x.name, amountPesewas: x.amount }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const operatingOutflows: ReportLineItem[] = Array.from(operatingOutflowsMap.values())
    .map((x) => ({ accountCode: x.code, accountName: x.name, amountPesewas: x.amount }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const investingOutflows: ReportLineItem[] = Array.from(investingOutflowsMap.values())
    .map((x) => ({ accountCode: x.code, accountName: x.name, amountPesewas: x.amount }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const financingInflows: ReportLineItem[] = Array.from(financingInflowsMap.values())
    .map((x) => ({ accountCode: x.code, accountName: x.name, amountPesewas: x.amount }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Calculate opening and closing cash & bank
  let openingCashAndBankPesewas = 0n;
  let closingCashAndBankPesewas = 0n;

  for (const entry of entries) {
    for (const line of entry.lines) {
      const acct = accountsMap.get(line.accountId);
      if (!acct?.isBankOrCash) continue;

      const netCashChange = line.debitAmountGhs - line.creditAmountGhs;

      if (entry.entryDate < periodStart) {
        openingCashAndBankPesewas += netCashChange;
      }
      if (entry.entryDate <= periodEnd) {
        closingCashAndBankPesewas += netCashChange;
      }
    }
  }

  const netCashFromOperationsPesewas = totalOperatingInflowsPesewas - totalOperatingOutflowsPesewas;
  const netChangeInCashPesewas =
    netCashFromOperationsPesewas + netCashFromInvestingPesewas + netCashFromFinancingPesewas;

  return {
    title: 'Statement of Cash Flows (Direct Method)',
    periodStart,
    periodEnd,
    currency: 'GHS',
    operatingInflows,
    totalOperatingInflowsPesewas,
    operatingOutflows,
    totalOperatingOutflowsPesewas,
    netCashFromOperationsPesewas,
    investingOutflows,
    netCashFromInvestingPesewas,
    financingInflows,
    netCashFromFinancingPesewas,
    netChangeInCashPesewas,
    openingCashAndBankPesewas,
    closingCashAndBankPesewas,
  };
}
