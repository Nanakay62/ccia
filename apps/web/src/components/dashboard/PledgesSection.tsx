import React from 'react';
import { Target, ArrowRight } from 'lucide-react';
import { MoneyCell } from '../ui/MoneyCell.js';
import { EmptyState } from '../ui/EmptyState.js';

export interface CampaignPledgeItem {
  campaignName: string;
  totalPledgedGhs: number;
  totalFulfilledGhs: number;
  totalOutstandingGhs: number;
  percentageFulfilled: number;
}

interface PledgesSectionProps {
  campaigns: CampaignPledgeItem[];
  currency: 'GHS' | 'USD';
  onNavigateToGiving?: () => void;
}

export const PledgesSection: React.FC<PledgesSectionProps> = ({
  campaigns,
  currency,
  onNavigateToGiving,
}) => {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-6">
        <EmptyState
          message="No active pledge campaigns found. Create capital project campaigns (e.g. Building Expansion, Bus Fund) to track individual member pledges and fulfillment."
          actionLabel="Open Giving Directory"
          onAction={onNavigateToGiving}
        />
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Active Pledge Campaigns
          </h2>
        </div>
        {onNavigateToGiving && (
          <button
            onClick={onNavigateToGiving}
            className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            <span>All Pledges</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-secondary)] bg-[var(--surface-subtle)]">
              <th className="py-2.5 px-4 font-normal">Campaign</th>
              <th className="py-2.5 px-4 text-right font-normal">Pledged ({currency})</th>
              <th className="py-2.5 px-4 text-right font-normal">Fulfilled</th>
              <th className="py-2.5 px-4 text-right font-normal">Outstanding</th>
              <th className="py-2.5 px-4 font-normal min-w-[130px]">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13px]">
            {campaigns.map((c) => {
              const pledged = currency === 'GHS' ? c.totalPledgedGhs : c.totalPledgedGhs / 15.5;
              const fulfilled = currency === 'GHS' ? c.totalFulfilledGhs : c.totalFulfilledGhs / 15.5;
              const outstanding = currency === 'GHS' ? c.totalOutstandingGhs : c.totalOutstandingGhs / 15.5;

              return (
                <tr key={c.campaignName} className="hover:bg-[var(--surface-subtle)] transition">
                  <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                    {c.campaignName}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-secondary)]">
                    <MoneyCell amountMajor={pledged} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-[var(--status-green)]">
                    <MoneyCell amountMajor={fulfilled} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-[var(--text-muted)]">
                    <MoneyCell amountMajor={outstanding} currency={currency} />
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-[var(--text-secondary)]">
                          {c.percentageFulfilled.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                          style={{ width: `${Math.min(100, c.percentageFulfilled)}%` }}
                        />
                      </div>
                    </div>
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
