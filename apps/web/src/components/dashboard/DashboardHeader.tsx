import React from 'react';
import { RefreshCw } from 'lucide-react';

export type DashboardPeriod = 'this-month' | 'last-month' | 'this-year' | 'custom';

interface DashboardHeaderProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  currency: 'GHS' | 'USD';
  onCurrencyToggle: (currency: 'GHS' | 'USD') => void;
  usdRate: number;
  rateDate: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  period,
  onPeriodChange,
  currency,
  onCurrencyToggle,
  usdRate,
  rateDate,
}) => {
  return (
    <div className="pb-4 border-b border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4">
      {/* Title & Context */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>Books</span>
          <span>/</span>
          <span className="text-[var(--text-secondary)]">Financial Administration Dashboard</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-[26px] font-semibold text-[var(--text-primary)] tracking-tight mt-0.5">
          Dashboard
        </h1>
      </div>

      {/* Controls: Period Selector & Currency Switcher */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period Selector */}
        <div className="inline-flex rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] p-0.5 text-xs">
          {(
            [
              { id: 'this-month', label: 'This month' },
              { id: 'last-month', label: 'Last month' },
              { id: 'this-year', label: 'This year' },
              { id: 'custom', label: 'Custom' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => onPeriodChange(p.id)}
              className={`px-2.5 py-1 rounded-[calc(var(--radius)-2px)] font-medium transition ${
                period === p.id
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Currency Switcher: GHS | USD Toggle with Exchange Rate Notice */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--surface-border-subtle)]">
          <div className="inline-flex rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] p-0.5 text-xs font-semibold">
            <button
              onClick={() => onCurrencyToggle('GHS')}
              className={`px-2.5 py-1 rounded-[calc(var(--radius)-2px)] transition ${
                currency === 'GHS'
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
              title="Display values in Ghana Cedis (GHS)"
            >
              GHS
            </button>
            <button
              onClick={() => onCurrencyToggle('USD')}
              className={`px-2.5 py-1 rounded-[calc(var(--radius)-2px)] transition ${
                currency === 'USD'
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
              title="Display denominational figures in US Dollars (USD)"
            >
              USD
            </button>
          </div>

          {/* Rate & Date pill */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2.5 py-1 rounded-[var(--radius)] border border-[var(--surface-border)]">
            <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
            <span>
              1 USD = <strong>{usdRate.toFixed(2)} GHS</strong> ({rateDate})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
