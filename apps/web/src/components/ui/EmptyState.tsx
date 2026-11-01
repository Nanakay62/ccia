import React from 'react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  message,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`py-10 px-6 text-center flex flex-col items-center justify-center border border-dashed border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-ground)]/50 ${className}`}
    >
      {icon && <div className="text-[var(--text-muted)] mb-2.5">{icon}</div>}
      <p className="text-[15px] text-[var(--text-secondary)] max-w-md mb-4 leading-normal">
        {message}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
