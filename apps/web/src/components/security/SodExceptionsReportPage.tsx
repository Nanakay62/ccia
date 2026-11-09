import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { useApprovals } from '../../context/ApprovalContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { formatDate } from '../../config/churchSettings.js';
import type { SodExceptionRecord } from '@church/domain';

export const SodExceptionsReportPage: React.FC = () => {
  const { sodExceptions } = useApprovals();
  const { navigate } = useRouter();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERRIDDEN' | 'BLOCKED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = useMemo(() => {
    return sodExceptions.filter((rec: SodExceptionRecord) => {
      if (statusFilter === 'OVERRIDDEN' && !rec.isOverridden) return false;
      if (statusFilter === 'BLOCKED' && rec.isOverridden) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = rec.actorUserName.toLowerCase().includes(q);
        const matchDetails = rec.details.toLowerCase().includes(q);
        const matchEntity = rec.entityId.toLowerCase().includes(q);
        const matchReason = (rec.overrideReason || '').toLowerCase().includes(q);
        if (!matchActor && !matchDetails && !matchEntity && !matchReason) return false;
      }
      return true;
    });
  }, [sodExceptions, statusFilter, searchQuery]);

  const overriddenCount = useMemo(
    () => sodExceptions.filter((r: SodExceptionRecord) => r.isOverridden).length,
    [sodExceptions]
  );
  const blockedCount = useMemo(
    () => sodExceptions.filter((r: SodExceptionRecord) => !r.isOverridden).length,
    [sodExceptions]
  );

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Rule Type',
      'Document / Entity',
      'Actor',
      'Role',
      'Outcome',
      'Treasurer Override By',
      'Override Justification',
      'Details',
    ];
    const rows = filteredRecords.map((r: SodExceptionRecord) => [
      r.timestamp.slice(0, 10),
      r.ruleType,
      `${r.entityType} (${r.entityId})`,
      r.actorUserName,
      r.actorRole,
      r.isOverridden ? 'Treasurer Override Applied' : 'Blocked by SoD Rule',
      r.overriddenByTreasurerName || '-',
      (r.overrideReason || '-').replace(/"/g, '""'),
      r.details.replace(/"/g, '""'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SoD_Exceptions_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] font-medium mb-1">
            <button
              onClick={() => navigate('#/settings')}
              className="hover:text-[var(--text-primary)] transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Settings &amp; Governance</span>
            </button>
            <span>/</span>
            <span>Separation of Duties (SoD) Exceptions Report</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#1e3a2f]" />
            <span>Separation of Duties (SoD) Exceptions &amp; Overrides Report</span>
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Append-only statutory audit register of blocked self-approval attempts and logged Treasurer overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px] font-semibold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Export CSV for Auditor</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Total Recorded SoD Events
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1 block">
            {sodExceptions.length}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            Permanent append-only audit trail
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
            Blocked Self-Approval Attempts
          </span>
          <span className="text-2xl font-bold text-rose-600 tabular-nums mt-1 block">
            {blockedCount}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            Preparer = Approver or Same-Period Vendor Payment prevented
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
            Logged Treasurer Overrides
          </span>
          <span className="text-2xl font-bold text-amber-600 tabular-nums mt-1 block">
            {overriddenCount}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            Requires written justification &amp; Auditor visibility
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          {(['ALL', 'BLOCKED', 'OVERRIDDEN'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[var(--radius-sm)] text-[12px] font-semibold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#1e3a2f] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel)]'
              }`}
            >
              {st === 'ALL'
                ? `All Events (${sodExceptions.length})`
                : st === 'BLOCKED'
                ? `Blocked Near-Misses (${blockedCount})`
                : `Treasurer Overrides (${overriddenCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by user, document, or reason..."
            className="w-full text-[13px] pl-9 pr-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-hidden">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Rule Enforced</th>
              <th className="py-3 px-4">Document</th>
              <th className="py-3 px-4">User &amp; Role</th>
              <th className="py-3 px-4">Outcome</th>
              <th className="py-3 px-4">Details &amp; Override Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {filteredRecords.map((rec: SodExceptionRecord) => (
              <tr key={rec.id} className="hover:bg-[var(--surface-panel)]">
                <td className="py-3 px-4 whitespace-nowrap text-[12px] text-[var(--text-secondary)] tabular-nums">
                  {formatDate(rec.timestamp.slice(0, 10))}
                </td>
                <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                  {rec.ruleType.replace(/_/g, ' ')}
                </td>
                <td className="py-3 px-4 whitespace-nowrap font-mono text-[12px] text-[var(--text-primary)]">
                  {rec.entityId}
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-[var(--text-primary)]">{rec.actorUserName}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{rec.actorRole}</div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {rec.isOverridden ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Treasurer Override</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Blocked by Rule</span>
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-[12px] text-[var(--text-secondary)] max-w-md">
                  <div>{rec.details}</div>
                  {rec.isOverridden && rec.overrideReason && (
                    <div className="mt-1 p-2 rounded bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 text-amber-900 dark:text-amber-200 text-[11px]">
                      <strong>Override by {rec.overriddenByTreasurerName || 'Treasurer'}:</strong>{' '}
                      {rec.overrideReason}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
