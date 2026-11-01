import React from 'react';
import { EmptyState } from './EmptyState.js';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found for this period.',
  emptyActionLabel,
  onEmptyAction,
  stickyHeader = true,
  className = '',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        className="my-4"
      />
    );
  }

  return (
    <div className={`w-full overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] ${className}`}>
      <table className="w-full border-collapse text-[15px] text-left">
        {/* Sticky Header with subtle warm background and hairline bottom border */}
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)]">
            {columns.map((col) => {
              const alignClass =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left';

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`py-2.5 px-3.5 text-[13px] font-semibold text-[var(--text-secondary)] select-none ${alignClass}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Rows with hairline dividers, zebra striping OFF, subtle hover */}
        <tbody className="divide-y divide-[var(--surface-border-subtle)]">
          {data.map((item, index) => (
            <tr
              key={keyExtractor(item, index)}
              className="hover:bg-[var(--surface-subtle)]/70 transition-colors"
            >
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <td
                    key={col.key}
                    className={`py-2.5 px-3.5 text-[15px] text-[var(--text-primary)] align-middle ${alignClass}`}
                  >
                    {col.render
                      ? col.render(item, index)
                      : String((item as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
