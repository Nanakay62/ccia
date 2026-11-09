import React, { useState } from 'react';
import { useTithes } from '../../context/TithesContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { formatDate } from '../../utils/formatters.js';
import {
  calculateTitheBatchSummary,
  standardizeEnvelopeNumber,
} from '@church/domain';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Save,
  ShieldCheck,
} from 'lucide-react';

export interface TitheBatchDetailPageProps {
  id: string;
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

export const TitheBatchDetailPage: React.FC<TitheBatchDetailPageProps> = ({ id }) => {
  const { batches, records, saveBatchDraft, postBatch, deleteDraftBatch } = useTithes();
  const { members } = useGiving();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate, goBack } = useRouter();

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const batch = batches.find((b) => b.id === id);

  // Initialize rows from existing batch records
  const [rows, setRows] = useState<BatchRow[]>(() => {
    if (!batch) return [];
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
    return Array.from({ length: 6 }).map((_, idx) => ({
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
    return batch?.explainedUnallocated ? (Number(batch.explainedUnallocated) / 100).toFixed(2) : '';
  });
  const [unallocatedReason, setUnallocatedReason] = useState<string>(batch?.unallocatedReason || '');
  const [showExplanationBox, setShowExplanationBox] = useState<boolean>(
    Boolean(batch?.explainedUnallocated || batch?.unallocatedReason)
  );

  const isReadOnly = batch?.status === 'POSTED';

  if (!batch) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Tithes', onClick: () => navigate('#/tithes') },
            { label: 'Batches', onClick: () => navigate('#/tithes') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('tithes')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Tithe batch <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('tithes')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Tithe Batches
          </button>
        </div>
      </div>
    );
  }

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
    const num = parseFloat(r.amountStr);
    return !isNaN(num) && num > 0 && r.memberName.trim().length > 0;
  }).length;

  const handleRowChange = (index: number, field: keyof BatchRow, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const cur = { ...copy[index]!, [field]: value };

      // Autocomplete member name if envelope matches
      if (field === 'envelopeNumber') {
        const stdEnv = standardizeEnvelopeNumber(value);
        const match = members.find((m) => m.envelopeNumber === stdEnv || m.envelopeNumber === value.trim());
        if (match) {
          cur.memberId = match.id;
          cur.memberName = match.fullName;
        }
      }

      copy[index] = cur;
      return copy;
    });
  };

  const addRow = () => {
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

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: keyof BatchRow) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rows.length - 1) {
        addRow();
      } else {
        const nextInput = document.getElementById(`batch-input-${field}-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleSaveDraft = () => {
    try {
      const validRows = rows.filter((r) => {
        const num = parseFloat(r.amountStr);
        return !isNaN(num) && num > 0 && r.memberName.trim().length > 0;
      });

      const recordsToSave = validRows.map((r) => ({
        batchId: batch.id,
        envelopeNumber: r.envelopeNumber.trim() || undefined,
        memberId: r.memberId || `mem-unlisted-${Date.now()}`,
        memberName: r.memberName.trim(),
        recordDate: batch.serviceDate,
        amount: BigInt(Math.round(parseFloat(r.amountStr) * 100)),
        currency: batch.currency || 'GHS',
        method: r.method,
        notes: r.notes?.trim() || undefined,
        recordedBy: currentUser?.fullName || 'Finance Secretary',
      }));

      saveBatchDraft(
        batch.id,
        recordsToSave,
        parsedExplainedUnallocated,
        unallocatedReason.trim() || undefined
      );

      showToast(`Batch draft saved with ${validRows.length} entries.`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to save batch draft.', 'error');
    }
  };

  const handlePostBatch = () => {
    try {
      if (!summary.isBalanced) {
        showToast(
          `Batch has an unallocated difference of ${(Number(summary.unallocatedTotal) / 100).toFixed(2)} GHS. Please explain or reconcile to zero before posting.`,
          'error'
        );
        setShowExplanationBox(true);
        return;
      }

      handleSaveDraft();
      postBatch(batch.id);
      showToast(`Batch ${batch.serviceName || batch.id} posted to General Ledger and member records.`, 'success');
      goBack('tithes');
    } catch (e: any) {
      showToast(e?.message || 'Failed to post tithe batch.', 'error');
    }
  };

  const handleDeleteBatch = () => {
    if (!batch) return;
    const res = deleteDraftBatch(batch.id);
    if (res.success) {
      showToast('Draft tithe batch deleted successfully.', 'success');
      goBack('tithes');
    } else {
      showToast(res.error || 'Failed to delete batch.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-28 w-full">
      {/* Full-width Page Header & Breadcrumbs (Requirement 3) */}
      <PageBreadcrumb
        items={[
          { label: 'Tithes', onClick: () => navigate('#/tithes') },
          { label: 'Batches', onClick: () => navigate('#/tithes') },
          { label: batch.serviceName || batch.id },
        ]}
        currentId={batch.id}
        listKey="tithe-batch"
        onBack={() => goBack('tithes')}
        actions={
          <div className="flex items-center gap-2">
            <StatusDot
              status={batch.status === 'POSTED' ? 'healthy' : 'attention'}
              label={batch.status === 'POSTED' ? 'Posted & Locked' : 'Open Draft'}
            />
          </div>
        }
      />

      {/* Header Summary Strip (Full width, no box inside box) */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--surface-border-subtle)]">
          <div>
            <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
              {batch.serviceName}
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Service Date: {formatDate(batch.serviceDate)} · Counting Sheet: {batch.countingSheetId || 'CS-0042'}
            </p>
          </div>

          <div className="flex items-center gap-6 text-[14px]">
            <div>
              <span className="text-[12px] text-[var(--text-muted)] block">Counted Target</span>
              <MoneyCell amountPesewas={batch.countedTotal} size="lg" align="left" />
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-muted)] block">Allocated Total</span>
              <MoneyCell amountPesewas={summary.allocatedTotal} size="lg" align="left" />
            </div>
            <div>
              <span className="text-[12px] text-[var(--text-muted)] block">Unallocated Diff</span>
              <span
                className={`font-sans tabular-nums text-[18px] font-semibold ${
                  summary.isBalanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-[var(--status-red)]'
                }`}
              >
                {(Number(summary.unallocatedTotal) / 100).toFixed(2)} GHS
              </span>
            </div>
          </div>
        </div>

        {/* Status Line */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span>
              Sub-ledger allocation mode: assigns Sunday counting sheet tithe envelopes to individual member statements without double posting to GL.
            </span>
          </div>
          <span className="font-sans tabular-nums font-medium text-[var(--text-primary)]">
            {payersCount} active contributors entered
          </span>
        </div>
      </div>

      {/* Unallocated Explanation Block */}
      {showExplanationBox && (
        <div className="p-4 rounded-[var(--radius)] bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/50 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-[14px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Unallocated Envelope Difference Note (Mandatory for Non-Zero Discrepancy)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <div>
              <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                Explained Amount (GHS)
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={explainedUnallocatedStr}
                onChange={(e) => setExplainedUnallocatedStr(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 text-[14px] font-sans tabular-nums rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                Explanation / Justification Reason
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={unallocatedReason}
                onChange={(e) => setUnallocatedReason(e.target.value)}
                placeholder="e.g. Unmarked envelope without member name; credited to General Tithes control"
                className="w-full px-3 py-1.5 text-[14px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Full-Width Batch Entry Spreadsheet Grid (Requirement 3) */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] border-collapse">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] uppercase tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-36">Envelope No.</th>
                <th className="py-2.5 px-3">Member Name *</th>
                <th className="py-2.5 px-3 w-36">Method</th>
                <th className="py-2.5 px-3 w-40 text-right">Amount (GHS) *</th>
                <th className="py-2.5 px-3">Notes / Narration</th>
                {!isReadOnly && <th className="py-2.5 px-3 w-12 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)] font-sans">
              {rows.map((row, idx) => (
                <tr key={row.key} className="hover:bg-[var(--surface-subtle)]/40 transition">
                  <td className="py-2 px-3 text-center text-[12px] text-[var(--text-muted)] tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <input
                      id={`batch-input-envelopeNumber-${idx}`}
                      type="text"
                      disabled={isReadOnly}
                      value={row.envelopeNumber}
                      onChange={(e) => handleRowChange(idx, 'envelopeNumber', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'envelopeNumber')}
                      placeholder="ENV-001"
                      className="w-full px-2 py-1.5 text-[13px] font-sans tabular-nums rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      id={`batch-input-memberName-${idx}`}
                      type="text"
                      disabled={isReadOnly}
                      value={row.memberName}
                      onChange={(e) => handleRowChange(idx, 'memberName', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'memberName')}
                      placeholder="Type member name..."
                      className="w-full px-2 py-1.5 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      disabled={isReadOnly}
                      value={row.method}
                      onChange={(e) => handleRowChange(idx, 'method', e.target.value)}
                      className="w-full px-2 py-1.5 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      <option value="ENVELOPE">Cash Envelope</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="MOMO">Mobile Money</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      id={`batch-input-amountStr-${idx}`}
                      type="text"
                      disabled={isReadOnly}
                      value={row.amountStr}
                      onChange={(e) => handleRowChange(idx, 'amountStr', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'amountStr')}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 text-[14px] text-right font-sans tabular-nums font-medium rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      id={`batch-input-notes-${idx}`}
                      type="text"
                      disabled={isReadOnly}
                      value={row.notes || ''}
                      onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'notes')}
                      placeholder="Optional notes"
                      className="w-full px-2 py-1.5 text-[13px] rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  {!isReadOnly && (
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--status-red)] hover:bg-[var(--surface-subtle)] transition"
                        title="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--surface-subtle)] font-medium text-[14px] border-t-2 border-[var(--surface-border)]">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right text-[var(--text-secondary)]">
                  Total Tithes Allocated:
                </td>
                <td className="py-3 px-4 text-right font-sans tabular-nums font-semibold text-[var(--text-primary)]">
                  <MoneyCell amountPesewas={summary.allocatedTotal} align="right" size="base" />
                </td>
                <td colSpan={!isReadOnly ? 2 : 1}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!isReadOnly && (
          <div className="p-3 bg-[var(--surface-subtle)]/50 border-t border-[var(--surface-border)] flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-panel)] rounded border border-[var(--surface-border)] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row (or press Enter)</span>
            </button>

            <span className="text-[12px] text-[var(--text-muted)]">
              Keyboard tips: Tab moves across cells, Enter jumps to next row and creates new line automatically.
            </span>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface-panel)] border-t border-[var(--surface-border)] px-6 py-3.5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--text-muted)] font-medium">
            Batch {batch.serviceName || batch.id}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)]">·</span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Allocated: <MoneyCell amountPesewas={summary.allocatedTotal} />
          </span>
          <span className="text-[13px] text-[var(--text-secondary)]">·</span>
          <span className="text-[13px] text-[var(--text-muted)]">
            Target: <MoneyCell amountPesewas={batch.countedTotal} />
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="px-3.5 py-2 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-[var(--radius)] text-[13px] font-medium transition"
            >
              Delete Draft
            </button>
          )}

          <button
            type="button"
            onClick={() => goBack('tithes')}
            className="px-4 py-2 border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] rounded-[var(--radius)] text-[13px] font-medium transition"
          >
            Back to Batches
          </button>

          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius)] text-[13px] font-semibold transition"
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handlePostBatch}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--accent)] text-white hover:opacity-90 rounded-[var(--radius)] text-[13px] font-semibold transition shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Post Batch to Sub-Ledger</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Draft Batch Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Delete Draft Tithe Batch?"
        description={`Are you sure you want to delete the unposted tithe batch for ${batch.serviceName || batch.id} (${formatDate(batch.serviceDate)})? Unposted envelope records will be deleted.`}
        confirmLabel="Delete Draft Batch"
        isDestructive={true}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
};
