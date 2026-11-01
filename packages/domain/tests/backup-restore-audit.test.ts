import { describe, it, expect } from 'vitest';
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  createJournalEntry,
  calculateTrialBalance,
  diagnoseLedger,
  type Account,
  type Fund,
  type AccountingPeriod,
  type ExchangeRate,
  type JournalEntry,
} from '../src/index.js';

describe('Phase 8: Encrypted Backup & Restore Audit Test', () => {
  const accounts: Account[] = [
    { id: 'acct-1010', code: '1010', name: 'Cash on Hand (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-1030', code: '1030', name: 'Bank Account (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-4010', code: '4010', name: 'Tithes', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4020', code: '4020', name: 'General Offerings', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-5010', code: '5010', name: 'Salaries and Allowances', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
  ];

  const funds: Fund[] = [
    { id: 'fund-gen', code: 'GEN', name: 'General Fund', type: 'UNRESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-bld', code: 'BLD', name: 'Building Fund', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
  ];

  const periods: AccountingPeriod[] = [
    { id: 'per-2026-10', year: 2026, month: 10, isClosed: false },
  ];

  const exchangeRates: ExchangeRate[] = [
    { id: 'fx-1', date: '2026-10-01', fromCurrency: 'USD', toCurrency: 'GHS', rate: '15.5000' },
  ];

  const passphrase = 'AccraCommunity@2026!';

  it('creates an encrypted backup, corrupts local books, restores from backup, and verifies TB Doctor is 100% green', async () => {
    // 1. Establish balanced initial ledger
    const entry1 = createJournalEntry({
      id: 'je-init-1',
      branchId: '00000000-0000-0000-0000-000000000001',
      documentNumber: 'JE-BK-0001',
      entryDate: '2026-10-18',
      narration: 'Sunday 1st Service Tithes',
      createdBy: 'user-treasurer',
      deviceId: 'DEV-TR-01',
      lines: [
        { id: 'l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 500000n, exchangeRate: '1.0000', isDebit: true },
        { id: 'l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 500000n, exchangeRate: '1.0000', isDebit: false },
      ],
    });

    const entry2 = createJournalEntry({
      id: 'je-init-2',
      branchId: '00000000-0000-0000-0000-000000000001',
      documentNumber: 'JE-BK-0002',
      entryDate: '2026-10-19',
      narration: 'Staff Advance & Stipends',
      createdBy: 'user-treasurer',
      deviceId: 'DEV-TR-01',
      lines: [
        { id: 'l3', accountId: 'acct-5010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 200000n, exchangeRate: '1.0000', isDebit: true },
        { id: 'l4', accountId: 'acct-1030', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 200000n, exchangeRate: '1.0000', isDebit: false },
      ],
    });

    const initialEntries = [entry1, entry2];

    // Verify initial ledger is 100% green and balanced
    const initialDoctor = diagnoseLedger({
      entries: initialEntries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });
    expect(initialDoctor.isClean).toBe(true);
    expect(initialDoctor.totalDifferenceGhs).toBe(0n);
    expect(initialDoctor.findings.length).toBe(0);

    // 2. Export Encrypted Backup Bundle
    const backupBundle = await createEncryptedBackup({
      branchId: '00000000-0000-0000-0000-000000000001',
      branchName: 'Accra Central Branch',
      exportedBy: 'Kofi Mensah (Treasurer)',
      passphrase,
      accounts,
      funds,
      periods,
      exchangeRates,
      entries: initialEntries,
    });

    expect(backupBundle.metadata.version).toBe(1);
    expect(backupBundle.metadata.entryCount).toBe(2);
    expect(backupBundle.ciphertext).toBeDefined();

    // 3. Corrupt local ledger: flip credit to debit (Rule 7 sign inversion corruption)
    const corruptedEntries: JournalEntry[] = [
      {
        ...entry1,
        lines: [
          entry1.lines[0]!,
          { ...entry1.lines[1]!, creditAmountGhs: 0n, debitAmountGhs: 500000n }, // Inverted to debit
        ],
        totalCreditGhs: 0n,
        totalDebitGhs: 1000000n,
      },
      entry2,
    ];

    // 4. Verify Trial Balance Doctor detects corruption and goes RED
    const corruptedDoctor = diagnoseLedger({
      entries: corruptedEntries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });

    expect(corruptedDoctor.isClean).toBe(false);
    expect(corruptedDoctor.totalDifferenceGhs).not.toBe(0n);
    expect(corruptedDoctor.findings.length).toBeGreaterThan(0);
    expect(corruptedDoctor.findings.some((f) => f.ruleNumber === 7 || f.ruleNumber === 2)).toBe(true);

    // 5. Restore from Encrypted Backup
    const restoreResult = await restoreEncryptedBackup(
      backupBundle,
      passphrase
    );

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.isTrialBalanceHealthy).toBe(true);
    expect(restoreResult.data.accounts.length).toBe(accounts.length);
    expect(restoreResult.data.funds.length).toBe(funds.length);
    expect(restoreResult.data.entries.length).toBe(2);

    // 6. Verify Restored Ledger is 100% GREEN and healthy
    const restoredDoctor = diagnoseLedger({
      entries: restoreResult.data.entries,
      accounts: restoreResult.data.accounts,
      funds: restoreResult.data.funds,
      periods: restoreResult.data.periods,
      exchangeRates: restoreResult.data.exchangeRates,
    });

    expect(restoredDoctor.isClean).toBe(true);
    expect(restoredDoctor.totalDifferenceGhs).toBe(0n);
    expect(restoredDoctor.findings.length).toBe(0);

    const restoredTb = calculateTrialBalance(
      restoreResult.data.entries,
      restoreResult.data.accounts,
      restoreResult.data.funds
    );
    expect(restoredTb.isBalanced).toBe(true);
    expect(restoredTb.totalDebitsGhs).toBe(restoredTb.totalCreditsGhs);
  });
});
