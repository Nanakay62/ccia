import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Plus,
  RotateCcw,
  ShieldAlert,
  Lock,
  Eye,
} from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../utils/formatters.js';
import { exportReportToCSV, exportReportToExcel } from '../../utils/exports/index.js';
import { DateInput } from '../ui/DateInput.js';
import { useRouter } from '../../context/RouterContext.js';
import { DirectTitheModal } from './DirectTitheModal.js';
import type { TitheRecord } from '@church/domain';

export const TitheRecordsTab: React.FC = () => {
  const { records, canViewIndividualTithes, reverseTithe, logExport } = useTithes();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-31');

  const [isDirectTitheOpen, setIsDirectTitheOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<TitheRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Permission guard (Spec 2.6)
  if (!canViewIndividualTithes) {
    return (
      <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
        <Lock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
          Confidential Giving Records
        </h3>
        <p className="text-[13px] text-[var(--text-muted)] max-w-md mx-auto mt-1 leading-relaxed">
          Individual tithe records are restricted to the Treasurer, Finance Secretary, and authorized church leadership. You may view aggregated summaries and participation metrics under the <strong>Reports</strong> tab.
        </p>
      </div>
    );
  }

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (fromDate && r.recordDate < fromDate) return false;
      if (toDate && r.recordDate > toDate) return false;

      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (batchFilter === 'DIRECT' && r.batchId !== null) return false;
      if (batchFilter !== 'ALL' && batchFilter !== 'DIRECT' && r.batchId !== batchFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = r.memberName.toLowerCase().includes(term);
        const matchesEnv = r.envelopeNumber?.toLowerCase().includes(term);
        const matchesRef = r.notes?.toLowerCase().includes(term);
        if (!matchesName && !matchesEnv && !matchesRef) return false;
      }

      return true;
    });
  }, [records, fromDate, toDate, methodFilter, batchFilter, searchTerm]);

  const handleExportCSV = () => {
    logExport('csv', filteredRecords.length);
    const data = filteredRecords.map((r) => ({
      Date: formatDate(r.recordDate),
      Member: r.memberName,
      Envelope: r.envelopeNumber || '—',
      AmountGHS: (Number(r.amount) / 100).toFixed(2),
      Method: r.method,
      BatchRef: r.batchId || 'Direct',
      RecordedBy: r.recordedBy,
      Status: r.isReversal ? 'Reversal' : 'Active',
      Notes: r.notes || '',
    }));
    exportReportToCSV(data, 'tithe_records_confidential');
    showToast(`Exported ${filteredRecords.length} tithe records to CSV. Action logged.`, 'success');
  };

  const handleExportExcel = () => {
    logExport('excel', filteredRecords.length);
    const data = filteredRecords.map((r) => ({
      Date: formatDate(r.recordDate),
      Member: r.memberName,
      Envelope: r.envelopeNumber || '—',
      AmountGHS: Number(r.amount) / 100,
      Method: r.method,
      BatchRef: r.batchId || 'Direct',
      RecordedBy: r.recordedBy,
      Status: r.isReversal ? 'Reversal' : 'Active',
      Notes: r.notes || '',
    }));
    exportReportToExcel(data, 'tithe_records_confidential', {
      title: 'CONFIDENTIAL TITHE RECORDS',
      currency: 'GHS',
    });
    showToast(`Exported ${filteredRecords.length} tithe records to Excel. Action logged.`, 'success');
  };

  const handleConfirmReversal = () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      showToast('A reversal reason is mandatory.', 'error');
      return;
    }

    try {
      reverseTithe(reversalTarget.id, reversalReason.trim());
      showToast(`Tithe record for ${reversalTarget.memberName} successfully reversed.`, 'success');
      setReversalTarget(null);
      setReversalReason('');
    } catch (e: any) {
      showToast(e?.message || 'Failed to reverse record.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Confidential Warning Line (Spec 2.6) */}
      <div className="py-2 px-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>
            Individual tithe records are confidential under church governance rules and the Ghana Data Protection Act. Access is logged.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] text-[var(--text-muted)]">
          Audit Enabled
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search member, envelope..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none"
          >
            <option value="ALL">All Methods</option>
            <option value="ENVELOPE">Envelope</option>
            <option value="MOMO">MoMo</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>

          {/* Batch Filter */}
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-1.5 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none"
          >
            <option value="ALL">All Sources</option>
            <option value="tb-2026-10-04">Batch 04 Oct 2026</option>
            <option value="tb-2026-10-11">Batch 11 Oct 2026</option>
            <option value="tb-2026-10-18">Batch 18 Oct 2026</option>
            <option value="tb-2026-10-25">Batch 25 Oct 2026</option>
            <option value="DIRECT">Direct Tithes Only</option>
          </select>

          {/* Dates (Requirement 8: DD MMM YYYY) */}
          <div className="flex items-center gap-1.5 text-[13px]">
            <DateInput
              value={fromDate}
              onChange={setFromDate}
            />
            <span className="text-[var(--text-muted)] text-xs">to</span>
            <DateInput
              value={toDate}
              onChange={setToDate}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDirectTitheOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>Record Direct Tithe</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            title="Export CSV (Logged)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            title="Export Excel (Logged)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Records DataTable */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] overflow-hidden">
        <table className="w-full text-[13px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] font-medium">
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Member Name</th>
              <th className="py-2.5 px-4">Envelope</th>
              <th className="py-2.5 px-4">Method</th>
              <th className="py-2.5 px-4">Batch / Reference</th>
              <th className="py-2.5 px-4 text-right">Amount (GHS)</th>
              <th className="py-2.5 px-4">Recorded By</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                  No tithe records found matching the active filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const isReversal = record.isReversal;

                return (
                  <tr
                    key={record.id}
                    onClick={() =>
                      navigate(`#/tithes/records/${record.id}`, {
                        listKey: 'tithe-records',
                        listItemIds: filteredRecords.map((r) => r.id),
                      })
                    }
                    className={`hover:bg-[var(--surface-subtle)]/50 cursor-pointer transition-colors ${
                      isReversal ? 'opacity-60 bg-red-50/20 dark:bg-red-950/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap text-[var(--text-primary)]">
                      {formatDate(record.recordDate)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        <span>{record.memberName}</span>
                        {isReversal && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                            Reversal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[var(--text-muted)] font-sans tabular-nums text-[12px]">
                      {record.envelopeNumber || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-medium text-[var(--text-secondary)]">
                        {record.method}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[12px] text-[var(--text-muted)] truncate max-w-[150px]">
                      {record.batchId ? record.batchId.replace('tb-', 'Batch ') : (record.notes || 'Direct Tithe')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium tabular-nums">
                      <MoneyCell amount={record.amount} currency={record.currency} />
                    </td>
                    <td className="py-2.5 px-4 text-[12px] text-[var(--text-muted)]">
                      {record.recordedBy}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() =>
                            navigate(`#/tithes/records/${record.id}`, {
                              listKey: 'tithe-records',
                              listItemIds: filteredRecords.map((r) => r.id),
                            })
                          }
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                          title="View Member Summary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {!isReversal && currentUser?.role === 'Treasurer' && (
                          <button
                            onClick={() => {
                              setReversalTarget(record);
                              setReversalReason('');
                            }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Reverse tithe record (Append-Only)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Direct Tithe Modal */}
      <DirectTitheModal
        isOpen={isDirectTitheOpen}
        onClose={() => setIsDirectTitheOpen(false)}
      />

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] shadow-2xl max-w-md w-full p-6 text-[var(--text-primary)]">
            <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)] mb-1">
              Reverse Tithe Record
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] mb-4 leading-relaxed">
              In accordance with append-only accounting rules, this action will create an offsetting reversal record in the sub-ledger. The original record remains in the permanent audit trail.
            </p>

            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] space-y-1 mb-4">
              <div><strong>Member:</strong> {reversalTarget.memberName}</div>
              <div><strong>Date:</strong> {formatDate(reversalTarget.recordDate)}</div>
              <div><strong>Amount:</strong> <MoneyCell amount={reversalTarget.amount} currency={reversalTarget.currency} /></div>
            </div>

            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Mandatory Reversal Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Member envelope number misattributed on counting sheet..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                required
                className="w-full px-3 py-2 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReversalTarget(null)}
                className="px-4 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                className="px-4 py-2 rounded-[var(--radius)] text-[13px] font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
