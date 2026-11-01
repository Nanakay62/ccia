import { describe, it, expect } from 'vitest';
import {
  generateDemoSandboxData,
  generateDemoOpenItems,
  calculateTrialBalance,
  diagnoseLedger,
  type Account,
  type Fund,
  type AccountingPeriod,
  type ExchangeRate,
} from '../src/index.js';

describe('Section 5: Demo Mode Sandbox Data & Open Items Verification', () => {
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

  it('generates the open items waiting for action per Section 5.4', () => {
    const { pendingRequisitions, unsignedCountingSheet, roundingDiscrepancyEntry } = generateDemoOpenItems(branchId);

    // 1. Two pending requisitions waiting for approval
    expect(pendingRequisitions.length).toBe(2);
    expect(pendingRequisitions[0]!.reqNumber).toBe('REQ-DEMO-001');
    expect(pendingRequisitions[0]!.purpose).toContain('diesel for Sunday service standby generator');
    expect(pendingRequisitions[0]!.estimatedAmountPesewas).toBe(85000n);
    expect(pendingRequisitions[0]!.status).toBe('PENDING');

    expect(pendingRequisitions[1]!.reqNumber).toBe('REQ-DEMO-002');
    expect(pendingRequisitions[1]!.purpose).toContain('Sunday School quarter 4 activity workbooks');
    expect(pendingRequisitions[1]!.estimatedAmountPesewas).toBe(42000n);
    expect(pendingRequisitions[1]!.status).toBe('PENDING');

    // 2. One unsigned counting sheet from last Sunday
    expect(unsignedCountingSheet.sheetNumber).toBe('CS-2026-043');
    expect(unsignedCountingSheet.serviceDate).toBe('2026-10-26');
    expect(unsignedCountingSheet.status).toBe('DRAFT');
    expect(unsignedCountingSheet.firstCounterName).toContain('Counter A');
    expect(unsignedCountingSheet.secondCounterId).toBe('');
    expect(unsignedCountingSheet.grandTotalGhsPesewas).toBe(845000n); // GHS 8,450.00

    // 3. Deliberate 20-pesewa diagnostic rounding discrepancy
    expect(roundingDiscrepancyEntry.documentNumber).toBe('JE-2026-ROUNDING');
    expect(roundingDiscrepancyEntry.totalDebitGhs).toBe(150020n);
    expect(roundingDiscrepancyEntry.totalCreditGhs).toBe(150000n);
    expect(roundingDiscrepancyEntry.totalDebitGhs - roundingDiscrepancyEntry.totalCreditGhs).toBe(20n);
  });

  it('generates complete sandbox dataset and detects the 20p rounding discrepancy in Trial Balance Doctor', () => {
    const sandbox = generateDemoSandboxData(branchId);

    expect(sandbox.members.length).toBe(300);
    expect(sandbox.countingSheets.length).toBe(27); // 1 open + 26 posted
    expect(sandbox.entries.length).toBe(39); // 1 discrepancy + 38 balanced
    expect(sandbox.requisitions.length).toBe(3); // 2 pending + 1 approved
    expect(sandbox.vendors.length).toBe(4);
    expect(sandbox.vouchers.length).toBe(1);

    // Trial balance should detect the 20-pesewa difference
    const tb = calculateTrialBalance(sandbox.entries, accounts, funds);
    expect(tb.isBalanced).toBe(false);
    expect(tb.differenceGhs).toBe(20n);

    // Doctor diagnostic run should identify the unbalanced entry
    const doctor = diagnoseLedger({
      entries: sandbox.entries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });

    expect(doctor.isClean).toBe(false);
    expect(doctor.totalDifferenceGhs).toBe(20n);
    expect(doctor.findings.some((f) => f.evidence.documentNumbers?.includes('JE-2026-ROUNDING'))).toBe(true);
  });
});
