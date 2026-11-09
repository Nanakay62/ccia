import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X,
  Lock,
} from 'lucide-react';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { formatDate } from '../../config/churchSettings.js';
import type { SecurityEvent, SecuritySeverity } from '@church/domain';

export const SecurityEventsPage: React.FC = () => {
  const {
    events,
    acknowledgeSecurityEvent,
    hashChainResult,
    verifyHashChainNow,
    dailySecuritySummary,
  } = useSecurityEvents();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [severityFilter, setSeverityFilter] = useState<'ALL' | SecuritySeverity>('ALL');
  const [ackFilter, setAckFilter] = useState<'ALL' | 'UNACKNOWLEDGED' | 'ACKNOWLEDGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Acknowledge Modal state
  const [selectedEventForAck, setSelectedEventForAck] = useState<SecurityEvent | null>(null);
  const [ackReason, setAckReason] = useState('');

  useModalEscape(!!selectedEventForAck, () => setSelectedEventForAck(null));

  const filteredEvents = useMemo(() => {
    return events.filter((ev: SecurityEvent) => {
      if (severityFilter !== 'ALL' && ev.severity !== severityFilter) return false;
      if (ackFilter === 'UNACKNOWLEDGED' && ev.acknowledgedAt) return false;
      if (ackFilter === 'ACKNOWLEDGED' && !ev.acknowledgedAt) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchType = ev.eventType.toLowerCase().includes(q);
        const matchDesc = ev.description.toLowerCase().includes(q);
        const matchActor = ev.actorName.toLowerCase().includes(q);
        if (!matchType && !matchDesc && !matchActor) return false;
      }
      return true;
    });
  }, [events, severityFilter, ackFilter, searchQuery]);

  const unacknowledgedCount = useMemo(
    () => events.filter((e: SecurityEvent) => !e.acknowledgedAt).length,
    [events]
  );

  const handleConfirmAck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForAck || !ackReason.trim()) return;
    acknowledgeSecurityEvent(selectedEventForAck.id, ackReason.trim());
    showToast(`Security event acknowledged and logged to permanent audit trail.`, 'success');
    setSelectedEventForAck(null);
    setAckReason('');
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
            <span>Security Events &amp; Anti-Tampering Monitor</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1e3a2f]" />
            <span>Security Events &amp; Governance Monitor</span>
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Real-time monitoring of sign-in anomalies, MFA resets, period reopenings, confidential data exports, and ledger hash-chain verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const res = verifyHashChainNow();
              showToast(
                res.isClean
                  ? `Cryptographic Hash-Chain Verified: All ${res.totalEntriesChecked} posted entries intact.`
                  : `Hash-chain mismatch detected (${res.brokenLinks.length} broken link(s))!`,
                res.isClean ? 'success' : 'error'
              );
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-semibold transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Verify Ledger Hash-Chain</span>
          </button>
        </div>
      </div>

      {/* 4 Posture Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Ledger Hash-Chain Integrity
          </span>
          <div className="flex items-center gap-2 mt-1">
            {hashChainResult.isClean ? (
              <span className="text-lg font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" />
                <span>Verified ({hashChainResult.totalEntriesChecked} Entries)</span>
              </span>
            ) : (
              <span className="text-lg font-bold text-rose-600 flex items-center gap-1.5">
                <ShieldAlert className="w-5 h-5" />
                <span>Tamper Alert</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block font-mono truncate">
            Head: {(hashChainResult.latestChainHash || '').slice(0, 20)}...
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Pending Security Alerts
          </span>
          <span className="text-2xl font-bold text-amber-600 tabular-nums mt-1 block">
            {unacknowledgedCount}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            Awaiting Auditor or Treasurer review
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            Failed Sign-Ins (Last 24h)
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1 block">
            {dailySecuritySummary.failedLogins24h}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            10-attempt lockout policy active
          </span>
        </div>

        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
            High-Value Manual Journals (24h)
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1 block">
            {dailySecuritySummary.highValueManualJournals24h}
          </span>
          <span className="text-[12px] text-[var(--text-secondary)] mt-0.5 block">
            All logged with mandatory purpose
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'UNACKNOWLEDGED', 'ACKNOWLEDGED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setAckFilter(st)}
              className={`px-3 py-1 rounded-[var(--radius-sm)] text-[12px] font-semibold transition cursor-pointer ${
                ackFilter === st
                  ? 'bg-[#1e3a2f] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel)]'
              }`}
            >
              {st === 'ALL'
                ? `All Events (${events.length})`
                : st === 'UNACKNOWLEDGED'
                ? `Needs Review (${unacknowledgedCount})`
                : 'Acknowledged'}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-[var(--surface-border)] mx-1" />

          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-bold uppercase transition cursor-pointer ${
                severityFilter === sev
                  ? 'bg-amber-700 text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, actors, or descriptions..."
            className="w-full text-[13px] pl-9 pr-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] overflow-hidden">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <th className="py-3 px-4">Date &amp; Time</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Event Type</th>
              <th className="py-3 px-4">Actor &amp; Role</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-right">Review Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {filteredEvents.map((ev: SecurityEvent) => (
              <tr key={ev.id} className="hover:bg-[var(--surface-panel)]">
                <td className="py-3 px-4 whitespace-nowrap text-[12px] text-[var(--text-secondary)] tabular-nums">
                  <div>{formatDate(ev.timestamp.slice(0, 10))}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{ev.timestamp.slice(11, 16)} UTC</div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      ev.severity === 'CRITICAL' || ev.severity === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : ev.severity === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {ev.severity}
                  </span>
                </td>
                <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                  {ev.eventType.replace(/_/g, ' ')}
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-[var(--text-primary)]">{ev.actorName}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{ev.actorRole}</div>
                </td>
                <td className="py-3 px-4 text-[12px] text-[var(--text-secondary)] max-w-md">
                  <div>{ev.description}</div>
                  {ev.acknowledgedAt && ev.acknowledgedBy && (
                    <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <strong>Reviewed by {ev.acknowledgedBy}:</strong>{' '}
                      {String(ev.metadata?.acknowledgementNote || 'Verified and logged.')}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {ev.acknowledgedAt ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Acknowledged</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEventForAck(ev);
                        setAckReason('');
                      }}
                      className="px-3 py-1 rounded-[var(--radius-sm)] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[12px] font-semibold transition cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acknowledge Modal */}
      {selectedEventForAck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Acknowledge Security Alert</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEventForAck(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px] space-y-1">
              <div className="font-bold text-[var(--text-primary)]">
                {selectedEventForAck.eventType.replace(/_/g, ' ')}
              </div>
              <div className="text-[var(--text-secondary)]">{selectedEventForAck.description}</div>
            </div>

            <form onSubmit={handleConfirmAck} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1">
                  Investigation &amp; Review Note *
                </label>
                <textarea
                  rows={3}
                  required
                  value={ackReason}
                  onChange={(e) => setAckReason(e.target.value)}
                  placeholder="Enter verification outcome (e.g. Verified with Finance Secretary; authorized period adjustment)..."
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setSelectedEventForAck(null)}
                  className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!ackReason.trim()}
                  className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-semibold transition disabled:opacity-40 cursor-pointer"
                >
                  Confirm &amp; Log Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
