import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { useTithes } from '../../context/TithesContext.js';
import type { MemberTitheSummary } from '@church/domain';

interface AnnualTitheStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: MemberTitheSummary;
  year?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AnnualTitheStatementModal: React.FC<AnnualTitheStatementModalProps> = ({
  isOpen,
  onClose,
  summary,
  year = 2026,
}) => {
  const { logStatementPrint } = useTithes();
  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      logStatementPrint(summary.memberId, summary.memberName);
    }
  }, [isOpen, summary.memberId, summary.memberName, logStatementPrint]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white animate-fadeIn">
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] shadow-2xl max-w-4xl w-full p-6 sm:p-8 print:border-none print:shadow-none print:p-4 my-8">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--surface-border)] print:hidden mb-6">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
              Annual Tithe Statement
            </h2>
            <span className="text-[13px] text-[var(--text-muted)]">
              · Confidential Document
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Document */}
        <div className="space-y-6 text-[var(--text-primary)]">
          <ChurchLetterhead
            documentTitle="OFFICIAL ANNUAL TITHE STATEMENT"
            documentNumber={`TS-${year}-${summary.envelopeNumber?.replace('ENV-', '') || summary.memberId.slice(-4)}`}
            documentDate={`31 Dec ${year}`}
            periodText={`01 Jan ${year} to 31 Dec ${year}`}
          />

          {/* Member & Confidential Recipient Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] print:bg-slate-50 print:border-slate-300">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Member Information
              </div>
              <div className="text-[15px] font-semibold text-[var(--text-primary)] mt-0.5">
                {summary.memberName}
              </div>
              <div className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Envelope: {summary.envelopeNumber || 'None'} · ID: {summary.memberId}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Statement Period
              </div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] mt-0.5">
                Tax Year {year} (YTD 31 Oct)
              </div>
              <div className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Months with Contributions: {summary.monthsPaidCount} of {summary.monthsElapsedCount}
              </div>
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] overflow-hidden print:border-slate-300">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] print:bg-slate-100 font-medium text-[var(--text-muted)] print:text-slate-700">
                  <th className="py-2.5 px-4">Month</th>
                  <th className="py-2.5 px-4 text-center">Gifts Recorded</th>
                  <th className="py-2.5 px-4">Primary Methods</th>
                  <th className="py-2.5 px-4 text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] print:divide-slate-200">
                {MONTH_NAMES.map((name, idx) => {
                  const monthNum = idx + 1;
                  const monthAmount = summary.monthlyTotals[monthNum] || 0n;
                  const monthRecords = summary.records.filter((r) => {
                    const [, m] = r.recordDate.split('-');
                    return parseInt(m ?? '0', 10) === monthNum && !r.isReversal;
                  });
                  const giftCount = monthRecords.length;
                  const methods = Array.from(new Set(monthRecords.map((r) => r.method))).join(', ') || '—';

                  return (
                    <tr key={name} className="hover:bg-[var(--surface-subtle)]/40">
                      <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                        {name} {year}
                      </td>
                      <td className="py-2 px-4 text-center text-[var(--text-muted)]">
                        {giftCount > 0 ? giftCount : '—'}
                      </td>
                      <td className="py-2 px-4 text-[var(--text-muted)] text-[12px]">
                        {methods}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums">
                        <MoneyCell amount={monthAmount} currency="GHS" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--text-primary)] font-semibold bg-[var(--surface-subtle)] print:bg-slate-100">
                  <td colSpan={3} className="py-3 px-4 text-[14px] text-[var(--text-primary)]">
                    Total Tithes Received for {year}
                  </td>
                  <td className="py-3 px-4 text-right text-[15px] font-bold tabular-nums">
                    <MoneyCell amount={summary.ytdTotal} currency="GHS" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Statutory Certification Text */}
          <div className="p-3.5 border border-dashed border-[var(--surface-border)] rounded-[var(--radius)] text-[12px] text-[var(--text-muted)] leading-relaxed print:border-slate-300">
            <strong className="text-[var(--text-primary)]">Official Certification: </strong>
            This certifies that the contributions listed above were received by Accra Central Grace Chapel solely as voluntary ecclesiastical tithes in furtherance of religious, charitable, and gospel activities. In accordance with the Ghana Revenue Authority (GRA) Charitable Giving guidelines and church bylaws, no commercial goods, personal services, or tangible benefits were provided to the donor in exchange for these tithes.
          </div>

          {/* Dual Blank Signature Lines (Per UI Spec Section 2.6 & 6) */}
          <DualSignatureBlock
            preparedBy={{
              name: 'Akosua Osei',
              role: 'Finance Secretary',
              isSigned: false, // Blank signature line
            }}
            approvedBy={{
              name: 'Kofi Mensah',
              role: 'Treasurer',
              isSigned: false, // Blank signature line
            }}
            thirdSigner={{
              name: 'Rev. Emmanuel Addo',
              role: 'Senior Pastor',
              isSigned: false,
            }}
            showStampBox={true}
            footerText="Keep this official annual receipt for your family tax and personal financial records."
          />
        </div>
      </div>
    </div>
  );
};
