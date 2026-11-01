import { describe, it, expect } from 'vitest';
import {
  createJournalEntry,
  validateJournalEntry,
  calculateTrialBalance,
  calculateRevaluation,
  type Account,
  type Fund,
  type AccountingPeriod,
} from '../src/index.js';

describe('Core Ledger Domain Module', () => {
  const sampleBranchId = '00000000-0000-0000-0000-000000000001';

  const accounts: Account[] = [
    {
      id: 'acct-1010',
      branchId: sampleBranchId,
      code: '1010',
      name: 'Cash on Hand (GHS)',
      type: 'Asset',
      currency: 'GHS',
      isBankOrCash: true,
      isActive: true,
    },
    {
      id: 'acct-1020',
      branchId: sampleBranchId,
      code: '1020',
      name: 'Cash on Hand (USD)',
      type: 'Asset',
      currency: 'USD',
      isBankOrCash: true,
      isActive: true,
    },
    {
      id: 'acct-4010',
      branchId: sampleBranchId,
      code: '4010',
      name: 'Tithes',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acct-5020',
      branchId: sampleBranchId,
      code: '5020',
      name: 'Utilities',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acct-5990',
      branchId: sampleBranchId,
      code: '5990',
      name: 'Rounding Differences',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
  ];

  const funds: Fund[] = [
    {
      id: 'fund-gen',
      branchId: sampleBranchId,
      code: 'GEN',
      name: 'General Fund',
      type: 'Unrestricted',
      allowOverdraft: true,
      isActive: true,
    },
    {
      id: 'fund-bld',
      branchId: sampleBranchId,
      code: 'BLD',
      name: 'Building Fund',
      type: 'Restricted',
      allowOverdraft: false,
      isActive: true,
    },
  ];

  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const fundsMap = new Map(funds.map((f) => [f.id, f]));

  const openPeriod: AccountingPeriod = {
    id: 'per-2026-10',
    branchId: sampleBranchId,
    year: 2026,
    month: 10,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    isClosed: false,
  };

  const closedPeriod: AccountingPeriod = {
    id: 'per-2026-09',
    branchId: sampleBranchId,
    year: 2026,
    month: 9,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    isClosed: true,
    closedAt: '2026-10-02T12:00:00Z',
    closedBy: 'user-treasurer',
  };

  it('creates and validates a standard balanced GHS journal entry', () => {
    const entry = createJournalEntry({
      id: 'je-001',
      branchId: sampleBranchId,
      documentNumber: 'JE-TR-000001',
      entryDate: '2026-10-15',
      narration: 'Sunday Tithes deposit to Cash on Hand',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'line-1',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 500000n, // GHS 5,000.00
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'Cash received',
        },
        {
          id: 'line-2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Tithes income',
        },
      ],
      period: openPeriod,
    });

    expect(entry.lineCount).toBe(2);
    expect(entry.totalDebitGhs).toBe(500000n);
    expect(entry.totalCreditGhs).toBe(500000n);

    const validation = validateJournalEntry(entry, accountsMap, fundsMap, openPeriod);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('rejects posting into a closed accounting period', () => {
    const entry = createJournalEntry({
      id: 'je-002',
      branchId: sampleBranchId,
      documentNumber: 'JE-TR-000002',
      entryDate: '2026-09-15',
      narration: 'Backdated entry',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'line-1',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 1000n,
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'line-2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 1000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
      period: closedPeriod,
    });

    const validation = validateJournalEntry(entry, accountsMap, fundsMap, closedPeriod);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('closed period'))).toBe(true);
  });

  it('enforces fund accounting balance: rejects entries unbalanced per fund', () => {
    const entry = createJournalEntry({
      id: 'je-003',
      branchId: sampleBranchId,
      documentNumber: 'JE-TR-000003',
      entryDate: '2026-10-18',
      narration: 'Cross-fund entry without interfund clearing',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'line-1',
          accountId: 'acct-1010',
          fundId: 'fund-gen', // General Fund Debit
          originalCurrency: 'GHS',
          originalAmount: 10000n,
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'line-2',
          accountId: 'acct-4010',
          fundId: 'fund-bld', // Building Fund Credit (Restricted!)
          originalCurrency: 'GHS',
          originalAmount: 10000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
      period: openPeriod,
    });

    const validation = validateJournalEntry(entry, accountsMap, fundsMap, openPeriod);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Fund "General Fund" is unbalanced'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('Fund "Building Fund" is unbalanced'))).toBe(true);
  });

  it('converts USD lines and auto-balances 1 pesewa rounding difference', () => {
    // 100.00 USD at 15.5000 = 1,550.00 GHS (155,000 pesewas)
    const entry = createJournalEntry({
      id: 'je-usd',
      branchId: sampleBranchId,
      documentNumber: 'JE-TR-000004',
      entryDate: '2026-10-20',
      narration: 'USD Donation',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      autoBalanceRounding: true,
      roundingAccountId: 'acct-5990',
      defaultFundId: 'fund-gen',
      lines: [
        {
          id: 'line-1',
          accountId: 'acct-1020',
          fundId: 'fund-gen',
          originalCurrency: 'USD',
          originalAmount: 10000n, // $100.00
          exchangeRate: '15.5000',
          isDebit: true,
        },
        {
          id: 'line-2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 155000n, // GHS 1,550.00
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
      period: openPeriod,
    });

    expect(entry.totalDebitGhs).toBe(155000n);
    expect(entry.totalCreditGhs).toBe(155000n);
    const validation = validateJournalEntry(entry, accountsMap, fundsMap, openPeriod);
    expect(validation.isValid).toBe(true);
  });

  it('calculates full Trial Balance accurately', () => {
    const entry1 = createJournalEntry({
      id: 'je-1',
      branchId: sampleBranchId,
      documentNumber: 'JE-01',
      entryDate: '2026-10-05',
      narration: 'Tithes',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'l1',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 200000n,
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'l2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 200000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
    });

    const entry2 = createJournalEntry({
      id: 'je-2',
      branchId: sampleBranchId,
      documentNumber: 'JE-02',
      entryDate: '2026-10-10',
      narration: 'Utility payment',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'l3',
          accountId: 'acct-5020',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 50000n,
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'l4',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 50000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
    });

    const tb = calculateTrialBalance([entry1, entry2], accounts, funds);

    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebitsGhs).toBe(250000n);
    expect(tb.totalCreditsGhs).toBe(250000n);
    expect(tb.differenceGhs).toBe(0n);

    // Cash on Hand: 200,000 Dr - 50,000 Cr = 150,000 net
    const cash = tb.accounts.find((a) => a.accountCode === '1010');
    expect(cash?.netBalanceGhs).toBe(150000n);

    // Tithes Income: 200,000 Cr net
    const tithes = tb.accounts.find((a) => a.accountCode === '4010');
    expect(tithes?.netBalanceGhs).toBe(200000n);

    // General fund balance = 200,000 Inflow - 50,000 Outflow = 150,000 net
    const genFund = tb.fundBalances.find((f) => f.fundCode === 'GEN');
    expect(genFund?.netBalanceGhs).toBe(150000n);
    expect(genFund?.isOverdrawn).toBe(false);
  });

  it('calculates USD month-end revaluation at closing rate', () => {
    // Initial entry: received $500.00 at historical rate 15.0000 = 7,500.00 GHS (750,000 pesewas)
    const entry = createJournalEntry({
      id: 'je-init-usd',
      branchId: sampleBranchId,
      documentNumber: 'JE-USD-01',
      entryDate: '2026-10-01',
      narration: 'USD Offering',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'l1',
          accountId: 'acct-1020',
          fundId: 'fund-gen',
          originalCurrency: 'USD',
          originalAmount: 50000n, // $500.00
          exchangeRate: '15.0000',
          isDebit: true,
        },
        {
          id: 'l2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 750000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
    });

    // Revalue at month-end closing rate 16.0000:
    // $500.00 * 16.0000 = 8,000.00 GHS (800,000 pesewas)
    // Unrealized Gain = 800,000 - 750,000 = 50,000 pesewas (GHS 500.00)
    const reval = calculateRevaluation({
      entries: [entry],
      usdAccounts: accounts,
      closingRate: '16.0000',
      revaluationDate: '2026-10-31',
      fxGainLossAccountId: 'acct-5990',
      generalFundId: 'fund-gen',
    });

    expect(reval.isNetGain).toBe(true);
    expect(reval.totalAdjustmentGhs).toBe(50000n);
    expect(reval.revaluationLines).toHaveLength(1);
    expect(reval.revaluationLines[0]!.differenceGhs).toBe(50000n);
    expect(reval.revaluationLines[0]!.newGhsValue).toBe(800000n);
  });
});
