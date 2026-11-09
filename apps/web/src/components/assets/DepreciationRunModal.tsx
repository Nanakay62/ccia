import React, { useState, useMemo } from 'react';
import {
  X,
  Play,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface DepreciationRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DepreciationRunModal: React.FC<DepreciationRunModalProps> = ({
  isOpen,
  onClose,
}) => {
  useModalEscape(isOpen, onClose);
  const { previewDepreciationRun, postDepreciationRun, depreciationRuns } = useFixedAssets();
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const [period, setPeriod] = useState<string>('2026-10');
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [activeTab, setActiveTab] = useState<'eligible' | 'skipped' | 'gl'>('eligible');
  const [isConfirmingPost, setIsConfirmingPost] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute default as-of date based on selected period
  const asOfDate = useMemo(() => {
    if (periodType === 'MONTHLY') {
      const [y, m] = period.split('-').map(Number);
      if (y && m) {
        const lastDay = new Date(y, m, 0).getDate();
        return `${period}-${String(lastDay).padStart(2, '0')}`;
      }
      return `${period}-28`;
    } else {
      return `${period}-12-31`;
    }
  }, [period, periodType]);

  // Reactive preview calculation
  const preview = useMemo(() => {
    return previewDepreciationRun(period, periodType, asOfDate);
  }, [previewDepreciationRun, period, periodType, asOfDate]);

  // Check if period already posted
  const isAlreadyPosted = useMemo(() => {
    return depreciationRuns.some(
      (r) => r.period === period && r.status === 'POSTED'
    );
  }, [depreciationRuns, period]);

  if (!isOpen) return null;

  const canApprove = role === 'Treasurer';

  const totalChargeFormatted = (
    Number(preview.totalChargePesewas) / 100
  ).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const eligibleLines = preview.lines.filter((l) => l.status === 'ACTIVE');
  const skippedLines = preview.lines.filter((l) => l.status === 'SKIPPED');

  // Grouped GL Lines for the preview tab
  const groupedPostings = Array.from(
    eligibleLines.reduce((map, line) => {
      const key = `${line.fundName} · ${line.categoryName}`;
      const existing = map.get(key) || {
        fundName: line.fundName,
        categoryName: line.categoryName,
        expenseAcct: line.depreciationExpenseAccountCode,
        accDepAcct: line.accumulatedDepreciationAccountCode,
        chargePesewas: 0n,
        count: 0,
      };
      existing.chargePesewas += line.chargePesewas;
      existing.count += 1;
      map.set(key, existing);
      return map;
    }, new Map<string, { fundName: string; categoryName: string; expenseAcct: string; accDepAcct: string; chargePesewas: bigint; count: number }>())
  ).map(([_, val]) => val);

  const handleExecutePost = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = postDepreciationRun(preview, currentUser.fullName);
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to post depreciation run.');
      setIsConfirmingPost(false);
      return;
    }

    setSuccessMsg(`Depreciation run ${preview.runNumber} successfully posted to General Ledger.`);
    setIsConfirmingPost(false);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div
          className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dep-run-modal-title"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#1e4620]" />
              <h2 id="dep-run-modal-title" className="text-base font-semibold text-[var(--text-primary)]">
                Run Fixed Asset Depreciation
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-[var(--surface-card)] border-b border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label htmlFor="dep-period-type" className="font-medium text-[var(--text-secondary)]">
                  Frequency:
                </label>
                <select
                  id="dep-period-type"
                  value={periodType}
                  onChange={(e) => {
                    const newType = e.target.value as 'MONTHLY' | 'YEARLY';
                    setPeriodType(newType);
                    setPeriod(newType === 'MONTHLY' ? '2026-10' : '2026');
                  }}
                  className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                >
                  <option value="MONTHLY">Monthly Run</option>
                  <option value="YEARLY">Yearly Run</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="dep-period-select" className="font-medium text-[var(--text-secondary)]">
                  Accounting Period:
                </label>
                {periodType === 'MONTHLY' ? (
                  <select
                    id="dep-period-select"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  >
                    <option value="2026-09">September 2026</option>
                    <option value="2026-10">October 2026</option>
                    <option value="2026-11">November 2026</option>
                    <option value="2026-12">December 2026</option>
                  </select>
                ) : (
                  <select
                    id="dep-period-select"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                  >
                    <option value="2026">Financial Year 2026</option>
                    <option value="2025">Financial Year 2025</option>
                  </select>
                )}
              </div>

              <div className="text-[var(--text-muted)]">
                Posting Date: <span className="font-mono text-[var(--text-secondary)]">{asOfDate}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[var(--text-muted)]">Run Code: </span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{preview.runNumber}</span>
            </div>
          </div>

          {/* Accounting Status Line per Section 6 */}
          <div className="py-2.5 px-5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[var(--text-primary)] font-semibold">{preview.totalEligibleAssets}</span> eligible assets ·{' '}
              <span className="text-[var(--text-primary)] font-semibold">{preview.totalSkippedAssets}</span> skipped · Total depreciation charge{' '}
              <span className="font-mono font-bold text-[#1e4620]">GHS {totalChargeFormatted}</span>
            </div>

            <div className="flex items-center gap-2">
              {isAlreadyPosted ? (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" /> Period {period} Already Posted (Cannot Re-run)
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Posting
                </div>
              )}
            </div>
          </div>

          {/* Subtabs for Preview */}
          <div className="border-b border-[var(--surface-border)] px-5 bg-[var(--surface-card)] flex items-center gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('eligible')}
              className={`py-2.5 border-b-2 transition ${
                activeTab === 'eligible'
                  ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Eligible Assets ({eligibleLines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('skipped')}
              className={`py-2.5 border-b-2 transition ${
                activeTab === 'skipped'
                  ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Skipped Assets ({skippedLines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gl')}
              className={`py-2.5 border-b-2 transition ${
                activeTab === 'gl'
                  ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              GL Journal Breakdown ({groupedPostings.length} entries)
            </button>
          </div>

          {/* Tab Content Tables */}
          <div className="p-4 flex-1 overflow-y-auto">
            {errorMsg && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {activeTab === 'eligible' && (
              <div className="border border-[var(--surface-border)] rounded overflow-hidden">
                <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Asset No.</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Cost (GHS)</th>
                      <th className="py-2 px-3 text-right">Prior Acc. Dep</th>
                      <th className="py-2 px-3 text-right">Charge (GHS)</th>
                      <th className="py-2 px-3 text-right">Projected NBV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {eligibleLines.map((line) => {
                      const cost = (Number(line.costPesewas) / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      });
                      const prior = (
                        Number(line.priorAccumulatedDepreciationPesewas) / 100
                      ).toLocaleString('en-US', { minimumFractionDigits: 2 });
                      const charge = (Number(line.chargePesewas) / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      });
                      const projNbv = (
                        Number(line.projectedNetBookValuePesewas) / 100
                      ).toLocaleString('en-US', { minimumFractionDigits: 2 });

                      return (
                        <tr key={line.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="py-2 px-3 font-mono font-medium text-[var(--text-primary)]">
                            {line.assetNumber}
                          </td>
                          <td className="py-2 px-3 font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                            {line.description}
                          </td>
                          <td className="py-2 px-3">{line.categoryName}</td>
                          <td className="py-2 px-3 text-right font-mono">{cost}</td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">
                            {prior}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-[#1e4620]">
                            {charge}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{projNbv}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'skipped' && (
              <div className="border border-[var(--surface-border)] rounded overflow-hidden">
                <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Asset No.</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Cost (GHS)</th>
                      <th className="py-2 px-3">Skip Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {skippedLines.map((line) => {
                      const cost = (Number(line.costPesewas) / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      });

                      const reasonText =
                        line.skipReason === 'LAND_NON_DEPRECIABLE'
                          ? 'Land is non-depreciable'
                          : line.skipReason === 'DISPOSED'
                          ? 'Asset is derecognized / disposed'
                          : line.skipReason === 'FULLY_DEPRECIATED'
                          ? 'Fully depreciated (reached residual value)'
                          : 'Depreciation start date in future';

                      return (
                        <tr key={line.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="py-2 px-3 font-mono text-[var(--text-primary)]">
                            {line.assetNumber}
                          </td>
                          <td className="py-2 px-3 text-[var(--text-primary)] max-w-[200px] truncate">
                            {line.description}
                          </td>
                          <td className="py-2 px-3">{line.categoryName}</td>
                          <td className="py-2 px-3 text-right font-mono">{cost}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px]">
                              {reasonText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'gl' && (
              <div className="space-y-3">
                <div className="text-[11px] text-[var(--text-muted)]">
                  Posting creates one balanced journal entry per category and fund: Dr Depreciation Expense, Cr Accumulated Depreciation (Contra-Asset).
                </div>
                <div className="border border-[var(--surface-border)] rounded overflow-hidden">
                  <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                    <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3">Fund & Category</th>
                        <th className="py-2 px-3">Assets</th>
                        <th className="py-2 px-3">Debit (Expense Account)</th>
                        <th className="py-2 px-3">Credit (Contra-Asset Account)</th>
                        <th className="py-2 px-3 text-right">Amount (GHS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {groupedPostings.map((g, idx) => {
                        const amt = (Number(g.chargePesewas) / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        });
                        return (
                          <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                            <td className="py-2 px-3 font-medium text-[var(--text-primary)]">
                              {g.fundName} · {g.categoryName}
                            </td>
                            <td className="py-2 px-3">{g.count} items</td>
                            <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                              {g.expenseAcct}
                            </td>
                            <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                              {g.accDepAcct}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">
                              {amt}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-[var(--surface-subtle)] border-t border-[var(--surface-border)] font-semibold text-[var(--text-primary)]">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right">
                          Total Balanced Journal Entry Posting:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#1e4620]">
                          {totalChargeFormatted}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between">
            <div className="text-xs text-[var(--text-muted)]">
              {canApprove
                ? 'Treasurer approval required to post journal entries'
                : 'Only the Treasurer can post depreciation runs'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAlreadyPosted || !canApprove || eligibleLines.length === 0}
                onClick={() => setIsConfirmingPost(true)}
                className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Post Depreciation
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConfirmingPost}
        title={`Approve Depreciation Run ${preview.runNumber}`}
        description={`Are you sure you want to post depreciation of GHS ${totalChargeFormatted} across ${preview.totalEligibleAssets} assets for period ${period}? This will create a balanced journal entry in the General Ledger and update asset accumulated depreciation records.`}
        confirmLabel="Approve & Post"
        cancelLabel="Review"
        onConfirm={handleExecutePost}
        onClose={() => setIsConfirmingPost(false)}
      />
    </>
  );
};
