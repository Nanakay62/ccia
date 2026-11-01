import Big from 'big.js';
import type { PaymentVoucher, WithholdingTaxRate, VoucherPaymentMethod } from './types.js';
import type { JournalEntry, JournalLine } from '../ledger/types.js';
import { validateJournalEntry } from '../ledger/rules.js';

/**
 * Calculates Ghana Withholding Tax (WHT) and net payable amount in minor units.
 * Rates: 3% (goods), 5% (services), 7.5% (rent), 10% (contracts).
 */
export function calculateWithholdingTax(
  grossPesewas: bigint,
  rate: WithholdingTaxRate
): { whtPesewas: bigint; netPesewas: bigint } {
  if (rate === 0 || grossPesewas <= 0n) {
    return { whtPesewas: 0n, netPesewas: grossPesewas };
  }

  // WHT = gross * (rate / 100) using high-precision Big.js
  const grossBig = new Big(grossPesewas.toString());
  const rateBig = new Big(rate.toString()).div(100);
  const whtBig = grossBig.times(rateBig).round(0); // Nearest integer pesewa

  const whtPesewas = BigInt(whtBig.toFixed(0));
  const netPesewas = grossPesewas - whtPesewas;

  return { whtPesewas, netPesewas };
}

export interface VoucherJournalParams {
  readonly voucher: PaymentVoucher;
  readonly branchId: string;
  readonly createdBy: string;
  readonly deviceId: string;
  readonly exchangeRateUsd?: string;
}

function resolveAssetAccountForPaymentMethod(method: VoucherPaymentMethod): {
  accountId: string;
  currency: 'GHS' | 'USD';
  description: string;
} {
  switch (method) {
    case 'CASH_GHS':
      return { accountId: 'acct-1010', currency: 'GHS', description: 'Cash on Hand (GHS)' };
    case 'CASH_USD':
      return { accountId: 'acct-1020', currency: 'USD', description: 'Cash on Hand (USD)' };
    case 'BANK_GHS':
    case 'CHEQUE':
      return { accountId: 'acct-1030', currency: 'GHS', description: 'Bank Account (GHS)' };
    case 'BANK_USD':
      return { accountId: 'acct-1040', currency: 'USD', description: 'Bank Account (USD)' };
    case 'MOMO':
      return { accountId: 'acct-1050', currency: 'GHS', description: 'Mobile Money (MoMo) Wallet' };
    default:
      return { accountId: 'acct-1010', currency: 'GHS', description: 'Cash on Hand (GHS)' };
  }
}

/**
 * Automatically creates a balanced double-entry JournalEntry for a Payment Voucher.
 * Debits the designated Expense Account for the GROSS amount.
 * Credits the Payment Asset Account for the NET amount.
 * Credits Withholding Tax Payable (2030) for the WHT amount if applicable.
 */
export function generateJournalEntryFromVoucher(params: VoucherJournalParams): JournalEntry {
  const { voucher, branchId, createdBy, deviceId } = params;
  const isUsd = voucher.currency === 'USD';
  const rateUsd = params.exchangeRateUsd || '15.5000';
  const exchangeRate = isUsd ? rateUsd : '1.0000';

  const lines: JournalLine[] = [];
  let lineNumber = 1;

  // 1. Debit: Designated Expense Account (Gross Amount)
  const grossAmountGhs = isUsd
    ? BigInt(Math.round(Number(voucher.grossAmountPesewas) * parseFloat(rateUsd)))
    : voucher.grossAmountPesewas;

  lines.push({
    id: `line-${voucher.id}-exp`,
    journalEntryId: voucher.id,
    accountId: voucher.expenseAccountId,
    fundId: voucher.fundId,
    lineNumber: lineNumber++,
    description: `${voucher.purpose} - Payee: ${voucher.payeeName}`,
    originalCurrency: voucher.currency,
    originalAmount: voucher.grossAmountPesewas,
    exchangeRate,
    debitAmountGhs: grossAmountGhs,
    creditAmountGhs: 0n,
    roundingDifferencePesewas: 0n,
  });

  // 2. Credit: Payment Asset Account (Net Payable Amount)
  const assetAccount = resolveAssetAccountForPaymentMethod(voucher.paymentMethod);
  const netAmountGhs = isUsd
    ? BigInt(Math.round(Number(voucher.netPayablePesewas) * parseFloat(rateUsd)))
    : voucher.netPayablePesewas;

  const paymentDesc =
    voucher.paymentMethod === 'CHEQUE' && voucher.chequeNumber
      ? `Disbursed via Cheque #${voucher.chequeNumber}`
      : voucher.paymentMethod === 'MOMO' && voucher.momoReference
      ? `Disbursed via MoMo (Ref: ${voucher.momoReference})`
      : `Disbursed via ${assetAccount.description}`;

  lines.push({
    id: `line-${voucher.id}-net-pay`,
    journalEntryId: voucher.id,
    accountId: assetAccount.accountId,
    fundId: voucher.fundId,
    lineNumber: lineNumber++,
    description: paymentDesc,
    originalCurrency: voucher.currency,
    originalAmount: voucher.netPayablePesewas,
    exchangeRate,
    debitAmountGhs: 0n,
    creditAmountGhs: netAmountGhs,
    roundingDifferencePesewas: 0n,
  });

  // 3. Credit: Withholding Tax Payable (if WHT applied)
  if (voucher.withholdingTaxPesewas > 0n) {
    const whtGhs = isUsd
      ? BigInt(Math.round(Number(voucher.withholdingTaxPesewas) * parseFloat(rateUsd)))
      : voucher.withholdingTaxPesewas;

    lines.push({
      id: `line-${voucher.id}-wht`,
      journalEntryId: voucher.id,
      accountId: 'acct-2030', // Withholding Tax (WHT) Payable
      fundId: voucher.fundId,
      lineNumber: lineNumber++,
      description: `WHT ${voucher.withholdingTaxRate}% deducted on ${voucher.payeeName}`,
      originalCurrency: voucher.currency,
      originalAmount: voucher.withholdingTaxPesewas,
      exchangeRate,
      debitAmountGhs: 0n,
      creditAmountGhs: whtGhs,
      roundingDifferencePesewas: 0n,
    });
  }

  // Calculate entry control totals
  const totalDebitGhs = lines.reduce((acc, l) => acc + l.debitAmountGhs, 0n);
  const totalCreditGhs = lines.reduce((acc, l) => acc + l.creditAmountGhs, 0n);

  const entry: JournalEntry = {
    id: voucher.id,
    branchId,
    documentNumber: voucher.voucherNumber,
    entryDate: voucher.voucherDate,
    entryType: 'STANDARD',
    narration: `Payment Voucher ${voucher.voucherNumber} to ${voucher.payeeName} (${voucher.purpose})`,
    lineCount: lines.length,
    totalDebitGhs,
    totalCreditGhs,
    isReversal: false,
    createdBy,
    deviceId,
    createdAt: new Date().toISOString(),
    lines,
  };

  const validation = validateJournalEntry(entry);
  if (!validation.isValid) {
    throw new Error(`Voucher journal entry failed validation: ${validation.errors.join('; ')}`);
  }

  return entry;
}
