import { describe, it, expect } from 'vitest';
import {
  createBudget,
  reviseBudget,
  calculateBudgetUtilization,
  distributeQuarterlyAmounts,
} from '../src/budgets/index.js';

describe('Phase 7: Budgets Domain Rules', () => {
  it('distributes annual amounts equally into 4 quarters with 1-pesewa remainder in Q4', () => {
    // GHS 1,000.00 (100,000 pesewas) / 4 = 25,000 each
    const q1 = distributeQuarterlyAmounts(100000n);
    expect(q1).toEqual([25000n, 25000n, 25000n, 25000n]);

    // GHS 100.03 (10,003 pesewas) -> 2,500 each, remainder 3 in Q4 -> 2,503
    const q2 = distributeQuarterlyAmounts(10003n);
    expect(q2).toEqual([2500n, 2500n, 2500n, 2503n]);
    expect(q2[0] + q2[1] + q2[2] + q2[3]).toBe(10003n);
  });

  it('creates an annual church budget and calculates projected surplus', () => {
    const budget = createBudget({
      id: 'bdg-2026',
      branchId: 'b-01',
      year: 2026,
      fundId: 'fund-gen',
      fundName: 'General Fund',
      title: 'Accra Central Grace Chapel 2026 Annual Budget',
      lines: [
        { accountId: 'a-4010', accountCode: '4010', accountName: 'Tithes', category: 'INCOME', annualAmountPesewas: 18000000n }, // 180,000 GHS
        { accountId: 'a-4020', accountCode: '4020', accountName: 'Offerings', category: 'INCOME', annualAmountPesewas: 6000000n }, // 60,000 GHS
        { accountId: 'a-5010', accountCode: '5010', accountName: 'Salaries', category: 'EXPENSE', annualAmountPesewas: 10000000n }, // 100,000 GHS
        { accountId: 'a-5020', accountCode: '5020', accountName: 'Utilities', category: 'EXPENSE', annualAmountPesewas: 3000000n }, // 30,000 GHS
      ],
      approvedBy: 'Elder Kofi Mensah (Treasurer)',
    });

    expect(budget.status).toBe('APPROVED');
    expect(budget.totalIncomeBudgetPesewas).toBe(24000000n); // 240,000 GHS
    expect(budget.totalExpenseBudgetPesewas).toBe(13000000n); // 130,000 GHS
    expect(budget.projectedSurplusPesewas).toBe(11000000n); // 110,000 GHS
    expect(budget.lines.length).toBe(4);
    expect(budget.lines[0]!.quarterlyAmountsPesewas).toEqual([4500000n, 4500000n, 4500000n, 4500000n]);
  });

  it('applies a budget revision with audit history and adjusts totals', () => {
    const initialBudget = createBudget({
      id: 'bdg-2026',
      branchId: 'b-01',
      year: 2026,
      fundId: 'fund-gen',
      fundName: 'General Fund',
      title: 'Operating Budget 2026',
      lines: [
        { accountId: 'a-5020', accountCode: '5020', accountName: 'Utilities', category: 'EXPENSE', annualAmountPesewas: 3000000n },
      ],
    });

    const revisedBudget = reviseBudget(initialBudget, {
      revisionId: 'rev-01',
      reason: 'Electricity tariff increment by ECG',
      requestedBy: 'Church Administrator',
      authorizedBy: 'Treasurer',
      updatedLines: [{ accountCode: '5020', newAmountPesewas: 4000000n }], // Increase by 10,000 GHS
    });

    expect(revisedBudget.totalExpenseBudgetPesewas).toBe(4000000n);
    expect(revisedBudget.revisions.length).toBe(1);
    expect(revisedBudget.revisions[0]!.reason).toBe('Electricity tariff increment by ECG');
    expect(revisedBudget.revisions[0]!.changes[0]!.fromPesewas).toBe(3000000n);
    expect(revisedBudget.revisions[0]!.changes[0]!.toPesewas).toBe(4000000n);
  });

  it('calculates budget utilization and flags overspending', () => {
    const line = {
      id: 'l-1',
      budgetId: 'b-1',
      accountId: 'a-1',
      accountCode: '5030',
      accountName: 'Maintenance',
      category: 'EXPENSE' as const,
      annualAmountPesewas: 1000000n, // GHS 10,000.00
      quarterlyAmountsPesewas: [250000n, 250000n, 250000n, 250000n] as const,
    };

    // Under budget: GHS 6,500 spent
    const util1 = calculateBudgetUtilization(line, 650000n);
    expect(util1.utilizationPercentage).toBe(65);
    expect(util1.remainingPesewas).toBe(350000n);
    expect(util1.isOverBudget).toBe(false);

    // Over budget: GHS 11,200 spent
    const util2 = calculateBudgetUtilization(line, 1120000n);
    expect(util2.utilizationPercentage).toBe(112);
    expect(util2.remainingPesewas).toBe(0n);
    expect(util2.isOverBudget).toBe(true);
  });
});
