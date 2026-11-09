import { describe, it, expect } from 'vitest';
import {
  canChangeFiscalYearStartMonth,
  generateFinancialYearWithPeriods,
  canPostToPeriod,
  transitionPeriodStatus,
  calculateYearOverYearComparatives,
  generateOpeningBalanceCsvTemplate,
  parseOpeningBalanceCsv,
  validateOpeningBalances,
  runOpeningBalanceDryRun,
  commitOpeningBalances,
  type Account,
  type Fund,
} from '../index.js';

const TEST_BRANCH_ID = '00000000-0000-0000-0000-000000000001';

const TEST_ACCOUNTS: Account[] = [
  { id: 'acct-1010', branchId: TEST_BRANCH_ID, code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1020', branchId: TEST_BRANCH_ID, code: '1020', name: 'Cash on Hand (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: TEST_BRANCH_ID, code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1050', branchId: TEST_BRANCH_ID, code: '1050', name: 'Mobile Money (MoMo) Wallet', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1510', branchId: TEST_BRANCH_ID, code: '1510', name: 'Sound & Musical Equipment (Cost)', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1519', branchId: TEST_BRANCH_ID, code: '1519', name: 'Accumulated Depreciation - Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2010', branchId: TEST_BRANCH_ID, code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3010', branchId: TEST_BRANCH_ID, code: '3010', name: 'General Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3020', branchId: TEST_BRANCH_ID, code: '3020', name: 'Restricted Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4010', branchId: TEST_BRANCH_ID, code: '4010', name: 'Tithes & Offerings Income', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
];

const TEST_FUNDS: Fund[] = [
  { id: 'fund-gen', branchId: TEST_BRANCH_ID, code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
  { id: 'fund-bld', branchId: TEST_BRANCH_ID, code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-mis', branchId: TEST_BRANCH_ID, code: 'MIS', name: 'Missions & Outreach Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
];

describe('Phase 1 — Financial Years & Periods (Spec A1)', () => {
  it('allows changing financial year start month only before the first posting', () => {
    expect(canChangeFiscalYearStartMonth(0).allowed).toBe(true);
    const afterFirstPosting = canChangeFiscalYearStartMonth(1);
    expect(afterFirstPosting.allowed).toBe(false);
    expect(afterFirstPosting.reason).toContain('cannot be changed after the first journal entry');
  });

  it('generates 12 monthly periods plus Period 13 (adjustment period) when enabled', () => {
    const { financialYear, periods } = generateFinancialYearWithPeriods({
      id: 'fy-2026',
      branchId: TEST_BRANCH_ID,
      label: 'FY2026',
      startYear: 2026,
      startMonth: 1,
      hasAdjustmentPeriod: true,
      initialClosedMonthsCount: 9,
    });

    expect(financialYear.label).toBe('FY2026');
    expect(financialYear.startDate).toBe('2026-01-01');
    expect(financialYear.endDate).toBe('2026-12-31');
    expect(periods).toHaveLength(13);

    const period1 = periods[0]!;
    expect(period1.month).toBe(1);
    expect(period1.status).toBe('CLOSED');
    expect(period1.isClosed).toBe(true);

    const period10 = periods[9]!;
    expect(period10.month).toBe(10);
    expect(period10.status).toBe('OPEN');
    expect(period10.isClosed).toBe(false);

    const period13 = periods[12]!;
    expect(period13.month).toBe(13);
    expect(period13.isAdjustmentPeriod).toBe(true);
    expect(period13.startDate).toBe('2026-12-31');
    expect(period13.endDate).toBe('2026-12-31');
  });

  it('enforces OPEN, SOFT_CLOSED (Treasurer only), CLOSED, and LOCKED year rules', () => {
    const { financialYear, periods } = generateFinancialYearWithPeriods({
      id: 'fy-2026',
      branchId: TEST_BRANCH_ID,
      label: 'FY2026',
      startYear: 2026,
      startMonth: 1,
      hasAdjustmentPeriod: true,
    });

    const octPeriod = periods[9]!;
    // Open period allows Finance Secretary and Treasurer
    expect(canPostToPeriod({ period: octPeriod, financialYear, userRole: 'Finance Secretary' }).allowed).toBe(true);

    // Transition to SOFT_CLOSED
    const softClosedOct = transitionPeriodStatus({
      period: octPeriod,
      nextStatus: 'SOFT_CLOSED',
      actorName: 'Kofi Mensah',
      actorRole: 'Treasurer',
    });
    expect(softClosedOct.status).toBe('SOFT_CLOSED');
    expect(canPostToPeriod({ period: softClosedOct, financialYear, userRole: 'Finance Secretary' }).allowed).toBe(false);
    expect(canPostToPeriod({ period: softClosedOct, financialYear, userRole: 'Treasurer' }).allowed).toBe(true);

    // Transition to CLOSED
    const closedOct = transitionPeriodStatus({
      period: softClosedOct,
      nextStatus: 'CLOSED',
      actorName: 'Kofi Mensah',
      actorRole: 'Treasurer',
    });
    expect(canPostToPeriod({ period: closedOct, financialYear, userRole: 'Treasurer' }).allowed).toBe(false);

    // Locked year blocks even open periods and routes offline sync to Needs Attention
    const lockedFy = { ...financialYear, status: 'LOCKED' as const };
    const lockedCheck = canPostToPeriod({
      period: octPeriod,
      financialYear: lockedFy,
      userRole: 'Treasurer',
      isOfflineSync: true,
    });
    expect(lockedCheck.allowed).toBe(false);
    expect(lockedCheck.routeOfflineToNeedsAttention).toBe(true);

    // Reopened year allows ONLY Period 13
    const reopenedFy = { ...financialYear, status: 'REOPENED_ADJUSTMENT_ONLY' as const };
    expect(canPostToPeriod({ period: octPeriod, financialYear: reopenedFy, userRole: 'Treasurer' }).allowed).toBe(false);
    expect(canPostToPeriod({ period: periods[12]!, financialYear: reopenedFy, userRole: 'Treasurer' }).allowed).toBe(true);
  });
});

describe('Phase 1 — Opening Balances Validation, Dry Run & Commit (Spec B2)', () => {
  it('validates template rows, creates one balanced opening entry per fund on dry run, and commits with dual approval', () => {
    const csv = generateOpeningBalanceCsvTemplate('2026-01-01');
    const rows = parseOpeningBalanceCsv(csv);
    expect(rows.length).toBe(9);

    const dryRun = runOpeningBalanceDryRun({
      rows,
      cutOverDate: '2026-01-01',
      branchId: TEST_BRANCH_ID,
      financialYearId: 'fy-2026',
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
      createdBy: 'Kofi Mensah (Treasurer)',
      deviceId: 'DEV-TR-01',
      proofs: {
        statementAndCashProofs: [
          {
            accountCode: '1010',
            statementOrCountBalanceGhs: 450000n,
            statementDate: '2026-01-01',
            reference: 'Safe Cash Count #CC-01',
          },
          {
            accountCode: '1030',
            statementOrCountBalanceGhs: 7050000n, // 28,500 GEN + 42,000 BLD
            statementDate: '2026-01-01',
            reference: 'GCB Statement #104',
          },
          {
            accountCode: '1050',
            statementOrCountBalanceGhs: 620000n,
            statementDate: '2026-01-01',
            reference: 'MTN MoMo Statement',
          },
        ],
        payablesScheduleTotalGhs: 120000n,
      },
    });

    expect(dryRun.validation.isValid).toBe(true);
    expect(dryRun.validation.isOverallBalanced).toBe(true);
    expect(dryRun.validation.allFundsBalanced).toBe(true);
    expect(dryRun.validation.allStatementsAgree).toBe(true);
    expect(dryRun.proposedEntriesByFund).toHaveLength(3); // GEN, BLD, MIS -> one balanced entry per fund
    expect(dryRun.proposedEntriesByFund.every((e) => e.entryType === 'OPENING_BALANCE')).toBe(true);
    expect(dryRun.resultingTrialBalance.isBalanced).toBe(true);

    // Separation of duties on commit: Treasurer and Pastor/Elder must be distinct
    expect(() =>
      commitOpeningBalances({
        dryRun,
        treasurerSignedBy: 'Kofi Mensah',
        pastorOrElderApprovedBy: 'Kofi Mensah',
      })
    ).toThrow(/Separation of duties/);

    const committed = commitOpeningBalances({
      dryRun,
      treasurerSignedBy: 'Kofi Mensah (Treasurer)',
      pastorOrElderApprovedBy: 'Rev. Emmanuel Addo (Senior Pastor)',
    });
    expect(committed).toHaveLength(3);
  });

  it('flags fund-level imbalances without auto-plugging, rejects USD on non-bank/cash accounts, and flags statement variances', () => {
    const unbalancedRows = [
      {
        rowNumber: 1,
        accountCode: '1010',
        fundCode: 'GEN',
        currency: 'GHS' as const,
        debitOriginalMinor: 500000n, // GHS 5,000
        creditOriginalMinor: 0n,
        exchangeRate: '1.0000',
        rateDate: '2026-01-01',
      },
      {
        rowNumber: 2,
        accountCode: '3010',
        fundCode: 'GEN',
        currency: 'GHS' as const,
        debitOriginalMinor: 0n,
        creditOriginalMinor: 400000n, // GHS 4,000 -> off by GHS 1,000 in GEN!
        exchangeRate: '1.0000',
        rateDate: '2026-01-01',
      },
      {
        rowNumber: 3,
        accountCode: '1510', // Fixed asset -> cannot be USD!
        fundCode: 'BLD',
        currency: 'USD' as const,
        debitOriginalMinor: 10000n,
        creditOriginalMinor: 0n,
        exchangeRate: '', // Missing rate!
        rateDate: null,
      },
    ];

    const report = validateOpeningBalances({
      rows: unbalancedRows,
      cutOverDate: '2026-01-01',
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
      proofs: {
        statementAndCashProofs: [
          {
            accountCode: '1010',
            statementOrCountBalanceGhs: 450000n, // Statement says 4,500, ledger says 5,000
            statementDate: '2026-01-01',
            reference: 'Cash Count #1',
          },
        ],
      },
    });

    expect(report.isValid).toBe(false);
    expect(report.allFundsBalanced).toBe(false);
    expect(report.allStatementsAgree).toBe(false);

    const genSummary = report.fundSummaries.find((f) => f.fundCode === 'GEN');
    expect(genSummary?.isBalanced).toBe(false);
    expect(genSummary?.differenceGhs).toBe(100000n); // GHS 1,000.00 difference shown explicitly

    const messages = report.rowDiagnostics.map((d) => d.message).join(' | ');
    expect(messages).toContain('Only cash and bank accounts carry USD balances');
    expect(messages).toContain('requires a valid USD-to-GHS exchange rate');
    expect(messages).toContain('differs from statement/cash count');
  });

  it('computes year-over-year comparative balances for financial statements', () => {
    const csv = generateOpeningBalanceCsvTemplate('2026-01-01');
    const rows = parseOpeningBalanceCsv(csv);
    const dryRun = runOpeningBalanceDryRun({
      rows,
      cutOverDate: '2026-01-01',
      branchId: TEST_BRANCH_ID,
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
    });

    const comparatives = calculateYearOverYearComparatives({
      currentYearEntries: dryRun.proposedEntriesByFund,
      priorYearEntries: [],
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
    });

    const cashRow = comparatives.find((c) => c.accountCode === '1010');
    expect(cashRow?.currentYearGhs).toBe(450000n);
    expect(cashRow?.priorYearGhs).toBe(0n);
    expect(cashRow?.varianceGhs).toBe(450000n);
  });
});
