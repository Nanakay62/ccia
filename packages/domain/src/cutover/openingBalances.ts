import { convertLineToBaseCurrency } from '../money/index.js';
import type { Account, AccountingPeriod, Fund, JournalEntry } from '../ledger/types.js';
import { calculateTrialBalance, createJournalEntry, type CreateLineInput } from '../ledger/rules.js';
import type {
  CutOverSubledgerProofs,
  FundOpeningBalanceSummary,
  OpeningBalanceCommitParams,
  OpeningBalanceDryRunResult,
  OpeningBalanceRowDiagnostic,
  OpeningBalanceRowInput,
  OpeningBalanceValidationReport,
  StatementComparisonItem,
  SubledgerAgreementItem,
} from './types.js';

/**
 * Generates a downloadable CSV template for Opening Balances (Spec B2).
 * Columns: account_code, fund, currency, debit_amount, credit_amount, rate, rate_date, description
 */
export function generateOpeningBalanceCsvTemplate(cutOverDate = '2026-01-01'): string {
  const header = 'account_code,fund,currency,debit_amount,credit_amount,rate,rate_date,description';
  const sampleRows = [
    `1010,GEN,GHS,4500.00,0.00,1.0000,${cutOverDate},Opening Cash on Hand (GHS) per safe count`,
    `1030,GEN,GHS,28500.00,0.00,1.0000,${cutOverDate},Opening Bank Account (GHS) per GCB statement`,
    `1050,GEN,GHS,6200.00,0.00,1.0000,${cutOverDate},Opening Mobile Money Wallet per MTN statement`,
    `2010,GEN,GHS,0.00,1200.00,1.0000,${cutOverDate},Opening Accounts Payable (ECG & Water)`,
    `3010,GEN,GHS,0.00,38000.00,1.0000,${cutOverDate},General Fund Balance Brought Forward`,
    `1030,BLD,GHS,42000.00,0.00,1.0000,${cutOverDate},Building Fund Bank Balance per statement`,
    `3020,BLD,GHS,0.00,42000.00,1.0000,${cutOverDate},Building Fund Restricted Balance Brought Forward`,
    `1020,MIS,USD,200.00,0.00,15.5000,${cutOverDate},Missions USD Cash on Hand ($200 @ 15.50)`,
    `3020,MIS,GHS,0.00,3100.00,1.0000,${cutOverDate},Missions Restricted Fund Balance Brought Forward`,
  ];
  return [header, ...sampleRows].join('\n');
}

function parseMoneyStringToMinor(raw: string | undefined): bigint {
  if (!raw) return 0n;
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '0' || cleaned === '0.00') return 0n;
  const num = Number(cleaned);
  if (isNaN(num) || num < 0) return -1n;
  return BigInt(Math.round(num * 100));
}

/**
 * Parses CSV text into OpeningBalanceRowInput[].
 */
export function parseOpeningBalanceCsv(csvText: string): readonly OpeningBalanceRowInput[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length <= 1) return [];

  const rows: OpeningBalanceRowInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim());
    const accountCode = cols[0] ?? '';
    const fundCode = cols[1] ?? '';
    const currencyRaw = (cols[2] ?? 'GHS').toUpperCase();
    const currency = currencyRaw === 'USD' ? 'USD' : 'GHS';
    const debitOriginalMinor = parseMoneyStringToMinor(cols[3]);
    const creditOriginalMinor = parseMoneyStringToMinor(cols[4]);
    const exchangeRate = cols[5] && cols[5].length > 0 ? cols[5] : currency === 'GHS' ? '1.0000' : '';
    const rateDate = cols[6] && cols[6].length > 0 ? cols[6] : null;
    const description = cols.slice(7).join(', ') || null;

    rows.push({
      rowNumber: i,
      accountCode,
      fundCode,
      currency,
      debitOriginalMinor,
      creditOriginalMinor,
      exchangeRate,
      rateDate,
      description,
    });
  }

  return rows;
}

/**
 * Validates Opening Balance rows against all Section B2 accounting & cut-over rules:
 * 1. Debits equal credits overall AND within each fund (never plugged automatically).
 * 2. Every account and fund exists and is active; restricted funds are not mixed with unrestricted equity accounts.
 * 3. Income and Expense accounts cannot carry opening balances (opening balances are Balance Sheet accounts only).
 * 4. USD balances carry original USD amounts with a rate & rateDate, and ONLY cash and bank accounts may carry USD balances (fixed assets keep historical GHS cost).
 * 5. Bank, MoMo, and cash balances agree with the entered/attached bank statements and cash counts.
 * 6. Fixed asset cost & accumulated depreciation and payables/receivables agree with sub-ledger schedules.
 */
export function validateOpeningBalances(params: {
  readonly rows: readonly OpeningBalanceRowInput[];
  readonly cutOverDate: string;
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly proofs?: CutOverSubledgerProofs;
}): OpeningBalanceValidationReport {
  const { rows, cutOverDate, accounts, funds, proofs } = params;

  const accountByCode = new Map(accounts.map((a) => [a.code.toUpperCase(), a]));
  const fundByCode = new Map(funds.map((f) => [f.code.toUpperCase(), f]));
  const fundById = new Map(funds.map((f) => [f.id, f]));

  const diagnostics: OpeningBalanceRowDiagnostic[] = [];

  if (rows.length === 0) {
    diagnostics.push({
      rowNumber: 0,
      severity: 'ERROR',
      accountCode: '—',
      fundCode: '—',
      message: 'No opening balance rows were provided.',
    });
  }

  let totalDebitGhs = 0n;
  let totalCreditGhs = 0n;

  const fundAccum = new Map<
    string,
    { fund: Fund; lineCount: number; debitGhs: bigint; creditGhs: bigint }
  >();
  const accountNetDebitGhs = new Map<string, bigint>(); // Debit - Credit per accountCode

  for (const row of rows) {
    const acct = accountByCode.get(row.accountCode.toUpperCase());
    const fund =
      fundByCode.get(row.fundCode.toUpperCase()) ?? fundById.get(row.fundCode);

    if (!acct) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode || '(blank)',
        fundCode: row.fundCode || '(blank)',
        message: `Row ${row.rowNumber}: Account code "${row.accountCode}" does not exist in the chart of accounts.`,
      });
    } else if (!acct.isActive) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: Account "${acct.name}" (${acct.code}) is inactive.`,
      });
    } else if (acct.type === 'Income' || acct.type === 'Expense') {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: Account "${acct.name}" (${acct.code}) is an ${acct.type} account. Opening balances apply to Balance Sheet accounts (Assets, Liabilities, Fund Balances); prior income and expenses belong in fund balances.`,
      });
    }

    if (!fund) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode || '(blank)',
        fundCode: row.fundCode || '(blank)',
        message: `Row ${row.rowNumber}: Fund "${row.fundCode}" does not exist.`,
      });
    } else if (!fund.isActive) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: Fund "${fund.name}" (${fund.code}) is inactive.`,
      });
    }

    // Restricted vs Unrestricted fund mixing check on Fund Balance (Equity) accounts
    if (acct && fund && acct.type === 'Equity') {
      const isRestrictedEquityAccount =
        acct.code === '3020' || acct.name.toLowerCase().includes('restricted');
      const isGeneralEquityAccount =
        acct.code === '3010' || acct.name.toLowerCase().includes('general fund');

      if (fund.type === 'Restricted' && isGeneralEquityAccount && !isRestrictedEquityAccount) {
        diagnostics.push({
          rowNumber: row.rowNumber,
          severity: 'ERROR',
          accountCode: row.accountCode,
          fundCode: row.fundCode,
          message: `Row ${row.rowNumber}: Restricted fund "${fund.name}" cannot be posted to unrestricted equity account "${acct.name}" (${acct.code}). Use Restricted Fund Balance (3020).`,
        });
      }
      if (fund.type === 'Unrestricted' && isRestrictedEquityAccount) {
        diagnostics.push({
          rowNumber: row.rowNumber,
          severity: 'ERROR',
          accountCode: row.accountCode,
          fundCode: row.fundCode,
          message: `Row ${row.rowNumber}: Unrestricted fund "${fund.name}" cannot be posted to restricted equity account "${acct.name}" (${acct.code}). Use General Fund Balance (3010).`,
        });
      }
    }

    // Debit / Credit amount checks
    if (row.debitOriginalMinor < 0n || row.creditOriginalMinor < 0n) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: Debit and credit amounts must be non-negative numbers.`,
      });
      continue;
    }

    const hasDebit = row.debitOriginalMinor > 0n;
    const hasCredit = row.creditOriginalMinor > 0n;

    if (!hasDebit && !hasCredit) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: Either a debit or credit amount greater than zero is required.`,
      });
      continue;
    }

    if (hasDebit && hasCredit) {
      diagnostics.push({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        accountCode: row.accountCode,
        fundCode: row.fundCode,
        message: `Row ${row.rowNumber}: A single row cannot have both a debit and a credit amount.`,
      });
      continue;
    }

    // Foreign currency (USD) rules (Spec B2: USD balances carry original USD amounts with a rate & rateDate; cash and bank accounts only)
    let effectiveRate = row.exchangeRate || '1.0000';
    if (row.currency === 'USD') {
      if (acct && !acct.isBankOrCash) {
        diagnostics.push({
          rowNumber: row.rowNumber,
          severity: 'ERROR',
          accountCode: row.accountCode,
          fundCode: row.fundCode,
          message: `Row ${row.rowNumber}: Account "${acct.name}" (${acct.code}) cannot carry a USD opening balance. Only cash and bank accounts carry USD balances; fixed assets and other accounts keep their historical GHS cost.`,
        });
      }
      const parsedRate = Number(row.exchangeRate);
      if (!row.exchangeRate || isNaN(parsedRate) || parsedRate <= 0 || parsedRate === 1) {
        diagnostics.push({
          rowNumber: row.rowNumber,
          severity: 'ERROR',
          accountCode: row.accountCode,
          fundCode: row.fundCode,
          message: `Row ${row.rowNumber}: USD opening balance requires a valid USD-to-GHS exchange rate (for example 15.5000).`,
        });
        effectiveRate = '1.0000';
      }
      if (!row.rateDate || !/^\d{4}-\d{2}-\d{2}$/.test(row.rateDate)) {
        diagnostics.push({
          rowNumber: row.rowNumber,
          severity: 'ERROR',
          accountCode: row.accountCode,
          fundCode: row.fundCode,
          message: `Row ${row.rowNumber}: USD opening balance requires the exchange rate date (YYYY-MM-DD).`,
        });
      }
    } else {
      effectiveRate = '1.0000';
    }

    const originalMinor = hasDebit ? row.debitOriginalMinor : row.creditOriginalMinor;
    const converted = convertLineToBaseCurrency(originalMinor, row.currency, effectiveRate);
    const debitGhs = hasDebit ? converted.baseAmountGhs : 0n;
    const creditGhs = hasDebit ? 0n : converted.baseAmountGhs;

    totalDebitGhs += debitGhs;
    totalCreditGhs += creditGhs;

    if (fund) {
      const existing = fundAccum.get(fund.id) ?? {
        fund,
        lineCount: 0,
        debitGhs: 0n,
        creditGhs: 0n,
      };
      fundAccum.set(fund.id, {
        fund,
        lineCount: existing.lineCount + 1,
        debitGhs: existing.debitGhs + debitGhs,
        creditGhs: existing.creditGhs + creditGhs,
      });
    }

    if (acct) {
      const prevAcctBal = accountNetDebitGhs.get(acct.code) ?? 0n;
      accountNetDebitGhs.set(acct.code, prevAcctBal + (debitGhs - creditGhs));
    }
  }

  // Per-fund balance summaries (never plugged automatically!)
  const fundSummaries: FundOpeningBalanceSummary[] = [];
  for (const [, item] of fundAccum.entries()) {
    const diff = item.debitGhs - item.creditGhs;
    const isBalanced = diff === 0n;
    fundSummaries.push({
      fundId: item.fund.id,
      fundCode: item.fund.code,
      fundName: item.fund.name,
      fundType: item.fund.type,
      lineCount: item.lineCount,
      totalDebitGhs: item.debitGhs,
      totalCreditGhs: item.creditGhs,
      differenceGhs: diff,
      isBalanced,
    });

    if (!isBalanced) {
      const absDiffMajor = (Number(diff < 0n ? -diff : diff) / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      diagnostics.push({
        rowNumber: 0,
        severity: 'ERROR',
        accountCode: '—',
        fundCode: item.fund.code,
        message: `Fund "${item.fund.name}" (${item.fund.code}) does not balance: Debits and Credits differ by GHS ${absDiffMajor}. Fix the lines for this fund (differences are never plugged automatically).`,
      });
    }
  }

  // Bank, MoMo & Cash Statement Reconciliation checks (Spec B2)
  const statementComparisons: StatementComparisonItem[] = [];
  if (proofs?.statementAndCashProofs) {
    for (const proof of proofs.statementAndCashProofs) {
      const acct = accountByCode.get(proof.accountCode.toUpperCase());
      if (!acct) continue;
      const ledgerOpeningBalanceGhs = accountNetDebitGhs.get(acct.code) ?? 0n;
      const diff = ledgerOpeningBalanceGhs - proof.statementOrCountBalanceGhs;
      const agrees = diff === 0n;

      statementComparisons.push({
        accountId: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        currency: acct.currency,
        ledgerOpeningBalanceGhs,
        statementOrCountBalanceGhs: proof.statementOrCountBalanceGhs,
        differenceGhs: diff,
        agrees,
        statementDate: proof.statementDate,
        reference: proof.reference,
        attachmentFileName: proof.attachmentFileName ?? null,
      });

      if (!agrees) {
        const absDiffMajor = (Number(diff < 0n ? -diff : diff) / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        diagnostics.push({
          rowNumber: 0,
          severity: 'ERROR',
          accountCode: acct.code,
          fundCode: '—',
          message: `${acct.name} (${acct.code}) opening balance differs from statement/cash count (${proof.reference}) by GHS ${absDiffMajor}.`,
        });
      }
    }
  }

  // Fixed Assets & Sub-ledger Agreement checks (Spec B2)
  const subledgerAgreements: SubledgerAgreementItem[] = [];

  if (proofs?.fixedAssetRegisterCostGhs !== undefined && proofs.fixedAssetRegisterCostGhs !== null) {
    // Sum fixed asset cost accounts (e.g., 1510..1590 or accounts with 'asset'/'equipment' not accumulated depreciation)
    let ledgerAssetCost = 0n;
    for (const [code, bal] of accountNetDebitGhs.entries()) {
      if (code.startsWith('15') && !code.endsWith('9')) {
        ledgerAssetCost += bal;
      }
    }
    const diff = ledgerAssetCost - proofs.fixedAssetRegisterCostGhs;
    const agrees = diff === 0n;
    subledgerAgreements.push({
      category: 'FIXED_ASSETS_COST',
      label: 'Fixed asset register historical cost',
      ledgerAmountGhs: ledgerAssetCost,
      subledgerScheduleAmountGhs: proofs.fixedAssetRegisterCostGhs,
      differenceGhs: diff,
      agrees,
    });
    if (!agrees) {
      diagnostics.push({
        rowNumber: 0,
        severity: 'ERROR',
        accountCode: '15xx',
        fundCode: '—',
        message: 'Fixed asset cost in opening balances does not match the Fixed Asset Register total.',
      });
    }
  }

  if (
    proofs?.fixedAssetAccumDepreciationGhs !== undefined &&
    proofs.fixedAssetAccumDepreciationGhs !== null
  ) {
    let ledgerAccumDepCredit = 0n;
    for (const [code, bal] of accountNetDebitGhs.entries()) {
      if (code.startsWith('15') && code.endsWith('9')) {
        // Accumulated depreciation is a contra-asset (credit balance -> negative net debit)
        ledgerAccumDepCredit += -bal;
      }
    }
    const diff = ledgerAccumDepCredit - proofs.fixedAssetAccumDepreciationGhs;
    const agrees = diff === 0n;
    subledgerAgreements.push({
      category: 'FIXED_ASSETS_ACCUM_DEP',
      label: 'Fixed asset accumulated depreciation to cut-over date',
      ledgerAmountGhs: ledgerAccumDepCredit,
      subledgerScheduleAmountGhs: proofs.fixedAssetAccumDepreciationGhs,
      differenceGhs: diff,
      agrees,
    });
    if (!agrees) {
      diagnostics.push({
        rowNumber: 0,
        severity: 'ERROR',
        accountCode: '15x9',
        fundCode: '—',
        message: 'Accumulated depreciation in opening balances does not match the Fixed Asset Register total.',
      });
    }
  }

  if (proofs?.payablesScheduleTotalGhs !== undefined && proofs.payablesScheduleTotalGhs !== null) {
    const ledgerPayablesCredit = -(accountNetDebitGhs.get('2010') ?? 0n);
    const diff = ledgerPayablesCredit - proofs.payablesScheduleTotalGhs;
    const agrees = diff === 0n;
    subledgerAgreements.push({
      category: 'PAYABLES',
      label: 'Accounts payable schedule (unpaid bills at cut-over)',
      ledgerAmountGhs: ledgerPayablesCredit,
      subledgerScheduleAmountGhs: proofs.payablesScheduleTotalGhs,
      differenceGhs: diff,
      agrees,
    });
    if (!agrees) {
      diagnostics.push({
        rowNumber: 0,
        severity: 'ERROR',
        accountCode: '2010',
        fundCode: '—',
        message: 'Accounts Payable (2010) opening balance does not match the unpaid bills schedule.',
      });
    }
  }

  const overallDifferenceGhs = totalDebitGhs - totalCreditGhs;
  const isOverallBalanced = overallDifferenceGhs === 0n && totalDebitGhs > 0n;
  const allFundsBalanced =
    fundSummaries.length > 0 && fundSummaries.every((f) => f.isBalanced);
  const allStatementsAgree = statementComparisons.every((s) => s.agrees);
  const allSubledgersAgree = subledgerAgreements.every((s) => s.agrees);
  const hasBlockingRowError = diagnostics.some((d) => d.severity === 'ERROR');

  return {
    isValid:
      isOverallBalanced &&
      allFundsBalanced &&
      allStatementsAgree &&
      allSubledgersAgree &&
      !hasBlockingRowError,
    cutOverDate,
    rowCount: rows.length,
    totalDebitGhs,
    totalCreditGhs,
    overallDifferenceGhs,
    isOverallBalanced,
    allFundsBalanced,
    allStatementsAgree,
    allSubledgersAgree,
    fundSummaries,
    statementComparisons,
    subledgerAgreements,
    rowDiagnostics: diagnostics,
  };
}

/**
 * Performs a full Dry Run for Opening Balances (Spec B2 & B3):
 * Produces ONE balanced opening entry per fund dated on the cut-over date, tagged "Opening balance",
 * and computes the resulting Trial Balance.
 */
export function runOpeningBalanceDryRun(params: {
  readonly rows: readonly OpeningBalanceRowInput[];
  readonly cutOverDate: string;
  readonly branchId: string;
  readonly financialYearId?: string | null;
  readonly period?: AccountingPeriod | null;
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly createdBy: string;
  readonly deviceId: string;
  readonly proofs?: CutOverSubledgerProofs;
  readonly existingEntries?: readonly JournalEntry[];
}): OpeningBalanceDryRunResult {
  const validation = validateOpeningBalances({
    rows: params.rows,
    cutOverDate: params.cutOverDate,
    accounts: params.accounts,
    funds: params.funds,
    proofs: params.proofs,
  });

  const accountByCode = new Map(params.accounts.map((a) => [a.code.toUpperCase(), a]));
  const fundByCode = new Map(params.funds.map((f) => [f.code.toUpperCase(), f]));
  const fundById = new Map(params.funds.map((f) => [f.id, f]));

  // Group valid rows by fund to create ONE balanced opening entry per fund (Spec B2)
  const rowsByFund = new Map<string, { fund: Fund; lines: CreateLineInput[] }>();

  for (const row of params.rows) {
    const acct = accountByCode.get(row.accountCode.toUpperCase());
    const fund =
      fundByCode.get(row.fundCode.toUpperCase()) ?? fundById.get(row.fundCode);
    if (!acct || !fund) continue;

    const isDebit = row.debitOriginalMinor > 0n;
    const originalAmount = isDebit ? row.debitOriginalMinor : row.creditOriginalMinor;
    if (originalAmount <= 0n) continue;

    const group = rowsByFund.get(fund.id) ?? { fund, lines: [] };
    group.lines.push({
      id: `ob-line-${fund.code.toLowerCase()}-${row.rowNumber}`,
      accountId: acct.id,
      fundId: fund.id,
      originalCurrency: row.currency,
      originalAmount,
      exchangeRate: row.currency === 'USD' ? row.exchangeRate : '1.0000',
      isDebit,
      description: row.description ?? `Opening balance (${fund.name})`,
    });
    rowsByFund.set(fund.id, group);
  }

  const proposedEntriesByFund: JournalEntry[] = [];
  let fundSeq = 1;
  for (const [, group] of rowsByFund.entries()) {
    const docNum = `OB-${String(fundSeq).padStart(4, '0')}`;
    const entry = createJournalEntry({
      id: `je-ob-${group.fund.code.toLowerCase()}-${params.cutOverDate}`,
      branchId: params.branchId,
      financialYearId: params.financialYearId ?? null,
      documentNumber: docNum,
      entryDate: params.cutOverDate,
      entryType: 'OPENING_BALANCE',
      narration: `Opening balance — ${group.fund.name} as at ${params.cutOverDate}`,
      createdBy: params.createdBy,
      deviceId: params.deviceId,
      period: params.period ?? null,
      lines: group.lines,
    });
    proposedEntriesByFund.push(entry);
    fundSeq++;
  }

  const combinedEntries = [...proposedEntriesByFund, ...(params.existingEntries ?? [])];
  const resultingTrialBalance = calculateTrialBalance(
    combinedEntries,
    params.accounts,
    params.funds,
    params.cutOverDate
  );

  return {
    validation,
    proposedEntriesByFund,
    resultingTrialBalance,
  };
}

/**
 * Commits the validated Opening Balance batch after Treasurer sign-off and Pastor/Elder approval (Spec B1 & B2).
 */
export function commitOpeningBalances(params: OpeningBalanceCommitParams): readonly JournalEntry[] {
  if (!params.dryRun.validation.isValid) {
    throw new Error('Cannot commit opening balances while validation errors or fund/statement differences exist.');
  }
  if (!params.treasurerSignedBy.trim()) {
    throw new Error('Treasurer sign-off is required before posting opening balances.');
  }
  if (!params.pastorOrElderApprovedBy.trim()) {
    throw new Error('Pastor or Elder approval is required before posting opening balances.');
  }
  if (
    params.treasurerSignedBy.trim().toLowerCase() ===
    params.pastorOrElderApprovedBy.trim().toLowerCase()
  ) {
    throw new Error('Separation of duties: The Treasurer and the approving Pastor/Elder must be two different people.');
  }
  if (params.isPostGoLive && (!params.postGoLiveReason || params.postGoLiveReason.trim().length < 5)) {
    throw new Error('Because the system is already live, a written reason is required to post or adjust opening balances.');
  }

  return params.dryRun.proposedEntriesByFund;
}
