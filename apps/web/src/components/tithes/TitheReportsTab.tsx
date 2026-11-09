import React, { useState, useMemo } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../utils/formatters.js';
import { exportReportToExcel } from '../../utils/exports/index.js';
import { calculateMemberTitheSummary } from '@church/domain';

type ReportSubTab = 'participation' | 'summary' | 'members' | 'unallocated';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const TitheReportsTab: React.FC = () => {
  const { batches, records, getParticipationStats, canViewIndividualTithes, logExport } = useTithes();
  const { members } = useGiving();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('participation');
  const [selectedPeriod] = useState('2026-10');

  const stats = useMemo(() => {
    return getParticipationStats(selectedPeriod, 'GHS');
  }, [getParticipationStats, selectedPeriod]);

  // Aggregate monthly data
  const monthlyAggregates = useMemo(() => {
    const map: Record<string, { month: string; amount: bigint; count: number }> = {};
    MONTH_NAMES.forEach((m, idx) => {
      const monthNum = (idx + 1).toString().padStart(2, '0');
      map[`2026-${monthNum}`] = { month: `${m} 2026`, amount: 0n, count: 0 };
    });

    records.forEach((r) => {
      if (r.currency === 'GHS' && !r.isReversal) {
        const periodKey = r.recordDate.slice(0, 7);
        if (map[periodKey]) {
          map[periodKey].amount += r.amount;
          map[periodKey].count += 1;
        }
      }
    });

    return Object.entries(map).map(([key, data]) => ({
      key,
      ...data,
    }));
  }, [records]);

  // Member monthly grid
  const memberGridData = useMemo(() => {
    if (!canViewIndividualTithes) return [];
    return members.map((m) => {
      const name = `${m.title ? m.title + ' ' : ''}${m.fullName || `${m.firstName} ${m.lastName}`}`;
      return calculateMemberTitheSummary(m.id, name, records, 2026, 10, m.envelopeNumber, 'GHS');
    }).sort((a, b) => b.ytdTotal < a.ytdTotal ? -1 : b.ytdTotal > a.ytdTotal ? 1 : 0);
  }, [members, records, canViewIndividualTithes]);

  const handleExportMemberGrid = () => {
    logExport('excel', memberGridData.length);
    const data = memberGridData.map((m) => ({
      Member: m.memberName,
      Envelope: m.envelopeNumber || '—',
      YTDTotalGHS: Number(m.ytdTotal) / 100,
      MonthsPaid: `${m.monthsPaidCount} / ${m.monthsElapsedCount}`,
      ConsistencyPct: `${m.consistencyPercentage}%`,
      Jan: Number(m.monthlyTotals[1] || 0n) / 100,
      Feb: Number(m.monthlyTotals[2] || 0n) / 100,
      Mar: Number(m.monthlyTotals[3] || 0n) / 100,
      Apr: Number(m.monthlyTotals[4] || 0n) / 100,
      May: Number(m.monthlyTotals[5] || 0n) / 100,
      Jun: Number(m.monthlyTotals[6] || 0n) / 100,
      Jul: Number(m.monthlyTotals[7] || 0n) / 100,
      Aug: Number(m.monthlyTotals[8] || 0n) / 100,
      Sep: Number(m.monthlyTotals[9] || 0n) / 100,
      Oct: Number(m.monthlyTotals[10] || 0n) / 100,
    }));

    exportReportToExcel(data, 'member_tithes_grid_2026', {
      title: 'ANNUAL MEMBER TITHES REGISTER 2026',
      currency: 'GHS',
    });
    showToast('Exported annual member tithes register to Excel. Action logged.', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--surface-border)]">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveSubTab('participation')}
            className={`pb-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              activeSubTab === 'participation'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Participation & Demographics (Anonymous)
          </button>
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`pb-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              activeSubTab === 'summary'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Monthly Trends & Comparisons
          </button>
          <button
            onClick={() => setActiveSubTab('unallocated')}
            className={`pb-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              activeSubTab === 'unallocated'
                ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Unallocated & Batch Reconciliation Audit
          </button>
          {canViewIndividualTithes && (
            <button
              onClick={() => setActiveSubTab('members')}
              className={`pb-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                activeSubTab === 'members'
                  ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Member Tithes Register (Restricted)
            </button>
          )}
        </div>
      </div>

      {/* 1. Participation & Demographics (Anonymous, Spec 2.5) */}
      {activeSubTab === 'participation' && (
        <div className="space-y-5">
          {/* Key Indicators (Single Status Line, No Cards) */}
          <div className="py-2.5 px-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-4 text-[13px] text-[var(--text-primary)]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span>
                Period: <strong>{selectedPeriod}</strong>
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>
                Active Congregation: <strong>{stats.activeMemberCount} members</strong>
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>
                Contributing Givers: <strong>{stats.totalPayers}</strong> ({stats.participationPercentage}%)
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>
                Average Tithe: <strong><MoneyCell amount={stats.averageTitheAmount} currency="GHS" /></strong>
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>
                Median Tithe: <strong><MoneyCell amount={stats.medianTitheAmount} currency="GHS" /></strong>
              </span>
            </div>

            <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
              <span>Statistical counts only · Names strictly protected</span>
            </div>
          </div>

          {/* Distribution Bands Table */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
            <div className="p-3.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)]">
              <h4 className="font-semibold text-[13px] text-[var(--text-primary)]">
                Tithe Contribution Distribution Bands (October 2026)
              </h4>
              <p className="text-[12px] text-[var(--text-muted)]">
                Distribution of giving amounts into standardized governance bands without individual donor identities.
              </p>
            </div>
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-medium">
                  <th className="py-2.5 px-4">Giving Band</th>
                  <th className="py-2.5 px-4 text-center">Number of Givers</th>
                  <th className="py-2.5 px-4 text-center">% of Contributing Members</th>
                  <th className="py-2.5 px-4 text-right">Total Contributed in Band (GHS)</th>
                  <th className="py-2.5 px-4 w-48">Band Proportion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {stats.bands.map((band) => (
                  <tr key={band.id} className="hover:bg-[var(--surface-subtle)]/40">
                    <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                      {band.label}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold tabular-nums text-[var(--text-primary)]">
                      {band.count}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-[var(--text-primary)]">
                      {band.percentage}%
                    </td>
                    <td className="py-3 px-4 text-right font-medium tabular-nums text-[var(--text-primary)]">
                      <MoneyCell amount={band.totalAmount} currency="GHS" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-[var(--surface-subtle)] rounded-full h-2 overflow-hidden border border-[var(--surface-border)]">
                        <div
                          className="bg-[var(--accent)] h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, band.percentage)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--text-primary)] font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)]">
                  <td className="py-2.5 px-4">Total Contributing Tithe Givers</td>
                  <td className="py-2.5 px-4 text-center">{stats.totalPayers}</td>
                  <td className="py-2.5 px-4 text-center">100.0%</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    <MoneyCell amount={stats.totalTitheAmount} currency="GHS" />
                  </td>
                  <td className="py-2.5 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Monthly Trends & Comparisons */}
      {activeSubTab === 'summary' && (
        <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
          <div className="p-3.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)]">
            <h4 className="font-semibold text-[13px] text-[var(--text-primary)]">
              2026 Monthly Tithe Income Trajectory
            </h4>
            <p className="text-[12px] text-[var(--text-muted)]">
              Monthly aggregated tithes received across Sunday envelope batches, MoMo, and direct banking channels.
            </p>
          </div>
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-medium">
                <th className="py-2.5 px-4">Period</th>
                <th className="py-2.5 px-4 text-center">Gifts Recorded</th>
                <th className="py-2.5 px-4 text-right">Total Tithe Income (GHS)</th>
                <th className="py-2.5 px-4 text-right">Trend vs Previous Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {monthlyAggregates.map((row, idx) => {
                const prev = idx > 0 ? (monthlyAggregates[idx - 1]?.amount ?? 0n) : 0n;
                const diff = row.amount - prev;
                const pct = prev > 0n ? Math.round(Number(diff * 100n / prev)) : 0;

                return (
                  <tr key={row.key} className="hover:bg-[var(--surface-subtle)]/40">
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                      {row.month}
                    </td>
                    <td className="py-2.5 px-4 text-center tabular-nums text-[var(--text-muted)]">
                      {row.count > 0 ? row.count : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium tabular-nums text-[var(--text-primary)]">
                      <MoneyCell amount={row.amount} currency="GHS" />
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[12px]">
                      {idx === 0 || prev === 0n ? (
                        <span className="text-[var(--text-muted)]">—</span>
                      ) : diff > 0n ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          +{pct}% ({formatPesewas(diff)} GHS)
                        </span>
                      ) : diff < 0n ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {pct}% ({formatPesewas(diff)} GHS)
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0%</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Unallocated & Batch Reconciliations */}
      {activeSubTab === 'unallocated' && (
        <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
          <div className="p-3.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)]">
            <h4 className="font-semibold text-[13px] text-[var(--text-primary)]">
              Sub-Ledger Batch Reconciliation Audit Log
            </h4>
            <p className="text-[12px] text-[var(--text-muted)]">
              Every tithe batch reconciliation ties directly to a Sunday counting sheet. Differences must be explained before month close.
            </p>
          </div>
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-medium">
                <th className="py-2.5 px-4">Service Date</th>
                <th className="py-2.5 px-4">Counting Sheet Ref</th>
                <th className="py-2.5 px-4 text-right">Counted (GHS)</th>
                <th className="py-2.5 px-4 text-right">Allocated (GHS)</th>
                <th className="py-2.5 px-4 text-right">Unallocated Difference</th>
                <th className="py-2.5 px-4">Audit Explanation</th>
                <th className="py-2.5 px-4">Reconciled / Posted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-[var(--surface-subtle)]/40">
                  <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                    {formatDate(batch.serviceDate)}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)] font-mono text-[12px]">
                    {batch.countingSheetId}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={batch.countedTotal} currency={batch.currency} />
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-[var(--text-primary)]">
                    <MoneyCell amount={batch.allocatedTotal} currency={batch.currency} />
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <span
                      className={
                        batch.unallocatedTotal > 0n
                          ? 'text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-[var(--text-muted)]'
                      }
                    >
                      <MoneyCell amount={batch.unallocatedTotal} currency={batch.currency} />
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[12px] text-[var(--text-muted)] max-w-xs">
                    {batch.unallocatedReason || (batch.unallocatedTotal === 0n ? 'Reconciled to zero.' : 'Pending counter explanation.')}
                  </td>
                  <td className="py-3 px-4 text-[12px] text-[var(--text-muted)]">
                    {batch.postedBy ? `Posted by ${batch.postedBy}` : batch.reconciledBy ? `Reconciled by ${batch.reconciledBy}` : 'Draft'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Member Tithes Register (Restricted, Spec 2.5) */}
      {activeSubTab === 'members' && canViewIndividualTithes && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[var(--text-muted)]">
              Alphabetical register of all active members showing year-to-date monthly tithe amounts (GHS).
            </p>
            <button
              onClick={handleExportMemberGrid}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Annual Register (Excel)</span>
            </button>
          </div>

          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-x-auto">
            <table className="w-full text-[12px] text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
                  <th className="py-2 px-3 sticky left-0 bg-[var(--surface-subtle)]">Member Name</th>
                  <th className="py-2 px-2 text-center">Env</th>
                  <th className="py-2 px-2 text-center">Months</th>
                  <th className="py-2 px-2 text-center">%</th>
                  <th className="py-2 px-2 text-right">Jan</th>
                  <th className="py-2 px-2 text-right">Feb</th>
                  <th className="py-2 px-2 text-right">Mar</th>
                  <th className="py-2 px-2 text-right">Apr</th>
                  <th className="py-2 px-2 text-right">May</th>
                  <th className="py-2 px-2 text-right">Jun</th>
                  <th className="py-2 px-2 text-right">Jul</th>
                  <th className="py-2 px-2 text-right">Aug</th>
                  <th className="py-2 px-2 text-right">Sep</th>
                  <th className="py-2 px-2 text-right font-semibold">Oct</th>
                  <th className="py-2 px-3 text-right font-bold">YTD Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {memberGridData.map((m) => (
                  <tr key={m.memberId} className="hover:bg-[var(--surface-subtle)]/40">
                    <td className="py-2 px-3 font-medium text-[var(--text-primary)] whitespace-nowrap sticky left-0 bg-[var(--surface-panel)]">
                      {m.memberName}
                    </td>
                    <td className="py-2 px-2 text-center text-[var(--text-muted)] font-mono text-[11px]">
                      {m.envelopeNumber?.replace('ENV-', '') || '—'}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-[var(--text-muted)]">
                      {m.monthsPaidCount}/{m.monthsElapsedCount}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-[var(--text-muted)]">
                      {m.consistencyPercentage}%
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((monthNum) => {
                      const val = m.monthlyTotals[monthNum] || 0n;
                      return (
                        <td
                          key={monthNum}
                          className={`py-2 px-2 text-right tabular-nums ${
                            val > 0n ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-muted)]/40'
                          }`}
                        >
                          {val > 0n ? (Number(val) / 100).toFixed(0) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-bold tabular-nums text-[var(--text-primary)]">
                      <MoneyCell amount={m.ytdTotal} currency="GHS" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function formatPesewas(amount: bigint): string {
  const isNeg = amount < 0n;
  const abs = isNeg ? -amount : amount;
  const major = abs / 100n;
  const minor = abs % 100n;
  const formatted = `${major.toLocaleString('en-US')}.${minor.toString().padStart(2, '0')}`;
  return isNeg ? `(${formatted})` : formatted;
}
