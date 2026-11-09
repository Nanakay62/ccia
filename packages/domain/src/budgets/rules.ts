/**
 * Budget Business Rules and Calculators.
 * Exact integer math, quarterly distribution, revision tracking, and utilization analysis.
 */

import type { Budget, BudgetLine, BudgetRevision, BudgetUtilization } from './types.js';

export interface CreateBudgetLineInput {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly category: 'INCOME' | 'EXPENSE';
  readonly annualAmountPesewas: bigint;
  readonly notes?: string;
}

export interface CreateBudgetInput {
  readonly id: string;
  readonly branchId: string;
  readonly year: number;
  readonly fundId: string;
  readonly fundName: string;
  readonly title: string;
  readonly lines: readonly CreateBudgetLineInput[];
  readonly approvedBy?: string;
}

/**
 * Distributes an annual budget amount into 4 equal quarters with Banker's Rounding,
 * assigning any 1-pesewa division remainder to Q4.
 */
export function distributeQuarterlyAmounts(annualAmount: bigint): [bigint, bigint, bigint, bigint] {
  if (annualAmount === 0n) return [0n, 0n, 0n, 0n];

  const baseQuarter = annualAmount / 4n;
  const remainder = annualAmount % 4n;

  return [
    baseQuarter,
    baseQuarter,
    baseQuarter,
    baseQuarter + remainder,
  ];
}

/**
 * Creates a validated church budget with quarterly distributions.
 */
export function createBudget(input: CreateBudgetInput): Budget {
  if (input.year < 2000 || input.year > 2100) {
    throw new Error(`Invalid budget year: ${input.year}`);
  }
  if (!input.title.trim()) {
    throw new Error('Budget title is required.');
  }

  let totalIncome = 0n;
  let totalExpense = 0n;

  const lines: BudgetLine[] = input.lines.map((l, idx) => {
    if (l.annualAmountPesewas < 0n) {
      throw new Error(`Budget amount cannot be negative for account ${l.accountCode}`);
    }

    if (l.category === 'INCOME') {
      totalIncome += l.annualAmountPesewas;
    } else {
      totalExpense += l.annualAmountPesewas;
    }

    const quarterlyAmountsPesewas = distributeQuarterlyAmounts(l.annualAmountPesewas);

    return {
      id: `${input.id}-line-${idx + 1}`,
      budgetId: input.id,
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      category: l.category,
      annualAmountPesewas: l.annualAmountPesewas,
      quarterlyAmountsPesewas,
      notes: l.notes,
    };
  });

  const now = new Date().toISOString();

  return {
    id: input.id,
    branchId: input.branchId,
    year: input.year,
    fundId: input.fundId,
    fundName: input.fundName,
    title: input.title.trim(),
    status: input.approvedBy ? 'APPROVED' : 'DRAFT',
    approvedBy: input.approvedBy,
    approvedAt: input.approvedBy ? now : undefined,
    lines,
    totalIncomeBudgetPesewas: totalIncome,
    totalExpenseBudgetPesewas: totalExpense,
    projectedSurplusPesewas: totalIncome - totalExpense,
    revisions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface ReviseBudgetInput {
  readonly revisionId: string;
  readonly reason: string;
  readonly requestedBy: string;
  readonly authorizedBy: string;
  readonly updatedLines: readonly { readonly accountCode: string; readonly newAmountPesewas: bigint }[];
}

/**
 * Applies a revision to an approved budget, recording full audit history.
 */
export function reviseBudget(budget: Budget, input: ReviseBudgetInput): Budget {
  if (!input.reason.trim()) {
    throw new Error('Revision reason is required.');
  }
  if (!input.authorizedBy.trim()) {
    throw new Error('Revision must be authorized by a church officer.');
  }

  const changes: { accountCode: string; fromPesewas: bigint; toPesewas: bigint }[] = [];
  const lineMap = new Map(budget.lines.map((l) => [l.accountCode, l]));

  for (const update of input.updatedLines) {
    if (update.newAmountPesewas < 0n) {
      throw new Error(`Revised budget amount cannot be negative for account ${update.accountCode}`);
    }

    const existing = lineMap.get(update.accountCode);
    if (!existing) continue;

    if (existing.annualAmountPesewas !== update.newAmountPesewas) {
      changes.push({
        accountCode: update.accountCode,
        fromPesewas: existing.annualAmountPesewas,
        toPesewas: update.newAmountPesewas,
      });

      const updatedQuarterly = distributeQuarterlyAmounts(update.newAmountPesewas);
      lineMap.set(update.accountCode, {
        ...existing,
        annualAmountPesewas: update.newAmountPesewas,
        quarterlyAmountsPesewas: updatedQuarterly,
      });
    }
  }

  if (changes.length === 0) {
    return budget; // No change
  }

  const now = new Date().toISOString();
  const revisionNumber = budget.revisions.length + 1;

  const revision: BudgetRevision = {
    id: input.revisionId,
    budgetId: budget.id,
    revisionNumber,
    reason: input.reason.trim(),
    requestedBy: input.requestedBy,
    authorizedBy: input.authorizedBy,
    revisionDate: now.substring(0, 10),
    changes,
  };

  const newLines = Array.from(lineMap.values());
  let totalIncome = 0n;
  let totalExpense = 0n;

  for (const l of newLines) {
    if (l.category === 'INCOME') totalIncome += l.annualAmountPesewas;
    else totalExpense += l.annualAmountPesewas;
  }

  return {
    ...budget,
    lines: newLines,
    totalIncomeBudgetPesewas: totalIncome,
    totalExpenseBudgetPesewas: totalExpense,
    projectedSurplusPesewas: totalIncome - totalExpense,
    revisions: [...budget.revisions, revision],
    updatedAt: now,
  };
}

/**
 * Calculates budget utilization and detects overdraft / overspending risks.
 */
export function calculateBudgetUtilization(
  line: BudgetLine,
  actualPesewas: bigint
): BudgetUtilization {
  const remainingPesewas = line.annualAmountPesewas > actualPesewas
    ? line.annualAmountPesewas - actualPesewas
    : 0n;

  let utilizationPercentage = 0;
  if (line.annualAmountPesewas > 0n) {
    utilizationPercentage =
      Number((actualPesewas * 10000n) / line.annualAmountPesewas) / 100;
  }

  const isOverBudget =
    line.category === 'EXPENSE'
      ? actualPesewas > line.annualAmountPesewas
      : false;

  return {
    accountCode: line.accountCode,
    accountName: line.accountName,
    budgetPesewas: line.annualAmountPesewas,
    actualPesewas,
    remainingPesewas,
    utilizationPercentage,
    isOverBudget,
  };
}
