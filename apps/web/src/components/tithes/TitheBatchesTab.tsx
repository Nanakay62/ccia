import React, { useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { formatDate } from '../../utils/formatters.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { useRouter } from '../../context/RouterContext.js';
import type { TitheBatch } from '@church/domain';

export const TitheBatchesTab: React.FC = () => {
  const { batches, postBatch, deleteDraftBatch } = useTithes();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [batchToDelete, setBatchToDelete] = useState<TitheBatch | null>(null);

  // Month stats for October 2026
  const octoberBatches = batches.filter((b) => b.serviceDate.startsWith('2026-10'));
  const reconciledOrPostedCount = octoberBatches.filter(
    (b) => b.status === 'RECONCILED' || b.status === 'POSTED'
  ).length;
  const totalCounted = octoberBatches.reduce((sum, b) => sum + b.countedTotal, 0n);
  const totalAllocated = octoberBatches.reduce((sum, b) => sum + b.allocatedTotal, 0n);
  const totalUnallocated = octoberBatches.reduce((sum, b) => sum + b.unallocatedTotal, 0n);

  const handlePostBatch = (batchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = postBatch(batchId);
    if (result.success) {
      showToast('Tithe batch verified and posted to sub-ledger.', 'success');
    } else {
      showToast(result.error || 'Failed to post batch.', 'error');
    }
  };

  const handleConfirmDeleteBatch = () => {
    if (!batchToDelete) return;
    const result = deleteDraftBatch(batchToDelete.id);
    if (result.success) {
      showToast('Draft tithe batch deleted successfully.', 'success');
    } else {
      showToast(result.error || 'Failed to delete batch.', 'error');
    }
    setBatchToDelete(null);
  };

  const canManageBatches =
    currentUser?.role === 'Finance Secretary' || currentUser?.role === 'Treasurer';

  return (
    <div className="space-y-4">
      {/* Monthly Status Line (Spec Section 2.3) */}
      <div className="py-2.5 px-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-primary)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-[var(--text-primary)]">
            October 2026: {reconciledOrPostedCount} of {octoberBatches.length} services reconciled
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>
            Counted: <strong className="font-sans tabular-nums"><MoneyCell amount={totalCounted} currency="GHS" /></strong>
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>
            Allocated: <strong className="font-sans tabular-nums"><MoneyCell amount={totalAllocated} currency="GHS" /></strong>
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>
            Unallocated:{' '}
            <strong
              className={`font-sans tabular-nums ${
                totalUnallocated > 0n ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''
              }`}
            >
              <MoneyCell amount={totalUnallocated} currency="GHS" />
            </strong>
          </span>
        </div>

        {canManageBatches && (
          <button
            onClick={() => navigate('#/tithes/batches/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>New Batch from Counting Sheet</span>
          </button>
        )}
      </div>

      {/* Batches Table */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
        <table className="w-full text-[13px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
              <th className="py-2.5 px-4">Service Date</th>
              <th className="py-2.5 px-4">Service & Source</th>
              <th className="py-2.5 px-4 text-right">Counted Total</th>
              <th className="py-2.5 px-4 text-right">Allocated Total</th>
              <th className="py-2.5 px-4 text-right">Unallocated</th>
              <th className="py-2.5 px-4 text-center">Payers</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {batches.map((batch) => {
              const isUnbalanced = batch.unallocatedTotal > 0n;
              const isDraft = batch.status !== 'POSTED';

              return (
                <tr
                  key={batch.id}
                  onClick={() =>
                    navigate(`#/tithes/batches/${batch.id}`, {
                      listKey: 'tithe-batches',
                      listItemIds: batches.map((b) => b.id),
                    })
                  }
                  className="hover:bg-[var(--surface-subtle)]/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-medium whitespace-nowrap text-[var(--text-primary)]">
                    {formatDate(batch.serviceDate)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[var(--text-primary)]">
                      {batch.serviceName}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Counting sheet: {batch.countingSheetId}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium font-sans tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={batch.countedTotal} currency={batch.currency} />
                  </td>
                  <td className="py-3 px-4 text-right font-medium font-sans tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={batch.allocatedTotal} currency={batch.currency} />
                  </td>
                  <td className="py-3 px-4 text-right font-medium font-sans tabular-nums">
                    <span
                      className={
                        isUnbalanced
                          ? 'text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-[var(--text-muted)]'
                      }
                    >
                      <MoneyCell amount={batch.unallocatedTotal} currency={batch.currency} />
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans tabular-nums text-[var(--text-primary)]">
                    {batch.recordsCount}
                  </td>
                  <td className="py-3 px-4">
                    <StatusDot
                      status={batch.status === 'POSTED' ? 'healthy' : 'attention'}
                      label={batch.status === 'POSTED' ? 'Posted' : 'Draft'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() =>
                          navigate(`#/tithes/batches/${batch.id}`, {
                            listKey: 'tithe-batches',
                            listItemIds: batches.map((b) => b.id),
                          })
                        }
                        className="px-2.5 py-1 rounded text-[12px] font-medium border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                      >
                        {batch.status === 'POSTED' ? 'View' : 'Fast Entry'}
                      </button>

                      {batch.status === 'RECONCILED' && currentUser?.role === 'Treasurer' && (
                        <button
                          onClick={(e) => handlePostBatch(batch.id, e)}
                          className="px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify & Post</span>
                        </button>
                      )}

                      {/* Delete Draft Batch (Requirement: batches that have not been posted can be deleted) */}
                      {isDraft && canManageBatches && (
                        <button
                          type="button"
                          onClick={() => setBatchToDelete(batch)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Delete unposted draft batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog for Deleting Draft Batch */}
      {batchToDelete && (
        <ConfirmationDialog
          isOpen={Boolean(batchToDelete)}
          onClose={() => setBatchToDelete(null)}
          title="Delete Draft Tithe Batch?"
          description={`Are you sure you want to delete the unposted draft batch for ${batchToDelete.serviceName} (${formatDate(batchToDelete.serviceDate)})? Counted target was GHS ${(Number(batchToDelete.countedTotal) / 100).toFixed(2)}.`}
          confirmLabel="Delete Draft Batch"
          isDestructive={true}
          onConfirm={handleConfirmDeleteBatch}
        />
      )}
    </div>
  );
};
