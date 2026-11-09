import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  Printer,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useCashbook } from '../../context/CashbookContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  calculateBankReconciliation,
  validateBankReconciliationSignoff,
  autoMatchStatementLines,
  type BankReconciliation,
} from '@church/domain';
import { generateCsv, downloadCsv } from '../../utils/exports/csv.js';
import { exportReportToExcel } from '../../utils/exports/excel.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const BankReconciliationTab: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    cashAccounts,
    entries,
    reconciliations,
    statementLines,
    saveReconciliation,
    prepareReconciliation,
    approveReconciliation,
    toggleClearedEntry,
    importStatementLines,
  } = useCashbook();
  const { showToast } = useToast();

  const isTreasurer = currentUser.role === 'Treasurer' || currentUser.role === 'Admin';
  const isFinanceSec = currentUser.role === 'Finance Secretary';

  // Bank accounts eligible for reconciliation (bank + mobile money)
  const bankAccounts = useMemo(
    () => cashAccounts.filter((a) => a.kind === 'bank' || a.kind === 'mobile'),
    [cashAccounts]
  );

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    bankAccounts[0]?.id || 'ca-bank-ghs'
  );

  const activeBankAccount = useMemo(
    () => bankAccounts.find((a) => a.id === selectedBankAccountId) || bankAccounts[0]!,
    [bankAccounts, selectedBankAccountId]
  );

  // Statement period / date
  const [statementDate, setStatementDate] = useState<string>('2026-10-31');
  const [statementBalanceInput, setStatementBalanceInput] = useState<string>('107100.00');
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCleared, setFilterCleared] = useState<'ALL' | 'CLEARED' | 'UNCLEARED'>('ALL');

  useModalEscape(isCsvImportOpen, () => {
    setIsCsvImportOpen(false);
  });

  // Find existing reconciliation for this account & period
  const existingRec = useMemo(() => {
    return reconciliations.find(
      (r) =>
        r.bankAccountId === activeBankAccount.id &&
        r.statementDate.slice(0, 7) === statementDate.slice(0, 7)
    );
  }, [reconciliations, activeBankAccount.id, statementDate]);

  // Cleared IDs set
  const clearedSet = useMemo(() => {
    if (existingRec) {
      return new Set(existingRec.clearedEntryIds);
    }
    // Default cleared entries for October demo:
    return new Set(['cb-aug-dep-in', 'cb-aug-ecg', 'cb-sep-usd-in', 'cb-oct-rc-bld']);
  }, [existingRec]);

  // Bank entries up to statement date
  const accountEntries = useMemo(() => {
    return entries
      .filter((e) => e.cashAccountId === activeBankAccount.id && e.entryDate <= statementDate)
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  }, [entries, activeBankAccount.id, statementDate]);

  // Current parsed statement ending balance in pesewas/cents
  const parsedStatementEndingPesewas = useMemo(() => {
    const num = parseFloat(statementBalanceInput);
    if (isNaN(num)) return 0n;
    return BigInt(Math.round(num * 100));
  }, [statementBalanceInput]);

  // Perform standard reconciliation calculation
  const recResult = useMemo(() => {
    return calculateBankReconciliation(
      parsedStatementEndingPesewas,
      accountEntries,
      clearedSet,
      activeBankAccount.openingBalance
    );
  }, [parsedStatementEndingPesewas, accountEntries, clearedSet, activeBankAccount.openingBalance]);

  // Filtered entries for table
  const displayedEntries = useMemo(() => {
    return accountEntries.filter((e) => {
      const isCleared = clearedSet.has(e.id);
      if (filterCleared === 'CLEARED' && !isCleared) return false;
      if (filterCleared === 'UNCLEARED' && isCleared) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.refNumber.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.counterpartAccountName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accountEntries, clearedSet, filterCleared, searchQuery]);

  // Format money helper
  const formatMoney = (val: bigint) => {
    const num = Number(val) / 100;
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Toggle single item clearance
  const handleToggleCleared = (entryId: string) => {
    if (existingRec?.status === 'APPROVED') {
      showToast('Approved reconciliations are locked. Re-open or create a reversal to modify.', 'warning');
      return;
    }

    if (existingRec) {
      toggleClearedEntry(existingRec.id, entryId);
    } else {
      // Create new draft reconciliation
      const newCleared = new Set(clearedSet);
      if (newCleared.has(entryId)) {
        newCleared.delete(entryId);
      } else {
        newCleared.add(entryId);
      }
      const newRec: BankReconciliation = {
        id: `rec-${activeBankAccount.id}-${statementDate.slice(0, 7)}`,
        branchId: activeBankAccount.branchId,
        bankAccountId: activeBankAccount.id,
        statementDate,
        statementEndingBalance: parsedStatementEndingPesewas,
        cashbookClosingBalance: recResult.cashbookClosingBalance,
        depositsInTransit: recResult.depositsInTransit,
        unpresentedCheques: recResult.unpresentedCheques,
        adjustedBankBalance: recResult.adjustedBankBalance,
        variance: recResult.variance,
        clearedEntryIds: Array.from(newCleared),
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveReconciliation(newRec);
    }
  };

  // Clear all or un-clear all
  const handleClearAll = (shouldClear: boolean) => {
    if (existingRec?.status === 'APPROVED') return;

    const allIds = shouldClear ? accountEntries.map((e) => e.id) : [];
    const targetRec: BankReconciliation = {
      id: existingRec ? existingRec.id : `rec-${activeBankAccount.id}-${statementDate.slice(0, 7)}`,
      branchId: activeBankAccount.branchId,
      bankAccountId: activeBankAccount.id,
      statementDate,
      statementEndingBalance: parsedStatementEndingPesewas,
      cashbookClosingBalance: recResult.cashbookClosingBalance,
      depositsInTransit: shouldClear ? 0n : recResult.depositsInTransit,
      unpresentedCheques: shouldClear ? 0n : recResult.unpresentedCheques,
      adjustedBankBalance: parsedStatementEndingPesewas,
      variance: parsedStatementEndingPesewas - recResult.cashbookClosingBalance,
      clearedEntryIds: allIds,
      status: 'DRAFT',
      createdAt: existingRec ? existingRec.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveReconciliation(targetRec);
    showToast(shouldClear ? 'All transactions marked cleared' : 'All transactions marked uncleared', 'neutral');
  };

  // Auto-Match with Statement lines
  const handleAutoMatch = () => {
    if (existingRec?.status === 'APPROVED') return;

    const matches = autoMatchStatementLines(statementLines, accountEntries);
    if (matches.length === 0) {
      showToast('No new matching statement lines found for this period.', 'neutral');
      return;
    }

    const matchedEntryIds = new Set(clearedSet);
    matches.forEach((m) => matchedEntryIds.add(m.cashbookEntryId));

    const updatedRec: BankReconciliation = {
      id: existingRec ? existingRec.id : `rec-${activeBankAccount.id}-${statementDate.slice(0, 7)}`,
      branchId: activeBankAccount.branchId,
      bankAccountId: activeBankAccount.id,
      statementDate,
      statementEndingBalance: parsedStatementEndingPesewas,
      cashbookClosingBalance: recResult.cashbookClosingBalance,
      depositsInTransit: recResult.depositsInTransit,
      unpresentedCheques: recResult.unpresentedCheques,
      adjustedBankBalance: recResult.adjustedBankBalance,
      variance: recResult.variance,
      clearedEntryIds: Array.from(matchedEntryIds),
      status: 'DRAFT',
      createdAt: existingRec ? existingRec.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveReconciliation(updatedRec);
    showToast(`Auto-matched and cleared ${matches.length} statement transactions`, 'success');
  };

  // Prepare Sign-off (Finance Secretary)
  const handlePrepare = () => {
    const signoffCheck = validateBankReconciliationSignoff(recResult.variance);
    if (!signoffCheck.isValid) {
      showToast(signoffCheck.error || 'Cannot prepare out-of-balance reconciliation', 'error');
      return;
    }

    const recId = existingRec ? existingRec.id : `rec-${activeBankAccount.id}-${statementDate.slice(0, 7)}`;
    const recToPrepare: BankReconciliation = {
      id: recId,
      branchId: activeBankAccount.branchId,
      bankAccountId: activeBankAccount.id,
      statementDate,
      statementEndingBalance: parsedStatementEndingPesewas,
      cashbookClosingBalance: recResult.cashbookClosingBalance,
      depositsInTransit: recResult.depositsInTransit,
      unpresentedCheques: recResult.unpresentedCheques,
      adjustedBankBalance: recResult.adjustedBankBalance,
      variance: recResult.variance,
      clearedEntryIds: Array.from(clearedSet),
      status: 'PREPARED',
      preparedBy: {
        userId: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
        signedAt: new Date().toISOString(),
      },
      createdAt: existingRec ? existingRec.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveReconciliation(recToPrepare);
    prepareReconciliation(recId, {
      userId: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
      signedAt: new Date().toISOString(),
    });
    showToast('Bank reconciliation prepared and submitted for Treasurer approval', 'success');
  };

  // Approve Sign-off (Treasurer)
  const handleApprove = () => {
    const prepUser = existingRec?.preparedBy?.userId || 'usr-sign-02';
    const signoffCheck = validateBankReconciliationSignoff(recResult.variance, prepUser, currentUser.id);
    if (!signoffCheck.isValid) {
      showToast(signoffCheck.error || 'Cannot approve out-of-balance reconciliation', 'error');
      return;
    }

    const recId = existingRec ? existingRec.id : `rec-${activeBankAccount.id}-${statementDate.slice(0, 7)}`;
    approveReconciliation(recId, {
      userId: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
      signedAt: new Date().toISOString(),
    });
    showToast('Bank reconciliation approved and issued as immutable snapshot', 'success');
  };

  // Process CSV Import
  const handleProcessCsv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      showToast('Please paste CSV text or select a valid file', 'error');
      return;
    }

    const lines = csvText.trim().split('\n');
    const importedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line || (i === 0 && line.toLowerCase().includes('date'))) continue;

      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 3) {
        const dateStr = cols[0]!;
        const desc = cols[1]!;
        const debitOrCredit = parseFloat(cols[2] || '0');
        const creditAmt = debitOrCredit > 0 ? BigInt(Math.round(debitOrCredit * 100)) : undefined;
        const debitAmt = debitOrCredit < 0 ? BigInt(Math.round(Math.abs(debitOrCredit) * 100)) : undefined;

        importedLines.push({
          bankAccountId: activeBankAccount.id,
          statementDate: dateStr,
          description: desc,
          reference: cols[3] || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
          debit: debitAmt,
          credit: creditAmt,
          isMatched: false,
        });
      }
    }

    if (importedLines.length > 0) {
      importStatementLines(activeBankAccount.id, importedLines);
      showToast(`Imported ${importedLines.length} statement lines successfully`, 'success');
      setIsCsvImportOpen(false);
      setCsvText('');
    } else {
      showToast('Could not parse any statement rows from CSV', 'error');
    }
  };

  // Export handlers
  const handleExportStatement = (format: 'pdf' | 'excel' | 'csv') => {
    const filename = `Bank_Reconciliation_${activeBankAccount.code}_${statementDate}`;
    if (format === 'csv') {
      const headers = ['Line', 'Amount GHS'];
      const rows = [
        ['Bank Statement Ending Balance', (Number(recResult.statementEndingBalance) / 100).toFixed(2)],
        ['Add: Deposits in Transit', (Number(recResult.depositsInTransit) / 100).toFixed(2)],
        ['Less: Unpresented Cheques', `-${(Number(recResult.unpresentedCheques) / 100).toFixed(2)}`],
        ['Adjusted Bank Balance', (Number(recResult.adjustedBankBalance) / 100).toFixed(2)],
        ['Cashbook Balance', (Number(recResult.cashbookClosingBalance) / 100).toFixed(2)],
        ['Variance', (Number(recResult.variance) / 100).toFixed(2)],
      ];
      downloadCsv(filename, generateCsv(headers, rows));
      showToast('Exported reconciliation statement as CSV', 'success');
    } else if (format === 'excel') {
      exportReportToExcel({
        filename,
        sheetName: 'Bank Rec',
        reportTitle: `Bank Reconciliation — ${activeBankAccount.name}`,
        periodText: `As at ${statementDate}`,
        currency: activeBankAccount.currency,
        columns: [
          { header: 'Reconciliation Item', key: 'item', width: 35 },
          { header: 'Amount', key: 'amount', width: 20 },
        ],
        data: [
          { item: 'Balance per bank statement', amount: (Number(recResult.statementEndingBalance) / 100).toFixed(2) },
          { item: 'Add: Deposits in transit', amount: (Number(recResult.depositsInTransit) / 100).toFixed(2) },
          { item: 'Less: Unpresented cheques', amount: `(${((Number(recResult.unpresentedCheques) / 100)).toFixed(2)})` },
          { item: 'Adjusted bank balance', amount: (Number(recResult.adjustedBankBalance) / 100).toFixed(2) },
          { item: 'Cashbook closing balance', amount: (Number(recResult.cashbookClosingBalance) / 100).toFixed(2) },
          { item: 'Difference / Variance', amount: (Number(recResult.variance) / 100).toFixed(2) },
        ],
      });
      showToast('Exported reconciliation statement as Excel spreadsheet', 'success');
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bank Account Switcher and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] text-[13px] font-medium">Bank Account:</span>
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium text-[13px]"
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.bankName || a.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] text-[13px] font-medium">Statement Date:</span>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-medium text-[13px]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] text-[13px] font-medium">Statement Ending Balance:</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1 text-[var(--text-muted)] text-[13px]">
                {activeBankAccount.currency}
              </span>
              <input
                type="number"
                step="0.01"
                value={statementBalanceInput}
                onChange={(e) => setStatementBalanceInput(e.target.value)}
                disabled={existingRec?.status === 'APPROVED'}
                className="pl-12 pr-3 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] font-mono text-[13px] w-36 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAutoMatch}
            disabled={existingRec?.status === 'APPROVED'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
            title="Auto-match with imported statement lines by amount and date"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Auto-match</span>
          </button>

          <button
            onClick={() => setIsCsvImportOpen(true)}
            disabled={existingRec?.status === 'APPROVED'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => handleExportStatement('excel')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => handleExportStatement('pdf')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Reconciliation Statement on Top, Clearing Table on Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Standard Bank Reconciliation Statement (Formal Accounting View) */}
        <div className="lg:col-span-1 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] p-4 space-y-4">
          <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[14px] text-[var(--text-primary)]">
                Bank Reconciliation Statement
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                As at {statementDate} ({activeBankAccount.currency})
              </p>
            </div>
            {/* Status dot + text */}
            <span
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                existingRec?.status === 'APPROVED'
                  ? 'text-emerald-700'
                  : existingRec?.status === 'PREPARED'
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  existingRec?.status === 'APPROVED'
                    ? 'bg-emerald-600'
                    : existingRec?.status === 'PREPARED'
                    ? 'bg-blue-600'
                    : 'bg-amber-600'
                }`}
              />
              {existingRec?.status === 'APPROVED'
                ? 'Approved'
                : existingRec?.status === 'PREPARED'
                ? 'Prepared'
                : 'In draft'}
            </span>
          </div>

          {/* Statement Math Lines */}
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between py-1">
              <span className="text-[var(--text-secondary)]">Balance per bank statement:</span>
              <span className="font-mono text-[var(--text-primary)] tabular-nums">
                {formatMoney(recResult.statementEndingBalance)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 text-emerald-800">
              <span>Add: Deposits in transit ({recResult.unclearedReceipts.length}):</span>
              <span className="font-mono tabular-nums">
                +{formatMoney(recResult.depositsInTransit)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 text-rose-800">
              <span>Less: Unpresented cheques ({recResult.unclearedPayments.length}):</span>
              <span className="font-mono tabular-nums">
                -{formatMoney(recResult.unpresentedCheques)}
              </span>
            </div>

            <div className="border-t border-[var(--surface-border)] pt-2 flex items-center justify-between font-semibold">
              <span className="text-[var(--text-primary)]">Adjusted bank balance:</span>
              <span className="font-mono tabular-nums text-[var(--text-primary)]">
                {formatMoney(recResult.adjustedBankBalance)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[var(--surface-border)] pb-2">
              <span className="text-[var(--text-secondary)]">Cashbook closing balance:</span>
              <span className="font-mono tabular-nums text-[var(--text-primary)]">
                {formatMoney(recResult.cashbookClosingBalance)}
              </span>
            </div>

            {/* Reconciliation Difference / Variance */}
            <div
              className={`p-2.5 rounded-[var(--radius-sm)] flex items-center justify-between text-[13px] ${
                recResult.isBalanced
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {recResult.isBalanced ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{recResult.isBalanced ? 'Balanced to zero' : 'Variance out of balance'}</span>
              </div>
              <span className="font-mono font-bold tabular-nums">
                {formatMoney(recResult.variance)}
              </span>
            </div>
          </div>

          {/* Dual Sign-off Block */}
          <div className="border-t border-[var(--surface-border)] pt-3 space-y-2 text-[12px]">
            <div className="text-[var(--text-muted)] font-medium">Sign-off Workflow:</div>

            <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>1. Prepared by (Finance Secretary):</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {existingRec?.preparedBy ? existingRec.preparedBy.fullName : 'Not prepared'}
                </span>
              </div>
              {existingRec?.preparedBy?.signedAt && (
                <div className="text-[11px] text-[var(--text-muted)] text-right">
                  {new Date(existingRec.preparedBy.signedAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] space-y-1">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>2. Approved by (Treasurer):</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {existingRec?.approvedBy ? existingRec.approvedBy.fullName : 'Not approved'}
                </span>
              </div>
              {existingRec?.approvedBy?.signedAt && (
                <div className="text-[11px] text-[var(--text-muted)] text-right">
                  {new Date(existingRec.approvedBy.signedAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            {/* Actions for preparation and approval */}
            <div className="pt-2 flex flex-col gap-2">
              {existingRec?.status !== 'APPROVED' && recResult.isBalanced && isFinanceSec && (
                <button
                  onClick={handlePrepare}
                  className="w-full py-1.5 px-3 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-medium text-[13px] shadow-sm transition"
                >
                  Submit & Sign as Prepared
                </button>
              )}

              {existingRec?.status === 'PREPARED' && recResult.isBalanced && isTreasurer && (
                <button
                  onClick={handleApprove}
                  className="w-full py-1.5 px-3 rounded-[var(--radius-sm)] bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-[13px] shadow-sm transition"
                >
                  Approve Reconciliation (Treasurer)
                </button>
              )}

              {existingRec?.status === 'APPROVED' && (
                <div className="text-center text-[12px] text-emerald-700 font-medium py-1">
                  Reconciliation approved and locked for period close.
                </div>
              )}
            </div>
          </div>

          {/* Unpresented Items Quick Breakdown */}
          {recResult.unclearedPayments.length > 0 && (
            <div className="border-t border-[var(--surface-border)] pt-2 text-[12px] space-y-1">
              <div className="font-medium text-[var(--text-secondary)]">Unpresented Cheques:</div>
              <ul className="space-y-1">
                {recResult.unclearedPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>
                      {p.chequeNumber ? `Chq ${p.chequeNumber}: ` : ''}
                      {p.details.slice(0, 24)}...
                    </span>
                    <span className="font-mono text-rose-700">-{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right 2 Columns: Transaction Matching & Clearing Table */}
        <div className="lg:col-span-2 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden flex flex-col">
          {/* Table Header Controls */}
          <div className="p-3 border-b border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-secondary)]">Filter:</span>
              <select
                value={filterCleared}
                onChange={(e) => setFilterCleared(e.target.value as any)}
                className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[12px]"
              >
                <option value="ALL">All transactions ({accountEntries.length})</option>
                <option value="CLEARED">Cleared on statement ({clearedSet.size})</option>
                <option value="UNCLEARED">
                  Uncleared / In transit ({accountEntries.length - clearedSet.size})
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleClearAll(true)}
                disabled={existingRec?.status === 'APPROVED'}
                className="text-[12px] px-2 py-1 rounded bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Clear all
              </button>
              <button
                onClick={() => handleClearAll(false)}
                disabled={existingRec?.status === 'APPROVED'}
                className="text-[12px] px-2 py-1 rounded bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Reset
              </button>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search details, ref..."
                  className="w-full pl-8 pr-2.5 py-1 text-[12px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
                  <th className="py-2 px-3 text-center w-12">Cleared</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Ref / Cheque</th>
                  <th className="py-2 px-3">Payee / Narration</th>
                  <th className="py-2 px-3 text-right">Receipts</th>
                  <th className="py-2 px-3 text-right">Payments</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {displayedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                      No transactions found for this period and filter.
                    </td>
                  </tr>
                ) : (
                  displayedEntries.map((e) => {
                    const isCleared = clearedSet.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        className={`hover:bg-[var(--surface-subtle)] transition ${
                          isCleared ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isCleared}
                            disabled={existingRec?.status === 'APPROVED'}
                            onChange={() => handleToggleCleared(e.id)}
                            className="rounded text-[var(--accent)] focus:ring-0 cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                          {e.entryDate}
                        </td>
                        <td className="py-2 px-3 font-mono text-[12px] text-[var(--text-primary)] whitespace-nowrap">
                          {e.chequeNumber ? `Chq ${e.chequeNumber}` : e.refNumber}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-primary)] max-w-xs truncate" title={e.details}>
                          {e.details}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-800">
                          {e.direction === 'RECEIPT' ? formatMoney(e.amount) : ''}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-800">
                          {e.direction === 'PAYMENT' ? formatMoney(e.amount) : ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              isCleared
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isCleared ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                            {isCleared ? 'Cleared' : 'In transit'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="p-3 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
            <span>
              Showing {displayedEntries.length} of {accountEntries.length} transactions
            </span>
            <span>
              Cleared: {clearedSet.size} · Uncleared (In transit): {accountEntries.length - clearedSet.size}
            </span>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 className="font-semibold text-[15px] text-[var(--text-primary)]">
                Import Bank Statement (CSV)
              </h3>
              <button
                onClick={() => setIsCsvImportOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-[var(--text-muted)]">
              Paste statement CSV rows formatted as: <code>Date, Description, Amount (positive for deposit, negative for withdrawal), Reference</code>
            </p>

            <form onSubmit={handleProcessCsv} className="space-y-3">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="2026-10-23, GCB DIRECT CREDIT PLEDGE, 5000.00, GCB-CR-88219&#10;2026-10-28, CLEARING CHEQUE 000395, -4500.00, GCB-CHQ-395"
                rows={6}
                className="w-full p-2.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-mono text-[12px] text-[var(--text-primary)] outline-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCsvImportOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white font-medium text-[13px]"
                >
                  Import and Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
