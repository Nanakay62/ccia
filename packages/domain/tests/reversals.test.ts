import { describe, it, expect } from 'vitest';
import {
  createJournalEntry,
  createReversalEntry,
  calculateTrialBalance,
  type Account,
  type Fund,
} from '../src/index.js';

describe('Append-Only Reversals Module', () => {
  const sampleBranchId = '00000000-0000-0000-0000-000000000001';

  const accounts: Account[] = [
    {
      id: 'acct-1010',
      branchId: sampleBranchId,
      code: '1010',
      name: 'Cash on Hand',
      type: 'Asset',
      currency: 'GHS',
      isBankOrCash: true,
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

  it('creates an exact mirror reversal that nets the ledger balance to zero', () => {
    // 1. Post original entry: GHS 800.00 for utilities
    const original = createJournalEntry({
      id: 'je-orig-100',
      branchId: sampleBranchId,
      documentNumber: 'JE-TR-000100',
      entryDate: '2026-10-12',
      narration: 'Erroneous electricity bill payment',
      createdBy: 'user-treasurer',
      deviceId: 'dev-01',
      lines: [
        {
          id: 'line-1',
          accountId: 'acct-5020',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 80000n, // GHS 800.00
          exchangeRate: '1.0000',
          isDebit: true,
        },
        {
          id: 'line-2',
          accountId: 'acct-1010',
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: 80000n,
          exchangeRate: '1.0000',
          isDebit: false,
        },
      ],
    });

    // 2. Create linked reversal entry
    const reversal = createReversalEntry({
      reversalEntryId: 'je-rev-100',
      originalEntry: original,
      documentNumber: 'JE-TR-000101',
      reversalDate: '2026-10-14',
      reason: 'Incorrect meter number charged. Reversing as instructed.',
      reversedBy: 'user-treasurer',
      deviceId: 'dev-01',
    });

    expect(reversal.isReversal).toBe(true);
    expect(reversal.reversalOfId).toBe(original.id);
    expect(reversal.entryType).toBe('REVERSAL');
    expect(reversal.lines).toHaveLength(2);

    // Verify flipped lines
    // Original line 1 was Dr acct-5020 80,000 -> Reversal line 1 must be Cr acct-5020 80,000
    const revL1 = reversal.lines[0]!;
    expect(revL1.accountId).toBe('acct-5020');
    expect(revL1.debitAmountGhs).toBe(0n);
    expect(revL1.creditAmountGhs).toBe(80000n);

    // Original line 2 was Cr acct-1010 80,000 -> Reversal line 2 must be Dr acct-1010 80,000
    const revL2 = reversal.lines[1]!;
    expect(revL2.accountId).toBe('acct-1010');
    expect(revL2.debitAmountGhs).toBe(80000n);
    expect(revL2.creditAmountGhs).toBe(0n);

    // 3. Compute trial balance across both entries: net balance must be strictly 0 for all accounts!
    const tb = calculateTrialBalance([original, reversal], accounts, funds);

    expect(tb.isBalanced).toBe(true);
    expect(tb.differenceGhs).toBe(0n);

    for (const acct of tb.accounts) {
      expect(acct.netBalanceGhs).toBe(0n);
    }
    for (const f of tb.fundBalances) {
      expect(f.netBalanceGhs).toBe(0n);
    }
  });
});
