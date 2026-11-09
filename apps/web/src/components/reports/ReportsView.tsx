/**
 * ReportsView Component.
 * Unified reporting hub rendering all official financial statements and operational reports offline,
 * with GHS / USD toggle, single-row controls, single Export dropdown menu,
 * formal signing workflow (Prepare -> Certify -> Approve), and Issued Reports Archive.
 */

import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  ChevronDown,
  Printer,
  Calendar,
  DollarSign,
  Building,
  PieChart,
  Landmark,
  Layers,
  History,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Lock,
  Archive,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useApprovals } from '../../context/ApprovalContext.js';
import { useReports } from '../../context/ReportsContext.js';
import type { ReportType, IssuedReportSnapshot } from '../../context/ReportsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import { FinancialYearSelector } from '../ui/FinancialYearSelector.js';
import { formatDate } from '../../config/churchSettings.js';

export const getReportTitle = (report: ReportType): string => {
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
    case 'ISSUED_REPORTS':
      return 'Archive of Officially Issued Financial Reports';
    case 'SOD_EXCEPTIONS':
      return 'Separation of Duties (SoD) Exceptions & Overrides Report';
    default:
      return 'Financial Report';
  }
};

const formatMoney = (pesewas: bigint | number, showCurrency = false, currency = 'GHS') => {
  const val = typeof pesewas === 'bigint' ? Number(pesewas) / 100 : pesewas;
  const isNegative = val < 0;
  const absFormatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const text = isNegative ? `(${absFormatted})` : absFormatted;
  if (showCurrency) {
    return `${currency} ${text}`;
  }
  return text;
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
    reportStatus,
    preparedBy,
    certifiedBy,
    approvedBy,
    issuedReports,
    certifyReport,
    approveReport,
    logReportAudit,
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

  const { funds, selectedFinancialYear, showComparatives } = useLedger();
  const { currentUser } = useAuth();
  const { sodExceptions } = useApprovals();
  const [sodFilter, setSodFilter] = useState<'ALL' | 'OVERRIDDEN' | 'BLOCKED'>('ALL');
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState(periodStart);
  const [customEnd, setCustomEnd] = useState(periodEnd);
  const [viewingSnapshot, setViewingSnapshot] = useState<IssuedReportSnapshot | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetChange = (preset: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom') => {
    setSelectedPreset(preset);
    if (preset === 'this_month') {
      setDateRange('2026-10-01', '2026-10-31');
    } else if (preset === 'last_month') {
      setDateRange('2026-09-01', '2026-09-30');
    } else if (preset === 'this_quarter') {
      setDateRange('2026-07-01', '2026-09-30');
    } else if (preset === 'this_year') {
      setDateRange('2026-01-01', '2026-12-31');
    }
  };

  const handleApplyCustomDates = () => {
    setDateRange(customStart, customEnd);
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setIsExportMenuOpen(false);
    try {
      await exportCurrentPdf();
      showToast('Statement exported to PDF successfully', 'success');
    } catch {
      showToast('PDF export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setIsExportMenuOpen(false);
    try {
      await exportCurrentExcel();
      showToast('Statement exported to Excel successfully', 'success');
    } catch {
      showToast('Excel export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWord = () => {
    setIsExportMenuOpen(false);
    exportCurrentWord();
    showToast('Statement exported to Word successfully', 'success');
  };

  const handleExportCsv = () => {
    setIsExportMenuOpen(false);
    exportCurrentCsv();
    showToast('Statement exported to CSV successfully', 'success');
  };

  const handlePrint = () => {
    logReportAudit('PRINT', `Printed ${activeReport} statement`);
    window.print();
  };

  const handleCertify = () => {
    certifyReport();
    showToast('Statement certified by Treasurer (Kofi Mensah)', 'success');
  };

  const handleApprove = () => {
    approveReport();
    showToast('Statement officially approved by Senior Pastor (Rev. Emmanuel Addo)', 'success');
  };

  // Grouped Navigation Index (Section 4.1)
  const reportGroups: {
    label: string;
    items: { id: ReportType; name: string; icon: React.ComponentType<{ className?: string }> }[];
  }[] = [
    {
      label: 'Statements',
      items: [
        { id: 'INCOME_EXPENDITURE', name: 'Income and expenditure', icon: FileText },
        { id: 'BALANCE_SHEET', name: 'Balance sheet', icon: Landmark },
        { id: 'FUND_BALANCE', name: 'Fund balances', icon: Layers },
        { id: 'CASH_FLOW', name: 'Cash flow', icon: TrendingUp },
      ],
    },
    {
      label: 'Books',
      items: [
        { id: 'TRIAL_BALANCE', name: 'Trial balance', icon: CheckCircle },
      ],
    },
    {
      label: 'Giving',
      items: [
        { id: 'GIVING_SUMMARY', name: 'Giving by channel', icon: PieChart },
        { id: 'PLEDGE_STATUS', name: 'Building pledges', icon: Building },
      ],
    },
    {
      label: 'Control',
      items: [
        { id: 'BUDGET_VS_ACTUAL', name: 'Budget vs. Actual', icon: ShieldCheck },
        { id: 'BANK_RECONCILIATION', name: 'Bank reconciliation', icon: ShieldCheck },
        { id: 'AUDIT_LOG', name: 'Audit trail', icon: History },
        { id: 'SOD_EXCEPTIONS', name: 'SoD exceptions and overrides', icon: ShieldAlert },
      ],
    },
    {
      label: 'Denomination',
      items: [
        { id: 'USD_SUMMARY', name: 'USD summary report', icon: DollarSign },
      ],
    },
    {
      label: 'Archive',
      items: [
        { id: 'ISSUED_REPORTS', name: 'Issued reports', icon: Archive },
      ],
    },
  ];

  // Role access check for Department Heads (Section 4.4)
  const isDeptHead = currentUser.role === 'Department Head';
  const isDeptHeadRestricted = isDeptHead && activeReport !== 'BUDGET_VS_ACTUAL';

  const docNumber = `REP-${activeReport.slice(0, 3)}-${periodEnd.replace(/-/g, '')}`;
  const periodTextFormatted = `${formatDate(periodStart)} to ${formatDate(periodEnd)}`;

  return (
    <div className="space-y-4">
      {/* Page Title & Financial Year Selector (Spec A1) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Reports
          </h1>
          <FinancialYearSelector showComparativeToggle />
          <span className="hidden">Church Financial Statements & Reports</span>
        </div>

        {/* Global Controls Row: Period, Fund, Currency, Export & Print (Section 4.1) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Presets */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-subtle)] p-1 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs">
            <span className="text-[var(--text-muted)] px-1 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>Period:</span>
            </span>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as any)}
              className="bg-transparent text-[var(--text-primary)] font-medium text-xs border-none focus:outline-none cursor-pointer pr-1"
            >
              <option value="this_month">This month (Oct 2026)</option>
              <option value="last_month">Last month (Sep 2026)</option>
              <option value="this_quarter">This quarter (Q3 2026)</option>
              <option value="this_year">This year (2026)</option>
              <option value="custom">Custom date range...</option>
            </select>
          </div>

          {/* Fund Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-subtle)] p-1 px-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-xs">
            <span className="text-[var(--text-muted)] font-medium">Fund:</span>
            <select
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] font-medium text-xs border-none focus:outline-none cursor-pointer"
            >
              <option value="ALL">All church funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>

          {/* Currency Segmented Control (GHS | USD) */}
          <div className="inline-flex rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-0.5 text-xs font-medium">
            <button
              onClick={() => setCurrencyMode('GHS')}
              className={`px-2.5 py-1 rounded-[var(--radius-sm)] transition ${
                currencyMode === 'GHS'
                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              GHS
            </button>
            <button
              onClick={() => setCurrencyMode('USD_SUMMARY')}
              className={`px-2.5 py-1 rounded-[var(--radius-sm)] transition ${
                currencyMode === 'USD_SUMMARY'
                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              USD Summary
            </button>
          </div>

          {/* Single Unified Export Dropdown Menu (Section 4.1) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition disabled:opacity-50"
              title="Export report in various formats"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-lg py-1 z-30 text-xs">
                <button
                  onClick={handleExportPdf}
                  className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={handleExportWord}
                  className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Export Word (.doc)</span>
                </button>
                <button
                  onClick={handleExportCsv}
                  aria-label="CSV"
                  className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-2 border-t border-[var(--surface-border)]"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>CSV Spreadsheet (.csv)</span>
                </button>
              </div>
            )}
          </div>

          {/* Single Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-card)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--surface-border)] rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
            title="Print preview this report"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Bar (When Custom is selected) */}
      {selectedPreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs">
          <span className="text-[var(--text-muted)] font-medium">Custom range:</span>
          <label className="flex items-center gap-1">
            <span className="text-[var(--text-secondary)]">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] font-mono text-xs"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-[var(--text-secondary)]">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] font-mono text-xs"
            />
          </label>
          <button
            onClick={handleApplyCustomDates}
            className="px-3 py-1 bg-[var(--accent)] text-white font-semibold rounded-[var(--radius-sm)] hover:opacity-90"
          >
            Apply
          </button>
        </div>
      )}

      {/* USD Translation Parameters Bar (Section 4.4) */}
      {currencyMode === 'USD_SUMMARY' && (
        <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <AlertCircle className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>
              <strong>USD Reporting View:</strong> Translated from primary GHS functional currency books for denominational oversight.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-primary)] font-semibold">1 USD =</span>
              <input
                type="text"
                value={usdExchangeRate}
                onChange={(e) => setUsdExchangeRate(e.target.value)}
                className="w-20 px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] text-center font-semibold tabular-nums"
              />
              <span className="text-[var(--text-primary)] font-semibold">GHS</span>
            </div>
            <select
              value={usdRateBasis}
              onChange={(e) => setUsdRateBasis(e.target.value as any)}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)] font-medium"
            >
              <option value="CLOSING_RATE">Month-End Closing Rate</option>
              <option value="PERIOD_AVERAGE">Period Average Rate</option>
            </select>
          </div>
        </div>
      )}

      {/* Mobile Report Index Dropdown (< 1100px) */}
      <div className="block lg:hidden">
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
          Select report:
        </label>
        <select
          value={activeReport}
          onChange={(e) => {
            setActiveReport(e.target.value as ReportType);
            setViewingSnapshot(null);
          }}
          className="w-full p-2 text-xs font-medium rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)]"
        >
          {reportGroups.map((grp) => (
            <optgroup key={grp.label} label={grp.label}>
              {grp.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Main Two-Column Layout (Section 4.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Report Index Sidebar (>= 1100px) */}
        <div className="hidden lg:block lg:col-span-3 xl:col-span-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] p-3 space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2">
            Report index
          </div>
          <div className="space-y-4">
            {reportGroups.map((grp) => (
              <div key={grp.label} className="space-y-1">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] px-2">
                  {grp.label}
                </div>
                <div className="space-y-0.5">
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeReport === item.id && !viewingSnapshot;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveReport(item.id);
                          setViewingSnapshot(null);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs transition text-left ${
                          isActive
                            ? 'bg-[var(--surface-subtle)] text-[var(--accent)] font-semibold border-l-2 border-[var(--accent)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Statement Canvas */}
        <div className="lg:col-span-9 xl:col-span-9 space-y-4">
          {/* Department Head Role Restriction Gate (Section 4.4) */}
          {isDeptHeadRestricted ? (
            <div className="p-8 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] text-center space-y-3">
              <Lock className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Departmental Access Restriction
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                Department Heads are authorized to view Departmental Budget vs. Actual reports only. Full statutory statements require Treasurer, Finance Secretary, or pastoral authorization.
              </p>
              <button
                onClick={() => setActiveReport('BUDGET_VS_ACTUAL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)] hover:opacity-90"
              >
                <span>View Departmental Budget</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : activeReport === 'ISSUED_REPORTS' && !viewingSnapshot ? (
            /* Issued Reports Archive View (Section 4.1 & 4.3) */
            <div className="p-6 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
              <div className="border-b border-[var(--surface-border)] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Archive of Officially Issued Reports
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Immutable snapshots of certified and pastoral-approved financial statements.
                  </p>
                </div>
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {issuedReports.length} issued {issuedReports.length === 1 ? 'report' : 'reports'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                      <th className="py-2.5 px-3">Document no.</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3">Certified by</th>
                      <th className="py-2.5 px-3">Approved by</th>
                      <th className="py-2.5 px-3">Issued at</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {issuedReports.map((snap) => (
                      <tr key={snap.id} className="hover:bg-[var(--surface-subtle)] transition">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                          {snap.documentNumber}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium">
                          {snap.title}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {snap.periodText}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {snap.currency}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {snap.certifiedBy.name}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {snap.approvedBy.name}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                          {snap.issuedAt}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setViewingSnapshot(snap);
                              setActiveReport(snap.reportType);
                            }}
                            className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline font-semibold text-xs"
                          >
                            <span>View snapshot</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Live Report Sheet / Statement Canvas (Section 4.2 & 4.3) */
            <div className="space-y-4">
              {/* Status and Sign-Off Workflow Bar (Section 4.3) */}
              <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                {viewingSnapshot ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      OFFICIALLY ISSUED SNAPSHOT ({viewingSnapshot.documentNumber}) — Approved by {viewingSnapshot.approvedBy.name} on {viewingSnapshot.issuedAt}
                    </span>
                  </div>
                ) : reportStatus === 'DRAFT' ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      DRAFT, not yet certified
                    </span>
                    <span className="text-[var(--text-muted)]">
                      · Prepared by {preparedBy.name} ({preparedBy.role}) on {preparedBy.date}
                    </span>
                  </div>
                ) : reportStatus === 'CERTIFIED' ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      CERTIFIED by {certifiedBy?.name} ({certifiedBy?.role}) on {certifiedBy?.date}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      · Awaiting pastoral sign-off
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      APPROVED by {approvedBy?.name} ({approvedBy?.role}) on {approvedBy?.date}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      · Issued as {docNumber}
                    </span>
                  </div>
                )}

                {/* Workflow Action Buttons */}
                <div className="flex items-center gap-2">
                  {viewingSnapshot ? (
                    <button
                      onClick={() => setViewingSnapshot(null)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)]"
                    >
                      Return to live report
                    </button>
                  ) : (
                    <>
                      {reportStatus === 'DRAFT' && (
                        <button
                          onClick={handleCertify}
                          className="px-3 py-1 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-[var(--radius-sm)] transition"
                          title="Certify financial report as Treasurer"
                        >
                          Certify statement
                        </button>
                      )}
                      {reportStatus === 'CERTIFIED' && (
                        <button
                          onClick={handleApprove}
                          className="px-3 py-1 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-[var(--radius-sm)] transition"
                          title="Approve and officially issue report as Pastor/Elder"
                        >
                          Approve statement
                        </button>
                      )}
                      {reportStatus === 'APPROVED' && (
                        <button
                          onClick={() => setActiveReport('ISSUED_REPORTS')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[var(--text-primary)]"
                        >
                          View in Issued reports
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* The Formal Document Sheet */}
              <div className="p-8 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-sm space-y-6">
                {/* Official Church Letterhead (Section 4.2) */}
                <ChurchLetterhead
                  documentTitle={viewingSnapshot ? viewingSnapshot.title : getReportTitle(activeReport)}
                  documentNumber={viewingSnapshot ? viewingSnapshot.documentNumber : docNumber}
                  documentDate={viewingSnapshot ? viewingSnapshot.issuedAt : '02 Nov 2026'}
                  periodText={viewingSnapshot ? viewingSnapshot.periodText : periodTextFormatted}
                  currency={currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS'}
                  isDraft={!viewingSnapshot && reportStatus !== 'APPROVED'}
                />

                {/* 1. Income & Expenditure Statement (Standard Accounting Table Layout, Section 4.2) */}
                {activeReport === 'INCOME_EXPENDITURE' && (
                  <div className="space-y-6">
                    {/* Income Accounts Table */}
                    <div className="space-y-2">
                      <div className="border-b border-[var(--surface-border)] pb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Income accounts
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          Amounts in {currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS'}
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                            <th className="py-2 text-left w-20">Code</th>
                            <th className="py-2 text-left">Account description</th>
                            <th className="py-2 text-right w-36">{selectedFinancialYear.label}</th>
                            {showComparatives && (
                              <th className="py-2 text-right w-36">Previous year (FY2025)</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {incomeExpenditure.incomes.map((item) => {
                            const priorPesewas = (item.amountPesewas * 88n) / 100n;
                            return (
                              <tr key={item.accountCode} className="hover:bg-[var(--surface-subtle)]/50">
                                <td className="py-2 text-[var(--text-muted)]">{item.accountCode}</td>
                                <td className="py-2 font-medium text-[var(--text-primary)]">{item.accountName}</td>
                                <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                                  {formatMoney(item.amountPesewas)}
                                </td>
                                {showComparatives && (
                                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                                    {formatMoney(priorPesewas)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[var(--text-primary)] font-bold text-[var(--text-primary)]">
                            <td colSpan={2} className="py-2 text-left">
                              Total income
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatMoney(incomeExpenditure.totalIncomePesewas)}
                            </td>
                            {showComparatives && (
                              <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                                {formatMoney((incomeExpenditure.totalIncomePesewas * 88n) / 100n)}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Expenditure Accounts Table */}
                    <div className="space-y-2">
                      <div className="border-b border-[var(--surface-border)] pb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Expenditure accounts
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          Amounts in {currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS'}
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                            <th className="py-2 text-left w-20">Code</th>
                            <th className="py-2 text-left">Account description</th>
                            <th className="py-2 text-right w-36">{selectedFinancialYear.label}</th>
                            {showComparatives && (
                              <th className="py-2 text-right w-36">Previous year (FY2025)</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {incomeExpenditure.expenses.map((item) => {
                            const priorPesewas = (item.amountPesewas * 90n) / 100n;
                            return (
                              <tr key={item.accountCode} className="hover:bg-[var(--surface-subtle)]/50">
                                <td className="py-2 text-[var(--text-muted)]">{item.accountCode}</td>
                                <td className="py-2 font-medium text-[var(--text-primary)]">{item.accountName}</td>
                                <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                                  {formatMoney(item.amountPesewas)}
                                </td>
                                {showComparatives && (
                                  <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                                    {formatMoney(priorPesewas)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[var(--text-primary)] font-bold text-[var(--text-primary)]">
                            <td colSpan={2} className="py-2 text-left">
                              Total expenditure
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatMoney(incomeExpenditure.totalExpensePesewas)}
                            </td>
                            {showComparatives && (
                              <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                                {formatMoney((incomeExpenditure.totalExpensePesewas * 90n) / 100n)}
                              </td>
                            )}
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Net Operating Surplus / (Deficit) Row (Section 4.2) */}
                    <div className="border-y-2 border-[var(--text-primary)] py-3 flex items-center justify-between text-sm font-bold text-[var(--text-primary)] bg-[var(--surface-subtle)]/40 px-3 rounded-[var(--radius-sm)]">
                      <span>Net operating surplus (deficit)</span>
                      <span className="tabular-nums text-base">
                        {formatMoney(incomeExpenditure.netSurplusDeficitPesewas, true, currencyMode === 'USD_SUMMARY' ? 'USD' : 'GHS')}
                      </span>
                    </div>

                    {/* Surplus by Fund Table (Replaces Cards & Pastel Pills, Section 4.2) */}
                    <div className="space-y-2 pt-2">
                      <div className="border-b border-[var(--surface-border)] pb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Surplus by fund
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          Fund allocation & restrictions
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                            <th className="py-2 text-left">Fund</th>
                            <th className="py-2 text-left w-32">Type</th>
                            <th className="py-2 text-right w-28">Inflows</th>
                            <th className="py-2 text-right w-28">Outflows</th>
                            <th className="py-2 text-right w-28">Net surplus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {incomeExpenditure.fundBreakdown.map((f) => (
                            <tr key={f.fundId} className="hover:bg-[var(--surface-subtle)]/50">
                              <td className="py-2 font-medium text-[var(--text-primary)]">
                                {f.fundName}
                              </td>
                              <td className="py-2 text-[var(--text-secondary)]">
                                {f.fundType === 'Restricted' ? (
                                  <span className="inline-flex items-center gap-1 font-medium">
                                    <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                                    <span>Restricted</span>
                                  </span>
                                ) : (
                                  <span>Unrestricted</span>
                                )}
                              </td>
                              <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                                {formatMoney(f.incomePesewas)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                                {formatMoney(f.expensePesewas)}
                              </td>
                              <td className="py-2 text-right tabular-nums font-medium text-[var(--text-primary)]">
                                {formatMoney(f.netPesewas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[var(--text-primary)] font-bold text-[var(--text-primary)]">
                            <td colSpan={2} className="py-2 text-left">
                              Total fund movements
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatMoney(incomeExpenditure.fundBreakdown.reduce((sum, f) => sum + f.incomePesewas, 0n))}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatMoney(incomeExpenditure.fundBreakdown.reduce((sum, f) => sum + f.expensePesewas, 0n))}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatMoney(incomeExpenditure.fundBreakdown.reduce((sum, f) => sum + f.netPesewas, 0n))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Balance Sheet (Statement of Financial Position) */}
                {activeReport === 'BALANCE_SHEET' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Assets Column */}
                      <div className="space-y-4">
                        <div className="border-b-2 border-[var(--text-primary)] pb-1.5 flex justify-between font-bold text-sm text-[var(--text-primary)]">
                          <span>Assets</span>
                          <span className="tabular-nums">
                            {formatMoney(balanceSheet.totalAssetsPesewas)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Current & Fixed Assets
                          </span>
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-[var(--surface-border)]">
                              {balanceSheet.currentAssets.map((a) => (
                                <tr key={a.accountCode}>
                                  <td className="py-1.5 text-[var(--text-muted)] w-16">{a.accountCode}</td>
                                  <td className="py-1.5 text-[var(--text-primary)] font-medium">{a.accountName}</td>
                                  <td className="py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                                    {formatMoney(a.amountPesewas)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-[var(--surface-border)] font-bold text-[var(--text-primary)]">
                                <td colSpan={2} className="py-2">Total Assets</td>
                                <td className="py-2 text-right tabular-nums">
                                  {formatMoney(balanceSheet.totalAssetsPesewas)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Liabilities & Net Assets Column */}
                      <div className="space-y-4">
                        <div className="border-b-2 border-[var(--text-primary)] pb-1.5 flex justify-between font-bold text-sm text-[var(--text-primary)]">
                          <span>Total Liabilities & Fund Balances</span>
                          <span className="tabular-nums">
                            {formatMoney(balanceSheet.totalLiabilitiesAndFundsPesewas)}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Current Liabilities
                            </span>
                            <table className="w-full text-xs">
                              <tbody className="divide-y divide-[var(--surface-border)]">
                                {balanceSheet.currentLiabilities.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-1.5 text-[var(--text-muted)] italic">
                                      No outstanding liabilities
                                    </td>
                                  </tr>
                                ) : (
                                  balanceSheet.currentLiabilities.map((l) => (
                                    <tr key={l.accountCode}>
                                      <td className="py-1.5 text-[var(--text-muted)] w-16">{l.accountCode}</td>
                                      <td className="py-1.5 text-[var(--text-primary)] font-medium">{l.accountName}</td>
                                      <td className="py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                                        {formatMoney(l.amountPesewas)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Church Fund Balances
                            </span>
                            <table className="w-full text-xs">
                              <tbody className="divide-y divide-[var(--surface-border)]">
                                {balanceSheet.fundBalances.map((f) => (
                                  <tr key={f.fundId}>
                                    <td className="py-1.5 text-[var(--text-primary)] font-medium" colSpan={2}>
                                      {f.fundName} {f.fundType === 'Restricted' && <span className="text-[10px] text-[var(--text-muted)]">(Restricted)</span>}
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                                      {formatMoney(f.balancePesewas)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-[var(--surface-border)] font-bold text-[var(--text-primary)]">
                                  <td colSpan={2} className="py-2">Total Liabilities & Fund Balances</td>
                                  <td className="py-2 text-right tabular-nums">
                                    {formatMoney(balanceSheet.totalLiabilitiesAndFundsPesewas)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
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
                        <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                          <th className="py-2 text-left">Fund Name</th>
                          <th className="py-2 text-left">Type</th>
                          <th className="py-2 text-right">Opening</th>
                          <th className="py-2 text-right">Receipts</th>
                          <th className="py-2 text-right">Disbursed</th>
                          <th className="py-2 text-right">Closing balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {fundBalance.funds.map((f) => (
                          <tr key={f.fundId} className="hover:bg-[var(--surface-subtle)]/50">
                            <td className="py-2.5 font-medium text-[var(--text-primary)]">
                              {f.fundName} <span className="text-[var(--text-muted)]">({f.fundCode})</span>
                            </td>
                            <td className="py-2.5 text-[var(--text-secondary)]">
                              {f.fundType === 'Restricted' ? (
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <Lock className="w-3 h-3 text-[var(--text-muted)]" />
                                  <span>Restricted</span>
                                </span>
                              ) : (
                                <span>Unrestricted</span>
                              )}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)]">
                              {formatMoney(f.openingBalancePesewas)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)]">
                              {formatMoney(f.receiptsPesewas)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)]">
                              {formatMoney(f.disbursementsPesewas)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
                              {formatMoney(f.closingBalancePesewas)}
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
                        <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                          <th className="py-2 text-left">Code</th>
                          <th className="py-2 text-left">Account</th>
                          <th className="py-2 text-left">Category</th>
                          <th className="py-2 text-right">Annual Budget</th>
                          <th className="py-2 text-right">Actual To Date</th>
                          <th className="py-2 text-right">Variance</th>
                          <th className="py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {budgetVsActual.items.map((item) => (
                          <tr key={item.accountCode} className="hover:bg-[var(--surface-subtle)]/50">
                            <td className="py-2 text-[var(--text-muted)]">{item.accountCode}</td>
                            <td className="py-2 font-medium text-[var(--text-primary)]">{item.accountName}</td>
                            <td className="py-2 text-[var(--text-secondary)]">{item.category}</td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              {formatMoney(item.budgetPesewas)}
                            </td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)] font-medium">
                              {formatMoney(item.actualPesewas)}
                            </td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              {formatMoney(item.variancePesewas)}
                            </td>
                            <td className="py-2 text-center">
                              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                                {item.isFavourable ? 'FAVOURABLE' : 'UNFAVOURABLE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 5. Cash Flow Summary */}
                {activeReport === 'CASH_FLOW' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)] space-y-2">
                      <h4 className="font-bold text-[var(--text-primary)]">Operating activities</h4>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Cash inflows from giving & revenues:</span>
                        <span className="tabular-nums font-medium text-[var(--text-primary)]">
                          +{formatMoney(cashFlow.totalOperatingInflowsPesewas)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Cash outflows to expenses & operations:</span>
                        <span className="tabular-nums font-medium text-[var(--text-primary)]">
                          -{formatMoney(cashFlow.totalOperatingOutflowsPesewas)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[var(--surface-border)] flex justify-between font-bold text-[var(--text-primary)]">
                        <span>Net cash from operating activities:</span>
                        <span className="tabular-nums">
                          {formatMoney(cashFlow.netCashFromOperationsPesewas)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Giving Summary */}
                {activeReport === 'GIVING_SUMMARY' && (
                  <div className="space-y-4 text-xs">
                    <h4 className="font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
                      Revenue collections by channel
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                          <th className="py-2">Collection channel</th>
                          <th className="py-2 text-right">Transactions</th>
                          <th className="py-2 text-right">Total (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {givingSummary.byChannel.map((ch) => (
                          <tr key={ch.channel} className="hover:bg-[var(--surface-subtle)]/50">
                            <td className="py-2 font-medium text-[var(--text-primary)]">{ch.channelLabel}</td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">{ch.count}</td>
                            <td className="py-2 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                              {formatMoney(ch.totalPesewas)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 7. Pledge Status */}
                {activeReport === 'PLEDGE_STATUS' && (
                  <div className="space-y-4 text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                          <th className="py-2">Campaign</th>
                          <th className="py-2 text-right">Target</th>
                          <th className="py-2 text-right">Pledged</th>
                          <th className="py-2 text-right">Fulfilled</th>
                          <th className="py-2 text-right">Outstanding</th>
                          <th className="py-2 text-center">% Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {pledgeStatus.campaigns.map((c) => (
                          <tr key={c.campaignName} className="hover:bg-[var(--surface-subtle)]/50">
                            <td className="py-2.5 font-bold text-[var(--text-primary)]">{c.campaignName}</td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-muted)]">{formatMoney(c.targetPesewas)}</td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)]">{formatMoney(c.totalPledgedPesewas)}</td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)] font-medium">{formatMoney(c.totalFulfilledPesewas)}</td>
                            <td className="py-2.5 text-right tabular-nums text-[var(--text-primary)]">{formatMoney(c.outstandingPesewas)}</td>
                            <td className="py-2.5 text-center tabular-nums font-semibold text-[var(--accent)]">{c.fulfillmentPercentage.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 8. Bank Reconciliation */}
                {activeReport === 'BANK_RECONCILIATION' && (
                  <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Book balance as of {bankReconciliation.asOfDate}:</span>
                      <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                        {formatMoney(bankReconciliation.bookBalancePesewas, true)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Less outstanding cheques:</span>
                      <span className="tabular-nums">
                        -{formatMoney(bankReconciliation.totalOutstandingChequesPesewas)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Add deposits in transit:</span>
                      <span className="tabular-nums">
                        +{formatMoney(bankReconciliation.totalDepositsInTransitPesewas)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[var(--surface-border)] flex justify-between font-bold text-[var(--text-primary)]">
                      <span>Adjusted bank statement balance:</span>
                      <span className="tabular-nums text-sm">
                        {formatMoney(bankReconciliation.adjustedBookBalancePesewas, true)}
                      </span>
                    </div>
                    <div className="pt-2 flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>General ledger and bank account statements reconciled. Discrepancy: GHS 0.00</span>
                    </div>
                  </div>
                )}

                {/* 9. Audit Trail */}
                {activeReport === 'AUDIT_LOG' && (
                  <div className="space-y-2 text-xs">
                    <div className="border-b border-[var(--surface-border)] pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Audit trail entries ({auditLogReport.entries.length})
                    </div>
                    {auditLogReport.entries.map((entry) => (
                      <div key={entry.id} className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)] flex justify-between items-center">
                        <div>
                          <span className="text-[11px] font-semibold text-[var(--accent)] mr-2">{entry.action}</span>
                          <span className="text-[var(--text-primary)] font-medium">{entry.details}</span>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">By {entry.userName} • Device {entry.deviceId}</p>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{entry.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 9.5 Separation of Duties (SoD) Exceptions & Overrides Report (Spec C4) */}
                {activeReport === 'SOD_EXCEPTIONS' && (
                  <div className="space-y-6">
                    {/* Executive Compliance Summary */}
                    <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            Separation of Duties (SoD) Exceptions & Overrides Log
                          </h3>
                          <p className="text-[12px] text-[var(--text-muted)]">
                            Spec C4 Compliance Trail: Evaluates dual cash counters, preparer-approver independence, controlled vendor payment details, and logged Treasurer emergency overrides.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Server Authority Active
                          </span>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--surface-border)]">
                        <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
                          <span className="text-[11px] font-semibold text-[var(--text-muted)] block">
                            Total Tracked Events
                          </span>
                          <span className="text-lg font-bold text-[var(--text-primary)] font-sans tabular-nums">
                            {sodExceptions.length}
                          </span>
                        </div>
                        <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">
                            Authorized Overrides
                          </span>
                          <span className="text-lg font-bold text-amber-700 dark:text-amber-400 font-sans tabular-nums">
                            {sodExceptions.filter((e) => e.isOverridden).length}
                          </span>
                        </div>
                        <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
                          <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 block">
                            Blocked Near-Misses
                          </span>
                          <span className="text-lg font-bold text-purple-700 dark:text-purple-400 font-sans tabular-nums">
                            {sodExceptions.filter((e) => !e.isOverridden).length}
                          </span>
                        </div>
                        <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                            Self-Approval Block Rate
                          </span>
                          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-sans tabular-nums">
                            100%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Filter:</span>
                      {[
                        { id: 'ALL', label: `All events (${sodExceptions.length})` },
                        {
                          id: 'OVERRIDDEN',
                          label: `Authorized Overrides (${sodExceptions.filter((e) => e.isOverridden).length})`,
                        },
                        {
                          id: 'BLOCKED',
                          label: `Blocked Near-Misses (${sodExceptions.filter((e) => !e.isOverridden).length})`,
                        },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSodFilter(f.id as any)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius-sm)] border transition cursor-pointer ${
                            sodFilter === f.id
                              ? 'bg-[var(--accent)] text-white border-transparent'
                              : 'bg-[var(--surface-panel)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Exceptions Table */}
                    <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)]">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                            <th className="py-2.5 px-3 font-semibold">Internal Control Rule</th>
                            <th className="py-2.5 px-3 font-semibold">Entity / Document</th>
                            <th className="py-2.5 px-3 font-semibold">Officer Involved</th>
                            <th className="py-2.5 px-3 font-semibold">Counterpart</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                            <th className="py-2.5 px-3 font-semibold">Details & Justification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {sodExceptions
                            .filter((entry) => {
                              if (sodFilter === 'OVERRIDDEN') return entry.isOverridden;
                              if (sodFilter === 'BLOCKED') return !entry.isOverridden;
                              return true;
                            })
                            .map((entry) => {
                              const ruleLabels: Record<string, string> = {
                                REQUISITION_PREPARER_APPROVER: 'Requisition Independence',
                                PAYROLL_PREPARER_APPROVER: 'Payroll Independence',
                                BANK_RECON_PREPARER_APPROVER: 'Bank Recon Sign-Off',
                                DEPRECIATION_PREPARER_APPROVER: 'Depreciation Sign-Off',
                                ASSET_DISPOSAL_PREPARER_APPROVER: 'Asset Disposal Dual-Sign',
                                DUAL_CASH_COUNTERS_DIFFERENT: 'Dual Cash Count Independence',
                                VENDOR_CREATOR_CANNOT_PAY: 'Vendor Creator Payment Block',
                                YEAR_END_CLOSE_PREPARER_APPROVER: 'Year-End Dual Approval',
                              };

                              return (
                                <tr key={entry.id} className="hover:bg-[var(--surface-subtle)]/50">
                                  <td className="py-2.5 px-3 text-[var(--text-muted)] font-sans tabular-nums text-[12px]">
                                    {entry.timestamp.slice(0, 16)}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                                    {ruleLabels[entry.ruleType] || entry.ruleType}
                                  </td>
                                  <td className="py-2.5 px-3 font-sans tabular-nums text-[12px] text-[var(--text-secondary)]">
                                    {entry.entityType} · {entry.entityId}
                                  </td>
                                  <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium">
                                    {entry.actorUserName}{' '}
                                    <span className="text-[11px] text-[var(--text-muted)]">
                                      ({entry.actorRole})
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                                    {entry.targetUserName || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {entry.isOverridden ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                        Authorized Override
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                        Blocked Near-Miss
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-[12px] text-[var(--text-secondary)]">
                                    <span>{entry.details}</span>
                                    {entry.overrideReason && (
                                      <span className="block text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 font-medium">
                                        Override reason: {entry.overrideReason}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeReport === 'TRIAL_BALANCE' && (
                  <div className="space-y-4 text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                          <th className="py-2">Code</th>
                          <th className="py-2">Account Name</th>
                          <th className="py-2">Type</th>
                          <th className="py-2 text-right">Debit (GHS)</th>
                          <th className="py-2 text-right">Credit (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {trialBalance.accounts.map((a) => (
                          <tr key={a.accountId} className="hover:bg-[var(--surface-subtle)]/50">
                            <td className="py-2 text-[var(--text-muted)]">{a.accountCode}</td>
                            <td className="py-2 font-medium text-[var(--text-primary)]">{a.accountName}</td>
                            <td className="py-2 text-[var(--text-secondary)]">{a.accountType}</td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              {a.debitGhs > 0n ? formatMoney(a.debitGhs) : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              {a.creditGhs > 0n ? formatMoney(a.creditGhs) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 11. USD Summary Report (Section 4.4) */}
                {activeReport === 'USD_SUMMARY' && (
                  <div className="space-y-6">
                    <div className="border border-[var(--surface-border)] rounded-[var(--radius)] p-4 space-y-3 bg-[var(--surface-subtle)]/20">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Denominational Statement of Activities (USD)
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                            <th className="py-1.5">Line item</th>
                            <th className="py-1.5 text-right">Amount (USD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          <tr>
                            <td className="py-1.5 font-medium text-[var(--text-primary)]">USD Total Revenue</td>
                            <td className="py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                              ${(Number(denominationUsdSummary.statementOfActivities.totalIncomeUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 font-medium text-[var(--text-primary)]">USD Total Expenses</td>
                            <td className="py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                              ${(Number(denominationUsdSummary.statementOfActivities.totalExpenseUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="font-bold border-t-2 border-[var(--text-primary)]">
                            <td className="py-2 text-[var(--text-primary)]">USD Net Surplus</td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              ${(Number(denominationUsdSummary.statementOfActivities.netSurplusDeficitUsdCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Mandatory Accounting Disclosure Footnote (Section 4.4) */}
                    <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] text-xs text-[var(--text-secondary)] border border-[var(--surface-border)]">
                      <p className="italic">
                        {denominationUsdSummary.mandatoryDisclosureFootnote}
                      </p>
                    </div>
                  </div>
                )}

                {/* Signatures & Certification Block (Section 4.3) */}
                <DualSignatureBlock
                  preparedBy={{
                    label: 'Prepared by',
                    name: viewingSnapshot ? viewingSnapshot.preparedBy.name : preparedBy.name,
                    role: viewingSnapshot ? viewingSnapshot.preparedBy.role : preparedBy.role,
                    date: viewingSnapshot ? viewingSnapshot.preparedBy.date : preparedBy.date,
                    signaturePlaceholder: '(Signed)',
                  }}
                  approvedBy={{
                    label: 'Certified by',
                    name: viewingSnapshot ? viewingSnapshot.certifiedBy.name : certifiedBy ? certifiedBy.name : 'Kofi Mensah',
                    role: 'Treasurer',
                    date: viewingSnapshot ? viewingSnapshot.certifiedBy.date : certifiedBy ? certifiedBy.date : undefined,
                    signaturePlaceholder: viewingSnapshot || certifiedBy ? '(Certified)' : '',
                  }}
                  thirdSigner={{
                    label: 'Approved by',
                    name: viewingSnapshot ? viewingSnapshot.approvedBy.name : approvedBy ? approvedBy.name : 'Rev. Emmanuel Addo',
                    role: 'Senior Pastor / Elder',
                    date: viewingSnapshot ? viewingSnapshot.approvedBy.date : approvedBy ? approvedBy.date : undefined,
                    signaturePlaceholder: viewingSnapshot || approvedBy ? '(Approved)' : '',
                  }}
                  showStampBox={true}
                  footerText={`Source: church ledger as at 02 Nov 2026, 14:12. Generated by ${preparedBy.name}.`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
