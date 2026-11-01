/**
 * Budget Domain Types.
 * Annual and quarterly departmental budgets, allocations, revisions, and utilization metrics.
 */

export interface BudgetLine {
  readonly id: string;
  readonly budgetId: string;
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly category: 'INCOME' | 'EXPENSE';
  readonly annualAmountPesewas: bigint;
  readonly quarterlyAmountsPesewas: readonly [bigint, bigint, bigint, bigint];
  readonly notes?: string;
}

export interface BudgetRevisionChange {
  readonly accountCode: string;
  readonly fromPesewas: bigint;
  readonly toPesewas: bigint;
}

export interface BudgetRevision {
  readonly id: string;
  readonly budgetId: string;
  readonly revisionNumber: number;
  readonly reason: string;
  readonly requestedBy: string;
  readonly authorizedBy: string;
  readonly revisionDate: string;
  readonly changes: readonly BudgetRevisionChange[];
}

export interface Budget {
  readonly id: string;
  readonly branchId: string;
  readonly year: number;
  readonly fundId: string;
  readonly fundName: string;
  readonly title: string;
  readonly status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly lines: readonly BudgetLine[];
  readonly totalIncomeBudgetPesewas: bigint;
  readonly totalExpenseBudgetPesewas: bigint;
  readonly projectedSurplusPesewas: bigint;
  readonly revisions: readonly BudgetRevision[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BudgetUtilization {
  readonly accountCode: string;
  readonly accountName: string;
  readonly budgetPesewas: bigint;
  readonly actualPesewas: bigint;
  readonly remainingPesewas: bigint;
  readonly utilizationPercentage: number;
  readonly isOverBudget: boolean;
}
