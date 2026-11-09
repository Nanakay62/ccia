import React, { useMemo } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Users,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext.js';

export const ItSecurityChecklistPage: React.FC = () => {
  const { navigate } = useRouter();

  // Role MFA adoption data (Spec C6)
  const roleMfaStats = [
    { role: 'Treasurer', totalUsers: 1, mfaEnrolled: 1, required: true },
    { role: 'Pastor / Elder', totalUsers: 2, mfaEnrolled: 2, required: true },
    { role: 'Finance Secretary', totalUsers: 1, mfaEnrolled: 1, required: true },
    { role: 'Auditor', totalUsers: 1, mfaEnrolled: 1, required: true },
    { role: 'Admin', totalUsers: 1, mfaEnrolled: 1, required: true },
    { role: 'Department Head', totalUsers: 3, mfaEnrolled: 2, required: false },
    { role: 'Counter', totalUsers: 4, mfaEnrolled: 2, required: false },
  ];

  // Enrolled devices data (Spec Section C6 & D)
  const enrolledDevices = [
    {
      id: 'dev-001',
      name: 'Treasurer HP EliteBook (Finance Office)',
      user: 'Kofi Mensah (Treasurer)',
      appVersion: '1.0.0',
      schemaVersion: 1,
      lastSync: '10 mins ago',
      status: 'APPROVED',
      syncHealth: 'SYNCED',
    },
    {
      id: 'dev-002',
      name: 'Administration iPad (Vestry)',
      user: 'Rev. Emmanuel Addo (Pastor)',
      appVersion: '1.0.0',
      schemaVersion: 1,
      lastSync: '2 hours ago',
      status: 'APPROVED',
      syncHealth: 'SYNCED',
    },
    {
      id: 'dev-003',
      name: 'Counting Room Surface Go',
      user: 'Sarah Osei (Finance Secretary)',
      appVersion: '1.0.0',
      schemaVersion: 1,
      lastSync: 'Yesterday, 17:30',
      status: 'APPROVED',
      syncHealth: 'SYNCED',
    },
  ];

  const overallMfaPercent = useMemo(() => {
    const total = roleMfaStats.reduce((s, r) => s + r.totalUsers, 0);
    const enrolled = roleMfaStats.reduce((s, r) => s + r.mfaEnrolled, 0);
    return Math.round((enrolled / total) * 100);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] font-medium mb-1">
            <button onClick={() => navigate('#/settings')} className="hover:text-[var(--text-primary)] transition">
              Settings
            </button>
            <span>/</span>
            <span>Security &amp; IT Governance</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1e3a2f]" />
            <span>IT Officer Security Checklist (Spec Section C6)</span>
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Role MFA adoption, inactive account monitoring, backup verification health, and client version distribution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold px-2.5 py-1 rounded-[var(--radius-sm)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Posture: Strong (Zero Breaches)</span>
          </span>
        </div>
      </div>

      {/* 4 Health KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Privileged MFA Adoption</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-600">100%</span>
            <span className="text-[12px] text-[var(--text-muted)]">({overallMfaPercent}% church-wide)</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium block mt-1">
            All 6 privileged accounts protected by TOTP 2FA.
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Devices Not Synced &gt;30d</span>
            <Smartphone className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">0</span>
            <span className="text-[12px] text-emerald-700 font-medium">Clean</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] block mt-1">
            All 3 enrolled devices synced within the last 24h.
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Accounts Inactive &gt;90d</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">0</span>
            <span className="text-[12px] text-emerald-700 font-medium">Clean</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] block mt-1">
            Zero dormant administrative logins detected.
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Backup &amp; Restore Health</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-600">Verified</span>
            <span className="text-[12px] text-[var(--text-muted)]">04 Nov 2026</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium block mt-1">
            SHA-256 sandbox dry-run tested with zero corruption.
          </span>
        </div>
      </div>

      {/* Section 1: Role-by-Role MFA Adoption Table */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Role-by-Role Two-Step Verification (MFA) Status</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Spec Section C1 requires mandatory TOTP 2FA for Treasurer, Pastor/Elder, Finance Secretary, Auditor, and Admin.
            </p>
          </div>
          <button
            onClick={() => navigate('#/settings')}
            className="text-[12px] text-[#1e3a2f] dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Manage users</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4 text-center">Policy Rule</th>
                <th className="py-2.5 px-4 text-right">Users</th>
                <th className="py-2.5 px-4 text-right">MFA Enrolled</th>
                <th className="py-2.5 px-4 text-center">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {roleMfaStats.map((r) => {
                const is100 = r.mfaEnrolled === r.totalUsers;
                return (
                  <tr key={r.role} className="hover:bg-[var(--surface-panel)] transition">
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{r.role}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          r.required
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {r.required ? 'Mandatory' : 'Recommended'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{r.totalUsers}</td>
                    <td className="py-3 px-4 text-right font-bold text-[var(--text-primary)]">{r.mfaEnrolled}</td>
                    <td className="py-3 px-4 text-center">
                      {is100 ? (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>100% Enrolled</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>{Math.round((r.mfaEnrolled / r.totalUsers) * 100)}%</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Enrolled Devices by Version & Sync Status */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Enrolled Devices &amp; Version Gate (Spec Section D)</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Devices report App Version and Schema Version at sync. Devices below v1.0.0 are blocked from posting.
            </p>
          </div>
          <button
            onClick={() => navigate('#/settings')}
            className="text-[12px] text-[#1e3a2f] dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Manage devices</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-2.5 px-4">Device Name</th>
                <th className="py-2.5 px-4">Authorized User</th>
                <th className="py-2.5 px-4 text-center">App Version</th>
                <th className="py-2.5 px-4 text-center">Schema</th>
                <th className="py-2.5 px-4 text-center">Last Sync</th>
                <th className="py-2.5 px-4 text-center">Version Gate Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {enrolledDevices.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--surface-panel)] transition">
                  <td className="py-3 px-4 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-[#1e3a2f]" />
                    <span>{d.name}</span>
                  </td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{d.user}</td>
                  <td className="py-3 px-4 text-center font-mono text-[12px]">{d.appVersion}</td>
                  <td className="py-3 px-4 text-center font-mono text-[12px]">v{d.schemaVersion}</td>
                  <td className="py-3 px-4 text-center text-[12px] text-[var(--text-muted)]">{d.lastSync}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Compatible (Active)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
