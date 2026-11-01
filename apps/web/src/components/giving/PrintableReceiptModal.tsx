import React from 'react';
import type { PrintableReceipt } from '@church/domain';
import { Printer, X, CheckCircle2 } from 'lucide-react';

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
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full">
        {/* Screen-only Close and Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Receipt Issued Successfully</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div
          id="printable-receipt-area"
          className="mt-4 p-6 sm:p-8 border border-slate-300 rounded-xl bg-slate-50/50 print:border-none print:p-0 print:bg-white text-xs sm:text-sm font-sans"
        >
          {/* Church Header */}
          <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
            <div className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-950">
              {receipt.churchName}
            </div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              {receipt.churchBranch}
            </div>
            <div className="text-[11px] text-slate-500">
              {receipt.churchAddress}
            </div>
            <div className="pt-2">
              <span className="inline-block px-4 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-full print:border print:border-slate-900 print:bg-transparent print:text-slate-900">
                Official Giving & Tithe Receipt
              </span>
            </div>
          </div>

          {/* Receipt Info Grid */}
          <div className="mt-5 grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Receipt No:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {receipt.receiptNumber}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Date:</span>
              <span className="font-semibold text-slate-900">
                {new Date(receipt.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Donor & Allocation Details */}
          <div className="mt-4 space-y-3">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Received From:</span>
              <span className="font-bold text-slate-900">{receipt.donorName}</span>
            </div>

            {(receipt.donorMemberNumber || receipt.donorEnvelopeNumber) && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Member / Envelope:</span>
                <span className="font-mono text-slate-800">
                  {receipt.donorMemberNumber || '-'} / {receipt.donorEnvelopeNumber || '-'}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Contribution Purpose:</span>
              <span className="font-semibold text-slate-900">{receipt.category}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Fund Credited:</span>
              <span className="font-semibold text-slate-900">{receipt.fundName}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Payment Method:</span>
              <span className="font-semibold text-slate-800">{receipt.paymentMethod}</span>
            </div>
          </div>

          {/* Amount Box */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200 print:bg-transparent print:border-2 print:border-slate-900">
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase font-bold tracking-wider text-blue-900 print:text-slate-900">
                Amount Received:
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-blue-950 print:text-slate-950">
                {receipt.amountFigures}
              </span>
            </div>
            <div className="mt-2 text-xs italic text-blue-900 print:text-slate-800 pt-2 border-t border-blue-200/60 print:border-slate-300">
              <span className="font-semibold not-italic">In Words: </span>
              {receipt.amountInWords}
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-8 pt-4">
            <div className="text-center space-y-1">
              <div className="h-10 border-b border-slate-400 mx-4" />
              <div className="text-[11px] font-bold text-slate-900">{receipt.receivingOfficer}</div>
              <div className="text-[10px] text-slate-500 uppercase">{receipt.receivingOfficerRole}</div>
            </div>
            <div className="text-center space-y-1">
              <div className="h-10 border-b border-slate-400 mx-4 flex items-end justify-center pb-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">[ OFFICIAL STAMP ]</span>
              </div>
              <div className="text-[11px] font-bold text-slate-900">Authorized Signature</div>
              <div className="text-[10px] text-slate-500 uppercase">Church Treasury</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 italic">
            Thank you for your generous contribution. May the Lord richly bless your seed. (2 Corinthians 9:7)
          </div>
        </div>

        {/* Screen Close Button */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
