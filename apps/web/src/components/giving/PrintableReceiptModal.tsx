import React from 'react';
import type { PrintableReceipt } from '@church/domain';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface PrintableReceiptModalProps {
  receipt: PrintableReceipt | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  receipt,
  isOpen,
  onClose,
}) => {
  useModalEscape(isOpen, onClose);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(receipt.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-[var(--radius)] max-w-2xl w-full p-6 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-[var(--surface-border)]">
        {/* Screen-only Close and Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--surface-border)] print:hidden">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Receipt Issued Successfully</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div
          id="printable-receipt-area"
          className="mt-4 p-6 sm:p-8 border border-slate-300 rounded-[var(--radius)] bg-white print:border-none print:p-0 text-xs sm:text-sm font-sans"
        >
          {/* Official Church Letterhead */}
          <ChurchLetterhead
            documentTitle="Official Giving & Tithe Receipt"
            documentNumber={receipt.receiptNumber}
            documentDate={formattedDate}
            currency="GHS"
            churchName={receipt.churchName}
            branchName={receipt.churchBranch}
          />

          {/* Donor & Allocation Details Table */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Received From:</span>
              <span className="font-bold text-slate-900">{receipt.donorName}</span>
            </div>

            {(receipt.donorMemberNumber || receipt.donorEnvelopeNumber) && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Member / Envelope:</span>
                <span className="font-mono text-slate-800">
                  {receipt.donorMemberNumber || '-'} / {receipt.donorEnvelopeNumber || '-'}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Contribution Purpose:</span>
              <span className="font-semibold text-slate-900">{receipt.category}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Fund Credited:</span>
              <span className="font-semibold text-slate-900">{receipt.fundName}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Payment Channel / Instrument:</span>
              <span className="font-semibold text-slate-800">{receipt.paymentMethod}</span>
            </div>
          </div>

          {/* Amount Box */}
          <div className="mt-6 p-4 rounded-[var(--radius)] bg-slate-50 border border-slate-300 print:bg-transparent print:border-2 print:border-slate-900">
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-700 print:text-slate-900">
                Amount Received:
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--accent)] print:text-slate-950">
                {receipt.amountFigures}
              </span>
            </div>
            <div className="mt-2 text-xs italic text-slate-800 pt-2 border-t border-slate-200 print:border-slate-300">
              <span className="font-semibold not-italic">In Words: </span>
              {receipt.amountInWords}
            </div>
          </div>

          {/* Dual Signatures */}
          <DualSignatureBlock
            preparedBy={{
              label: 'Issued by',
              name: receipt.receivingOfficer,
              role: receipt.receivingOfficerRole,
              date: formattedDate,
              signaturePlaceholder: '(Signed Digitally)',
            }}
            approvedBy={{
              label: 'Authorized Treasury Signer',
              name: 'Deaconess Akosua Darko',
              role: 'Church Treasurer',
              date: formattedDate,
              signaturePlaceholder: '(Verified)',
            }}
            showStampBox={true}
            notes="Thank you for your faithful contribution. May the Lord richly bless your seed. (2 Corinthians 9:7)"
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
