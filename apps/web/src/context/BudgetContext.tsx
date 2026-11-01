/**
 * BudgetContext.
 * Coordinates annual church budgets, departmental quarterly distributions,
 * revisions audit trail, and real-time expense utilization monitoring.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Budget, BudgetUtilization } from '@church/domain';
import {
  createBudget,
  reviseBudget,
  calculateBudgetUtilization,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';

export interface BudgetContextValue {
  readonly budgets: readonly Budget[];
  readonly activeBudget: Budget | null;
  readonly setActiveBudgetId: (id: string | null) => void;

  readonly createNewBudget: (input: {
    readonly year: number;
    readonly fundId: string;
    readonly fundName: string;
    readonly title: string;
    readonly lines: readonly {
      readonly accountId: string;
      readonly accountCode: string;
      readonly accountName: string;
      readonly category: 'INCOME' | 'EXPENSE';
      readonly annualAmountPesewas: bigint;
      readonly notes?: string;
    }[];
  }) => Budget;

  readonly applyRevision: (input: {
    readonly budgetId: string;
    readonly reason: string;
    readonly updatedLines: readonly { readonly accountCode: string; readonly newAmountPesewas: bigint }[];
  }) => Budget;

  readonly getUtilization: (budgetId?: string) => readonly BudgetUtilization[];
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export const INITIAL_BUDGET: Budget = createBudget({
  id: 'bdg-2026',
  branchId: '00000000-0000-0000-0000-000000000001',
  year: 2026,
  fundId: 'fund-gen',
  fundName: 'General Fund',
  title: 'Accra Central Grace Chapel — Approved 2026 Operating Budget',
  approvedBy: 'Elder Kofi Mensah (Treasurer)',
  lines: [
    { accountId: 'acct-4010', accountCode: '4010', accountName: 'Tithes', category: 'INCOME', annualAmountPesewas: 18000000n, notes: 'Target based on 300 active giving members' },
    { accountId: 'acct-4020', accountCode: '4020', accountName: 'General Offerings', category: 'INCOME', annualAmountPesewas: 7200000n, notes: 'Sunday 1st & 2nd services' },
    { accountId: 'acct-4030', accountCode: '4030', accountName: 'Special Offerings', category: 'INCOME', annualAmountPesewas: 3000000n, notes: 'Easter, Harvest & Thanksgiving' },
    { accountId: 'acct-4040', accountCode: '4040', accountName: 'Pledge Payments', category: 'INCOME', annualAmountPesewas: 12000000n, notes: 'Auditorium project pledges' },
    { accountId: 'acct-5010', accountCode: '5010', accountName: 'Salaries and Allowances', category: 'EXPENSE', annualAmountPesewas: 9960000n, notes: 'Full pastoral & administrative team' },
    { accountId: 'acct-5020', accountCode: '5020', accountName: 'Utilities', category: 'EXPENSE', annualAmountPesewas: 2400000n, notes: 'ECG electricity & Ghana Water' },
    { accountId: 'acct-5030', accountCode: '5030', accountName: 'Maintenance & Repairs', category: 'EXPENSE', annualAmountPesewas: 1800000n, notes: 'Generator servicing & facility upkeep' },
    { accountId: 'acct-5040', accountCode: '5040', accountName: 'Outreach and Missions', category: 'EXPENSE', annualAmountPesewas: 3600000n, notes: 'Rural church planting support' },
    { accountId: 'acct-5050', accountCode: '5050', accountName: 'Welfare Support', category: 'EXPENSE', annualAmountPesewas: 1800000n, notes: 'Needy members benevolence fund' },
  ],
});

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { entries, accounts } = useLedger();
  const { enqueueItem } = useSync();

  const [budgets, setBudgets] = useState<Budget[]>([INITIAL_BUDGET]);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>('bdg-2026');

  const activeBudget = useMemo(() => {
    if (!activeBudgetId) return budgets[0] || null;
    return budgets.find((b) => b.id === activeBudgetId) || null;
  }, [activeBudgetId, budgets]);

  const createNewBudget = useCallback(
    (input: {
      year: number;
      fundId: string;
      fundName: string;
      title: string;
      lines: readonly {
        accountId: string;
        accountCode: string;
        accountName: string;
        category: 'INCOME' | 'EXPENSE';
        annualAmountPesewas: bigint;
        notes?: string;
      }[];
    }): Budget => {
      const budgetId = `bdg-${input.year}-${Date.now()}`;
      const newBudget = createBudget({
        id: budgetId,
        branchId: currentUser.branchId,
        year: input.year,
        fundId: input.fundId,
        fundName: input.fundName,
        title: input.title,
        lines: input.lines,
        approvedBy: `${currentUser.fullName} (${currentUser.role})`,
      });

      setBudgets((prev) => [newBudget, ...prev]);
      setActiveBudgetId(newBudget.id);

      enqueueItem({
        entityType: 'BUDGET',
        entityId: newBudget.id,
        action: 'UPDATE_BUDGET',
        payload: newBudget,
        deviceId: currentUser.deviceId,
      });

      return newBudget;
    },
    [currentUser, enqueueItem]
  );

  const applyRevision = useCallback(
    (input: {
      budgetId: string;
      reason: string;
      updatedLines: readonly { readonly accountCode: string; readonly newAmountPesewas: bigint }[];
    }): Budget => {
      const budget = budgets.find((b) => b.id === input.budgetId);
      if (!budget) throw new Error('Budget not found.');

      const revisionId = `rev-${Date.now()}`;
      const revised = reviseBudget(budget, {
        revisionId,
        reason: input.reason,
        requestedBy: currentUser.fullName,
        authorizedBy: `${currentUser.fullName} (${currentUser.role})`,
        updatedLines: input.updatedLines,
      });

      setBudgets((prev) => prev.map((b) => (b.id === revised.id ? revised : b)));

      enqueueItem({
        entityType: 'BUDGET',
        entityId: revised.id,
        action: 'UPDATE_BUDGET',
        payload: revised,
        deviceId: currentUser.deviceId,
      });

      return revised;
    },
    [budgets, currentUser, enqueueItem]
  );

  const getUtilization = useCallback(
    (budgetId?: string): readonly BudgetUtilization[] => {
      const targetBudget = budgetId
        ? budgets.find((b) => b.id === budgetId)
        : activeBudget;

      if (!targetBudget) return [];

      // Calculate actual spending to date from entries
      const actualsByCode = new Map<string, bigint>();
      for (const entry of entries) {
        for (const line of entry.lines) {
          const acct = accounts.find((a) => a.id === line.accountId);
          if (!acct) continue;

          const cur = actualsByCode.get(acct.code) || 0n;
          if (acct.type === 'Expense') {
            actualsByCode.set(acct.code, cur + (line.debitAmountGhs - line.creditAmountGhs));
          } else if (acct.type === 'Income') {
            actualsByCode.set(acct.code, cur + (line.creditAmountGhs - line.debitAmountGhs));
          }
        }
      }

      return targetBudget.lines.map((line) => {
        const actual = actualsByCode.get(line.accountCode) || 0n;
        return calculateBudgetUtilization(line, actual);
      });
    },
    [budgets, activeBudget, entries, accounts]
  );

  const value = useMemo(
    () => ({
      budgets,
      activeBudget,
      setActiveBudgetId,
      createNewBudget,
      applyRevision,
      getUtilization,
    }),
    [budgets, activeBudget, createNewBudget, applyRevision, getUtilization]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
};

export function useBudget(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
