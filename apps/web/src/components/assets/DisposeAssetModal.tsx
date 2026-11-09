import React, { useState, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { FixedAssetRecord, DisposalType } from '@church/domain';
import { calculateDisposalGainLoss } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface DisposeAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetRecord;
}

export const DisposeAssetModal: React.FC<DisposeAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  useModalEscape(isOpen, onClose);
  const { disposeAsset } = useFixedAssets();

  const [disposalType, setDisposalType] = useState<DisposalType>('SOLD');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [proceedsInput, setProceedsInput] = useState('');
  const [buyerOrRecipient, setBuyerOrRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [approvedByPastorOrElder, setApprovedByPastorOrElder] = useState('Rev. Kwame Boateng');
  const [error, setError] = useState<string | null>(null);

  const costGhs = asset.costInGhsPesewas;
  const accDepGhs = asset.accumulatedDepreciationPesewas;

  const proceedsPesewas = useMemo(() => {
    const p = parseFloat(proceedsInput);
    if (isNaN(p) || p <= 0) return 0n;
    return BigInt(Math.round(p * 100));
  }, [proceedsInput]);

  const gainLossCalc = useMemo(() => {
    return calculateDisposalGainLoss(costGhs, accDepGhs, proceedsPesewas);
  }, [costGhs, accDepGhs, proceedsPesewas]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('A justification reason is required for church asset disposal.');
      return;
    }
    if (!approvedByPastorOrElder.trim()) {
      setError('Pastor or Elder approval sign-off is mandatory per Church Constitution.');
      return;
    }

    try {
      disposeAsset(asset.id, {
        disposalType,
        disposalDate,
        reason: reason.trim(),
        proceedsPesewas,
        buyerOrRecipient: buyerOrRecipient.trim() || undefined,
        approvedByPastorOrElder: approvedByPastorOrElder.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post asset disposal');
    }
  };

  const netBookValueDisplay = (Number(gainLossCalc.netBookValuePesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const gainOrLossDisplay = (
    Math.abs(Number(gainLossCalc.gainOrLossPesewas)) / 100
  ).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispose-asset-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="dispose-asset-title" className="text-base font-semibold text-[var(--text-primary)]">
                Dispose Fixed Asset
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {asset.assetNumber} · {asset.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded">
              {error}
            </div>
          )}

          {/* Asset Valuation Breakdown */}
          <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded space-y-2">
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Asset Financial Position
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="border-r border-[var(--surface-border)] pr-2">
                <div className="text-[10px] text-[var(--text-muted)]">Historical Cost</div>
                <div className="font-mono font-medium text-[var(--text-primary)]">
                  GH₵ {(Number(costGhs) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="border-r border-[var(--surface-border)] pr-2">
                <div className="text-[10px] text-[var(--text-muted)]">Accumulated Dep.</div>
                <div className="font-mono font-medium text-[var(--text-secondary)]">
                  GH₵ {(Number(accDepGhs) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-muted)]">Net Book Value</div>
                <div className="font-mono font-medium text-[var(--text-primary)]">
                  GH₵ {netBookValueDisplay}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Disposal Method *
                </label>
                <select
                  value={disposalType}
                  onChange={(e) => setDisposalType(e.target.value as DisposalType)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                >
                  <option value="SOLD">Sold / Liquidated</option>
                  <option value="SCRAPPED">Scrapped (Damaged / Obsolete)</option>
                  <option value="DONATED_AWAY">Donated Away (To Sister Church / Charity)</option>
                  <option value="LOST_OR_STOLEN">Lost or Stolen</option>
                  <option value="WRITTEN_OFF">Written Off</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Disposal Date *
                </label>
                <input
                  type="date"
                  required
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Proceeds Collected (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={proceedsInput}
                  onChange={(e) => setProceedsInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-right font-mono bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Buyer or Recipient (Optional)
                </label>
                <input
                  type="text"
                  value={buyerOrRecipient}
                  onChange={(e) => setBuyerOrRecipient(e.target.value)}
                  placeholder="e.g. Bethel Baptist Church"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            </div>

            {/* Calculated Accounting Impact Banner */}
            <div
              className={`p-3 rounded border text-xs flex items-center justify-between ${
                gainLossCalc.isGain
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : gainLossCalc.isLoss
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-800'
              }`}
            >
              <div>
                <div className="font-semibold">
                  {gainLossCalc.isGain
                    ? `Gain on Disposal: GH₵ ${gainOrLossDisplay}`
                    : gainLossCalc.isLoss
                    ? `Loss on Disposal: GH₵ ${gainOrLossDisplay}`
                    : 'Break-even Disposal (No Gain/Loss)'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Posts to General Ledger: Derecognizes historical cost & accumulated depreciation
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Mandatory Pastoral / Elder Approval *
              </label>
              <input
                type="text"
                required
                value={approvedByPastorOrElder}
                onChange={(e) => setApprovedByPastorOrElder(e.target.value)}
                placeholder="e.g. Rev. Kwame Boateng (Senior Pastor)"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Disposal Justification Reason *
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Detail reason for disposal, board minute reference, or physical condition justification..."
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-between">
            <div className="text-[11px] text-[var(--text-muted)]">
              Asset will be marked Disposed and dropped from active depreciation.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-red-800 text-white rounded text-xs font-medium hover:bg-red-900 transition shadow-xs"
              >
                Approve & Post Disposal
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
