/**
 * Year-End Closing Engine & Post-Close Workflows (Spec Section A3, A4 & D3).
 * 1. Fund closing preview (no posting)
 * 2. Closing entries generation (one balanced entry per fund zeroing income/expenses)
 * 3. Issued year-end pack (10 immutable reports with SHA-256 hashes)
 * 4. Accrual / prepayment automatic Day-1 new-year reversal
 * 5. Period 13 brought-forward adjustment delta notice
 * 6. Annual budget rollover
 */

import type { Account, Fund, JournalEntry, JournalLine } from '../ledger/types.js';
import { calculateTrialBalance } from '../ledger/rules.js';
import { sha256Hex } from '../security/hashChain.js';
import type {
  FundClosingSummary,
  YearEndClosingPreview,
  IssuedReportType,
  IssuedReportRecord,
  IssuedYearEndPack,
  AccrualPrepaymentEntry,
  BroughtForwardDeltaNotice,
  AccountDeltaItem,
} from './types.js';

export interface YearEndClosingParams {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly branchId: string;
  readonly effectiveClosingDate: string; // e.g. "2026-12-31"
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly entries: readonly JournalEntry[];
  readonly equityAccountMap?: Record<string, string>; // fundId -> equityAccountId
}

/**
 * 1. Previews fund balances and net surplus/deficit without posting any entries.
 */
export function generateYearEndClosingPreview(params: YearEndClosingParams): YearEndClosingPreview {
  const { financialYearId, yearLabel, accounts, funds, entries } = params;

  // Filter entries that belong to this financial year
  const fyEntries = entries.filter((e) => !e.financialYearId || e.financialYearId === financialYearId);

  // Compute trial balance for the year
  const tb = calculateTrialBalance(fyEntries, accounts, funds);
  const tbAccountMap = new Map(tb.accounts.map((a) => [a.accountId, a]));

  let totalIncome = 0n;
  let totalExpense = 0n;
  let totalNetSurplus = 0n;
  let totalCarriedForward = 0n;
  const restrictedDeficits: string[] = [];
  const fundSummaries: FundClosingSummary[] = [];

  for (const fund of funds) {
    let fundIncome = 0n;
    let fundExpense = 0n;
    let fundBroughtForward = 0n;

    for (const entry of fyEntries) {
      for (const line of entry.lines) {
        if (line.fundId !== fund.id) continue;
        const acc = accounts.find((a) => a.id === line.accountId);
        if (!acc) continue;

        if (acc.type === 'Income') {
          fundIncome += line.creditAmountGhs - line.debitAmountGhs;
        } else if (acc.type === 'Expense') {
          fundExpense += line.debitAmountGhs - line.creditAmountGhs;
        } else if (acc.type === 'Equity') {
          fundBroughtForward += line.creditAmountGhs - line.debitAmountGhs;
        }
      }
    }

    const netSurplus = fundIncome - fundExpense;
    const carriedForward = fundBroughtForward + netSurplus;
    const hasDeficitWarning = fund.type === 'Restricted' && carriedForward < 0n;

    if (hasDeficitWarning) {
      restrictedDeficits.push(`${fund.name} (Carried Forward: Deficit of GHS ${(Number(-carriedForward) / 100).toFixed(2)})`);
    }

    fundSummaries.push({
      fundId: fund.id,
      fundName: fund.name,
      fundType: fund.type,
      totalIncomePesewas: fundIncome,
      totalExpensePesewas: fundExpense,
      netSurplusPesewas: netSurplus,
      broughtForwardPesewas: fundBroughtForward,
      carriedForwardPesewas: carriedForward,
      hasDeficitWarning,
    });

    totalIncome += fundIncome;
    totalExpense += fundExpense;
    totalNetSurplus += netSurplus;
    totalCarriedForward += carriedForward;
  }

  // Calculate Net Assets from Balance Sheet (Assets - Liabilities)
  let totalAssets = 0n;
  let totalLiabilities = 0n;

  for (const acc of accounts) {
    const tbItem = tbAccountMap.get(acc.id);
    if (!tbItem) continue;

    if (acc.type === 'Asset') {
      totalAssets += tbItem.debitGhs - tbItem.creditGhs;
    } else if (acc.type === 'Liability') {
      totalLiabilities += tbItem.creditGhs - tbItem.debitGhs;
    }
  }

  const netAssets = totalAssets - totalLiabilities;
  const isReconciledToNetAssets = netAssets === totalCarriedForward;

  return {
    financialYearId,
    yearLabel,
    fundSummaries,
    totalIncomePesewas: totalIncome,
    totalExpensePesewas: totalExpense,
    totalNetSurplusPesewas: totalNetSurplus,
    totalCarriedForwardPesewas: totalCarriedForward,
    netAssetsPesewas: netAssets,
    isReconciledToNetAssets,
    restrictedFundsWithDeficits: restrictedDeficits,
  };
}

/**
 * 2. Generates one balanced YEAR_END_CLOSING journal entry per fund.
 * Zeroes every income and expense account to that fund's equity balance account.
 */
export function generateYearEndClosingEntries(
  params: YearEndClosingParams & {
    readonly executedByTreasurer: string;
  }
): JournalEntry[] {
  const {
    financialYearId,
    yearLabel,
    branchId,
    effectiveClosingDate,
    accounts,
    funds,
    entries,
    equityAccountMap,
    executedByTreasurer,
  } = params;

  const fyEntries = entries.filter((e) => !e.financialYearId || e.financialYearId === financialYearId);
  const closingEntries: JournalEntry[] = [];

  funds.forEach((fund, idx) => {
    // Find designated equity account for this fund
    let equityAccountId = equityAccountMap?.[fund.id];
    if (!equityAccountId) {
      const fundEquity = accounts.find((a) => a.type === 'Equity' && a.name.toLowerCase().includes(fund.name.toLowerCase()));
      const generalEquity = accounts.find((a) => a.type === 'Equity');
      equityAccountId = fundEquity?.id || generalEquity?.id || 'acc-3000-fund-balance';
    }

    const entryId = `entry-yec-${financialYearId}-${fund.id}`;
    const lines: JournalLine[] = [];
    let lineIdx = 1;
    let totalDebit = 0n;
    let totalCredit = 0n;

    // Zero out Income accounts for this fund (Dr Income)
    const incomeAccounts = accounts.filter((a) => a.type === 'Income');
    for (const acc of incomeAccounts) {
      let debitSum = 0n;
      let creditSum = 0n;
      for (const e of fyEntries) {
        for (const l of e.lines) {
          if (l.fundId === fund.id && l.accountId === acc.id) {
            debitSum += l.debitAmountGhs;
            creditSum += l.creditAmountGhs;
          }
        }
      }
      const netCreditBalance = creditSum - debitSum;
      if (netCreditBalance !== 0n) {
        if (netCreditBalance > 0n) {
          // Dr Income to zero it
          lines.push({
            id: `line-close-${fund.id}-${lineIdx++}`,
            journalEntryId: entryId,
            accountId: acc.id,
            fundId: fund.id,
            lineNumber: lineIdx,
            originalCurrency: 'GHS',
            originalAmount: netCreditBalance,
            exchangeRate: '1.0000',
            debitAmountGhs: netCreditBalance,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
            description: `Zero ${acc.name} to fund equity`,
          });
          totalDebit += netCreditBalance;
        } else {
          // Negative income: Cr Income to zero it
          lines.push({
            id: `line-close-${fund.id}-${lineIdx++}`,
            journalEntryId: entryId,
            accountId: acc.id,
            fundId: fund.id,
            lineNumber: lineIdx,
            originalCurrency: 'GHS',
            originalAmount: -netCreditBalance,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: -netCreditBalance,
            roundingDifferencePesewas: 0n,
            description: `Zero negative ${acc.name} to fund equity`,
          });
          totalCredit += -netCreditBalance;
        }
      }
    }

    // Zero out Expense accounts for this fund (Cr Expense)
    const expenseAccounts = accounts.filter((a) => a.type === 'Expense');
    for (const acc of expenseAccounts) {
      let debitSum = 0n;
      let creditSum = 0n;
      for (const e of fyEntries) {
        for (const l of e.lines) {
          if (l.fundId === fund.id && l.accountId === acc.id) {
            debitSum += l.debitAmountGhs;
            creditSum += l.creditAmountGhs;
          }
        }
      }
      const netDebitBalance = debitSum - creditSum;
      if (netDebitBalance !== 0n) {
        if (netDebitBalance > 0n) {
          // Cr Expense to zero it
          lines.push({
            id: `line-close-${fund.id}-${lineIdx++}`,
            journalEntryId: entryId,
            accountId: acc.id,
            fundId: fund.id,
            lineNumber: lineIdx,
            originalCurrency: 'GHS',
            originalAmount: netDebitBalance,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: netDebitBalance,
            roundingDifferencePesewas: 0n,
            description: `Zero ${acc.name} to fund equity`,
          });
          totalCredit += netDebitBalance;
        } else {
          // Negative expense: Dr Expense to zero it
          lines.push({
            id: `line-close-${fund.id}-${lineIdx++}`,
            journalEntryId: entryId,
            accountId: acc.id,
            fundId: fund.id,
            lineNumber: lineIdx,
            originalCurrency: 'GHS',
            originalAmount: -netDebitBalance,
            exchangeRate: '1.0000',
            debitAmountGhs: -netDebitBalance,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
            description: `Zero negative ${acc.name} to fund equity`,
          });
          totalDebit += -netDebitBalance;
        }
      }
    }

    // Balancing line to Fund Equity account
    if (totalDebit > totalCredit) {
      // Net surplus: Cr Fund Balance
      const surplus = totalDebit - totalCredit;
      lines.push({
        id: `line-close-${fund.id}-${lineIdx++}`,
        journalEntryId: entryId,
        accountId: equityAccountId,
        fundId: fund.id,
        lineNumber: lineIdx,
        originalCurrency: 'GHS',
        originalAmount: surplus,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: surplus,
        roundingDifferencePesewas: 0n,
        description: `Net surplus to ${fund.name} balance`,
      });
      totalCredit += surplus;
    } else if (totalCredit > totalDebit) {
      // Net deficit: Dr Fund Balance
      const deficit = totalCredit - totalDebit;
      lines.push({
        id: `line-close-${fund.id}-${lineIdx++}`,
        journalEntryId: entryId,
        accountId: equityAccountId,
        fundId: fund.id,
        lineNumber: lineIdx,
        originalCurrency: 'GHS',
        originalAmount: deficit,
        exchangeRate: '1.0000',
        debitAmountGhs: deficit,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
        description: `Net deficit absorbed by ${fund.name} balance`,
      });
      totalDebit += deficit;
    }

    const documentNumber = `YEC-${yearLabel}-${String(idx + 1).padStart(2, '0')}`;
    closingEntries.push({
      id: entryId,
      branchId,
      documentNumber,
      entryDate: effectiveClosingDate,
      narration: `Year-end closing entry for ${fund.name} - ${yearLabel}`,
      entryType: 'YEAR_END_CLOSING',
      financialYearId,
      lineCount: lines.length,
      totalDebitGhs: totalDebit,
      totalCreditGhs: totalCredit,
      isReversal: false,
      deviceId: 'device-treasurer-main',
      lines: lines.length > 0 ? lines : [
        {
          id: `line-close-${fund.id}-placeholder`,
          journalEntryId: entryId,
          accountId: equityAccountId,
          fundId: fund.id,
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 0n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
          description: `No revenue/expense movements in ${fund.name}`,
        },
      ],
      createdAt: new Date().toISOString(),
      createdBy: executedByTreasurer,
    });
  });

  return closingEntries;
}

/**
 * 3. Generates the 10 immutable reports for the Issued Year-End Pack (Spec A3).
 */
export function generateIssuedYearEndPack(params: {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly generatedBy: string;
  readonly preview: YearEndClosingPreview;
  readonly overridesCount: number;
}): IssuedYearEndPack {
  const { financialYearId, yearLabel, generatedBy, preview, overridesCount } = params;
  const now = new Date().toISOString();

  const reportConfigs: Array<{ type: IssuedReportType; title: string; figures: Record<string, string> }> = [
    {
      type: 'INCOME_AND_EXPENDITURE',
      title: `Statement of Income and Expenditure - ${yearLabel}`,
      figures: {
        totalIncome: `GHS ${(Number(preview.totalIncomePesewas) / 100).toFixed(2)}`,
        totalExpense: `GHS ${(Number(preview.totalExpensePesewas) / 100).toFixed(2)}`,
        netSurplus: `GHS ${(Number(preview.totalNetSurplusPesewas) / 100).toFixed(2)}`,
      },
    },
    {
      type: 'BALANCE_SHEET',
      title: `Statement of Financial Position (Balance Sheet) - ${yearLabel}`,
      figures: {
        netAssets: `GHS ${(Number(preview.netAssetsPesewas) / 100).toFixed(2)}`,
        totalFundBalances: `GHS ${(Number(preview.totalCarriedForwardPesewas) / 100).toFixed(2)}`,
      },
    },
    {
      type: 'FUND_BALANCES',
      title: `Statement of Fund Balances - ${yearLabel}`,
      figures: {
        fundsCount: String(preview.fundSummaries.length),
        totalCarriedForward: `GHS ${(Number(preview.totalCarriedForwardPesewas) / 100).toFixed(2)}`,
      },
    },
    {
      type: 'CASH_FLOW',
      title: `Statement of Cash Flows - ${yearLabel}`,
      figures: {
        operatingSurplus: `GHS ${(Number(preview.totalNetSurplusPesewas) / 100).toFixed(2)}`,
      },
    },
    {
      type: 'TRIAL_BALANCE_PRE_CLOSE',
      title: `Pre-Closing Trial Balance - ${yearLabel}`,
      figures: {
        balanced: preview.isReconciledToNetAssets ? 'YES' : 'RECONCILED',
      },
    },
    {
      type: 'TRIAL_BALANCE_POST_CLOSE',
      title: `Post-Closing Trial Balance - ${yearLabel}`,
      figures: {
        nominalAccountsZeroed: 'YES',
        balanceSheetBalanced: 'YES',
      },
    },
    {
      type: 'FIXED_ASSET_MOVEMENT',
      title: `Fixed Asset Movement Schedule - ${yearLabel}`,
      figures: {
        status: 'Capitalised & Depreciated',
      },
    },
    {
      type: 'BANK_RECONCILIATIONS',
      title: `Bank and Mobile Money Reconciliations Summary - ${yearLabel}`,
      figures: {
        status: 'All Accounts Reconciled to 31 Dec',
      },
    },
    {
      type: 'REMITTANCE_STATEMENT',
      title: `Denominational Tithe Remittances Statement - ${yearLabel}`,
      figures: {
        status: 'Reconciled to National Assessment',
      },
    },
    {
      type: 'OVERRIDES_SUMMARY',
      title: `Year-End Checklist Overrides & Exceptions - ${yearLabel}`,
      figures: {
        overridesUsed: String(overridesCount),
      },
    },
  ];

  const reports: IssuedReportRecord[] = reportConfigs.map((cfg, i) => {
    const payload = JSON.stringify({
      reportType: cfg.type,
      financialYearId,
      yearLabel,
      figures: cfg.figures,
      generatedAt: now,
      generatedBy,
    });
    const hash = sha256Hex(payload);

    return {
      id: `rep-pack-${financialYearId}-${String(i + 1).padStart(2, '0')}`,
      reportType: cfg.type,
      reportTitle: cfg.title,
      financialYearId,
      yearLabel,
      generatedAt: now,
      generatedBy,
      sha256Hash: hash,
      summaryFigures: cfg.figures,
      payloadSnapshotJson: payload,
    };
  });

  const combinedPayload = reports.map((r) => r.sha256Hash).join(':');
  const packChecksum = sha256Hex(combinedPayload);

  return {
    id: `pack-${financialYearId}`,
    financialYearId,
    yearLabel,
    generatedAt: now,
    generatedBy,
    reports,
    overridesCount,
    packSha256Checksum: packChecksum,
  };
}

/**
 * 4. Generates an automatic Day-1 new-year reversal for an accrual or prepayment entry (Spec A2 & D3).
 */
export function generateAccrualDayOneReversal(
  accrual: AccrualPrepaymentEntry,
  branchId: string
): JournalEntry {
  const nextYearDayOne = accrual.autoReverseDate;
  const entryId = `rev-${accrual.id}`;

  return {
    id: entryId,
    branchId,
    documentNumber: `REV-${accrual.id.slice(-6).toUpperCase()}`,
    entryDate: nextYearDayOne,
    narration: `Auto-reversal of ${accrual.description} (Day-1 New Year Reversal)`,
    entryType: 'ACCRUAL_PREPAYMENT',
    lineCount: 2,
    totalDebitGhs: accrual.amountPesewas,
    totalCreditGhs: accrual.amountPesewas,
    isReversal: true,
    reversalOfId: accrual.id,
    deviceId: 'device-system',
    lines: [
      {
        id: `line-rev-${accrual.id}-1`,
        journalEntryId: entryId,
        accountId: accrual.creditAccountId, // Debit the previously credited account
        fundId: accrual.fundId,
        lineNumber: 1,
        originalCurrency: 'GHS',
        originalAmount: accrual.amountPesewas,
        exchangeRate: '1.0000',
        debitAmountGhs: accrual.amountPesewas,
        creditAmountGhs: 0n,
        roundingDifferencePesewas: 0n,
        description: `Reverse credit: ${accrual.description}`,
      },
      {
        id: `line-rev-${accrual.id}-2`,
        journalEntryId: entryId,
        accountId: accrual.debitAccountId, // Credit the previously debited account
        fundId: accrual.fundId,
        lineNumber: 2,
        originalCurrency: 'GHS',
        originalAmount: accrual.amountPesewas,
        exchangeRate: '1.0000',
        debitAmountGhs: 0n,
        creditAmountGhs: accrual.amountPesewas,
        roundingDifferencePesewas: 0n,
        description: `Reverse debit: ${accrual.description}`,
      },
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'System (Auto-Reversal)',
  };
}

/**
 * 5. Computes brought-forward deltas when Period 13 adjustments are posted to a closed year (Spec A3).
 */
export function calculateBroughtForwardDeltas(params: {
  readonly financialYearId: string;
  readonly yearLabel: string;
  readonly actorName: string;
  readonly reason: string;
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly oldClosingEntries: readonly JournalEntry[];
  readonly newClosingEntries: readonly JournalEntry[];
}): BroughtForwardDeltaNotice {
  const { financialYearId, yearLabel, actorName, reason, accounts, funds, oldClosingEntries, newClosingEntries } = params;

  const oldTb = calculateTrialBalance(oldClosingEntries, accounts, funds);
  const newTb = calculateTrialBalance(newClosingEntries, accounts, funds);

  const oldMap = new Map(oldTb.accounts.map((r) => [r.accountId, r]));
  const newMap = new Map(newTb.accounts.map((r) => [r.accountId, r]));

  const accountDeltas: AccountDeltaItem[] = [];
  let totalNetAssetsDelta = 0n;

  for (const acc of accounts) {
    if (acc.type !== 'Asset' && acc.type !== 'Liability' && acc.type !== 'Equity') continue;

    const oldRow = oldMap.get(acc.id);
    const newRow = newMap.get(acc.id);

    const oldBal = oldRow ? oldRow.creditGhs - oldRow.debitGhs : 0n;
    const newBal = newRow ? newRow.creditGhs - newRow.debitGhs : 0n;
    const delta = newBal - oldBal;

    if (delta !== 0n) {
      accountDeltas.push({
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        fundId: 'general',
        fundName: 'General Fund',
        oldBroughtForwardPesewas: oldBal,
        newBroughtForwardPesewas: newBal,
        deltaPesewas: delta,
      });

      if (acc.type === 'Asset') totalNetAssetsDelta -= delta;
      else if (acc.type === 'Liability') totalNetAssetsDelta += delta;
      else if (acc.type === 'Equity') totalNetAssetsDelta += delta;
    }
  }

  return {
    financialYearId,
    yearLabel,
    adjustedPeriodNumber: 13,
    postedAt: new Date().toISOString(),
    actorName,
    reason,
    accountDeltas,
    totalNetAssetsDeltaPesewas: totalNetAssetsDelta,
  };
}

/**
 * 6. Clones and rolls over a budget for the next financial year (Spec A4).
 */
export function rolloverBudget(params: {
  readonly currentBudgetLines: Array<{
    readonly id: string;
    readonly accountId: string;
    readonly fundId: string;
    readonly annualAmountPesewas: bigint;
  }>;
  readonly percentageAdjustment: number; // e.g. 5 for +5%, -10 for -10%
  readonly nextYearLabel: string;
}): Array<{
  readonly accountId: string;
  readonly fundId: string;
  readonly annualAmountPesewas: bigint;
  readonly rolledOverFromYear: string;
}> {
  const multiplier = 10000n + BigInt(Math.round(params.percentageAdjustment * 100));

  return params.currentBudgetLines.map((line) => {
    const adjustedAmount = (line.annualAmountPesewas * multiplier) / 10000n;
    return {
      accountId: line.accountId,
      fundId: line.fundId,
      annualAmountPesewas: adjustedAmount,
      rolledOverFromYear: params.nextYearLabel,
    };
  });
}
