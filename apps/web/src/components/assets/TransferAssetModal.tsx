import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface TransferAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetRecord;
}

export const TransferAssetModal: React.FC<TransferAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  useModalEscape(isOpen, onClose);
  const { transferAsset } = useFixedAssets();

  const [toLocation, setToLocation] = useState('');
  const [toCustodian, setToCustodian] = useState('');
  const [toDepartment, setToDepartment] = useState(asset.department || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!toLocation.trim()) {
      setError('New location is required.');
      return;
    }
    if (!toCustodian.trim()) {
      setError('New custodian is required.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason for transfer is required for the audit log.');
      return;
    }

    try {
      transferAsset(asset.id, {
        toLocation: toLocation.trim(),
        toCustodian: toCustodian.trim(),
        toDepartment: toDepartment.trim(),
        reason: reason.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to transfer asset');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-asset-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div>
            <h2 id="transfer-asset-title" className="text-base font-semibold text-[var(--text-primary)]">
              Transfer Asset
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {asset.assetNumber} · {asset.description}
            </p>
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

          {/* Current vs New preview */}
          <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded space-y-2">
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Current Assignment
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Location:</span>
              <span className="font-medium text-[var(--text-primary)]">{asset.location}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Custodian:</span>
              <span className="font-medium text-[var(--text-primary)]">{asset.custodian}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                New Location *
              </label>
              <input
                type="text"
                required
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                placeholder="e.g. Fellowship Annex Hall, Sound Control Room"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                New Custodian (Person or Department) *
              </label>
              <input
                type="text"
                required
                value={toCustodian}
                onChange={(e) => setToCustodian(e.target.value)}
                placeholder="e.g. Youth Ministry Lead, Facilities Officer"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Department
              </label>
              <input
                type="text"
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                placeholder="e.g. Youth, Media, Estates"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Reason for Transfer *
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State why this equipment is being relocated or reassigned..."
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
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
              className="px-5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
            >
              Confirm Transfer <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
