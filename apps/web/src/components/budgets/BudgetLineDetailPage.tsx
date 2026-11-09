import React, { useMemo } from 'react';
import { useBudget } from '../../context/BudgetContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../config/churchSettings.js';

export interface BudgetLineDetailPageProps {
  id: string; // accountCode or accountId
}

export const BudgetLineDetailPage: React.FC<BudgetLineDetailPageProps> = ({ id }) => {
  const { activeBudget, getUtilization } = useBudget();
  const { entries, funds } = useLedger();
  const { navigate, goBack } = useRouter();

  const line = activeBudget?.lines.find(
    (l) => l.accountCode === id || l.accountId === id || l.accountName === id
  );

  const utilizationList = useMemo(() => getUtilization(), [getUtilization]);
  const lineUtil = utilizationList.find((u) => u.accountCode === line?.accountCode);

  // Posted transactions for this account line
  const transactions = useMemo(() => {
    if (!line) return [];
    const list: Array<{
      id: string;
      date: string;
      ref: string;
      narration: string;
      fundName: string;
      amountPesewas: bigint;
    }> = [];

    entries.forEach((e) => {
      e.lines.forEach((l) => {
        if (l.accountId === line.accountId) {
          const fund = funds.find((f) => f.id === l.fundId);
          const amt = line.category === 'INCOME' ? l.creditAmountGhs : l.debitAmountGhs;
          if (amt > 0n) {
            list.push({
              id: `${e.id}-${l.id}`,
              date: e.entryDate,
              ref: e.documentNumber,
              narration: e.narration,
              fundName: fund?.name || 'General Fund',
              amountPesewas: amt,
            });
          }
        }
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [line, entries, funds]);

  if (!line) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Budgets', onClick: () => navigate('#/budgets') },
            { label: 'Lines', onClick: () => navigate('#/budgets') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('budgets')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Budget line <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('budgets')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Budgets
          </button>
        </div>
      </div>
    );
  }

  const annualBudgetPesewas = line.annualAmountPesewas;
  const actualSpentPesewas = lineUtil?.actualPesewas || 0n;
  const remainingPesewas = annualBudgetPesewas - actualSpentPesewas;
  const utilizationPct = lineUtil?.utilizationPercentage ?? 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Budgets & Targets', onClick: () => navigate('#/budgets') },
          { label: `${line.accountCode} · ${line.accountName}` },
        ]}
        currentId={line.accountCode}
        listKey="budget-line"
        onBack={() => goBack('budgets')}
      />

      {/* Main Budget Line Container */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Header Block */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-sans tabular-nums font-bold text-[18px] text-[var(--accent)]">
                {line.accountCode}
              </span>
              <h1 className="font-semibold text-[20px] text-[var(--text-primary)]">
                {line.accountName}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--surface-border)]">
                {line.category}
              </span>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Approved 2026 Annual Operating Budget · Fund: General Fund
            </p>
          </div>

          <div className="text-right">
            <span className="text-[12px] text-[var(--text-muted)] block">Annual Approved Budget</span>
            <MoneyCell amountPesewas={annualBudgetPesewas} size="xl" align="right" />
          </div>
        </div>

        {/* Utilization Bar & Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[14px]">
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">YTD Actual Spent</span>
            <MoneyCell amountPesewas={actualSpentPesewas} size="base" align="left" />
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Remaining Budget</span>
            <MoneyCell
              amountPesewas={remainingPesewas}
              size="base"
              align="left"
              className={remainingPesewas < 0n ? 'text-[var(--status-red)]' : 'text-emerald-700 dark:text-emerald-400'}
            />
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Budget Utilization</span>
            <span className="font-sans tabular-nums font-semibold text-[17px] text-[var(--text-primary)]">
              {utilizationPct}%
            </span>
          </div>
        </div>

        {/* Quarterly Distribution Table */}
        <div className="space-y-3">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
            Quarterly Phased Distribution (25% per Quarter)
          </span>

          <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Q1 (Jan - Mar)</th>
                  <th className="py-2.5 px-3">Q2 (Apr - Jun)</th>
                  <th className="py-2.5 px-3">Q3 (Jul - Sep)</th>
                  <th className="py-2.5 px-3">Q4 (Oct - Dec)</th>
                  <th className="py-2.5 px-3 text-right">Annual Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-sans tabular-nums">
                <tr>
                  <td className="py-2.5 px-3">
                    <MoneyCell amountPesewas={line.quarterlyAmountsPesewas[0]} align="left" size="sm" />
                  </td>
                  <td className="py-2.5 px-3">
                    <MoneyCell amountPesewas={line.quarterlyAmountsPesewas[1]} align="left" size="sm" />
                  </td>
                  <td className="py-2.5 px-3">
                    <MoneyCell amountPesewas={line.quarterlyAmountsPesewas[2]} align="left" size="sm" />
                  </td>
                  <td className="py-2.5 px-3">
                    <MoneyCell amountPesewas={line.quarterlyAmountsPesewas[3]} align="left" size="sm" />
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    <MoneyCell amountPesewas={annualBudgetPesewas} align="right" size="sm" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Posted Transactions List */}
        <div className="space-y-3 pt-4 border-t border-[var(--surface-border-subtle)]">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              General Ledger Transactions Against This Line
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              {transactions.length} posted entries
            </span>
          </div>

          <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Ref</th>
                  <th className="py-2.5 px-3">Narration</th>
                  <th className="py-2.5 px-3">Fund</th>
                  <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-sans">
                {transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[var(--surface-subtle)]/40 transition">
                      <td className="py-2.5 px-3 text-[13px]">{formatDate(tx.date)}</td>
                      <td className="py-2.5 px-3 text-[13px] font-sans tabular-nums font-medium text-[var(--accent)]">
                        {tx.ref}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] text-[var(--text-primary)]">{tx.narration}</td>
                      <td className="py-2.5 px-3 text-[13px] text-[var(--text-secondary)]">{tx.fundName}</td>
                      <td className="py-2.5 px-3 text-right">
                        <MoneyCell amountPesewas={tx.amountPesewas} align="right" size="sm" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[13px] text-[var(--text-muted)] italic">
                      No posted transactions recorded for this budget line in the current year.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
