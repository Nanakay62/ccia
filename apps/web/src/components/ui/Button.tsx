import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[38px]';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5 min-h-[36px]',
    md: 'text-sm px-3.5 py-1.5 gap-2 min-h-[40px]',
    lg: 'text-base px-4 py-2 gap-2.5 min-h-[44px]',
  }[size];

  const variantClasses = {
    primary:
      'bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] border border-transparent shadow-none',
    secondary:
      'bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-border-subtle)] border border-[var(--surface-border)]',
    outline:
      'bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-transparent',
    danger:
      'bg-[var(--status-red-bg)] text-[var(--status-red)] hover:bg-red-100 dark:hover:bg-red-950/60 border border-[var(--status-red)]',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
