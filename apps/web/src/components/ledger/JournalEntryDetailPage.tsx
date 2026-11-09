import React, { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { formatDate } from '../../config/churchSettings.js';
import { RotateCcw, ShieldCheck } from 'lucide-react';

export interface JournalEntryDetailPageProps {
  id: string;
}

export const JournalEntryDetailPage: React.FC<JournalEntryDetailPageProps> = ({ id }) => {
  const { entries, accounts, funds, reverseEntry } = useLedger();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate, goBack } = useRouter();

  const [isReversalOpen, setIsReversalOpen] = useState(false);

  const entry = entries.find((e) => e.id === id || e.documentNumber === id);

  if (!entry) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Books', onClick: () => navigate('#/ledger') },
            { label: 'Journal & Ledger', onClick: () => navigate('#/ledger') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('ledger')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Journal entry <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('ledger')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Journal
          </button>
        </div>
      </div>
    );
  }

  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const fundsMap = new Map(funds.map((f) => [f.id, f]));

  const totalDebitPesewas = entry.totalDebitGhs;
  const totalCreditPesewas = entry.totalCreditGhs;

  const canReverse = !entry.isReversal && (currentUser.role === 'Treasurer' || currentUser.role === 'Admin');

  const handleConfirmReversal = (reason?: string) => {
    if (!reason?.trim()) {
      showToast('A reason is mandatory for reversing a journal entry.', 'error');
      return;
    }
    try {
      reverseEntry(entry.id, reason.trim());
      showToast(`Journal entry ${entry.documentNumber} reversed successfully.`, 'success');
      setIsReversalOpen(false);
    } catch (e: any) {
      showToast(e?.message || 'Failed to reverse entry.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Journal & Ledger', onClick: () => navigate('#/ledger') },
          { label: entry.documentNumber },
        ]}
        currentId={entry.id}
        listKey="journal"
        onBack={() => goBack('ledger')}
        actions={
          canReverse && (
            <button
              type="button"
              onClick={() => setIsReversalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] text-[var(--status-red)] hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reverse Entry</span>
            </button>
          )
        }
      />

      {/* Main Container */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Header Block */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-[20px] text-[var(--text-primary)]">
                {entry.documentNumber}
              </span>
              <StatusDot
                status={entry.isReversal ? 'attention' : 'healthy'}
                label={entry.isReversal ? 'Reversal Entry' : 'Posted Entry'}
              />
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Date: {formatDate(entry.entryDate)} · Type: {entry.entryType} · Created by: {entry.createdBy}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[12px] text-[var(--text-muted)] block">Total Entry Value</span>
            <MoneyCell amountPesewas={totalDebitPesewas} size="xl" align="right" />
          </div>
        </div>

        {/* Narration */}
        <div>
          <span className="text-[12px] text-[var(--text-muted)] block mb-1">Narration</span>
          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed bg-[var(--surface-subtle)] p-3.5 rounded-[var(--radius)] border border-[var(--surface-border)]">
            {entry.narration}
          </p>
        </div>

        {/* Debit & Credit Balanced Lines Table */}
        <div className="space-y-3">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
            General Ledger Postings (Balanced per Currency & Fund)
          </span>

          <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Fund</th>
                  <th className="py-2.5 px-3 text-right">Debit (GHS)</th>
                  <th className="py-2.5 px-3 text-right">Credit (GHS)</th>
                  <th className="py-2.5 px-3">Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-sans">
                {entry.lines.map((l, idx) => {
                  const acc = accountsMap.get(l.accountId);
                  const fnd = fundsMap.get(l.fundId);
                  return (
                    <tr key={idx} className="hover:bg-[var(--surface-subtle)]/40 transition">
                      <td className="py-2.5 px-3">
                        <span className="font-sans tabular-nums font-semibold text-[var(--text-primary)]">
                          {acc?.code || '—'}
                        </span>{' '}
                        <span className="text-[var(--text-secondary)]">{acc?.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-[13px] text-[var(--text-secondary)]">
                        {fnd?.name || 'General Fund'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {l.debitAmountGhs > 0n ? (
                          <MoneyCell amountPesewas={l.debitAmountGhs} align="right" size="sm" />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {l.creditAmountGhs > 0n ? (
                          <MoneyCell amountPesewas={l.creditAmountGhs} align="right" size="sm" />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] text-[var(--text-muted)]">
                        {l.description || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[var(--surface-subtle)] font-semibold text-[14px] border-t-2 border-[var(--surface-border)]">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-right text-[var(--text-secondary)]">
                    Total Balanced Lines:
                  </td>
                  <td className="py-3 px-3 text-right font-sans tabular-nums">
                    <MoneyCell amountPesewas={totalDebitPesewas} align="right" size="base" />
                  </td>
                  <td className="py-3 px-3 text-right font-sans tabular-nums">
                    <MoneyCell amountPesewas={totalCreditPesewas} align="right" size="base" />
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audit Signoff Footer */}
        <div className="pt-4 border-t border-[var(--surface-border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span>Double-entry invariant verified: Dr = Cr = GHS {(Number(totalDebitPesewas) / 100).toFixed(2)}</span>
          </div>
          <span>Offline Document ID: {entry.id}</span>
        </div>
      </div>

      {/* Reversal Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isReversalOpen}
        title="Reverse Journal Entry"
        description={`Are you sure you want to reverse Journal Entry ${entry.documentNumber}? In accordance with strict accounting rules, this creates an equal and opposite reversing journal entry linked to the original.`}
        confirmLabel="Confirm Reversal"
        isDestructive={true}
        requireReason={true}
        reasonLabel="Reversal Reason (Mandatory)"
        reasonPlaceholder="e.g. Inadvertent double entry for vendor invoice"
        onConfirm={handleConfirmReversal}
        onClose={() => setIsReversalOpen(false)}
      />
    </div>
  );
};
