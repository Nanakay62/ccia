import { describe, it, expect } from 'vitest';
import {
  diagnoseLedger,
  createJournalEntry,
  type Account,
  type Fund,
  type JournalEntry,
  type JournalLine,
} from '../src/index.js';

describe('Trial Balance Doctor (Section 3.5 10-Step Diagnostic Engine)', () => {
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
      id: 'acct-9999',
      branchId: sampleBranchId,
      code: '9999',
      name: 'Archived Legacy Account',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: false, // Inactive!
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
  ];

  it('reports healthy and clean on a balanced, error-free ledger', () => {
    const entry = createJournalEntry({
      id: 'je-clean-1',
      branchId: sampleBranchId,
      documentNumber: 'JE-01',
      entryDate: '2026-10-01',
      narration: 'Balanced tithe entry',
      createdBy: 'user-01',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'l1',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 10000n,
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'l2',
          accountId: 'acct-4010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 10000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
    });

    const report = diagnoseLedger({
      entries: [entry],
      accounts,
      funds,
    });

    expect(report.isClean).toBe(true);
    expect(report.totalDifferenceGhs).toBe(0n);
    expect(report.findings.filter((f) => f.severity === 'ERROR')).toHaveLength(0);
    expect(report.plainLanguageSummary).toMatch(/healthy/i);
  });

  describe('Rule 2: Unbalanced entries detection', () => {
    it('detects and flags an unbalanced entry with exact difference', () => {
      // Deliberately corrupt entry: Dr 5000, Cr 4000 (diff 1000 pesewas)
      const corruptedEntry: JournalEntry = {
        id: 'je-unbalanced',
        branchId: sampleBranchId,
        documentNumber: 'JE-ERR-02',
        entryDate: '2026-10-02',
        narration: 'Corrupted unbalanced entry',
        lineCount: 2,
        totalDebitGhs: 5000n,
        totalCreditGhs: 4000n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-02T10:00:00Z',
        lines: [
          {
            id: 'l1',
            journalEntryId: 'je-unbalanced',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 5000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 5000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'l2',
            journalEntryId: 'je-unbalanced',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 4000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 4000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [corruptedEntry],
        accounts,
        funds,
      });

      expect(report.isClean).toBe(false);
      expect(report.totalDifferenceGhs).toBe(1000n);
      expect(report.explainedDifferenceGhs).toBe(1000n);

      const r2Finding = report.findings.find((f) => f.ruleNumber === 2);
      expect(r2Finding).toBeDefined();
      expect(r2Finding?.severity).toBe('ERROR');
      expect(r2Finding?.title).toContain('Unbalanced Journal Entry');
      expect(r2Finding?.recommendedFix).toContain('linked reversal');
    });
  });

  describe('Rule 3: Structural problems detection', () => {
    it('detects orphaned lines, empty headers, single-line entries, and inactive accounts', () => {
      const orphanedLine: JournalLine = {
        id: 'orphan-1',
        journalEntryId: 'non-existent-header',
        accountId: 'acct-1010',
        fundId: 'fund-gen',
        lineNumber: 1,
        originalCurrency: 'GHS',
        originalAmount: 2500n,
        exchangeRate: '1.0000',
        debitAmountGhs: 2500n,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
      };

      const emptyHeader: JournalEntry = {
        id: 'header-empty',
        branchId: sampleBranchId,
        documentNumber: 'JE-EMPTY-01',
        entryDate: '2026-10-05',
        narration: 'Empty header',
        lineCount: 2,
        totalDebitGhs: 0n,
        totalCreditGhs: 0n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-05T10:00:00Z',
        lines: [],
      };

      const singleLineEntry: JournalEntry = {
        id: 'je-single',
        branchId: sampleBranchId,
        documentNumber: 'JE-SINGLE-01',
        entryDate: '2026-10-06',
        narration: 'Single line',
        lineCount: 1,
        totalDebitGhs: 3000n,
        totalCreditGhs: 0n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-06T10:00:00Z',
        lines: [
          {
            id: 'sl-1',
            journalEntryId: 'je-single',
            accountId: 'acct-9999', // Inactive account!
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 3000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 3000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [singleLineEntry],
        orphanedLines: [orphanedLine],
        emptyHeaders: [emptyHeader],
        accounts,
        funds,
      });

      const r3Findings = report.findings.filter((f) => f.ruleNumber === 3);
      expect(r3Findings.length).toBeGreaterThanOrEqual(3);

      expect(r3Findings.some((f) => f.title.includes('Orphaned'))).toBe(true);
      expect(r3Findings.some((f) => f.title.includes('Empty Journal Entry Header'))).toBe(true);
      expect(r3Findings.some((f) => f.title.includes('Single-Line Entry'))).toBe(true);
      expect(r3Findings.some((f) => f.title.includes('Inactive Account'))).toBe(true);
    });
  });

  describe('Rule 4: Sync gaps detection', () => {
    it('flags entries where synced lines are fewer than header line_count', () => {
      const partialSyncEntry: JournalEntry = {
        id: 'je-partial',
        branchId: sampleBranchId,
        documentNumber: 'JE-SYNC-01',
        entryDate: '2026-10-08',
        narration: 'Interrupted sync transaction',
        lineCount: 4, // Header expected 4
        totalDebitGhs: 10000n,
        totalCreditGhs: 10000n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-08T10:00:00Z',
        lines: [
          // Only 2 lines present in SQLite!
          {
            id: 'l1',
            journalEntryId: 'je-partial',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 5000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 5000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'l2',
            journalEntryId: 'je-partial',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 5000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 5000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [partialSyncEntry],
        accounts,
        funds,
      });

      const r4Finding = report.findings.find((f) => f.ruleNumber === 4);
      expect(r4Finding).toBeDefined();
      expect(r4Finding?.title).toContain('Partial Sync Detected');
      expect(r4Finding?.likelihoodScore).toBe(94);
    });
  });

  describe('Rule 6: Duplicate entry and flawed reversal detection', () => {
    it('identifies duplicate entries and mismatched reversals', () => {
      const original = createJournalEntry({
        id: 'orig-1',
        branchId: sampleBranchId,
        documentNumber: 'JE-100',
        entryDate: '2026-10-10',
        narration: 'Offering',
        createdBy: 'user-01',
        deviceId: 'dev-01',
        lines: [
          {
            id: 'l1',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 20000n,
            exchangeRate: '1.0000',
            isDebit: true,
          },
          {
            id: 'l2',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 20000n,
            exchangeRate: '1.0000',
            isDebit: false,
          },
        ],
      });

      // Duplicate with new ID but exact same date & lines
      const duplicate = createJournalEntry({
        id: 'orig-dup',
        branchId: sampleBranchId,
        documentNumber: 'JE-101',
        entryDate: '2026-10-10',
        narration: 'Offering',
        createdBy: 'user-01',
        deviceId: 'dev-01',
        lines: [
          {
            id: 'l3',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 20000n,
            exchangeRate: '1.0000',
            isDebit: true,
          },
          {
            id: 'l4',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 20000n,
            exchangeRate: '1.0000',
            isDebit: false,
          },
        ],
      });

      // Flawed reversal that doesn't match original amounts
      const flawedReversal: JournalEntry = {
        id: 'rev-flawed',
        branchId: sampleBranchId,
        documentNumber: 'JE-102',
        entryDate: '2026-10-11',
        narration: 'Flawed reversal',
        lineCount: 2,
        totalDebitGhs: 15000n, // Mismatched! Expected 20000n
        totalCreditGhs: 15000n,
        isReversal: true,
        reversalOfId: original.id,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-11T10:00:00Z',
        lines: [
          {
            id: 'rl1',
            journalEntryId: 'rev-flawed',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 15000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 15000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'rl2',
            journalEntryId: 'rev-flawed',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 15000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 15000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [original, duplicate, flawedReversal],
        accounts,
        funds,
      });

      const r6Findings = report.findings.filter((f) => f.ruleNumber === 6);
      expect(r6Findings.some((f) => f.title.includes('Probable Duplicate'))).toBe(true);
      expect(r6Findings.some((f) => f.title.includes('Flawed Reversal Entry'))).toBe(true);
    });
  });

  describe('Rule 7: Mathematical Pattern Detection on Difference D', () => {
    it('Rule 7b: detects debit/credit sign inversion (D / 2 matches line amount)', () => {
      // Entry where line of 5,000 pesewas was added as debit instead of credit
      // Debits = 15,000, Credits = 5,000 -> Diff D = 10,000. D / 2 = 5,000
      const signFlipEntry: JournalEntry = {
        id: 'je-sign-flip',
        branchId: sampleBranchId,
        documentNumber: 'JE-FLIP-01',
        entryDate: '2026-10-12',
        narration: 'Sign flip entry',
        lineCount: 2,
        totalDebitGhs: 15000n,
        totalCreditGhs: 5000n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-12T10:00:00Z',
        lines: [
          {
            id: 'l1',
            journalEntryId: 'je-sign-flip',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 15000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 15000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'l2',
            journalEntryId: 'je-sign-flip',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 5000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 5000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [signFlipEntry],
        accounts,
        funds,
      });

      const r7Finding = report.findings.find((f) => f.ruleNumber === 7 && f.title.includes('Sign Inversion'));
      expect(r7Finding).toBeDefined();
      expect(r7Finding?.likelihoodScore).toBe(93);
      expect(r7Finding?.probableCause).toContain('mistakenly entered as a credit');
    });

    it('Rule 7c: detects digit transposition when D is divisible by 9', () => {
      // 54 entered as 45: difference is 9 (or in pesewas, e.g. 5400 vs 4500 -> diff 900)
      const transpositionEntry: JournalEntry = {
        id: 'je-trans',
        branchId: sampleBranchId,
        documentNumber: 'JE-TRANS-01',
        entryDate: '2026-10-14',
        narration: 'Transposition entry',
        lineCount: 2,
        totalDebitGhs: 5400n,
        totalCreditGhs: 4500n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-14T10:00:00Z',
        lines: [
          {
            id: 'l1',
            journalEntryId: 'je-trans',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 5400n,
            exchangeRate: '1.0000',
            debitAmountGhs: 5400n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'l2',
            journalEntryId: 'je-trans',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 4500n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 4500n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [transpositionEntry],
        accounts,
        funds,
      });

      const r7Trans = report.findings.find((f) => f.ruleNumber === 7 && f.title.includes('Transposition'));
      expect(r7Trans).toBeDefined();
      expect(r7Trans?.description).toContain('divisible by 9');
    });
  });

  describe('Rule 8: Time Bisect detection', () => {
    it('isolates the exact date when the trial balance first went out of balance', () => {
      const balancedDay1 = createJournalEntry({
        id: 'e1',
        branchId: sampleBranchId,
        documentNumber: 'JE-D1',
        entryDate: '2026-10-01',
        narration: 'Day 1 balanced',
        createdBy: 'user-01',
        deviceId: 'dev-01',
        lines: [
          {
            id: 'l1',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 1000n,
            exchangeRate: '1.0000',
            isDebit: true,
          },
          {
            id: 'l2',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 1000n,
            exchangeRate: '1.0000',
            isDebit: false,
          },
        ],
      });

      const unbalancedDay2: JournalEntry = {
        id: 'e2',
        branchId: sampleBranchId,
        documentNumber: 'JE-D2',
        entryDate: '2026-10-04',
        narration: 'Day 2 out of balance',
        lineCount: 2,
        totalDebitGhs: 5000n,
        totalCreditGhs: 3000n,
        isReversal: false,
        createdBy: 'user-01',
        deviceId: 'dev-01',
        createdAt: '2026-10-04T10:00:00Z',
        lines: [
          {
            id: 'l3',
            journalEntryId: 'e2',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 5000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 5000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'l4',
            journalEntryId: 'e2',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 3000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 3000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [balancedDay1, unbalancedDay2],
        accounts,
        funds,
      });

      const r8Finding = report.findings.find((f) => f.ruleNumber === 8);
      expect(r8Finding).toBeDefined();
      expect(r8Finding?.title).toContain('2026-10-04');
    });
  });

  describe('Rule 10: Opening balances and imports verification', () => {
    it('verifies that opening balance entry balances on its own', () => {
      const unbalancedOpening: JournalEntry = {
        id: 'ob-1',
        branchId: sampleBranchId,
        documentNumber: 'OB-2026-001',
        entryDate: '2026-01-01',
        entryType: 'OPENING_BALANCE',
        narration: 'Opening balance migration',
        lineCount: 2,
        totalDebitGhs: 100000n,
        totalCreditGhs: 90000n,
        isReversal: false,
        createdBy: 'user-treasurer',
        deviceId: 'dev-01',
        createdAt: '2026-01-01T00:00:00Z',
        lines: [
          {
            id: 'ol-1',
            journalEntryId: 'ob-1',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: 100000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 100000n,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
          },
          {
            id: 'ol-2',
            journalEntryId: 'ob-1',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: 90000n,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: 90000n,
            roundingDifferencePesewas: 0n,
          },
        ],
      };

      const report = diagnoseLedger({
        entries: [unbalancedOpening],
        accounts,
        funds,
      });

      const r10Finding = report.findings.find((f) => f.ruleNumber === 10);
      expect(r10Finding).toBeDefined();
      expect(r10Finding?.severity).toBe('ERROR');
      expect(r10Finding?.title).toContain('Opening Balance Entry Does Not Balance');
    });
  });
});
