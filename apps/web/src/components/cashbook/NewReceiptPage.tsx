import React, { useState } from 'react';
import { useCashbook } from '../../context/CashbookContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { parsePesewas } from '../../utils/formatters.js';
import { Save, RotateCcw } from 'lucide-react';
import type { PaymentMethod } from '@church/domain';

export const NewReceiptPage: React.FC = () => {
  const { cashAccounts, selectedAccountId, recordReceipt } = useCashbook();
  const { funds, accounts } = useLedger();
  const { showToast } = useToast();
  const { goBack, navigate } = useRouter();

  const [accountId, setAccountId] = useState(selectedAccountId || 'ca-cash-ghs');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receiptDate, setReceiptDate] = useState('2026-10-25');
  const [fundId, setFundId] = useState('fund-gen');
  const [incomeAccountId, setIncomeAccountId] = useState('acct-4010');
  const [amountGhs, setAmountGhs] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState(`RC-202610-${Math.floor(1000 + Math.random() * 9000)}`);
  const [narration, setNarration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const incomeAccounts = accounts.filter((a) => a.type === 'Income');

  const resetForm = () => {
    setReceivedFrom('');
    setAmountGhs('');
    setReference(`RC-202610-${Math.floor(1000 + Math.random() * 9000)}`);
    setNarration('');
  };

  const handleSave = (addAnother = false) => {
    if (!receivedFrom.trim()) {
      showToast('Please state who the funds were received from.', 'error');
      return;
    }
    const pesewas = parsePesewas(amountGhs);
    if (pesewas <= 0n) {
      showToast('Receipt amount must be greater than zero.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const cashAcct = cashAccounts.find((a) => a.id === accountId) || cashAccounts[0]!;
      const fund = funds.find((f) => f.id === fundId) || funds[0]!;
      const incAcct = accounts.find((a) => a.id === incomeAccountId) || accounts[0]!;

      recordReceipt({
        cashAccount: cashAcct,
        entryDate: receiptDate,
        receivedFrom: receivedFrom.trim(),
        fund,
        incomeAccount: incAcct,
        amount: pesewas,
        method,
        refNumber: reference.trim(),
        narration: narration.trim() || `Receipt from ${receivedFrom.trim()}`,
      });

      showToast(`Receipt ${reference} saved and posted to General Ledger.`, 'success');

      if (addAnother) {
        resetForm();
      } else {
        goBack('cashbook');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to record receipt.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-4xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Cashbook', onClick: () => navigate('#/cashbook') },
          { label: 'New Receipt' },
        ]}
        onBack={() => goBack('cashbook')}
      />

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        <div>
          <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
            Record Cashbook Receipt
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Book of original entry for receiving cash, bank transfers, cheques, and mobile money. Posts directly to the general ledger.
          </p>
        </div>

        <div className="space-y-4 text-[14px]">
          {/* Account & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Cashbook Account *
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
                Date *
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Received From & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Received From *
              </label>
              <input
                type="text"
                placeholder="Member name, donor, institution..."
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Receipt Method *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="CASH">Cash on Hand</option>
                <option value="MOMO">Mobile Money (MoMo)</option>
                <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                <option value="CHEQUE">Cheque Received</option>
              </select>
            </div>
          </div>

          {/* Fund & Income Category */}
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
                Income Account (Other Side) *
              </label>
              <select
                value={incomeAccountId}
                onChange={(e) => setIncomeAccountId(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Amount (GHS) *
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={amountGhs}
                onChange={(e) => setAmountGhs(e.target.value)}
                className="w-full px-3 py-2 text-[15px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Reference / Receipt Number *
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 text-[14px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Narration / Notes
            </label>
            <textarea
              rows={3}
              placeholder="Full description of receipt purpose..."
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Action Buttons: Save & Save and Add Another (Requirement 1) */}
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
              <span>Save Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
