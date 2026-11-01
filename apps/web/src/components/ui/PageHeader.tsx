import React from 'react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  subtitle?: string;
  periodSelector?: React.ReactNode;
  currencyToggle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  breadcrumb,
  subtitle,
  periodSelector,
  currencyToggle,
  actions,
  className = '',
}) => {
  return (
    <div className={`pb-4 border-b border-[var(--surface-border)] mb-6 ${className}`}>
      {/* Breadcrumb if provided */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] mb-1.5 select-none">
          {breadcrumb.map((b, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <React.Fragment key={idx}>
                {b.onClick && !isLast ? (
                  <button
                    onClick={b.onClick}
                    className="hover:text-[var(--text-primary)] hover:underline focus:outline-none"
                  >
                    {b.label}
                  </button>
                ) : (
                  <span className={isLast ? 'text-[var(--text-primary)] font-medium' : ''}>
                    {b.label}
                  </span>
                )}
                {!isLast && <span className="text-[var(--text-muted)]">/</span>}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Main Row: Serif Title + Actions / Toggles */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-[26px] md:text-[28px] font-semibold text-[var(--text-primary)] leading-tight tracking-tight">
              {title}
            </h1>
          </div>
          {/* Subtle gold / brass rule mark */}
          <div className="w-8 h-[2px] bg-[var(--gold)] mt-1.5" aria-hidden="true" />
          {subtitle && (
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">{subtitle}</p>
          )}
        </div>

        {/* Right Controls: Period Selector, Currency Toggle & Page Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {periodSelector && <div className="shrink-0">{periodSelector}</div>}
          {currencyToggle && <div className="shrink-0">{currencyToggle}</div>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
};
