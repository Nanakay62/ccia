import React from 'react';
import { formatMoneyAmount } from '../../config/churchSettings.js';

export interface MoneyCellProps {
  amountPesewas?: bigint | number;
  amountMajor?: number;
  currency?: 'GHS' | 'USD';
  showCurrency?: boolean;
  align?: 'right' | 'left' | 'center';
  size?: 'sm' | 'base' | 'lg' | 'xl';
  isNegativeAllowed?: boolean;
  subdued?: boolean;
  className?: string;
}

export const MoneyCell: React.FC<MoneyCellProps> = ({
  amountPesewas,
  amountMajor,
  currency = 'GHS',
  showCurrency = true,
  align = 'right',
  size = 'base',
  isNegativeAllowed = true,
  subdued = false,
  className = '',
}) => {
  // Compute integer pesewas
  const totalPesewas =
    amountPesewas !== undefined
      ? typeof amountPesewas === 'bigint'
        ? Number(amountPesewas)
        : amountPesewas
      : amountMajor !== undefined
      ? Math.round(amountMajor * 100)
      : 0;

  const isNegative = totalPesewas < 0;
  const absPesewas = Math.abs(totalPesewas);
  const formattedFigure = formatMoneyAmount(absPesewas);

  const sizeClasses = {
    sm: 'text-[14px]',
    base: 'text-[15px]', // Spec: "Table text 15px"
    lg: 'text-[18px]',
    xl: 'text-[24px] tracking-tight',
  }[size];

  const alignClass = {
    right: 'text-right justify-end',
    left: 'text-left justify-start',
    center: 'text-center justify-center',
  }[align];

  const textColor = subdued
    ? 'text-[var(--text-secondary)]'
    : isNegative && isNegativeAllowed
    ? 'text-[var(--status-red)]'
    : 'text-[var(--text-primary)]';

  return (
    <div
      className={`inline-flex items-baseline font-sans tabular-nums ${alignClass} ${textColor} ${sizeClasses} ${className}`}
    >
      {isNegative && <span className="mr-0.5 font-medium">−</span>}
      {showCurrency && (
        <span className="text-[12px] font-normal text-[var(--text-secondary)] mr-1.5 select-none">
          {currency}
        </span>
      )}
      <span className="font-medium tracking-normal">{formattedFigure}</span>
    </div>
  );
};
