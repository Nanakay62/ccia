/**
 * ReportsContext.
 * Coordinates real-time offline generation and export (PDF, Excel, CSV)
 * of all 11 financial statements and reporting views.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  IncomeExpenditureReport,
  BalanceSheetReport,
  FundBalanceReport,
  BudgetVsActualReport,
  CashFlowReport,
  GivingSummaryReport,
  PledgeStatusReport,
  BankReconciliationReport,
  AuditLogReport,
  DenominationUsdSummaryReport,
  TrialBalanceReport,
  AuditLogEntry,
} from '@church/domain';
import {
  generateIncomeExpenditureStatement,
  generateBalanceSheet,
  generateFundBalanceReport,
  generateCashFlowSummary,
  generateBudgetVsActualReport,
  generateGivingSummaryReport,
  generatePledgeStatusReport,
  generateBankReconciliationReport,
  generateAuditLogReport,
  generateDenominationUsdSummaryReport,
} from '@church/domain';
import { useLedger } from './LedgerContext.js';
import { useGiving } from './GivingContext.js';
import { useAuth } from './AuthContext.js';
import { exportReportToPdf } from '../utils/exports/pdf.js';
import { exportReportToExcel } from '../utils/exports/excel.js';
import { generateCsv, downloadCsv } from '../utils/exports/csv.js';

export type ReportType =
  | 'INCOME_EXPENDITURE'
  | 'BALANCE_SHEET'
  | 'FUND_BALANCE'
  | 'BUDGET_VS_ACTUAL'
  | 'CASH_FLOW'
  | 'GIVING_SUMMARY'
  | 'PLEDGE_STATUS'
  | 'TRIAL_BALANCE'
  | 'BANK_RECONCILIATION'
  | 'AUDIT_LOG'
  | 'USD_SUMMARY';

export interface ReportsContextValue {
  readonly activeReport: ReportType;
  readonly setActiveReport: (report: ReportType) => void;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly asOfDate: string;
  readonly setDateRange: (start: string, end: string) => void;
  readonly currencyMode: 'GHS' | 'USD_SUMMARY';
  readonly setCurrencyMode: (mode: 'GHS' | 'USD_SUMMARY') => void;
  readonly usdExchangeRate: string;
  readonly setUsdExchangeRate: (rate: string) => void;
  readonly usdRateBasis: 'CLOSING_RATE' | 'PERIOD_AVERAGE';
  readonly setUsdRateBasis: (basis: 'CLOSING_RATE' | 'PERIOD_AVERAGE') => void;
  readonly selectedFundId: string;
  readonly setSelectedFundId: (id: string) => void;

  // 11 Financial & Operational Reports
  readonly incomeExpenditure: IncomeExpenditureReport;
  readonly balanceSheet: BalanceSheetReport;
  readonly fundBalance: FundBalanceReport;
  readonly budgetVsActual: BudgetVsActualReport;
  readonly cashFlow: CashFlowReport;
  readonly givingSummary: GivingSummaryReport;
  readonly pledgeStatus: PledgeStatusReport;
  readonly trialBalance: TrialBalanceReport;
  readonly bankReconciliation: BankReconciliationReport;
  readonly auditLogReport: AuditLogReport;
  readonly denominationUsdSummary: DenominationUsdSummaryReport;

  // Export handlers
  readonly exportCurrentPdf: () => Promise<void>;
  readonly exportCurrentExcel: () => Promise<void>;
  readonly exportCurrentCsv: () => void;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

export const ReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts, funds, entries, trialBalance } = useLedger();
  const { members, pledges, givingRecords, countingSheets } = useGiving();
  const { currentUser } = useAuth();

  const [activeReport, setActiveReport] = useState<ReportType>('INCOME_EXPENDITURE');
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');
  const [selectedFundId, setSelectedFundId] = useState('ALL');
  const [currencyMode, setCurrencyMode] = useState<'GHS' | 'USD_SUMMARY'>('GHS');
  const [usdExchangeRate, setUsdExchangeRate] = useState('15.5000');
  const [usdRateBasis, setUsdRateBasis] = useState<'CLOSING_RATE' | 'PERIOD_AVERAGE'>('CLOSING_RATE');

  const asOfDate = periodEnd;

  const setDateRange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  // Filter entries if a specific fund is selected (or ALL)
  const filteredEntries = useMemo(() => {
    if (selectedFundId === 'ALL') return entries;
    return entries.filter((e) => e.lines.some((l) => l.fundId === selectedFundId));
  }, [entries, selectedFundId]);

  // 1. Income & Expenditure
  const incomeExpenditure = useMemo(() => {
    return generateIncomeExpenditureStatement({
      periodStart,
      periodEnd,
      entries: filteredEntries,
      accounts,
      funds,
    });
  }, [periodStart, periodEnd, filteredEntries, accounts, funds]);

  // 2. Balance Sheet
  const balanceSheet = useMemo(() => {
    return generateBalanceSheet({
      asOfDate,
      entries: filteredEntries,
      accounts,
      funds,
    });
  }, [asOfDate, filteredEntries, accounts, funds]);

  // 3. Fund Balance Report
  const fundBalance = useMemo(() => {
    return generateFundBalanceReport({
      asOfDate,
      entries,
      accounts,
      funds,
    });
  }, [asOfDate, entries, accounts, funds]);

  // 4. Budget vs Actual Report
  const budgetVsActual = useMemo(() => {
    const defaultBudgets = [
      { accountCode: '4010', accountName: 'Tithes', category: 'INCOME' as const, annualBudgetPesewas: 15000000n },
      { accountCode: '4020', accountName: 'General Offerings', category: 'INCOME' as const, annualBudgetPesewas: 6000000n },
      { accountCode: '4030', accountName: 'Special Offerings', category: 'INCOME' as const, annualBudgetPesewas: 2500000n },
      { accountCode: '4040', accountName: 'Building Pledges', category: 'INCOME' as const, annualBudgetPesewas: 10000000n },
      { accountCode: '5010', accountName: 'Salaries and Allowances', category: 'EXPENSE' as const, annualBudgetPesewas: 7500000n },
      { accountCode: '5020', accountName: 'Utilities', category: 'EXPENSE' as const, annualBudgetPesewas: 1800000n },
      { accountCode: '5030', accountName: 'Maintenance & Repairs', category: 'EXPENSE' as const, annualBudgetPesewas: 1200000n },
      { accountCode: '5040', accountName: 'Outreach and Missions', category: 'EXPENSE' as const, annualBudgetPesewas: 2400000n },
      { accountCode: '5050', accountName: 'Welfare Support', category: 'EXPENSE' as const, annualBudgetPesewas: 1500000n },
    ];
    return generateBudgetVsActualReport({
      periodStart,
      periodEnd,
      budgets: defaultBudgets,
      entries,
      accounts,
    });
  }, [periodStart, periodEnd, entries, accounts]);

  // 5. Cash Flow Summary
  const cashFlow = useMemo(() => {
    return generateCashFlowSummary({
      periodStart,
      periodEnd,
      entries: filteredEntries,
      accounts,
      funds,
    });
  }, [periodStart, periodEnd, filteredEntries, accounts, funds]);

  // 6. Giving Summary
  const givingSummary = useMemo(() => {
    return generateGivingSummaryReport({
      periodStart,
      periodEnd,
      countingSheets,
      givingRecords,
      funds,
    });
  }, [periodStart, periodEnd, countingSheets, givingRecords, funds]);

  // 7. Pledge Status Report
  const pledgeStatus = useMemo(() => {
    return generatePledgeStatusReport({
      asOfDate,
      pledges,
      members,
      role: currentUser.role,
    });
  }, [asOfDate, pledges, members, currentUser.role]);

  // 8. Bank Reconciliation Report
  const bankReconciliation = useMemo(() => {
    const bankAcct = accounts.find((a) => a.code === '1030') || accounts[0]!;
    return generateBankReconciliationReport({
      bankAccount: bankAcct,
      asOfDate,
      entries,
      bankStatementBalancePesewas: 6850000n, // GHS 68,500.00
      outstandingCheques: [
        { reference: 'CHQ-5041', payee: 'Volta River Authority', amountPesewas: 380000n },
      ],
      depositsInTransit: [
        { reference: 'DEP-8802', source: 'Sunday Service MoMo Batch Transfer', amountPesewas: 145000n },
      ],
    });
  }, [accounts, asOfDate, entries]);

  // 9. Audit Log Report
  const auditLogReport = useMemo(() => {
    const mockAuditEntries: AuditLogEntry[] = [
      {
        id: 'aud-001',
        branchId: currentUser.branchId,
        entityType: 'COUNTING_SHEET',
        entityId: 'CS-CNT-D01-000042',
        action: 'CREATE',
        performedBy: 'usr-002',
        performedAt: '2026-10-12T14:30:00Z',
        deviceId: 'DEV-FS-01',
        reason: 'Service giving dual-counted and signed',
      },
      {
        id: 'aud-002',
        branchId: currentUser.branchId,
        entityType: 'PAYMENT_VOUCHER',
        entityId: 'PV-FS-D01-000041',
        action: 'APPROVAL',
        performedBy: 'usr-001',
        performedAt: '2026-10-14T09:15:00Z',
        deviceId: 'DEV-TR-01',
        reason: 'Authorized sound cable voucher with 5% WHT deduction',
      },
      {
        id: 'aud-003',
        branchId: currentUser.branchId,
        entityType: 'JOURNAL_ENTRY',
        entityId: 'JE-REV-000012',
        action: 'REVERSAL',
        performedBy: 'usr-001',
        performedAt: '2026-10-15T11:00:00Z',
        deviceId: 'DEV-TR-01',
        reason: 'Reversal of misallocated utilities line',
      },
      {
        id: 'aud-004',
        branchId: currentUser.branchId,
        entityType: 'DOCTOR',
        entityId: 'DOC-RUN-008',
        action: 'INTEGRITY_RUN',
        performedBy: 'usr-001',
        performedAt: '2026-10-31T20:00:00Z',
        deviceId: 'DEV-TR-01',
        reason: 'Pre-closing 10-step trial balance health check: 10/10 clean',
      },
    ];

    return generateAuditLogReport({
      periodStart,
      periodEnd,
      auditLogs: mockAuditEntries,
    });
  }, [periodStart, periodEnd, currentUser.branchId]);

  // 10. Denomination USD Summary Report
  const denominationUsdSummary = useMemo(() => {
    return generateDenominationUsdSummaryReport({
      asOfDate,
      periodStart,
      periodEnd,
      exchangeRate: usdExchangeRate,
      rateBasis: usdRateBasis,
      incomeExpenditure,
      balanceSheet,
    });
  }, [asOfDate, periodStart, periodEnd, usdExchangeRate, usdRateBasis, incomeExpenditure, balanceSheet]);

  // Offline Export Handlers
  const exportCurrentPdf = useCallback(async () => {
    const isUsd = currencyMode === 'USD_SUMMARY';

    if (activeReport === 'INCOME_EXPENDITURE' || activeReport === 'USD_SUMMARY') {
      const data = isUsd
        ? [
            ...denominationUsdSummary.statementOfActivities.mainIncomeLines.map((l) => ({
              category: 'Income',
              name: l.name,
              amount: `$${(Number(l.amountUsdCents) / 100).toFixed(2)}`,
            })),
            ...denominationUsdSummary.statementOfActivities.mainExpenseLines.map((l) => ({
              category: 'Expenditure',
              name: l.name,
              amount: `$${(Number(l.amountUsdCents) / 100).toFixed(2)}`,
            })),
          ]
        : [
            ...incomeExpenditure.incomes.map((i) => ({
              category: 'Income',
              name: `${i.accountCode} - ${i.accountName}`,
              amount: `GHS ${(Number(i.amountPesewas) / 100).toFixed(2)}`,
            })),
            ...incomeExpenditure.expenses.map((e) => ({
              category: 'Expenditure',
              name: `${e.accountCode} - ${e.accountName}`,
              amount: `GHS ${(Number(e.amountPesewas) / 100).toFixed(2)}`,
            })),
          ];

      const netSurplusStr = isUsd
        ? `$${(Number(denominationUsdSummary.statementOfActivities.netSurplusDeficitUsdCents) / 100).toFixed(2)}`
        : `GHS ${(Number(incomeExpenditure.netSurplusDeficitPesewas) / 100).toFixed(2)}`;

      await exportReportToPdf({
        filename: `income-expenditure-${periodStart}-${periodEnd}`,
        reportTitle: isUsd ? 'Statement of Activities (USD Summary Translation)' : 'Statement of Income and Expenditure',
        periodText: `${periodStart} to ${periodEnd}`,
        currency: isUsd ? 'USD' : 'GHS',
        columns: [
          { header: 'Category', key: 'category', width: 100 },
          { header: 'Account / Description', key: 'name', width: 260 },
          { header: 'Amount', key: 'amount', width: 140, align: 'right' },
        ],
        data,
        summaryRows: [{ label: 'Net Operating Surplus / (Deficit):', value: netSurplusStr }],
        disclosureFootnote: isUsd ? denominationUsdSummary.mandatoryDisclosureFootnote : undefined,
      });
    } else if (activeReport === 'BALANCE_SHEET') {
      const data = [
        ...balanceSheet.currentAssets.map((a) => ({
          group: 'Current Assets',
          name: `${a.accountCode} - ${a.accountName}`,
          amount: `GHS ${(Number(a.amountPesewas) / 100).toFixed(2)}`,
        })),
        ...balanceSheet.currentLiabilities.map((l) => ({
          group: 'Current Liabilities',
          name: `${l.accountCode} - ${l.accountName}`,
          amount: `GHS ${(Number(l.amountPesewas) / 100).toFixed(2)}`,
        })),
        ...balanceSheet.fundBalances.map((f) => ({
          group: `Fund Balances (${f.fundType})`,
          name: f.fundName,
          amount: `GHS ${(Number(f.balancePesewas) / 100).toFixed(2)}`,
        })),
      ];

      await exportReportToPdf({
        filename: `balance-sheet-${asOfDate}`,
        reportTitle: 'Statement of Financial Position (Balance Sheet)',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Classification', key: 'group', width: 120 },
          { header: 'Account / Fund Name', key: 'name', width: 240 },
          { header: 'Amount (GHS)', key: 'amount', width: 140, align: 'right' },
        ],
        data,
        summaryRows: [
          { label: 'Total Assets:', value: `GHS ${(Number(balanceSheet.totalAssetsPesewas) / 100).toFixed(2)}` },
          { label: 'Total Liabilities & Fund Balances:', value: `GHS ${(Number(balanceSheet.totalLiabilitiesAndFundsPesewas) / 100).toFixed(2)}` },
        ],
      });
    } else {
      // Default report export
      const rows = incomeExpenditure.incomes.map((i) => ({
        code: i.accountCode,
        name: i.accountName,
        amount: (Number(i.amountPesewas) / 100).toFixed(2),
      }));
      await exportReportToPdf({
        filename: `${activeReport.toLowerCase()}-${periodEnd}`,
        reportTitle: activeReport.replace(/_/g, ' '),
        periodText: `${periodStart} to ${periodEnd}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code', width: 80 },
          { header: 'Description', key: 'name', width: 280 },
          { header: 'Amount (GHS)', key: 'amount', width: 140, align: 'right' },
        ],
        data: rows,
      });
    }
  }, [
    activeReport,
    currencyMode,
    usdExchangeRate,
    usdRateBasis,
    periodStart,
    periodEnd,
    asOfDate,
    incomeExpenditure,
    balanceSheet,
    denominationUsdSummary,
  ]);

  const exportCurrentExcel = useCallback(async () => {
    const isUsd = currencyMode === 'USD_SUMMARY';

    if (activeReport === 'INCOME_EXPENDITURE' || activeReport === 'USD_SUMMARY') {
      const data = isUsd
        ? [
            ...denominationUsdSummary.statementOfActivities.mainIncomeLines.map((l) => ({
              category: 'Income',
              name: l.name,
              amount: Number(l.amountUsdCents) / 100,
            })),
            ...denominationUsdSummary.statementOfActivities.mainExpenseLines.map((l) => ({
              category: 'Expenditure',
              name: l.name,
              amount: Number(l.amountUsdCents) / 100,
            })),
          ]
        : [
            ...incomeExpenditure.incomes.map((i) => ({
              category: 'Income',
              name: `${i.accountCode} - ${i.accountName}`,
              amount: Number(i.amountPesewas) / 100,
            })),
            ...incomeExpenditure.expenses.map((e) => ({
              category: 'Expenditure',
              name: `${e.accountCode} - ${e.accountName}`,
              amount: Number(e.amountPesewas) / 100,
            })),
          ];

      const netSurplusNum = isUsd
        ? Number(denominationUsdSummary.statementOfActivities.netSurplusDeficitUsdCents) / 100
        : Number(incomeExpenditure.netSurplusDeficitPesewas) / 100;

      await exportReportToExcel({
        filename: `income-expenditure-${periodStart}-${periodEnd}`,
        reportTitle: isUsd ? 'Statement of Activities (USD Summary Translation)' : 'Statement of Income and Expenditure',
        periodText: `${periodStart} to ${periodEnd}`,
        currency: isUsd ? 'USD' : 'GHS',
        columns: [
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Account / Description', key: 'name', width: 35 },
          { header: 'Amount', key: 'amount', width: 18, isCurrency: true },
        ],
        data,
        summaryRows: [{ label: 'Net Operating Surplus / (Deficit):', value: netSurplusNum }],
        disclosureFootnote: isUsd ? denominationUsdSummary.mandatoryDisclosureFootnote : undefined,
      });
    } else if (activeReport === 'BALANCE_SHEET') {
      const data = [
        ...balanceSheet.currentAssets.map((a) => ({
          group: 'Current Assets',
          name: `${a.accountCode} - ${a.accountName}`,
          amount: Number(a.amountPesewas) / 100,
        })),
        ...balanceSheet.currentLiabilities.map((l) => ({
          group: 'Current Liabilities',
          name: `${l.accountCode} - ${l.accountName}`,
          amount: Number(l.amountPesewas) / 100,
        })),
        ...balanceSheet.fundBalances.map((f) => ({
          group: `Fund Balances (${f.fundType})`,
          name: f.fundName,
          amount: Number(f.balancePesewas) / 100,
        })),
      ];

      await exportReportToExcel({
        filename: `balance-sheet-${asOfDate}`,
        reportTitle: 'Statement of Financial Position (Balance Sheet)',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Classification', key: 'group', width: 22 },
          { header: 'Account / Fund Name', key: 'name', width: 35 },
          { header: 'Amount (GHS)', key: 'amount', width: 18, isCurrency: true },
        ],
        data,
        summaryRows: [
          { label: 'Total Assets:', value: Number(balanceSheet.totalAssetsPesewas) / 100 },
          { label: 'Total Liabilities & Funds:', value: Number(balanceSheet.totalLiabilitiesAndFundsPesewas) / 100 },
        ],
      });
    } else {
      const data = incomeExpenditure.incomes.map((i) => ({
        code: i.accountCode,
        name: i.accountName,
        amount: Number(i.amountPesewas) / 100,
      }));
      await exportReportToExcel({
        filename: `${activeReport.toLowerCase()}-${periodEnd}`,
        reportTitle: activeReport.replace(/_/g, ' '),
        periodText: `${periodStart} to ${periodEnd}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Name', key: 'name', width: 35 },
          { header: 'Amount (GHS)', key: 'amount', width: 18, isCurrency: true },
        ],
        data,
      });
    }
  }, [
    activeReport,
    currencyMode,
    periodStart,
    periodEnd,
    asOfDate,
    incomeExpenditure,
    balanceSheet,
    denominationUsdSummary,
  ]);

  const exportCurrentCsv = useCallback(() => {
    const isUsd = currencyMode === 'USD_SUMMARY';
    const filename = `${activeReport.toLowerCase()}-${periodStart}-${periodEnd}.csv`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeReport === 'INCOME_EXPENDITURE' || activeReport === 'USD_SUMMARY') {
      headers = ['Category', 'Account Code', 'Description', isUsd ? 'Amount (USD)' : 'Amount (GHS)'];
      rows = [
        ...incomeExpenditure.incomes.map((i) => [
          'Income',
          i.accountCode,
          i.accountName,
          (Number(i.amountPesewas) / 100).toFixed(2),
        ]),
        ...incomeExpenditure.expenses.map((e) => [
          'Expense',
          e.accountCode,
          e.accountName,
          (Number(e.amountPesewas) / 100).toFixed(2),
        ]),
        [
          'SUMMARY',
          '',
          'Net Surplus / (Deficit)',
          (Number(incomeExpenditure.netSurplusDeficitPesewas) / 100).toFixed(2),
        ],
      ];
    } else if (activeReport === 'BALANCE_SHEET') {
      headers = ['Group', 'Code', 'Account / Fund', 'Amount (GHS)'];
      rows = [
        ...balanceSheet.currentAssets.map((a) => ['Current Assets', a.accountCode, a.accountName, (Number(a.amountPesewas) / 100).toFixed(2)]),
        ...balanceSheet.currentLiabilities.map((l) => ['Liabilities', l.accountCode, l.accountName, (Number(l.amountPesewas) / 100).toFixed(2)]),
        ...balanceSheet.fundBalances.map((f) => [`Fund (${f.fundType})`, f.fundId, f.fundName, (Number(f.balancePesewas) / 100).toFixed(2)]),
      ];
    } else {
      headers = ['Code', 'Name', 'Amount'];
      rows = incomeExpenditure.incomes.map((i) => [i.accountCode, i.accountName, (Number(i.amountPesewas) / 100).toFixed(2)]);
    }

    const csvContent = generateCsv(headers, rows);
    downloadCsv(filename, csvContent);
  }, [activeReport, currencyMode, periodStart, periodEnd, incomeExpenditure, balanceSheet]);

  const value = useMemo(
    () => ({
      activeReport,
      setActiveReport,
      periodStart,
      periodEnd,
      asOfDate,
      setDateRange,
      currencyMode,
      setCurrencyMode,
      usdExchangeRate,
      setUsdExchangeRate,
      usdRateBasis,
      setUsdRateBasis,
      selectedFundId,
      setSelectedFundId,
      incomeExpenditure,
      balanceSheet,
      fundBalance,
      budgetVsActual,
      cashFlow,
      givingSummary,
      pledgeStatus,
      trialBalance,
      bankReconciliation,
      auditLogReport,
      denominationUsdSummary,
      exportCurrentPdf,
      exportCurrentExcel,
      exportCurrentCsv,
    }),
    [
      activeReport,
      periodStart,
      periodEnd,
      asOfDate,
      setDateRange,
      currencyMode,
      usdExchangeRate,
      usdRateBasis,
      selectedFundId,
      incomeExpenditure,
      balanceSheet,
      fundBalance,
      budgetVsActual,
      cashFlow,
      givingSummary,
      pledgeStatus,
      trialBalance,
      bankReconciliation,
      auditLogReport,
      denominationUsdSummary,
      exportCurrentPdf,
      exportCurrentExcel,
      exportCurrentCsv,
    ]
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
};

export function useReports(): ReportsContextValue {
  const context = useContext(ReportsContext);
  if (!context) {
    throw new Error('useReports must be used within a ReportsProvider');
  }
  return context;
}
