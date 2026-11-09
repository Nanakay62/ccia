import React, { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { useDemo } from '../../context/DemoContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import {
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { formatMoneyAmount, formatDate } from '../../config/churchSettings.js';
import type { JournalEntry } from '@church/domain';

interface Props {
  onNavigateToJournal?: () => void;
}

interface IntegrityCheckDef {
  num: number;
  name: string;
  description: string;
}

const INTEGRITY_CHECKS: IntegrityCheckDef[] = [
  { num: 1, name: 'Every entry balances', description: 'Checks that debit lines equal credit lines for every posted entry' },
  { num: 2, name: 'No entries missing lines', description: 'Validates that multi-line entries are complete and have no missing lines' },
  { num: 3, name: 'No sync gaps between this device and the server', description: 'Confirms local database state matches central ledger replication' },
  { num: 4, name: 'Exchange rates match the rate table', description: 'Verifies foreign currency revaluations align with approved benchmark rates' },
  { num: 5, name: 'No duplicate postings', description: 'Scans for accidental duplicate transactions across all funds' },
  { num: 6, name: 'Reversals match their originals', description: 'Ensures reversal transactions strictly mirror their target original entries' },
  { num: 7, name: 'Opening balances balance', description: 'Validates beginning ledger balances and migration integrity' },
  { num: 8, name: 'Bank cash matches the ledger', description: 'Reconciles bank accounts and cash clearing accounts against ledger balances' },
  { num: 9, name: 'Fund accounting strictly balances', description: 'Ensures restricted funds and general fund equity isolate properly' },
  { num: 10, name: 'Period-close readiness', description: 'Verifies all monthly pre-close checks are satisfied prior to period lock' },
  { num: 11, name: 'Cashbook vs ledger agreement', description: 'Verifies each cash, bank, and mobile money account balance equals its general ledger balance' },
  { num: 12, name: 'Tithes control and allocation', description: 'Validates total member tithe records equal the ledger balance of the Tithes income account' },
  { num: 13, name: 'Fixed asset register vs ledger', description: 'Verifies active asset cost and accumulated depreciation tie exactly to general ledger fixed asset control accounts' },
  { num: 14, name: 'No double posting of counting sheets or vouchers', description: 'Confirms each signed counting sheet and paid voucher appears exactly once in the general ledger' },
  { num: 15, name: 'Bank reconciliation currency (within 35 days)', description: 'Warns if any active bank account has gone more than 35 days without a signed-off reconciliation' },
  { num: 16, name: 'Remittance liability agreement', description: 'Verifies the Remittances Payable balance equals total accrued denominational remittances less payments' },
  { num: 17, name: 'General ledger hash-chain anti-tampering', description: 'Verifies unbroken SHA-256 cryptographic chain linkage across all journal entries' },
];

interface RunHistoryItem {
  id: string;
  runAt: string;
  runBy: string;
  isClean: boolean;
  findingsCount: number;
  differencePesewas: bigint;
}

export const DoctorView: React.FC<Props> = ({ onNavigateToJournal }) => {
  const { doctorReport, runDoctor, simulateCorruption, resetLedger, entries, accounts } = useLedger();
  const { isDemoMode } = useDemo();
  const { currentUser } = useAuth();
  const { hashChainResult } = useSecurityEvents();

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showChecksList, setShowChecksList] = useState(false);
  const [reviewedFindings, setReviewedFindings] = useState<Record<string, string>>({});
  const [reviewNoteInput, setReviewNoteInput] = useState<{ id: string; note: string } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Historical audit run records
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>(() => [
    {
      id: 'audit-001',
      runAt: '2026-11-02T14:29:00Z',
      runBy: 'Kofi Mensah (Treasurer)',
      isClean: true,
      findingsCount: 0,
      differencePesewas: 0n,
    },
    {
      id: 'audit-000',
      runAt: '2026-11-01T23:00:00Z',
      runBy: 'Automated nightly audit',
      isClean: true,
      findingsCount: 0,
      differencePesewas: 0n,
    },
  ]);

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    runDoctor();
    setIsDiagnosing(false);

    // Record in history
    setRunHistory((prev) => [
      {
        id: `audit-${Date.now()}`,
        runAt: new Date().toISOString(),
        runBy: `${currentUser.fullName} (${currentUser.role})`,
        isClean: doctorReport.isClean,
        findingsCount: doctorReport.findings.length,
        differencePesewas: doctorReport.totalDifferenceGhs,
      },
      ...prev.slice(0, 9),
    ]);
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

  // Find related entry for a finding
  const handleOpenEntry = (docNumberOrId?: string) => {
    if (!docNumberOrId) return;
    const entry = entries.find(
      (e) => e.documentNumber === docNumberOrId || e.id === docNumberOrId
    );
    if (entry) {
      setSelectedEntry(entry);
    }
  };

  const formattedDifference = formatMoneyAmount(doctorReport.totalDifferenceGhs);
  const formattedExplained = formatMoneyAmount(doctorReport.explainedDifferenceGhs);
  const formattedUnexplained = formatMoneyAmount(doctorReport.unexplainedDifferenceGhs);

  const lastRunDate = doctorReport.timestamp ? new Date(doctorReport.timestamp) : new Date();
  const lastRunFormatted = `${formatDate(lastRunDate.toISOString().slice(0, 10))}, ${lastRunDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="space-y-6">
      {/* 1. Header (Clean single accent, no icons beside title, no subtitle repeating title) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="font-serif text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">
          Integrity check
        </h1>

        <button
          onClick={handleRunDiagnostics}
          disabled={isDiagnosing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1e3a2f] hover:bg-[#162a22] text-white dark:bg-[#2d5242] dark:hover:bg-[#3d6e59] text-xs font-semibold shadow-xs transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
          <span>{isDiagnosing ? 'Running checks...' : 'Run again'}</span>
        </button>
      </div>

      {/* 2. Healthy State vs Out of Balance Bar (Rule A1: No tinted boxes for healthy state; thin bar for warnings) */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[var(--surface-border)]">
        {doctorReport.isClean ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              All 17 checks passed. Last run {lastRunFormatted}.
            </span>
            <button
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              className="text-[var(--accent)] hover:underline ml-1 font-medium"
            >
              Run again
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[6px] border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">
                Out of balance by GHS {formattedDifference}. {formattedExplained} explained, {formattedUnexplained} unexplained.
              </span>
            </div>
            <button
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              className="text-xs font-semibold underline hover:opacity-80 shrink-0"
            >
              Recalculate
            </button>
          </div>
        )}

        {/* Anti-Tampering Cryptographic Hash Chain Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] text-[var(--text-secondary)]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-medium text-[var(--text-primary)]">Anti-tampering hash chain:</span>
          <span className="text-emerald-600 font-semibold">
            {hashChainResult.isClean ? 'Verified (SHA-256)' : 'Tamper Alert'}
          </span>
        </div>
      </div>

      {/* 3. Findings List (When issues exist) */}
      {!doctorReport.isClean && doctorReport.findings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Findings ({doctorReport.findings.length})
          </h2>

          <div className="divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
            {doctorReport.findings.map((finding) => {
              const isReviewed = Boolean(reviewedFindings[finding.id]);
              const docNum = finding.evidence?.documentNumbers?.[0] || finding.relatedEntryId;

              return (
                <div key={finding.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {finding.severity === 'ERROR' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Warning
                          </span>
                        )}

                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {finding.title}
                        </span>

                        <span className="text-[11px] text-[var(--text-muted)]">
                          · {finding.likelihoodScore}% confidence
                        </span>
                      </div>

                      {/* Plain sentence explaining issue */}
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {finding.description}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {docNum && (
                        <button
                          onClick={() => handleOpenEntry(docNum)}
                          className="text-xs text-[var(--accent)] hover:underline font-medium flex items-center gap-1"
                        >
                          <span>Open entry</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}

                      {isReviewed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Reviewed</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setReviewNoteInput({ id: finding.id, note: '' })}
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                        >
                          Mark as reviewed
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Evidence block (clean neutral styling, no grey pills) */}
                  {finding.evidence && (
                    <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      {finding.evidence.documentNumbers?.map((doc) => (
                        <span key={doc}>Document: <span className="text-[var(--text-primary)] font-medium">{doc}</span></span>
                      ))}
                      {finding.evidence.dates?.map((d) => (
                        <span key={d}>Date: <span className="text-[var(--text-primary)] font-medium">{formatDate(d)}</span></span>
                      ))}
                      {finding.evidence.amountsPesewas?.map((amt, idx) => (
                        <span key={idx}>Amount: <span className="text-[var(--text-primary)] font-medium tabular-nums font-mono">GHS {formatMoneyAmount(amt)}</span></span>
                      ))}
                    </div>
                  )}

                  {/* Suggested fix */}
                  <div className="text-xs text-[var(--text-secondary)] pt-1">
                    <span className="font-medium text-[var(--text-primary)]">Suggested fix: </span>
                    <span>{finding.recommendedFix}</span>
                  </div>

                  {/* Review note if present */}
                  {isReviewed && (
                    <div className="text-xs text-[var(--text-muted)] italic">
                      Note: "{reviewedFindings[finding.id]}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Collapsible "Checks performed" List (Rule 3.3: Collapsible list, one row per check with plain name, result icon, time) */}
      <div className="pt-2">
        <button
          onClick={() => setShowChecksList((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--text-secondary)] py-1"
        >
          {showChecksList ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
          <span>Checks performed ({INTEGRITY_CHECKS.length})</span>
        </button>

        {showChecksList && (
          <div className="mt-2 border border-[var(--surface-border)] rounded-[6px] overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                  <th className="py-2 px-3 font-medium">Check</th>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 px-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {INTEGRITY_CHECKS.map((c) => {
                  const checkFindings = doctorReport.findings.filter((f) => f.ruleNumber === c.num);
                  const hasError = checkFindings.some((f) => f.severity === 'ERROR');
                  const hasWarning = checkFindings.some((f) => f.severity === 'WARNING');

                  return (
                    <tr key={c.num} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">
                        {c.name}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-muted)]">
                        {c.description}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {hasError ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Failed
                          </span>
                        ) : hasWarning ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Passed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Run History Table (Rule 3.4: Date and time, who ran it, result, findings count) */}
      <div className="pt-4 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Run history
        </h2>

        <div className="border border-[var(--surface-border)] rounded-[6px] overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                <th className="py-2 px-3 font-medium">Date & time</th>
                <th className="py-2 px-3 font-medium">Run by</th>
                <th className="py-2 px-3 font-medium">Result</th>
                <th className="py-2 px-3 font-medium text-right">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {runHistory.map((item) => {
                const itemDate = new Date(item.runAt);
                const dateFormatted = `${formatDate(item.runAt.slice(0, 10))}, ${itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                return (
                  <tr key={item.id} className="hover:bg-[var(--surface-subtle)]">
                    <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                      {dateFormatted}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">
                      {item.runBy}
                    </td>
                    <td className="py-2 px-3">
                      {item.isClean ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          <Check className="w-3 h-3" />
                          <span>All checks passed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          <span>Discrepancy detected</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                      {item.findingsCount === 0 ? '—' : item.findingsCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Demo Mode Testing Sandbox (Rule 3.5: Strictly available ONLY when isDemoMode === true) */}
      {isDemoMode && (
        <div className="mt-8 pt-6 border-t border-[var(--surface-border)] space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Demo Mode: Simulation Sandbox
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Inject simulated ledger discrepancies to test the diagnostic engine. This operates strictly within demo mode and does not touch production data.
              </p>
            </div>

            <button
              onClick={resetLedger}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[var(--surface-border)] rounded-[6px] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] transition"
            >
              <RotateCcw className="w-3 h-3 text-[var(--text-muted)]" />
              <span>Reset Clean Ledger</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => simulateCorruption('sign_flip')}
              className="px-2.5 py-1 border border-[var(--surface-border)] rounded-[6px] text-xs font-medium hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] transition"
            >
              Inject Debit/Credit Sign Flip
            </button>
            <button
              onClick={() => simulateCorruption('digit_transposition')}
              className="px-2.5 py-1 border border-[var(--surface-border)] rounded-[6px] text-xs font-medium hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] transition"
            >
              Inject Digit Transposition
            </button>
            <button
              onClick={() => simulateCorruption('sync_gap')}
              className="px-2.5 py-1 border border-[var(--surface-border)] rounded-[6px] text-xs font-medium hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] transition"
            >
              Inject Interrupted Sync Gap
            </button>
            <button
              onClick={() => simulateCorruption('unbalanced')}
              className="px-2.5 py-1 border border-[var(--surface-border)] rounded-[6px] text-xs font-medium hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] transition"
            >
              Inject Unbalanced Entry
            </button>
          </div>
        </div>
      )}

      {/* Review Note Dialog */}
      {reviewNoteInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[8px] max-w-sm w-full p-4 shadow-xl text-[var(--text-primary)] space-y-3">
            <h4 className="font-semibold text-xs text-[var(--text-primary)]">
              Auditor / Treasurer review note
            </h4>
            <textarea
              value={reviewNoteInput.note}
              onChange={(e) => setReviewNoteInput({ ...reviewNoteInput, note: e.target.value })}
              placeholder="e.g. Investigated; reversal planned after counter sign-off..."
              rows={3}
              className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewNoteInput(null)}
                className="px-2.5 py-1 border border-[var(--surface-border)] rounded-[6px] text-xs font-medium hover:bg-[var(--surface-subtle)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReview}
                className="px-3 py-1 bg-[#1e3a2f] hover:bg-[#162a22] text-white dark:bg-[#2d5242] rounded-[6px] text-xs font-semibold"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer for "Open entry" */}
      <SlideOverPanel
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry ? `Entry ${selectedEntry.documentNumber}` : 'Entry details'}
        subtitle={selectedEntry ? `${formatDate(selectedEntry.entryDate)} · ${selectedEntry.narration}` : ''}
        width="w-screen max-w-md"
      >
        {selectedEntry && (
          <div className="p-5 space-y-5 text-xs text-[var(--text-primary)]">
            {/* Meta Strip */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-subtle)] rounded-[6px] border border-[var(--surface-border)]">
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Created by</span>
                <span className="font-medium text-[var(--text-primary)]">{selectedEntry.createdBy}</span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Type</span>
                <span className="font-medium text-[var(--text-primary)]">{selectedEntry.entryType}</span>
              </div>
            </div>

            {/* Lines Table */}
            <div className="space-y-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                Journal lines ({selectedEntry.lines.length})
              </span>
              <div className="border border-[var(--surface-border)] rounded-[6px] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                      <th className="py-1.5 px-2.5 font-medium">Account</th>
                      <th className="py-1.5 px-2.5 font-medium text-right">Debit (GHS)</th>
                      <th className="py-1.5 px-2.5 font-medium text-right">Credit (GHS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {selectedEntry.lines.map((line) => {
                      const acct = accounts.find((a) => a.id === line.accountId);
                      const dr = Number(line.debitAmountGhs) / 100;
                      const cr = Number(line.creditAmountGhs) / 100;

                      return (
                        <tr key={line.id} className="hover:bg-[var(--surface-subtle)]">
                          <td className="py-2 px-2.5">
                            <div className="font-medium text-[var(--text-primary)]">
                              {acct ? `${acct.code} · ${acct.name}` : line.accountId}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-mono">
                            {dr > 0 ? formatMoneyAmount(dr) : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-mono">
                            {cr > 0 ? formatMoneyAmount(cr) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedEntry(null);
                  onNavigateToJournal?.();
                }}
                className="w-full py-2 px-3 text-center rounded-[6px] bg-[#1e3a2f] hover:bg-[#162a22] text-white dark:bg-[#2d5242] text-xs font-semibold shadow-xs transition"
              >
                View in Journal & Ledger
              </button>
            </div>
          </div>
        )}
      </SlideOverPanel>
    </div>
  );
};
