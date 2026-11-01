import { describe, it, expect } from 'vitest';
import {
  generate300Members,
  generate6MonthsLedger,
  calculateTrialBalance,
  diagnoseLedger,
  type Account,
  type Fund,
  type AccountingPeriod,
  type ExchangeRate,
} from '../src/index.js';

describe('Phase 8: Demo Mode Dataset Verification (300 Members & 6 Months Transactions)', () => {
  const branchId = '00000000-0000-0000-0000-000000000001';

  const accounts: Account[] = [
    { id: 'acct-1010', code: '1010', name: 'Cash on Hand (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-1020', code: '1020', name: 'Cash on Hand (USD)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'USD', isActive: true },
    { id: 'acct-1030', code: '1030', name: 'Bank Account (GHS)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-1050', code: '1050', name: 'Mobile Money (MoMo)', type: 'ASSET', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-2020', code: '2020', name: 'SSNIT Payable', type: 'LIABILITY', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-2030', code: '2030', name: 'PAYE Tax Payable', type: 'LIABILITY', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4010', code: '4010', name: 'Tithes', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4020', code: '4020', name: 'General Offerings', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4030', code: '4030', name: 'Special Offerings', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4040', code: '4040', name: 'Building Pledges', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-4050', code: '4050', name: 'Welfare Offering', type: 'INCOME', normalBalance: 'CREDIT', currency: 'GHS', isActive: true },
    { id: 'acct-5010', code: '5010', name: 'Salaries and Allowances', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
    { id: 'acct-5020', code: '5020', name: 'Utilities', type: 'EXPENSE', normalBalance: 'DEBIT', currency: 'GHS', isActive: true },
  ];

  const funds: Fund[] = [
    { id: 'fund-gen', code: 'GEN', name: 'General Fund', type: 'UNRESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-bld', code: 'BLD', name: 'Building Fund', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-mis', code: 'MIS', name: 'Missions & Outreach', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
    { id: 'fund-wel', code: 'WEL', name: 'Welfare Fund', type: 'RESTRICTED', balancePesewas: 0n, isActive: true },
  ];

  const periods: AccountingPeriod[] = [
    { id: 'p-5', year: 2026, month: 5, isClosed: true },
    { id: 'p-6', year: 2026, month: 6, isClosed: true },
    { id: 'p-7', year: 2026, month: 7, isClosed: true },
    { id: 'p-8', year: 2026, month: 8, isClosed: true },
    { id: 'p-9', year: 2026, month: 9, isClosed: true },
    { id: 'p-10', year: 2026, month: 10, isClosed: false },
  ];

  const exchangeRates: ExchangeRate[] = [
    { id: 'fx-1', date: '2026-05-01', fromCurrency: 'USD', toCurrency: 'GHS', rate: '15.5000' },
  ];

  it('generates 300 unique Ghanaian members with valid envelope numbers', () => {
    const members = generate300Members(branchId);

    expect(members.length).toBe(300);

    // Verify unique IDs and envelope numbers
    const envSet = new Set(members.map((m) => m.envelopeNumber));
    expect(envSet.size).toBe(300);

    // Verify first and last members
    expect(members[0]!.envelopeNumber).toBe('ENV-001');
    expect(members[299]!.envelopeNumber).toBe('ENV-300');

    // Verify authentic Ghanaian names
    expect(members.some((m) => m.fullName.includes('Mensah'))).toBe(true);
    expect(members.some((m) => m.fullName.includes('Appiah'))).toBe(true);
    expect(members.some((m) => m.fullName.includes('Osei'))).toBe(true);
  });

  it('generates 6 months of weekly services and monthly expenses that balance perfectly', () => {
    const members = generate300Members(branchId);
    const dataset = generate6MonthsLedger(branchId, members);

    // 26 weekly Sunday entries + 6 monthly payroll + 6 monthly utilities = 38 entries
    expect(dataset.entries.length).toBe(38);
    expect(dataset.countingSheets.length).toBe(26);
    expect(dataset.givingRecords.length).toBe(130);
    expect(dataset.pledges.length).toBe(8);

    // Verify every single entry balances in base currency
    for (const entry of dataset.entries) {
      expect(entry.totalDebitGhs).toBe(entry.totalCreditGhs);
    }

    // Verify Trial Balance calculation across 6 months
    const tb = calculateTrialBalance(dataset.entries, accounts, funds);
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebitsGhs).toBe(tb.totalCreditsGhs);
    expect(tb.differenceGhs).toBe(0n);

    // Verify Trial Balance Doctor confirms clean books
    const doctor = diagnoseLedger({
      entries: dataset.entries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });

    expect(doctor.isClean).toBe(true);
    expect(doctor.totalDifferenceGhs).toBe(0n);
  });
});
