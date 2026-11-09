import React, { useState } from 'react';
import { Send, FileText, Settings, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../utils/formatters.js';
import { RemittanceRuleModal } from './RemittanceRuleModal.js';
import { PayRemittanceModal } from './PayRemittanceModal.js';
import { DenominationalRemittanceStatementModal } from './DenominationalRemittanceStatementModal.js';
import type { TitheRemittance } from '@church/domain';

function formatPeriodName(period: string): string {
  const parts = period.split('-');
  const y = parts[0];
  const m = parseInt(parts[1] ?? '0', 10);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (m >= 1 && m <= 12) {
    return `${monthNames[m - 1]} ${y}`;
  }
  return period;
}

export const TitheRemittanceTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { remittanceRules, remittances, accrueMonthlyRemittance } = useTithes();
  const { showToast } = useToast();

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [selectedRemittanceForPay, setSelectedRemittanceForPay] = useState<TitheRemittance | null>(
    null
  );
  const [selectedRemittanceForStatement, setSelectedRemittanceForStatement] =
    useState<TitheRemittance | null>(null);

  const isTreasurer = currentUser?.role === 'Treasurer';
  const activeRule = remittanceRules.find((r) => r.isActive) || remittanceRules[0];

  // Accrue / Refresh October 2026 remittance
  const handleAccrueCurrentMonth = () => {
    try {
      accrueMonthlyRemittance('2026-10');
      showToast('October 2026 tithe remittance accrued and general ledger journal posted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to accrue remittance.', 'error');
    }
  };

  // Sort remittances by period descending
  const sortedRemittances = [...remittances].sort((a, b) => b.period.localeCompare(a.period));

  // Compute total outstanding balance across all periods
  const totalOutstanding = remittances.reduce((sum, r) => sum + r.balanceOutstanding, 0n);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Policy Summary Line (Rule A3) */}
      <div className="py-2.5 px-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--text-primary)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {activeRule ? (
            <>
              <span className="font-semibold">
                Active Rule: {activeRule.name} ({activeRule.basis === 'PERCENTAGE' ? `${activeRule.percentageOrAmount}% of monthly gross tithes` : `Fixed ${activeRule.currency}`})
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Due: {activeRule.dueDayOfMonth}th of following month</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Payee: {activeRule.payeeName}</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>Currency: {activeRule.currency}</span>
            </>
          ) : (
            <span className="text-[var(--text-muted)] italic">
              No denominational remittance rule configured yet.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isTreasurer && (
            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="px-2.5 py-1 text-[12px] font-medium border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Configure Rule
            </button>
          )}
          {activeRule && isTreasurer && (
            <button
              onClick={handleAccrueCurrentMonth}
              className="px-2.5 py-1 text-[12px] font-medium border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-1.5"
              title="Recalculate or post monthly accrual to general ledger"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Recalculate Accrual
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Line (No Cards, Rule A2) */}
      <div className="py-2 px-4 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between text-[13px]">
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-muted)]">Outstanding Remittance Liability:</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
            <MoneyCell amount={totalOutstanding} currency="GHS" />
          </span>
        </div>
        <div className="text-[12px] text-[var(--text-muted)]">
          Dr Denominational Remittance Expense (<code>acct-5060</code>) · Cr Remittances Payable (<code>acct-2050</code>)
        </div>
      </div>

      {/* Remittance Schedule Table */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-x-auto">
        <div className="p-3.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-[13px] text-[var(--text-primary)]">
              Monthly Denominational Remittance Schedule
            </h4>
            <p className="text-[12px] text-[var(--text-muted)]">
              Accrues monthly liability owed to higher church authorities (District / Headquarters) based on received tithes.
            </p>
          </div>
        </div>

        <table className="w-full text-[13px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
              <th className="py-2.5 px-3">Period</th>
              <th className="py-2.5 px-3 text-right">Gross Tithes Received</th>
              <th className="py-2.5 px-3 text-center">Share / Basis</th>
              <th className="py-2.5 px-3 text-right">Amount Accrued</th>
              <th className="py-2.5 px-3 text-right">Amount Paid</th>
              <th className="py-2.5 px-3 text-right">Balance Due</th>
              <th className="py-2.5 px-3">Due Date</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {sortedRemittances.map((rem) => {
              const isOverdue = rem.status === 'OVERDUE' || (rem.balanceOutstanding > 0n && rem.dueDate < '2026-11-02');
              const isPaid = rem.status === 'FULLY_PAID' || rem.balanceOutstanding <= 0n;

              return (
                <tr
                  key={rem.id}
                  className={`hover:bg-[var(--surface-subtle)]/40 ${
                    !isPaid ? 'bg-[var(--surface-subtle)]/20' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {formatPeriodName(rem.period)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={rem.tithesBasisGhs} currency={rem.currency} />
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums text-[var(--text-muted)]">
                    {rem.rateUsed || '10%'}
                  </td>
                  <td className="py-3 px-3 text-right font-medium tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={rem.amountDue} currency={rem.currency} />
                  </td>
                  <td className="py-3 px-3 text-right font-medium tabular-nums text-[var(--text-muted)]">
                    <MoneyCell amount={rem.amountPaid} currency={rem.currency} />
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-semibold tabular-nums ${
                      !isPaid ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <MoneyCell amount={rem.balanceOutstanding} currency={rem.currency} />
                  </td>
                  <td className="py-3 px-3 text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
                    {formatDate(rem.dueDate)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Paid
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3" />
                        Accrued
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedRemittanceForStatement(rem)}
                        className="px-2.5 py-1 rounded text-[12px] font-medium border border-[var(--surface-border)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] flex items-center gap-1"
                        title="Print official denominational remittance statement"
                      >
                        <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        Statement
                      </button>

                      {!isPaid ? (
                        <button
                          onClick={() => setSelectedRemittanceForPay(rem)}
                          className="px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Pay via Voucher
                        </button>
                      ) : (
                        <span className="text-[12px] font-mono text-[var(--text-muted)] pl-2">
                          {rem.voucherIds[0] || 'Settled'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Accounting Note */}
      <div className="p-3.5 border border-dashed border-[var(--surface-border)] rounded-[var(--radius)] text-[12px] text-[var(--text-muted)] leading-relaxed">
        <strong>Dual-Control Remittance Accounting: </strong>
        Remittances are calculated automatically based on gross tithes collected and accrued monthly to <code>acct-2050</code> (Denominational Remittances Payable). Disbursements are executed via approved payment vouchers, posting an audit-tracked cashbook credit and debiting remittances payable.
      </div>

      {/* Modals */}
      {isRuleModalOpen && (
        <RemittanceRuleModal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          existingRule={activeRule}
        />
      )}

      {selectedRemittanceForPay && (
        <PayRemittanceModal
          isOpen={!!selectedRemittanceForPay}
          onClose={() => setSelectedRemittanceForPay(null)}
          remittance={selectedRemittanceForPay}
        />
      )}

      {selectedRemittanceForStatement && (
        <DenominationalRemittanceStatementModal
          isOpen={!!selectedRemittanceForStatement}
          onClose={() => setSelectedRemittanceForStatement(null)}
          remittance={selectedRemittanceForStatement}
        />
      )}
    </div>
  );
};
