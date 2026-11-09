import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  Ban,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useCashbook } from '../../context/CashbookContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  getNextChequeNumber,
  validateChequeNumber,
  refreshChequeStatuses,
  type ChequeItem,
} from '@church/domain';
import { generateCsv, downloadCsv } from '../../utils/exports/csv.js';
import { exportReportToExcel } from '../../utils/exports/excel.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const ChequeRegisterTab: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    cashAccounts,
    cheques,
    recordCheque,
    markChequePresented,
    cancelCheque,
  } = useCashbook();
  const { showToast } = useToast();

  const isTreasurer = currentUser.role === 'Treasurer' || currentUser.role === 'Admin';
  const isFinanceSec = currentUser.role === 'Finance Secretary';
  const canManage = isTreasurer || isFinanceSec;

  // Bank accounts that issue cheques
  const bankAccounts = useMemo(
    () => cashAccounts.filter((a) => a.kind === 'bank'),
    [cashAccounts]
  );

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    bankAccounts[0]?.id || 'ca-bank-ghs'
  );

  const activeBankAccount = useMemo(
    () => bankAccounts.find((a) => a.id === selectedBankAccountId) || bankAccounts[0]!,
    [bankAccounts, selectedBankAccountId]
  );

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'ALL' | ChequeItem['status']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPresentedModalOpen, setIsPresentedModalOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<ChequeItem | null>(null);

  const isAnyModalOpen = isIssueModalOpen || isCancelModalOpen || isPresentedModalOpen;
  useModalEscape(isAnyModalOpen, () => {
    setIsIssueModalOpen(false);
    setIsCancelModalOpen(false);
    setIsPresentedModalOpen(false);
    setSelectedCheque(null);
  });

  // Issue Form State
  const [nextChequeNum, setNextChequeNum] = useState('');
  const [issuePayee, setIssuePayee] = useState('');
  const [issueAmount, setIssueAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueVoucherRef, setIssueVoucherRef] = useState('PV-202610-0028');

  // Cancel Reason State
  const [cancelReasonText, setCancelReasonText] = useState('');

  // Presented Date State
  const [presentedDateInput, setPresentedDateInput] = useState(new Date().toISOString().slice(0, 10));

  // Cheques for this account with refreshed stale status
  const accountCheques = useMemo(() => {
    const raw = cheques.filter((c) => c.bankAccountId === activeBankAccount.id);
    return refreshChequeStatuses(raw, new Date().toISOString().slice(0, 10));
  }, [cheques, activeBankAccount.id]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    return accountCheques.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.chequeNumber.toLowerCase().includes(q) ||
          c.payee.toLowerCase().includes(q) ||
          (c.cancelReason && c.cancelReason.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [accountCheques, statusFilter, searchQuery]);

  // KPI Counts
  const kpis = useMemo(() => {
    const total = accountCheques.length;
    const issued = accountCheques.filter((c) => c.status === 'ISSUED').length;
    const presented = accountCheques.filter((c) => c.status === 'PRESENTED').length;
    const stale = accountCheques.filter((c) => c.status === 'STALE').length;
    const cancelled = accountCheques.filter((c) => c.status === 'CANCELLED').length;
    return { total, issued, presented, stale, cancelled };
  }, [accountCheques]);

  // Open Issue Cheque Modal
  const handleOpenIssueModal = () => {
    const nextNum = getNextChequeNumber(accountCheques, 396);
    setNextChequeNum(nextNum);
    setIssuePayee('');
    setIssueAmount('');
    setIsIssueModalOpen(true);
  };

  // Submit Issue Cheque
  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(issueAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast('Please enter a valid cheque amount', 'error');
      return;
    }

    const validation = validateChequeNumber(nextChequeNum, accountCheques);
    if (!validation.isValid) {
      showToast(validation.error || 'Invalid cheque number', 'error');
      return;
    }

    if (validation.warning) {
      showToast(validation.warning, 'warning');
    }

    const minorUnits = BigInt(Math.round(amtNum * 100));
    const staleDate = new Date(issueDate);
    staleDate.setMonth(staleDate.getMonth() + 6);

    recordCheque({
      bankAccountId: activeBankAccount.id,
      chequeNumber: nextChequeNum.trim(),
      payee: issuePayee.trim(),
      amount: minorUnits,
      currency: activeBankAccount.currency,
      issueDate,
      status: 'ISSUED',
      staleDate: staleDate.toISOString().slice(0, 10),
    });

    showToast(`Cheque ${nextChequeNum} issued to ${issuePayee}`, 'success');
    setIsIssueModalOpen(false);
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (cheque: ChequeItem) => {
    setSelectedCheque(cheque);
    setCancelReasonText('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancel Cheque
  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;
    if (!cancelReasonText.trim()) {
      showToast('A mandatory reason is required to void/cancel a cheque', 'error');
      return;
    }

    cancelCheque(selectedCheque.id, cancelReasonText.trim());
    showToast(`Cheque ${selectedCheque.chequeNumber} cancelled (voided)`, 'neutral');
    setIsCancelModalOpen(false);
    setSelectedCheque(null);
  };

  // Open Mark Presented Modal
  const handleOpenPresentedModal = (cheque: ChequeItem) => {
    setSelectedCheque(cheque);
    setPresentedDateInput(new Date().toISOString().slice(0, 10));
    setIsPresentedModalOpen(true);
  };

  // Submit Mark Presented
  const handlePresentedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;

    markChequePresented(selectedCheque.id, presentedDateInput);
    showToast(`Cheque ${selectedCheque.chequeNumber} marked as presented on ${presentedDateInput}`, 'success');
    setIsPresentedModalOpen(false);
    setSelectedCheque(null);
  };

  // Format Money helper
  const formatMoney = (val: bigint) => {
    const num = Number(val) / 100;
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Exports
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    const filename = `Cheque_Register_${activeBankAccount.code}_${new Date().toISOString().slice(0, 10)}`;
    const headers = ['Cheque Number', 'Issue Date', 'Payee', 'Amount', 'Currency', 'Status', 'Presented Date', 'Stale Date', 'Cancel Reason'];

    const rows = filteredCheques.map((c) => [
      c.chequeNumber,
      c.issueDate,
      c.payee,
      (Number(c.amount) / 100).toFixed(2),
      c.currency,
      c.status,
      c.presentedDate || '',
      c.staleDate,
      c.cancelReason || '',
    ]);

    if (format === 'csv') {
      downloadCsv(filename, generateCsv(headers, rows));
      showToast('Exported cheque register as CSV', 'success');
    } else if (format === 'excel') {
      exportReportToExcel({
        filename,
        sheetName: 'Cheques',
        reportTitle: `Cheque Register — ${activeBankAccount.name}`,
        periodText: `Printed on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        currency: activeBankAccount.currency,
        columns: [
          { header: 'Cheque No.', key: 'num', width: 14 },
          { header: 'Issue Date', key: 'date', width: 14 },
          { header: 'Payee', key: 'payee', width: 30 },
          { header: 'Amount', key: 'amt', width: 16 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Clearing / Notes', key: 'notes', width: 35 },
        ],
        data: filteredCheques.map((c) => ({
          num: c.chequeNumber,
          date: c.issueDate,
          payee: c.payee,
          amt: (Number(c.amount) / 100).toFixed(2),
          status: c.status,
          notes: c.status === 'PRESENTED' ? `Presented on ${c.presentedDate}` : c.cancelReason || `Stale on ${c.staleDate}`,
        })),
      });
      showToast('Exported cheque register as Excel spreadsheet', 'success');
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bank Account Switcher and Action Toolbar */}
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

          <div className="text-[12px] text-[var(--text-muted)] border-l border-[var(--surface-border)] pl-3 hidden md:block">
            Cheque register for {activeBankAccount.bankName} ({activeBankAccount.branchName})
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={handleOpenIssueModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-medium text-[13px] shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Issue cheque</span>
            </button>
          )}

          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] border border-[var(--surface-border)] text-[var(--text-primary)] text-[12px] font-medium transition"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Status KPI Strip (Rule A1 compliant: neutral numbers, no card grids) */}
      <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4 text-[13px]">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-[var(--text-muted)]">Total Cheques: </span>
            <span className="font-semibold text-[var(--text-primary)] tabular-nums">{kpis.total}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Issued (Unpresented): </span>
            <span className="font-semibold text-blue-700 tabular-nums">{kpis.issued}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Presented: </span>
            <span className="font-semibold text-emerald-700 tabular-nums">{kpis.presented}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Stale (&gt;6 months): </span>
            <span className="font-semibold text-amber-700 tabular-nums">{kpis.stale}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Cancelled / Void: </span>
            <span className="font-semibold text-rose-700 tabular-nums">{kpis.cancelled}</span>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[12px]"
          >
            <option value="ALL">All statuses</option>
            <option value="ISSUED">Issued (Unpresented)</option>
            <option value="PRESENTED">Presented (Cleared)</option>
            <option value="STALE">Stale (&gt;6 months)</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payee or number..."
              className="w-full pl-8 pr-2.5 py-1 text-[12px] rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Cheques DataTable */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
                <th className="py-2 px-3">Cheque No.</th>
                <th className="py-2 px-3">Issue Date</th>
                <th className="py-2 px-3">Payee</th>
                <th className="py-2 px-3 text-right">Amount ({activeBankAccount.currency})</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Clearing / Stale Date</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                    No cheques issued yet. Record a payment from a bank account or click Issue Cheque.
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => {
                  const isStale = c.status === 'STALE';
                  const isPresented = c.status === 'PRESENTED';
                  const isCancelled = c.status === 'CANCELLED';

                  return (
                    <tr key={c.id} className="hover:bg-[var(--surface-subtle)] transition">
                      <td className="py-2 px-3 font-mono font-medium text-[var(--text-primary)]">
                        {c.chequeNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                        {c.issueDate}
                      </td>
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">
                        {c.payee}
                        {c.cancelReason && (
                          <div className="text-[11px] text-rose-700 font-normal">
                            Reason: {c.cancelReason}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                        {formatMoney(c.amount)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            isPresented
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : isStale
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPresented
                                ? 'bg-emerald-600'
                                : isCancelled
                                ? 'bg-rose-600'
                                : isStale
                                ? 'bg-amber-600'
                                : 'bg-blue-600'
                            }`}
                          />
                          {c.status === 'PRESENTED'
                            ? 'Presented'
                            : c.status === 'CANCELLED'
                            ? 'Cancelled'
                            : c.status === 'STALE'
                            ? 'Stale (>6m)'
                            : 'Issued (Unpresented)'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                        {isPresented ? (
                          <span>Cleared: {c.presentedDate}</span>
                        ) : isCancelled ? (
                          <span>Voided</span>
                        ) : (
                          <span>Stale after: {c.staleDate}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'ISSUED' && canManage && (
                            <>
                              <button
                                onClick={() => handleOpenPresentedModal(c)}
                                className="px-2 py-0.5 text-[11px] rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                title="Mark as presented / cleared on statement"
                              >
                                Mark Presented
                              </button>
                              <button
                                onClick={() => handleOpenCancelModal(c)}
                                className="px-2 py-0.5 text-[11px] rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                                title="Cancel / void cheque with mandatory reason"
                              >
                                Void
                              </button>
                            </>
                          )}
                          {c.status === 'PRESENTED' && (
                            <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                            </span>
                          )}
                          {c.status === 'CANCELLED' && (
                            <span className="text-[11px] text-rose-700 flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5" /> Voided
                            </span>
                          )}
                          {c.status === 'STALE' && (
                            <button
                              onClick={() => handleOpenCancelModal(c)}
                              className="px-2 py-0.5 text-[11px] rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                            >
                              Void Stale Cheque
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Cheque */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 className="font-semibold text-[15px] text-[var(--text-primary)]">
                Issue Cheque — {activeBankAccount.name}
              </h3>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[var(--text-muted)] font-medium mb-1">
                  Cheque Number (Auto-sequenced)
                </label>
                <input
                  type="text"
                  required
                  value={nextChequeNum}
                  onChange={(e) => setNextChequeNum(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-mono font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] font-medium mb-1">Payee</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Company of Ghana"
                  value={issuePayee}
                  onChange={(e) => setIssuePayee(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-muted)] font-medium mb-1">
                    Amount ({activeBankAccount.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={issueAmount}
                    onChange={(e) => setIssueAmount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] font-medium mb-1">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] font-medium mb-1">
                  Linked Payment Voucher (Reference)
                </label>
                <input
                  type="text"
                  value={issueVoucherRef}
                  onChange={(e) => setIssueVoucherRef(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white font-medium shadow-sm hover:opacity-90"
                >
                  Record Cheque Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Void / Cancel Cheque */}
      {isCancelModalOpen && selectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 className="font-semibold text-[15px] text-rose-700 flex items-center gap-1.5">
                <Ban className="w-4 h-4" /> Void Cheque {selectedCheque.chequeNumber}
              </h3>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-[var(--text-muted)]">
              Per church accounting policy, cancelled cheques remain permanently in the register with an audit trail and cannot be erased.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Reason for Cancellation (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  placeholder="e.g. Damaged during printing; duplicate payee entry; replaced with wire transfer."
                  className="w-full p-2.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-rose-700 text-white font-medium shadow-sm hover:bg-rose-800"
                >
                  Confirm Void Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Mark Presented */}
      {isPresentedModalOpen && selectedCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 className="font-semibold text-[15px] text-[var(--text-primary)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Mark Cheque {selectedCheque.chequeNumber} as Presented
              </h3>
              <button
                onClick={() => setIsPresentedModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePresentedSubmit} className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[var(--text-secondary)] font-medium mb-1">
                  Date Presented at Bank
                </label>
                <input
                  type="date"
                  required
                  value={presentedDateInput}
                  onChange={(e) => setPresentedDateInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsPresentedModalOpen(false)}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-emerald-700 text-white font-medium shadow-sm hover:bg-emerald-800"
                >
                  Confirm Presented
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
