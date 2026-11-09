import React, { useState, useMemo } from 'react';
import { Calendar, CheckCircle2, X, ArrowRight, Percent } from 'lucide-react';
import { rolloverBudget, type BudgetLine } from '@church/domain';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatMoneyAmount } from '../../config/churchSettings.js';

interface BudgetRolloverModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentYearLabel: string;
  readonly nextYearLabel: string;
  readonly lines: readonly BudgetLine[];
  readonly onConfirmRollover: (params: {
    nextYearLabel: string;
    globalPercentage: number;
    rolledLines: Array<{
      accountCode: string;
      accountName: string;
      category: 'INCOME' | 'EXPENSE';
      oldAmountPesewas: bigint;
      newAmountPesewas: bigint;
    }>;
  }) => void;
}

export const BudgetRolloverModal: React.FC<BudgetRolloverModalProps> = ({
  isOpen,
  onClose,
  currentYearLabel,
  nextYearLabel,
  lines,
  onConfirmRollover,
}) => {
  const [globalPct, setGlobalPct] = useState<number>(5);
  const [lineOverrides, setLineOverrides] = useState<Record<string, number>>({});

  useModalEscape(isOpen, onClose);

  const previewLines = useMemo(() => {
    return lines.map((line) => {
      const effectivePct: number =
        lineOverrides[line.accountCode] !== undefined ? lineOverrides[line.accountCode]! : globalPct;
      const rolled = rolloverBudget({
        currentBudgetLines: [
          {
            id: line.accountCode,
            accountId: line.accountId,
            fundId: 'fund-gen',
            annualAmountPesewas: line.annualAmountPesewas,
          },
        ],
        percentageAdjustment: effectivePct,
        nextYearLabel,
      })[0];

      return {
        accountCode: line.accountCode,
        accountName: line.accountName,
        category: line.category,
        effectivePct,
        oldAmountPesewas: line.annualAmountPesewas,
        newAmountPesewas: rolled ? rolled.annualAmountPesewas : line.annualAmountPesewas,
      };
    });
  }, [lines, globalPct, lineOverrides, nextYearLabel]);

  if (!isOpen) return null;

  const totalOldIncome = previewLines
    .filter((l) => l.category === 'INCOME')
    .reduce((sum, l) => sum + l.oldAmountPesewas, 0n);
  const totalNewIncome = previewLines
    .filter((l) => l.category === 'INCOME')
    .reduce((sum, l) => sum + l.newAmountPesewas, 0n);

  const totalOldExpense = previewLines
    .filter((l) => l.category === 'EXPENSE')
    .reduce((sum, l) => sum + l.oldAmountPesewas, 0n);
  const totalNewExpense = previewLines
    .filter((l) => l.category === 'EXPENSE')
    .reduce((sum, l) => sum + l.newAmountPesewas, 0n);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmRollover({
      nextYearLabel,
      globalPercentage: globalPct,
      rolledLines: previewLines,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-rollover-title"
    >
      <div className="w-full max-w-[720px] rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div>
            <h2
              id="budget-rollover-title"
              className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2"
            >
              <Calendar className="w-4 h-4 text-[#1e3a2f]" />
              <span>
                Rollover Budget to {nextYearLabel}
              </span>
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              Create next year&apos;s draft operating budget from {currentYearLabel} with optional percentage adjustments per account line.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Global Adjustment Control */}
          <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <label
                htmlFor="global-rollover-pct"
                className="block text-[13px] font-bold text-[var(--text-primary)]"
              >
                Default Percentage Adjustment Across All Lines
              </label>
              <span className="text-[12px] text-[var(--text-muted)]">
                Apply a uniform inflation or growth adjustment, or customize individual lines below.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[-5, 0, 5, 10, 15].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setGlobalPct(preset);
                    setLineOverrides({});
                  }}
                  className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-semibold border transition cursor-pointer ${
                    globalPct === preset && Object.keys(lineOverrides).length === 0
                      ? 'bg-[#1e3a2f] text-white border-[#1e3a2f]'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--surface-border)] hover:bg-[var(--surface-panel)]'
                  }`}
                >
                  {preset > 0 ? `+${preset}%` : `${preset}%`}
                </button>
              ))}
              <div className="relative w-24">
                <input
                  id="global-rollover-pct"
                  type="number"
                  step="0.5"
                  min="-90"
                  max="500"
                  value={globalPct}
                  onChange={(e) => setGlobalPct(parseFloat(e.target.value) || 0)}
                  className="w-full text-right pr-6 pl-2 py-1 text-[13px] font-semibold tabular-nums rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                />
                <Percent className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Line-by-line Preview Table */}
          <div className="rounded-[var(--radius-sm)] border border-[var(--surface-border)] overflow-hidden">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3 text-right">{currentYearLabel} (GHS)</th>
                  <th className="py-2.5 px-3 text-center">Adj (%)</th>
                  <th className="py-2.5 px-3 text-right">{nextYearLabel} Draft (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] tabular-nums">
                {previewLines.map((item) => (
                  <tr key={item.accountCode} className="hover:bg-[var(--surface-panel)]">
                    <td className="py-2 px-3">
                      <span className="font-mono text-[12px] text-[var(--text-muted)] mr-1.5">
                        {item.accountCode}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">{item.accountName}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                      {formatMoneyAmount(item.oldAmountPesewas)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        step="1"
                        min="-90"
                        max="500"
                        aria-label={`Adjustment percentage for ${item.accountName}`}
                        value={item.effectivePct}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setLineOverrides((prev) => ({
                            ...prev,
                            [item.accountCode]: val,
                          }));
                        }}
                        className="w-16 text-center py-0.5 px-1.5 text-[12px] font-semibold rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)]">
                      {formatMoneyAmount(item.newAmountPesewas)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[var(--surface-subtle)] border-t-2 border-[var(--surface-border)] font-bold tabular-nums text-[12px]">
                <tr>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">Projected Total Income</td>
                  <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                    {formatMoneyAmount(totalOldIncome)}
                  </td>
                  <td className="py-2 px-3 text-center text-[var(--text-muted)]">→</td>
                  <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400">
                    {formatMoneyAmount(totalNewIncome)}
                  </td>
                </tr>
                <tr className="border-t border-[var(--surface-border)]">
                  <td className="py-2 px-3 text-[var(--text-secondary)]">Projected Total Expenditure</td>
                  <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                    {formatMoneyAmount(totalOldExpense)}
                  </td>
                  <td className="py-2 px-3 text-center text-[var(--text-muted)]">→</td>
                  <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                    {formatMoneyAmount(totalNewExpense)}
                  </td>
                </tr>
                <tr className="border-t border-[var(--surface-border)] bg-emerald-50/50 dark:bg-emerald-950/30">
                  <td className="py-2.5 px-3 text-[var(--text-primary)]">Projected Net Surplus / (Deficit)</td>
                  <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                    {formatMoneyAmount(totalOldIncome - totalOldExpense)}
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-600">
                    <ArrowRight className="w-3.5 h-3.5 inline" />
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1e3a2f] dark:text-emerald-300 text-[13px]">
                    GHS {formatMoneyAmount(totalNewIncome - totalNewExpense)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-semibold shadow-xs transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Create {nextYearLabel} Draft Budget</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
