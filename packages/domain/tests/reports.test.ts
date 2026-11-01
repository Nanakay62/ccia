import { describe, it, expect } from 'vitest';
import type { Account, Fund, JournalEntry } from '../src/ledger/types.js';
import {
  generateIncomeExpenditureStatement,
  generateBalanceSheet,
  generateFundBalanceReport,
  generateCashFlowSummary,
  generateBudgetVsActualReport,
  generateGivingSummaryReport,
  generatePledgeStatusReport,
  generateBankReconciliationReport,
  generateAuditLogReport,
  generateDenominationUsdSummaryReport,
  convertGhsPesewasToUsdCents,
} from '../src/reports/index.js';

const mockAccounts: Account[] = [
  { id: 'acct-1010', branchId: 'b-01', code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: 'b-01', code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1050', branchId: 'b-01', code: '1050', name: 'Mobile Money (MoMo)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1510', branchId: 'b-01', code: '1510', name: 'Equipment & Fixtures', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2010', branchId: 'b-01', code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2030', branchId: 'b-01', code: '2030', name: 'Withholding Tax Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3010', branchId: 'b-01', code: '3010', name: 'General Fund Equity', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4010', branchId: 'b-01', code: '4010', name: 'Tithes', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4020', branchId: 'b-01', code: '4020', name: 'General Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4040', branchId: 'b-01', code: '4040', name: 'Building Pledges', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5020', branchId: 'b-01', code: '5020', name: 'Utilities', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5030', branchId: 'b-01', code: '5030', name: 'Maintenance', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
];

const mockFunds: Fund[] = [
  { id: 'fund-001', branchId: 'b-01', code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: false, isActive: true },
  { id: 'fund-002', branchId: 'b-01', code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-003', branchId: 'b-01', code: 'WEL', name: 'Welfare / Benevolence', type: 'Restricted', allowOverdraft: false, isActive: true },
];

const mockEntries: JournalEntry[] = [
  // Opening balance: GHS 50,000 in bank for General Fund
  {
    id: 'entry-001',
    branchId: 'b-01',
    documentNumber: 'OB-0001',
    entryDate: '2026-01-01',
    entryType: 'OPENING_BALANCE',
    narration: 'Opening balance 2026',
    lineCount: 2,
    totalDebitGhs: 5000000n,
    totalCreditGhs: 5000000n,
    isReversal: false,
    createdBy: 'usr-001',
    deviceId: 'DEV-01',
    createdAt: '2026-01-01T08:00:00Z',
    lines: [
      {
        id: 'line-1',
        journalEntryId: 'entry-001',
        accountId: 'acct-1030',
        fundId: 'fund-001',
        lineNumber: 1,
        originalCurrency: 'GHS',
        originalAmount: 5000000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 5000000n,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-2',
        journalEntryId: 'entry-001',
        accountId: 'acct-3010',
        fundId: 'fund-001',
        lineNumber: 2,
        originalCurrency: 'GHS',
        originalAmount: 5000000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: 5000000n,
        roundingDifferencePesewas: 0n,
      },
    ],
  },
  // Sunday Giving: Tithes GHS 10,000 (General) + Building Offering GHS 5,000 (Building)
  {
    id: 'entry-002',
    branchId: 'b-01',
    documentNumber: 'CS-0001',
    entryDate: '2026-01-15',
    entryType: 'COUNTING_SHEET',
    narration: 'Sunday Service Giving',
    lineCount: 4,
    totalDebitGhs: 1500000n,
    totalCreditGhs: 1500000n,
    isReversal: false,
    createdBy: 'usr-001',
    deviceId: 'DEV-01',
    createdAt: '2026-01-15T14:00:00Z',
    lines: [
      {
        id: 'line-3',
        journalEntryId: 'entry-002',
        accountId: 'acct-1030', // Bank
        fundId: 'fund-001',
        lineNumber: 1,
        originalCurrency: 'GHS',
        originalAmount: 1000000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 1000000n,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-4',
        journalEntryId: 'entry-002',
        accountId: 'acct-4010', // Tithes
        fundId: 'fund-001',
        lineNumber: 2,
        originalCurrency: 'GHS',
        originalAmount: 1000000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: 1000000n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-5',
        journalEntryId: 'entry-002',
        accountId: 'acct-1030', // Bank
        fundId: 'fund-002',
        lineNumber: 3,
        originalCurrency: 'GHS',
        originalAmount: 500000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 500000n,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-6',
        journalEntryId: 'entry-002',
        accountId: 'acct-4040', // Building Pledges
        fundId: 'fund-002',
        lineNumber: 4,
        originalCurrency: 'GHS',
        originalAmount: 500000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: 500000n,
        roundingDifferencePesewas: 0n,
      },
    ],
  },
  // Expense Voucher: Maintenance GHS 2,000 with 5% WHT (GHS 100) -> Net GHS 1,900 from Bank
  {
    id: 'entry-003',
    branchId: 'b-01',
    documentNumber: 'PV-0001',
    entryDate: '2026-01-20',
    entryType: 'VOUCHER',
    narration: 'Generator maintenance',
    lineCount: 3,
    totalDebitGhs: 200000n,
    totalCreditGhs: 200000n,
    isReversal: false,
    createdBy: 'usr-001',
    deviceId: 'DEV-01',
    createdAt: '2026-01-20T10:00:00Z',
    lines: [
      {
        id: 'line-7',
        journalEntryId: 'entry-003',
        accountId: 'acct-5030', // Maintenance
        fundId: 'fund-001',
        lineNumber: 1,
        originalCurrency: 'GHS',
        originalAmount: 200000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 200000n,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-8',
        journalEntryId: 'entry-003',
        accountId: 'acct-1030', // Bank Net
        fundId: 'fund-001',
        lineNumber: 2,
        originalCurrency: 'GHS',
        originalAmount: 190000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: 190000n,
        roundingDifferencePesewas: 0n,
      },
      {
        id: 'line-9',
        journalEntryId: 'entry-003',
        accountId: 'acct-2030', // WHT Payable
        fundId: 'fund-001',
        lineNumber: 3,
        originalCurrency: 'GHS',
        originalAmount: 10000n,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: 10000n,
        roundingDifferencePesewas: 0n,
      },
    ],
  },
];

describe('Phase 6: Financial Reports Generators', () => {
  it('generates Income & Expenditure Statement with net surplus and fund breakdown', () => {
    const report = generateIncomeExpenditureStatement({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    // Tithes GHS 10,000 + Building Pledges GHS 5,000 = GHS 15,000 (1,500,000 pesewas)
    expect(report.totalIncomePesewas).toBe(1500000n);
    // Maintenance GHS 2,000 (200,000 pesewas)
    expect(report.totalExpensePesewas).toBe(200000n);
    // Net Surplus = 15,000 - 2,000 = 13,000 (1,300,000 pesewas)
    expect(report.netSurplusDeficitPesewas).toBe(1300000n);

    // General fund net: 10,000 income - 2,000 expense = 8,000
    const genFund = report.fundBreakdown.find((f) => f.fundName === 'General Fund')!;
    expect(genFund.incomePesewas).toBe(1000000n);
    expect(genFund.expensePesewas).toBe(200000n);
    expect(genFund.netPesewas).toBe(800000n);

    // Building fund net: 5,000 income - 0 expense = 5,000
    const bldFund = report.fundBreakdown.find((f) => f.fundName === 'Building Fund')!;
    expect(bldFund.incomePesewas).toBe(500000n);
    expect(bldFund.netPesewas).toBe(500000n);
  });

  it('generates Balance Sheet with Assets = Liabilities + Fund Balances', () => {
    const report = generateBalanceSheet({
      asOfDate: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    // Bank Account: 50,000 (opening) + 10,000 + 5,000 - 1,900 = 63,100 GHS (6,310,000 pesewas)
    expect(report.totalAssetsPesewas).toBe(6310000n);
    // Liability: WHT Payable = GHS 100 (10,000 pesewas)
    expect(report.totalLiabilitiesPesewas).toBe(10000n);

    // Net Assets / Fund Balances: 6,310,000 - 10,000 = 6,300,000 pesewas (GHS 63,000)
    expect(report.totalFundBalancesPesewas).toBe(6300000n);
    // General Fund: 50,000 opening + 8,000 net = 58,000 (5,800,000)
    expect(report.unrestrictedFundBalancesPesewas).toBe(5800000n);
    // Building Fund: 5,000 (500,000)
    expect(report.restrictedFundBalancesPesewas).toBe(500000n);

    // Verification of double-entry equality
    expect(report.isBalanced).toBe(true);
    expect(report.totalAssetsPesewas).toBe(report.totalLiabilitiesAndFundsPesewas);
  });

  it('generates Fund Balance Report verifying restricted and unrestricted separation', () => {
    const report = generateFundBalanceReport({
      asOfDate: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    expect(report.totalUnrestrictedPesewas).toBe(5800000n);
    expect(report.totalRestrictedPesewas).toBe(500000n);
    expect(report.grandTotalPesewas).toBe(6300000n);

    const bld = report.funds.find((f) => f.fundCode === 'BLD')!;
    expect(bld.receiptsPesewas).toBe(500000n);
    expect(bld.isOverdrawn).toBe(false);
  });

  it('generates Cash Flow Summary using Direct Method', () => {
    const report = generateCashFlowSummary({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    expect(report.totalOperatingInflowsPesewas).toBe(1500000n); // Tithes 10k + Building 5k
    expect(report.totalOperatingOutflowsPesewas).toBe(200000n); // Maintenance gross
    expect(report.openingCashAndBankPesewas).toBe(0n);
    expect(report.closingCashAndBankPesewas).toBe(6310000n);
  });
});

describe('Phase 6: Operational Reports', () => {
  it('generates Budget vs Actual Report with variance and status', () => {
    const report = generateBudgetVsActualReport({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      budgets: [
        { accountCode: '4010', accountName: 'Tithes', category: 'INCOME', annualBudgetPesewas: 1200000n }, // 12k budget vs 10k actual
        { accountCode: '5030', accountName: 'Maintenance', category: 'EXPENSE', annualBudgetPesewas: 300000n }, // 3k budget vs 2k actual
      ],
      entries: mockEntries,
      accounts: mockAccounts,
    });

    const tithes = report.items.find((i) => i.accountCode === '4010')!;
    expect(tithes.actualPesewas).toBe(1000000n);
    expect(tithes.variancePesewas).toBe(-200000n); // Under budget
    expect(tithes.isFavourable).toBe(false);

    const maint = report.items.find((i) => i.accountCode === '5030')!;
    expect(maint.actualPesewas).toBe(200000n);
    expect(maint.variancePesewas).toBe(100000n); // Spent less than budgeted
    expect(maint.isFavourable).toBe(true);
  });

  it('generates Bank Reconciliation Report verifying reconciled status', () => {
    const report = generateBankReconciliationReport({
      bankAccount: mockAccounts.find((a) => a.code === '1030')!,
      asOfDate: '2026-01-31',
      entries: mockEntries,
      // Statement has 65,000, but 1,900 cheque is outstanding
      bankStatementBalancePesewas: 6500000n,
      outstandingCheques: [{ reference: 'CHQ-1002', payee: 'Maintenance Ltd', amountPesewas: 190000n }],
      depositsInTransit: [],
    });

    // Book balance is 63,100 GHS (6,310,000 pesewas)
    expect(report.bookBalancePesewas).toBe(6310000n);
    // Adjusted bank balance = 6,500,000 - 190,000 = 6,310,000
    expect(report.adjustedBookBalancePesewas).toBe(6310000n);
    expect(report.isReconciled).toBe(true);
  });
});

describe('Phase 6: Denomination USD Summary Report', () => {
  it('converts GHS minor pesewas to USD minor cents with Banker Rounding', () => {
    // 15.5000 GHS per USD
    // GHS 155.00 (15500 pesewas) / 15.5 = $10.00 (1000 cents)
    const usd1 = convertGhsPesewasToUsdCents(15500n, '15.5000');
    expect(usd1).toBe(1000n);

    // GHS 31.00 / 15.5 = $2.00 (200 cents)
    const usd2 = convertGhsPesewasToUsdCents(3100n, '15.5000');
    expect(usd2).toBe(200n);
  });

  it('generates full Denomination USD Summary Report with disclosure footnote', () => {
    const incExp = generateIncomeExpenditureStatement({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    const balSheet = generateBalanceSheet({
      asOfDate: '2026-01-31',
      entries: mockEntries,
      accounts: mockAccounts,
      funds: mockFunds,
    });

    const usdReport = generateDenominationUsdSummaryReport({
      asOfDate: '2026-01-31',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      exchangeRate: '15.5000',
      rateBasis: 'CLOSING_RATE',
      incomeExpenditure: incExp,
      balanceSheet: balSheet,
    });

    expect(usdReport.exchangeRate).toBe('15.5000');
    expect(usdReport.rateBasis).toBe('CLOSING_RATE');

    // Total income: 1,500,000 pesewas / 15.5 = 96,774 cents ($967.74)
    expect(usdReport.statementOfActivities.totalIncomeUsdCents).toBe(96774n);

    // Total expense: 200,000 pesewas / 15.5 = 12,903 cents ($129.03)
    expect(usdReport.statementOfActivities.totalExpenseUsdCents).toBe(12903n);

    // Footnote contains rate and basis disclosure
    expect(usdReport.mandatoryDisclosureFootnote).toContain('1 USD = 15.5000 GHS');
    expect(usdReport.mandatoryDisclosureFootnote).toContain('Month-End Closing Rate');
    expect(usdReport.mandatoryDisclosureFootnote).toContain('denominational reporting purposes only');
  });
});
