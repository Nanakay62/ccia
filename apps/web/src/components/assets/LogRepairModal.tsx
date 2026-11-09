import React, { useState } from 'react';
import { X, Wrench } from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface LogRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetRecord;
}

export const LogRepairModal: React.FC<LogRepairModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  useModalEscape(isOpen, onClose);
  const { logRepair } = useFixedAssets();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [costInput, setCostInput] = useState('');
  const [provider, setProvider] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [isImprovement, setIsImprovement] = useState(false);
  const [voucherId, setVoucherId] = useState('');
  const notes = '';
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Repair description is required.');
      return;
    }
    if (!provider.trim()) {
      setError('Service provider or technician name is required.');
      return;
    }

    const costNum = parseFloat(costInput) || 0;
    const costPesewas = BigInt(Math.round(costNum * 100));

    try {
      logRepair(asset.id, {
        date,
        description: description.trim(),
        costPesewas,
        provider: provider.trim(),
        nextServiceDate: nextServiceDate || undefined,
        isImprovement,
        voucherId: voucherId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log maintenance event');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-asset-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[var(--surface-border)]/50 rounded">
              <Wrench className="w-4 h-4 text-[var(--text-primary)]" />
            </div>
            <div>
              <h2 id="repair-asset-title" className="text-base font-semibold text-[var(--text-primary)]">
                Log Maintenance or Repair
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

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Service Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Cost (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-right font-mono bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Work Performed / Issue Addressed *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe parts replaced, routine servicing, or repairs performed..."
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Technician / Service Provider *
                </label>
                <input
                  type="text"
                  required
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. Mantrac Ghana, Pro Audio Ltd"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Next Service Due (Optional)
                </label>
                <input
                  type="date"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Linked Payment Voucher Ref (Optional)
              </label>
              <input
                type="text"
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
                placeholder="e.g. PV-2026-0042"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isImprovement}
                  onChange={(e) => setIsImprovement(e.target.checked)}
                  className="mt-0.5 rounded text-[#1e4620] focus:ring-[#1e4620]"
                />
                <div className="text-xs">
                  <span className="font-medium text-[var(--text-primary)]">
                    Capital Improvement (Extends Useful Life)
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Adds the repair cost directly to the asset historical cost basis in the General Ledger (requires Treasurer approval)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs"
            >
              Save Maintenance Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
