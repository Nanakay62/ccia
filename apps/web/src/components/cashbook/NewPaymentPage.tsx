import React, { useState } from 'react';
import { useCashbook } from '../../context/CashbookContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { parsePesewas } from '../../utils/formatters.js';
import { Save, RotateCcw } from 'lucide-react';
import type { PaymentMethod } from '@church/domain';

export const NewPaymentPage: React.FC = () => {
  const { cashAccounts, selectedAccountId, recordPayment } = useCashbook();
  const { funds, accounts } = useLedger();
  const { showToast } = useToast();
  const { goBack, navigate } = useRouter();

  const [accountId, setAccountId] = useState(selectedAccountId || 'ca-bank-ghs');
  const [paidTo, setPaidTo] = useState('');
  const [paymentDate, setPaymentDate] = useState('2026-10-28');
  const [linkedVoucher, setLinkedVoucher] = useState('PV-0014');
  const [isVoucherExempt, setIsVoucherExempt] = useState(false);
  const [voucherExemptReason, setVoucherExemptReason] = useState('');
  const [fundId, setFundId] = useState('fund-gen');
  const [expenseAccountId, setExpenseAccountId] = useState('acct-5020');
  const [amountGhs, setAmountGhs] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CHEQUE');
  const [chequeNumber, setChequeNumber] = useState('000396');
  const [narration, setNarration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseAccounts = accounts.filter((a) => a.type === 'Expense');

  const resetForm = () => {
    setPaidTo('');
    setAmountGhs('');
    setNarration('');
    setChequeNumber((prev) => String(Number(prev) + 1).padStart(6, '0'));
  };

  const handleSave = (addAnother = false) => {
    if (!paidTo.trim()) {
      showToast('Please state who the payment is made to.', 'error');
      return;
    }
    const pesewas = parsePesewas(amountGhs);
    if (pesewas <= 0n) {
      showToast('Payment amount must be greater than zero.', 'error');
      return;
    }

    if (!isVoucherExempt && !linkedVoucher.trim()) {
      showToast('A payment requires an approved payment voucher number or Treasurer exemption.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const cashAcct = cashAccounts.find((a) => a.id === accountId) || cashAccounts[0]!;
      const fund = funds.find((f) => f.id === fundId) || funds[0]!;
      const expAcct = accounts.find((a) => a.id === expenseAccountId) || accounts[0]!;

      recordPayment({
        cashAccount: cashAcct,
        entryDate: paymentDate,
        paidTo: paidTo.trim(),
        linkedVoucherId: isVoucherExempt ? undefined : linkedVoucher.trim(),
        isVoucherExempt,
        voucherExemptReason: isVoucherExempt ? voucherExemptReason.trim() : undefined,
        fund,
        expenseAccount: expAcct,
        amount: pesewas,
        method,
        chequeNumber: method === 'CHEQUE' ? chequeNumber.trim() : undefined,
        narration: narration.trim() || `Payment to ${paidTo.trim()}`,
      });

      showToast(`Payment of GHS ${amountGhs} recorded successfully in Cashbook.`, 'success');

      if (addAnother) {
        resetForm();
      } else {
        goBack('cashbook');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to record payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-4xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Cashbook', onClick: () => navigate('#/cashbook') },
          { label: 'New Payment' },
        ]}
        onBack={() => goBack('cashbook')}
      />

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        <div>
          <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
            Record Cashbook Disbursement / Payment
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Every expenditure disbursement must link to an approved Payment Voucher or provide an authorized exemption.
          </p>
        </div>

        <div className="space-y-4 text-[14px]">
          {/* Account & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Disbursement Account *
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Paid To & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Paid To (Vendor / Staff / Payee) *
              </label>
              <input
                type="text"
                placeholder="e.g. ECG Electricity Company, Rev. Pastor, SoundCity Ghana"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Payment Method *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="CHEQUE">Bank Cheque</option>
                <option value="BANK_TRANSFER">Bank Electronic Transfer</option>
                <option value="MOMO">Mobile Money (MoMo)</option>
                <option value="CASH">Physical Cash</option>
              </select>
            </div>
          </div>

          {/* Linked Voucher / Exemption */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                Voucher Authorization
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVoucherExempt}
                  onChange={(e) => setIsVoucherExempt(e.target.checked)}
                  className="rounded text-[var(--accent)]"
                />
                <span>Exempt from voucher (bank charges, MoMo fees, adjustments)</span>
              </label>
            </div>

            {!isVoucherExempt ? (
              <div>
                <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                  Approved Payment Voucher Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. PV-0014"
                  value={linkedVoucher}
                  onChange={(e) => setLinkedVoucher(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[12px] text-[var(--text-muted)] mb-1">
                  Exemption Reason (Required for non-voucher payments) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly bank ledger maintenance fee, MoMo cash-out levy"
                  value={voucherExemptReason}
                  onChange={(e) => setVoucherExemptReason(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            )}
          </div>

          {/* Fund & Expense Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Fund *
              </label>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Expense Account (Other Side) *
              </label>
              <select
                value={expenseAccountId}
                onChange={(e) => setExpenseAccountId(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {expenseAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Cheque Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Disbursement Amount (GHS) *
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={amountGhs}
                onChange={(e) => setAmountGhs(e.target.value)}
                className="w-full px-3 py-2 text-[15px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {method === 'CHEQUE' && (
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                  Cheque Number *
                </label>
                <input
                  type="text"
                  placeholder="000396"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            )}
          </div>

          {/* Narration */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Narration
            </label>
            <textarea
              rows={3}
              placeholder="Full description of payment voucher disbursement..."
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Action Buttons: Save & Save and Add Another */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--surface-border-subtle)]">
          <button
            type="button"
            onClick={() => goBack('cashbook')}
            className="px-4 py-2 border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] rounded-[var(--radius)] text-[13px] font-medium transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius)] text-[13px] font-semibold transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Save and add another</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--accent)] text-white hover:opacity-90 rounded-[var(--radius)] text-[13px] font-semibold transition shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Payment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
