import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate, formatDateWithWeekday } from '../../config/churchSettings.js';

export interface DateInputProps {
  value: string; // ISO date 'YYYY-MM-DD'
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  showWeekday?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  label,
  disabled = false,
  min,
  max,
  className = '',
  showWeekday = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayString = value
    ? (showWeekday ? formatDateWithWeekday(value) : formatDate(value))
    : 'Select date';

  const handleClick = () => {
    if (disabled) return;
    try {
      if (inputRef.current?.showPicker) {
        inputRef.current.showPicker();
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div className={`relative inline-flex flex-col text-xs ${className}`}>
      {label && (
        <label className="text-[var(--text-secondary)] font-medium mb-1 select-none">
          {label}
        </label>
      )}

      <div
        onClick={handleClick}
        className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 border border-[var(--surface-border)] rounded-[4px] bg-[var(--surface-panel)] text-[var(--text-primary)] cursor-pointer hover:border-[var(--text-secondary)] focus-within:border-[var(--accent)] transition ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <span className="font-sans text-[13px] text-[var(--text-primary)] tabular-nums select-none">
          {displayString}
        </span>
        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0" />

        {/* Hidden underlying native date input */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={min}
          max={max}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
