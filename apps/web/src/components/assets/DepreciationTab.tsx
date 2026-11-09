import React, { useState, useMemo } from 'react';
import {
  Play,
  Search,
} from 'lucide-react';
import type { DepreciationRun } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatusDot } from '../ui/StatusDot.js';
import { DepreciationRunModal } from './DepreciationRunModal.js';
import { DepreciationRunDetailPanel } from './DepreciationRunDetailPanel.js';

export const DepreciationTab: React.FC = () => {
  const { depreciationRuns } = useFixedAssets();
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const [search, setSearch] = useState('');
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<DepreciationRun | null>(null);

  const canRunDepreciation = role === 'Treasurer' || role === 'Finance Secretary';

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return depreciationRuns.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.runNumber.toLowerCase().includes(q) ||
        r.period.toLowerCase().includes(q) ||
        r.preparedBy.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [depreciationRuns, search]);

  // Aggregate YTD posted depreciation
  const totalYtdChargePesewas = useMemo(() => {
    return depreciationRuns
      .filter((r) => r.status === 'POSTED')
      .reduce((sum, r) => sum + r.totalChargePesewas, 0n);
  }, [depreciationRuns]);

  const ytdFormatted = (Number(totalYtdChargePesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const lastPostedRun = depreciationRuns.find((r) => r.status === 'POSTED');

  return (
    <div className="space-y-4">
      {/* Plain Accounting Summary Status Line per Section 6 */}
      <div className="py-2.5 px-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[var(--text-primary)] font-semibold">{depreciationRuns.length}</span> depreciation runs · Total YTD Depreciation{' '}
          <span className="font-mono font-semibold text-[#1e4620]">GHS {ytdFormatted}</span> · Last posted{' '}
          <span className="font-medium text-[var(--text-primary)]">{lastPostedRun ? lastPostedRun.period : 'None'}</span>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Straight-line basis · Pro-rata part periods · Reversible as a whole with reason
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search runs by number, period, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
            />
          </div>
        </div>

        {canRunDepreciation && (
          <button
            type="button"
            onClick={() => setIsRunModalOpen(true)}
            className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Run Depreciation
          </button>
        )}
      </div>

      {/* Depreciation Runs Table */}
      <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-secondary)]">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Run No.</th>
                <th className="py-2.5 px-3">Period</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Run Date</th>
                <th className="py-2.5 px-3 text-right">Eligible</th>
                <th className="py-2.5 px-3 text-right">Skipped</th>
                <th className="py-2.5 px-3 text-right">Total Charge (GHS)</th>
                <th className="py-2.5 px-3">Prepared By</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">
                    No depreciation runs found. Click "Run Depreciation" to generate and post a period charge.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => {
                  const charge = (Number(run.totalChargePesewas) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  });

                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className="hover:bg-[var(--surface-hover)] cursor-pointer transition select-none"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                        {run.runNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                        {run.period}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">
                        {run.periodType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                        {run.runDate}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {run.totalEligibleAssets}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)]">
                        {run.totalSkippedAssets}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {charge}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">
                        {run.preparedBy}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusDot
                          status={run.status === 'POSTED' ? 'approved' : 'inactive'}
                          label={run.status}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Panels */}
      <DepreciationRunModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
      />

      <DepreciationRunDetailPanel
        isOpen={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        run={selectedRun}
      />
    </div>
  );
};
