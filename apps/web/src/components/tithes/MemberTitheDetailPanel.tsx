import React, { useState, useEffect } from 'react';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { FileText, CheckCircle2 } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { AnnualTitheStatementModal } from './AnnualTitheStatementModal.js';
import { formatDate } from '../../utils/formatters.js';

interface MemberTitheDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string | null;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MemberTitheDetailPanel: React.FC<MemberTitheDetailPanelProps> = ({
  isOpen,
  onClose,
  memberId,
}) => {
  const { getMemberSummary, logMemberTithesView } = useTithes();
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const summary = memberId ? getMemberSummary(memberId, 2026, 10) : null;

  useEffect(() => {
    if (isOpen && summary) {
      logMemberTithesView(summary.memberId, summary.memberName);
    }
  }, [isOpen, summary?.memberId, summary?.memberName, logMemberTithesView]);

  if (!isOpen || !summary) return null;

  return (
    <>
      <SlideOverPanel
        isOpen={isOpen}
        onClose={onClose}
        title={summary.memberName}
        subtitle={`${summary.envelopeNumber || 'No Envelope'} · Member ID: ${summary.memberId}`}
        width="max-w-[560px]"
        actions={
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] text-[var(--text-muted)]">
              Confidential · Access is logged
            </span>
            <button
              onClick={() => setIsStatementOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              <FileText className="w-4 h-4" />
              <span>Annual Statement</span>
            </button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          {/* Plain Status Line Summary (Rule A3 & Spec 2.3) */}
          <div className="py-2.5 px-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[13px] leading-relaxed text-[var(--text-primary)]">
            <span className="font-semibold">YTD Total: </span>
            <MoneyCell amount={summary.ytdTotal} currency="GHS" />
            <span className="text-[var(--text-muted)] mx-2">·</span>
            <span className="font-semibold">Months Paid: </span>
            <span>{summary.monthsPaidCount} of {summary.monthsElapsedCount}</span>
            <span className="text-[var(--text-muted)] mx-2">·</span>
            <span className="font-semibold">Consistency: </span>
            <span>{summary.consistencyPercentage}%</span>
          </div>

          {/* Last Tithe Received */}
          {summary.lastTitheDate && (
            <div className="flex items-center justify-between text-[13px] px-1 text-[var(--text-muted)]">
              <span>Last tithe received:</span>
              <span className="font-medium text-[var(--text-primary)]">
                {formatDate(summary.lastTitheDate)} ({summary.lastTitheAmount ? formatPesewas(summary.lastTitheAmount) : '—'} GHS)
              </span>
            </div>
          )}

          {/* 12-Month Tithe Progress Grid */}
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              2026 Monthly Tithe Record
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {MONTH_SHORT.map((mShort, idx) => {
                const monthNum = idx + 1;
                const amt = summary.monthlyTotals[monthNum] || 0n;
                const hasPaid = amt > 0n;
                const isPastOrCurrent = monthNum <= summary.monthsElapsedCount;

                return (
                  <div
                    key={mShort}
                    className={`p-2 rounded-[var(--radius)] border text-center transition-colors ${
                      hasPaid
                        ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 text-[var(--text-primary)]'
                        : isPastOrCurrent
                        ? 'border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]'
                        : 'border-dashed border-[var(--surface-border)] text-[var(--text-muted)] opacity-50'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase">{mShort}</div>
                    <div className="text-[12px] font-medium mt-1 tabular-nums">
                      {hasPaid ? formatPesewas(amt) : '—'}
                    </div>
                    <div className="flex justify-center mt-1">
                      {hasPaid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                      ) : isPastOrCurrent ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]/40 my-1" />
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="space-y-2 pt-2">
            <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Individual Contributions ({summary.records.length})
            </div>
            <div className="border border-[var(--surface-border)] rounded-[var(--radius)] overflow-hidden">
              <table className="w-full text-[13px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Reference / Batch</th>
                    <th className="py-2 px-3 text-right">Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {summary.records.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[var(--text-muted)]">
                        No tithe records logged for this member.
                      </td>
                    </tr>
                  ) : (
                    summary.records.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-[var(--surface-subtle)]/40 ${
                          r.isReversal ? 'line-through text-[var(--text-muted)]' : ''
                        }`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          {formatDate(r.recordDate)}
                        </td>
                        <td className="py-2 px-3 text-[12px]">
                          <span className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                            {r.method}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[12px] text-[var(--text-muted)] truncate max-w-[140px]" title={r.notes || r.batchId || 'Direct'}>
                          {r.batchId ? r.batchId.replace('tb-', 'Batch ') : (r.notes || 'Direct')}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">
                          <MoneyCell amount={r.amount} currency={r.currency} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SlideOverPanel>

      {/* Printable Annual Tithe Statement Modal */}
      <AnnualTitheStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        summary={summary}
        year={2026}
      />
    </>
  );
};

function formatPesewas(amount: bigint): string {
  const isNeg = amount < 0n;
  const abs = isNeg ? -amount : amount;
  const major = abs / 100n;
  const minor = abs % 100n;
  const formatted = `${major.toLocaleString('en-US')}.${minor.toString().padStart(2, '0')}`;
  return isNeg ? `(${formatted})` : formatted;
}
