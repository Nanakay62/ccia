/**
 * Denominational USD Summary Report Generator.
 * Translates primary GHS books of account into a high-level USD reporting view
 * using Banker's Rounding (Round-Half-To-Even) on minor cents.
 */

import Big from 'big.js';
import type { IncomeExpenditureReport, BalanceSheetReport, DenominationUsdSummaryReport } from './types.js';

export interface GenerateUsdSummaryInput {
  readonly churchName?: string;
  readonly branchName?: string;
  readonly asOfDate: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly exchangeRate: string; // e.g. "15.5000"
  readonly rateBasis: 'CLOSING_RATE' | 'PERIOD_AVERAGE';
  readonly incomeExpenditure: IncomeExpenditureReport;
  readonly balanceSheet: BalanceSheetReport;
}

/**
 * Converts Ghana Cedis minor units (pesewas) to USD minor units (cents)
 * using the exchange rate (GHS per USD) and Banker's Rounding (IEEE 754 Round-Half-To-Even).
 */
export function convertGhsPesewasToUsdCents(
  pesewas: bigint,
  exchangeRateStr: string | number
): bigint {
  const rate = new Big(exchangeRateStr);
  if (rate.lte(0)) {
    throw new Error(`Exchange rate must be positive, got: ${exchangeRateStr}`);
  }

  // Cents = Pesewas / Rate (Round-Half-To-Even)
  const exactUsd = new Big(pesewas.toString()).div(rate);
  const rounded = exactUsd.round(0, Big.roundHalfEven);
  return BigInt(rounded.toFixed(0));
}

/**
 * Generates the official Denominational USD Summary Report.
 */
export function generateDenominationUsdSummaryReport(
  input: GenerateUsdSummaryInput
): DenominationUsdSummaryReport {
  const {
    churchName = 'Accra Central Grace Chapel',
    branchName = 'Accra Main Branch',
    asOfDate,
    periodStart,
    periodEnd,
    exchangeRate,
    rateBasis,
    incomeExpenditure,
    balanceSheet,
  } = input;

  const toUsd = (pesewas: bigint) => convertGhsPesewasToUsdCents(pesewas, exchangeRate);

  // Statement of Activities (Income & Expenditure)
  const totalIncomeUsdCents = toUsd(incomeExpenditure.totalIncomePesewas);
  const totalExpenseUsdCents = toUsd(incomeExpenditure.totalExpensePesewas);
  const netSurplusDeficitUsdCents = totalIncomeUsdCents - totalExpenseUsdCents;

  const mainIncomeLines = incomeExpenditure.incomes.slice(0, 5).map((l) => ({
    name: l.accountName,
    amountUsdCents: toUsd(l.amountPesewas),
  }));

  const mainExpenseLines = incomeExpenditure.expenses.slice(0, 5).map((l) => ({
    name: l.accountName,
    amountUsdCents: toUsd(l.amountPesewas),
  }));

  // Statement of Financial Position (Balance Sheet)
  const totalAssetsUsdCents = toUsd(balanceSheet.totalAssetsPesewas);
  const totalLiabilitiesUsdCents = toUsd(balanceSheet.totalLiabilitiesPesewas);
  const unrestrictedFundsUsdCents = toUsd(balanceSheet.unrestrictedFundBalancesPesewas);
  const restrictedFundsUsdCents = toUsd(balanceSheet.restrictedFundBalancesPesewas);
  const totalNetAssetsUsdCents = unrestrictedFundsUsdCents + restrictedFundsUsdCents;

  // Cash and Bank reserves
  const cashAccountsTotalPesewas = balanceSheet.currentAssets
    .filter((a) => a.accountCode.startsWith('10'))
    .reduce((sum, a) => sum + a.amountPesewas, 0n);
  const cashAndBankUsdCents = toUsd(cashAccountsTotalPesewas);

  const basisLabel =
    rateBasis === 'CLOSING_RATE'
      ? 'Month-End Closing Rate'
      : 'Period Average Rate';

  const mandatoryDisclosureFootnote =
    `Note: The figures in this USD summary report are translated from the primary books of account maintained in Ghana Cedis (GHS) at the exchange rate of 1 USD = ${exchangeRate} GHS (${basisLabel}) as of ${asOfDate} for denominational reporting purposes only.`;

  return {
    title: 'Denomination Financial Summary Report (USD Translation)',
    churchName,
    branchName,
    asOfDate,
    periodStart,
    periodEnd,
    exchangeRate,
    rateBasis,
    statementOfActivities: {
      totalIncomeUsdCents,
      totalExpenseUsdCents,
      netSurplusDeficitUsdCents,
      mainIncomeLines,
      mainExpenseLines,
    },
    statementOfPosition: {
      totalAssetsUsdCents,
      totalLiabilitiesUsdCents,
      unrestrictedFundsUsdCents,
      restrictedFundsUsdCents,
      totalNetAssetsUsdCents,
      cashAndBankUsdCents,
    },
    mandatoryDisclosureFootnote,
  };
}
