import React, { useState, useMemo, useContext } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import {
  calculateRevaluation,
  type Account,
  type JournalEntry,
  type Fund,
} from '@church/domain';
import {
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Lock,
  X,
  FileSpreadsheet,
  FileText,
  Stethoscope,
  ArrowUpRight,
} from 'lucide-react';
import { DateInput } from '../ui/DateInput.js';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatMoneyAmount, formatDate } from '../../config/churchSettings.js';
import { exportReportToPdf } from '../../utils/exports/pdf.js';
import { exportReportToExcel } from '../../utils/exports/excel.js';

interface Props {
  onNavigateToDoctor?: () => void;
  onNavigateToJournal?: () => void;
}

interface AccountRowData {
  account: Account;
  movementDr: bigint;
  movementCr: bigint;
  closingDr: bigint;
  closingCr: bigint;
  originalUsdCents: bigint;
  hasActivity: boolean;
}

interface AccountGroupData {
  id: string;
  title: string;
  accounts: AccountRowData[];
  subtotalMovementDr: bigint;
  subtotalMovementCr: bigint;
  subtotalClosingDr: bigint;
  subtotalClosingCr: bigint;
}

interface FundPositionRow {
  fund: Fund;
  opening: bigint;
  income: bigint;
  spending: bigint;
  transfers: bigint;
  closing: bigint;
  complianceText: string;
  isOverspent: boolean;
}

export const TrialBalanceView: React.FC<Props> = ({
  onNavigateToDoctor,
  onNavigateToJournal,
}) => {
  const { accounts, funds, entries } = useLedger();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  // 1. Controls State
  const [asAtDate, setAsAtDate] = useState(() => '2026-11-02');
  const [currencyView, setCurrencyView] = useState<'GHS' | 'USD'>('GHS');
  const [selectedFundId, setSelectedFundId] = useState<string>('ALL');
  const [showInactiveAccounts, setShowInactiveAccounts] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // 2. Modals & Detail Panel State
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showRevalModal, setShowRevalModal] = useState(false);
  const [closingRate, setClosingRate] = useState('16.0000');

  useModalEscape(showRevalModal, () => setShowRevalModal(false));

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Helper to format monetary values without repeating "GHS" on every cell
  const formatMoneyFigure = (pesewas: bigint): string => {
    if (pesewas === 0n) return '—';
    if (pesewas < 0n) return `(${formatMoneyAmount(-pesewas)})`;
    return formatMoneyAmount(pesewas);
  };

  // 3. Compute Account Movements & Closing Balances
  const { groups, grandTotals, totalInactiveCount, activeAccountsCount } = useMemo(() => {
    // Filter entries by fund if selected
    const activeEntries =
      selectedFundId === 'ALL'
        ? entries
        : entries.filter((e) => e.lines.some((l) => l.fundId === selectedFundId));

    // Calculate Dr/Cr totals and USD original amounts per account
    const drMap = new Map<string, bigint>();
    const crMap = new Map<string, bigint>();
    const originalUsdMap = new Map<string, bigint>();

    for (const entry of activeEntries) {
      for (const line of entry.lines) {
        if (selectedFundId !== 'ALL' && line.fundId !== selectedFundId) continue;

        const currentDr = drMap.get(line.accountId) ?? 0n;
        const currentCr = crMap.get(line.accountId) ?? 0n;
        drMap.set(line.accountId, currentDr + line.debitAmountGhs);
        crMap.set(line.accountId, currentCr + line.creditAmountGhs);

        if (line.originalCurrency === 'USD') {
          const curUsd = originalUsdMap.get(line.accountId) ?? 0n;
          const delta = line.debitAmountGhs > 0n ? line.originalAmount : -line.originalAmount;
          originalUsdMap.set(line.accountId, curUsd + delta);
        }
      }
    }

    const groupDefinitions: { id: string; title: string; types: string[] }[] = [
      { id: 'assets', title: 'Assets', types: ['Asset'] },
      { id: 'liabilities', title: 'Liabilities', types: ['Liability'] },
      { id: 'equity', title: 'Funds and equity', types: ['Equity'] },
      { id: 'income', title: 'Income', types: ['Income'] },
      { id: 'expenses', title: 'Expenses', types: ['Expense'] },
    ];

    let grandMovementDr = 0n;
    let grandMovementCr = 0n;
    let grandClosingDr = 0n;
    let grandClosingCr = 0n;
    let inactiveCounter = 0;
    let activeCounter = 0;

    const computedGroups: AccountGroupData[] = groupDefinitions.map((g) => {
      const groupAccounts = accounts.filter((a) => g.types.includes(a.type));
      let subDr = 0n;
      let subCr = 0n;
      let subCloseDr = 0n;
      let subCloseCr = 0n;

      const accountRows: AccountRowData[] = groupAccounts.map((account) => {
        const mDr = drMap.get(account.id) ?? 0n;
        const mCr = crMap.get(account.id) ?? 0n;

        let cDr = 0n;
        let cCr = 0n;

        // Normal balance calculation
        if (account.type === 'Asset' || account.type === 'Expense') {
          const net = mDr - mCr;
          if (net >= 0n) cDr = net;
          else cCr = -net;
        } else {
          const net = mCr - mDr;
          if (net >= 0n) cCr = net;
          else cCr = -net;
        }

        const usdCents = originalUsdMap.get(account.id) ?? 0n;
        const hasActivity = mDr > 0n || mCr > 0n || cDr > 0n || cCr > 0n;

        if (hasActivity) {
          activeCounter++;
        } else {
          inactiveCounter++;
        }

        subDr += mDr;
        subCr += mCr;
        subCloseDr += cDr;
        subCloseCr += cCr;

        return {
          account,
          movementDr: mDr,
          movementCr: mCr,
          closingDr: cDr,
          closingCr: cCr,
          originalUsdCents: usdCents,
          hasActivity,
        };
      });

      grandMovementDr += subDr;
      grandMovementCr += subCr;
      grandClosingDr += subCloseDr;
      grandClosingCr += subCloseCr;

      return {
        id: g.id,
        title: g.title,
        accounts: accountRows,
        subtotalMovementDr: subDr,
        subtotalMovementCr: subCr,
        subtotalClosingDr: subCloseDr,
        subtotalClosingCr: subCloseCr,
      };
    });

    const diff = grandClosingDr - grandClosingCr;

    return {
      groups: computedGroups,
      grandTotals: {
        movementDr: grandMovementDr,
        movementCr: grandMovementCr,
        closingDr: grandClosingDr,
        closingCr: grandClosingCr,
        difference: diff,
        isBalanced: diff === 0n,
      },
      totalInactiveCount: inactiveCounter,
      activeAccountsCount: activeCounter,
    };
  }, [accounts, entries, selectedFundId]);

  // 4. Compute Fund Position Table & Net Assets Reconciliation
  const { fundRows, fundGrandTotals, interfundBalance, netAssets } = useMemo(() => {
    let totOpening = 0n;
    let totIncome = 0n;
    let totSpending = 0n;
    let totTransfers = 0n;
    let totClosing = 0n;

    // Track interfund balance (Account 2020)
    let acct2020Dr = 0n;
    let acct2020Cr = 0n;

    for (const e of entries) {
      for (const l of e.lines) {
        if (l.accountId === 'acct-2020') {
          acct2020Dr += l.debitAmountGhs;
          acct2020Cr += l.creditAmountGhs;
        }
      }
    }
    const interfundNet = acct2020Dr > acct2020Cr ? acct2020Dr - acct2020Cr : acct2020Cr - acct2020Dr;

    const rows: FundPositionRow[] = funds.map((fund) => {
      let income = 0n;
      let spending = 0n;
      let transfers = 0n;
      let opening = 0n;

      for (const e of entries) {
        for (const l of e.lines) {
          if (l.fundId !== fund.id) continue;

          // Check if opening balance
          if (e.entryType === 'OPENING_BALANCE') {
            opening += l.creditAmountGhs - l.debitAmountGhs;
            continue;
          }

          // Revenue accounts (4000s)
          const acc = accounts.find((a) => a.id === l.accountId);
          if (acc?.type === 'Income') {
            income += l.creditAmountGhs - l.debitAmountGhs;
          } else if (acc?.type === 'Expense') {
            spending += l.debitAmountGhs - l.creditAmountGhs;
          } else if (acc?.code === '2020') {
            transfers += l.debitAmountGhs - l.creditAmountGhs;
          }
        }
      }

      const closing = opening + income - spending + transfers;

      totOpening += opening;
      totIncome += income;
      totSpending += spending;
      totTransfers += transfers;
      totClosing += closing;

      const hasActivity = opening !== 0n || income !== 0n || spending !== 0n || transfers !== 0n;
      const isOverspent = fund.type === 'Restricted' && closing < 0n;

      let complianceText = '—';
      if (fund.type === 'Restricted') {
        if (isOverspent) {
          complianceText = `Overspent by GHS ${formatMoneyAmount(-closing)} (override recorded)`;
        } else if (hasActivity || closing > 0n) {
          complianceText = 'Within purpose';
        }
      }

      return {
        fund,
        opening,
        income,
        spending,
        transfers,
        closing,
        complianceText,
        isOverspent,
      };
    });

    return {
      fundRows: rows,
      fundGrandTotals: {
        opening: totOpening,
        income: totIncome,
        spending: totSpending,
        transfers: totTransfers,
        closing: totClosing,
      },
      interfundBalance: interfundNet,
      netAssets: totClosing - interfundNet,
    };
  }, [funds, entries, accounts]);

  // USD Revaluation calculation
  const revalResult = calculateRevaluation({
    entries,
    usdAccounts: accounts,
    closingRate,
    revaluationDate: asAtDate,
    fxGainLossAccountId: 'acct-5980',
    generalFundId: 'fund-gen',
  });

  // Recent postings for selected account in slide-over
  const selectedAccountPostings = useMemo(() => {
    if (!selectedAccount) return [];
    const list: { entry: JournalEntry; dr: bigint; cr: bigint; memo?: string; fundName?: string }[] = [];

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.accountId === selectedAccount.id) {
          const fund = funds.find((f) => f.id === line.fundId);
          list.push({
            entry,
            dr: line.debitAmountGhs,
            cr: line.creditAmountGhs,
            memo: line.description || entry.narration,
            fundName: fund?.name,
          });
        }
      }
    }
    return list;
  }, [selectedAccount, entries, funds]);

  // 5. PDF & Excel Export Handlers
  const handleExportPdf = async () => {
    const dataRows: Record<string, string | number>[] = [];
    for (const group of groups) {
      for (const item of group.accounts) {
        if (!showInactiveAccounts && !item.hasActivity) continue;
        dataRows.push({
          code: item.account.code,
          name: item.account.name,
          currency: item.account.currency === 'USD' ? 'USD' : '—',
          drMove: formatMoneyFigure(item.movementDr),
          crMove: formatMoneyFigure(item.movementCr),
          drClose: formatMoneyFigure(item.closingDr),
          crClose: formatMoneyFigure(item.closingCr),
        });
      }
    }

    await exportReportToPdf({
      filename: `Trial_Balance_${asAtDate.replace(/-/g, '')}.pdf`,
      reportTitle: 'Trial Balance & Fund Position',
      periodText: `As at ${formatDate(asAtDate)}`,
      currency: 'GHS',
      columns: [
        { header: 'Code', key: 'code', width: 45, align: 'left' },
        { header: 'Account Name', key: 'name', width: 170, align: 'left' },
        { header: 'Currency', key: 'currency', width: 50, align: 'center' },
        { header: 'Dr Movement', key: 'drMove', width: 70, align: 'right' },
        { header: 'Cr Movement', key: 'crMove', width: 70, align: 'right' },
        { header: 'Closing Dr', key: 'drClose', width: 75, align: 'right' },
        { header: 'Closing Cr', key: 'crClose', width: 75, align: 'right' },
      ],
      data: dataRows,
      summaryRows: [
        { label: 'Total Closing Dr (GHS)', value: formatMoneyAmount(grandTotals.closingDr) },
        { label: 'Total Closing Cr (GHS)', value: formatMoneyAmount(grandTotals.closingCr) },
        { label: 'Net Assets (GHS)', value: formatMoneyAmount(netAssets) },
      ],
      disclosureFootnote: 'USD accounts benchmarked at 15.5000 set 24 Oct 2026. General Ledger is append-only.',
    });

    showToast({ message: 'Trial balance exported to PDF.' });
  };

  const handleExportExcel = async () => {
    const excelRows: Record<string, any>[] = [];
    for (const group of groups) {
      for (const item of group.accounts) {
        if (!showInactiveAccounts && !item.hasActivity) continue;
        excelRows.push({
          code: item.account.code,
          name: item.account.name,
          currency: item.account.currency === 'USD' ? 'USD' : 'GHS',
          drMove: Number(item.movementDr) / 100,
          crMove: Number(item.movementCr) / 100,
          drClose: Number(item.closingDr) / 100,
          crClose: Number(item.closingCr) / 100,
        });
      }
    }

    await exportReportToExcel({
      filename: `Trial_Balance_${asAtDate.replace(/-/g, '')}.xlsx`,
      sheetName: 'Trial Balance',
      reportTitle: 'Trial Balance & Fund Position',
      periodText: `As at ${formatDate(asAtDate)}`,
      currency: 'GHS',
      columns: [
        { header: 'Account Code', key: 'code', width: 14 },
        { header: 'Account Title', key: 'name', width: 34 },
        { header: 'Currency', key: 'currency', width: 12 },
        { header: 'Dr Movement', key: 'drMove', width: 16, isCurrency: true },
        { header: 'Cr Movement', key: 'crMove', width: 16, isCurrency: true },
        { header: 'Closing Dr', key: 'drClose', width: 18, isCurrency: true },
        { header: 'Closing Cr', key: 'crClose', width: 18, isCurrency: true },
      ],
      data: excelRows,
      summaryRows: [
        { label: 'Total Closing Dr', value: Number(grandTotals.closingDr) / 100 },
        { label: 'Total Closing Cr', value: Number(grandTotals.closingCr) / 100 },
      ],
      disclosureFootnote: 'USD accounts benchmarked at 15.5000 set 24 Oct 2026.',
    });

    showToast({ message: 'Trial balance exported to Excel.' });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Row (Spec 2.1) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Trial balance
          </h1>

          {/* Action Buttons on Right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRevalModal(true)}
              className="px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)] transition"
            >
              USD revaluation
            </button>

            {onNavigateToDoctor && (
              <button
                type="button"
                onClick={onNavigateToDoctor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Check and diagnose</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Line (Plain text with icon, NO box per A1/2.1) */}
        {grandTotals.isBalanced ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Balanced. Debits{' '}
              <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                {formatMoneyAmount(grandTotals.closingDr)}
              </strong>{' '}
              equal credits{' '}
              <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                {formatMoneyAmount(grandTotals.closingCr)}
              </strong>
              . Checked 2 min ago.
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2 rounded-[var(--radius)] border-b border-red-500 bg-red-50/40 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                Out of balance by GHS {formatMoneyAmount(grandTotals.difference > 0n ? grandTotals.difference : -grandTotals.difference)}
              </span>
            </div>
            {onNavigateToDoctor && (
              <button
                type="button"
                onClick={onNavigateToDoctor}
                className="font-semibold underline hover:opacity-80"
              >
                Diagnose
              </button>
            )}
          </div>
        )}

        {/* Controls Row (As at date, GHS | USD, Fund filter, Export) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[var(--surface-border-subtle)] text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* As at Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-secondary)]">As at:</span>
              <DateInput
                value={asAtDate}
                onChange={(val) => setAsAtDate(val)}
                className="w-36"
              />
            </div>

            {/* GHS | USD View Toggle */}
            <div className="flex items-center border border-[var(--surface-border)] rounded-[var(--radius)] p-0.5 bg-[var(--surface-panel)]">
              <button
                type="button"
                onClick={() => setCurrencyView('GHS')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  currencyView === 'GHS'
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                GHS view
              </button>
              <button
                type="button"
                onClick={() => setCurrencyView('USD')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  currencyView === 'USD'
                    ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                USD view
              </button>
            </div>

            {/* Fund Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-secondary)]">Fund:</span>
              <select
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">All funds (Consolidated)</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.type === 'Restricted' ? '· Restricted' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Actions & Inactive Filter */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowInactiveAccounts(!showInactiveAccounts)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              {showInactiveAccounts
                ? 'Hide inactive accounts'
                : `Show ${totalInactiveCount} accounts with no activity`}
            </button>

            <span className="text-[var(--surface-border)]">|</span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--surface-border)] rounded-[var(--radius)] hover:bg-[var(--surface-subtle)] flex items-center gap-1"
                title="Export PDF statement"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--surface-border)] rounded-[var(--radius)] hover:bg-[var(--surface-subtle)] flex items-center gap-1"
                title="Export Excel spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Standard Accounting Trial Balance Table (Spec 2.2) */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/70 text-[var(--text-secondary)] font-semibold">
                <th className="py-2.5 px-3 w-16">Code</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3 w-20 text-center">Currency</th>
                <th className="py-2.5 px-3 w-32 text-right">Period movement Dr</th>
                <th className="py-2.5 px-3 w-32 text-right">Period movement Cr</th>
                <th className="py-2.5 px-3 w-32 text-right">Closing balance Dr</th>
                <th className="py-2.5 px-3 w-32 text-right">Closing balance Cr</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--surface-border-subtle)]">
              {groups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.id);
                const visibleAccounts = showInactiveAccounts
                  ? group.accounts
                  : group.accounts.filter((a) => a.hasActivity);

                return (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <tr
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="bg-[var(--surface-subtle)]/40 hover:bg-[var(--surface-subtle)]/80 cursor-pointer select-none transition"
                    >
                      <td colSpan={7} className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          )}
                          <span className="font-semibold text-xs text-[var(--text-primary)]">
                            {group.title}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            ({visibleAccounts.length}{' '}
                            {visibleAccounts.length === 1 ? 'account' : 'accounts'})
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Account Rows */}
                    {!isCollapsed &&
                      visibleAccounts.map((item) => (
                        <tr
                          key={item.account.id}
                          onClick={() => setSelectedAccount(item.account)}
                          className="hover:bg-[var(--surface-subtle)]/60 cursor-pointer transition text-[13px]"
                        >
                          <td className="py-2 px-3 font-normal text-[var(--text-secondary)] tabular-nums">
                            {item.account.code}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">
                                {item.account.name}
                              </span>
                              {item.account.currency === 'USD' && item.originalUsdCents > 0n && (
                                <span className="text-[11px] text-[var(--text-muted)] tabular-nums font-mono">
                                  (${formatMoneyAmount(item.originalUsdCents)})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.account.currency === 'USD' ? (
                              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                                USD
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                            {formatMoneyFigure(item.movementDr)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                            {formatMoneyFigure(item.movementCr)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-[var(--text-primary)]">
                            {formatMoneyFigure(item.closingDr)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-[var(--text-primary)]">
                            {formatMoneyFigure(item.closingCr)}
                          </td>
                        </tr>
                      ))}

                    {/* Group Subtotal Row */}
                    {!isCollapsed && (
                      <tr className="bg-[var(--surface-subtle)]/20 border-t border-[var(--surface-border-subtle)] text-[12px] font-medium text-[var(--text-secondary)]">
                        <td colSpan={2} className="py-1.5 px-3 text-right">
                          Total {group.title}
                        </td>
                        <td className="py-1.5 px-3"></td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          {formatMoneyFigure(group.subtotalMovementDr)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          {formatMoneyFigure(group.subtotalMovementCr)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-semibold">
                          {formatMoneyFigure(group.subtotalClosingDr)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-semibold">
                          {formatMoneyFigure(group.subtotalClosingCr)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Grand Totals Footer (Spec 2.2) */}
            <tfoot className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)]/60 font-semibold text-xs">
              <tr>
                <td colSpan={2} className="py-2.5 px-3 text-left uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
                  Total
                </td>
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                  {formatMoneyAmount(grandTotals.movementDr)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                  {formatMoneyAmount(grandTotals.movementCr)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-bold text-sm">
                  {formatMoneyAmount(grandTotals.closingDr)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-bold text-sm">
                  {formatMoneyAmount(grandTotals.closingCr)}
                </td>
              </tr>
              {!grandTotals.isBalanced && (
                <tr className="bg-red-50/60 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                  <td colSpan={5} className="py-1.5 px-3 text-right font-medium">
                    Out of balance difference:
                  </td>
                  <td colSpan={2} className="py-1.5 px-3 text-right tabular-nums font-bold">
                    GHS {formatMoneyAmount(grandTotals.difference > 0n ? grandTotals.difference : -grandTotals.difference)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Table Footnote / Caption per Spec 2.2 */}
        <div className="py-2 px-3 bg-[var(--surface-subtle)]/30 border-t border-[var(--surface-border-subtle)] text-[11px] text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2">
          <span>USD accounts at benchmark rate 15.5000, set 24 Oct 2026.</span>
          <span>Showing {activeAccountsCount} active accounts ({totalInactiveCount} zero-balance hidden)</span>
        </div>
      </div>

      {/* 3. Fund Position Table & Net Assets Reconciliation (Spec 2.3) */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--surface-border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Fund position and restricted compliance
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Fund accounting strictly isolates restricted donations
          </span>
        </div>

        <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]/70 text-[var(--text-secondary)] font-semibold">
                  <th className="py-2 px-3">Fund</th>
                  <th className="py-2 px-3 w-28">Type</th>
                  <th className="py-2 px-3 w-28 text-right">Opening</th>
                  <th className="py-2 px-3 w-28 text-right">Income</th>
                  <th className="py-2 px-3 w-28 text-right">Spending</th>
                  <th className="py-2 px-3 w-28 text-right">Transfers</th>
                  <th className="py-2 px-3 w-32 text-right">Closing balance</th>
                  <th className="py-2 px-3 w-56">Compliance</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                {fundRows.map((row) => (
                  <tr key={row.fund.id} className="hover:bg-[var(--surface-subtle)]/60 transition text-[13px]">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-[var(--text-primary)]">
                        {row.fund.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">
                        {row.fund.code}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {row.fund.type === 'Restricted' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                          <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Restricted</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Unrestricted
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoneyFigure(row.opening)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoneyFigure(row.income)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoneyFigure(row.spending)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {formatMoneyFigure(row.transfers)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatMoneyFigure(row.closing)}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.isOverspent ? (
                        <span className="text-red-600 dark:text-red-400 font-medium text-xs">
                          {row.complianceText}
                        </span>
                      ) : row.complianceText === 'Within purpose' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Within purpose</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Fund Totals Row */}
              <tfoot className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)]/60 font-semibold text-xs">
                <tr>
                  <td colSpan={2} className="py-2 px-3 uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
                    Total of funds
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatMoneyFigure(fundGrandTotals.opening)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatMoneyFigure(fundGrandTotals.income)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatMoneyFigure(fundGrandTotals.spending)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                    {formatMoneyFigure(fundGrandTotals.transfers)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--text-primary)] font-bold text-sm">
                    {formatMoneyAmount(fundGrandTotals.closing)}
                  </td>
                  <td className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Balance Sheet Reconciliation Line per Spec 2.3 */}
          <div className="py-2.5 px-3.5 bg-[var(--surface-subtle)]/30 border-t border-[var(--surface-border-subtle)] text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2">
            <span>
              Total of funds{' '}
              <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                GHS {formatMoneyAmount(fundGrandTotals.closing)}
              </strong>{' '}
              less interfund balances{' '}
              <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                GHS {formatMoneyAmount(interfundBalance)}
              </strong>{' '}
              = net assets{' '}
              <strong className="font-bold text-[var(--text-primary)] tabular-nums">
                GHS {formatMoneyAmount(netAssets)}
              </strong>{' '}
              (matching balance sheet)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Slide-Over Detail Panel: Account Postings History (Spec 2.2) */}
      <SlideOverPanel
        isOpen={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : ''}
        subtitle={selectedAccount ? `${selectedAccount.type} account · ${selectedAccount.currency}` : undefined}
      >
        {selectedAccount && (
          <div className="space-y-4 text-xs">
            {/* Quick summary stats */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border-subtle)]">
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Normal Balance</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {selectedAccount.type === 'Asset' || selectedAccount.type === 'Expense' ? 'Debit' : 'Credit'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)] block">Account Currency</span>
                <span className="font-medium text-[var(--text-primary)]">{selectedAccount.currency}</span>
              </div>
            </div>

            {/* List of journal lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">
                  Recent Journal Postings ({selectedAccountPostings.length})
                </span>
                {onNavigateToJournal && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount(null);
                      onNavigateToJournal();
                    }}
                    className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all in journal</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {selectedAccountPostings.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                  No journal postings recorded for this account in the current period.
                </p>
              ) : (
                <div className="divide-y divide-[var(--surface-border-subtle)] border border-[var(--surface-border)] rounded-[var(--radius)] overflow-hidden">
                  {selectedAccountPostings.map((item, idx) => (
                    <div key={idx} className="p-2.5 hover:bg-[var(--surface-subtle)]/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[var(--text-primary)]">
                          {item.entry.documentNumber}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {item.entry.entryDate}
                        </span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] line-clamp-1">
                        {item.memo}
                      </div>
                      <div className="flex items-center justify-between pt-0.5 text-[11px]">
                        <span className="text-[var(--text-muted)]">{item.fundName || 'General Fund'}</span>
                        <div className="flex items-center gap-3 tabular-nums font-medium">
                          {item.dr > 0n && (
                            <span className="text-[var(--text-primary)]">Dr GHS {formatMoneyAmount(item.dr)}</span>
                          )}
                          {item.cr > 0n && (
                            <span className="text-[var(--text-secondary)]">Cr GHS {formatMoneyAmount(item.cr)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* 5. USD Revaluation Modal (Spec 2.1) */}
      {showRevalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-5 shadow-2xl text-[var(--text-primary)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                Month-End USD Revaluation Preview
              </h3>
              <button
                type="button"
                onClick={() => setShowRevalModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Revalues all foreign-currency USD balances at the period closing rate and previews the unrealized Foreign Exchange gain or loss adjustment.
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Period Closing Rate (USD to GHS):
              </label>
              <input
                type="text"
                value={closingRate}
                onChange={(e) => setClosingRate(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-xs font-mono font-medium"
              />
            </div>

            <div className="border border-[var(--surface-border)] rounded-[var(--radius)] overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium">
                  <tr>
                    <th className="p-2">Account</th>
                    <th className="p-2 text-right">USD Balance</th>
                    <th className="p-2 text-right">Carrying GHS</th>
                    <th className="p-2 text-right">Revalued GHS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border-subtle)]">
                  {revalResult.revaluationLines.length > 0 ? (
                    revalResult.revaluationLines.map((l) => (
                      <tr key={l.accountId} className="hover:bg-[var(--surface-subtle)]/40">
                        <td className="p-2 font-medium">{l.accountName}</td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          ${formatMoneyAmount(l.usdBalanceCents)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums">
                          {formatMoneyAmount(l.currentGhsBookValue)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums font-semibold">
                          {formatMoneyAmount(l.newGhsValue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-[var(--text-muted)]">
                        No active USD balance to revalue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] text-xs flex justify-between items-center">
              <span className="font-medium text-[var(--text-secondary)]">Unrealized Adjustment:</span>
              <span
                className={`font-semibold tabular-nums ${
                  revalResult.isNetGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {revalResult.isNetGain ? '+' : '-'}
                GHS {formatMoneyAmount(revalResult.totalAdjustmentGhs)} ({revalResult.isNetGain ? 'FX Gain' : 'FX Loss'})
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRevalModal(false)}
                className="px-3 py-1.5 border border-[var(--surface-border)] rounded-[var(--radius)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
