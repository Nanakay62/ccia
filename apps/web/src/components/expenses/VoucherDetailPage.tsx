import React, { useState } from 'react';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { useApprovals } from '../../context/ApprovalContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { StatusDot } from '../ui/StatusDot.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { PrintableVoucherModal } from './PrintableVoucherModal.js';
import { formatDate } from '../../config/churchSettings.js';
import {
  Printer,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export interface VoucherDetailPageProps {
  id: string;
}

export const VoucherDetailPage: React.FC<VoucherDetailPageProps> = ({ id }) => {
  const { vouchers } = useExpenses();
  const { navigate, goBack } = useRouter();
  const { getPendingChangesForEntity, getRecentApprovedChangeForEntity } = useApprovals();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const voucher = vouchers.find((v) => v.id === id || v.voucherNumber === id);

  if (!voucher) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Expenditure', onClick: () => navigate('#/expenses') },
            { label: 'Vouchers', onClick: () => navigate('#/expenses') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('expenses')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Payment voucher <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('expenses')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Vouchers
          </button>
        </div>
      </div>
    );
  }

  const targetEntityId = voucher.vendorId || voucher.payeeName || '';
  const pendingChange =
    getPendingChangesForEntity(targetEntityId)[0] ||
    getPendingChangesForEntity(voucher.payeeName)[0];
  const recentApprovedChange =
    getRecentApprovedChangeForEntity(targetEntityId) ||
    getRecentApprovedChangeForEntity(voucher.payeeName);

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Expenditure', onClick: () => navigate('#/expenses') },
          { label: 'Payment Vouchers', onClick: () => navigate('#/expenses') },
          { label: voucher.voucherNumber },
        ]}
        currentId={voucher.id}
        listKey="vouchers"
        onBack={() => goBack('expenses')}
        actions={
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px] font-semibold rounded-[var(--radius)] transition shadow-2xs"
          >
            <Printer className="w-4 h-4 text-[var(--accent)]" />
            <span>Print Official Voucher</span>
          </button>
        }
      />

      {/* Controlled Payment Details Highlight Banner (Spec Section C4) */}
      {recentApprovedChange && (
        <div className="p-4 rounded-[var(--radius)] bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200 block">
              Payment Details Verified (Spec Section C4)
            </span>
            <p className="text-[12px] text-emerald-800 dark:text-emerald-300">
              Payment destination for this payee was changed by {recentApprovedChange.changedByUserName} and authorized by{' '}
              {recentApprovedChange.approvedByUserName || 'an officer'}. Disbursed to destination:{' '}
              <strong className="font-mono">{recentApprovedChange.newValue}</strong> (historical value:{' '}
              <span className="font-mono">{recentApprovedChange.oldValue}</span> preserved).
            </p>
          </div>
        </div>
      )}

      {pendingChange && (
        <div className="p-4 rounded-[var(--radius)] bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[13px] font-bold text-amber-900 dark:text-amber-200 block">
              Pending Detail Change Notice
            </span>
            <p className="text-[12px] text-amber-800 dark:text-amber-300">
              A pending modification for this payee's details ({pendingChange.newValue}) has not received dual-custody authorization. Under Spec C4, this voucher was disbursed to the existing verified destination.
            </p>
          </div>
        </div>
      )}

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Header Block */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Payment Voucher</span>
            <h1 className="font-semibold text-[20px] text-[var(--text-primary)]">
              {voucher.voucherNumber}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <StatusDot
              status="paid"
              label="Disbursed / Paid"
            />
            <span className="text-[12px] text-[var(--text-muted)] ml-2">
              {formatDate(voucher.createdAt.slice(0, 10))}
            </span>
          </div>
        </div>

        {/* Amount & Payee Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
          <div>
            <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-1">
              Net Amount Disbursed
            </span>
            <MoneyCell amountPesewas={voucher.netPayablePesewas} size="xl" align="left" />
          </div>

          <div>
            <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-1">
              Paid To (Payee)
            </span>
            <span className="font-semibold text-[17px] text-[var(--text-primary)] block">
              {voucher.payeeName}
            </span>
            <span className="text-[12px] text-[var(--text-muted)] mt-0.5 block">
              Method: {voucher.paymentMethod.replace(/_/g, ' ')}
              {voucher.chequeNumber && ` · Cheque #${voucher.chequeNumber}`}
              {voucher.momoReference && ` · Ref: ${voucher.momoReference}`}
            </span>
          </div>
        </div>

        {/* WHT & Accounting Breakdown Table */}
        <div className="space-y-3">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
            Accounting & Tax Breakdown (Ghana WHT)
          </span>

          <div className="overflow-x-auto border border-[var(--surface-border)] rounded-[var(--radius)]">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Description</th>
                  <th className="py-2.5 px-4 font-medium text-center">Tax Rate</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] font-sans tabular-nums">
                <tr>
                  <td className="py-2.5 px-4 text-[var(--text-primary)]">
                    Gross Invoiced Expense
                  </td>
                  <td className="py-2.5 px-4 text-center text-[var(--text-muted)]">—</td>
                  <td className="py-2.5 px-4 text-right">
                    <MoneyCell amountPesewas={voucher.grossAmountPesewas} align="right" size="sm" />
                  </td>
                </tr>
                {Number(voucher.withholdingTaxPesewas) > 0 && (
                  <tr className="text-[var(--text-secondary)]">
                    <td className="py-2.5 px-4">
                      Less: GRA Withholding Tax (WHT Liability)
                    </td>
                    <td className="py-2.5 px-4 text-center">{voucher.withholdingTaxRate}</td>
                    <td className="py-2.5 px-4 text-right text-[var(--status-amber)]">
                      − <MoneyCell amountPesewas={voucher.withholdingTaxPesewas} align="right" size="sm" />
                    </td>
                  </tr>
                )}
                <tr className="bg-[var(--surface-subtle)]/50 font-semibold text-[var(--text-primary)]">
                  <td className="py-3 px-4">Net Payment Disbursed</td>
                  <td className="py-3 px-4 text-center">—</td>
                  <td className="py-3 px-4 text-right">
                    <MoneyCell amountPesewas={voucher.netPayablePesewas} align="right" size="base" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Narrative & Requisition link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border-subtle)] text-[14px]">
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Purpose / Narration</span>
            <p className="text-[var(--text-primary)] mt-1 leading-relaxed">
              {voucher.purpose}
            </p>
          </div>

          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Linked Requisition</span>
            {voucher.requisitionId ? (
              <button
                type="button"
                onClick={() => navigate(`#/requisitions/${encodeURIComponent(voucher.requisitionId!)}`)}
                className="mt-1 text-[var(--accent)] font-semibold hover:underline flex items-center gap-1"
              >
                <span>View Approved Requisition</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[var(--text-muted)] mt-1 block">
                Direct statutory / exempted disbursement
              </span>
            )}
          </div>
        </div>

        {/* Audit Signoff Line */}
        <div className="pt-4 border-t border-[var(--surface-border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span>Prepared by {voucher.preparedByName}</span>
          </div>
          <span>Offline ID: {voucher.id}</span>
        </div>
      </div>

      {/* Printable Voucher Modal */}
      {isPrintModalOpen && (
        <PrintableVoucherModal
          voucher={voucher}
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
