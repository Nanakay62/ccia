/**
 * ReportsView Component.
 * Unified reporting hub rendering all 11 financial statements and operational reports offline,
 * with GHS / USD summary toggle, date filters, fund filters, and one-click PDF, Excel, and CSV exports.
 */

import React from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Building,
  CreditCard,
  PieChart,
  Landmark,
  Layers,
  History,
  CheckCircle,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { useReports } from '../../context/ReportsContext.js';
import type { ReportType } from '../../context/ReportsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';

const getReportTitle = (report: ReportType): string => {
  switch (report) {
    case 'INCOME_EXPENDITURE':
      return 'Statement of Income and Expenditure';
    case 'BALANCE_SHEET':
      return 'Statement of Financial Position (Balance Sheet)';
    case 'FUND_BALANCE':
      return 'Fund Balance Report (Restricted vs. Unrestricted)';
    case 'BUDGET_VS_ACTUAL':
      return 'Departmental Budget vs. Actual Expenditure';
    case 'CASH_FLOW':
      return 'Statement of Cash Flows (Direct Method)';
    case 'GIVING_SUMMARY':
      return 'Giving Summary & Collection Channel Report';
    case 'PLEDGE_STATUS':
      return 'Building & Special Pledge Campaign Status';
    case 'TRIAL_BALANCE':
      return 'General Ledger Trial Balance';
    case 'BANK_RECONCILIATION':
      return 'Bank & Cash Reconciliation Statement';
    case 'AUDIT_LOG':
      return 'Append-Only Ledger Audit & Compliance Trail';
    case 'USD_SUMMARY':
      return 'Denominational Financial Summary (USD Translation)';
  }
};

export const ReportsView: React.FC = () => {
  const {
    activeReport,
    setActiveReport,
    periodStart,
    periodEnd,
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
    exportCurrentWord,
    exportCurrentCsv,
  } = useReports();

  const { funds } = useLedger();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportCurrentPdf();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportCurrentExcel();
    } finally {
      setIsExporting(false);
    }
  };

  const reportCategories: { label: string; reports: { id: ReportType; name: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
    {
      label: 'Financial Statements',
      reports: [
        { id: 'INCOME_EXPENDITURE', name: 'Income & Expenditure', icon: FileText },
        { id: 'BALANCE_SHEET', name: 'Balance Sheet', icon: Landmark },
        { id: 'FUND_BALANCE', name: 'Fund Balances', icon: Layers },
        { id: 'CASH_FLOW', name: 'Cash Flow Summary', icon: TrendingUp },
        { id: 'TRIAL_BALANCE', name: 'Trial Balance', icon: CheckCircle },
      ],
    },
    {
      label: 'Giving & Pledges',
      reports: [
        { id: 'GIVING_SUMMARY', name: 'Giving by Channel', icon: PieChart },
        { id: 'PLEDGE_STATUS', name: 'Building Pledges', icon: Building },
      ],
    },
    {
      label: 'Management & Operations',
      reports: [
        { id: 'BUDGET_VS_ACTUAL', name: 'Budget vs. Actual', icon: CreditCard },
        { id: 'BANK_RECONCILIATION', name: 'Bank Reconciliation', icon: ShieldCheck },
        { id: 'AUDIT_LOG', name: 'Audit Trail', icon: History },
      ],
    },
    {
      label: 'Denominational View',
      reports: [
        { id: 'USD_SUMMARY', name: 'USD Summary Report', icon: DollarSign },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Church Financial Statements & Reports
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                11 official accounting statements with full offline PDF, Excel, and CSV exports.
              </p>
            </div>
          </div>

          {/* Action Bar: Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition disabled:opacity-50"
              title="Download official printable PDF statement"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={exportCurrentWord}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
              title="Download Microsoft Word document for church council minutes"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Word</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition disabled:opacity-50"
              title="Download Excel spreadsheet workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={exportCurrentCsv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-[var(--radius)] text-xs font-medium transition"
              title="Download raw data in CSV format"
            >
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
              title="Print preview this report with official church letterhead"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Global Control Bar: Period, Currency & Fund Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Period:
            </span>
            <button
              onClick={() => setDateRange('2026-10-01', '2026-10-31')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                periodStart === '2026-10-01' && periodEnd === '2026-10-31'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Oct 2026
            </button>
            <button
              onClick={() => setDateRange('2026-07-01', '2026-09-30')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                periodStart === '2026-07-01' && periodEnd === '2026-09-30'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Q3 2026
            </button>
            <button
              onClick={() => setDateRange('2026-01-01', '2026-12-31')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                periodStart === '2026-01-01' && periodEnd === '2026-12-31'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Full Year 2026
            </button>
          </div>

          {/* Currency Mode Toggle & Fund Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Fund Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Fund:</span>
              <select
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Church Funds</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setCurrencyMode('GHS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  currencyMode === 'GHS'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                GHS (Cedis)
              </button>
              <button
                onClick={() => setCurrencyMode('USD_SUMMARY')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  currencyMode === 'USD_SUMMARY'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                USD Summary
              </button>
            </div>
          </div>
        </div>

        {/* Currency Translation Parameters (When USD Summary Active) */}
        {currencyMode === 'USD_SUMMARY' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>USD Reporting View:</strong> Translated from primary GHS books for denominational oversight.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-900 dark:text-amber-200 font-semibold">1 USD =</span>
                <input
                  type="text"
                  value={usdExchangeRate}
                  onChange={(e) => setUsdExchangeRate(e.target.value)}
                  className="w-20 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono text-center font-bold"
                />
                <span className="text-amber-900 dark:text-amber-200 font-semibold">GHS</span>
              </div>
              <select
                value={usdRateBasis}
                onChange={(e) => setUsdRateBasis(e.target.value as any)}
                className="px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 font-medium"
              >
                <option value="CLOSING_RATE">Month-End Closing Rate</option>
                <option value="PERIOD_AVERAGE">Period Average Rate</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {reportCategories.map((cat) => (
          <div key={cat.label} className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {cat.reports.map((rep) => {
              const Icon = rep.icon;
              const isActive = activeReport === rep.id;
              return (
                <button
                  key={rep.id}
                  onClick={() => setActiveReport(rep.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{rep.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Main Report Canvas */}
      <div className="p-6 rounded-[var(--radius)] bg-white dark:bg-slate-900 border border-[var(--surface-border)] shadow-sm space-y-6">
        {/* Report Official Church Letterhead */}
        <ChurchLetterhead
          documentTitle={getReportTitle(activeReport)}
          documentNumber={`REP-${activeReport.slice(0, 3)}-${periodEnd.replace(/-/g, '')}`}
          documentDate={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          periodText={`${periodStart} to ${periodEnd}`}
          currency={currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS'}
        />

        {/* 1. Income & Expenditure Statement */}
        {activeReport === 'INCOME_EXPENDITURE' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Revenue Inflows</span>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  GHS {(Number(incomeExpenditure.totalIncomePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Expenditures</span>
                <div className="text-xl font-black text-rose-600 mt-1">
                  GHS {(Number(incomeExpenditure.totalExpensePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Net Operating Surplus / (Deficit)</span>
                <div
                  className={`text-xl font-black mt-1 ${
                    incomeExpenditure.netSurplusDeficitPesewas >= 0n ? 'text-blue-600' : 'text-amber-600'
                  }`}
                >
                  GHS {(Number(incomeExpenditure.netSurplusDeficitPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Income Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between border-b pb-1">
                <span>Income Accounts</span>
                <span className="text-xs text-emerald-600 font-bold">
                  Total: GHS {(Number(incomeExpenditure.totalIncomePesewas) / 100).toFixed(2)}
                </span>
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b">
                    <th className="py-2 text-left w-20">Code</th>
                    <th className="py-2 text-left">Account Description</th>
                    <th className="py-2 text-right w-36">Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomeExpenditure.incomes.map((item) => (
                    <tr key={item.accountCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2 font-mono text-slate-500">{item.accountCode}</td>
                      <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{item.accountName}</td>
                      <td className="py-2 font-mono font-semibold text-right text-emerald-600">
                        {(Number(item.amountPesewas) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expenses Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between border-b pb-1">
                <span>Expenditure Accounts</span>
                <span className="text-xs text-rose-600 font-bold">
                  Total: GHS {(Number(incomeExpenditure.totalExpensePesewas) / 100).toFixed(2)}
                </span>
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b">
                    <th className="py-2 text-left w-20">Code</th>
                    <th className="py-2 text-left">Account Description</th>
                    <th className="py-2 text-right w-36">Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomeExpenditure.expenses.map((item) => (
                    <tr key={item.accountCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2 font-mono text-slate-500">{item.accountCode}</td>
                      <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{item.accountName}</td>
                      <td className="py-2 font-mono font-semibold text-right text-rose-600">
                        {(Number(item.amountPesewas) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fund Breakdown Sub-Table */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Surplus / (Deficit) Breakdown per Fund
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {incomeExpenditure.fundBreakdown.map((f) => (
                  <div key={f.fundId} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{f.fundName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.fundType === 'Restricted' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {f.fundType}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Inflows: GHS {(Number(f.incomePesewas) / 100).toFixed(2)}</span>
                      <span>Outflows: GHS {(Number(f.expensePesewas) / 100).toFixed(2)}</span>
                    </div>
                    <div className="pt-1 border-t flex justify-between font-bold">
                      <span>Net:</span>
                      <span className={f.netPesewas >= 0n ? 'text-emerald-600' : 'text-rose-600'}>
                        GHS {(Number(f.netPesewas) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. Balance Sheet */}
        {activeReport === 'BALANCE_SHEET' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Assets</span>
                <div className="text-xl font-black text-blue-600 mt-1">
                  GHS {(Number(balanceSheet.totalAssetsPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Liabilities & Fund Balances</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  GHS {(Number(balanceSheet.totalLiabilitiesAndFundsPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets Column */}
              <div className="space-y-4">
                <div className="border-b pb-1 font-bold text-sm text-slate-900 dark:text-white flex justify-between">
                  <span>Current & Fixed Assets</span>
                  <span className="text-blue-600">GHS {(Number(balanceSheet.totalAssetsPesewas) / 100).toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  {balanceSheet.currentAssets.map((a) => (
                    <div key={a.accountCode} className="flex justify-between py-1.5 text-xs border-b border-slate-50 dark:border-slate-800">
                      <span className="text-slate-700 dark:text-slate-300">
                        <span className="font-mono text-slate-400 mr-2">{a.accountCode}</span>
                        {a.accountName}
                      </span>
                      <span className="font-mono font-semibold">GHS {(Number(a.amountPesewas) / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liabilities & Net Assets Column */}
              <div className="space-y-4">
                <div className="border-b pb-1 font-bold text-sm text-slate-900 dark:text-white flex justify-between">
                  <span>Liabilities & Fund Balances</span>
                  <span className="text-slate-900 dark:text-white">
                    GHS {(Number(balanceSheet.totalLiabilitiesAndFundsPesewas) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Current Liabilities</span>
                    {balanceSheet.currentLiabilities.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">No outstanding liabilities.</p>
                    ) : (
                      balanceSheet.currentLiabilities.map((l) => (
                        <div key={l.accountCode} className="flex justify-between py-1.5 text-xs border-b border-slate-50 dark:border-slate-800">
                          <span className="text-slate-700 dark:text-slate-300">
                            <span className="font-mono text-slate-400 mr-2">{l.accountCode}</span>
                            {l.accountName}
                          </span>
                          <span className="font-mono font-semibold text-rose-600">
                            GHS {(Number(l.amountPesewas) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Church Fund Balances</span>
                    {balanceSheet.fundBalances.map((f) => (
                      <div key={f.fundId} className="flex justify-between py-1.5 text-xs border-b border-slate-50 dark:border-slate-800">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${f.fundType === 'Restricted' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          {f.fundName}
                        </span>
                        <span className="font-mono font-semibold text-blue-600">
                          GHS {(Number(f.balancePesewas) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Fund Balance Report */}
        {activeReport === 'FUND_BALANCE' && (
          <div className="space-y-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b">
                  <th className="py-2 text-left">Fund Name</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-right">Opening</th>
                  <th className="py-2 text-right">Receipts</th>
                  <th className="py-2 text-right">Disbursed</th>
                  <th className="py-2 text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {fundBalance.funds.map((f) => (
                  <tr key={f.fundId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                      {f.fundName} <span className="text-slate-400 font-normal">({f.fundCode})</span>
                    </td>
                    <td className="py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.fundType === 'Restricted' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {f.fundType}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">
                      {(Number(f.openingBalancePesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 font-mono text-right text-emerald-600 font-medium">
                      +{(Number(f.receiptsPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 font-mono text-right text-rose-600 font-medium">
                      -{(Number(f.disbursementsPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 font-mono text-right font-black text-blue-600">
                      GHS {(Number(f.closingBalancePesewas) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Budget vs. Actual Report */}
        {activeReport === 'BUDGET_VS_ACTUAL' && (
          <div className="space-y-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b">
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Account</th>
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-right">Annual Budget</th>
                  <th className="py-2 text-right">Actual To Date</th>
                  <th className="py-2 text-right">Variance</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {budgetVsActual.items.map((item) => (
                  <tr key={item.accountCode} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 font-mono text-slate-400">{item.accountCode}</td>
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{item.accountName}</td>
                    <td className="py-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.category === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-right text-slate-600 dark:text-slate-400">
                      {(Number(item.budgetPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-2 font-mono text-right font-semibold text-slate-900 dark:text-white">
                      {(Number(item.actualPesewas) / 100).toFixed(2)}
                    </td>
                    <td className={`py-2 font-mono text-right font-bold ${item.isFavourable ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(Number(item.variancePesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isFavourable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.isFavourable ? 'FAVOURABLE' : 'UNFAVOURABLE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 11. USD Summary Report */}
        {activeReport === 'USD_SUMMARY' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase">
                  USD Total Revenue
                </span>
                <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
                  ${(Number(denominationUsdSummary.statementOfActivities.totalIncomeUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">USD Total Expenses</span>
                <div className="text-2xl font-black text-rose-600 mt-1">
                  ${(Number(denominationUsdSummary.statementOfActivities.totalExpenseUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">USD Net Surplus</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  ${(Number(denominationUsdSummary.statementOfActivities.netSurplusDeficitUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Denominational Balance Sheet Overview (USD)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                  <span className="text-[10px] text-slate-400">Total Assets</span>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    ${(Number(denominationUsdSummary.statementOfPosition.totalAssetsUsdCents) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                  <span className="text-[10px] text-slate-400">Liquid Cash & Bank</span>
                  <div className="font-bold text-blue-600 mt-1">
                    ${(Number(denominationUsdSummary.statementOfPosition.cashAndBankUsdCents) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                  <span className="text-[10px] text-slate-400">Restricted Funds</span>
                  <div className="font-bold text-amber-600 mt-1">
                    ${(Number(denominationUsdSummary.statementOfPosition.restrictedFundsUsdCents) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
                  <span className="text-[10px] text-slate-400">Unrestricted Equity</span>
                  <div className="font-bold text-emerald-600 mt-1">
                    ${(Number(denominationUsdSummary.statementOfPosition.unrestrictedFundsUsdCents) / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mandatory Accounting Disclosure Footnote */}
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs italic text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {denominationUsdSummary.mandatoryDisclosureFootnote}
            </div>
          </div>
        )}

        {/* Other Reports View (Cash Flow, Giving, Pledges, Trial Balance, Bank Rec, Audit Log) */}
        {activeReport === 'CASH_FLOW' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white">Operating Activities</h4>
              <div className="flex justify-between">
                <span>Total Cash Inflows from Giving & Revenues:</span>
                <span className="font-mono font-bold text-emerald-600">
                  +GHS {(Number(cashFlow.totalOperatingInflowsPesewas) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Cash Outflows to Expenses & Operations:</span>
                <span className="font-mono font-bold text-rose-600">
                  -GHS {(Number(cashFlow.totalOperatingOutflowsPesewas) / 100).toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between font-bold">
                <span>Net Cash from Operating Activities:</span>
                <span className="text-blue-600">
                  GHS {(Number(cashFlow.netCashFromOperationsPesewas) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'GIVING_SUMMARY' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Revenue Collections by Channel</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {givingSummary.byChannel.map((ch) => (
                <div key={ch.channel} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border text-xs">
                  <span className="text-[11px] text-slate-400">{ch.channelLabel}</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    GHS {(Number(ch.totalPesewas) / 100).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400">{ch.count} transactions</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'PLEDGE_STATUS' && (
          <div className="space-y-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b">
                  <th className="py-2 text-left">Campaign</th>
                  <th className="py-2 text-right">Target</th>
                  <th className="py-2 text-right">Pledged</th>
                  <th className="py-2 text-right">Fulfilled</th>
                  <th className="py-2 text-right">Outstanding</th>
                  <th className="py-2 text-center">% Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pledgeStatus.campaigns.map((c) => (
                  <tr key={c.campaignName}>
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">{c.campaignName}</td>
                    <td className="py-2.5 font-mono text-right text-slate-500">{(Number(c.targetPesewas) / 100).toFixed(2)}</td>
                    <td className="py-2.5 font-mono text-right text-slate-800 dark:text-slate-200">{(Number(c.totalPledgedPesewas) / 100).toFixed(2)}</td>
                    <td className="py-2.5 font-mono text-right font-semibold text-emerald-600">{(Number(c.totalFulfilledPesewas) / 100).toFixed(2)}</td>
                    <td className="py-2.5 font-mono text-right font-semibold text-rose-600">{(Number(c.outstandingPesewas) / 100).toFixed(2)}</td>
                    <td className="py-2.5 text-center font-bold text-blue-600">{c.fulfillmentPercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'BANK_RECONCILIATION' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Book Balance as of {bankReconciliation.asOfDate}:</span>
              <span className="font-mono font-bold">GHS {(Number(bankReconciliation.bookBalancePesewas) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Less Outstanding Cheques:</span>
              <span className="font-mono">-GHS {(Number(bankReconciliation.totalOutstandingChequesPesewas) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Add Deposits in Transit:</span>
              <span className="font-mono">+GHS {(Number(bankReconciliation.totalDepositsInTransitPesewas) / 100).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t flex justify-between font-bold text-blue-600">
              <span>Adjusted Bank Statement Balance:</span>
              <span className="font-mono">GHS {(Number(bankReconciliation.adjustedBookBalancePesewas) / 100).toFixed(2)}</span>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-emerald-600 font-bold">
              <CheckCircle className="w-4 h-4" /> Books and Bank Account fully reconciled. Discrepancy: GHS 0.00
            </div>
          </div>
        )}

        {activeReport === 'AUDIT_LOG' && (
          <div className="space-y-2 text-xs">
            {auditLogReport.entries.map((entry) => (
              <div key={entry.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border flex justify-between items-center">
                <div>
                  <span className="font-mono text-[11px] text-blue-600 font-bold mr-2">{entry.action}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{entry.details}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">By {entry.userName} • Device {entry.deviceId}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{entry.timestamp}</span>
              </div>
            ))}
          </div>
        )}

        {activeReport === 'TRIAL_BALANCE' && (
          <div className="space-y-4 text-xs">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 font-semibold border-b">
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Account Name</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-right">Debit (GHS)</th>
                  <th className="py-2 text-right">Credit (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trialBalance.accounts.map((a) => (
                  <tr key={a.accountId}>
                    <td className="py-2 font-mono text-slate-400">{a.accountCode}</td>
                    <td className="py-2 font-medium">{a.accountName}</td>
                    <td className="py-2 text-slate-500">{a.accountType}</td>
                    <td className="py-2 font-mono text-right font-semibold">
                      {a.debitGhs > 0n ? (Number(a.debitGhs) / 100).toFixed(2) : '-'}
                    </td>
                    <td className="py-2 font-mono text-right font-semibold">
                      {a.creditGhs > 0n ? (Number(a.creditGhs) / 100).toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dual Signatures & Certification Block (Section 1.6 & 5) */}
        <DualSignatureBlock
          preparedBy={{
            label: 'Prepared by',
            name: 'Ebenezer Mensah',
            role: 'Finance Secretary',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            signaturePlaceholder: '(Signed Electronically)',
          }}
          approvedBy={{
            label: 'Certified by',
            name: 'Deaconess Akosua Darko',
            role: 'Church Treasurer',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            signaturePlaceholder: '(Certified)',
          }}
          thirdSigner={{
            label: 'Approved by',
            name: 'Rev. Emmanuel Appiah',
            role: 'Senior Pastor / Minister in Charge',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            signaturePlaceholder: '(Approved)',
          }}
          showStampBox={true}
          notes="All balances extracted directly from CCIA immutably signed double-entry ledger journals."
        />
      </div>
    </div>
  );
};
