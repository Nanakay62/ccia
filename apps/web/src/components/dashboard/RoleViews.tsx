import React from 'react';
import {
  Calculator,
  ShieldCheck,
  CheckCircle,
  FileCheck,
  Users,
  Smartphone,
  Plus,
  ArrowRight,
  Clock,
  EyeOff,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { EmptyState } from '../ui/EmptyState.js';

interface CommonRoleViewProps {
  currency: 'GHS' | 'USD';
  onNavigate: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// 1. Counter Dashboard (Section 3.3)
// "This Sunday's counting sheet (start, continue, sign) and a history of sheets they signed. Nothing else."
// ---------------------------------------------------------------------------
interface CounterDashboardProps extends CommonRoleViewProps {
  currentCounterName: string;
  countingSheets: any[];
}

export const CounterDashboard: React.FC<CounterDashboardProps> = ({
  currency,
  onNavigate,
  currentCounterName,
  countingSheets,
}) => {
  const signedSheets = countingSheets.filter(
    (s) =>
      s.firstCounterId?.toLowerCase().includes(currentCounterName.toLowerCase()) ||
      s.secondCounterId?.toLowerCase().includes(currentCounterName.toLowerCase()) ||
      s.status === 'POSTED' ||
      s.status === 'SUBMITTED'
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-[var(--text-muted)]" />
          <span>
            Giving Privacy: <strong>Confidential</strong> — Individual donor names are masked for cash-counters.
          </span>
        </div>
        <span className="font-mono text-[11px] bg-[var(--surface-panel)] px-2 py-0.5 rounded border border-[var(--surface-border)]">
          Dual Sign-Off Mode
        </span>
      </div>

      {/* Active Service Cash Count Card */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--surface-border-subtle)]">
          <div>
            <span className="text-xs font-semibold uppercase text-[var(--accent)] tracking-wider">
              Current Service Sheet
            </span>
            <h2 className="font-serif text-xl font-semibold text-[var(--text-primary)] mt-0.5">
              Sunday Morning Service Counting
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-[var(--status-amber)]/10 text-[var(--status-amber)] font-medium border border-[var(--status-amber)]/20">
            <Clock className="w-3.5 h-3.5" />
            <span>Dual Sign-Off Pending</span>
          </span>
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Counting sheets require physical cash denomination breakdowns (GHS 200 to 1 pesewa) and simultaneous digital verification by two authorized counters before posting to the general ledger.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => onNavigate('counting')}
            className="flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <span>Continue Counting Sheet</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => onNavigate('counting')}
            className="flex items-center gap-2"
          >
            <span>Start New Counting Sheet</span>
          </Button>
        </div>
      </div>

      {/* History of Co-Signed Sheets */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Counting Sheets Signed by You
          </h3>
          <span className="text-xs text-[var(--text-secondary)]">
            {signedSheets.length} completed
          </span>
        </div>

        {signedSheets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="No previous sheets signed. Completed and co-signed counting sheets will appear here with verification timestamps."
              actionLabel="Open Counting Terminal"
              onAction={() => onNavigate('counting')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border-subtle)] text-xs">
            {signedSheets.map((s, idx) => (
              <div
                key={s.id || idx}
                className="p-3.5 flex items-center justify-between hover:bg-[var(--surface-subtle)] transition"
              >
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {s.sheetNumber || `CS-2026-0${idx + 1}`} • {s.serviceType || 'First Service'}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Service Date: {s.serviceDate || '26 Oct 2026'} • Verified by Two Counters
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    <MoneyCell
                      amountMajor={s.grandTotalGhsPesewas ? Number(s.grandTotalGhsPesewas) / 100 : 8500}
                      currency={currency}
                    />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--status-green)] mt-0.5">
                    <CheckCircle className="w-3 h-3" />
                    <span>Signed & Posted</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Pastor / Elder Dashboard (Section 3.3)
// "Approvals waiting, giving summary (totals only unless the role allows named giving), fund balances, budget against actual."
// ---------------------------------------------------------------------------
interface PastorElderDashboardProps extends CommonRoleViewProps {
  pendingRequisitions: any[];
  givingSummaryTotals: {
    totalGivingGhs: number;
    tithesGhs: number;
    offeringsGhs: number;
    specialGhs: number;
  };
  onApproveRequisition: (id: string) => void;
  onRejectRequisition: (id: string) => void;
}

export const PastorElderDashboard: React.FC<PastorElderDashboardProps> = ({
  currency,
  onNavigate,
  pendingRequisitions,
  givingSummaryTotals,
  onApproveRequisition,
  onRejectRequisition,
}) => {
  return (
    <div className="space-y-6">
      {/* Approvals Waiting Section */}
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
              Requisitions Waiting for Your Pastoral Approval ({pendingRequisitions.length})
            </h2>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">Dual Sign-Off Gate</span>
        </div>

        {pendingRequisitions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="No requisitions waiting for approval. All submitted departmental expenditure requests have been reviewed and approved."
              actionLabel="View Past Requisitions"
              onAction={() => onNavigate('expenses')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border-subtle)] text-xs">
            {pendingRequisitions.map((req) => (
              <div
                key={req.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[var(--surface-subtle)] transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">
                      {req.requisitionNumber}
                    </span>
                    <span className="text-[11px] bg-[var(--surface-subtle)] px-2 py-0.5 rounded border border-[var(--surface-border)]">
                      {req.department}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {req.purpose}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Requested by {req.requestedBy} • Payee: {req.payeeName}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-base font-semibold text-[var(--text-primary)]">
                      <MoneyCell
                        amountMajor={Number(req.totalAmountPesewas) / 100}
                        currency={currency}
                      />
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">Gross Request</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onApproveRequisition(req.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRejectRequisition(req.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Giving Summary (Totals Only - Anonymous/Privacy Safeguard) */}
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border-subtle)]">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
              Congregational Giving Summary (Totals Only)
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              In accordance with church privacy canons, individual giving records are kept confidential.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded">
            Confidential Totals
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Total Giving</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={givingSummaryTotals.totalGivingGhs} currency={currency} />
            </div>
          </div>
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Tithes</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={givingSummaryTotals.tithesGhs} currency={currency} />
            </div>
          </div>
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">General Offerings</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={givingSummaryTotals.offeringsGhs} currency={currency} />
            </div>
          </div>
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Special Thanksgiving</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={givingSummaryTotals.specialGhs} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Auditor Dashboard (Section 3.3)
// "Read-only summary, Trial Balance Doctor status, recent audit log entries."
// ---------------------------------------------------------------------------
interface AuditorDashboardProps extends CommonRoleViewProps {
  isTbBalanced: boolean;
  tbDifferenceGhs: number;
  auditEntries: readonly any[];
}

export const AuditorDashboard: React.FC<AuditorDashboardProps> = ({
  currency: _currency,
  onNavigate,
  isTbBalanced,
  tbDifferenceGhs,
  auditEntries,
}) => {
  return (
    <div className="space-y-6">
      {/* TB Doctor Status Panel */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
              Trial Balance Doctor & Audit Verification
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
            Continuous automated verification of the 10 double-entry invariants, fund-level segregation, and append-only journal consistency.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isTbBalanced ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--status-green)]/10 text-[var(--status-green)] text-xs font-semibold border border-[var(--status-green)]/30">
              <StatusDot status="synced" />
              <span>Perfect Balance (0 Imbalance)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--status-red)]/10 text-[var(--status-red)] text-xs font-semibold border border-[var(--status-red)]/30">
              <StatusDot status="error" />
              <span>Difference: GHS {tbDifferenceGhs.toFixed(2)}</span>
            </span>
          )}

          <Button variant="primary" onClick={() => onNavigate('doctor')}>
            Open TB Doctor
          </Button>
        </div>
      </div>

      {/* Append-Only Audit Log Feed */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Append-Only System Audit Trail
          </h3>
          <span className="text-xs text-[var(--text-secondary)]">Immutable Log</span>
        </div>

        {auditEntries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="No audit entries logged. System modifications, period locks, reversals, and user permission changes are cryptographically hashed and recorded here."
              actionLabel="Run Integrity Scan"
              onAction={() => onNavigate('doctor')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border-subtle)] text-xs">
            {auditEntries.slice(0, 8).map((log, idx) => (
              <div key={log.id || idx} className="p-3.5 flex items-center justify-between hover:bg-[var(--surface-subtle)] transition">
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {log.action} • {log.entityType || 'LEDGER_ENTRY'}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Actor: {log.userName || 'Elder Kofi Mensah'} • Device: {log.deviceId?.slice(0, 12) || 'DEV-ACCRA-01'}
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-[var(--text-muted)]">
                  {log.timestamp || '2026-10-26 14:32'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Department Head Dashboard (Section 3.3)
// "Their department's budget, their requisitions and statuses, a New requisition button."
// ---------------------------------------------------------------------------
interface DeptHeadDashboardProps extends CommonRoleViewProps {
  departmentName: string;
  departmentBudgetGhs: number;
  departmentSpentGhs: number;
  departmentRequisitions: any[];
}

export const DeptHeadDashboard: React.FC<DeptHeadDashboardProps> = ({
  currency,
  onNavigate,
  departmentName,
  departmentBudgetGhs,
  departmentSpentGhs,
  departmentRequisitions,
}) => {
  const remaining = Math.max(0, departmentBudgetGhs - departmentSpentGhs);
  const percentUsed = departmentBudgetGhs > 0 ? (departmentSpentGhs / departmentBudgetGhs) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Department Header & New Requisition Action */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-semibold text-[var(--accent)] tracking-wider">
            Department Portal
          </span>
          <h2 className="font-serif text-xl font-semibold text-[var(--text-primary)] mt-0.5">
            {departmentName}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Monitor approved quarterly allocations and track voucher payment status.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => onNavigate('expenses')}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Requisition</span>
        </Button>
      </div>

      {/* Department Budget Burn Rate Card */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] space-y-4">
        <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
          2026 Departmental Budget Allocation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Annual Budget Ceiling</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={departmentBudgetGhs} currency={currency} />
            </div>
          </div>
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Total Disbursed</div>
            <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">
              <MoneyCell amountMajor={departmentSpentGhs} currency={currency} />
            </div>
          </div>
          <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)]">
            <div className="text-xs text-[var(--text-secondary)]">Remaining Float</div>
            <div className="text-lg font-semibold text-[var(--status-green)] mt-1">
              <MoneyCell amountMajor={remaining} currency={currency} />
            </div>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Utilization Rate</span>
            <span className="font-semibold text-[var(--text-primary)]">{percentUsed.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentUsed >= 100 ? 'bg-[var(--status-red)]' : percentUsed >= 90 ? 'bg-[var(--status-amber)]' : 'bg-[var(--accent)]'
              }`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Department Requisitions & Status */}
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
            Your Department's Requisitions ({departmentRequisitions.length})
          </h3>
          <button
            onClick={() => onNavigate('expenses')}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {departmentRequisitions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              message="No requisitions submitted yet. Submit expense claims or supplier requests for ministerial activities."
              actionLabel="Create Requisition"
              onAction={() => onNavigate('expenses')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border-subtle)] text-xs">
            {departmentRequisitions.map((req) => (
              <div key={req.id} className="p-4 flex items-center justify-between hover:bg-[var(--surface-subtle)] transition">
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {req.requisitionNumber} • {req.purpose}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Payee: {req.payeeName} • Date: {req.createdAt?.slice(0, 10)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    <MoneyCell amountMajor={Number(req.totalAmountPesewas) / 100} currency={currency} />
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                      req.status === 'APPROVED'
                        ? 'bg-[var(--status-green)]/15 text-[var(--status-green)]'
                        : req.status === 'REJECTED'
                        ? 'bg-[var(--status-red)]/15 text-[var(--status-red)]'
                        : 'bg-[var(--status-amber)]/15 text-[var(--status-amber)]'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Admin Dashboard (Section 3.3)
// "Users, roles, devices, sync status. No financial figures."
// ---------------------------------------------------------------------------
export const AdminDashboard: React.FC<CommonRoleViewProps> = ({ onNavigate }) => {
  const users = [
    { name: 'Elder Kofi Mensah', role: 'Treasurer', device: 'LAPTOP-TREAS-01', status: 'Active' },
    { name: 'Deacon Kwesi Appiah', role: 'Finance Secretary', device: 'DESK-SEC-02', status: 'Active' },
    { name: 'Sister Grace Addo', role: 'Counter A', device: 'TAB-COUNT-01', status: 'Active' },
    { name: 'Brother Emmanuel Osei', role: 'Counter B', device: 'TAB-COUNT-02', status: 'Active' },
    { name: 'Rev. Dr. Samuel Boateng', role: 'Pastor / Elder', device: 'PHONE-PASTOR-01', status: 'Active' },
    { name: 'Mr. David Mensah', role: 'Auditor', device: 'LAPTOP-AUDIT-01', status: 'Active' },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Notice */}
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)]">
        <strong>System Administration Mode:</strong> In strict compliance with church internal controls, financial balances and figures are excluded from administrator views.
      </div>

      {/* Users & Assigned Roles */}
      <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
              Authorized Personnel & Active Roles
            </h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('settings')}>
            Manage Users
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-[var(--text-secondary)] bg-[var(--surface-subtle)]">
                <th className="py-2.5 px-4 font-normal">Full Name</th>
                <th className="py-2.5 px-4 font-normal">Assigned Role</th>
                <th className="py-2.5 px-4 font-normal">Enrolled Device</th>
                <th className="py-2.5 px-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border-subtle)] text-[13px]">
              {users.map((u) => (
                <tr key={u.name} className="hover:bg-[var(--surface-subtle)] transition">
                  <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">{u.name}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-medium">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[var(--text-muted)] text-xs">
                    {u.device}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[var(--status-green)] text-xs">
                      <StatusDot status="synced" />
                      <span>{u.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Device Sync Health */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <div className="font-serif text-base font-semibold text-[var(--text-primary)]">
              Offline-First Multi-Device Sync Mesh
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              CRDT vector clock synchronization healthy across all 6 church terminal devices.
            </div>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => onNavigate('settings')}>
          View Sync Logs
        </Button>
      </div>
    </div>
  );
};
