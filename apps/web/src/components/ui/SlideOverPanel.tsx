import React from 'react';
import { X } from 'lucide-react';
import { useModalEscape } from '../../utils/useModalEscape.js';

export interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string; // e.g. 'max-w-[480px]' (between 420 to 520px per A9)
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const SlideOverPanel: React.FC<SlideOverPanelProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 'max-w-[480px]',
  children,
  actions,
}) => {
  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto select-none animate-fadeIn flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`relative z-10 w-full ${width} max-h-[90vh] bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] shadow-2xl flex flex-col justify-between overflow-hidden my-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-start justify-between gap-3 bg-[var(--surface-subtle)]/40">
          <div>
            <h3 id="slide-over-title" className="text-[16px] font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle && <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--surface-subtle)] transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 overflow-y-auto space-y-5 text-xs text-[var(--text-primary)]">
          {children}
        </div>

        {/* Footer Actions */}
        {actions && (
          <div className="px-5 py-3 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)]/40 flex items-center justify-end gap-2.5">
            {actions}
          </div>
        )}
      </aside>
    </div>
  );
};
