import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  subtitle?: string;
  statusLine?: React.ReactNode; // A1 & A6: plain text lasting state with small icon under title
  helpContent?: React.ReactNode; // A6: help popover / collapsible "How this works"
  periodSelector?: React.ReactNode;
  currencyToggle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  breadcrumb,
  subtitle,
  statusLine,
  helpContent,
  periodSelector,
  currencyToggle,
  actions,
  className = '',
}) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className={`pb-3 border-b border-[var(--surface-border)] mb-5 select-none ${className}`}>
      {/* Breadcrumb if provided */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] mb-1 select-none">
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

      {/* Main Row: Title + Status line + Actions */}
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-[24px] md:text-[26px] font-semibold text-[var(--text-primary)] leading-tight tracking-tight">
              {title}
            </h1>

            {helpContent && (
              <button
                type="button"
                onClick={() => setIsHelpOpen((prev) => !prev)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-0.5"
                title="How this works"
                aria-label="How this works"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Section A1 & A6: Lasting state = a status line in the page header, plain text with small icon */}
          {statusLine && (
            <div className="text-[13px] text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
              {statusLine}
            </div>
          )}

          {subtitle && !statusLine && (
            <p className="text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
          )}

          {isHelpOpen && helpContent && (
            <div className="mt-2 p-3 text-xs bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded-[4px] text-[var(--text-secondary)] animate-fadeIn">
              {helpContent}
            </div>
          )}
        </div>

        {/* Right Controls: Period Selector, Currency Toggle & Page Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          {periodSelector && <div className="shrink-0">{periodSelector}</div>}
          {currencyToggle && <div className="shrink-0">{currencyToggle}</div>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
};
