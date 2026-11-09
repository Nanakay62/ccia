import React, { useState } from 'react';
import { ShieldAlert, Lock, X } from 'lucide-react';
import {
  getReAuthActionMetadata,
  type ReAuthActionType,
} from '@church/domain';
import { useAuth } from '../../context/AuthContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface ReAuthGateModalProps {
  readonly isOpen: boolean;
  readonly actionType: ReAuthActionType | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export const ReAuthGateModal: React.FC<ReAuthGateModalProps> = ({
  isOpen,
  actionType,
  onConfirm,
  onCancel,
}) => {
  const { currentUser, verifyReAuthCredential } = useAuth();
  const [credential, setCredential] = useState('');
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, onCancel);

  if (!isOpen || !actionType) return null;

  const metadata = getReAuthActionMetadata(actionType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isValid = verifyReAuthCredential(credential.trim());
    if (isValid) {
      setCredential('');
      onConfirm();
    } else {
      setError('Incorrect password or 6-digit authenticator code.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl max-w-md w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 id="reauth-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                {metadata.title}
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Security re-authentication gate (Spec Section C1)
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[13px]">
          <p className="text-[var(--text-muted)]">{metadata.description}</p>

          {metadata.warningNote && (
            <div className="p-2.5 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-900 dark:text-amber-300">
              {metadata.warningNote}
            </div>
          )}

          <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-muted)]">Confirming officer:</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {currentUser.fullName} ({currentUser.role})
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reauth-input" className="block text-[12px] font-semibold text-[var(--text-muted)]">
              Password or 6-digit Authenticator code
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reauth-input"
                type="password"
                autoFocus
                placeholder="Enter password or code..."
                value={credential}
                onChange={(e) => {
                  setCredential(e.target.value);
                  setError(null);
                }}
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Default password: <span className="font-mono text-[var(--accent)]">1234</span> or your TOTP code
            </p>
            {error && (
              <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--surface-border)]">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:underline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
            >
              Confirm identity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
