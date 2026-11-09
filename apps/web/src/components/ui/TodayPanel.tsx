import React from 'react';
import { StatusDot } from './StatusDot.js';
import { Calendar, AlertCircle, CheckCircle2, PanelRightClose, PanelRight } from 'lucide-react';
import { formatDate } from '../../config/churchSettings.js';

export interface TodayPanelProps {
  monthName?: string;
  isMonthOpen?: boolean;
  closeDeadline?: string;
  onStartCloseChecklist?: () => void;
  isTreasurer?: boolean;

  usdRate?: number;
  rateDate?: string;
  rateEnteredBy?: string;
  isRateStale?: boolean;
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

  remittanceAlert?: {
    period: string;
    amountGhs: number;
    dueDate: string;
    isOverdue?: boolean;
    payee: string;
  } | null;
  onNavigateToRemittance?: () => void;

  upcomingEvents?: Array<{ label: string; dateText: string }>;

  isCollapsed?: boolean;
  onToggleCollapse?: () => void;

  className?: string;
}

export const TodayPanel: React.FC<TodayPanelProps> = ({
  monthName = 'October 2026',
  isMonthOpen = true,
  closeDeadline = '05 Nov 2026',
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
  onRejectRequisition: _onRejectRequisition,

  syncStatusText = 'All saved and synced',
  syncState = 'synced',
  onSyncNow,
  isSyncing = false,

  remittanceAlert = null,
  onNavigateToRemittance,

  upcomingEvents = [
    { label: 'October Staff Payroll', dateText: '28 Oct 2026' },
    { label: 'Building Pledge Q4 Target', dateText: '31 Oct 2026' },
    { label: 'Fiscal Month-End Closing', dateText: '31 Oct 2026' },
    { label: 'Harvest Thanksgiving Offering', dateText: '15 Nov 2026' },
  ],

  isCollapsed = false,
  onToggleCollapse,

  className = '',
}) => {
  // Calculate exchange rate age: 24 Oct to 02 Nov = 9 days (> 7 days is stale)
  const parsedRateDate = new Date(rateDate);
  const rateAgeDays = !isNaN(parsedRateDate.getTime())
    ? Math.max(0, Math.floor((new Date('2026-11-02T00:00:00').getTime() - parsedRateDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 9;
  const isStale = isRateStale || rateAgeDays > 7;

  // Process upcoming events: identify past dates as Overdue and sort
  const processedEvents = [...upcomingEvents]
    .map((ev) => {
      const parsed = new Date(ev.dateText);
      const isOverdue = !isNaN(parsed.getTime()) && parsed < new Date('2026-11-02T00:00:00');
      return { ...ev, parsed, isOverdue };
    })
    .sort((a, b) => (a.parsed.getTime() || 0) - (b.parsed.getTime() || 0));
  if (isCollapsed) {
    return (
      <aside
        className={`w-12 flex flex-col items-center py-3 space-y-4 text-[14px] select-none border-l border-[var(--surface-border)] bg-[var(--surface-panel)] min-h-[calc(100vh-120px)] rounded-[var(--radius)] ${className}`}
        aria-label="Today Overview (Collapsed)"
      >
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-[var(--radius)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            title="Expand Today panel"
            aria-label="Expand Today panel"
          >
            <PanelRight className="w-4 h-4 text-[var(--accent)]" />
          </button>
        )}

        <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center text-[var(--accent)] text-xs font-bold" title={formatDate(new Date())}>
          <Calendar className="w-4 h-4" />
        </div>

        {/* Sync Status Dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            syncState === 'synced'
              ? 'bg-emerald-600'
              : syncState === 'attention'
              ? 'bg-amber-500'
              : syncState === 'waiting'
              ? 'bg-blue-500'
              : 'bg-rose-500'
          }`}
          title={syncStatusText}
        />

        {/* Trial Balance Dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isTbBalanced ? 'bg-emerald-600' : 'bg-rose-500'
          }`}
          title={isTbBalanced ? 'Trial Balance in balance' : `Trial Balance out of balance: GHS ${tbDifferenceGhs}`}
        />

        {/* Exchange Rate Badge */}
        <div
          className={`text-[10px] font-sans tabular-nums font-semibold px-1 py-0.5 rounded ${
            isStale ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'text-[var(--text-muted)]'
          }`}
          title={`USD/GHS: ${usdRate} (${rateDate})`}
        >
          {usdRate.toFixed(1)}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`space-y-4 text-[14px] select-none ${className}`}
      aria-label="Today Overview"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
            Today
          </h2>
          <span className="text-[13px] text-[var(--text-secondary)]">
            {formatDate(new Date())}
          </span>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            title="Collapse Today panel"
            aria-label="Collapse Today panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. Month Status */}
      <div className="space-y-1.5 pb-3.5 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[13px] font-medium text-[var(--text-secondary)]">
          Period status
        </div>
        <div className="flex items-baseline justify-between text-[14px]">
          <span className="font-medium text-[var(--text-primary)]">
            {monthName}: {isMonthOpen ? 'Open' : 'Closed'}
          </span>
          {isMonthOpen && (
            <span className="text-[13px] text-[var(--text-muted)]">
              Close by {closeDeadline}
            </span>
          )}
        </div>
        {isTreasurer && onStartCloseChecklist && isMonthOpen && (
          <button
            onClick={onStartCloseChecklist}
            className="text-[13px] text-[var(--accent)] hover:underline font-medium pt-0.5 block text-left"
          >
            Start close checklist →
          </button>
        )}
      </div>

      {/* 2. Exchange Rate */}
      <div className="space-y-1.5 pb-3.5 border-b border-[var(--surface-border-subtle)]">
        <div className="flex items-center justify-between text-[13px] text-[var(--text-secondary)]">
          <span className="font-medium">USD exchange rate</span>
          {isStale && (
            <span className="text-[var(--status-amber)] text-[12px] font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Rate is {rateAgeDays} days old
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium tabular-nums text-[var(--text-primary)]">
            1 USD = GHS {usdRate.toFixed(4)}
          </span>
          {isTreasurer && onUpdateRate && (
            <button
              type="button"
              onClick={onUpdateRate}
              className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              Update rate
            </button>
          )}
        </div>
        <div className="text-[13px] text-[var(--text-muted)]">
          Set {rateDate} by {rateEnteredBy}
        </div>
      </div>

      {/* 3. Trial Balance Doctor */}
      <div className="space-y-1.5 pb-3.5 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[13px] font-medium text-[var(--text-secondary)]">
          Ledger integrity
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
            <button
              type="button"
              onClick={onCheckDoctor}
              className="text-[13px] text-[var(--accent)] hover:underline font-medium"
            >
              {isTbBalanced ? 'Check' : 'Diagnose'}
            </button>
          )}
        </div>
      </div>

      {/* 4. Approvals Waiting (Only if present) */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-2 pb-3.5 border-b border-[var(--surface-border-subtle)]">
          <div className="flex items-center justify-between text-[13px] font-medium text-[var(--text-secondary)]">
            <span>Approvals waiting</span>
            <span className="tabular-nums font-semibold text-[var(--status-amber)]">
              {pendingApprovals.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingApprovals.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="py-1.5 border-b border-[var(--surface-border-subtle)] flex items-center justify-between text-[13px]"
              >
                <div className="truncate mr-2">
                  <div className="font-medium text-[var(--text-primary)] truncate">
                    {req.description}
                  </div>
                  <div className="text-[13px] text-[var(--text-muted)]">
                    {req.department} · GHS {req.amountGhs.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onApproveRequisition && (
                    <button
                      type="button"
                      onClick={() => onApproveRequisition(req.id)}
                      className="text-[13px] text-[var(--accent)] hover:underline font-medium"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Offline Sync Status */}
      <div className="space-y-1.5 pb-3.5 border-b border-[var(--surface-border-subtle)]">
        <div className="text-[13px] font-medium text-[var(--text-secondary)]">
          Local device sync
        </div>
        <div className="flex items-center justify-between">
          <StatusDot
            status={syncState === 'synced' ? 'synced' : syncState === 'waiting' ? 'waiting' : 'attention'}
            label={syncStatusText}
          />
          {onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="text-[13px] text-[var(--accent)] hover:underline font-medium disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {/* 6. Denominational Remittance Alert (Section 2.4) */}
      {remittanceAlert && (
        <div className="space-y-1.5 pb-3.5 border-b border-[var(--surface-border-subtle)]">
          <div className="flex items-center justify-between text-[13px] font-medium text-[var(--text-secondary)]">
            <span>Denominational remittance</span>
            {remittanceAlert.isOverdue ? (
              <span className="text-[var(--status-red)] text-[12px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Overdue
              </span>
            ) : (
              <span className="text-[var(--status-amber)] text-[12px] font-medium">
                Due {remittanceAlert.dueDate}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-medium text-[var(--text-primary)] truncate mr-2">
              {remittanceAlert.period} assessment ({remittanceAlert.payee})
            </span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)] shrink-0">
              GHS {remittanceAlert.amountGhs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {onNavigateToRemittance && (
            <button
              type="button"
              onClick={onNavigateToRemittance}
              className="text-[13px] text-[var(--accent)] hover:underline font-medium pt-0.5 block text-left"
            >
              Review and pay remittance →
            </button>
          )}
        </div>
      )}

      {/* 7. Upcoming Financial Milestones */}
      <div className="space-y-1.5">
        <div className="text-[13px] font-medium text-[var(--text-secondary)]">
          Upcoming deadlines
        </div>
        <div className="space-y-1.5">
          {processedEvents.map((ev, idx) => (
            <div key={idx} className="flex items-baseline justify-between text-[13px]">
              <span className="text-[var(--text-primary)] truncate pr-2">{ev.label}</span>
              <span
                className={`shrink-0 tabular-nums ${
                  ev.isOverdue
                    ? 'text-[var(--status-red)] font-medium'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {ev.isOverdue ? `Overdue (${ev.dateText.slice(0, 6)})` : ev.dateText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
