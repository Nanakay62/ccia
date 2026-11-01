import React, { useState } from 'react';
import { BarChart2, Table as TableIcon, Coins } from 'lucide-react';
import { MoneyCell } from '../ui/MoneyCell.js';
import { EmptyState } from '../ui/EmptyState.js';

export interface GivingCategoryItem {
  category: string;
  count: number;
  amountGhs: number;
  percentage: number;
}

interface GivingTrendSectionProps {
  categories: GivingCategoryItem[];
  currency: 'GHS' | 'USD';
  onRecordGiving?: () => void;
}

export const GivingTrendSection: React.FC<GivingTrendSectionProps> = ({
  categories,
  currency,
  onRecordGiving,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const totalGhs = categories.reduce((sum, c) => sum + c.amountGhs, 0);

  if (!categories || categories.length === 0 || totalGhs === 0) {
    return (
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-6">
        <EmptyState
          message="No giving recorded this month yet. Enter Sunday collection tally sheets or record member tithes to display category distribution trends."
          actionLabel="Record Sunday Giving"
          onAction={onRecordGiving}
        />
      </div>
    );
  }

  // Muted category palette
  const getCategoryColor = (idx: number) => {
    const colors = [
      'var(--accent)',
      'var(--gold)',
      '#3b82f6',
      '#8b5cf6',
      '#10b981',
      '#6b7280',
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
      {/* Header with View Toggle */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Giving Distribution by Category
          </h2>
        </div>

        <div className="inline-flex rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-0.5 text-xs">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-[calc(var(--radius)-2px)] font-medium transition ${
              viewMode === 'chart'
                ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-[calc(var(--radius)-2px)] font-medium transition ${
              viewMode === 'table'
                ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {viewMode === 'chart' ? (
          <div className="space-y-4">
            {/* Horizontal Segmented Bar */}
            <div className="w-full h-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] overflow-hidden flex shadow-inner">
              {categories.map((cat, idx) => (
                <div
                  key={cat.category}
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: getCategoryColor(idx),
                  }}
                  className="h-full transition-all duration-300"
                  title={`${cat.category}: ${cat.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Category Rows with Tabular Figures and Proportional Bars */}
            <div className="space-y-3 pt-2">
              {categories.map((cat, idx) => {
                const color = getCategoryColor(idx);
                const amount = currency === 'GHS' ? cat.amountGhs : cat.amountGhs / 15.5;

                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-[var(--text-primary)]">{cat.category}</span>
                        <span className="text-[var(--text-muted)] text-[11px]">
                          ({cat.count} {cat.count === 1 ? 'gift' : 'gifts'})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MoneyCell amountMajor={amount} currency={currency} className="font-semibold text-[13px]" />
                        <span className="text-[var(--text-secondary)] text-[11px] tabular-nums w-10 text-right">
                          {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-secondary)] bg-[var(--surface-subtle)]">
                  <th className="py-2 px-3 font-normal">Category</th>
                  <th className="py-2 px-3 text-right font-normal">Gifts Count</th>
                  <th className="py-2 px-3 text-right font-normal">Amount ({currency})</th>
                  <th className="py-2 px-3 text-right font-normal">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13px]">
                {categories.map((cat) => {
                  const amount = currency === 'GHS' ? cat.amountGhs : cat.amountGhs / 15.5;
                  return (
                    <tr key={cat.category} className="hover:bg-[var(--surface-subtle)] transition">
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{cat.category}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {cat.count}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-[var(--text-primary)]">
                        <MoneyCell amountMajor={amount} currency={currency} />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {cat.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
