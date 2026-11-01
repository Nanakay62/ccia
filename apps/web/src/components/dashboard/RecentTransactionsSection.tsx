import React from 'react';
import { BookOpen, ArrowRight, User } from 'lucide-react';
import { MoneyCell } from '../ui/MoneyCell.js';
import { EmptyState } from '../ui/EmptyState.js';
import { FundMarker } from '../ui/FundMarker.js';

export interface RecentTransactionItem {
  id: string;
  entryDate: string;
  documentNumber: string;
  narration: string;
  fundName: string;
  fundCode?: string;
  amountGhs: number;
  postedBy: string;
}

interface RecentTransactionsSectionProps {
  entries: RecentTransactionItem[];
  currency: 'GHS' | 'USD';
  onNavigateToLedger: () => void;
  onSelectEntry?: (entryId: string) => void;
}

export const RecentTransactionsSection: React.FC<RecentTransactionsSectionProps> = ({
  entries,
  currency,
  onNavigateToLedger,
  onSelectEntry,
}) => {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-6">
        <EmptyState
          message="No posted transactions for this period. Posted transactions from payment vouchers, counting sheets, and journal vouchers will appear here chronologically."
          actionLabel="Post Journal Entry"
          onAction={onNavigateToLedger}
        />
      </div>
    );
  }

  const recent10 = entries.slice(0, 10);

  return (
    <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Recent Posted Transactions
          </h2>
        </div>
        <button
          onClick={onNavigateToLedger}
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          <span>View Full Ledger</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-secondary)] bg-[var(--surface-subtle)]">
              <th className="py-2.5 px-4 font-normal">Date</th>
              <th className="py-2.5 px-3 font-normal">Doc Number</th>
              <th className="py-2.5 px-4 font-normal">Description / Narration</th>
              <th className="py-2.5 px-3 font-normal">Fund</th>
              <th className="py-2.5 px-4 text-right font-normal">Amount ({currency})</th>
              <th className="py-2.5 px-4 font-normal">Posted By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13px]">
            {recent10.map((entry) => {
              const amount = currency === 'GHS' ? entry.amountGhs : entry.amountGhs / 15.5;

              return (
                <tr
                  key={entry.id}
                  onClick={() => {
                    if (onSelectEntry) onSelectEntry(entry.id);
                    else onNavigateToLedger();
                  }}
                  className="hover:bg-[var(--surface-subtle)] cursor-pointer transition"
                  title="Click to view journal entry in ledger"
                >
                  <td className="py-2.5 px-4 tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
                    {entry.entryDate}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {entry.documentNumber}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-primary)] max-w-xs truncate font-medium">
                    {entry.narration}
                  </td>
                  <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                    <FundMarker
                      fundCode={entry.fundCode || 'GEN'}
                      fundName={entry.fundName}
                      isRestricted={entry.fundCode === 'BLD'}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    <MoneyCell amountMajor={amount} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>{entry.postedBy}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
