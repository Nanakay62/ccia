import { describe, it, expect } from 'vitest';
import {
  generateParallelRunCsvTemplate,
  parseParallelRunCsv,
  compareParallelRunMonth,
  buildParallelRunSummaryLine,
  evaluateParallelRunOverall,
  signOffParallelRunMonth,
  createJournalEntry,
  type Account,
  type Fund,
  type JournalEntry,
  type OldBookBalanceInput,
} from '../index.js';

const TEST_ACCOUNTS: Account[] = [
  { id: 'acct-1010', branchId: 'b1', code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: 'b1', code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-4010', branchId: 'b1', code: '4010', name: 'Tithes', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5020', branchId: 'b1', code: '5020', name: 'Utilities', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
];

const TEST_FUNDS: Fund[] = [
  { id: 'fund-gen', branchId: 'b1', code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
  { id: 'fund-bld', branchId: 'b1', code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
];

const TEST_ENTRIES: JournalEntry[] = [
  createJournalEntry({
    id: 'je-1',
    branchId: 'b1',
    documentNumber: 'JE-001',
    entryDate: '2026-10-10',
    narration: 'Tithes collected',
    createdBy: 'Kofi Mensah',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 'l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 500000n, exchangeRate: '1.0000', isDebit: true },
      { id: 'l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 500000n, exchangeRate: '1.0000', isDebit: false },
    ],
  }),
  createJournalEntry({
    id: 'je-2',
    branchId: 'b1',
    documentNumber: 'JE-002',
    entryDate: '2026-10-15',
    narration: 'Water and electricity paid',
    createdBy: 'Kofi Mensah',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 'l3', accountId: 'acct-5020', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 120000n, exchangeRate: '1.0000', isDebit: true },
      { id: 'l4', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 120000n, exchangeRate: '1.0000', isDebit: false },
    ],
  }),
];

describe('Phase 3: Parallel Run & Comparison (Spec Section B4)', () => {
  it('generates and parses parallel run CSV template', () => {
    const tpl = generateParallelRunCsvTemplate(TEST_ACCOUNTS, TEST_FUNDS);
    expect(tpl).toContain('account_code,fund_code,account_name,old_book_balance_ghs,explanation');
    expect(tpl).toContain('1010,GEN,"Cash on Hand (GHS)",0.00,');

    const sampleCsv = [
      'account_code,fund_code,account_name,old_book_balance_ghs,explanation',
      '1010,GEN,"Cash on Hand",3800.00,',
      '4010,GEN,"Tithes",5000.00,',
      '5020,GEN,"Utilities",1200.00,',
    ].join('\n');

    const parsed = parseParallelRunCsv(sampleCsv);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]!.accountCode).toBe('1010');
    expect(parsed[0]!.oldBookBalanceGhs).toBe(380000n);
  });

  it('classifies accounts as AGREES when old books match system ledger exactly', () => {
    // In TEST_ENTRIES:
    // 1010 (Cash on Hand) Dr = 5,000.00 - 1,200.00 = 3,800.00 (380,000p)
    // 4010 (Tithes) Cr = 5,000.00 (500,000p)
    // 5020 (Utilities) Dr = 1,200.00 (120,000p)
    const oldBookRows: OldBookBalanceInput[] = [
      { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 380000n },
      { accountCode: '4010', fundCode: 'GEN', oldBookBalanceGhs: 500000n },
      { accountCode: '5020', fundCode: 'GEN', oldBookBalanceGhs: 120000n },
    ];

    const result = compareParallelRunMonth({
      periodId: 'per-2026-10',
      periodLabel: 'October',
      asOfDate: '2026-10-31',
      oldBookRows,
      entries: TEST_ENTRIES,
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
    });

    expect(result.summary.agreesCount).toBe(3);
    expect(result.summary.unexplainedCount).toBe(0);
    expect(result.summary.explainedCount).toBe(0);
    expect(result.summary.canApprove).toBe(true);
    expect(result.summary.statusSummary).toBe('October agrees');
  });

  it('classifies variances with written explanations as EXPLAINED and without as UNEXPLAINED', () => {
    const oldBookRows: OldBookBalanceInput[] = [
      { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 400000n, explanation: 'Unpresented cheque #1024 not yet cleared in old books' },
      { accountCode: '4010', fundCode: 'GEN', oldBookBalanceGhs: 480000n }, // Variance 20,000p with NO explanation -> UNEXPLAINED
      { accountCode: '5020', fundCode: 'GEN', oldBookBalanceGhs: 120000n }, // Agrees
    ];

    const result = compareParallelRunMonth({
      periodId: 'per-2026-11',
      periodLabel: 'November',
      asOfDate: '2026-11-30',
      oldBookRows,
      entries: TEST_ENTRIES,
      accounts: TEST_ACCOUNTS,
      funds: TEST_FUNDS,
    });

    expect(result.summary.agreesCount).toBe(1);
    expect(result.summary.explainedCount).toBe(1);
    expect(result.summary.unexplainedCount).toBe(1);
    expect(result.summary.canApprove).toBe(false);
    expect(result.summary.statusSummary).toBe('November 1 unexplained difference');

    // Blocking Chief Accountant sign-off until unexplained is explained
    expect(() =>
      signOffParallelRunMonth({
        summary: result.summary,
        treasurerName: 'Kofi Mensah',
        actorRole: 'Treasurer',
      })
    ).toThrow(/unexplained difference/i);
  });

  it('formats the spec-required summary line and signs off when all differences are explained', () => {
    const octSummary = {
      periodId: 'per-2026-10',
      periodLabel: 'October',
      asOfDate: '2026-10-31',
      totalAccountsCompared: 3,
      agreesCount: 3,
      explainedCount: 0,
      unexplainedCount: 0,
      totalOldBooksGhs: 1000000n,
      totalSystemGhs: 1000000n,
      netVarianceGhs: 0n,
      isApproved: true,
      approvedByTreasurer: 'Kofi Mensah (Treasurer)',
      approvedAt: '2026-11-01T10:00:00Z',
      canApprove: true,
      statusSummary: 'October agrees',
    };

    const novSummary = {
      periodId: 'per-2026-11',
      periodLabel: 'November',
      asOfDate: '2026-11-30',
      totalAccountsCompared: 5,
      agreesCount: 3,
      explainedCount: 0,
      unexplainedCount: 2,
      totalOldBooksGhs: 1500000n,
      totalSystemGhs: 1450000n,
      netVarianceGhs: 50000n,
      isApproved: false,
      canApprove: false,
      statusSummary: 'November 2 unexplained differences',
    };

    // Exactly matching Spec Section B4 summary line:
    // "Parallel run: October agrees, November 2 unexplained differences"
    const summaryLine = buildParallelRunSummaryLine([octSummary, novSummary]);
    expect(summaryLine).toBe('Parallel run: October agrees, November 2 unexplained differences');

    const overall = evaluateParallelRunOverall({
      months: [octSummary, novSummary],
      requiredMonthEnds: 2,
    });
    expect(overall.isParallelRunComplete).toBe(false);
    expect(overall.approvedMonthEndsCount).toBe(1);

    // Now resolve the 2 differences with explanations
    const resolvedNovSummary = {
      ...novSummary,
      explainedCount: 2,
      unexplainedCount: 0,
      canApprove: true,
      statusSummary: 'November agrees (2 explained)',
    };

    const signedNov = signOffParallelRunMonth({
      summary: resolvedNovSummary,
      treasurerName: 'Kofi Mensah',
      actorRole: 'Treasurer',
    });
    expect(signedNov.isApproved).toBe(true);

    const overallApproved = evaluateParallelRunOverall({
      months: [octSummary, signedNov],
      requiredMonthEnds: 2,
    });
    expect(overallApproved.isParallelRunComplete).toBe(true);
    expect(overallApproved.approvedMonthEndsCount).toBe(2);
  });
});
