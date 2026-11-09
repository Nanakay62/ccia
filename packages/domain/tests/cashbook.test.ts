import { describe, it, expect } from 'vitest';
import {
  calculateRunningBalances,
  validateOverdraft,
  validateEntryDate,
  createCashbookReceipt,
  createCashbookPayment,
  createCashbookTransfer,
  isChequeStale,
  calculatePhysicalCashTotal,
  computeAnalysedCashbook,
  calculateBankReconciliation,
  validateBankReconciliationSignoff,
  validateMonthCloseReconciliation,
  getNextChequeNumber,
  validateChequeNumber,
  refreshChequeStatuses,
  autoMatchStatementLines,
} from '../src/cashbook/index.js';
import type {
  CashAccount,
  CashbookEntry,
  CashCountLine,
  ChequeItem,
  BankReconciliation,
  BankStatementLine,
} from '../src/cashbook/types.js';
import type { Account, Fund, AccountingPeriod } from '../src/ledger/types.js';

describe('Cashbook Domain Rules & Double-Entry Invariants', () => {
  const mockCashGhsAccount: CashAccount = {
    id: 'ca-cash-ghs',
    branchId: 'branch-01',
    accountId: 'acct-1010',
    code: '1010',
    name: 'Cash on Hand (GHS)',
    kind: 'cash',
    currency: 'GHS',
    allowOverdraft: false,
    openingBalance: 100000n, // GHS 1,000.00
    openingDate: '2026-08-01',
    isActive: true,
  };

  const mockCashUsdAccount: CashAccount = {
    id: 'ca-cash-usd',
    branchId: 'branch-01',
    accountId: 'acct-1020',
    code: '1020',
    name: 'Cash on Hand (USD)',
    kind: 'cash',
    currency: 'USD',
    allowOverdraft: false,
    openingBalance: 50000n, // $500.00
    openingDate: '2026-08-01',
    isActive: true,
  };

  const mockBankGhsAccount: CashAccount = {
    id: 'ca-bank-ghs',
    branchId: 'branch-01',
    accountId: 'acct-1030',
    code: '1030',
    name: 'Bank Account (GHS)',
    kind: 'bank',
    currency: 'GHS',
    bankName: 'GCB Bank PLC',
    branchName: 'High Street Branch',
    accountNumberMasked: '**** **** 4492',
    allowOverdraft: false,
    openingBalance: 5000000n, // GHS 50,000.00
    openingDate: '2026-08-01',
    isActive: true,
  };

  const mockGeneralFund: Fund = {
    id: 'fund-gen',
    branchId: 'branch-01',
    code: 'GEN',
    name: 'General Fund',
    type: 'Unrestricted',
    allowOverdraft: true,
    isActive: true,
  };

  const mockTithesIncomeAccount: Account = {
    id: 'acct-4010',
    branchId: 'branch-01',
    code: '4010',
    name: 'Tithes',
    type: 'Income',
    currency: 'GHS',
    isBankOrCash: false,
    isActive: true,
  };

  const mockUtilitiesExpenseAccount: Account = {
    id: 'acct-5020',
    branchId: 'branch-01',
    code: '5020',
    name: 'Utilities',
    type: 'Expense',
    currency: 'GHS',
    isBankOrCash: false,
    isActive: true,
  };

  const mockFxGainLossAccount: Account = {
    id: 'acct-5980',
    branchId: 'branch-01',
    code: '5980',
    name: 'Foreign Exchange Gain/Loss',
    type: 'Expense',
    currency: 'GHS',
    isBankOrCash: false,
    isActive: true,
  };

  const mockOpenPeriod: AccountingPeriod = {
    id: 'per-2026-10',
    branchId: 'branch-01',
    year: 2026,
    month: 10,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    isClosed: false,
  };

  const mockClosedPeriod: AccountingPeriod = {
    id: 'per-2026-09',
    branchId: 'branch-01',
    year: 2026,
    month: 9,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    isClosed: true,
    closedAt: '2026-10-02T10:00:00Z',
    closedBy: 'user-0001-treasurer',
  };

  it('calculates running balances chronologically by date and creation', () => {
    const rawEntries: CashbookEntry[] = [
      {
        id: 'cb-2',
        branchId: 'branch-01',
        journalEntryId: 'je-2',
        cashAccountId: 'ca-cash-ghs',
        direction: 'PAYMENT',
        entryDate: '2026-10-05',
        refNumber: 'PV-001',
        details: 'Office water refill',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-5020',
        counterpartAccountName: 'Utilities',
        amount: 20000n, // GHS 200.00
        method: 'CASH',
        source: 'VOUCHER',
        isReversal: false,
        createdBy: 'user-fs',
        createdAt: '2026-10-05T12:00:00Z',
      },
      {
        id: 'cb-1',
        branchId: 'branch-01',
        journalEntryId: 'je-1',
        cashAccountId: 'ca-cash-ghs',
        direction: 'RECEIPT',
        entryDate: '2026-10-01',
        refNumber: 'RC-001',
        details: 'Member donation',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-4010',
        counterpartAccountName: 'Tithes',
        amount: 50000n, // GHS 500.00
        method: 'CASH',
        source: 'MANUAL',
        isReversal: false,
        createdBy: 'user-fs',
        createdAt: '2026-10-01T09:00:00Z',
      },
    ];

    const opening = 100000n; // GHS 1,000.00
    const calculated = calculateRunningBalances(rawEntries, opening);

    expect(calculated[0]!.id).toBe('cb-1');
    expect(calculated[0]!.runningBalance).toBe(150000n); // 1000 + 500 = 1500

    expect(calculated[1]!.id).toBe('cb-2');
    expect(calculated[1]!.runningBalance).toBe(130000n); // 1500 - 200 = 1300
  });

  it('enforces overdraft restriction on Cash and MoMo accounts without override', () => {
    const currentBalance = 5000n; // GHS 50.00
    const deduction = 12000n;      // GHS 120.00

    // Without override
    const check1 = validateOverdraft(mockCashGhsAccount, currentBalance, deduction);
    expect(check1.allowed).toBe(false);
    expect(check1.error).toContain('cannot be overdrawn');

    // With Treasurer override and reason
    const check2 = validateOverdraft(mockCashGhsAccount, currentBalance, deduction, {
      isOverridden: true,
      reason: 'Emergency generator diesel purchase approved by Board',
      authorizedBy: 'Kofi Mensah (Treasurer)',
    });
    expect(check2.allowed).toBe(true);
  });

  it('rejects entries into closed periods and future dates', () => {
    const closedCheck = validateEntryDate('2026-09-15', mockClosedPeriod);
    expect(closedCheck.isValid).toBe(false);
    expect(closedCheck.error).toContain('closed period 2026-09');

    const futureCheck = validateEntryDate('2099-01-01', mockOpenPeriod);
    expect(futureCheck.isValid).toBe(false);
    expect(futureCheck.error).toContain('cannot be in the future');
  });

  it('creates balanced double-entry receipt in base currency GHS', () => {
    const { journalEntry, cashbookEntry } = createCashbookReceipt({
      branchId: 'branch-01',
      cashAccount: mockCashGhsAccount,
      entryDate: '2026-10-12',
      receivedFrom: 'Brother Emmanuel Ofori',
      fund: mockGeneralFund,
      incomeAccount: mockTithesIncomeAccount,
      amount: 450000n, // GHS 4,500.00
      method: 'CASH',
      refNumber: 'RC-202610-0014',
      narration: 'Tithe envelope ENV-042',
      category: 'Tithes',
      period: mockOpenPeriod,
      createdBy: 'Akosua Osei (Finance Secretary)',
      deviceId: 'DEV-FS-01',
    });

    expect(journalEntry.totalDebitGhs).toBe(450000n);
    expect(journalEntry.totalCreditGhs).toBe(450000n);
    expect(journalEntry.lines).toHaveLength(2);

    // Dr Cash on Hand, Cr Tithes
    const debitLine = journalEntry.lines.find((l) => l.debitAmountGhs > 0n);
    const creditLine = journalEntry.lines.find((l) => l.creditAmountGhs > 0n);

    expect(debitLine?.accountId).toBe('acct-1010');
    expect(creditLine?.accountId).toBe('acct-4010');

    expect(cashbookEntry.direction).toBe('RECEIPT');
    expect(cashbookEntry.amount).toBe(450000n);
  });

  it('creates balanced double-entry payment linked to an approved voucher', () => {
    const { journalEntry, cashbookEntry } = createCashbookPayment({
      branchId: 'branch-01',
      cashAccount: mockBankGhsAccount,
      entryDate: '2026-10-15',
      paidTo: 'Electricity Company of Ghana (ECG)',
      linkedVoucherId: 'V-202610-0089',
      fund: mockGeneralFund,
      expenseAccount: mockUtilitiesExpenseAccount,
      amount: 320000n, // GHS 3,200.00
      method: 'CHEQUE',
      chequeNumber: '000412',
      narration: 'October church auditorium power bill',
      category: 'Utilities',
      period: mockOpenPeriod,
      currentBookBalance: 5000000n,
      createdBy: 'Akosua Osei (Finance Secretary)',
      deviceId: 'DEV-FS-01',
    });

    expect(journalEntry.totalDebitGhs).toBe(320000n);
    expect(journalEntry.totalCreditGhs).toBe(320000n);

    // Dr Utilities, Cr Bank
    const drLine = journalEntry.lines.find((l) => l.debitAmountGhs > 0n);
    const crLine = journalEntry.lines.find((l) => l.creditAmountGhs > 0n);

    expect(drLine?.accountId).toBe('acct-5020');
    expect(crLine?.accountId).toBe('acct-1030');

    expect(cashbookEntry.direction).toBe('PAYMENT');
    expect(cashbookEntry.chequeNumber).toBe('000412');
  });

  it('rejects payments without an approved voucher unless exempt or overridden', () => {
    expect(() =>
      createCashbookPayment({
        branchId: 'branch-01',
        cashAccount: mockBankGhsAccount,
        entryDate: '2026-10-15',
        paidTo: 'Random Vendor',
        fund: mockGeneralFund,
        expenseAccount: mockUtilitiesExpenseAccount,
        amount: 50000n,
        method: 'CASH',
        narration: 'No voucher provided',
        period: mockOpenPeriod,
        currentBookBalance: 5000000n,
        createdBy: 'Akosua Osei',
        deviceId: 'DEV-FS-01',
      })
    ).toThrow(/requires a linked approved voucher/i);
  });

  it('handles cross-currency transfer (USD to GHS) and posts foreign exchange difference', () => {
    // Transfer $100.00 USD at 15.5000 rate = 1,550.00 GHS
    // But destination bank credited 1,540.00 GHS (bank spread/commission of 10.00 GHS)
    const { journalEntry, sourceEntry, destinationEntry } = createCashbookTransfer({
      branchId: 'branch-01',
      fromAccount: mockCashUsdAccount,
      toAccount: mockBankGhsAccount,
      entryDate: '2026-10-18',
      amount: 10000n, // $100.00 (in cents)
      exchangeRate: '15.5000',
      destinationAmount: 154000n, // 1,540.00 GHS received
      fund: mockGeneralFund,
      fxGainLossAccount: mockFxGainLossAccount,
      refNumber: 'TR-202610-0004',
      narration: 'Deposit of USD cash into GHS bank account',
      period: mockOpenPeriod,
      currentSourceBalance: 50000n,
      createdBy: 'Kofi Mensah (Treasurer)',
      deviceId: 'DEV-TR-01',
    });

    // Journal Entry must balance
    expect(journalEntry.totalDebitGhs).toBe(journalEntry.totalCreditGhs);
    expect(journalEntry.totalDebitGhs).toBe(155000n);

    // Verify source and destination entries
    expect(sourceEntry.cashAccountId).toBe('ca-cash-usd');
    expect(sourceEntry.direction).toBe('PAYMENT');
    expect(sourceEntry.amount).toBe(10000n); // $100.00

    expect(destinationEntry.cashAccountId).toBe('ca-bank-ghs');
    expect(destinationEntry.direction).toBe('RECEIPT');
    expect(destinationEntry.amount).toBe(154000n); // GHS 1,540.00
  });

  it('identifies stale cheques older than 6 months', () => {
    const recentChequeDate = '2026-09-01';
    const staleChequeDate = '2026-01-10';
    const asOfDate = '2026-10-20';

    expect(isChequeStale(recentChequeDate, asOfDate)).toBe(false);
    expect(isChequeStale(staleChequeDate, asOfDate)).toBe(true);
  });

  it('tallies cash count denomination lines accurately', () => {
    const lines: CashCountLine[] = [
      { denomination: 200, quantity: 10, lineTotal: 200000n }, // 200 * 10 = 2,000.00
      { denomination: 100, quantity: 15, lineTotal: 150000n }, // 100 * 15 = 1,500.00
      { denomination: 50, quantity: 20, lineTotal: 100000n },  // 50 * 20 = 1,000.00
      { denomination: 1, quantity: 50, lineTotal: 5000n },     // 1 * 50 = 50.00
    ];

    const total = calculatePhysicalCashTotal(lines);
    expect(total).toBe(455000n); // GHS 4,550.00
  });

  it('computes analysed cashbook categories and agrees with overall totals', () => {
    const entries: CashbookEntry[] = [
      {
        id: '1',
        branchId: 'b',
        journalEntryId: 'j1',
        cashAccountId: 'ca',
        direction: 'RECEIPT',
        entryDate: '2026-10-01',
        refNumber: 'R1',
        details: 'Tithes',
        fundId: 'f',
        fundCode: 'GEN',
        counterpartAccountId: 'a',
        counterpartAccountName: 'Tithes',
        category: 'Tithes',
        amount: 800000n,
        method: 'CASH',
        source: 'MANUAL',
        isReversal: false,
        createdBy: 'u',
        createdAt: 't',
      },
      {
        id: '2',
        branchId: 'b',
        journalEntryId: 'j2',
        cashAccountId: 'ca',
        direction: 'RECEIPT',
        entryDate: '2026-10-01',
        refNumber: 'R2',
        details: 'Offering',
        fundId: 'f',
        fundCode: 'GEN',
        counterpartAccountId: 'a',
        counterpartAccountName: 'Offerings',
        category: 'Offerings',
        amount: 300000n,
        method: 'CASH',
        source: 'MANUAL',
        isReversal: false,
        createdBy: 'u',
        createdAt: 't',
      },
      {
        id: '3',
        branchId: 'b',
        journalEntryId: 'j3',
        cashAccountId: 'ca',
        direction: 'PAYMENT',
        entryDate: '2026-10-02',
        refNumber: 'P1',
        details: 'Light bill',
        fundId: 'f',
        fundCode: 'GEN',
        counterpartAccountId: 'a',
        counterpartAccountName: 'Utilities',
        category: 'Utilities',
        amount: 150000n,
        method: 'CASH',
        source: 'VOUCHER',
        isReversal: false,
        createdBy: 'u',
        createdAt: 't',
      },
    ];

    const opening = 200000n;
    const analysed = computeAnalysedCashbook(entries, opening);

    expect(analysed.totalReceipts).toBe(1100000n);
    expect(analysed.totalPayments).toBe(150000n);
    expect(analysed.closingBalance).toBe(1150000n); // 2000 + 11000 - 1500 = 11500

    expect(analysed.receiptsCategories.find((c) => c.name === 'Tithes')?.total).toBe(800000n);
    expect(analysed.receiptsCategories.find((c) => c.name === 'Offerings')?.total).toBe(300000n);
    expect(analysed.paymentsCategories.find((c) => c.name === 'Utilities')?.total).toBe(150000n);
  });

  describe('Phase 2: Bank Reconciliation Calculations & Validation', () => {
    const mockBankEntries: CashbookEntry[] = [
      {
        id: 'cb-b1',
        branchId: 'branch-01',
        journalEntryId: 'je-1',
        cashAccountId: 'ca-bank-ghs',
        direction: 'RECEIPT',
        entryDate: '2026-10-05',
        refNumber: 'RC-001',
        details: 'Tithe deposit',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-4010',
        counterpartAccountName: 'Tithes',
        amount: 1000000n, // GHS 10,000.00
        method: 'BANK_TRANSFER',
        source: 'MANUAL',
        isReversal: false,
        createdBy: 'usr-1',
        createdAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'cb-b2',
        branchId: 'branch-01',
        journalEntryId: 'je-2',
        cashAccountId: 'ca-bank-ghs',
        direction: 'RECEIPT',
        entryDate: '2026-10-30',
        refNumber: 'RC-002',
        details: 'Deposit in transit (received end of month)',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-4010',
        counterpartAccountName: 'Tithes',
        amount: 500000n, // GHS 5,000.00
        method: 'BANK_TRANSFER',
        source: 'MANUAL',
        isReversal: false,
        createdBy: 'usr-1',
        createdAt: '2026-10-30T16:00:00Z',
      },
      {
        id: 'cb-b3',
        branchId: 'branch-01',
        journalEntryId: 'je-3',
        cashAccountId: 'ca-bank-ghs',
        direction: 'PAYMENT',
        entryDate: '2026-10-15',
        refNumber: 'PV-001',
        details: 'Utility payment (cleared)',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-5020',
        counterpartAccountName: 'Utilities',
        amount: 300000n, // GHS 3,000.00
        method: 'CHEQUE',
        source: 'VOUCHER',
        isReversal: false,
        createdBy: 'usr-1',
        createdAt: '2026-10-15T12:00:00Z',
      },
      {
        id: 'cb-b4',
        branchId: 'branch-01',
        journalEntryId: 'je-4',
        cashAccountId: 'ca-bank-ghs',
        direction: 'PAYMENT',
        entryDate: '2026-10-28',
        refNumber: 'PV-002',
        details: 'Unpresented cheque to supplier',
        fundId: 'fund-gen',
        fundCode: 'GEN',
        counterpartAccountId: 'acct-5020',
        counterpartAccountName: 'Maintenance',
        amount: 200000n, // GHS 2,000.00
        method: 'CHEQUE',
        chequeNumber: '000395',
        source: 'VOUCHER',
        isReversal: false,
        createdBy: 'usr-1',
        createdAt: '2026-10-28T14:00:00Z',
      },
    ];

    it('calculates balanced bank reconciliation: Statement + Deposits in transit - Unpresented cheques = Cashbook balance', () => {
      // Opening balance: GHS 50,000.00
      // Total receipts: 10,000 + 5,000 = 15,000
      // Total payments: 3,000 + 2,000 = 5,000
      // Cashbook closing balance = 50,000 + 15,000 - 5,000 = GHS 60,000.00 (6,000,000 pesewas)
      //
      // Cleared on statement: cb-b1 (receipt 10,000) and cb-b3 (payment 3,000)
      // Bank statement ending balance = 50,000 (opening) + 10,000 - 3,000 = GHS 57,000.00 (5,700,000 pesewas)
      //
      // Uncleared:
      // Deposits in transit = cb-b2 (5,000.00)
      // Unpresented cheques = cb-b4 (2,000.00)
      //
      // Adjusted bank balance = 57,000 + 5,000 - 2,000 = 60,000.00
      // Variance = 60,000 - 60,000 = 0.00!

      const clearedIds = new Set(['cb-b1', 'cb-b3']);
      const opening = 5000000n;
      const statementEnding = 5700000n;

      const result = calculateBankReconciliation(statementEnding, mockBankEntries, clearedIds, opening);

      expect(result.cashbookClosingBalance).toBe(6000000n);
      expect(result.depositsInTransit).toBe(500000n);
      expect(result.unpresentedCheques).toBe(200000n);
      expect(result.adjustedBankBalance).toBe(6000000n);
      expect(result.variance).toBe(0n);
      expect(result.isBalanced).toBe(true);
      expect(result.unclearedReceipts).toHaveLength(1);
      expect(result.unclearedReceipts[0]?.id).toBe('cb-b2');
      expect(result.unclearedPayments).toHaveLength(1);
      expect(result.unclearedPayments[0]?.id).toBe('cb-b4');
    });

    it('detects out-of-balance reconciliation when statement balance does not reconcile', () => {
      const clearedIds = new Set(['cb-b1', 'cb-b3']);
      const opening = 5000000n;
      const wrongStatementEnding = 5690000n; // 100 GHS short

      const result = calculateBankReconciliation(wrongStatementEnding, mockBankEntries, clearedIds, opening);

      expect(result.isBalanced).toBe(false);
      expect(result.variance).toBe(-10000n); // Out of balance by GHS -100.00
    });

    it('enforces dual sign-off validation: variance must be zero and signers must differ', () => {
      // Out of balance rejection
      const outOfBalanceCheck = validateBankReconciliationSignoff(-10000n, 'usr-sec-01', 'usr-tres-01');
      expect(outOfBalanceCheck.isValid).toBe(false);
      expect(outOfBalanceCheck.error).toContain('unexplained variance');

      // Identical signer violation rejection
      const sameSignerCheck = validateBankReconciliationSignoff(0n, 'usr-sec-01', 'usr-sec-01');
      expect(sameSignerCheck.isValid).toBe(false);
      expect(sameSignerCheck.error).toContain('two different individuals');

      // Valid dual sign-off
      const validCheck = validateBankReconciliationSignoff(0n, 'usr-sec-01', 'usr-tres-01');
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.error).toBeUndefined();
    });

    it('enforces month-close lock rule: cannot close period without approved bank reconciliation unless overridden', () => {
      const bankAccounts: CashAccount[] = [mockBankGhsAccount];

      const reconciliations: BankReconciliation[] = [
        {
          id: 'rec-01',
          branchId: 'branch-01',
          bankAccountId: 'ca-bank-ghs',
          statementDate: '2026-10-31',
          statementEndingBalance: 5700000n,
          cashbookClosingBalance: 6000000n,
          depositsInTransit: 500000n,
          unpresentedCheques: 200000n,
          adjustedBankBalance: 6000000n,
          variance: 0n,
          clearedEntryIds: ['cb-b1', 'cb-b3'],
          status: 'DRAFT', // Not yet approved!
          createdAt: '2026-10-31T17:00:00Z',
          updatedAt: '2026-10-31T17:00:00Z',
        },
      ];

      // Blocked because October 2026 is only in DRAFT status
      const blocked = validateMonthCloseReconciliation(bankAccounts, reconciliations, 2026, 10);
      expect(blocked.canClose).toBe(false);
      expect(blocked.unreconciledAccounts).toContain('Bank Account (GHS)');
      expect(blocked.error).toContain('do not have an approved bank reconciliation');

      // Allowed with Treasurer override
      const overridden = validateMonthCloseReconciliation(bankAccounts, reconciliations, 2026, 10, {
        isOverridden: true,
        reason: 'Bank statement delayed due to public holiday, reconciling next week',
        authorizedBy: 'Kofi Mensah',
      });
      expect(overridden.canClose).toBe(true);

      // Allowed when reconciliation is APPROVED
      const approvedReconciliations: BankReconciliation[] = [
        {
          ...reconciliations[0]!,
          status: 'APPROVED',
          approvedBy: {
            userId: 'usr-tres-01',
            fullName: 'Kofi Mensah',
            role: 'Treasurer',
            signedAt: '2026-10-31T18:00:00Z',
          },
        },
      ];
      const approved = validateMonthCloseReconciliation(bankAccounts, approvedReconciliations, 2026, 10);
      expect(approved.canClose).toBe(true);
      expect(approved.unreconciledAccounts).toHaveLength(0);
    });
  });

  describe('Phase 2: Cheque Register & Stale Cheques Rules', () => {
    const mockCheques: ChequeItem[] = [
      {
        id: 'chq-1',
        branchId: 'branch-01',
        bankAccountId: 'ca-bank-ghs',
        chequeNumber: '000390',
        payee: 'Accra Electricity Co.',
        amount: 250000n,
        currency: 'GHS',
        issueDate: '2026-03-10', // 7 months old
        status: 'ISSUED',
        staleDate: '2026-09-10',
      },
      {
        id: 'chq-2',
        branchId: 'branch-01',
        bankAccountId: 'ca-bank-ghs',
        chequeNumber: '000391',
        payee: 'Water Works',
        amount: 150000n,
        currency: 'GHS',
        issueDate: '2026-10-01', // 1 month old
        status: 'ISSUED',
        staleDate: '2027-04-01',
      },
      {
        id: 'chq-3',
        branchId: 'branch-01',
        bankAccountId: 'ca-bank-ghs',
        chequeNumber: '000392',
        payee: 'Office Supplies Ltd',
        amount: 80000n,
        currency: 'GHS',
        issueDate: '2026-09-15',
        status: 'PRESENTED',
        presentedDate: '2026-09-22',
        staleDate: '2027-03-15',
      },
    ];

    it('generates the next sequential cheque number padded to 6 digits', () => {
      const nextNum = getNextChequeNumber(mockCheques);
      expect(nextNum).toBe('000393');
    });

    it('validates cheque numbers: catches duplicates and warns about sequence gaps', () => {
      // Duplicate
      const dupCheck = validateChequeNumber('000391', mockCheques);
      expect(dupCheck.isValid).toBe(false);
      expect(dupCheck.error).toContain('already been issued');

      // Sequence gap
      const gapCheck = validateChequeNumber('000400', mockCheques);
      expect(gapCheck.isValid).toBe(true);
      expect(gapCheck.warning).toContain('creates a sequence gap');

      // Valid sequential
      const validCheck = validateChequeNumber('000393', mockCheques);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.warning).toBeUndefined();
    });

    it('identifies and refreshes stale cheques older than 6 months', () => {
      const refreshed = refreshChequeStatuses(mockCheques, '2026-10-31');
      const staleCheque = refreshed.find((c) => c.chequeNumber === '000390');
      const activeCheque = refreshed.find((c) => c.chequeNumber === '000391');
      const presentedCheque = refreshed.find((c) => c.chequeNumber === '000392');

      expect(staleCheque?.status).toBe('STALE');
      expect(activeCheque?.status).toBe('ISSUED');
      expect(presentedCheque?.status).toBe('PRESENTED'); // Presented cheques remain presented
    });

    it('suggests automatic matching between bank statement lines and cashbook entries', () => {
      const statementLines: BankStatementLine[] = [
        {
          id: 'stmt-l1',
          branchId: 'branch-01',
          bankAccountId: 'ca-bank-ghs',
          statementDate: '2026-10-06', // 1 day after cb-b1
          description: 'GCB DIRECT CREDIT TITHE',
          credit: 1000000n, // GHS 10,000.00
          isMatched: false,
          createdAt: '2026-10-31T00:00:00Z',
        },
        {
          id: 'stmt-l2',
          branchId: 'branch-01',
          bankAccountId: 'ca-bank-ghs',
          statementDate: '2026-10-16', // 1 day after cb-b3
          description: 'CLEARING CHEQUE ECG',
          debit: 300000n, // GHS 3,000.00
          isMatched: false,
          createdAt: '2026-10-31T00:00:00Z',
        },
      ];

      const matches = autoMatchStatementLines(statementLines, [
        {
          id: 'cb-b1',
          branchId: 'branch-01',
          journalEntryId: 'je-1',
          cashAccountId: 'ca-bank-ghs',
          direction: 'RECEIPT',
          entryDate: '2026-10-05',
          refNumber: 'RC-001',
          details: 'Tithe deposit',
          fundId: 'fund-gen',
          fundCode: 'GEN',
          counterpartAccountId: 'acct-4010',
          counterpartAccountName: 'Tithes',
          amount: 1000000n,
          method: 'BANK_TRANSFER',
          source: 'MANUAL',
          isReversal: false,
          createdBy: 'usr-1',
          createdAt: '2026-10-05T10:00:00Z',
        },
        {
          id: 'cb-b3',
          branchId: 'branch-01',
          journalEntryId: 'je-3',
          cashAccountId: 'ca-bank-ghs',
          direction: 'PAYMENT',
          entryDate: '2026-10-15',
          refNumber: 'PV-001',
          details: 'Utility payment',
          fundId: 'fund-gen',
          fundCode: 'GEN',
          counterpartAccountId: 'acct-5020',
          counterpartAccountName: 'Utilities',
          amount: 300000n,
          method: 'CHEQUE',
          source: 'VOUCHER',
          isReversal: false,
          createdBy: 'usr-1',
          createdAt: '2026-10-15T12:00:00Z',
        },
      ]);

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({ statementLineId: 'stmt-l1', cashbookEntryId: 'cb-b1' });
      expect(matches[1]).toEqual({ statementLineId: 'stmt-l2', cashbookEntryId: 'cb-b3' });
    });
  });
});
