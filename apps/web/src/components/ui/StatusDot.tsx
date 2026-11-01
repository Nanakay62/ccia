import React from 'react';

export type StatusType =
  | 'balanced'
  | 'synced'
  | 'healthy'
  | 'waiting'
  | 'attention'
  | 'error'
  | 'unbalanced'
  | 'inactive';

export interface StatusDotProps {
  status: StatusType;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  className = '',
  size = 'sm',
}) => {
  // Determine semantic color based on spec
  const isGreen = status === 'balanced' || status === 'synced' || status === 'healthy';
  const isAmber = status === 'waiting' || status === 'attention';
  const isRed = status === 'error' || status === 'unbalanced';

  const dotColor = isGreen
    ? 'bg-[var(--status-green)]'
    : isAmber
    ? 'bg-[var(--status-amber)]'
    : isRed
    ? 'bg-[var(--status-red)]'
    : 'bg-[var(--status-grey)]';

  const textColor = isGreen
    ? 'text-[var(--status-green)]'
    : isAmber
    ? 'text-[var(--status-amber)]'
    : isRed
    ? 'text-[var(--status-red)]'
    : 'text-[var(--text-secondary)]';

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
  };

  const displayLabel = label ?? defaultLabels[status];

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-normal select-none ${className}`}
      role="status"
      aria-label={`${status}: ${displayLabel}`}
    >
      <span className={`${dotSize} rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      <span className={`text-[14px] ${textColor}`}>{displayLabel}</span>
    </span>
  );
};
