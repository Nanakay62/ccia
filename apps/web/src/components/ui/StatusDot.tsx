import React from 'react';
import { Check } from 'lucide-react';

export type StatusType =
  | 'balanced'
  | 'synced'
  | 'healthy'
  | 'waiting'
  | 'attention'
  | 'error'
  | 'unbalanced'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'posted';

export interface StatusDotProps {
  status: StatusType;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
  textColorClass?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  className = '',
  size = 'sm',
  textColorClass,
}) => {
  const isGreen = status === 'balanced' || status === 'synced' || status === 'healthy' || status === 'approved';
  const isAmber = status === 'waiting' || status === 'attention' || status === 'pending';
  const isRed = status === 'error' || status === 'unbalanced' || status === 'rejected';
  const isGreyCheck = status === 'paid' || status === 'posted';

  const dotColor = isGreen
    ? 'bg-[var(--status-green)]'
    : isAmber
    ? 'bg-[var(--status-amber)]'
    : isRed
    ? 'bg-[var(--status-red)]'
    : 'bg-[var(--status-grey)]';

  // Section A4: "text in the normal text colour ('● Approved', '● Pending approval')"
  const textClass = textColorClass ?? 'text-[var(--text-primary)]';

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  const defaultLabels: Record<StatusType, string> = {
    balanced: 'Balanced',
    synced: 'All saved and synced',
    healthy: 'Diagnostics healthy',
    waiting: 'Working offline, waiting to sync',
    attention: 'Needs attention',
    error: 'Sync error',
    unbalanced: 'Ledger out of balance',
    inactive: 'Inactive',
    pending: 'Pending approval',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
    posted: 'Posted',
  };

  const displayLabel = label ?? defaultLabels[status];

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-normal select-none ${className}`}
      role="status"
      aria-label={`${status}: ${displayLabel}`}
    >
      {isGreyCheck ? (
        <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
          <Check className="w-2.5 h-2.5" />
        </span>
      ) : (
        <span className={`${dotSize} rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      )}
      <span className={`text-[14px] font-normal ${textClass}`}>{displayLabel}</span>
    </span>
  );
};

/**
 * Section A4: "Use a neutral outlined tag only for categories (fund code, entry type such as 'Reversal')."
 */
export interface CategoryTagProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const CategoryTag: React.FC<CategoryTagProps> = ({ children, className = '', title }) => (
  <span
    title={title}
    className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[12px] font-medium border border-[var(--surface-border)] text-[var(--text-secondary)] bg-transparent select-none ${className}`}
  >
    {children}
  </span>
);
