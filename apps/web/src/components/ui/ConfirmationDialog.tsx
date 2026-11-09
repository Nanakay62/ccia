import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useModalEscape } from '../../utils/useModalEscape.js';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Please state the reason...',
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, () => {
    if (!isLoading) onClose();
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('Please provide a reason to continue.');
      return;
    }
    setError(null);
    onConfirm(reason.trim() || undefined);
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn select-none">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] max-w-md w-full p-5 text-[var(--text-primary)] shadow-xl space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isDestructive && (
              <span className="p-1 rounded bg-[var(--status-red-bg)] text-[var(--status-red)] shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
            )}
            <h3 id="dialog-title" className="font-semibold text-[16px] text-[var(--text-primary)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>

        {requireReason && (
          <div className="space-y-1 text-xs">
            <label className="block font-medium text-[var(--text-primary)]">
              {reasonLabel} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={reasonPlaceholder}
              className="w-full px-3 py-2 text-xs border border-[var(--surface-border)] rounded-[4px] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
            {error && <p className="text-[11px] text-[var(--status-red)]">{error}</p>}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2 border-t border-[var(--surface-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-[4px] text-xs font-semibold transition focus:outline-none ${
              isDestructive
                ? 'bg-[var(--status-red)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
