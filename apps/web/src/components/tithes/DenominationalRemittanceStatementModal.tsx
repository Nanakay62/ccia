import React from 'react';
import { X, Printer } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { ChurchLetterhead } from '../common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../common/DualSignatureBlock.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../utils/formatters.js';
import type { TitheRemittance } from '@church/domain';

interface DenominationalRemittanceStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  remittance: TitheRemittance | null;
}

export const DenominationalRemittanceStatementModal: React.FC<
  DenominationalRemittanceStatementModalProps
> = ({ isOpen, onClose, remittance }) => {
  const { batches, records, remittanceRules, logStatementPrint } = useTithes();

  if (!isOpen || !remittance) return null;

  const rule = remittanceRules.find((r) => r.id === remittance.ruleId);
  const payeeName = rule?.payeeName || 'Accra District Office';

  // Batches for this period
  const periodBatches = batches.filter((b) => b.serviceDate.startsWith(remittance.period));
  // Direct tithes for this period
  const directRecords = records.filter(
    (r) => !r.batchId && r.recordDate.startsWith(remittance.period) && !r.isReversal
  );

  const handlePrint = () => {
    logStatementPrint('district-office', payeeName);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn print:border-none print:shadow-none print:max-w-full">
        {/* Modal Controls (Hidden in print) */}
        <div className="px-6 py-3 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)] print:hidden">
          <span className="font-semibold text-[13px] text-[var(--text-primary)]">
            Denominational Remittance Statement · {remittance.period}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius)] bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Print Statement
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-border)]/50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 space-y-6 text-[var(--text-primary)] print:p-6 bg-white">
          {/* Official Letterhead */}
          <ChurchLetterhead
            documentTitle="Denominational Tithe Remittance Statement"
            periodText={`Period: ${remittance.period}`}
          />

          {/* Statement Header */}
          <div className="border-t border-b border-stone-300 py-3 text-center space-y-1">
            <h2 className="text-[16px] font-bold tracking-wide uppercase text-stone-900 font-serif">
              Denominational Tithe Remittance Statement
            </h2>
            <p className="text-[13px] text-stone-600">
              Official Assessment and Remittance Schedule for {payeeName}
            </p>
          </div>

          {/* Statement Metadata */}
          <div className="grid grid-cols-2 gap-4 text-[13px] border border-stone-200 rounded p-4 bg-stone-50/50">
            <div>
              <div className="text-stone-500 text-[12px]">Remittance Period</div>
              <div className="font-semibold text-stone-900">{remittance.period}</div>
              <div className="text-stone-500 text-[12px] mt-2">Denominational Body / Payee</div>
              <div className="font-medium text-stone-900">{payeeName}</div>
            </div>
            <div className="text-right">
              <div className="text-stone-500 text-[12px]">Assessment Due Date</div>
              <div className="font-semibold text-stone-900">
                {formatDate(remittance.dueDate)}
              </div>
              <div className="text-stone-500 text-[12px] mt-2">Remittance Status</div>
              <div className="font-medium text-stone-900">
                {remittance.status === 'FULLY_PAID' ? 'Fully Settled' : remittance.status}
              </div>
            </div>
          </div>

          {/* Section 1: Gross Tithes Collections Breakdown */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-1">
              1. Gross Tithes Collections Breakdown
            </h3>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-medium text-left">
                  <th className="py-1.5">Date</th>
                  <th className="py-1.5">Service / Collection Source</th>
                  <th className="py-1.5 text-center">Envelopes</th>
                  <th className="py-1.5 text-right">Amount ({remittance.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {periodBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-1.5 text-stone-700">{formatDate(b.serviceDate)}</td>
                    <td className="py-1.5 font-medium text-stone-900">{b.serviceName}</td>
                    <td className="py-1.5 text-center text-stone-600">{b.recordsCount}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-stone-900">
                      <MoneyCell amount={b.countedTotal} currency={remittance.currency} />
                    </td>
                  </tr>
                ))}
                {directRecords.length > 0 && (
                  <tr>
                    <td className="py-1.5 text-stone-700">Throughout month</td>
                    <td className="py-1.5 font-medium text-stone-900">
                      Direct Non-Service Tithes (MoMo / Bank / Cheque)
                    </td>
                    <td className="py-1.5 text-center text-stone-600">{directRecords.length}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-stone-900">
                      <MoneyCell
                        amount={directRecords.reduce((sum, r) => sum + r.amount, 0n)}
                        currency={remittance.currency}
                      />
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-stone-300 font-bold bg-stone-50">
                  <td colSpan={3} className="py-2 text-stone-900">
                    Total Gross Tithes Received in Period
                  </td>
                  <td className="py-2 text-right tabular-nums text-stone-900 text-[13px]">
                    <MoneyCell amount={remittance.tithesBasisGhs} currency={remittance.currency} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Assessment Calculation */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-1">
              2. Assessment Calculation & Accrual
            </h3>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded text-[13px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-600">Applicable Assessment Rule:</span>
                <span className="font-medium text-stone-900">
                  {rule?.name || 'District Headquarters Assessment'} ({remittance.rateUsed || '10%'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Gross Tithes Assessment Basis:</span>
                <span className="tabular-nums text-stone-900">
                  <MoneyCell amount={remittance.tithesBasisGhs} currency={remittance.currency} />
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold">
                <span className="text-stone-900">Total Accrued Remittance Liability:</span>
                <span className="tabular-nums text-stone-900">
                  <MoneyCell amount={remittance.amountDue} currency={remittance.currency} />
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Disbursements & Settlement */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-1">
              3. Remittance Payments & Disbursements
            </h3>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-medium text-left">
                  <th className="py-1.5">Payment Voucher</th>
                  <th className="py-1.5">Reference / Notes</th>
                  <th className="py-1.5 text-right">Amount Paid ({remittance.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {remittance.voucherIds.length > 0 ? (
                  remittance.voucherIds.map((vId, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-mono text-stone-900 font-medium">{vId}</td>
                      <td className="py-1.5 text-stone-600">{remittance.notes || 'Settled'}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums text-stone-900">
                        <MoneyCell amount={remittance.amountPaid} currency={remittance.currency} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-2 text-stone-500 italic text-center">
                      No payment vouchers recorded yet for this period.
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-stone-300 font-bold bg-stone-50">
                  <td colSpan={2} className="py-2 text-stone-900">
                    Net Balance Outstanding Payable
                  </td>
                  <td className="py-2 text-right tabular-nums text-stone-900 text-[13px]">
                    <MoneyCell
                      amount={remittance.balanceOutstanding}
                      currency={remittance.currency}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: Dual Certification & Signatures */}
          <div className="pt-4">
            <DualSignatureBlock
              preparedBy={{
                label: 'Prepared by',
                name: 'Kofi Mensah',
                role: 'Treasurer / Finance Secretary',
                date: '31 Oct 2026',
              }}
              approvedBy={{
                label: 'Approved by',
                name: 'Rev. Emmanuel Addo',
                role: 'Head Pastor / Senior Elder',
                date: '02 Nov 2026',
              }}
              showStampBox={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
