/**
 * MemberStatementModal Component.
 * High-fidelity printable individual member giving statement
 * with Ghanaian legal tender phrasing, pledge status, pastoral gratitude note,
 * official church letterhead, and dual signature lines.
 */

import React from 'react';
import { X, Printer, Heart } from 'lucide-react';
import type { MemberGivingStatement } from '@church/domain';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';

interface MemberStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: MemberGivingStatement | null;
}

export const MemberStatementModal: React.FC<MemberStatementModalProps> = ({
  isOpen,
  onClose,
  statement,
}) => {
  if (!isOpen || !statement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-3xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Top Screen Actions Bar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>Official Church Financial Contribution Statement</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 text-white text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-[var(--radius)] text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Document */}
        <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white">
          {/* Church Header Banner */}
          <ChurchLetterhead
            documentTitle="Member Giving Statement"
            documentNumber={statement.statementNumber}
            documentDate={statement.statementDate}
            periodText={`${statement.periodStart} to ${statement.periodEnd}`}
            currency="GHS"
            churchName={statement.churchName}
            branchName={statement.branchName}
          />

          {/* Member & Period Info Card */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Member Details</span>
              <div className="font-bold text-sm text-slate-900">{statement.memberName}</div>
              {statement.memberNumber && (
                <div className="text-slate-600">Member No: <span className="font-mono font-semibold">{statement.memberNumber}</span></div>
              )}
              {statement.envelopeNumber && (
                <div className="text-slate-600">Giving Envelope: <span className="font-mono font-semibold">{statement.envelopeNumber}</span></div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Statement Period</span>
              <div className="font-semibold text-slate-900">
                {statement.periodStart} to {statement.periodEnd}
              </div>
              <div className="text-slate-600">Currency: <span className="font-bold text-[var(--accent)]">Ghana Cedis (GHS)</span></div>
            </div>
          </div>

          {/* Detailed Contributions Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Contribution Itemization
            </h3>
            <div className="border border-slate-200 rounded-[var(--radius)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-left font-bold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Fund</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3 text-right">Amount (GHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {statement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                        No giving records found for this period.
                      </td>
                    </tr>
                  ) : (
                    statement.lines.map((l) => (
                      <tr key={l.receiptNumber} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500 font-mono">{l.serviceDate}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{l.receiptNumber}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{l.category}</td>
                        <td className="py-2 px-3 text-slate-500">{l.fundName}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{l.paymentMethod}</td>
                        <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 tabular-nums">
                          {(Number(l.amountPesewas) / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Summary & Pledge Progress Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Breakdown */}
            <div className="p-3.5 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Giving by Category</span>
              {statement.byCategory.map((cat) => (
                <div key={cat.category} className="flex justify-between">
                  <span className="text-slate-700">{cat.category}:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    GHS {(Number(cat.totalPesewas) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Pledge Fulfillment */}
            <div className="p-3.5 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Building & Special Pledges</span>
              {statement.pledgeCampaigns.length === 0 ? (
                <p className="text-slate-400 italic">No active pledges registered.</p>
              ) : (
                statement.pledgeCampaigns.map((p) => (
                  <div key={p.campaignName} className="space-y-0.5">
                    <div className="font-semibold text-slate-800">{p.campaignName}</div>
                    <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>Pledged: GHS {(Number(p.pledgedPesewas) / 100).toFixed(2)}</span>
                      <span>Paid: GHS {(Number(p.fulfilledPesewas) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Grand Total Box in Words and Figures */}
          <div className="p-4 rounded-[var(--radius)] bg-slate-50 border-2 border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-sm font-bold text-slate-900">
              <span>TOTAL FINANCIAL CONTRIBUTIONS:</span>
              <span className="text-lg font-bold font-mono text-[var(--accent)] tabular-nums">{statement.totalContributedFigures}</span>
            </div>
            <p className="text-xs italic text-slate-700 pt-1 border-t border-slate-200">
              Amount in words: <span className="font-semibold">{statement.totalContributedWords}</span>
            </p>
          </div>

          {/* Official Gratitude Text */}
          <div className="p-3.5 rounded-[var(--radius)] bg-slate-50 border border-slate-200 text-xs text-slate-700 italic flex items-start gap-2.5">
            <Heart className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{statement.officialGratitudeText}</span>
          </div>

          {/* Dual Signatures */}
          <DualSignatureBlock
            preparedBy={{
              label: 'Certified by',
              name: statement.certifyingOfficer,
              role: statement.certifyingOfficerRole,
              signaturePlaceholder: '(Certified Digitally)',
            }}
            approvedBy={{
              label: 'Senior Pastor Endorsement',
              name: 'Rev. Emmanuel Appiah',
              role: 'Senior Pastor / Minister in Charge',
              signaturePlaceholder: '(Endorsed)',
            }}
            showStampBox={true}
          />
        </div>
      </div>
    </div>
  );
};
