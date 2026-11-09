import React, { useState, useRef, useEffect } from 'react';
import { Bell, ShieldAlert, AlertTriangle, Calendar, ExternalLink } from 'lucide-react';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import { useApprovals } from '../../context/ApprovalContext.js';
import { useRouter } from '../../context/RouterContext.js';
import type { SecurityEvent, SodExceptionRecord } from '@church/domain';

export const NotificationCentrePopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const secContext = useSecurityEvents();
  const securityEvents: SecurityEvent[] = secContext?.events || [];
  const appContext = useApprovals();
  const sodExceptions: SodExceptionRecord[] = appContext?.sodExceptions || [];
  const { navigate } = useRouter();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter unacknowledged alerts or high-severity events
  const unacknowledgedEvents = securityEvents.filter((e: SecurityEvent) => !e.acknowledgedAt);
  const totalBadgeCount = unacknowledgedEvents.length + sodExceptions.filter((e: SodExceptionRecord) => e.isOverridden).length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-panel)] transition cursor-pointer"
        title="Security &amp; Governance Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {totalBadgeCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
            {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] shadow-xl z-50 overflow-hidden text-[13px]">
          <div className="p-3 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] flex items-center justify-between">
            <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#1e3a2f]" />
              <span>Notification Centre</span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {totalBadgeCount} pending items
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--surface-border)]">
            {unacknowledgedEvents.length === 0 && sodExceptions.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-muted)] text-[12px]">
                No pending security or governance notifications. All systems clean.
              </div>
            ) : (
              <>
                {unacknowledgedEvents.slice(0, 5).map((ev: SecurityEvent) => (
                  <div key={ev.id} className="p-3 hover:bg-[var(--surface-panel)] transition space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)] text-[12px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{ev.eventType.replace(/_/g, ' ')}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {ev.timestamp.slice(11, 16)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{ev.description}</p>
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">{ev.actorName}</span>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate('#/security-events');
                        }}
                        className="text-[#1e3a2f] dark:text-emerald-400 font-semibold hover:underline"
                      >
                        Review alert
                      </button>
                    </div>
                  </div>
                ))}

                {sodExceptions.slice(0, 3).map((exc) => (
                  <div key={exc.id} className="p-3 hover:bg-[var(--surface-panel)] transition space-y-1 bg-amber-50/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-amber-900 dark:text-amber-300 text-[12px]">
                        SoD Override Applied
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{exc.timestamp.slice(11, 16)}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">{exc.details}</p>
                    <div className="pt-1 flex justify-end text-[11px]">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate('#/sod-exceptions');
                        }}
                        className="text-[#1e3a2f] font-semibold hover:underline"
                      >
                        View in SoD report
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="p-2.5 bg-[var(--surface-subtle)] border-t border-[var(--surface-border)] flex items-center justify-between text-[11px]">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('#/security-events');
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium flex items-center gap-1"
            >
              <span>Security events</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('#/year-end' as any);
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium flex items-center gap-1"
            >
              <span>Year-end close</span>
              <Calendar className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
