import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, AlertTriangle, Save, ShieldCheck } from 'lucide-react';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { useTithes } from '../../context/TithesContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { formatDate } from '../../utils/formatters.js';
import {
  calculateTitheBatchSummary,
  standardizeEnvelopeNumber,
  type TitheBatch,
} from '@church/domain';

interface FastBatchEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: TitheBatch;
}

interface BatchRow {
  key: string;
  envelopeNumber: string;
  memberId: string;
  memberName: string;
  method: 'ENVELOPE' | 'CHEQUE' | 'MOMO';
  amountStr: string;
  notes?: string;
}

export const FastBatchEntryModal: React.FC<FastBatchEntryModalProps> = ({
  isOpen,
  onClose,
  batch,
}) => {
  const { records, saveBatchDraft, reconcileBatch, postBatch } = useTithes();
  const { members } = useGiving();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  useModalEscape(isOpen, onClose);

  // Initialize rows from existing batch records
  const [rows, setRows] = useState<BatchRow[]>(() => {
    const batchRecords = records.filter((r) => r.batchId === batch.id && !r.isReversal);
    if (batchRecords.length > 0) {
      return batchRecords.map((r, idx) => ({
        key: `row-${idx}-${r.id}`,
        envelopeNumber: r.envelopeNumber || '',
        memberId: r.memberId,
        memberName: r.memberName,
        method: (r.method === 'CHEQUE' || r.method === 'MOMO' ? r.method : 'ENVELOPE') as any,
        amountStr: (Number(r.amount) / 100).toFixed(2),
        notes: r.notes || '',
      }));
    }
    // Default 5 empty rows
    return Array.from({ length: 5 }).map((_, idx) => ({
      key: `row-${Date.now()}-${idx}`,
      envelopeNumber: '',
      memberId: '',
      memberName: '',
      method: 'ENVELOPE',
      amountStr: '',
      notes: '',
    }));
  });

  const [explainedUnallocatedStr, setExplainedUnallocatedStr] = useState<string>(() => {
    return batch.explainedUnallocated ? (Number(batch.explainedUnallocated) / 100).toFixed(2) : '';
  });
  const [unallocatedReason, setUnallocatedReason] = useState<string>(batch.unallocatedReason || '');
  const [showExplanationBox, setShowExplanationBox] = useState<boolean>(Boolean(batch.explainedUnallocated || batch.unallocatedReason));

  const isReadOnly = batch.status === 'POSTED';

  // Calculate live totals
  const parsedRecords = rows.map((r) => {
    const num = parseFloat(r.amountStr);
    const amt = isNaN(num) || num <= 0 ? 0n : BigInt(Math.round(num * 100));
    return { amount: amt };
  });

  const parsedExplainedNum = parseFloat(explainedUnallocatedStr);
  const parsedExplainedUnallocated =
    isNaN(parsedExplainedNum) || parsedExplainedNum <= 0
      ? 0n
      : BigInt(Math.round(parsedExplainedNum * 100));

  const summary = calculateTitheBatchSummary(
    batch.countedTotal,
    parsedRecords,
    parsedExplainedUnallocated
  );

  const payersCount = rows.filter((r) => {
    const val = parseFloat(r.amountStr);
    return !isNaN(val) && val > 0 && r.memberId;
  }).length;

  const handleEnvelopeChange = (index: number, rawVal: string) => {
    const normalized = standardizeEnvelopeNumber(rawVal);
    const matchedMember = members.find(
      (m) =>
        (m.envelopeNumber && m.envelopeNumber.toUpperCase() === normalized.toUpperCase()) ||
        (m.envelopeNumber && m.envelopeNumber.replace(/\D/g, '') === rawVal.replace(/\D/g, ''))
    );

    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (matchedMember) {
          const name = `${matchedMember.title ? matchedMember.title + ' ' : ''}${
            matchedMember.fullName || `${matchedMember.firstName} ${matchedMember.lastName}`
          }`;
          return {
            ...r,
            envelopeNumber: matchedMember.envelopeNumber || normalized,
            memberId: matchedMember.id,
            memberName: name,
          };
        }
        return {
          ...r,
          envelopeNumber: rawVal,
        };
      })
    );
  };

  const handleMemberChange = (index: number, memberId: string) => {
    const matched = members.find((m) => m.id === memberId);
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (matched) {
          const name = `${matched.title ? matched.title + ' ' : ''}${
            matched.fullName || `${matched.firstName} ${matched.lastName}`
          }`;
          return {
            ...r,
            memberId: matched.id,
            memberName: name,
            envelopeNumber: matched.envelopeNumber || r.envelopeNumber,
          };
        }
        return { ...r, memberId: '', memberName: '' };
      })
    );
  };

  const handleRowChange = (index: number, field: keyof BatchRow, val: any) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${prev.length}`,
        envelopeNumber: '',
        memberId: '',
        memberName: '',
        method: 'ENVELOPE',
        amountStr: '',
        notes: '',
      },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        handleAddRow();
      } else {
        // Focus the next row's envelope input
        const nextInput = document.getElementById(`envelope-input-${index + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  const handleSaveDraft = () => {
    const validRows = rows.filter((r) => {
      const amt = parseFloat(r.amountStr);
      return !isNaN(amt) && amt > 0 && r.memberId;
    });

    const recordsToSave = validRows.map((r) => ({
      memberId: r.memberId,
      memberName: r.memberName,
      envelopeNumber: r.envelopeNumber,
      amount: BigInt(Math.round(parseFloat(r.amountStr) * 100)),
      currency: batch.currency,
      method: r.method,
      notes: r.notes,
      recordDate: batch.serviceDate,
      recordedBy: currentUser?.fullName || 'Finance Secretary',
    }));

    saveBatchDraft(
      batch.id,
      recordsToSave,
      parsedExplainedUnallocated,
      unallocatedReason.trim()
    );

    showToast('Tithe batch draft saved successfully.', 'success');
  };

  const handleReconcile = () => {
    handleSaveDraft();
    const result = reconcileBatch(batch.id);
    if (result.success) {
      showToast('Tithe batch reconciled and verified.', 'success');
    } else {
      showToast(result.error || 'Failed to reconcile batch.', 'error');
    }
  };

  const handlePost = () => {
    handleSaveDraft();
    const result = postBatch(batch.id);
    if (result.success) {
      showToast('Tithe batch verified and posted to sub-ledger. Batch is now read-only.', 'success');
      onClose();
    } else {
      showToast(result.error || 'Failed to post batch.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--surface-border)] flex items-center justify-between shrink-0 bg-[var(--surface-panel)]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-[19px] font-semibold text-[var(--text-primary)]">
                Tithe Batch: {formatDate(batch.serviceDate)}
              </h2>
              <StatusDot
                status={batch.status === 'POSTED' ? 'healthy' : 'attention'}
                label={batch.status === 'POSTED' ? 'Posted' : 'Draft'}
              />
              <span className="text-[12px] font-medium text-[var(--text-muted)]">
                ({batch.serviceName})
              </span>
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Source: Counting Sheet {batch.countingSheetId} · Fast Entry Grid
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticky Reconciliation Summary Strip (Rule A3) */}
        <div className="px-5 py-3 border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/70 flex flex-wrap items-center justify-between gap-4 text-[13px] shrink-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <div>
              <span className="text-[var(--text-muted)]">Counted Tithes: </span>
              <span className="font-semibold tabular-nums">
                <MoneyCell amount={batch.countedTotal} currency={batch.currency} />
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Allocated: </span>
              <span className="font-semibold tabular-nums">
                <MoneyCell amount={summary.allocatedTotal} currency={batch.currency} />
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Unallocated Variance: </span>
              <span
                className={`font-semibold tabular-nums ${
                  summary.unexplainedVariance === 0n
                    ? 'text-[var(--text-primary)]'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <MoneyCell amount={summary.unexplainedVariance} currency={batch.currency} />
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Contributing Payers: </span>
              <span className="font-semibold tabular-nums">{payersCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {summary.isBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Balanced to Zero
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowExplanationBox((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Explain Difference</span>
              </button>
            )}
          </div>
        </div>

        {/* Unallocated Explanation Accordion */}
        {showExplanationBox && !isReadOnly && (
          <div className="px-5 py-3 border-b border-[var(--surface-border)] bg-amber-50/50 dark:bg-amber-950/20 text-[12px] flex flex-col sm:flex-row gap-3 items-start sm:items-center shrink-0">
            <span className="font-semibold text-amber-800 dark:text-amber-200 whitespace-nowrap">
              Explain Unallocated Amount:
            </span>
            <div className="flex items-center gap-2 flex-1 w-full">
              <input
                type="number"
                step="0.01"
                placeholder="Explained Amount (e.g. 350.00)"
                value={explainedUnallocatedStr}
                onChange={(e) => setExplainedUnallocatedStr(e.target.value)}
                className="w-32 px-2.5 py-1 text-[12px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-right tabular-nums focus:outline-none"
              />
              <input
                type="text"
                placeholder="Reason (e.g. Unreadable damaged envelope / Anonymous cash gift)"
                value={unallocatedReason}
                onChange={(e) => setUnallocatedReason(e.target.value)}
                className="flex-1 px-2.5 py-1 text-[12px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Fast Data Entry Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-medium text-left">
                <th className="py-2 px-2 w-8 text-center">#</th>
                <th className="py-2 px-2 w-28">Envelope</th>
                <th className="py-2 px-2">Member</th>
                <th className="py-2 px-2 w-28">Method</th>
                <th className="py-2 px-2 w-32 text-right">Amount (GHS)</th>
                {!isReadOnly && <th className="py-2 px-2 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {rows.map((row, idx) => (
                <tr key={row.key} className="hover:bg-[var(--surface-subtle)]/40">
                  <td className="py-1.5 px-2 text-center text-[var(--text-muted)] text-[12px]">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      id={`envelope-input-${idx}`}
                      type="text"
                      placeholder="e.g. 12"
                      value={row.envelopeNumber}
                      disabled={isReadOnly}
                      onChange={(e) => handleEnvelopeChange(idx, e.target.value)}
                      className="w-full px-2 py-1 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono text-[12px]"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.memberId}
                      disabled={isReadOnly}
                      onChange={(e) => handleMemberChange(idx, e.target.value)}
                      className="w-full px-2 py-1 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      <option value="">Select member...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title ? `${m.title} ` : ''}{m.fullName || `${m.firstName} ${m.lastName}`} ({m.envelopeNumber || 'No Env'})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.method}
                      disabled={isReadOnly}
                      onChange={(e) => handleRowChange(idx, 'method', e.target.value)}
                      className="w-full px-2 py-1 text-[12px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      <option value="ENVELOPE">Envelope</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="MOMO">MoMo</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.amountStr}
                      disabled={isReadOnly}
                      onChange={(e) => handleRowChange(idx, 'amountStr', e.target.value)}
                      onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                      className="w-full px-2 py-1 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  {!isReadOnly && (
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {!isReadOnly && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-dashed border-[var(--surface-border)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row (or press Enter in Amount)</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--surface-border)] bg-[var(--surface-panel)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-[var(--text-muted)]">
            {isReadOnly ? (
              <span>This batch has been posted and verified. It is read-only.</span>
            ) : (
              <span>Tab or Enter advances cell by cell. Autosaves locally on offline devices.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleReconcile}
                  disabled={!summary.canReconcile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius)] border border-[var(--accent)] text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reconcile Batch</span>
                </button>

                {currentUser?.role === 'Treasurer' && (
                  <button
                    type="button"
                    onClick={handlePost}
                    disabled={!summary.canPost}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius)] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Post</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
