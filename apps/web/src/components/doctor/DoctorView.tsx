import React, { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { formatMoney, money, toMajorUnitsString } from '@church/domain';
import {
  Stethoscope,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  RotateCcw,
  Layers,
} from 'lucide-react';

export const DoctorView: React.FC = () => {
  const { doctorReport, runDoctor, simulateCorruption, resetLedger } = useLedger();

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [reviewedFindings, setReviewedFindings] = useState<Record<string, string>>({});
  const [reviewNoteInput, setReviewNoteInput] = useState<{ id: string; note: string } | null>(null);

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    runDoctor();
    setIsDiagnosing(false);
  };

  const handleSaveReview = () => {
    if (reviewNoteInput) {
      setReviewedFindings((prev) => ({
        ...prev,
        [reviewNoteInput.id]: reviewNoteInput.note || 'Reviewed by Treasurer',
      }));
      setReviewNoteInput(null);
    }
  };

  const CHECK_NAMES = [
    { num: 1, title: 'Summary & Breakdowns', desc: 'Fund, account, currency, month analysis' },
    { num: 2, title: 'Unbalanced Entries', desc: 'Checks that entry lines net to zero' },
    { num: 3, title: 'Structural Problems', desc: 'Orphaned lines, empty headers, inactive accounts' },
    { num: 4, title: 'Sync Gaps', desc: 'line_count mismatch & device/server differences' },
    { num: 5, title: 'Currency Integrity', desc: 'USD rate accuracy & 1p rounding differences' },
    { num: 6, title: 'Duplicates & Reversals', desc: 'Probable duplicate entries & flawed reversals' },
    { num: 7, title: 'Pattern Detection on D', desc: 'Sign flip (D/2), digit swap (/9), decimal slip' },
    { num: 8, title: 'Time Bisect', desc: 'Isolates first date trial balance broke' },
    { num: 9, title: 'Source Breakdown', desc: 'Concentration by device, user, document type' },
    { num: 10, title: 'Opening Balances', desc: 'Validates opening balance & migration integrity' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-indigo-600" />
            <span>Trial Balance Doctor (Section 3.5)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Offline 10-step diagnostic engine to detect where and why books do not balance. Never auto-fixes.
          </p>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={isDiagnosing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
          <span>{isDiagnosing ? 'Running 10 Checks...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* Plain-Language Diagnosis Banner */}
      <div
        className={`p-5 rounded-2xl border shadow-sm ${
          doctorReport.isClean
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            {doctorReport.isClean ? (
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-base sm:text-lg font-bold">
                {doctorReport.plainLanguageSummary}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Last checked: {new Date(doctorReport.timestamp).toLocaleTimeString()} • Run ID: {doctorReport.runId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Difference: </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatMoney(money(doctorReport.totalDifferenceGhs, 'GHS'))}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Explained: </span>
              <span className="font-bold text-emerald-600">
                {formatMoney(money(doctorReport.explainedDifferenceGhs, 'GHS'))}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500">Unexplained: </span>
              <span className="font-bold text-rose-600">
                {formatMoney(money(doctorReport.unexplainedDifferenceGhs, 'GHS'))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 10-Check Inspection Status Grid */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <span>10-Check Audit Sequence</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CHECK_NAMES.map((c) => {
            const ruleFindings = doctorReport.findings.filter((f) => f.ruleNumber === c.num);
            const hasError = ruleFindings.some((f) => f.severity === 'ERROR');
            const hasWarning = ruleFindings.some((f) => f.severity === 'WARNING');

            let badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
            if (hasError) badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
            else if (hasWarning) badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
            else badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';

            return (
              <div
                key={c.num}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    #{c.num} {c.title}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
                    {hasError ? 'ERROR' : hasWarning ? 'WARN' : 'PASS'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranked Diagnostic Findings Feed */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Ranked Diagnostic Findings ({doctorReport.findings.length})</span>
          </h3>
          <span className="text-xs text-slate-500">Ranked by Likelihood Score</span>
        </div>

        {doctorReport.findings.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">No diagnostic defects found.</p>
            <p className="text-xs text-slate-400">All 10 accounting integrity checks passed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {doctorReport.findings.map((finding) => {
              const isReviewed = Boolean(reviewedFindings[finding.id]);

              return (
                <div
                  key={finding.id}
                  className={`p-4 sm:p-5 rounded-xl border transition space-y-3 ${
                    finding.severity === 'ERROR'
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                      : finding.severity === 'WARNING'
                      ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          finding.severity === 'ERROR'
                            ? 'bg-rose-600 text-white'
                            : finding.severity === 'WARNING'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Check #{finding.ruleNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {finding.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                        {finding.likelihoodScore}% Likelihood
                      </span>

                      {isReviewed ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Reviewed</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setReviewNoteInput({ id: finding.id, note: '' })}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Mark Reviewed
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    {finding.description}
                  </p>

                  {/* Evidence Pills */}
                  {finding.evidence && (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                      <div className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
                        Evidence Traces:
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                        {finding.evidence.documentNumbers?.map((doc) => (
                          <span key={doc} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-blue-600">
                            Doc: {doc}
                          </span>
                        ))}
                        {finding.evidence.dates?.map((d) => (
                          <span key={d} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                            Date: {d}
                          </span>
                        ))}
                        {finding.evidence.amountsPesewas?.map((amt, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            Amount: GHS {toMajorUnitsString(amt)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Probable Cause & Recommended Fix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Probable Cause: </span>
                      <span className="text-slate-600 dark:text-slate-400">{finding.probableCause}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
                      <span className="font-bold">Recommended Fix: </span>
                      <span>{finding.recommendedFix}</span>
                    </div>
                  </div>

                  {isReviewed && (
                    <div className="text-xs text-slate-500 italic">
                      Review Note: "{reviewedFindings[finding.id]}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Simulation Sandbox for Testing & Verification */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Trial Balance Doctor Testing & Verification Sandbox
            </h4>
          </div>
          <button
            onClick={resetLedger}
            className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
            <span>Reset Clean Ledger</span>
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Inject real-world accounting errors into the ledger to verify that the Doctor accurately identifies the root cause and ranks candidates:
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => simulateCorruption('sign_flip')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Inject Debit/Credit Sign Flip (Rule 7b)
          </button>
          <button
            onClick={() => simulateCorruption('digit_transposition')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Inject Digit Transposition (Rule 7c)
          </button>
          <button
            onClick={() => simulateCorruption('sync_gap')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Inject Interrupted Sync Gap (Rule 4)
          </button>
          <button
            onClick={() => simulateCorruption('unbalanced')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Inject Unbalanced Entry (Rule 2)
          </button>
        </div>
      </div>

      {/* Review Note Dialog */}
      {reviewNoteInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <h4 className="font-bold text-sm">Add Auditor / Treasurer Review Note</h4>
            <textarea
              value={reviewNoteInput.note}
              onChange={(e) => setReviewNoteInput({ ...reviewNoteInput, note: e.target.value })}
              placeholder="e.g., Investigated; reversal planned for tomorrow after counter sign-off..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewNoteInput(null)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReview}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
              >
                Save Review Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
