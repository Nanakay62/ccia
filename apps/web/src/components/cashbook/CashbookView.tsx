import React, { useState, useMemo } from 'react';
import {
  Plus,
  Minus,
  ArrowRightLeft,
  Calculator,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useCashbook, type CashbookFilter } from '../../context/CashbookContext.js';
import { useToast } from '../../context/ToastContext.js';
import { UnderlineTabs, SlideOverPanel } from '../ui/index.js';
import type { CashbookEntry, CashCountLine } from '@church/domain';
import { computeAnalysedCashbook } from '@church/domain';
import { generateCsv, downloadCsv } from '../../utils/exports/csv.js';
import { exportReportToExcel } from '../../utils/exports/excel.js';
import { BankReconciliationTab } from './BankReconciliationTab.js';
import { ChequeRegisterTab } from './ChequeRegisterTab.js';
import { useRouter } from '../../context/RouterContext.js';

export const CashbookView: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const { funds, accounts } = useLedger();
  const {
    cashAccounts,
    selectedAccountId,
    setSelectedAccountId,
    getEntriesForAccount,
    getAccountSummary,
    getTodaySummary,
    recordReceipt,
    recordPayment,
    recordTransfer,
    recordCashCount,
  } = useCashbook();
  const { showToast } = useToast();

  const isTreasurer = currentUser.role === 'Treasurer' || currentUser.role === 'Admin';
  const isFinanceSec = currentUser.role === 'Finance Secretary';
  const canEnter = isTreasurer || isFinanceSec;

  // Module Underline Navigation: Cashbook Ledger | Bank Reconciliation | Cheque Register
  const [moduleTab, setModuleTab] = useState<'ledger' | 'reconciliation' | 'cheques'>('ledger');

  // Active Account Tab
  const activeAccount = useMemo(() => {
    return cashAccounts.find((a) => a.id === selectedAccountId) || cashAccounts[0]!;
  }, [cashAccounts, selectedAccountId]);

  // Filters State
  const [periodPreset, setPeriodPreset] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'AUG_2026' | 'ALL'>('THIS_MONTH');
  const customFromDate = '2026-10-01';
  const customToDate = '2026-10-31';
  const [selectedFundId, setSelectedFundId] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalysedView, setIsAnalysedView] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Selected Entry for Detail Drawer
  const [selectedEntry, setSelectedEntry] = useState<CashbookEntry | null>(null);

  // Modals / Slide-Over State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCashCountModalOpen, setIsCashCountModalOpen] = useState(false);

  // Receipt Form State
  const [receiptFrom, setReceiptFrom] = useState('');
  const [receiptDate, setReceiptDate] = useState('2026-10-25');
  const [receiptFundId, setReceiptFundId] = useState('fund-gen');
  const [receiptIncomeAccountId, setReceiptIncomeAccountId] = useState('acct-4010');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<CashbookEntry['method']>('CASH');
  const [receiptRef, setReceiptRef] = useState(`RC-202610-${Math.floor(1000 + Math.random() * 9000)}`);
  const [receiptNarration, setReceiptNarration] = useState('');

  // Payment Form State
  const [paidTo, setPaidTo] = useState('');
  const [paymentDate, setPaymentDate] = useState('2026-10-28');
  const [linkedVoucher, setLinkedVoucher] = useState('PV-202610-0014');
  const [isVoucherExempt, setIsVoucherExempt] = useState(false);
  const [voucherExemptReason, setVoucherExemptReason] = useState('');
  const [paymentFundId, setPaymentFundId] = useState('fund-gen');
  const [paymentExpenseAccountId, setPaymentExpenseAccountId] = useState('acct-5020');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CashbookEntry['method']>('CHEQUE');
  const [chequeNumber, setChequeNumber] = useState('000396');
  const [paymentNarration, setPaymentNarration] = useState('');
  const [paymentOverrideReason, setPaymentOverrideReason] = useState('');

  // Transfer Form State
  const [transferToAccountId, setTransferToAccountId] = useState('ca-bank-ghs');
  const [transferDate, setTransferDate] = useState('2026-10-26');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDestAmount, setTransferDestAmount] = useState('');
  const [transferRate, setTransferRate] = useState('15.5000');
  const [transferFundId, setTransferFundId] = useState('fund-gen');
  const [transferRef, setTransferRef] = useState(`TR-202610-${Math.floor(1000 + Math.random() * 9000)}`);
  const [transferNarration, setTransferNarration] = useState('');

  // Cash Count Denominations State
  const [denominations, setDenominations] = useState<{ [denom: number]: number }>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
    0.5: 0,
    0.2: 0,
    0.1: 0,
  });
  const [cashCountReason, setCashCountReason] = useState('');
  const [countWitnessName, setCountWitnessName] = useState('Akosua Osei');
  const countWitnessRole = 'Finance Secretary';

  // Filter Computation
  const activeFilter = useMemo<CashbookFilter>(() => {
    let from: string | undefined = customFromDate;
    let to: string | undefined = customToDate;

    if (periodPreset === 'THIS_MONTH') {
      from = '2026-10-01';
      to = '2026-10-31';
    } else if (periodPreset === 'LAST_MONTH') {
      from = '2026-09-01';
      to = '2026-09-30';
    } else if (periodPreset === 'AUG_2026') {
      from = '2026-08-01';
      to = '2026-08-31';
    } else if (periodPreset === 'ALL') {
      from = undefined;
      to = undefined;
    }

    return {
      fromDate: from,
      toDate: to,
      fundId: selectedFundId,
      source: selectedSource,
      search: searchQuery,
    };
  }, [periodPreset, customFromDate, customToDate, selectedFundId, selectedSource, searchQuery]);

  // Account Entries and Summary
  const accountEntries = useMemo(() => {
    return getEntriesForAccount(activeAccount.id, activeFilter);
  }, [getEntriesForAccount, activeAccount.id, activeFilter]);

  const summary = useMemo(() => {
    return getAccountSummary(activeAccount.id, activeFilter);
  }, [getAccountSummary, activeAccount.id, activeFilter]);

  const todaySummary = useMemo(() => {
    return getTodaySummary();
  }, [getTodaySummary]);

  // Analysed Summary Computation
  const analysedSummary = useMemo(() => {
    return computeAnalysedCashbook(accountEntries, summary.openingBalance);
  }, [accountEntries, summary.openingBalance]);

  // Income & Expense Accounts for Dropdowns
  const incomeAccounts = useMemo(() => accounts.filter((a) => a.type === 'Income'), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === 'Expense'), [accounts]);

  // Format Helper for Currency Display
  const formatMoney = (val: bigint, _curr: 'GHS' | 'USD' = 'GHS') => {
    const num = Number(val) / 100;
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Handlers for Forms
  const handleRecordReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(receiptAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast('Please enter a valid receipt amount', 'error');
      return;
    }

    const fund = funds.find((f) => f.id === receiptFundId) || funds[0]!;
    const incomeAccount = accounts.find((a) => a.id === receiptIncomeAccountId) || incomeAccounts[0]!;
    const minorUnits = BigInt(Math.round(amtNum * 100));

    try {
      recordReceipt({
        cashAccount: activeAccount,
        entryDate: receiptDate,
        receivedFrom: receiptFrom.trim(),
        fund,
        incomeAccount,
        amount: minorUnits,
        method: receiptMethod,
        refNumber: receiptRef.trim(),
        narration: receiptNarration.trim(),
      });

      showToast(`Receipt ${receiptRef} recorded successfully and posted to ledger`, 'success');
      setIsReceiptModalOpen(false);
      setReceiptAmount('');
      setReceiptFrom('');
      setReceiptNarration('');
      setReceiptRef(`RC-202610-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to record receipt', 'error');
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(paymentAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    const fund = funds.find((f) => f.id === paymentFundId) || funds[0]!;
    const expenseAccount = accounts.find((a) => a.id === paymentExpenseAccountId) || expenseAccounts[0]!;
    const minorUnits = BigInt(Math.round(amtNum * 100));

    try {
      recordPayment({
        cashAccount: activeAccount,
        entryDate: paymentDate,
        paidTo: paidTo.trim(),
        linkedVoucherId: isVoucherExempt ? undefined : linkedVoucher.trim(),
        isVoucherExempt,
        voucherExemptReason: isVoucherExempt ? voucherExemptReason.trim() : undefined,
        fund,
        expenseAccount,
        amount: minorUnits,
        method: paymentMethod,
        chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : undefined,
        narration: paymentNarration.trim(),
        treasurerOverride: paymentOverrideReason.trim()
          ? {
              isOverridden: true,
              reason: paymentOverrideReason.trim(),
              authorizedBy: currentUser.fullName,
            }
          : null,
      });

      showToast(`Payment recorded successfully and posted to ledger`, 'success');
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaidTo('');
      setPaymentNarration('');
      setPaymentOverrideReason('');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to record payment', 'error');
    }
  };

  const handleRecordTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(transferAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast('Please enter a valid transfer amount', 'error');
      return;
    }

    const toAccount = cashAccounts.find((a) => a.id === transferToAccountId);
    if (!toAccount) {
      showToast('Please select a valid destination account', 'error');
      return;
    }

    if (toAccount.id === activeAccount.id) {
      showToast('Source and destination accounts must be different', 'error');
      return;
    }

    const fund = funds.find((f) => f.id === transferFundId) || funds[0]!;
    const fxAccount = accounts.find((a) => a.code === '5980') || accounts.find((a) => a.type === 'Expense');
    const minorUnits = BigInt(Math.round(amtNum * 100));

    let destMinorUnits: bigint | undefined = undefined;
    if (transferDestAmount) {
      const destNum = parseFloat(transferDestAmount);
      if (!isNaN(destNum) && destNum > 0) {
        destMinorUnits = BigInt(Math.round(destNum * 100));
      }
    }

    try {
      recordTransfer({
        fromAccount: activeAccount,
        toAccount,
        entryDate: transferDate,
        amount: minorUnits,
        destinationAmount: destMinorUnits,
        exchangeRate: transferRate,
        fund,
        fxGainLossAccount: fxAccount,
        refNumber: transferRef.trim(),
        narration: transferNarration.trim(),
      });

      showToast(`Transfer ${transferRef} recorded and posted between accounts`, 'success');
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferDestAmount('');
      setTransferNarration('');
      setTransferRef(`TR-202610-${Math.floor(1000 + Math.random() * 9000)}`);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to record transfer', 'error');
    }
  };

  // Cash Count Calculations
  const calculatedPhysicalPesewas = useMemo(() => {
    let sum = 0n;
    for (const [denomStr, count] of Object.entries(denominations)) {
      const denom = parseFloat(denomStr);
      const valPesewas = Math.round(denom * 100);
      sum += BigInt(valPesewas) * BigInt(count || 0);
    }
    return sum;
  }, [denominations]);

  const countDifference = calculatedPhysicalPesewas - summary.closingBalance;

  const handleSaveCashCount = (e: React.FormEvent) => {
    e.preventDefault();
    if (countDifference !== 0n && !cashCountReason.trim()) {
      showToast('Please enter an explanatory reason for the cash count difference', 'error');
      return;
    }

    const lines: CashCountLine[] = Object.entries(denominations)
      .filter(([_, qty]) => qty > 0)
      .map(([denomStr, qty]) => {
        const denom = parseFloat(denomStr);
        const lineTotal = BigInt(Math.round(denom * 100)) * BigInt(qty);
        return {
          denomination: denom,
          quantity: qty,
          lineTotal,
        };
      });

    recordCashCount({
      cashAccountId: activeAccount.id,
      countDate: new Date().toISOString().slice(0, 10),
      countTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      physicalBalance: calculatedPhysicalPesewas,
      reason: cashCountReason.trim() || undefined,
      firstSignatory: {
        userId: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
        signedAt: new Date().toISOString(),
      },
      secondSignatory: {
        userId: 'usr-sign-02',
        fullName: countWitnessName,
        role: countWitnessRole,
        signedAt: new Date().toISOString(),
      },
      lines,
    });

    showToast('Physical cash count recorded and verified with dual signatures', 'success');
    setIsCashCountModalOpen(false);
    setCashCountReason('');
  };

  // Export Handlers
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    setIsExportMenuOpen(false);
    const headers = isAnalysedView
      ? ['Date', 'Ref', 'Details', 'Receipts', 'Tithes', 'Offerings', 'Payments', 'Salaries', 'Utilities', 'Balance']
      : ['Date', 'Ref', 'Details', 'Fund', 'Counterpart Account', 'Receipts', 'Payments', 'Balance'];

    const rows = accountEntries.map((e) => {
      const rAmt = e.direction === 'RECEIPT' ? (Number(e.amount) / 100).toFixed(2) : '';
      const pAmt = e.direction === 'PAYMENT' ? (Number(e.amount) / 100).toFixed(2) : '';
      const bAmt = e.runningBalance !== undefined ? (Number(e.runningBalance) / 100).toFixed(2) : '';

      if (isAnalysedView) {
        return [
          e.entryDate,
          e.refNumber,
          e.details,
          rAmt,
          e.category === 'Tithes' ? rAmt : '',
          e.category === 'Offerings' ? rAmt : '',
          pAmt,
          e.category === 'Salaries' ? pAmt : '',
          e.category === 'Utilities' ? pAmt : '',
          bAmt,
        ];
      }
      return [
        e.entryDate,
        e.refNumber,
        e.details,
        e.fundCode,
        e.counterpartAccountName,
        rAmt,
        pAmt,
        bAmt,
      ];
    });

    const filename = `Cashbook_${activeAccount.code}_${activeFilter.fromDate || 'all'}`;

    if (format === 'csv') {
      const csvStr = generateCsv(headers, rows);
      downloadCsv(filename, csvStr);
      showToast('Cashbook exported as CSV', 'success');
    } else if (format === 'excel') {
      const columns = headers.map((h, i) => ({
        header: h,
        key: `col_${i}`,
        width: 18,
      }));
      const data = rows.map((r) => {
        const rowObj: Record<string, any> = {};
        r.forEach((val, i) => {
          rowObj[`col_${i}`] = val;
        });
        return rowObj;
      });
      exportReportToExcel({
        filename,
        sheetName: 'Cashbook',
        reportTitle: `Cashbook — ${activeAccount.name}`,
        periodText: activeFilter.fromDate ? `${activeFilter.fromDate} to ${activeFilter.toDate}` : 'All Dates',
        currency: activeAccount.currency,
        columns,
        data,
      });
      showToast('Cashbook exported as Excel spreadsheet', 'success');
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Module Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--surface-border)] pb-2">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Cashbook
          </h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Book of original entry for cash, bank accounts, and mobile money.
          </p>
        </div>

        {/* Primary & Secondary Actions Toolbar (Visible on Ledger tab) */}
        {moduleTab === 'ledger' && (
          <div className="flex items-center gap-2 flex-wrap">
            {canEnter && (
              <button
                onClick={() => {
                  setIsReceiptModalOpen(true);
                  try {
                    navigate('#/cashbook/new-receipt');
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-[13px] shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Receipt</span>
              </button>
            )}

            {canEnter && (
              <button
                onClick={() => {
                  setIsPaymentModalOpen(true);
                  try {
                    navigate('#/cashbook/new-payment');
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--surface-border)] font-medium text-[13px] shadow-xs transition"
              >
                <Minus className="w-4 h-4 text-rose-600" />
                <span>Payment</span>
              </button>
            )}

            {canEnter && (
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--surface-border)] font-medium text-[13px] shadow-xs transition"
              >
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                <span>Transfer</span>
              </button>
            )}

            {activeAccount.kind === 'cash' && canEnter && (
              <button
                onClick={() => setIsCashCountModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--surface-border)] font-medium text-[13px] shadow-xs transition"
              >
                <Calculator className="w-4 h-4 text-[var(--accent)]" />
                <span>Cash count</span>
              </button>
            )}

            {/* Analysed View Toggle */}
            <button
              onClick={() => setIsAnalysedView(!isAnalysedView)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium border border-[var(--surface-border)] transition ${
                isAnalysedView
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-[var(--accent)]'
                  : 'bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
              }`}
              title="Toggle between standard running balance and analysed multi-column cashbook"
            >
              <Layers className="w-4 h-4" />
              <span>{isAnalysedView ? 'Standard view' : 'Analysed view'}</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--surface-border)] font-medium text-[13px] shadow-xs transition"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-36 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-lg py-1 z-30 text-[13px]">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-rose-600" /> Print / PDF
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-blue-600" /> CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Primary Module Underline Tabs */}
      <UnderlineTabs
        tabs={[
          { id: 'ledger', label: 'Cashbook Ledger' },
          { id: 'reconciliation', label: 'Bank Reconciliation' },
          { id: 'cheques', label: 'Cheque Register' },
        ]}
        activeTab={moduleTab}
        onChange={(id) => setModuleTab(id as any)}
      />

      {/* Module Views */}
      {moduleTab === 'reconciliation' && <BankReconciliationTab />}
      {moduleTab === 'cheques' && <ChequeRegisterTab />}

      {moduleTab === 'ledger' && (
        <>
          {/* Account Underline Tabs (Cash GHS · Cash USD · Bank GHS · Bank USD · MoMo · Petty cash) */}
          <UnderlineTabs
            tabs={cashAccounts.map((a) => ({
              id: a.id,
              label: a.name.replace(' (Imprest)', '').replace(' Account', '').replace(' Wallet', ''),
            }))}
            activeTab={selectedAccountId}
            onChange={(id) => setSelectedAccountId(id)}
          />

          {/* Account Meta & Bank details strip */}
          {activeAccount.bankName && (
            <div className="text-[12px] text-[var(--text-muted)] flex items-center justify-between gap-4 px-1 flex-wrap">
              <div className="flex items-center gap-4 flex-wrap">
                <span>
                  <strong>Bank:</strong> {activeAccount.bankName} ({activeAccount.branchName})
                </span>
                <span>
                  <strong>Account number:</strong>{' '}
                  <span className="font-mono text-[var(--text-secondary)]">
                    {activeAccount.accountNumberMasked}
                  </span>
                </span>
                <span>
                  <strong>Overdraft permitted:</strong> {activeAccount.allowOverdraft ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModuleTab('reconciliation')}
                  className="px-2 py-0.5 text-[11px] font-medium rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] text-[var(--text-primary)] transition"
                >
                  Reconcile account →
                </button>
                <button
                  onClick={() => setModuleTab('cheques')}
                  className="px-2 py-0.5 text-[11px] font-medium rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] text-[var(--text-primary)] transition"
                >
                  Cheque register →
                </button>
              </div>
            </div>
          )}

      {/* Controls Bar: Periods, Fund Filter, Source Filter, Search */}
      <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] font-medium">Period:</span>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as any)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium"
            >
              <option value="THIS_MONTH">October 2026 (This Month)</option>
              <option value="LAST_MONTH">September 2026</option>
              <option value="AUG_2026">August 2026</option>
              <option value="ALL">All Recorded Dates</option>
            </select>
          </div>

          {/* Fund Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] font-medium">Fund:</span>
            <select
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium"
            >
              <option value="ALL">All funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] font-medium">Source:</span>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium"
            >
              <option value="ALL">All sources</option>
              <option value="COUNTING_SHEET">From counting sheet</option>
              <option value="VOUCHER">From payment voucher</option>
              <option value="TRANSFER">Inter-account transfer</option>
              <option value="GIVING">Member giving / Tithes</option>
              <option value="MANUAL">Manual cashbook entry</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref, payee, account..."
            className="w-full pl-8 pr-3 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>
      </div>

      {/* Plain Accounting Status Line (Section 1.3: No cards) */}
      <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--text-muted)]">Opening balance:</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {activeAccount.currency} {formatMoney(summary.openingBalance, activeAccount.currency)}
          </span>
          <span className="text-[var(--surface-border)] mx-1">·</span>
          <span className="text-[var(--text-muted)]">Receipts:</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {formatMoney(summary.totalReceipts, activeAccount.currency)}
          </span>
          <span className="text-[var(--surface-border)] mx-1">·</span>
          <span className="text-[var(--text-muted)]">Payments:</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            {formatMoney(summary.totalPayments, activeAccount.currency)}
          </span>
          <span className="text-[var(--surface-border)] mx-1">·</span>
          <span className="text-[var(--text-muted)]">Closing balance:</span>
          <span className="font-bold tabular-nums text-[var(--text-primary)]">
            {activeAccount.currency} {formatMoney(summary.closingBalance, activeAccount.currency)}
          </span>
        </div>

        {/* Daily cash summary mini-strip */}
        <div className="text-[12px] text-[var(--text-muted)]">
          Today: Receipts GHS {formatMoney(todaySummary.todayReceiptsGhs)} · Payments GHS{' '}
          {formatMoney(todaySummary.todayPaymentsGhs)}
        </div>
      </div>

      {/* Main Table: Standard Running Balance Format or Analysed View */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-x-auto shadow-xs">
        {!isAnalysedView ? (
          /* =========================================================================
             STANDARD SINGLE RUNNING-BALANCE VIEW
             Columns: Date · Ref · Details · Fund · Account (other side) · Receipts · Payments · Balance
             ========================================================================= */
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-semibold text-left">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Ref</th>
                <th className="py-2.5 px-3">Details / Narration</th>
                <th className="py-2.5 px-3">Fund</th>
                <th className="py-2.5 px-3">Account (Counterpart)</th>
                <th className="py-2.5 px-3 text-right">Receipts ({activeAccount.currency})</th>
                <th className="py-2.5 px-3 text-right">Payments ({activeAccount.currency})</th>
                <th className="py-2.5 px-3 text-right">Balance ({activeAccount.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {accountEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No transactions recorded for this account and period.
                  </td>
                </tr>
              ) : (
                accountEntries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEntry(e)}
                    className="hover:bg-[var(--surface-subtle)] cursor-pointer transition"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                      {e.entryDate}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[var(--text-primary)]">
                      {e.refNumber}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-primary)] max-w-md truncate">
                      {e.details}
                      {e.linkedCountingSheetId && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                          Counting sheet
                        </span>
                      )}
                      {e.linkedVoucherId && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          Voucher
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                        {e.fundCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] truncate max-w-xs">
                      {e.counterpartAccountName}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-medium">
                      {e.direction === 'RECEIPT' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)] font-medium">
                      {e.direction === 'PAYMENT' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                      {e.runningBalance !== undefined
                        ? formatMoney(e.runningBalance, activeAccount.currency)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {accountEntries.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)] font-bold text-[13px]">
                  <td colSpan={5} className="py-2.5 px-3 text-[var(--text-primary)]">
                    Total Movement and Closing Balance
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                    {formatMoney(summary.totalReceipts, activeAccount.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                    {formatMoney(summary.totalPayments, activeAccount.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-primary)]">
                    {formatMoney(summary.closingBalance, activeAccount.currency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          /* =========================================================================
             ANALYSED MULTI-COLUMN CASHBOOK VIEW
             ========================================================================= */
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-semibold text-left">
                <th className="py-2 px-2.5">Date</th>
                <th className="py-2 px-2.5">Ref</th>
                <th className="py-2 px-2.5">Details</th>
                <th className="py-2 px-2 text-right bg-emerald-50/50 dark:bg-emerald-950/20 font-bold">
                  Total Receipts
                </th>
                <th className="py-2 px-2 text-right">Tithes</th>
                <th className="py-2 px-2 text-right">Offerings</th>
                <th className="py-2 px-2 text-right">Special</th>
                <th className="py-2 px-2 text-right">Other In</th>
                <th className="py-2 px-2 text-right bg-rose-50/50 dark:bg-rose-950/20 font-bold">
                  Total Payments
                </th>
                <th className="py-2 px-2 text-right">Salaries</th>
                <th className="py-2 px-2 text-right">Utilities</th>
                <th className="py-2 px-2 text-right">Maintenance</th>
                <th className="py-2 px-2 text-right">Other Out</th>
                <th className="py-2 px-2.5 text-right font-bold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {accountEntries.map((e) => {
                const isR = e.direction === 'RECEIPT';
                const isP = e.direction === 'PAYMENT';
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEntry(e)}
                    className="hover:bg-[var(--surface-subtle)] cursor-pointer transition"
                  >
                    <td className="py-2 px-2.5 whitespace-nowrap text-[var(--text-secondary)]">
                      {e.entryDate}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap font-medium text-[var(--text-primary)]">
                      {e.refNumber}
                    </td>
                    <td className="py-2 px-2.5 text-[var(--text-primary)] max-w-xs truncate">
                      {e.details}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold tabular-nums bg-emerald-50/30 dark:bg-emerald-950/10">
                      {isR ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isR && e.category === 'Tithes' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isR && (e.category === 'Offerings' || e.category === 'General Offerings')
                        ? formatMoney(e.amount, activeAccount.currency)
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isR && e.category === 'Special' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isR &&
                      e.category !== 'Tithes' &&
                      e.category !== 'Offerings' &&
                      e.category !== 'General Offerings' &&
                      e.category !== 'Special'
                        ? formatMoney(e.amount, activeAccount.currency)
                        : '—'}
                    </td>

                    <td className="py-2 px-2 text-right font-semibold tabular-nums bg-rose-50/30 dark:bg-rose-950/10">
                      {isP ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isP && e.category === 'Salaries' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isP && e.category === 'Utilities' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isP && e.category === 'Maintenance' ? formatMoney(e.amount, activeAccount.currency) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {isP &&
                      e.category !== 'Salaries' &&
                      e.category !== 'Utilities' &&
                      e.category !== 'Maintenance'
                        ? formatMoney(e.amount, activeAccount.currency)
                        : '—'}
                    </td>

                    <td className="py-2 px-2.5 text-right font-bold tabular-nums text-[var(--text-primary)]">
                      {e.runningBalance !== undefined
                        ? formatMoney(e.runningBalance, activeAccount.currency)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)] font-bold text-[12px]">
                <td colSpan={3} className="py-2 px-2.5">
                  Analysed Totals
                </td>
                <td className="py-2 px-2 text-right tabular-nums bg-emerald-100/50 dark:bg-emerald-950/30">
                  {formatMoney(analysedSummary.totalReceipts, activeAccount.currency)}
                </td>
                <td colSpan={4} className="py-2 px-2 text-right text-[var(--text-muted)] font-normal italic">
                  Columns tie to receipts
                </td>
                <td className="py-2 px-2 text-right tabular-nums bg-rose-100/50 dark:bg-rose-950/30">
                  {formatMoney(analysedSummary.totalPayments, activeAccount.currency)}
                </td>
                <td colSpan={4} className="py-2 px-2 text-right text-[var(--text-muted)] font-normal italic">
                  Columns tie to payments
                </td>
                <td className="py-2 px-2.5 text-right tabular-nums">
                  {formatMoney(analysedSummary.closingBalance, activeAccount.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      </>
      )}

      {/* =========================================================================
          SLIDE-OVER DETAIL PANEL (Row click on Cashbook Table)
         ========================================================================= */}
      <SlideOverPanel
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry ? `Cashbook Entry: ${selectedEntry.refNumber}` : ''}
        subtitle="Full original entry details and double-entry general ledger posting"
      >
        {selectedEntry && (
          <div className="space-y-4 text-[13px]">
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Transaction type:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedEntry.direction}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Amount ({activeAccount.currency}):</span>
                <span className="font-bold tabular-nums text-base text-[var(--text-primary)]">
                  {activeAccount.currency} {formatMoney(selectedEntry.amount, activeAccount.currency)}
                </span>
              </div>
              {Boolean(selectedEntry.amountGhs) && activeAccount.currency !== 'GHS' && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text-muted)]">GHS Equivalent:</span>
                  <span className="font-sans tabular-nums text-[var(--text-secondary)]">
                    GHS {formatMoney(selectedEntry.amountGhs ?? 0n, 'GHS')} (Rate: {selectedEntry.exchangeRate})
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Payment method:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {selectedEntry.method}
                  {selectedEntry.chequeNumber && ` (Cheque #${selectedEntry.chequeNumber})`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[var(--text-muted)] font-semibold text-[11px] uppercase tracking-wider">
                Ledger Accounts & Fund
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Cash account:</span>
                  <span className="font-medium text-[var(--text-primary)]">{activeAccount.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Counterpart account:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedEntry.counterpartAccountName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Fund:</span>
                  <span className="font-medium text-[var(--text-primary)]">{selectedEntry.fundCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Category:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {selectedEntry.category || 'General'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[var(--text-muted)] font-semibold text-[11px] uppercase tracking-wider">
                Full Details / Narration
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] leading-relaxed">
                {selectedEntry.details}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[var(--text-muted)] font-semibold text-[11px] uppercase tracking-wider">
                Audit & Source Reference
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Source:</span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {selectedEntry.source}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Recorded by:</span>
                  <span className="text-[var(--text-primary)]">{selectedEntry.createdBy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Timestamp:</span>
                  <span className="text-[var(--text-secondary)]">{selectedEntry.createdAt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">General ledger doc:</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {selectedEntry.journalEntryId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SlideOverPanel>

      {/* =========================================================================
          RECEIPT SLIDE-OVER MODAL (Section 1.4)
         ========================================================================= */}
      <SlideOverPanel
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Record Cashbook Receipt"
        subtitle={`Dr ${activeAccount.name} · Cr Income account · Balanced double-entry`}
      >
        <form onSubmit={handleRecordReceipt} className="space-y-4 text-[13px]">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Cash account
            </label>
            <input
              type="text"
              readOnly
              value={`${activeAccount.name} (${activeAccount.currency})`}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Receipt date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Receipt number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Received from <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={receiptFrom}
              onChange={(e) => setReceiptFrom(e.target.value)}
              placeholder="e.g. Brother Emmanuel Ofori / Sunday Congregation"
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Fund <span className="text-rose-600">*</span>
              </label>
              <select
                value={receiptFundId}
                onChange={(e) => setReceiptFundId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Income category <span className="text-rose-600">*</span>
              </label>
              <select
                value={receiptIncomeAccountId}
                onChange={(e) => setReceiptIncomeAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Amount ({activeAccount.currency}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-semibold tabular-nums outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Payment method <span className="text-rose-600">*</span>
              </label>
              <select
                value={receiptMethod}
                onChange={(e) => setReceiptMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="MOMO">Mobile Money (MoMo)</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Narration / Notes
            </label>
            <textarea
              rows={2}
              value={receiptNarration}
              onChange={(e) => setReceiptNarration(e.target.value)}
              placeholder="e.g. October tithes envelope ENV-042"
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(false)}
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold shadow-xs"
            >
              Record receipt
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* =========================================================================
          PAYMENT SLIDE-OVER MODAL (Section 1.4)
         ========================================================================= */}
      <SlideOverPanel
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Cashbook Payment"
        subtitle={`Dr Expense/Asset account · Cr ${activeAccount.name} · Voucher required`}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-[13px]">
          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Disbursing cash account
            </label>
            <input
              type="text"
              readOnly
              value={`${activeAccount.name} (${activeAccount.currency})`}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Payment date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Paid to (Payee) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="e.g. Electricity Company of Ghana / Vendor"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>

          {/* Linked Approved Voucher (Required per Section 1.4) */}
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[var(--text-primary)]">
                Linked approved voucher <span className="text-rose-600">*</span>
              </label>
              <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVoucherExempt}
                  onChange={(e) => setIsVoucherExempt(e.target.checked)}
                  className="rounded border-[var(--surface-border)] text-[var(--accent)]"
                />
                <span>Exempt category (Bank fee, interest, MoMo fee)</span>
              </label>
            </div>

            {!isVoucherExempt ? (
              <div>
                <select
                  value={linkedVoucher}
                  onChange={(e) => setLinkedVoucher(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-mono outline-none"
                >
                  <option value="PV-202610-0014">PV-202610-0014 (Sound Equipment Cable Replacement - Approved)</option>
                  <option value="V-202610-0089">V-202610-0089 (Auditorium ECG Power Bill - Approved)</option>
                  <option value="V-202608-0021">V-202608-0021 (Generator Fuel & Maintenance - Approved)</option>
                  <option value="PV-202610-0045">PV-202610-0045 (Sanitation & Cleaning Supplies - Approved)</option>
                </select>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Payments require an approved voucher to preserve dual-authorization internal controls.
                </p>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  required={isVoucherExempt}
                  value={voucherExemptReason}
                  onChange={(e) => setVoucherExemptReason(e.target.value)}
                  placeholder="Reason for exemption: e.g. Monthly bank ledger maintenance fee"
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[12px] outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Fund <span className="text-rose-600">*</span>
              </label>
              <select
                value={paymentFundId}
                onChange={(e) => setPaymentFundId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Expense / Asset account <span className="text-rose-600">*</span>
              </label>
              <select
                value={paymentExpenseAccountId}
                onChange={(e) => setPaymentExpenseAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Amount ({activeAccount.currency}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-semibold tabular-nums outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Disbursement method <span className="text-rose-600">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                <option value="CHEQUE">Bank Cheque</option>
                <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                <option value="MOMO">Mobile Money</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>

          {paymentMethod === 'CHEQUE' && (
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Cheque number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-mono outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Narration
            </label>
            <textarea
              rows={2}
              value={paymentNarration}
              onChange={(e) => setPaymentNarration(e.target.value)}
              placeholder="e.g. October ECG power bill for main church auditorium"
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
            />
          </div>

          {/* Overdraft warning / Treasurer override input */}
          {isTreasurer && (
            <div className="pt-2">
              <label className="block font-medium text-[var(--text-secondary)] text-[12px] mb-1">
                Treasurer Overdraft Override (if payment exceeds book balance):
              </label>
              <input
                type="text"
                value={paymentOverrideReason}
                onChange={(e) => setPaymentOverrideReason(e.target.value)}
                placeholder="Reason for authorizing negative cash/bank balance..."
                className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[12px]"
              />
            </div>
          )}

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold shadow-xs"
            >
              Disburse payment
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* =========================================================================
          TRANSFER (CONTRA) SLIDE-OVER MODAL (Section 1.4)
         ========================================================================= */}
      <SlideOverPanel
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Inter-Account Transfer (Contra)"
        subtitle="Deposit into bank, cash withdrawal, MoMo cash-in/out, or USD conversion"
      >
        <form onSubmit={handleRecordTransfer} className="space-y-4 text-[13px]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                From account (Source)
              </label>
              <input
                type="text"
                readOnly
                value={`${activeAccount.name} (${activeAccount.currency})`}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                To account (Destination) <span className="text-rose-600">*</span>
              </label>
              <select
                value={transferToAccountId}
                onChange={(e) => setTransferToAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none font-medium"
              >
                {cashAccounts
                  .filter((a) => a.id !== activeAccount.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Transfer date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Reference / Deposit slip <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="e.g. Deposit slip GCB-99201"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-mono outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Amount to transfer ({activeAccount.currency}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-semibold tabular-nums outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-[var(--text-secondary)] mb-1">
                Fund <span className="text-rose-600">*</span>
              </label>
              <select
                value={transferFundId}
                onChange={(e) => setTransferFundId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cross-Currency Conversion Info when currencies differ */}
          {activeAccount.currency !==
            (cashAccounts.find((a) => a.id === transferToAccountId)?.currency ?? 'GHS') && (
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
              <div className="text-[12px] font-bold text-[var(--text-primary)]">
                Foreign Exchange Rate & Conversion
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                    Exchange rate
                  </label>
                  <input
                    type="text"
                    value={transferRate}
                    onChange={(e) => setTransferRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-mono text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                    Destination amount received (if adjusted by bank)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferDestAmount}
                    onChange={(e) => setTransferDestAmount(e.target.value)}
                    placeholder="Auto-calculated if left blank"
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-semibold tabular-nums text-[13px]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Any difference between calculated value and actual bank credit will be posted to Foreign exchange gain or loss.
              </p>
            </div>
          )}

          <div>
            <label className="block font-medium text-[var(--text-secondary)] mb-1">
              Narration
            </label>
            <textarea
              rows={2}
              value={transferNarration}
              onChange={(e) => setTransferNarration(e.target.value)}
              placeholder="e.g. Deposit of Sunday service cash collection into GCB Bank"
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
            />
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold shadow-xs"
            >
              Execute transfer
            </button>
          </div>
        </form>
      </SlideOverPanel>

      {/* =========================================================================
          CASH COUNT (PHYSICAL DENOMINATION COUNT) MODAL (Section 1.6)
         ========================================================================= */}
      <SlideOverPanel
        isOpen={isCashCountModalOpen}
        onClose={() => setIsCashCountModalOpen(false)}
        title="Physical Cash Count Verification"
        subtitle={`Counted physical notes & coins vs book balance of ${activeAccount.name}`}
      >
        <form onSubmit={handleSaveCashCount} className="space-y-4 text-[13px]">
          <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[var(--text-muted)] uppercase font-semibold">
                Ledger Book Balance
              </div>
              <div className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                {activeAccount.currency} {formatMoney(summary.closingBalance, activeAccount.currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--text-muted)] uppercase font-semibold">
                Physical Cash Counted
              </div>
              <div className="text-base font-bold text-[var(--accent)] tabular-nums">
                {activeAccount.currency} {formatMoney(calculatedPhysicalPesewas, activeAccount.currency)}
              </div>
            </div>
          </div>

          {/* Variance Notice */}
          <div
            className={`p-3 rounded-[var(--radius-sm)] border flex items-center justify-between text-[13px] ${
              countDifference === 0n
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/40'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-200 dark:border-rose-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              {countDifference === 0n ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span className="font-semibold">
                {countDifference === 0n
                  ? 'Cash in safe ties perfectly to ledger balance'
                  : `Discrepancy: ${countDifference > 0n ? 'Surplus' : 'Shortage'} of ${activeAccount.currency} ${formatMoney(
                      countDifference > 0n ? countDifference : -countDifference,
                      activeAccount.currency
                    )}`}
              </span>
            </div>
          </div>

          {/* Denomination Table */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius-sm)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-semibold text-[var(--text-muted)]">
                <tr>
                  <th className="py-1.5 px-3 text-left">Denomination</th>
                  <th className="py-1.5 px-3 text-center w-28">Quantity</th>
                  <th className="py-1.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {[200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1].map((denom) => {
                  const qty = denominations[denom] || 0;
                  const lineTotal = BigInt(Math.round(denom * 100)) * BigInt(qty);
                  return (
                    <tr key={denom}>
                      <td className="py-1.5 px-3 font-medium text-[var(--text-primary)]">
                        {denom >= 1 ? `GHS ${denom}.00 note` : `${Math.round(denom * 100)} Pesewas coin`}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={qty || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setDenominations((prev) => ({ ...prev, [denom]: val }));
                          }}
                          className="w-20 px-2 py-0.5 text-center font-mono border border-[var(--surface-border)] rounded-[var(--radius-sm)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                        {formatMoney(lineTotal, 'GHS')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {countDifference !== 0n && (
            <div>
              <label className="block font-medium text-rose-700 dark:text-rose-400 mb-1">
                Reason for variance <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={cashCountReason}
                onChange={(e) => setCashCountReason(e.target.value)}
                placeholder="Explanatory note for cash surplus or shortage (reviewed by Treasurer)..."
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] outline-none"
              />
            </div>
          )}

          {/* Dual Signatures */}
          <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Dual Signatories (Two Counter Rule)
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <span className="text-[var(--text-muted)]">First verifier:</span>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                  {currentUser.fullName} ({currentUser.role})
                </div>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-0.5">Second witness:</label>
                <input
                  type="text"
                  required
                  value={countWitnessName}
                  onChange={(e) => setCountWitnessName(e.target.value)}
                  className="w-full px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCashCountModalOpen(false)}
              className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold shadow-xs"
            >
              Sign and post count
            </button>
          </div>
        </form>
      </SlideOverPanel>
    </div>
  );
};
