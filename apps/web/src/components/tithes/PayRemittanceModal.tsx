import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useCashbook } from '../../context/CashbookContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import type { TitheRemittance } from '@church/domain';

interface PayRemittanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  remittance: TitheRemittance | null;
}

export const PayRemittanceModal: React.FC<PayRemittanceModalProps> = ({
  isOpen,
  onClose,
  remittance,
}) => {
  const { payRemittanceViaVoucher, remittanceRules } = useTithes();
  const { cashAccounts, getNextChequeNumber } = useCashbook();
  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_MONEY'>(
    'BANK_TRANSFER'
  );

  // Default to first bank or cash account
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    cashAccounts.find((c) => c.kind === 'bank')?.id || cashAccounts[0]?.id || 'ca-bank-ghs'
  );

  const [amountStr, setAmountStr] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [momoNumber, setMomoNumber] = useState<string>('');
  const [momoNetwork, setMomoNetwork] = useState<string>('MTN');
  const [bankRef, setBankRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);

  if (!isOpen || !remittance) return null;

  const rule = remittanceRules.find((r) => r.id === remittance.ruleId);
  const payeeName = rule?.payeeName || 'Accra District Office';
  const balanceMajor = (Number(remittance.balanceOutstanding) / 100).toFixed(2);
  const currentAmountToPay = amountStr || balanceMajor;

  // Set cheque number automatically when choosing Cheque
  const handleMethodChange = (m: 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_MONEY') => {
    setPaymentMethod(m);
    if (m === 'CHEQUE' && !chequeNumber && getNextChequeNumber) {
      const nextChq = getNextChequeNumber(selectedAccountId);
      if (nextChq) setChequeNumber(nextChq);
    }
  };

  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    if (paymentMethod === 'CHEQUE' && getNextChequeNumber) {
      const nextChq = getNextChequeNumber(accId);
      if (nextChq) setChequeNumber(nextChq);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedMajor = parseFloat(currentAmountToPay);
    if (isNaN(parsedMajor) || parsedMajor <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    const paymentAmountPesewas = BigInt(Math.round(parsedMajor * 100));
    if (paymentAmountPesewas > remittance.balanceOutstanding) {
      showToast('Payment amount exceeds outstanding balance due.', 'error');
      return;
    }

    if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
      showToast('Cheque number is required when paying by cheque.', 'error');
      return;
    }

    try {
      const { voucherNumber } = payRemittanceViaVoucher({
        remittanceId: remittance.id,
        paymentAmount: paymentAmountPesewas,
        paymentMethod,
        cashAccountId: selectedAccountId,
        chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : undefined,
        momoNumber: paymentMethod === 'MOBILE_MONEY' ? momoNumber.trim() : undefined,
        momoNetwork: paymentMethod === 'MOBILE_MONEY' ? momoNetwork : undefined,
        notes: notes.trim() || (bankRef ? `Bank Ref: ${bankRef.trim()}` : undefined),
      });

      showToast(
        `Remittance payment processed. Payment voucher ${voucherNumber} recorded.`,
        'success'
      );
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to process remittance payment.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-lg overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div>
            <h3 className="font-semibold text-[15px] text-[var(--text-primary)]">
              Pay Denominational Remittance · {remittance.period}
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">
              Prepares payment voucher and records cashbook disbursement
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-border)]/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Remittance Assessment Summary */}
          <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2 text-[13px]">
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Payee</span>
              <span className="font-medium text-[var(--text-primary)]">{payeeName}</span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Gross Tithes Basis</span>
              <span className="tabular-nums text-[var(--text-primary)] font-medium">
                <MoneyCell amount={remittance.tithesBasisGhs} currency={remittance.currency} />
              </span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Rate / Basis</span>
              <span className="text-[var(--text-primary)] font-medium">
                {remittance.rateUsed || '10%'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Total Accrued Due</span>
              <span className="tabular-nums text-[var(--text-primary)] font-medium">
                <MoneyCell amount={remittance.amountDue} currency={remittance.currency} />
              </span>
            </div>
            {remittance.amountPaid > 0n && (
              <div className="flex justify-between items-center text-[var(--text-muted)]">
                <span>Previously Paid</span>
                <span className="tabular-nums text-[var(--text-primary)] font-medium">
                  <MoneyCell amount={remittance.amountPaid} currency={remittance.currency} />
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-[var(--surface-border)] flex justify-between items-center">
              <span className="font-semibold text-[var(--text-primary)]">Balance Outstanding</span>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums text-[14px]">
                <MoneyCell amount={remittance.balanceOutstanding} currency={remittance.currency} />
              </span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Payment Amount ({remittance.currency})
            </label>
            <input
              type="number"
              step="0.01"
              value={currentAmountToPay}
              onChange={(e) => setAmountStr(e.target.value)}
              required
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] tabular-nums"
            />
          </div>

          {/* Payment Method & Cash Account */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  handleMethodChange(e.target.value as 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_MONEY')
                }
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Cash / Bank Account
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] truncate"
              >
                {cashAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Method-specific fields */}
          {paymentMethod === 'CHEQUE' && (
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Cheque Number
              </label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="e.g. CHQ-009942"
                required
                className="w-full px-3 py-1.5 text-[13px] font-mono border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {paymentMethod === 'MOBILE_MONEY' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  Network
                </label>
                <select
                  value={momoNetwork}
                  onChange={(e) => setMomoNetwork(e.target.value)}
                  className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="MTN">MTN MoMo</option>
                  <option value="Telecel">Telecel Cash</option>
                  <option value="AT">AT Money</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                  Recipient MoMo Phone
                </label>
                <input
                  type="text"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  placeholder="024 123 4567"
                  className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'BANK_TRANSFER' && (
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Bank Transfer Reference / Transaction ID
              </label>
              <input
                type="text"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
                placeholder="e.g. GCB-TRF-90218"
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Payment Narration / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Remitted per district council resolution"
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Authorization Declaration */}
          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer text-[12px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={isAuthorized}
                onChange={(e) => setIsAuthorized(e.target.checked)}
                required
                className="mt-0.5 rounded border-[var(--surface-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span>
                I certify that this payment voucher is authorized in accordance with church financial regulations and approved for disbursement.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium border border-[var(--surface-border)] rounded-[var(--radius)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isAuthorized}
              className="px-4 py-2 text-[13px] font-medium rounded-[var(--radius)] bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Disburse Payment & Record Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
