/**
 * PrintableCountingSheetModal Component.
 * Official printable Counting Sheet summary compliant with Section 1.6 & Phase 5:
 * - Church Letterhead with crest, TIN, contact
 * - Status banner / Draft watermark if awaiting 2nd signature
 * - Cash denomination counts (notes & coins)
 * - Cheques and Mobile money breakdowns
 * - Fund allocation summary
 * - Grand total in figures and words
 * - Dual counter signature block
 */

import React from 'react';
import type { CountingSheet } from '@church/domain';
import { numberToWordsGhs } from '@church/domain';
import { Printer, X, FileSpreadsheet } from 'lucide-react';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';

interface PrintableCountingSheetModalProps {
  sheet: CountingSheet | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableCountingSheetModal: React.FC<PrintableCountingSheetModalProps> = ({
  sheet,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !sheet) return null;

  const handlePrint = () => {
    window.print();
  };

  const isDraft = sheet.status !== 'POSTED';
  const totalCashGhs = (Number(sheet.totalCashGhsPesewas) / 100).toFixed(2);
  const totalChequesGhs = (Number(sheet.totalChequesGhsPesewas) / 100).toFixed(2);
  const totalMomoGhs = (Number(sheet.totalMomoGhsPesewas) / 100).toFixed(2);
  const grandTotalGhs = (Number(sheet.grandTotalGhsPesewas) / 100).toFixed(2);
  const grandTotalInWords = numberToWordsGhs(sheet.grandTotalGhsPesewas);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-[var(--radius)] max-w-3xl w-full p-6 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-[var(--surface-border)]">
        {/* Screen-only Close and Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--surface-border)] print:hidden">
          <div className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm">
            <FileSpreadsheet className="w-5 h-5" />
            <span>Official Offering & Tithe Counting Sheet</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Counting Sheet Document */}
        <div
          id="printable-counting-sheet-area"
          className="mt-4 p-6 sm:p-8 border border-slate-300 rounded-[var(--radius)] bg-white print:border-none print:p-0 text-xs sm:text-sm font-sans space-y-6"
        >
          {/* Official Church Letterhead */}
          <ChurchLetterhead
            documentTitle="Offering & Tithe Counting Sheet"
            documentNumber={sheet.sheetNumber}
            documentDate={sheet.serviceDate}
            periodText={`Service: ${sheet.serviceType}`}
            currency="GHS"
            isDraft={isDraft}
          />

          {/* Service & Verification Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Service Event:</span>
              <span className="font-bold text-slate-900">{sheet.serviceType}</span>
              <span className="text-slate-500 block text-[11px]">Date: {sheet.serviceDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Posting Status:</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                sheet.status === 'POSTED' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {sheet.status === 'POSTED' ? 'Posted to General Ledger' : 'Draft — Pending 2nd Signature'}
              </span>
              {sheet.journalEntryId && (
                <span className="block font-mono text-[10px] text-slate-500 mt-0.5">JE: {sheet.journalEntryId}</span>
              )}
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lead Counter:</span>
              <span className="font-semibold text-slate-900">{sheet.firstCounterName}</span>
              <span className="text-slate-500 block text-[10.5px]">Signed: {sheet.firstSignedAt.substring(0, 10)}</span>
            </div>
          </div>

          {/* Denominations Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cash Denomination Breakdown (Ghana Cedis)
            </h3>
            <div className="border border-slate-200 rounded-[var(--radius)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2 px-3 text-left">Denomination</th>
                    <th className="py-2 px-3 text-center">Unit</th>
                    <th className="py-2 px-3 text-right">Count / Quantity</th>
                    <th className="py-2 px-3 text-right">Subtotal (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sheet.cashDenominationsGhs.map((denom) => {
                    const subtotal = (denom.denomination * denom.count).toFixed(2);
                    return (
                      <tr key={denom.denomination} className="hover:bg-slate-50/50">
                        <td className="py-1.5 px-3 font-semibold text-slate-900">
                          {Number(denom.denomination) >= 1 ? `GH₵ ${denom.denomination} Note` : `${Number(denom.denomination) * 100}p Coin`}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-500 font-mono">
                          {Number(denom.denomination).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {denom.count}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {subtotal}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={3} className="py-2 px-3 text-slate-700 uppercase text-[11px]">
                      Total Physical Cash Counted
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-950 text-sm">
                      GHS {totalCashGhs}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cheques & MoMo Breakdown (if any) */}
          {(sheet.cheques.length > 0 || sheet.momoTransactions.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sheet.cheques.length > 0 && (
                <div className="p-3 border border-slate-200 rounded-[var(--radius)] space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Cheques Received ({sheet.cheques.length})
                  </span>
                  <div className="space-y-1 text-xs">
                    {sheet.cheques.map((c, i) => (
                      <div key={i} className="flex justify-between text-slate-700">
                        <span>{c.bankName} #{c.chequeNumber}</span>
                        <span className="font-mono font-semibold">GHS {(Number(c.amountPesewas) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                      <span>Total Cheques:</span>
                      <span className="font-mono">GHS {totalChequesGhs}</span>
                    </div>
                  </div>
                </div>
              )}

              {sheet.momoTransactions.length > 0 && (
                <div className="p-3 border border-slate-200 rounded-[var(--radius)] space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Mobile Money Transfers ({sheet.momoTransactions.length})
                  </span>
                  <div className="space-y-1 text-xs">
                    {sheet.momoTransactions.map((m, i) => (
                      <div key={i} className="flex justify-between text-slate-700">
                        <span>{m.network} ({m.transactionReference})</span>
                        <span className="font-mono font-semibold">GHS {(Number(m.amountPesewas) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                      <span>Total Mobile Money:</span>
                      <span className="font-mono">GHS {totalMomoGhs}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fund Allocations */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Fund Credit Allocation
            </h3>
            <div className="border border-slate-200 rounded-[var(--radius)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2 px-3 text-left">Fund / Purpose</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-right">Allocated Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sheet.fundAllocations.map((alloc) => (
                    <tr key={alloc.fundId} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-900 font-semibold">{alloc.fundName}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{alloc.category}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {(Number(alloc.amountPesewas) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Total Box in Words and Figures */}
          <div className="p-4 rounded-[var(--radius)] bg-slate-50 border-2 border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-sm font-bold text-slate-900">
              <span className="uppercase text-xs tracking-wider text-slate-700">GRAND TOTAL REVENUE COUNTED:</span>
              <span className="text-xl font-bold font-mono text-[var(--accent)] tabular-nums">GHS {grandTotalGhs}</span>
            </div>
            <p className="text-xs italic text-slate-800 pt-1.5 border-t border-slate-200">
              <span className="font-semibold not-italic">Amount in words: </span>
              {grandTotalInWords}
            </p>
          </div>

          {/* Dual Counter Sign-off */}
          <DualSignatureBlock
            preparedBy={{
              label: 'Counter 1 (Lead Counter)',
              name: sheet.firstCounterName,
              role: 'Audit Counting Officer 1',
              date: sheet.firstSignedAt ? sheet.firstSignedAt.substring(0, 10) : sheet.serviceDate,
              signaturePlaceholder: '(Signed Digitally)',
            }}
            approvedBy={{
              label: 'Counter 2 (Verifier / Finance Sec.)',
              name: sheet.secondCounterName || 'Awaiting Second Signature',
              role: 'Audit Counting Officer 2',
              date: sheet.secondSignedAt ? sheet.secondSignedAt.substring(0, 10) : undefined,
              signaturePlaceholder: sheet.secondCounterName ? '(Signed Digitally)' : undefined,
            }}
            showStampBox={true}
            notes="Both counting officers certify that the contents of offering bags were counted and verified in each other's presence with zero discrepancy."
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
