import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  User,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { DepreciationRun } from '@church/domain';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { StatusDot } from '../ui/StatusDot.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useAuth } from '../../context/AuthContext.js';

interface DepreciationRunDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  run: DepreciationRun | null;
}

export const DepreciationRunDetailPanel: React.FC<DepreciationRunDetailPanelProps> = ({
  isOpen,
  onClose,
  run,
}) => {
  const { reverseDepreciationRun } = useFixedAssets();
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const [isConfirmingReversal, setIsConfirmingReversal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!run) return null;

  const canReverse = role === 'Treasurer' && run.status === 'POSTED';

  const totalChargeFormatted = (Number(run.totalChargePesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <SlideOverPanel
        isOpen={isOpen}
        onClose={onClose}
        title={run.runNumber}
        subtitle={`Depreciation for ${run.period} · ${run.periodType}`}
        width="max-w-[500px]"
        actions={
          canReverse ? (
            <button
              type="button"
              onClick={() => setIsConfirmingReversal(true)}
              className="px-2.5 py-1.5 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded text-xs flex items-center gap-1 font-medium transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reverse Run
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Status and Header Card */}
          <div className="p-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded space-y-2">
            <div className="flex items-center justify-between">
              <StatusDot
                status={run.status === 'POSTED' ? 'approved' : 'inactive'}
                label={run.status}
              />
              <span className="font-mono text-xs text-[var(--text-muted)]">{run.runDate}</span>
            </div>

            <div className="pt-2 border-t border-[var(--surface-border)] flex items-baseline justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Total Depreciation Charge:</span>
              <span className="text-lg font-mono font-bold text-[#1e4620]">
                GHS {totalChargeFormatted}
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="p-3 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Journal Entry Ref:
              </span>
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {run.journalEntryId || 'Posted to GL'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Prepared By:
              </span>
              <span className="text-[var(--text-primary)] font-medium">{run.preparedBy}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved By (Treasurer):
              </span>
              <span className="text-[var(--text-primary)] font-medium">
                {run.approvedByTreasurer}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--surface-border)]">
              <span className="text-[var(--text-muted)]">Assets Summary:</span>
              <span className="text-[var(--text-primary)] font-medium">
                {run.totalEligibleAssets} depreciated · {run.totalSkippedAssets} skipped
              </span>
            </div>

            {run.status === 'REVERSED' && (
              <div className="pt-2 border-t border-red-100 text-red-700 bg-red-50/50 p-2 rounded text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Run Reversed
                </div>
                <div>Reason: {run.reversalReason || 'No reason specified'}</div>
                <div>Reversed by: {run.reversedBy} at {run.reversedAt?.slice(0, 10)}</div>
              </div>
            )}
          </div>

          {/* Asset Breakdown List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Asset Depreciation Lines ({run.lines.length})
            </h3>

            <div className="border border-[var(--surface-border)] rounded overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5">Asset</th>
                    <th className="py-2 px-2.5">Category</th>
                    <th className="py-2 px-2.5 text-right">Charge (GHS)</th>
                    <th className="py-2 px-2.5 text-right">Proj. NBV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {run.lines.map((line) => {
                    const charge = (Number(line.chargePesewas) / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    });
                    const nbv = (Number(line.projectedNetBookValuePesewas) / 100).toLocaleString(
                      'en-US',
                      { minimumFractionDigits: 2 }
                    );

                    return (
                      <tr key={line.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-2.5">
                          <div className="font-mono font-medium text-[var(--text-primary)]">
                            {line.assetNumber}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">
                            {line.description}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-[11px]">{line.categoryName}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-[var(--text-primary)]">
                          {line.status === 'ACTIVE' ? charge : <span className="text-[var(--text-muted)]">Skipped</span>}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-secondary)]">
                          {nbv}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SlideOverPanel>

      {/* Confirmation Dialog for Reversal */}
      <ConfirmationDialog
        isOpen={isConfirmingReversal}
        title={`Reverse Depreciation Run ${run.runNumber}`}
        description={`Are you sure you want to reverse this depreciation run? A balanced reversal entry will be posted to the General Ledger, and accumulated depreciation will be rolled back on all ${run.totalEligibleAssets} assets.`}
        confirmLabel="Reverse Run"
        cancelLabel="Cancel"
        isDestructive={true}
        requireReason={true}
        reasonLabel="Mandatory Reversal Reason"
        reasonPlaceholder="e.g., Run posted with incorrect period dates or misclassified assets"
        onConfirm={(reason) => {
          if (reason) {
            const res = reverseDepreciationRun(run.id, reason);
            if (!res.success) {
              setErrorMsg(res.error || 'Failed to reverse run');
            } else {
              setIsConfirmingReversal(false);
              onClose();
            }
          }
        }}
        onClose={() => {
          setIsConfirmingReversal(false);
          setErrorMsg(null);
        }}
      />
    </>
  );
};
