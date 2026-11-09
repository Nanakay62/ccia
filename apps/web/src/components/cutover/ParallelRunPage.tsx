import React, { useState, useMemo, useContext } from 'react';
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  X,
} from 'lucide-react';
import {
  generateParallelRunCsvTemplate,
  parseParallelRunCsv,
} from '@church/domain';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { formatDate, formatMoneyAmount } from '../../config/churchSettings.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const ParallelRunPage: React.FC = () => {
  const {
    accounts,
    funds,
    currentYearPeriods,
    getParallelRunComparison,
    saveParallelRunMonthRows,
    updateParallelRunRowExplanation,
    signOffParallelRunMonthAction,
    parallelRunOverall,
  } = useLedger();
  const { currentUser } = useAuth();
  const { goBack, navigate, navigateToTab } = useRouter();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  // Month-end comparison tabs: Sep 2026, Oct 2026, Nov 2026
  const availablePeriods = useMemo(() => {
    return currentYearPeriods.filter(
      (p) => !p.isAdjustmentPeriod && (p.month === 9 || p.month === 10 || p.month === 11)
    );
  }, [currentYearPeriods]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => {
    return availablePeriods[1]?.id ?? availablePeriods[0]?.id ?? 'per-2026-10';
  });

  const activeComparison = useMemo(
    () => getParallelRunComparison(selectedPeriodId),
    [getParallelRunComparison, selectedPeriodId]
  );

  const { summary: activeSummary, rows: comparisonRows } = activeComparison;

  // Sign-off modal state
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [treasurerSigner, setTreasurerSigner] = useState(
    currentUser.fullName || 'Kofi Mensah (Treasurer)'
  );

  useModalEscape(isSignOffModalOpen, () => setIsSignOffModalOpen(false));

  // Filter state for comparison table (All, Differences only, Unexplained only)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIFF_ONLY' | 'UNEXPLAINED_ONLY'>('ALL');

  const filteredRows = useMemo(() => {
    if (statusFilter === 'DIFF_ONLY') {
      return comparisonRows.filter((r) => r.status !== 'AGREES');
    }
    if (statusFilter === 'UNEXPLAINED_ONLY') {
      return comparisonRows.filter((r) => r.status === 'UNEXPLAINED');
    }
    return comparisonRows;
  }, [comparisonRows, statusFilter]);

  // Download template
  const handleDownloadTemplate = () => {
    const csvContent = generateParallelRunCsvTemplate(accounts, funds);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parallel_run_template_${selectedPeriodId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Parallel run CSV template downloaded', 'success');
  };

  // Upload old-book CSV
  const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      const parsed = parseParallelRunCsv(text);
      if (parsed.length > 0) {
        saveParallelRunMonthRows(selectedPeriodId, parsed);
        showToast(`Loaded ${parsed.length} old-book accounts for ${activeSummary.periodLabel}`, 'success');
      } else {
        showToast('Could not parse accounts from CSV. Verify column headers.', 'warning');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Inline editing of old book balance
  const handleUpdateOldBookBalance = (
    accountCode: string,
    fundCode: string,
    rawAmountStr: string
  ) => {
    const num = Number(rawAmountStr.replace(/,/g, '').trim());
    const pesewas = !isNaN(num) ? BigInt(Math.round(num * 100)) : 0n;

    const existingRows = comparisonRows.map((r) => ({
      accountCode: r.accountCode,
      fundCode: r.fundCode,
      oldBookBalanceGhs:
        r.accountCode === accountCode && r.fundCode.toUpperCase() === fundCode.toUpperCase()
          ? pesewas
          : r.oldBookBalanceGhs,
      explanation: r.explanation,
    }));

    saveParallelRunMonthRows(selectedPeriodId, existingRows);
  };

  // Confirm sign-off
  const handleConfirmSignOff = () => {
    try {
      const signed = signOffParallelRunMonthAction(selectedPeriodId, treasurerSigner);
      setIsSignOffModalOpen(false);
      showToast(
        `Chief accountant sign-off recorded for ${signed.periodLabel}. Parallel run approved.`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sign-off failed', 'warning');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Settings</span>
          </button>
          <div className="text-[13px] text-[var(--text-muted)]">
            <button onClick={() => navigateToTab('settings')} className="hover:underline">
              Settings
            </button>
            <span className="mx-1.5">/</span>
            <span className="text-[var(--text-primary)] font-semibold">
              Parallel run and comparison
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('#/opening-balances')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            Opening balances
          </button>
          <button
            onClick={() => navigate('#/imports')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            Data import tool
          </button>
          <button
            onClick={() => navigate('#/go-live')}
            className="px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
          >
            Go-live readiness
          </button>
        </div>
      </div>

      {/* Header & Spec B4 Summary Line Banner */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Parallel run and comparison
            </h1>
            <p className="text-[13px] text-[var(--text-muted)]">
              For the parallel period (recommended two to three month-ends), the Finance Secretary enters or uploads monthly totals from the old books, and the system shows differences account by account with status (<span className="text-emerald-700 font-semibold">Agrees</span>, <span className="text-amber-700 font-semibold">Explained</span>, <span className="text-rose-700 font-semibold">Unexplained</span>). Explanations are written and kept. Each month is parallel-run approved by the Chief Accountant.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="text-[12px] font-semibold text-[var(--text-muted)]">
              Required by Go-Live Checklist (Item #15)
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[13px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {parallelRunOverall.approvedMonthEndsCount} of {parallelRunOverall.requiredMonthEnds} month-ends approved
              </span>
            </div>
          </div>
        </div>

        {/* Spec Verbatim Summary Line Banner */}
        <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div className="text-[14px] font-bold text-[var(--text-primary)] font-sans tabular-nums">
              {parallelRunOverall.summaryLine}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-sans tabular-nums">
            {parallelRunOverall.months.map((m) => (
              <span
                key={m.periodId}
                className={`px-2 py-0.5 rounded font-semibold border ${
                  m.isApproved
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : m.canApprove
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {m.periodLabel}: {m.isApproved ? 'Approved' : m.statusSummary}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Month Tabs & Controls Bar */}
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
        {/* Month Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-border)] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {availablePeriods.map((p) => {
              const cmp = getParallelRunComparison(p.id);
              const isSelected = p.id === selectedPeriodId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={`px-4 py-2 rounded-[var(--radius-sm)] text-[13px] font-semibold transition flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--surface-border)]'
                  }`}
                >
                  <span>{cmp.summary.periodLabel}</span>
                  {cmp.summary.isApproved ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : cmp.summary.unexplainedCount > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV template</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload old-book CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleUploadCsv}
                className="hidden"
              />
            </label>

            {activeSummary.isApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[13px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  Approved by {activeSummary.approvedByTreasurer} (
                  {formatDate(activeSummary.approvedAt?.slice(0, 10))})
                </span>
              </span>
            ) : (
              <button
                onClick={() => setIsSignOffModalOpen(true)}
                disabled={!activeSummary.canApprove}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Chief Accountant Sign-Off</span>
              </button>
            )}
          </div>
        </div>

        {/* Month Summary Stats Strip & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3 text-[13px] font-sans tabular-nums">
            <span className="font-semibold text-[var(--text-primary)]">
              {activeSummary.periodLabel} (as of {formatDate(activeSummary.asOfDate)})
            </span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {activeSummary.agreesCount} of {activeSummary.totalAccountsCompared} accounts agree
            </span>
            {activeSummary.explainedCount > 0 && (
              <>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  {activeSummary.explainedCount} explained
                </span>
              </>
            )}
            {activeSummary.unexplainedCount > 0 && (
              <>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">
                  {activeSummary.unexplainedCount} unexplained differences
                </span>
              </>
            )}
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-[var(--text-secondary)]">
              Old: GHS {formatMoneyAmount(activeSummary.totalOldBooksGhs)} · Sys: GHS{' '}
              {formatMoneyAmount(activeSummary.totalSystemGhs)} · Var: GHS{' '}
              {formatMoneyAmount(activeSummary.netVarianceGhs)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-[var(--text-muted)] font-medium mr-1">Show:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'ALL'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              All accounts ({comparisonRows.length})
            </button>
            <button
              onClick={() => setStatusFilter('DIFF_ONLY')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'DIFF_ONLY'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              Differences ({activeSummary.explainedCount + activeSummary.unexplainedCount})
            </button>
            <button
              onClick={() => setStatusFilter('UNEXPLAINED_ONLY')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'UNEXPLAINED_ONLY'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              Unexplained only ({activeSummary.unexplainedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Account-by-Account Comparison Table */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Account-by-account variance schedule
          </h2>
          <span className="text-[12px] text-[var(--text-muted)] font-sans tabular-nums">
            Showing {filteredRows.length} of {comparisonRows.length} accounts
          </span>
        </div>

        <table className="w-full text-[13px] font-sans tabular-nums">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
              <th className="py-2 px-3 w-20">Code</th>
              <th className="py-2 px-3">Account name</th>
              <th className="py-2 px-3 w-16">Fund</th>
              <th className="py-2 px-3 text-right w-36">Old books total (GHS)</th>
              <th className="py-2 px-3 text-right w-36">System total (GHS)</th>
              <th className="py-2 px-3 text-right w-32">Difference</th>
              <th className="py-2 px-3 w-32">Status</th>
              <th className="py-2 px-3">Written explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {filteredRows.map((row) => {
              const isZero = row.varianceGhs === 0n;
              return (
                <tr
                  key={`${row.accountCode}-${row.fundCode}`}
                  className={`hover:bg-[var(--surface-subtle)] ${
                    row.status === 'UNEXPLAINED' ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                    {row.accountCode}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-[var(--text-primary)]">{row.accountName}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{row.accountType}</div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[var(--text-secondary)]">
                    {row.fundCode}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="text"
                      aria-label={`Old books balance for ${row.accountCode}`}
                      value={formatMoneyAmount(row.oldBookBalanceGhs)}
                      onChange={(e) =>
                        handleUpdateOldBookBalance(row.accountCode, row.fundCode, e.target.value)
                      }
                      className="w-28 text-right px-2 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-medium text-[var(--text-primary)] font-sans tabular-nums"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-[var(--text-primary)]">
                    {formatMoneyAmount(row.systemBalanceGhs)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      isZero
                        ? 'text-[var(--text-muted)]'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {isZero ? '—' : formatMoneyAmount(row.varianceGhs)}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.status === 'AGREES' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Agrees
                      </span>
                    )}
                    {row.status === 'EXPLAINED' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        Explained
                      </span>
                    )}
                    {row.status === 'UNEXPLAINED' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        Unexplained
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      aria-label={`Explanation for ${row.accountCode}`}
                      placeholder={
                        isZero
                          ? 'Balances agree'
                          : 'Write explanation for difference...'
                      }
                      value={row.explanation}
                      onChange={(e) =>
                        updateParallelRunRowExplanation(
                          selectedPeriodId,
                          row.accountCode,
                          row.fundCode,
                          e.target.value
                        )
                      }
                      disabled={isZero}
                      className={`w-full px-2.5 py-1 rounded border text-[12px] ${
                        isZero
                          ? 'border-transparent bg-transparent text-[var(--text-muted)] placeholder:text-[var(--text-muted)]'
                          : row.explanation
                          ? 'border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)]'
                          : 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 text-[var(--text-primary)] placeholder:text-rose-400'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Centred Modal: Chief Accountant Parallel Run Sign-Off */}
      {isSignOffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signoff-modal-title"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
                <h3 id="signoff-modal-title" className="text-sm font-bold text-[var(--text-primary)]">
                  Chief Accountant Sign-Off — {activeSummary.periodLabel}
                </h3>
              </div>
              <button
                onClick={() => setIsSignOffModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-secondary)]">
              <p>
                You are signing off on the parallel run comparison for{' '}
                <strong>{activeSummary.periodLabel}</strong> (as of {formatDate(activeSummary.asOfDate)}).
              </p>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1 font-sans tabular-nums text-[12px]">
                <div>Total accounts compared: <strong>{activeSummary.totalAccountsCompared}</strong></div>
                <div>Accounts agreeing exactly: <strong className="text-emerald-700">{activeSummary.agreesCount}</strong></div>
                <div>Accounts with written explanations: <strong className="text-amber-700">{activeSummary.explainedCount}</strong></div>
                <div>Unexplained differences: <strong className="text-emerald-700">0</strong></div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Treasurer / Chief Accountant Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={treasurerSigner}
                  onChange={(e) => setTreasurerSigner(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setIsSignOffModalOpen(false)}
                className="px-3.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignOff}
                disabled={!treasurerSigner.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm parallel run sign-off</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
