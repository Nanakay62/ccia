import React, { useState, useMemo, useContext } from 'react';
import {
  Check,
  FileSpreadsheet,
  FileText,
  X,
  Info,
  Calendar,
} from 'lucide-react';
import { useBudget } from '../../context/BudgetContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { FinancialYearSelector } from '../ui/FinancialYearSelector.js';
import { BudgetRolloverModal } from './BudgetRolloverModal.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatMoneyAmount, formatDate, defaultChurchSettings } from '../../config/churchSettings.js';
import { exportReportToPdf } from '../../utils/exports/pdf.js';
import { exportReportToExcel } from '../../utils/exports/excel.js';
import { useRouter } from '../../context/RouterContext.js';
import type { BudgetLine } from '@church/domain';

type ViewMode = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
type BudgetTab = 'BUDGET_VS_ACTUAL' | 'BY_FUND' | 'BY_DEPARTMENT' | 'REVISIONS';

interface AccountMetadata {
  fundId: string;
  fundCode: string;
  fundName: string;
  department: string;
}

const ACCOUNT_METADATA: Record<string, AccountMetadata> = {
  '4010': { fundId: 'fund-gen', fundCode: 'GEN', fundName: 'General Fund', department: 'Treasury & Finance' },
  '4020': { fundId: 'fund-gen', fundCode: 'GEN', fundName: 'General Fund', department: 'Treasury & Finance' },
  '4030': { fundId: 'fund-mis', fundCode: 'MIS', fundName: 'Missions & Outreach', department: 'Missions & Evangelism' },
  '4040': { fundId: 'fund-bld', fundCode: 'BLD', fundName: 'Building Fund', department: 'Building & Capital Projects' },
  '5010': { fundId: 'fund-gen', fundCode: 'GEN', fundName: 'General Fund', department: 'Pastoral & Administration' },
  '5020': { fundId: 'fund-gen', fundCode: 'GEN', fundName: 'General Fund', department: 'Facilities & Operations' },
  '5030': { fundId: 'fund-gen', fundCode: 'GEN', fundName: 'General Fund', department: 'Facilities & Operations' },
  '5040': { fundId: 'fund-mis', fundCode: 'MIS', fundName: 'Missions & Outreach', department: 'Missions & Evangelism' },
  '5050': { fundId: 'fund-wel', fundCode: 'WEL', fundName: 'Welfare & Benevolence', department: 'Welfare & Social Action' },
};

export const BudgetManagerView: React.FC = () => {
  const { activeBudget, applyRevision, getUtilization } = useBudget();
  const { entries, accounts, funds, selectedFinancialYear } = useLedger();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});
  const { navigate } = useRouter();

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<BudgetTab>('BUDGET_VS_ACTUAL');
  const [viewMode, setViewMode] = useState<ViewMode>('QUARTERLY');

  // Filters
  const [selectedFundFilter, setSelectedFundFilter] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Revision Modal State
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [selectedAccountCode, setSelectedAccountCode] = useState('5020');
  const [newAmountGhs, setNewAmountGhs] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [authorizerRole, setAuthorizerRole] = useState('Elder Kofi Mensah (Treasurer)');

  // Account Detail Drawer State
  const [selectedLine, setSelectedLine] = useState<BudgetLine | null>(null);

  // Success Feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useModalEscape(isRevisionOpen, () => setIsRevisionOpen(false));

  if (!activeBudget) {
    return <div className="p-6 text-center text-[var(--text-muted)]">No active church budget found.</div>;
  }

  const utilizationList = getUtilization(activeBudget.id);

  // 83% of year elapsed for 02 Nov 2026 (day 306/365)
  const YEAR_ELAPSED_PCT = 83;

  // Calculate actuals and pace per line
  const linesWithMetrics = useMemo(() => {
    return activeBudget.lines.map((line) => {
      const util = utilizationList.find((u) => u.accountCode === line.accountCode);
      const isIncome = line.category === 'INCOME';
      const annualPesewas = line.annualAmountPesewas;
      const budgetToDatePesewas = (annualPesewas * BigInt(YEAR_ELAPSED_PCT)) / 100n;
      const actualPesewas = util ? util.actualPesewas : 0n;

      // Variance: For Income: Actual - BudgetToDate; For Expense: BudgetToDate - Actual (favorable is positive)
      const variancePesewas = isIncome
        ? actualPesewas - budgetToDatePesewas
        : budgetToDatePesewas - actualPesewas;

      const variancePct = budgetToDatePesewas > 0n
        ? Math.round(((Number(actualPesewas) - Number(budgetToDatePesewas)) / Number(budgetToDatePesewas)) * 100)
        : 0;

      const usedPct = annualPesewas > 0n
        ? Math.round((Number(actualPesewas) / Number(annualPesewas)) * 100)
        : 0;

      const pace = budgetToDatePesewas > 0n ? Number(actualPesewas) / Number(budgetToDatePesewas) : 0;

      // Real status calculation per Section 4.4
      let status: { type: 'success' | 'warning' | 'error'; label: string; reason: string };

      if (isIncome) {
        if (pace >= 0.95) {
          status = { type: 'success', label: 'On track', reason: `${usedPct}% used, 83% of year gone` };
        } else if (pace >= 0.80) {
          status = { type: 'warning', label: 'Watch', reason: `${Math.round(pace * 100)}% of pace` };
        } else {
          status = { type: 'error', label: 'Behind', reason: `${usedPct}% used, 83% of year gone` };
        }
      } else {
        if (actualPesewas === 0n && YEAR_ELAPSED_PCT > 25) {
          status = { type: 'warning', label: 'No spending recorded', reason: '0.00 after Q1' };
        } else if (pace <= 1.00) {
          status = { type: 'success', label: 'On track', reason: `${usedPct}% used` };
        } else if (pace <= 1.10) {
          status = { type: 'warning', label: 'Watch', reason: `${Math.round(pace * 100)}% of pace` };
        } else {
          status = { type: 'error', label: 'Over budget', reason: `${Math.round(pace * 100)}% of pace` };
        }
      }

      const meta = ACCOUNT_METADATA[line.accountCode] || {
        fundId: activeBudget.fundId,
        fundCode: 'GEN',
        fundName: 'General Fund',
        department: 'General Administration',
      };

      return {
        line,
        meta,
        isIncome,
        annualPesewas,
        budgetToDatePesewas,
        actualPesewas,
        variancePesewas,
        variancePct,
        usedPct,
        pace,
        status,
      };
    });
  }, [activeBudget, utilizationList]);

  // Unbudgeted spending accounts (actual activity on accounts not in budget)
  const unbudgetedLines = useMemo(() => {
    const budgetedCodes = new Set(activeBudget.lines.map((l) => l.accountCode));
    const unbudgetedMap = new Map<string, { account: (typeof accounts)[0]; actualPesewas: bigint }>();

    for (const entry of entries) {
      for (const l of entry.lines) {
        const acct = accounts.find((a) => a.id === l.accountId);
        if (!acct || budgetedCodes.has(acct.code)) continue;

        const cur = unbudgetedMap.get(acct.code)?.actualPesewas || 0n;
        if (acct.type === 'Expense') {
          unbudgetedMap.set(acct.code, {
            account: acct,
            actualPesewas: cur + (l.debitAmountGhs - l.creditAmountGhs),
          });
        } else if (acct.type === 'Income') {
          unbudgetedMap.set(acct.code, {
            account: acct,
            actualPesewas: cur + (l.creditAmountGhs - l.debitAmountGhs),
          });
        }
      }
    }

    return Array.from(unbudgetedMap.values()).filter((item) => item.actualPesewas > 0n);
  }, [activeBudget, entries, accounts]);

  // Filtering
  const filteredLines = useMemo(() => {
    return linesWithMetrics.filter((item) => {
      if (selectedFundFilter !== 'ALL' && item.meta.fundId !== selectedFundFilter) return false;
      if (selectedDeptFilter !== 'ALL' && item.meta.department !== selectedDeptFilter) return false;
      return true;
    });
  }, [linesWithMetrics, selectedFundFilter, selectedDeptFilter]);

  // Income and Expense splits
  const incomeLines = useMemo(() => filteredLines.filter((l) => l.isIncome), [filteredLines]);
  const expenseLines = useMemo(() => filteredLines.filter((l) => !l.isIncome), [filteredLines]);

  // Summary figures
  const totalIncomeBudget = linesWithMetrics.filter((l) => l.isIncome).reduce((acc, l) => acc + l.annualPesewas, 0n);
  const totalIncomeBudgetToDate = linesWithMetrics.filter((l) => l.isIncome).reduce((acc, l) => acc + l.budgetToDatePesewas, 0n);
  const totalIncomeActual = linesWithMetrics.filter((l) => l.isIncome).reduce((acc, l) => acc + l.actualPesewas, 0n);
  const totalIncomeVariance = totalIncomeActual - totalIncomeBudgetToDate;

  const totalExpenseBudget = linesWithMetrics.filter((l) => !l.isIncome).reduce((acc, l) => acc + l.annualPesewas, 0n);
  const totalExpenseBudgetToDate = linesWithMetrics.filter((l) => !l.isIncome).reduce((acc, l) => acc + l.budgetToDatePesewas, 0n);
  const totalExpenseActual = linesWithMetrics.filter((l) => !l.isIncome).reduce((acc, l) => acc + l.actualPesewas, 0n);
  const totalExpenseVariance = totalExpenseBudgetToDate - totalExpenseActual;

  const surplusBudget = totalIncomeBudget - totalExpenseBudget;
  const surplusActual = totalIncomeActual - totalExpenseActual;

  // Format monetary amount with negatives in parentheses
  const formatMoneyWithParens = (pesewas: bigint) => {
    const isNegative = pesewas < 0n;
    const absPesewas = isNegative ? -pesewas : pesewas;
    const formatted = formatMoneyAmount(absPesewas);
    return isNegative ? `(${formatted})` : formatted;
  };

  // Revision submit handler
  const handleApplyRevision = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmountGhs);
    if (isNaN(amt) || amt < 0 || !revisionReason.trim()) {
      alert('Please enter a valid amount and justification reason.');
      return;
    }

    try {
      applyRevision({
        budgetId: activeBudget.id,
        reason: revisionReason.trim(),
        updatedLines: [
          {
            accountCode: selectedAccountCode,
            newAmountPesewas: BigInt(Math.round(amt * 100)),
          },
        ],
      });

      setIsRevisionOpen(false);
      setNewAmountGhs('');
      setRevisionReason('');
      const msg = `Budget revised successfully. Line ${selectedAccountCode} updated.`;
      setStatusMessage(msg);
      showToast({ message: msg, type: 'success' });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Export handlers
  const handleExportPdf = async () => {
    const columns = [
      { header: 'Code', key: 'code', width: 45, align: 'left' as const },
      { header: 'Account', key: 'name', width: 150, align: 'left' as const },
      { header: 'Annual Budget (GHS)', key: 'annual', width: 90, align: 'right' as const },
      { header: 'YTD Budget (83%)', key: 'budgetToDate', width: 85, align: 'right' as const },
      { header: 'Actual Spent (GHS)', key: 'actual', width: 85, align: 'right' as const },
      { header: 'Variance (GHS)', key: 'variance', width: 80, align: 'right' as const },
      { header: 'Status', key: 'status', width: 65, align: 'center' as const },
    ];

    const data = linesWithMetrics.map((item) => ({
      code: item.line.accountCode,
      name: item.line.accountName,
      annual: formatMoneyAmount(item.annualPesewas),
      budgetToDate: formatMoneyAmount(item.budgetToDatePesewas),
      actual: formatMoneyAmount(item.actualPesewas),
      variance: formatMoneyWithParens(item.variancePesewas),
      status: item.status.label,
    }));

    await exportReportToPdf({
      filename: `Church_Budget_2026_${new Date().toISOString().slice(0, 10)}.pdf`,
      reportTitle: 'Operating Budget vs Actual Performance 2026',
      periodText: `Year to Date as at 02 Nov 2026 (83% of year elapsed)`,
      currency: 'GHS',
      columns,
      data,
      summaryRows: [
        { label: 'Total Revenue Budget', value: formatMoneyAmount(totalIncomeBudget) },
        { label: 'Total Revenue Actual', value: formatMoneyAmount(totalIncomeActual) },
        { label: 'Total Expense Budget', value: formatMoneyAmount(totalExpenseBudget) },
        { label: 'Total Expense Actual', value: formatMoneyAmount(totalExpenseActual) },
        { label: 'Net Operating Surplus', value: formatMoneyWithParens(surplusActual) },
      ],
      disclosureFootnote: `Official ${defaultChurchSettings.churchName} Operating Budget. Revisions subject to Presbytery approval.`,
    });
  };

  const handleExportExcel = async () => {
    const columns = [
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Account Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Fund', key: 'fund', width: 20 },
      { header: 'Annual Budget (GHS)', key: 'annual', width: 20 },
      { header: 'YTD Budget (83%)', key: 'budgetToDate', width: 20 },
      { header: 'Actual To Date (GHS)', key: 'actual', width: 20 },
      { header: 'Variance (GHS)', key: 'variance', width: 18 },
      { header: 'Status', key: 'status', width: 20 },
    ];

    const data = linesWithMetrics.map((item) => ({
      code: item.line.accountCode,
      name: item.line.accountName,
      category: item.line.category,
      department: item.meta.department,
      fund: item.meta.fundName,
      annual: formatMoneyAmount(item.annualPesewas),
      budgetToDate: formatMoneyAmount(item.budgetToDatePesewas),
      actual: formatMoneyAmount(item.actualPesewas),
      variance: formatMoneyWithParens(item.variancePesewas),
      status: item.status.label,
    }));

    await exportReportToExcel({
      filename: `Church_Budget_2026_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Budget vs Actual 2026',
      reportTitle: 'Church Operating Budget & Departmental Allocations 2026',
      periodText: 'Year to Date as at 02 Nov 2026 (83% of year elapsed)',
      currency: 'GHS',
      columns,
      data,
    });
  };

  // Account selected for revision
  const lineBeingRevised = activeBudget.lines.find((l) => l.accountCode === selectedAccountCode);
  const currentAmountGhs = lineBeingRevised ? (Number(lineBeingRevised.annualAmountPesewas) / 100).toFixed(2) : '0.00';
  const revisedNum = parseFloat(newAmountGhs) || 0;
  const currentNum = parseFloat(currentAmountGhs) || 0;
  const revisionDiff = revisedNum - currentNum;

  // Selected line journal postings for drawer
  const selectedLineTransactions = useMemo(() => {
    if (!selectedLine) return [];
    const targetAccountId = selectedLine.accountId;
    const txs: { date: string; docNumber: string; narration: string; fundName: string; dr: bigint; cr: bigint }[] = [];

    for (const e of entries) {
      for (const l of e.lines) {
        if (l.accountId === targetAccountId) {
          const fund = funds.find((f) => f.id === l.fundId);
          txs.push({
            date: e.entryDate,
            docNumber: e.documentNumber,
            narration: e.narration,
            fundName: fund ? fund.name : l.fundId,
            dr: l.debitAmountGhs,
            cr: l.creditAmountGhs,
          });
        }
      }
    }
    return txs;
  }, [selectedLine, entries, funds]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Header (Clean title "Budget 2026", status line, actions, controls) */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-serif text-[26px] font-semibold tracking-tight text-[var(--text-primary)]">
                Budget — {selectedFinancialYear.label}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Approved 12 Jan 2026 · Revision {activeBudget.revisions.length} · Church Operating Budget & Departmental Allocations · Approved 2026 Operating Budget
              </p>
            </div>
            <FinancialYearSelector />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--text-primary)] shadow-xs transition"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--text-primary)] shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => setIsRolloverOpen(true)}
              aria-label="Rollover to Next Year"
              title="Rollover Budget to Next Financial Year"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text-primary)] shadow-xs transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#1e3a2f]" />
              <span>Rollover to next year</span>
            </button>
            <button
              onClick={() => setIsRevisionOpen(true)}
              aria-label="Revise Allocation"
              title="Revise Budget Line Allocation"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#1e3a2f] hover:bg-[#162a22] text-white dark:bg-[#2d5242] dark:hover:bg-[#3d6e59] text-xs font-semibold shadow-xs transition"
            >
              <span>Revise budget</span>
            </button>
          </div>
        </div>

        {/* Feedback / Status line */}
        {statusMessage && (
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] py-1">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-4 h-4" />
              <span>{statusMessage}</span>
            </span>
            <button onClick={() => setStatusMessage(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Dismiss
            </button>
          </div>
        )}

        {/* Controls Row: Annual | Quarterly | Monthly, Year-to-date indicator, Fund & Department Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Segmented Toggle */}
            <div className="inline-flex rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('ANNUAL')}
                className={`px-3 py-1 rounded-[4px] font-medium transition ${
                  viewMode === 'ANNUAL'
                    ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Annual
              </button>
              <button
                type="button"
                onClick={() => setViewMode('QUARTERLY')}
                className={`px-3 py-1 rounded-[4px] font-medium transition ${
                  viewMode === 'QUARTERLY'
                    ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Quarterly
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MONTHLY')}
                className={`px-3 py-1 rounded-[4px] font-medium transition ${
                  viewMode === 'MONTHLY'
                    ? 'bg-[var(--surface-panel)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Year-to-date pace badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-xs text-[var(--text-secondary)]">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Year to date as at 02 Nov 2026 (83% of year elapsed)</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fund filter */}
            <select
              value={selectedFundFilter}
              onChange={(e) => setSelectedFundFilter(e.target.value)}
              className="px-2.5 py-1 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              aria-label="Filter by fund"
            >
              <option value="ALL">All funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
              ))}
            </select>

            {/* Department filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-2.5 py-1 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              aria-label="Filter by department"
            >
              <option value="ALL">All departments</option>
              <option value="Pastoral & Administration">Pastoral & Administration</option>
              <option value="Facilities & Operations">Facilities & Operations</option>
              <option value="Missions & Evangelism">Missions & Evangelism</option>
              <option value="Welfare & Social Action">Welfare & Social Action</option>
              <option value="Treasury & Finance">Treasury & Finance</option>
              <option value="Building & Capital Projects">Building & Capital Projects</option>
            </select>
          </div>
        </div>

        {/* Underline Tabs per Rule A3 (No pill tabs, no counts in pills) */}
        <div className="flex gap-6 border-b border-[var(--surface-border)] text-xs font-medium pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('BUDGET_VS_ACTUAL')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'BUDGET_VS_ACTUAL'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Budget vs actual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BY_FUND')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'BY_FUND'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            By fund
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BY_DEPARTMENT')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'BY_DEPARTMENT'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            By department
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REVISIONS')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'REVISIONS'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Revision history
          </button>
        </div>
      </div>

      {/* 2. Summary Strip (Section 4.2: One row of plain text, neutral colour, no cards, no colored numbers) */}
      <div className="p-3 bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[6px] text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 divide-y md:divide-y-0 md:divide-x divide-[var(--surface-border)]">
          {/* Income Strip */}
          <div className="space-y-1 md:pr-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
              Income
            </span>
            <div className="text-[var(--text-primary)] space-x-2">
              <span>Budget <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(totalIncomeBudget)}</strong></span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>YTD Actual <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(totalIncomeActual)}</strong></span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Variance <strong className="tabular-nums font-mono font-normal">{formatMoneyWithParens(totalIncomeVariance)}</strong></span>
            </div>
          </div>

          {/* Expenses Strip */}
          <div className="space-y-1 md:px-4 pt-2 md:pt-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
              Expenses
            </span>
            <div className="text-[var(--text-primary)] space-x-2">
              <span>Budget <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(totalExpenseBudget)}</strong></span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>YTD Actual <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(totalExpenseActual)}</strong></span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Variance <strong className="tabular-nums font-mono font-normal">{formatMoneyWithParens(totalExpenseVariance)}</strong></span>
            </div>
          </div>

          {/* Operating Surplus Strip */}
          <div className="space-y-1 md:pl-4 pt-2 md:pt-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
              Operating Surplus
            </span>
            <div className="text-[var(--text-primary)] space-x-2">
              <span>Budget <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(surplusBudget)}</strong></span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Actual <strong className="tabular-nums font-mono font-normal">GHS {formatMoneyAmount(surplusActual)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Tables (Budget vs Actual, By Fund, By Department) */}
      {(activeTab === 'BUDGET_VS_ACTUAL' || activeTab === 'BY_FUND' || activeTab === 'BY_DEPARTMENT') && (
        <div className="space-y-4">
          {/* Table Header Legend */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Budget is split equally across quarters (Q1, Q2, Q3, Q4) unless custom phasing is set. Click any row to view ledger details.</span>
            </div>
            <span className="tabular-nums font-mono">Currency: GHS</span>
          </div>

          <div className="border border-[var(--surface-border)] rounded-[6px] overflow-x-auto bg-[var(--surface-panel)]">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                  <th className="py-2.5 px-3 font-medium w-16">Code</th>
                  <th className="py-2.5 px-3 font-medium min-w-[200px]">Account</th>
                  <th className="py-2.5 px-3 font-medium text-right">Annual budget</th>

                  {viewMode === 'ANNUAL' && (
                    <>
                      <th className="py-2.5 px-3 font-medium text-right">Budget to date (83%)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actual to date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Variance</th>
                      <th className="py-2.5 px-3 font-medium text-right">Variance %</th>
                      <th className="py-2.5 px-3 font-medium min-w-[130px]">Used (83% marker)</th>
                    </>
                  )}

                  {viewMode === 'QUARTERLY' && (
                    <>
                      <th className="py-2.5 px-3 font-medium text-right">Q1</th>
                      <th className="py-2.5 px-3 font-medium text-right">Q2</th>
                      <th className="py-2.5 px-3 font-medium text-right">Q3</th>
                      <th className="py-2.5 px-3 font-medium text-right">Q4</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actual to date</th>
                    </>
                  )}

                  {viewMode === 'MONTHLY' && (
                    <>
                      <th className="py-2.5 px-3 font-medium text-right">Monthly phase</th>
                      <th className="py-2.5 px-3 font-medium text-right">Budget to date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actual to date</th>
                      <th className="py-2.5 px-3 font-medium text-right">Variance</th>
                    </>
                  )}

                  <th className="py-2.5 px-3 font-medium text-left min-w-[190px]">Status</th>
                </tr>
              </thead>

              {/* SECTION: INCOME */}
              <tbody>
                <tr className="bg-[var(--surface-subtle)] border-y border-[var(--surface-border)] text-[var(--text-primary)] font-semibold">
                  <td colSpan={viewMode === 'ANNUAL' ? 9 : viewMode === 'QUARTERLY' ? 8 : 7} className="py-2 px-3">
                    Income
                  </td>
                </tr>

                {incomeLines.map((item) => (
                  <tr
                    key={item.line.id}
                    onClick={() =>
                      navigate(`#/budgets/lines/${item.line.accountCode}`, {
                        listKey: 'budget-lines',
                        listItemIds: incomeLines.map((x) => x.line.accountCode),
                      })
                    }
                    className="hover:bg-[var(--surface-subtle)] border-b border-[var(--surface-border-subtle)] cursor-pointer transition"
                  >
                    <td className="py-2 px-3 tabular-nums font-mono text-[var(--text-muted)]">
                      {item.line.accountCode}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-[var(--text-primary)]">{item.line.accountName}</div>
                      {item.line.notes && (
                        <div className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">
                          {item.line.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                      {formatMoneyAmount(item.annualPesewas)}
                    </td>

                    {viewMode === 'ANNUAL' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.budgetToDatePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyWithParens(item.variancePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
                        </td>
                        {/* Progress Bar with 83% Time Marker */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-[var(--surface-border)] relative overflow-visible">
                              <div
                                className={`h-full rounded-full ${
                                  item.status.type === 'error'
                                    ? 'bg-rose-500'
                                    : item.status.type === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                }`}
                                style={{ width: `${Math.min(100, item.usedPct)}%` }}
                              />
                              {/* 83% marker line */}
                              <div
                                className="absolute -top-1 -bottom-1 w-[2px] bg-slate-900 dark:bg-slate-100 z-10"
                                style={{ left: '83%' }}
                                title="83% year elapsed"
                              />
                            </div>
                            <span className="tabular-nums font-mono text-[11px] text-[var(--text-muted)]">
                              {item.usedPct}%
                            </span>
                          </div>
                        </td>
                      </>
                    )}

                    {viewMode === 'QUARTERLY' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[0])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[1])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[2])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[3])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                      </>
                    )}

                    {viewMode === 'MONTHLY' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.annualPesewas / 12n)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.budgetToDatePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyWithParens(item.variancePesewas)}
                        </td>
                      </>
                    )}

                    {/* Status Column */}
                    <td className="py-2 px-3 text-left">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.status.type === 'error'
                              ? 'bg-rose-600'
                              : item.status.type === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                        />
                        <span className="font-medium text-[var(--text-primary)]">{item.status.label}</span>
                        <span className="text-[11px] text-[var(--text-muted)] truncate">({item.status.reason})</span>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Subtotal Income */}
                <tr className="border-t border-[var(--surface-border)] font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)]/50">
                  <td colSpan={2} className="py-2 px-3">Total Income</td>
                  <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalIncomeBudget)}</td>
                  {viewMode === 'ANNUAL' && (
                    <>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalIncomeBudgetToDate)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalIncomeActual)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyWithParens(totalIncomeVariance)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">
                        {totalIncomeBudgetToDate > 0n
                          ? `${Math.round(((Number(totalIncomeActual) - Number(totalIncomeBudgetToDate)) / Number(totalIncomeBudgetToDate)) * 100)}%`
                          : '—'}
                      </td>
                      <td colSpan={2} className="py-2 px-3 text-[11px] text-[var(--text-muted)] font-normal">
                        83% target benchmark
                      </td>
                    </>
                  )}
                  {viewMode === 'QUARTERLY' && (
                    <>
                      <td colSpan={4} className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalIncomeActual)}</td>
                      <td></td>
                    </>
                  )}
                  {viewMode === 'MONTHLY' && (
                    <>
                      <td colSpan={2}></td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalIncomeActual)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyWithParens(totalIncomeVariance)}</td>
                      <td></td>
                    </>
                  )}
                </tr>

                {/* SECTION: EXPENSES */}
                <tr className="bg-[var(--surface-subtle)] border-y border-[var(--surface-border)] text-[var(--text-primary)] font-semibold">
                  <td colSpan={viewMode === 'ANNUAL' ? 9 : viewMode === 'QUARTERLY' ? 8 : 7} className="py-2 px-3">
                    Expenses
                  </td>
                </tr>

                {expenseLines.map((item) => (
                  <tr
                    key={item.line.id}
                    onClick={() =>
                      navigate(`#/budgets/lines/${item.line.accountCode}`, {
                        listKey: 'budget-lines',
                        listItemIds: expenseLines.map((x) => x.line.accountCode),
                      })
                    }
                    className="hover:bg-[var(--surface-subtle)] border-b border-[var(--surface-border-subtle)] cursor-pointer transition"
                  >
                    <td className="py-2 px-3 tabular-nums font-mono text-[var(--text-muted)]">
                      {item.line.accountCode}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-[var(--text-primary)]">{item.line.accountName}</div>
                      {item.line.notes && (
                        <div className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">
                          {item.line.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                      {formatMoneyAmount(item.annualPesewas)}
                    </td>

                    {viewMode === 'ANNUAL' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.budgetToDatePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyWithParens(item.variancePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
                        </td>
                        {/* Progress Bar with 83% Time Marker */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-[var(--surface-border)] relative overflow-visible">
                              <div
                                className={`h-full rounded-full ${
                                  item.status.type === 'error'
                                    ? 'bg-rose-500'
                                    : item.status.type === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                }`}
                                style={{ width: `${Math.min(100, item.usedPct)}%` }}
                              />
                              {/* 83% marker line */}
                              <div
                                className="absolute -top-1 -bottom-1 w-[2px] bg-slate-900 dark:bg-slate-100 z-10"
                                style={{ left: '83%' }}
                                title="83% year elapsed"
                              />
                            </div>
                            <span className="tabular-nums font-mono text-[11px] text-[var(--text-muted)]">
                              {item.usedPct}%
                            </span>
                          </div>
                        </td>
                      </>
                    )}

                    {viewMode === 'QUARTERLY' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[0])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[1])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[2])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.line.quarterlyAmountsPesewas[3])}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                      </>
                    )}

                    {viewMode === 'MONTHLY' && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.annualPesewas / 12n)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyAmount(item.budgetToDatePesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)] font-medium">
                          {formatMoneyAmount(item.actualPesewas)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-secondary)]">
                          {formatMoneyWithParens(item.variancePesewas)}
                        </td>
                      </>
                    )}

                    {/* Status Column */}
                    <td className="py-2 px-3 text-left">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.status.type === 'error'
                              ? 'bg-rose-600'
                              : item.status.type === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                        />
                        <span className="font-medium text-[var(--text-primary)]">{item.status.label}</span>
                        <span className="text-[11px] text-[var(--text-muted)] truncate">({item.status.reason})</span>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Subtotal Expenses */}
                <tr className="border-t border-[var(--surface-border)] font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)]/50">
                  <td colSpan={2} className="py-2 px-3">Total Expenses</td>
                  <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalExpenseBudget)}</td>
                  {viewMode === 'ANNUAL' && (
                    <>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalExpenseBudgetToDate)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalExpenseActual)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyWithParens(totalExpenseVariance)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">
                        {totalExpenseBudgetToDate > 0n
                          ? `${Math.round(((Number(totalExpenseBudgetToDate) - Number(totalExpenseActual)) / Number(totalExpenseBudgetToDate)) * 100)}%`
                          : '—'}
                      </td>
                      <td colSpan={2} className="py-2 px-3 text-[11px] text-[var(--text-muted)] font-normal">
                        83% target benchmark
                      </td>
                    </>
                  )}
                  {viewMode === 'QUARTERLY' && (
                    <>
                      <td colSpan={4} className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalExpenseActual)}</td>
                      <td></td>
                    </>
                  )}
                  {viewMode === 'MONTHLY' && (
                    <>
                      <td colSpan={2}></td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(totalExpenseActual)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono">{formatMoneyWithParens(totalExpenseVariance)}</td>
                      <td></td>
                    </>
                  )}
                </tr>

                {/* UNBUDGETED ROWS (Section 4.3) */}
                {unbudgetedLines.length > 0 && (
                  <>
                    <tr className="bg-[var(--surface-subtle)] border-y border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                      <td colSpan={viewMode === 'ANNUAL' ? 9 : viewMode === 'QUARTERLY' ? 8 : 7} className="py-2 px-3">
                        Unbudgeted Postings
                      </td>
                    </tr>
                    {unbudgetedLines.map((unb) => (
                      <tr key={unb.account.id} className="hover:bg-[var(--surface-subtle)] border-b border-[var(--surface-border-subtle)]">
                        <td className="py-2 px-3 tabular-nums font-mono text-[var(--text-muted)]">{unb.account.code}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{unb.account.name} (Unbudgeted)</td>
                        <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-muted)]">—</td>
                        {viewMode === 'ANNUAL' && (
                          <>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-muted)]">—</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)]">
                              {formatMoneyAmount(unb.actualPesewas)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-rose-600">
                              ({formatMoneyAmount(unb.actualPesewas)})
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-rose-600">+100%</td>
                            <td className="py-2 px-3 text-[11px] text-rose-600">Unbudgeted</td>
                          </>
                        )}
                        {viewMode === 'QUARTERLY' && (
                          <>
                            <td colSpan={4} className="py-2 px-3 text-right text-[var(--text-muted)]">—</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)]">
                              {formatMoneyAmount(unb.actualPesewas)}
                            </td>
                          </>
                        )}
                        {viewMode === 'MONTHLY' && (
                          <>
                            <td colSpan={2} className="py-2 px-3 text-right text-[var(--text-muted)]">—</td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)]">
                              {formatMoneyAmount(unb.actualPesewas)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-mono text-rose-600">
                              ({formatMoneyAmount(unb.actualPesewas)})
                            </td>
                          </>
                        )}
                        <td className="py-2 px-3 text-left">
                          <span className="inline-flex items-center gap-1.5 text-rose-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Unbudgeted
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* SURPLUS SUMMARY LINE */}
                <tr className="border-t-2 border-[var(--surface-border)] font-bold text-[var(--text-primary)] bg-[var(--surface-subtle)]">
                  <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-[11px]">
                    Net Operating Surplus
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(surplusBudget)}</td>
                  {viewMode === 'ANNUAL' && (
                    <>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">
                        {formatMoneyAmount(totalIncomeBudgetToDate - totalExpenseBudgetToDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(surplusActual)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">
                        {formatMoneyWithParens(totalIncomeVariance + totalExpenseVariance)}
                      </td>
                      <td colSpan={3} className="py-2.5 px-3 text-[11px] text-[var(--text-muted)] font-normal text-right">
                        Fiscal Year 2026 Performance
                      </td>
                    </>
                  )}
                  {viewMode === 'QUARTERLY' && (
                    <>
                      <td colSpan={4}></td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(surplusActual)}</td>
                      <td></td>
                    </>
                  )}
                  {viewMode === 'MONTHLY' && (
                    <>
                      <td colSpan={2}></td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">{formatMoneyAmount(surplusActual)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-mono">
                        {formatMoneyWithParens(totalIncomeVariance + totalExpenseVariance)}
                      </td>
                      <td></td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tab: Revision History (Section 4.5) */}
      {activeTab === 'REVISIONS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Audit Trail of Budget Revisions ({activeBudget.revisions.length})
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Approved budgets are never edited in place
            </span>
          </div>

          {activeBudget.revisions.length === 0 ? (
            <div className="border border-[var(--surface-border)] rounded-[6px] p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-panel)]">
              No budget revisions have been recorded for fiscal year 2026.
            </div>
          ) : (
            <div className="border border-[var(--surface-border)] rounded-[6px] overflow-hidden bg-[var(--surface-panel)]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                    <th className="py-2.5 px-3 font-medium">Revision #</th>
                    <th className="py-2.5 px-3 font-medium">Date</th>
                    <th className="py-2.5 px-3 font-medium">Reason</th>
                    <th className="py-2.5 px-3 font-medium">Requested by</th>
                    <th className="py-2.5 px-3 font-medium">Authorized by</th>
                    <th className="py-2.5 px-3 font-medium text-right">Changes (From → To)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {activeBudget.revisions.map((rev) => (
                    <tr key={rev.id} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2 px-3 font-mono font-medium text-[var(--text-primary)]">
                        Rev #{rev.revisionNumber}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {formatDate(rev.revisionDate)}
                      </td>
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">
                        {rev.reason}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {rev.requestedBy}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">
                        {rev.authorizedBy}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-mono text-[var(--text-primary)]">
                        {rev.changes.map((ch, idx) => (
                          <div key={idx}>
                            Line {ch.accountCode}: {formatMoneyAmount(ch.fromPesewas)} → {formatMoneyAmount(ch.toPesewas)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Revision Workflow Modal (Section 4.5: shows before/after, reason required, elder/pastor approval) */}
      {isRevisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[8px] max-w-lg w-full p-5 shadow-2xl text-[var(--text-primary)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div>
                <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                  Revise Budget Line Allocation
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Formal adjustment of approved annual expenditure or income target
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRevisionOpen(false)}
                className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyRevision} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Budget Line to Adjust
                </label>
                <select
                  value={selectedAccountCode}
                  onChange={(e) => setSelectedAccountCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {activeBudget.lines.map((l) => (
                    <option key={l.accountCode} value={l.accountCode}>
                      {l.accountCode} · {l.accountName} ({l.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Before and After Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-subtle)] rounded-[6px] border border-[var(--surface-border)]">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Current Allocation (Before)</span>
                  <span className="text-sm font-semibold tabular-nums font-mono text-[var(--text-primary)]">
                    GHS {parseFloat(currentAmountGhs).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Proposed Adjustment</span>
                  <span className={`text-sm font-semibold tabular-nums font-mono ${revisionDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {revisionDiff >= 0 ? `+GHS ${revisionDiff.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-GHS ${Math.abs(revisionDiff).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  New Annual Amount (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newAmountGhs}
                  onChange={(e) => setNewAmountGhs(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs font-mono text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Justification / Reason (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="e.g. Unanticipated surge in utilities tariff by regulatory commission"
                  className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Approving Officer (Elder / Pastor)
                </label>
                <input
                  type="text"
                  value={authorizerRole}
                  onChange={(e) => setAuthorizerRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-[6px] border border-[var(--surface-border)] bg-[var(--surface-card)] text-xs text-[var(--text-primary)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsRevisionOpen(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--surface-border)] text-xs font-medium hover:bg-[var(--surface-subtle)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#1e3a2f] hover:bg-[#162a22] text-white dark:bg-[#2d5242] text-xs font-semibold shadow-xs"
                >
                  Authorize Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Account Detail Slide-Over Drawer (Transactions behind actual, phasing, metadata) */}
      <SlideOverPanel
        isOpen={Boolean(selectedLine)}
        onClose={() => setSelectedLine(null)}
        title={selectedLine ? `${selectedLine.accountCode} · ${selectedLine.accountName}` : 'Budget details'}
        subtitle={selectedLine ? `${selectedLine.category} · ${ACCOUNT_METADATA[selectedLine.accountCode]?.department || 'General Department'}` : ''}
        width="w-screen max-w-lg"
      >
        {selectedLine && (
          <div className="p-5 space-y-5 text-xs text-[var(--text-primary)]">
            {/* Meta Strip */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-subtle)] rounded-[6px] border border-[var(--surface-border)]">
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Fund Allocation</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {ACCOUNT_METADATA[selectedLine.accountCode]?.fundName || 'General Fund'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Department</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {ACCOUNT_METADATA[selectedLine.accountCode]?.department || 'Administration'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Annual Budget</span>
                <span className="font-medium tabular-nums font-mono text-[var(--text-primary)]">
                  GHS {formatMoneyAmount(selectedLine.annualAmountPesewas)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Actual Spent to Date</span>
                <span className="font-medium tabular-nums font-mono text-[var(--text-primary)]">
                  GHS {formatMoneyAmount(utilizationList.find((u) => u.accountCode === selectedLine.accountCode)?.actualPesewas || 0n)}
                </span>
              </div>
            </div>

            {/* Quarterly Phasing Grid */}
            <div className="space-y-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                Quarterly Distribution Phasing
              </span>
              <div className="border border-[var(--surface-border)] rounded-[6px] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                      <th className="py-1.5 px-2.5 font-medium">Q1</th>
                      <th className="py-1.5 px-2.5 font-medium">Q2</th>
                      <th className="py-1.5 px-2.5 font-medium">Q3</th>
                      <th className="py-1.5 px-2.5 font-medium">Q4</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-2.5 font-mono tabular-nums">{formatMoneyAmount(selectedLine.quarterlyAmountsPesewas[0])}</td>
                      <td className="py-2 px-2.5 font-mono tabular-nums">{formatMoneyAmount(selectedLine.quarterlyAmountsPesewas[1])}</td>
                      <td className="py-2 px-2.5 font-mono tabular-nums">{formatMoneyAmount(selectedLine.quarterlyAmountsPesewas[2])}</td>
                      <td className="py-2 px-2.5 font-mono tabular-nums">{formatMoneyAmount(selectedLine.quarterlyAmountsPesewas[3])}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Posted Ledger Transactions behind this Actual */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-muted)]">
                  Posted Transactions ({selectedLineTransactions.length})
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">From General Ledger</span>
              </div>

              {selectedLineTransactions.length === 0 ? (
                <div className="border border-[var(--surface-border)] rounded-[6px] p-4 text-center text-[var(--text-muted)]">
                  No posted transactions for this account in 2026.
                </div>
              ) : (
                <div className="border border-[var(--surface-border)] rounded-[6px] overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                        <th className="py-1.5 px-2.5 font-medium">Date</th>
                        <th className="py-1.5 px-2.5 font-medium">Doc #</th>
                        <th className="py-1.5 px-2.5 font-medium">Narration</th>
                        <th className="py-1.5 px-2.5 font-medium text-right">Amount (GHS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {selectedLineTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-subtle)]">
                          <td className="py-2 px-2.5 text-[var(--text-muted)] font-mono text-[11px]">
                            {formatDate(tx.date)}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-medium text-[var(--text-primary)]">
                            {tx.docNumber}
                          </td>
                          <td className="py-2 px-2.5 text-[var(--text-secondary)]">
                            {tx.narration}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-mono text-[var(--text-primary)]">
                            {tx.dr > 0n ? formatMoneyAmount(tx.dr) : formatMoneyAmount(tx.cr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Line Notes */}
            {selectedLine.notes && (
              <div className="p-3 bg-[var(--surface-subtle)] rounded-[6px] border border-[var(--surface-border)] text-xs space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  Budget Line Notes
                </span>
                <p className="text-[var(--text-secondary)]">{selectedLine.notes}</p>
              </div>
            )}
          </div>
        )}
      </SlideOverPanel>

      {/* Budget Rollover Modal (Spec Section A4) */}
      <BudgetRolloverModal
        isOpen={isRolloverOpen}
        onClose={() => setIsRolloverOpen(false)}
        currentYearLabel={selectedFinancialYear.label}
        nextYearLabel={`FY${parseInt(selectedFinancialYear.label.replace(/\D/g, ''), 10) + 1 || 2027}`}
        lines={activeBudget.lines}
        onConfirmRollover={({ nextYearLabel, globalPercentage, rolledLines }) => {
          setIsRolloverOpen(false);
          const msg = `Draft budget for ${nextYearLabel} created from ${selectedFinancialYear.label} (${rolledLines.length} account lines rolled over with ${globalPercentage >= 0 ? `+${globalPercentage}%` : `${globalPercentage}%`} baseline adjustment).`;
          setStatusMessage(msg);
          showToast({ message: msg, type: 'success' });
        }}
      />
    </div>
  );
};
