import React from 'react';
import { StatusDot } from './StatusDot.js';
import { Button } from './Button.js';
import { Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface TodayPanelProps {
  monthName?: string;
  isMonthOpen?: boolean;
  closeDeadline?: string;
  onStartCloseChecklist?: () => void;
  isTreasurer?: boolean;

  usdRate?: number;
  rateDate?: string;
  rateEnteredBy?: string;
  isRateStale?: boolean; // older than 7 days
  onUpdateRate?: () => void;

  isTbBalanced?: boolean;
  tbDifferenceGhs?: number;
  tbLastCheckedMinutesAgo?: number;
  onCheckDoctor?: () => void;

  pendingApprovals?: Array<{
    id: string;
    description: string;
    amountGhs: number;
    department: string;
  }>;
  onApproveRequisition?: (id: string) => void;
  onRejectRequisition?: (id: string) => void;

  syncStatusText?: string;
  syncState?: 'synced' | 'waiting' | 'attention' | 'error';
  onSyncNow?: () => void;
  isSyncing?: boolean;

  upcomingEvents?: Array<{ label: string; dateText: string }>;

  className?: string;
}

export const TodayPanel: React.FC<TodayPanelProps> = ({
  monthName = 'October 2026',
  isMonthOpen = true,
  closeDeadline = '5 Nov',
  onStartCloseChecklist,
  isTreasurer = true,

  usdRate = 15.5,
  rateDate = '24 Oct 2026',
  rateEnteredBy = 'Kofi Mensah',
  isRateStale = false,
  onUpdateRate,

  isTbBalanced = true,
  tbDifferenceGhs = 0,
  tbLastCheckedMinutesAgo = 2,
  onCheckDoctor,

  pendingApprovals = [],
  onApproveRequisition,
  onRejectRequisition,

  syncStatusText = 'All saved and synced',
  syncState = 'synced',
  onSyncNow,
  isSyncing = false,

  upcomingEvents = [
    { label: 'October Staff Payroll', dateText: '28 Oct' },
    { label: 'Building Pledge Q4 Target', dateText: '31 Oct' },
    { label: 'Fiscal Month-End Closing', dateText: '31 Oct' },
  ],

  className = '',
}) => {
  return (
    <aside
      className={`border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-4 space-y-4 text-[14px] ${className}`}
      aria-label="Today Overview"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
        <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
          Today
        </h2>
        <span className="text-[12px] text-[var(--text-secondary)]">
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* 1. Month Status */}
      <div className="space-y-1 pb-3 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[12px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">
          Period Status
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-[var(--text-primary)]">
            {monthName}: {isMonthOpen ? 'Open' : 'Closed'}
          </span>
          {isMonthOpen && (
            <span className="text-[12px] text-[var(--text-secondary)]">
              Close by {closeDeadline}
            </span>
          )}
        </div>
        {isTreasurer && onStartCloseChecklist && isMonthOpen && (
          <button
            onClick={onStartCloseChecklist}
            className="text-[13px] text-[var(--accent)] hover:underline font-medium pt-0.5 block"
          >
            Start close checklist →
          </button>
        )}
      </div>

      {/* 2. Exchange Rate */}
      <div className="space-y-1 pb-3 border-b border-[var(--surface-border-subtle)]">
        <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
          <span className="uppercase font-semibold tracking-wider">USD Exchange Rate</span>
          {isRateStale && (
            <span className="text-[var(--status-amber)] text-[11px] font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Rate &gt; 7 days old
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-medium tabular-nums text-[var(--text-primary)]">
            1 USD = {usdRate.toFixed(4)} GHS
          </span>
          {isTreasurer && onUpdateRate && (
            <Button variant="ghost" size="sm" onClick={onUpdateRate} className="h-7 text-xs px-2">
              Update rate
            </Button>
          )}
        </div>
        <div className="text-[12px] text-[var(--text-muted)]">
          Set {rateDate} by {rateEnteredBy}
        </div>
      </div>

      {/* 3. Trial Balance Doctor */}
      <div className="space-y-1 pb-3 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[12px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">
          Ledger Integrity
        </div>
        <div className="flex items-center justify-between">
          {isTbBalanced ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--status-green)] shrink-0" />
              <span className="text-[14px] text-[var(--text-primary)]">
                Balanced. Checked {tbLastCheckedMinutesAgo}m ago
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--status-red)] shrink-0" />
              <span className="text-[14px] text-[var(--status-red)] font-medium">
                Diff: GHS {tbDifferenceGhs.toFixed(2)}
              </span>
            </div>
          )}
          {onCheckDoctor && (
            <Button
              variant={isTbBalanced ? 'ghost' : 'danger'}
              size="sm"
              onClick={onCheckDoctor}
              className="h-7 text-xs px-2"
            >
              {isTbBalanced ? 'Check now' : 'Diagnose'}
            </Button>
          )}
        </div>
      </div>

      {/* 4. Approvals Waiting (Only if present) */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-2 pb-3 border-b border-[var(--surface-border-subtle)]">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            <span>Approvals Waiting</span>
            <span className="text-[var(--status-amber)] tabular-nums">
              ({pendingApprovals.length})
            </span>
          </div>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="p-2 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border-subtle)] flex items-center justify-between text-[13px]"
              >
                <div className="truncate mr-2">
                  <div className="font-medium text-[var(--text-primary)] truncate">
                    {req.description}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {req.department} • GHS {req.amountGhs.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onApproveRequisition && (
                    <button
                      onClick={() => onApproveRequisition(req.id)}
                      className="px-2 py-0.5 text-xs text-[var(--status-green)] font-medium hover:underline"
                    >
                      Approve
                    </button>
                  )}
                  {onRejectRequisition && (
                    <button
                      onClick={() => onRejectRequisition(req.id)}
                      className="px-1.5 py-0.5 text-xs text-[var(--status-red)] hover:underline"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Sync Status */}
      <div className="space-y-1 pb-3 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[12px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">
          Synchronization
        </div>
        <div className="flex items-center justify-between">
          <StatusDot status={syncState} label={syncStatusText} />
          {onSyncNow && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="h-7 text-xs px-2 gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync now</span>
            </Button>
          )}
        </div>
      </div>

      {/* 6. Upcoming Events */}
      <div className="space-y-1.5">
        <div className="text-[12px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming Dates</span>
        </div>
        <ul className="space-y-1 text-[13px]">
          {upcomingEvents.map((evt, idx) => (
            <li key={idx} className="flex items-baseline justify-between text-[var(--text-secondary)]">
              <span className="truncate mr-2">{evt.label}</span>
              <span className="tabular-nums font-medium text-[var(--text-primary)] shrink-0">
                {evt.dateText}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
