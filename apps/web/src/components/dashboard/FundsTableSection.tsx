import React, { useState } from 'react';
import { Lock, Unlock, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { FundMarker } from '../ui/FundMarker.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { EmptyState } from '../ui/EmptyState.js';

export interface FundRowData {
  id: string;
  code: string;
  name: string;
  type: 'Restricted' | 'Unrestricted';
  balanceGhs: number;
  balanceUsd: number;
  monthIncomeGhs: number;
  monthSpendingGhs: number;
  hasActivity: boolean;
}

interface FundsTableSectionProps {
  funds: FundRowData[];
  currency: 'GHS' | 'USD';
  onAddFund?: () => void;
}

export const FundsTableSection: React.FC<FundsTableSectionProps> = ({
  funds,
  currency,
  onAddFund,
}) => {
  const [showInactive, setShowInactive] = useState(false);

  if (!funds || funds.length === 0) {
    return (
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-6">
        <EmptyState
          message="No church funds configured. Church accounting requires at least one General Fund for tracking congregational tithes and offerings."
          actionLabel="Add Church Fund"
          onAction={onAddFund}
        />
      </div>
    );
  }

  const totalBalanceGhs = funds.reduce((acc, f) => acc + f.balanceGhs, 0);

  const activeFunds = funds.filter((f) => f.hasActivity || f.balanceGhs !== 0);
  const inactiveFunds = funds.filter((f) => !f.hasActivity && f.balanceGhs === 0);

  return (
    <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
      {/* Table Header Strip */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
        <div>
          <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Fund Integrity & Restricted Capital Protection
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Strict fund accounting quarantines restricted capital (Building, Missions) from general operating funds.
          </p>
        </div>
        {onAddFund && (
          <button
            onClick={onAddFund}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius)] transition border border-transparent hover:border-[var(--accent)]/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Fund</span>
          </button>
        )}
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-semibold text-[var(--text-secondary)]">
              <th className="py-2.5 px-4 font-normal">Fund</th>
              <th className="py-2.5 px-3 font-normal">Code</th>
              <th className="py-2.5 px-3 font-normal">Type</th>
              <th className="py-2.5 px-4 text-right font-normal">
                {currency === 'GHS' ? 'Balance GHS' : 'Balance USD'}
              </th>
              <th className="py-2.5 px-4 text-right font-normal">
                {currency === 'GHS' ? 'Balance USD' : 'Balance GHS'}
              </th>
              <th className="py-2.5 px-4 text-right font-normal">Month Income</th>
              <th className="py-2.5 px-4 text-right font-normal">Month Spending</th>
              <th className="py-2.5 px-4 font-normal min-w-[120px]">Allocation Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13.5px]">
            {activeFunds.map((fund) => {
              const allocationPercent =
                totalBalanceGhs > 0 ? Math.max(0, (fund.balanceGhs / totalBalanceGhs) * 100) : 0;

              return (
                <tr key={fund.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                  <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                    <FundMarker
                      fundCode={fund.code}
                      fundName={fund.name}
                      isRestricted={fund.type === 'Restricted'}
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-muted)]">
                    {fund.code}
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    {fund.type === 'Restricted' ? (
                      <span className="inline-flex items-center gap-1 text-[var(--status-amber)] font-medium">
                        <Lock className="w-3 h-3" />
                        <span>Restricted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                        <Unlock className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>Unrestricted</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-[var(--text-primary)]">
                    <MoneyCell
                      amountMajor={currency === 'GHS' ? fund.balanceGhs : fund.balanceUsd}
                      currency={currency === 'GHS' ? 'GHS' : 'USD'}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] text-xs">
                    <MoneyCell
                      amountMajor={currency === 'GHS' ? fund.balanceUsd : fund.balanceGhs}
                      currency={currency === 'GHS' ? 'USD' : 'GHS'}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right text-[var(--status-green)] text-xs">
                    <MoneyCell
                      amountMajor={currency === 'GHS' ? fund.monthIncomeGhs : fund.monthIncomeGhs / 15.5}
                      currency={currency}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] text-xs">
                    <MoneyCell
                      amountMajor={currency === 'GHS' ? fund.monthSpendingGhs : fund.monthSpendingGhs / 15.5}
                      currency={currency}
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-border-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.min(100, allocationPercent)}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-[var(--text-muted)] w-8 text-right">
                        {allocationPercent.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Collapsed Inactive Funds Row */}
            {inactiveFunds.length > 0 && (
              <>
                <tr className="bg-[var(--surface-subtle)]/50 text-xs">
                  <td colSpan={8} className="py-2 px-4">
                    <button
                      onClick={() => setShowInactive((prev) => !prev)}
                      className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition"
                    >
                      {showInactive ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showInactive
                          ? 'Hide inactive funds'
                          : `Show ${inactiveFunds.length} inactive ${
                              inactiveFunds.length === 1 ? 'fund' : 'funds'
                            }`}
                      </span>
                    </button>
                  </td>
                </tr>

                {showInactive &&
                  inactiveFunds.map((fund) => (
                    <tr
                      key={fund.id}
                      className="hover:bg-[var(--surface-subtle)] transition-colors opacity-75 text-xs"
                    >
                      <td className="py-2 px-4 text-[var(--text-secondary)]">
                        <FundMarker
                          fundCode={fund.code}
                          fundName={fund.name}
                          isRestricted={fund.type === 'Restricted'}
                        />
                      </td>
                      <td className="py-2 px-3 font-mono text-[var(--text-muted)]">{fund.code}</td>
                      <td className="py-2 px-3 text-[var(--text-muted)]">{fund.type}</td>
                      <td className="py-2 px-4 text-right text-[var(--text-muted)]">
                        <MoneyCell amountMajor={0} currency={currency} />
                      </td>
                      <td className="py-2 px-4 text-right text-[var(--text-muted)]">
                        <MoneyCell amountMajor={0} currency={currency === 'GHS' ? 'USD' : 'GHS'} />
                      </td>
                      <td className="py-2 px-4 text-right text-[var(--text-muted)]">
                        <MoneyCell amountMajor={0} currency={currency} />
                      </td>
                      <td className="py-2 px-4 text-right text-[var(--text-muted)]">
                        <MoneyCell amountMajor={0} currency={currency} />
                      </td>
                      <td className="py-2 px-4 text-[11px] text-[var(--text-muted)]">Inactive</td>
                    </tr>
                  ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
