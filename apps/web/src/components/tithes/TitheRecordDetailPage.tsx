import React, { useState, useEffect } from 'react';
import { useTithes } from '../../context/TithesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate, formatPesewas } from '../../utils/formatters.js';
import { AnnualTitheStatementModal } from './AnnualTitheStatementModal.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import {
  FileText,
  RotateCcw,
  ShieldAlert,
  User,
} from 'lucide-react';

export interface TitheRecordDetailPageProps {
  id: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TitheRecordDetailPage: React.FC<TitheRecordDetailPageProps> = ({ id }) => {
  const { records, getMemberSummary, reverseTithe, logMemberTithesView } = useTithes();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate, goBack } = useRouter();

  // Find record or member
  const record = records.find((r) => r.id === id);
  const memberId = record ? record.memberId : id;
  const summary = getMemberSummary(memberId, 2026, 10);

  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  useEffect(() => {
    if (summary) {
      logMemberTithesView(summary.memberId, summary.memberName);
    }
  }, [summary, logMemberTithesView]);

  if (!summary) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Tithes', onClick: () => navigate('#/tithes') },
            { label: 'Records', onClick: () => navigate('#/tithes') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('tithes')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Tithe record or member <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('tithes')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Tithe Records
          </button>
        </div>
      </div>
    );
  }

  const handleConfirmReversal = () => {
    if (!record) return;
    if (!reversalReason.trim()) {
      showToast('A reason is mandatory for reversing a tithe record.', 'error');
      return;
    }
    try {
      reverseTithe(record.id, reversalReason.trim());
      showToast(`Tithe record for ${record.memberName} successfully reversed.`, 'success');
      setIsReversalOpen(false);
      setReversalReason('');
    } catch (e: any) {
      showToast(e?.message || 'Failed to reverse tithe record.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Tithes', onClick: () => navigate('#/tithes') },
          { label: 'Records', onClick: () => navigate('#/tithes') },
          { label: summary.memberName },
        ]}
        currentId={id}
        listKey="tithe-record"
        onBack={() => goBack('tithes')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStatementOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius)] hover:opacity-90 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Annual Statement</span>
            </button>
          </div>
        }
      />

      {/* Confidential Warning Line (Ghana Data Protection Act) */}
      <div className="py-2.5 px-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between text-[13px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>
            Individual tithe records are confidential under church governance rules and the Ghana Data Protection Act. Access is logged.
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--text-muted)]">Audit Enabled</span>
      </div>

      {/* Main Container */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Member Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--accent)]">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-semibold text-[20px] text-[var(--text-primary)]">
                {summary.memberName}
              </h1>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                Envelope: <strong className="text-[var(--text-primary)]">{summary.envelopeNumber || 'Unassigned'}</strong> · Member ID: {summary.memberId}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-6 text-[14px]">
            <div>
              <span className="text-[12px] text-[var(--text-muted)] block">YTD Total Tithes</span>
              <MoneyCell amount={summary.ytdTotal} size="lg" align="left" />
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-muted)] block">Giving Consistency</span>
              <span className="font-sans tabular-nums text-[18px] font-semibold text-[var(--accent)]">
                {summary.consistencyPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* 12-Month Tithe Progress Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              2026 Monthly Tithe Record
            </span>
            <span className="text-[12px] text-[var(--text-muted)] font-sans tabular-nums">
              {summary.monthsPaidCount} of {summary.monthsElapsedCount} months contributed
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {MONTH_SHORT.map((mShort, idx) => {
              const monthNum = idx + 1;
              const amt = summary.monthlyTotals[monthNum] || 0n;
              const hasPaid = amt > 0n;
              const isPastOrCurrent = monthNum <= summary.monthsElapsedCount;

              return (
                <div
                  key={mShort}
                  className={`p-3 rounded-[var(--radius)] border text-center transition-colors ${
                    hasPaid
                      ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 text-[var(--text-primary)]'
                      : isPastOrCurrent
                      ? 'border-dashed border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]'
                      : 'border-[var(--surface-border-subtle)] opacity-40 text-[var(--text-muted)]'
                  }`}
                >
                  <div className="text-[12px] font-medium mb-1">{mShort}</div>
                  <div className="text-[13px] font-sans tabular-nums font-semibold">
                    {hasPaid ? `${formatPesewas(amt)}` : isPastOrCurrent ? '—' : '·'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Record Detail (if navigated via a specific record) */}
        {record && (
          <div className="pt-4 border-t border-[var(--surface-border-subtle)] space-y-3">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
              Individual Transaction Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px] p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Transaction Date</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatDate(record.recordDate)}
                </span>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Tithe Amount</span>
                <MoneyCell amount={record.amount} align="left" size="sm" />
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Contribution Method</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {record.method}
                </span>
              </div>
            </div>

            {/* Reversal Action for Finance Secretary / Treasurer */}
            {!record.isReversal && (currentUser.role === 'Treasurer' || currentUser.role === 'Finance Secretary') && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsReversalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--surface-border)] hover:border-[var(--status-red)] text-[var(--status-red)] rounded-[var(--radius)] text-[12px] font-medium transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reverse this tithe entry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Annual Statement Modal */}
      {isStatementOpen && (
        <AnnualTitheStatementModal
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          summary={summary}
          year={2026}
        />
      )}

      {/* Reversal Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isReversalOpen}
        onClose={() => setIsReversalOpen(false)}
        title="Reverse Tithe Record"
        description={`Are you sure you want to reverse the tithe entry of ${record ? formatPesewas(record.amount) : '0.00'} GHS for ${summary.memberName}? Accounting rules require an append-only reversal.`}
        confirmLabel="Confirm Reversal"
        isDestructive={true}
        requireReason={true}
        reasonLabel="Reversal Reason (Mandatory)"
        reasonPlaceholder="e.g. Assigned to incorrect envelope; member name corrected"
        onConfirm={(reason) => {
          if (reason) setReversalReason(reason);
          handleConfirmReversal();
        }}
      />
    </div>
  );
};
