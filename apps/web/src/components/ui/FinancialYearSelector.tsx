import React from 'react';
import { Calendar, Lock, ArrowLeftRight } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext.js';
import { formatDate } from '../../config/churchSettings.js';

interface FinancialYearSelectorProps {
  readonly showComparativeToggle?: boolean;
  readonly compact?: boolean;
}

export const FinancialYearSelector: React.FC<FinancialYearSelectorProps> = ({
  showComparativeToggle = false,
  compact = false,
}) => {
  const {
    financialYears,
    selectedFinancialYear,
    setSelectedFinancialYearId,
    showComparatives,
    setShowComparatives,
  } = useLedger();

  const isLocked = selectedFinancialYear.status === 'LOCKED';

  return (
    <div className="inline-flex flex-wrap items-center gap-2.5">
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[13px]">
        <Calendar className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
        <label htmlFor="fy-header-select" className="text-[var(--text-muted)] font-medium">
          Financial year:
        </label>
        <select
          id="fy-header-select"
          aria-label="Financial year"
          value={selectedFinancialYear.id}
          onChange={(e) => setSelectedFinancialYearId(e.target.value)}
          className="bg-transparent font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer font-sans tabular-nums"
        >
          {financialYears.map((fy) => (
            <option
              key={fy.id}
              value={fy.id}
              className="bg-[var(--surface-card)] text-[var(--text-primary)]"
            >
              {fy.label} ({formatDate(fy.startDate)} – {formatDate(fy.endDate)})
            </option>
          ))}
        </select>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
            isLocked
              ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {isLocked && <Lock className="w-2.5 h-2.5" />}
          {isLocked ? 'Locked' : 'Open'}
        </span>
      </div>

      {showComparativeToggle && !compact && (
        <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[13px] cursor-pointer select-none hover:bg-[var(--surface-subtle)] transition-colors">
          <input
            type="checkbox"
            checked={showComparatives}
            onChange={(e) => setShowComparatives(e.target.checked)}
            className="rounded border-[var(--surface-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="font-medium text-[var(--text-primary)]">
            Compare with previous year (FY2025)
          </span>
        </label>
      )}
    </div>
  );
};
