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
import { useSync } from './SyncContext.js';
import { exportReportToPdf } from '../utils/exports/pdf.js';
import { exportReportToExcel } from '../utils/exports/excel.js';
import { exportReportToWord } from '../utils/exports/word.js';
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
  | 'SOD_EXCEPTIONS'
  | 'USD_SUMMARY'
  | 'ISSUED_REPORTS';

export interface ReportSignoff {
  name: string;
  role: string;
  date: string;
  timestamp: string;
}

export interface IssuedReportSnapshot {
  id: string;
  reportType: ReportType;
  title: string;
  periodText: string;
  documentNumber: string;
  currency: 'GHS' | 'USD';
  preparedBy: ReportSignoff;
  certifiedBy: ReportSignoff;
  approvedBy: ReportSignoff;
  issuedAt: string;
  totalIncomeGhs?: string;
  totalExpenseGhs?: string;
  netSurplusGhs?: string;
}

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

  // Report status and sign-off workflow (Section 4.3)
  readonly reportStatus: 'DRAFT' | 'CERTIFIED' | 'APPROVED';
  readonly preparedBy: ReportSignoff;
  readonly certifiedBy: ReportSignoff | null;
  readonly approvedBy: ReportSignoff | null;
  readonly issuedReports: readonly IssuedReportSnapshot[];
  readonly certifyReport: () => void;
  readonly approveReport: () => void;
  readonly logReportAudit: (action: string, details?: string) => void;

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
  readonly exportCurrentWord: () => void;
  readonly exportCurrentCsv: () => void;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

export const ReportsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts, funds, entries, trialBalance } = useLedger();
  const { members, pledges, givingRecords, countingSheets } = useGiving();
  const { currentUser } = useAuth();
  const { enqueueItem } = useSync();

  const [activeReport, setActiveReport] = useState<ReportType>('INCOME_EXPENDITURE');
  const [periodStart, setPeriodStart] = useState('2026-10-01');
  const [periodEnd, setPeriodEnd] = useState('2026-10-31');
  const [selectedFundId, setSelectedFundId] = useState('ALL');
  const [currencyMode, setCurrencyMode] = useState<'GHS' | 'USD_SUMMARY'>('GHS');
  const [usdExchangeRate, setUsdExchangeRate] = useState('15.5000');
  const [usdRateBasis, setUsdRateBasis] = useState<'CLOSING_RATE' | 'PERIOD_AVERAGE'>('CLOSING_RATE');

  // Status & sign-off workflow (Section 4.3)
  const [reportStatus, setReportStatus] = useState<'DRAFT' | 'CERTIFIED' | 'APPROVED'>('DRAFT');
  const [preparedBy] = useState<ReportSignoff>({
    name: 'Akosua Osei',
    role: 'Finance Secretary',
    date: '02 Nov 2026',
    timestamp: '2026-11-02T10:00:00Z',
  });
  const [certifiedBy, setCertifiedBy] = useState<ReportSignoff | null>(null);
  const [approvedBy, setApprovedBy] = useState<ReportSignoff | null>(null);

  const [issuedReports, setIssuedReports] = useState<IssuedReportSnapshot[]>([
    {
      id: 'iss-rep-2026-q3',
      reportType: 'INCOME_EXPENDITURE',
      title: 'Statement of Income and Expenditure',
      periodText: '01 Jul 2026 to 30 Sep 2026',
      documentNumber: 'REP-INC-20260930',
      currency: 'GHS',
      preparedBy: {
        name: 'Akosua Osei',
        role: 'Finance Secretary',
        date: '05 Oct 2026',
        timestamp: '2026-10-05T09:00:00Z',
      },
      certifiedBy: {
        name: 'Kofi Mensah',
        role: 'Treasurer',
        date: '06 Oct 2026',
        timestamp: '2026-10-06T14:00:00Z',
      },
      approvedBy: {
        name: 'Rev. Emmanuel Addo',
        role: 'Senior Pastor / Elder',
        date: '08 Oct 2026',
        timestamp: '2026-10-08T16:30:00Z',
      },
      issuedAt: '08 Oct 2026',
      totalIncomeGhs: '42,300.00',
      totalExpenseGhs: '18,450.00',
      netSurplusGhs: '23,850.00',
    },
  ]);

  const asOfDate = periodEnd;

  const setDateRange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
    // Reset status to draft on new period
    setReportStatus('DRAFT');
    setCertifiedBy(null);
    setApprovedBy(null);
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

  // Audit logging helper
  const logReportAudit = useCallback(
    (action: string, details?: string) => {
      enqueueItem({
        entityType: 'FINANCIAL_REPORT',
        entityId: activeReport,
        action: 'POST_JOURNAL_ENTRY',
        deviceId: 'dev-01',
        payload: {
          action,
          performedBy: currentUser.id,
          details: details || `Report action: ${action}`,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [activeReport, currentUser.id, enqueueItem]
  );

  // Signing workflow handlers (Section 4.3)
  const certifyReport = useCallback(() => {
    const signoff: ReportSignoff = {
      name: 'Kofi Mensah',
      role: 'Treasurer',
      date: '02 Nov 2026',
      timestamp: new Date().toISOString(),
    };
    setCertifiedBy(signoff);
    setReportStatus('CERTIFIED');
    logReportAudit('REPORT_CERTIFIED', `${activeReport} statement certified by Kofi Mensah (Treasurer)`);
  }, [activeReport, logReportAudit]);

  const approveReport = useCallback(() => {
    const signoff: ReportSignoff = {
      name: 'Rev. Emmanuel Addo',
      role: 'Senior Pastor / Elder',
      date: '02 Nov 2026',
      timestamp: new Date().toISOString(),
    };
    setApprovedBy(signoff);
    setReportStatus('APPROVED');
    logReportAudit('REPORT_APPROVED', `${activeReport} statement approved by Rev. Emmanuel Addo (Senior Pastor / Elder)`);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatD = (str: string) => {
      const parts = str.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return `${String(parts[2]).padStart(2, '0')} ${months[parts[1] - 1]} ${parts[0]}`;
      }
      return str;
    };

    const newSnapshot: IssuedReportSnapshot = {
      id: `iss-rep-${Date.now()}`,
      reportType: activeReport,
      title: activeReport === 'INCOME_EXPENDITURE' ? 'Statement of Income and Expenditure' : activeReport.replace(/_/g, ' '),
      periodText: `${formatD(periodStart)} to ${formatD(periodEnd)}`,
      documentNumber: `REP-${activeReport.slice(0, 3)}-${periodEnd.replace(/-/g, '')}`,
      currency: currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS',
      preparedBy,
      certifiedBy: certifiedBy || {
        name: 'Kofi Mensah',
        role: 'Treasurer',
        date: '02 Nov 2026',
        timestamp: new Date().toISOString(),
      },
      approvedBy: signoff,
      issuedAt: '02 Nov 2026',
      totalIncomeGhs: (Number(incomeExpenditure.totalIncomePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalExpenseGhs: (Number(incomeExpenditure.totalExpensePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      netSurplusGhs: (Number(incomeExpenditure.netSurplusDeficitPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
    setIssuedReports((prev) => [newSnapshot, ...prev]);
  }, [activeReport, periodStart, periodEnd, currencyMode, preparedBy, certifiedBy, incomeExpenditure, logReportAudit]);

  // Offline Export Handlers
  const exportCurrentPdf = useCallback(async () => {
    logReportAudit('EXPORT_PDF', `Exported ${activeReport} statement to PDF`);
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
    } else if (activeReport === 'TRIAL_BALANCE') {
      const data = trialBalance.accounts.map((a) => ({
        code: a.accountCode,
        name: a.accountName,
        type: a.accountType,
        debit: a.debitGhs > 0n ? (Number(a.debitGhs) / 100).toFixed(2) : '-',
        credit: a.creditGhs > 0n ? (Number(a.creditGhs) / 100).toFixed(2) : '-',
      }));
      await exportReportToPdf({
        filename: `trial-balance-${asOfDate}`,
        reportTitle: 'Trial Balance of Accounts',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code', width: 65 },
          { header: 'Account Name', key: 'name', width: 225 },
          { header: 'Type', key: 'type', width: 80 },
          { header: 'Debit (GHS)', key: 'debit', width: 75, align: 'right' },
          { header: 'Credit (GHS)', key: 'credit', width: 75, align: 'right' },
        ],
        data,
        summaryRows: [
          { label: 'Total Debits:', value: `GHS ${(Number(trialBalance.totalDebitsGhs) / 100).toFixed(2)}` },
          { label: 'Total Credits:', value: `GHS ${(Number(trialBalance.totalCreditsGhs) / 100).toFixed(2)}` },
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
    logReportAudit('EXPORT_EXCEL', `Exported ${activeReport} statement to Excel`);
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
    } else if (activeReport === 'TRIAL_BALANCE') {
      const data = trialBalance.accounts.map((a) => ({
        code: a.accountCode,
        name: a.accountName,
        type: a.accountType,
        debit: Number(a.debitGhs) / 100,
        credit: Number(a.creditGhs) / 100,
      }));
      await exportReportToExcel({
        filename: `trial-balance-${asOfDate}`,
        reportTitle: 'Trial Balance of Accounts',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Account Name', key: 'name', width: 35 },
          { header: 'Type', key: 'type', width: 18 },
          { header: 'Debit (GHS)', key: 'debit', width: 18, isCurrency: true },
          { header: 'Credit (GHS)', key: 'credit', width: 18, isCurrency: true },
        ],
        data,
        summaryRows: [
          { label: 'Total Debits:', value: Number(trialBalance.totalDebitsGhs) / 100 },
          { label: 'Total Credits:', value: Number(trialBalance.totalCreditsGhs) / 100 },
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
    logReportAudit('EXPORT_CSV', `Exported ${activeReport} statement to CSV`);
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
    } else if (activeReport === 'TRIAL_BALANCE') {
      headers = ['Code', 'Account Name', 'Type', 'Debit (GHS)', 'Credit (GHS)'];
      rows = [
        ...trialBalance.accounts.map((a) => [
          a.accountCode,
          a.accountName,
          a.accountType,
          (Number(a.debitGhs) / 100).toFixed(2),
          (Number(a.creditGhs) / 100).toFixed(2),
        ]),
        [
          'TOTAL',
          'Total Debits & Credits',
          'Balanced',
          (Number(trialBalance.totalDebitsGhs) / 100).toFixed(2),
          (Number(trialBalance.totalCreditsGhs) / 100).toFixed(2),
        ],
      ];
    } else {
      headers = ['Code', 'Name', 'Amount'];
      rows = incomeExpenditure.incomes.map((i) => [i.accountCode, i.accountName, (Number(i.amountPesewas) / 100).toFixed(2)]);
    }

    const csvContent = generateCsv(headers, rows);
    downloadCsv(filename, csvContent);
  }, [activeReport, currencyMode, periodStart, periodEnd, incomeExpenditure, balanceSheet, trialBalance]);

  const exportCurrentWord = useCallback(() => {
    logReportAudit('EXPORT_WORD', `Exported ${activeReport} statement to Microsoft Word`);
    const isUsd = currencyMode === 'USD_SUMMARY';
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('church_demo_mode') === 'true';

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
            {
              isTotal: true,
              category: 'TOTAL',
              name: 'Net Operating Surplus / (Deficit)',
              amount: Number(denominationUsdSummary.statementOfActivities.netSurplusDeficitUsdCents) / 100,
            },
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
            {
              isTotal: true,
              category: 'TOTAL',
              name: 'Net Operating Surplus / (Deficit)',
              amount: Number(incomeExpenditure.netSurplusDeficitPesewas) / 100,
            },
          ];

      exportReportToWord({
        title: isUsd ? 'Statement of Activities (USD Summary Translation)' : 'Statement of Income and Expenditure',
        periodText: `${periodStart} to ${periodEnd}`,
        currency: isUsd ? 'USD' : 'GHS',
        columns: [
          { header: 'Category', key: 'category' },
          { header: 'Account / Description', key: 'name' },
          { header: 'Amount', key: 'amount', isCurrency: true },
        ],
        data,
        isDemo,
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
        {
          isTotal: true,
          group: 'TOTAL ASSETS',
          name: 'Total Current Assets',
          amount: Number(balanceSheet.totalAssetsPesewas) / 100,
        },
        {
          isTotal: true,
          group: 'TOTAL LIABILITIES & FUNDS',
          name: 'Total Liabilities & Funds',
          amount: Number(balanceSheet.totalLiabilitiesAndFundsPesewas) / 100,
        },
      ];

      exportReportToWord({
        title: 'Statement of Financial Position (Balance Sheet)',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Classification', key: 'group' },
          { header: 'Account / Fund Name', key: 'name' },
          { header: 'Amount (GHS)', key: 'amount', isCurrency: true },
        ],
        data,
        isDemo,
      });
    } else if (activeReport === 'TRIAL_BALANCE') {
      const data = [
        ...trialBalance.accounts.map((a) => ({
          code: a.accountCode,
          name: a.accountName,
          type: a.accountType,
          debit: Number(a.debitGhs) / 100,
          credit: Number(a.creditGhs) / 100,
        })),
        {
          isTotal: true,
          code: 'TOTAL',
          name: 'Total Debits & Credits',
          type: 'Balanced',
          debit: Number(trialBalance.totalDebitsGhs) / 100,
          credit: Number(trialBalance.totalCreditsGhs) / 100,
        },
      ];

      exportReportToWord({
        title: 'Trial Balance of Accounts',
        periodText: `As of ${asOfDate}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code' },
          { header: 'Account Name', key: 'name' },
          { header: 'Type', key: 'type' },
          { header: 'Debit (GHS)', key: 'debit', isCurrency: true },
          { header: 'Credit (GHS)', key: 'credit', isCurrency: true },
        ],
        data,
        isDemo,
      });
    } else {
      const data = incomeExpenditure.incomes.map((i) => ({
        code: i.accountCode,
        name: i.accountName,
        amount: Number(i.amountPesewas) / 100,
      }));
      exportReportToWord({
        title: activeReport.replace(/_/g, ' '),
        periodText: `${periodStart} to ${periodEnd}`,
        currency: 'GHS',
        columns: [
          { header: 'Code', key: 'code' },
          { header: 'Description', key: 'name' },
          { header: 'Amount (GHS)', key: 'amount', isCurrency: true },
        ],
        data,
        isDemo,
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
    trialBalance,
    denominationUsdSummary,
  ]);

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
      reportStatus,
      preparedBy,
      certifiedBy,
      approvedBy,
      issuedReports,
      certifyReport,
      approveReport,
      logReportAudit,
      exportCurrentPdf,
      exportCurrentExcel,
      exportCurrentWord,
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
      reportStatus,
      preparedBy,
      certifiedBy,
      approvedBy,
      issuedReports,
      certifyReport,
      approveReport,
      logReportAudit,
      exportCurrentPdf,
      exportCurrentExcel,
      exportCurrentWord,
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
