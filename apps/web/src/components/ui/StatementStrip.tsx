import React from 'react';
import { MoneyCell } from './MoneyCell.js';

export interface StatementItem {
  id: string;
  label: string;
  ghsPesewas: bigint | number;
  usdEquivalent?: number;
  changeText?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
}

export interface StatementStripProps {
  items: StatementItem[];
  displayCurrency?: 'GHS' | 'USD';
  exchangeRate?: number; // e.g. 15.5
  className?: string;
}

export const StatementStrip: React.FC<StatementStripProps> = ({
  items,
  displayCurrency = 'GHS',
  exchangeRate = 15.5,
  className = '',
}) => {
  return (
    <div
      className={`border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden ${className}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--surface-border)]">
        {items.map((item) => {
          const pesewas =
            typeof item.ghsPesewas === 'bigint'
              ? Number(item.ghsPesewas)
              : item.ghsPesewas;

          const usdAmount =
            item.usdEquivalent !== undefined
              ? item.usdEquivalent
              : (pesewas / 100) / exchangeRate;

          const changeColor =
            item.changeType === 'positive'
              ? 'text-[var(--status-green)]'
              : item.changeType === 'negative'
              ? 'text-[var(--status-red)]'
              : 'text-[var(--text-secondary)]';

          return (
            <div key={item.id} className="p-4 sm:p-5 flex flex-col justify-between">
              {/* Top: Section Label */}
              <div className="text-[13px] font-medium text-[var(--text-secondary)] select-none">
                {item.label}
              </div>

              {/* Middle: Primary Numeric Display */}
              <div className="my-2.5">
                {displayCurrency === 'GHS' ? (
                  <MoneyCell
                    amountPesewas={pesewas}
                    currency="GHS"
                    size="xl"
                    align="left"
                    className="font-semibold"
                  />
                ) : (
                  <MoneyCell
                    amountMajor={usdAmount}
                    currency="USD"
                    size="xl"
                    align="left"
                    className="font-semibold"
                  />
                )}
              </div>

              {/* Bottom: Secondary Counterpart & Change Indicator */}
              <div className="flex flex-wrap items-center justify-between text-[12px] gap-1.5 pt-1 border-t border-[var(--surface-border-subtle)]">
                {/* Secondary currency equivalent */}
                <div className="text-[var(--text-secondary)] tabular-nums">
                  {displayCurrency === 'GHS' ? (
                    <span>
                      <span className="text-[var(--text-muted)]">USD </span>
                      {usdAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  ) : (
                    <span>
                      <span className="text-[var(--text-muted)]">GHS </span>
                      {(pesewas / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>

                {/* Change against prior month */}
                {item.changeText && (
                  <div className={`font-normal ${changeColor} tabular-nums text-[12px]`}>
                    {item.changeText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
