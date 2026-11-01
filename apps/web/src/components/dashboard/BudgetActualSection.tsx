import React from 'react';
import { PieChart, ArrowRight } from 'lucide-react';
import { MoneyCell } from '../ui/MoneyCell.js';
import { EmptyState } from '../ui/EmptyState.js';

export interface BudgetLineItem {
  accountCode: string;
  accountName: string;
  category: 'INCOME' | 'EXPENSE';
  budgetGhs: number;
  actualGhs: number;
  varianceGhs: number;
  percentageUsed: number;
}

interface BudgetActualSectionProps {
  lines: BudgetLineItem[];
  currency: 'GHS' | 'USD';
  onNavigateToBudgets?: () => void;
}

export const BudgetActualSection: React.FC<BudgetActualSectionProps> = ({
  lines,
  currency,
  onNavigateToBudgets,
}) => {
  if (!lines || lines.length === 0) {
    return (
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-6">
        <EmptyState
          message="No active operating budget found. Establish annual church income targets and departmental expenditure ceilings to monitor burn rate."
          actionLabel="Open Budget Manager"
          onAction={onNavigateToBudgets}
        />
      </div>
    );
  }

  // Focus on top expense lines for executive budget control
  const expenseLines = lines.filter((l) => l.category === 'EXPENSE').slice(0, 6);

  return (
    <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Budget against Actual (Expenses)
          </h2>
        </div>
        {onNavigateToBudgets && (
          <button
            onClick={onNavigateToBudgets}
            className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            <span>All Budgets</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-secondary)] bg-[var(--surface-subtle)]">
              <th className="py-2.5 px-4 font-normal">Account Line</th>
              <th className="py-2.5 px-4 text-right font-normal">Budget ({currency})</th>
              <th className="py-2.5 px-4 text-right font-normal">Actual Spent</th>
              <th className="py-2.5 px-4 text-right font-normal">Remaining</th>
              <th className="py-2.5 px-4 font-normal min-w-[140px]">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13px]">
            {expenseLines.map((line) => {
              const budgetAmount = currency === 'GHS' ? line.budgetGhs : line.budgetGhs / 15.5;
              const actualAmount = currency === 'GHS' ? line.actualGhs : line.actualGhs / 15.5;
              const varianceAmount = currency === 'GHS' ? line.varianceGhs : line.varianceGhs / 15.5;

              // Color codes: Normal < 90%, Amber >= 90%, Red >= 100%
              let statusLabel = 'On track';
              let statusColor = 'text-[var(--text-secondary)]';

              if (line.percentageUsed >= 100) {
                statusLabel = 'Over budget';
                statusColor = 'text-[var(--status-red)] font-semibold';
              } else if (line.percentageUsed >= 90) {
                statusLabel = 'Near ceiling (90%)';
                statusColor = 'text-[var(--status-amber)] font-medium';
              }

              return (
                <tr key={line.accountCode} className="hover:bg-[var(--surface-subtle)] transition">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[var(--text-primary)]">{line.accountName}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">
                      {line.accountCode}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                    <MoneyCell amountMajor={budgetAmount} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-medium text-[var(--text-primary)]">
                    <MoneyCell amountMajor={actualAmount} currency={currency} />
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right tabular-nums text-xs ${
                      varianceAmount < 0 ? 'text-[var(--status-red)] font-medium' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <MoneyCell amountMajor={varianceAmount} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={statusColor}>{statusLabel}</span>
                        <span className="tabular-nums font-medium text-[var(--text-primary)]">
                          {line.percentageUsed.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden relative">
                        {/* 90% and 100% threshold markers */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[var(--status-amber)] z-10 opacity-75"
                          style={{ left: '90%' }}
                          title="90% threshold"
                        />
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, line.percentageUsed)}%`,
                            backgroundColor:
                              line.percentageUsed >= 100
                                ? 'var(--status-red)'
                                : line.percentageUsed >= 90
                                ? 'var(--status-amber)'
                                : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
