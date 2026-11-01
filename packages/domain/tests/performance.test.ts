import { describe, it, expect } from 'vitest';
import {
  calculateTrialBalance,
  diagnoseLedger,
  createJournalEntry,
  computeJournalEntrySignature,
  scanLedgerForTampering,
  type Account,
  type Fund,
  type AccountingPeriod,
  type ExchangeRate,
  type JournalEntry,
} from '../src/index.js';

describe('Phase 8: Offline Performance Stress Test & Benchmarks', () => {
  const accounts: Account[] = [
    { id: 'acct-1010', code: '1010', name: 'Cash on Hand (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-1020', code: '1020', name: 'Cash on Hand (USD)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'USD', isActive: true },
    { id: 'acct-1030', code: '1030', name: 'Bank Account (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-1050', code: '1050', name: 'Mobile Money (MoMo)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-4010', code: '4010', name: 'Tithes', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4020', code: '4020', name: 'General Offerings', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4030', code: '4030', name: 'Special Offerings', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-5010', code: '5010', name: 'Salaries and Allowances', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-5020', code: '5020', name: 'Utilities', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-5990', code: '5990', name: 'Rounding Differences', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
  ];

  const funds: Fund[] = [
    { id: 'fund-gen', code: 'GEN', name: 'General Fund', type: 'UNRESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-bld', code: 'BLD', name: 'Building Fund', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-mis', code: 'MIS', name: 'Missions & Outreach', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-wel', code: 'WEL', name: 'Welfare Fund', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
  ];

  const periods: AccountingPeriod[] = [
    { id: 'per-2026-10', year: 2026, month: 10, isClosed: false },
  ];

  const exchangeRates: ExchangeRate[] = [
    { id: 'fx-1', date: '2026-10-01', fromCurrency: 'USD', toCurrency: 'GHS', rate: '15.5000' },
  ];

  it('generates 1,000 journal entries (3,000+ lines) and calculates Trial Balance in under 100ms', () => {
    const entryCount = 1000;
    const entries: JournalEntry[] = [];

    const startGen = performance.now();
    for (let i = 1; i <= entryCount; i++) {
      const isUsd = i % 5 === 0;
      const fundId = i % 4 === 0 ? 'fund-bld' : i % 3 === 0 ? 'fund-wel' : i % 2 === 0 ? 'fund-mis' : 'fund-gen';
      const amtPesewas = BigInt((i * 17) % 50000 + 1000); // Between 10.00 and 510.00 GHS
      // Even number of cents so rate 15.5000 (31/2) produces exact integer pesewas
      const usdAmtCents = BigInt(1000 + (i * 2));
      const ghsFromUsd = (usdAmtCents * 31n) / 2n;
      const day = String((i % 28) + 1).padStart(2, '0');

      const entry = createJournalEntry({
        id: `stress-je-${i}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: `JE-STRESS-${String(i).padStart(6, '0')}`,
        entryDate: `2026-10-${day}`,
        narration: `Stress test transaction #${i}`,
        createdBy: `user-${i % 10}`,
        deviceId: `DEV-0${(i % 5) + 1}`,
        autoBalanceRounding: true,
        roundingAccountId: 'acct-5990',
        lines: [
          {
            id: `line-${i}-1`,
            accountId: isUsd ? 'acct-1020' : i % 2 === 0 ? 'acct-1030' : 'acct-1010',
            fundId,
            originalCurrency: isUsd ? 'USD' : 'GHS',
            originalAmount: isUsd ? usdAmtCents : amtPesewas,
            exchangeRate: isUsd ? '15.5000' : '1.0000',
            isDebit: true,
            description: 'Cash Debit',
          },
          {
            id: `line-${i}-2`,
            accountId: i % 2 === 0 ? 'acct-4010' : 'acct-4020',
            fundId,
            originalCurrency: 'GHS',
            originalAmount: isUsd ? ghsFromUsd : amtPesewas,
            exchangeRate: '1.0000',
            isDebit: false,
            description: 'Income Credit',
          },
        ],
      });

      entries.push(entry);
    }
    const genTime = performance.now() - startGen;
    expect(entries.length).toBe(1000);

    // BENCHMARK: Trial Balance calculation time
    const startTb = performance.now();
    const tb = calculateTrialBalance(entries, accounts, funds);
    const tbElapsed = performance.now() - startTb;

    // Strict performance SLA from brief: Trial Balance calculation time < 100 ms
    expect(tbElapsed).toBeLessThan(100);

    // Verify accounting correctness
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebitsGhs).toBe(tb.totalCreditsGhs);
    expect(tb.differenceGhs).toBe(0n);

    // BENCHMARK: TB Doctor 10-Check sequence on 1,000 entries
    const startDoctor = performance.now();
    const doctorReport = diagnoseLedger({
      entries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });
    const doctorElapsed = performance.now() - startDoctor;

    // Doctor sequence should also complete in under 150ms
    expect(doctorElapsed).toBeLessThan(150);
    expect(doctorReport.isClean).toBe(true);
    expect(doctorReport.totalDifferenceGhs).toBe(0n);
    expect(doctorReport.findings.length).toBe(0);
  });

  it('signs and verifies 500 entries, immediately detecting injected tampering', () => {
    const signedEntries: (JournalEntry & { signature?: string })[] = [];

    for (let i = 1; i <= 500; i++) {
      const entry = createJournalEntry({
        id: `sig-entry-${i}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: `JE-SEC-${String(i).padStart(4, '0')}`,
        entryDate: '2026-10-20',
        narration: `Security entry #${i}`,
        createdBy: 'user-sec',
        deviceId: 'DEV-SEC',
        lines: [
          {
            id: `sec-l-${i}-1`,
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 10000n,
            exchangeRate: '1.0000',
            isDebit: true,
          },
          {
            id: `sec-l-${i}-2`,
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 10000n,
            exchangeRate: '1.0000',
            isDebit: false,
          },
        ],
      });

      const signature = computeJournalEntrySignature(entry);
      signedEntries.push({ ...entry, signature });
    }

    // Scan untampered ledger: should be 100% clean
    const cleanScan = scanLedgerForTampering(signedEntries);
    expect(cleanScan.clean).toBe(true);
    expect(cleanScan.tamperedEntries.length).toBe(0);

    // Inject tamper into entry #42: change credit amount from 100.00 to 150.00 GHS
    const tamperedEntry = signedEntries[41]!;
    const modifiedLines = [...tamperedEntry.lines];
    modifiedLines[1] = { ...modifiedLines[1]!, creditAmountGhs: 15000n, originalAmount: 15000n };
    signedEntries[41] = { ...tamperedEntry, lines: modifiedLines, totalCreditGhs: 15000n };

    // Scan again: should immediately detect tampering on entry #42
    const dirtyScan = scanLedgerForTampering(signedEntries);
    expect(dirtyScan.clean).toBe(false);
    expect(dirtyScan.tamperedEntries.length).toBe(1);
    expect(dirtyScan.tamperedEntries[0]!.documentNumber).toBe('JE-SEC-0042');
  });
});
