import React, { useState, useMemo } from 'react';
import {
  Play,
  Search,
  ChevronRight,
} from 'lucide-react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { formatDate } from '../../config/churchSettings.js';
import { NewVerificationModal } from './NewVerificationModal.js';
import { VerificationWorkspaceModal } from './VerificationWorkspaceModal.js';
import type { VerificationScope, VerificationStatus } from '@church/domain';

export const VerificationTab: React.FC = () => {
  const { verifications } = useFixedAssets();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | VerificationScope>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VerificationStatus>('ALL');

  // Summary counts
  const totalVerifications = verifications.length;
  const inProgressCount = verifications.filter((v) => v.status === 'IN_PROGRESS').length;
  const completedCount = verifications.filter((v) => v.status === 'COMPLETED').length;

  // Last completed date
  const lastCompletedRun = [...verifications]
    .filter((v) => v.status === 'COMPLETED' && v.completedDate)
    .sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || ''))[0];
  const lastCompletedStr = lastCompletedRun?.completedDate
    ? formatDate(lastCompletedRun.completedDate)
    : 'None yet';

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return verifications.filter((v) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesQuery =
          v.verificationNumber.toLowerCase().includes(q) ||
          v.title.toLowerCase().includes(q) ||
          (v.scopeValue && v.scopeValue.toLowerCase().includes(q)) ||
          (v.signoff?.officerName && v.signoff.officerName.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      if (scopeFilter !== 'ALL' && v.scope !== scopeFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && v.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [verifications, searchQuery, scopeFilter, statusFilter]);

  const handleOpenWorkspace = (verificationId: string) => {
    setActiveWorkspaceId(verificationId);
  };

  return (
    <div className="space-y-4">
      {/* Status Summary Line (Section 1.3 / Polish guidelines) */}
      <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Total verifications <strong className="font-mono text-[var(--text-primary)]">{totalVerifications}</strong>
        </span>
        <span>·</span>
        <span>
          In progress <strong className="font-mono text-[var(--text-primary)]">{inProgressCount}</strong>
        </span>
        <span>·</span>
        <span>
          Completed <strong className="font-mono text-[var(--text-primary)]">{completedCount}</strong>
        </span>
        <span>·</span>
        <span>
          Last completed on <strong className="text-[var(--text-primary)]">{lastCompletedStr}</strong>
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search verification runs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
            />
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as 'ALL' | VerificationScope)}
            className="px-2.5 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Scopes</option>
            <option value="LOCATION">By Location</option>
            <option value="CUSTODIAN">By Custodian</option>
            <option value="CATEGORY">By Category</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | VerificationStatus)}
            className="px-2.5 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Start Verification Action Button */}
        <div>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs"
          >
            <Play className="w-3.5 h-3.5" /> Start Verification
          </button>
        </div>
      </div>

      {/* Verification Runs Table */}
      <div className="border border-[var(--surface-border)] rounded overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-[var(--text-secondary)] uppercase text-[11px] font-semibold">
            <tr>
              <th className="px-3.5 py-2.5">Run #</th>
              <th className="px-3.5 py-2.5">Title & Scope</th>
              <th className="px-3.5 py-2.5">Inspection Dates</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
              <th className="px-3.5 py-2.5 text-center">Progress</th>
              <th className="px-3.5 py-2.5">Discrepancy Summary</th>
              <th className="px-3.5 py-2.5">Dual Signatories</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {filteredRuns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No physical verification runs recorded. Click "Start Verification" to conduct an offline audit.
                </td>
              </tr>
            ) : (
              filteredRuns.map((run) => {
                const isCompleted = run.status === 'COMPLETED';
                const checked =
                  run.foundCount + run.movedCount + run.damagedCount + run.missingCount;
                const progressPct =
                  run.totalExpectedAssets > 0
                    ? Math.round((checked / run.totalExpectedAssets) * 100)
                    : 100;

                const hasDiscrepancy =
                  run.movedCount > 0 ||
                  run.damagedCount > 0 ||
                  run.missingCount > 0 ||
                  run.unrecordedFoundCount > 0;

                return (
                  <tr
                    key={run.id}
                    onClick={() => handleOpenWorkspace(run.id)}
                    className="hover:bg-[var(--surface-hover)] transition cursor-pointer"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-[var(--text-primary)] font-medium">
                      {run.verificationNumber}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-[var(--text-primary)]">{run.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                        <span>
                          {run.scope === 'ALL'
                            ? 'Entire Church Register'
                            : `${run.scope}: ${run.scopeValue}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                      <div>Started: {formatDate(run.startDate)}</div>
                      {run.completedDate && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Completed: {formatDate(run.completedDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono">
                      <div>
                        {checked} / {run.totalExpectedAssets}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">{progressPct}%</div>
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px]">
                      {hasDiscrepancy ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {run.movedCount > 0 && (
                            <span className="text-amber-700 font-medium">
                              {run.movedCount} moved
                            </span>
                          )}
                          {run.damagedCount > 0 && (
                            <span className="text-rose-700 font-medium">
                              {run.damagedCount} damaged
                            </span>
                          )}
                          {run.missingCount > 0 && (
                            <span className="text-red-700 font-medium">
                              {run.missingCount} missing
                            </span>
                          )}
                          {run.unrecordedFoundCount > 0 && (
                            <span className="text-purple-700 font-medium">
                              {run.unrecordedFoundCount} unrecorded
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium">Zero discrepancies</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[11px] text-[var(--text-secondary)]">
                      {run.signoff ? (
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">
                            {run.signoff.verifierName}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            & {run.signoff.officerName} ({run.signoff.officerRole})
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] italic">Pending Signatures</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWorkspace(run.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      >
                        <span>{isCompleted ? 'View Findings' : 'Inspect'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <NewVerificationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onStarted={(id) => {
          setIsNewModalOpen(false);
          setActiveWorkspaceId(id);
        }}
      />

      <VerificationWorkspaceModal
        isOpen={Boolean(activeWorkspaceId)}
        onClose={() => setActiveWorkspaceId(null)}
        verificationId={activeWorkspaceId}
      />
    </div>
  );
};
