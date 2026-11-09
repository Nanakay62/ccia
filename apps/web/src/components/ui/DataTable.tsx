import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from './EmptyState.js';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  sortable?: boolean;
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
  // Enhancements for Section A9
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  selectedKey?: string | null;
  onRowClick?: (item: T, index: number) => void;
  pageSize?: number; // default 50 per A9
  toolbarActions?: React.ReactNode;
  initialDensity?: 'comfortable' | 'compact';
  renderExpandedRow?: (item: T, index: number) => React.ReactNode;
  isRowExpanded?: (item: T, index: number) => boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found.',
  emptyActionLabel,
  onEmptyAction,
  stickyHeader = true,
  className = '',
  searchable = false,
  searchPlaceholder = 'Search records...',
  searchFilter,
  selectedKey,
  onRowClick,
  pageSize = 50,
  toolbarActions,
  initialDensity = 'comfortable',
  renderExpandedRow,
  isRowExpanded,
}: DataTableProps<T>) {
  const [density, setDensity] = useState<'comfortable' | 'compact'>(initialDensity);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 1. Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }

    return data.filter((item) => {
      const record = item as Record<string, unknown>;
      return Object.values(record).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery, searchFilter]);

  // 2. Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comp = aVal - bVal;
      } else if (typeof aVal === 'bigint' && typeof bVal === 'bigint') {
        comp = aVal < bVal ? -1 : 1;
      } else {
        comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      }

      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [filteredData, sortKey, sortDirection]);

  // 3. Pagination beyond 50 rows
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    if (sortedData.length <= pageSize) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset to page 1 on filter or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey, sortDirection]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Keyboard navigation for rows (ArrowUp, ArrowDown, Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (paginatedData.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedRowIndex((prev) => Math.min(paginatedData.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedRowIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && focusedRowIndex >= 0 && focusedRowIndex < paginatedData.length) {
      e.preventDefault();
      const target = paginatedData[focusedRowIndex];
      if (target && onRowClick) {
        onRowClick(target, focusedRowIndex);
      }
    }
  };

  const rowPaddingClass = density === 'comfortable' ? 'py-2.5 px-3.5' : 'py-1.5 px-3';

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {/* Table Toolbar (Search, Filter, Density, Actions) */}
      {(searchable || toolbarActions || sortedData.length > 10) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            {searchable && (
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-[4px] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {toolbarActions}

            {/* Density Setting: Comfortable / Compact per A9 */}
            <div className="flex items-center border border-[var(--surface-border)] rounded-[4px] p-0.5 bg-[var(--surface-panel)] text-[11px]">
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2 py-0.5 rounded-[2px] transition ${
                  density === 'comfortable'
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Comfortable row density"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-0.5 rounded-[2px] transition ${
                  density === 'compact'
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Compact row density"
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      {paginatedData.length === 0 ? (
        <EmptyState
          message={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          className="my-4"
        />
      ) : (
        <div
          ref={tableContainerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="w-full overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] focus:outline-none focus:border-[var(--accent)]"
          aria-label="Data Table"
        >
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

                  const isSorted = sortKey === col.key;

                  return (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={() => (col.sortable !== false ? handleSort(col.key) : undefined)}
                      className={`${rowPaddingClass} text-[13px] font-semibold text-[var(--text-secondary)] select-none ${alignClass} ${
                        col.sortable !== false ? 'cursor-pointer hover:text-[var(--text-primary)]' : ''
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1 ${
                          col.align === 'right'
                            ? 'justify-end'
                            : col.align === 'center'
                            ? 'justify-center'
                            : 'justify-start'
                        }`}
                      >
                        <span>{col.header}</span>
                        {col.sortable !== false && (
                          <span className="text-[var(--text-muted)]">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-[var(--accent)]" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--accent)]" />
                              )
                            ) : (
                              <span className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Rows with hairline dividers, zebra striping OFF, subtle hover */}
            <tbody className="divide-y divide-[var(--surface-border-subtle)]">
              {paginatedData.map((item, index) => {
                const key = keyExtractor(item, index);
                const isSelected = selectedKey ? selectedKey === key : false;
                const isFocused = focusedRowIndex === index;
                const isExpanded = isRowExpanded ? isRowExpanded(item, index) : false;

                return (
                  <React.Fragment key={key}>
                    <tr
                      onClick={() => {
                        setFocusedRowIndex(index);
                        if (onRowClick) onRowClick(item, index);
                      }}
                      className={`transition-colors ${
                        onRowClick ? 'cursor-pointer' : ''
                      } ${
                        isSelected
                          ? 'bg-[var(--surface-subtle)] font-medium'
                          : isFocused
                          ? 'bg-[var(--surface-subtle)]/50'
                          : isExpanded
                          ? 'bg-[var(--surface-subtle)]/30'
                          : 'hover:bg-[var(--surface-subtle)]/60'
                      }`}
                    >
                      {columns.map((col) => {
                        const alignClass =
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left';

                        const cellContent = col.render
                          ? col.render(item, index)
                          : String((item as Record<string, unknown>)[col.key] ?? '—');

                        return (
                          <td
                            key={col.key}
                            className={`${rowPaddingClass} text-[15px] text-[var(--text-primary)] align-middle ${alignClass}`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && renderExpandedRow && (
                      <tr className="bg-[var(--surface-subtle)]/25 border-b border-[var(--surface-border)]">
                        <td colSpan={columns.length} className="p-0">
                          {renderExpandedRow(item, index)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar (when sortedData.length > pageSize) */}
      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between px-1 py-1.5 text-xs text-[var(--text-secondary)]">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 border border-[var(--surface-border)] rounded-[4px] hover:bg-[var(--surface-subtle)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 border border-[var(--surface-border)] rounded-[4px] hover:bg-[var(--surface-subtle)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
