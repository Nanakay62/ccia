/**
 * PrintableVoucherModal Component.
 * Official printable Payment Voucher compliant with Section 1.6 & Phase 5:
 * - Church Letterhead with crest, TIN, contact
 * - Voucher number, requisition cross-reference, expense account, fund
 * - Gross amount, WHT deduction line, net payable amount in figures and words
 * - Dual signature block (Prepared by, Approved by) + Payee acknowledgement signature
 * - Official church stamp box
 */

import React from 'react';
import type { PaymentVoucher } from '@church/domain';
import { numberToWordsGhs } from '@church/domain';
import { Printer, X, Receipt } from 'lucide-react';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatDate } from '../../config/churchSettings.js';

interface PrintableVoucherModalProps {
  voucher: PaymentVoucher | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableVoucherModal: React.FC<PrintableVoucherModalProps> = ({
  voucher,
  isOpen,
  onClose,
}) => {
  useModalEscape(isOpen, onClose);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const grossGhs = (Number(voucher.grossAmountPesewas) / 100).toFixed(2);
  const whtGhs = (Number(voucher.withholdingTaxPesewas) / 100).toFixed(2);
  const netGhs = (Number(voucher.netPayablePesewas) / 100).toFixed(2);
  const netInWords = numberToWordsGhs(voucher.netPayablePesewas);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-[var(--radius)] max-w-3xl w-full p-6 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-[var(--surface-border)]">
        {/* Screen-only Close and Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--surface-border)] print:hidden">
          <div className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm">
            <Receipt className="w-5 h-5" />
            <span>Official Church Payment Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper Container */}
        <div
          id="printable-voucher-area"
          className="mt-4 p-6 sm:p-8 border border-slate-300 rounded-[var(--radius)] bg-white print:border-none print:p-0 text-xs sm:text-sm font-sans space-y-6"
        >
          {/* Official Church Letterhead */}
          <ChurchLetterhead
            documentTitle="Official Payment Voucher"
            documentNumber={voucher.voucherNumber}
            documentDate={formatDate(voucher.voucherDate)}
            currency={voucher.currency === 'USD' ? 'USD' : 'GHS'}
          />

          {/* Payee and Reference Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Paid To (Payee):</span>
                <span className="text-sm font-bold text-slate-900">{voucher.payeeName}</span>
              </div>
              {voucher.requisitionNumber && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Requisition Ref:</span>
                  <span className="font-mono font-medium text-slate-800">{voucher.requisitionNumber}</span>
                </div>
              )}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Fund Debited:</span>
                <span className="font-medium text-slate-800">{voucher.fundName}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:text-right">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Expense Account:</span>
                <span className="font-medium text-slate-900">{voucher.expenseAccountName}</span>
                <span className="text-xs text-slate-500 font-mono block">({voucher.expenseAccountId})</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Disbursement Channel:</span>
                <span className="font-medium text-slate-800">{voucher.paymentMethod}</span>
                {voucher.chequeNumber && (
                  <span className="text-xs text-slate-600 block">Cheque #{voucher.chequeNumber}</span>
                )}
                {voucher.momoReference && (
                  <span className="text-xs text-slate-600 block">MoMo Ref: {voucher.momoReference}</span>
                )}
              </div>
            </div>
          </div>

          {/* Purpose / Description */}
          <div className="p-3.5 rounded-[var(--radius)] border border-slate-200 bg-white">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Purpose & Particulars:
            </span>
            <p className="text-slate-800 font-normal text-xs leading-relaxed">
              {voucher.purpose}
            </p>
          </div>

          {/* Financial Breakdown Table */}
          <div className="border border-slate-200 rounded-[var(--radius)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-3 text-left">Description of Expenditure</th>
                  <th className="py-2.5 px-3 text-right">Gross Amount</th>
                  <th className="py-2.5 px-3 text-right">Withholding tax (WHT)</th>
                  <th className="py-2.5 px-3 text-right">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                <tr>
                  <td className="py-3 px-3 text-slate-800">
                    <div>{voucher.purpose}</div>
                    <div className="text-xs text-slate-500">{voucher.expenseAccountName}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    GHS {grossGhs}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                    {voucher.withholdingTaxRate > 0 ? (
                      `- GHS ${whtGhs} (${voucher.withholdingTaxRate}%)`
                    ) : (
                      'GHS 0.00 (Exempt)'
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium tabular-nums text-slate-900 text-sm">
                    GHS {netGhs}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words Box */}
          <div className="p-4 rounded-[var(--radius)] bg-slate-50 border-2 border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-sm font-bold text-slate-900">
              <span className="uppercase text-xs tracking-wider text-slate-700">Net Amount Disbursed:</span>
              <span className="text-lg font-bold font-mono text-[var(--accent)] tabular-nums">GHS {netGhs}</span>
            </div>
            <p className="text-xs italic text-slate-800 pt-1.5 border-t border-slate-200">
              <span className="font-semibold not-italic">Amount in words: </span>
              {netInWords}
            </p>
          </div>

          {/* Dual Signature Block + Payee Signature */}
          <DualSignatureBlock
            preparedBy={{
              label: 'Prepared by (Finance Secretary)',
              name: voucher.preparedByName || 'Ebenezer Mensah',
              role: 'Finance Secretary',
              date: formatDate(voucher.voucherDate),
              signaturePlaceholder: '(Signed Digitally)',
            }}
            approvedBy={{
              label: 'Approved by (Treasurer / Pastor)',
              name: voucher.authorizedByName || 'Deaconess Akosua Darko',
              role: 'Church Treasurer',
              date: formatDate(voucher.voucherDate),
              signaturePlaceholder: '(Authorized)',
            }}
            thirdSigner={{
              label: 'Received by (Payee Acknowledgement)',
              name: voucher.payeeName,
              role: 'Payee / Authorized Representative',
              date: formatDate(voucher.voucherDate),
            }}
            showStampBox={true}
            notes="Voucher must be supported by official VAT receipts, invoices, or delivery notes before reimbursement."
          />
        </div>

        {/* Screen Close Button */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-[var(--radius)] text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
