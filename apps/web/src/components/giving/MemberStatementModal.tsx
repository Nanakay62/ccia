/**
 * MemberStatementModal Component.
 * High-fidelity printable individual member giving statement
 * with Ghanaian legal tender phrasing, pledge status, and pastoral gratitude note.
 */

import React from 'react';
import { X, Printer, Landmark, Heart } from 'lucide-react';
import type { MemberGivingStatement } from '@church/domain';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Top Screen Actions Bar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Landmark className="w-4 h-4 text-blue-400" />
            <span>Official Church Financial Contribution Statement</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Document */}
        <div className="p-8 sm:p-10 space-y-6 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
          {/* Church Header Banner */}
          <div className="text-center pb-6 border-b-2 border-blue-900 space-y-1">
            <div className="flex items-center justify-center gap-2 text-blue-900 dark:text-blue-400">
              <Landmark className="w-6 h-6" />
              <span className="text-sm font-black tracking-widest uppercase">
                {statement.churchName}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {statement.branchName} • P.O. Box GP 1420, Accra, Ghana • Tel: +233 (0) 302 123 456
            </div>
            <h1 className="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white pt-2">
              Annual / Periodic Member Giving Statement
            </h1>
            <p className="text-xs text-slate-500">
              Statement No: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{statement.statementNumber}</span> • Generated:{' '}
              <span className="font-semibold">{statement.statementDate}</span>
            </p>
          </div>

          {/* Member & Period Info Card */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member Details</span>
              <div className="font-bold text-sm text-slate-900 dark:text-white">{statement.memberName}</div>
              {statement.memberNumber && (
                <div className="text-slate-500">Member No: <span className="font-mono font-semibold">{statement.memberNumber}</span></div>
              )}
              {statement.envelopeNumber && (
                <div className="text-slate-500">Giving Envelope: <span className="font-mono font-semibold">{statement.envelopeNumber}</span></div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statement Period</span>
              <div className="font-semibold text-slate-900 dark:text-white">
                {statement.periodStart} to {statement.periodEnd}
              </div>
              <div className="text-slate-500">Currency: <span className="font-bold text-blue-600">Ghana Cedis (GH₵)</span></div>
            </div>
          </div>

          {/* Detailed Contributions Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Contribution Itemization
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 text-left font-bold">
                  <th className="py-2">Date</th>
                  <th className="py-2">Receipt #</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Fund</th>
                  <th className="py-2">Channel</th>
                  <th className="py-2 text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {statement.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                      No giving records found for this period.
                    </td>
                  </tr>
                ) : (
                  statement.lines.map((l) => (
                    <tr key={l.receiptNumber} className="hover:bg-slate-50/50">
                      <td className="py-2 text-slate-500 font-mono">{l.serviceDate}</td>
                      <td className="py-2 font-mono text-slate-600 dark:text-slate-400">{l.receiptNumber}</td>
                      <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{l.category}</td>
                      <td className="py-2 text-slate-500">{l.fundName}</td>
                      <td className="py-2 text-slate-500 text-[11px]">{l.paymentMethod}</td>
                      <td className="py-2 font-mono font-bold text-right text-slate-900 dark:text-white">
                        {(Number(l.amountPesewas) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Category Summary & Pledge Progress Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giving by Category</span>
              {statement.byCategory.map((cat) => (
                <div key={cat.category} className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">{cat.category}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    GHS {(Number(cat.totalPesewas) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Pledge Fulfillment */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Building & Special Pledges</span>
              {statement.pledgeCampaigns.length === 0 ? (
                <p className="text-slate-400 italic">No active pledges registered.</p>
              ) : (
                statement.pledgeCampaigns.map((p) => (
                  <div key={p.campaignName} className="space-y-0.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{p.campaignName}</div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Pledged: GHS {(Number(p.pledgedPesewas) / 100).toFixed(2)}</span>
                      <span>Paid: GHS {(Number(p.fulfilledPesewas) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Grand Total Box in Words and Figures */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1">
            <div className="flex justify-between items-center text-sm font-bold text-blue-950 dark:text-blue-100">
              <span>TOTAL FINANCIAL CONTRIBUTIONS:</span>
              <span className="text-base font-black font-mono">{statement.totalContributedFigures}</span>
            </div>
            <p className="text-xs italic text-blue-800 dark:text-blue-200 pt-1 border-t border-blue-200 dark:border-blue-800">
              Amount in words: <span className="font-semibold">{statement.totalContributedWords}</span>
            </p>
          </div>

          {/* Official Gratitude Text */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 italic flex items-start gap-2.5">
            <Heart className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{statement.officialGratitudeText}</span>
          </div>

          {/* Signatures & Certification Block */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-8 text-xs text-slate-600 dark:text-slate-400">
            <div className="space-y-1">
              <div className="border-b border-slate-300 dark:border-slate-700 pb-8 text-slate-400 italic">
                Authorized Signature & Church Stamp
              </div>
              <p className="font-bold text-slate-900 dark:text-white">{statement.certifyingOfficer}</p>
              <p className="text-[10px]">{statement.certifyingOfficerRole}</p>
            </div>
            <div className="space-y-1 text-right">
              <div className="border-b border-slate-300 dark:border-slate-700 pb-8 text-slate-400 italic">
                Senior Pastor Endorsement
              </div>
              <p className="font-bold text-slate-900 dark:text-white">Rev. Emmanuel Appiah</p>
              <p className="text-[10px]">Senior Pastor / Minister in Charge</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
