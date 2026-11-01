import React, { useState } from 'react';
import { useSync } from '../context/SyncContext.js';
import { useDemo } from '../context/DemoContext.js';
import { StatusDot } from './ui/StatusDot.js';
import { Button } from './ui/Button.js';
import { RefreshCw, X, Laptop, Cloud, CloudOff, AlertTriangle, ShieldAlert } from 'lucide-react';
import { NeedsAttentionModal } from './sync/NeedsAttentionModal.js';
import { ConflictResolutionModal } from './sync/ConflictResolutionModal.js';
import { useModalEscape } from '../utils/useModalEscape.js';

interface SyncIndicatorProps {
  embedded?: boolean;
  className?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ embedded: _embedded, className = '' }) => {
  const {
    isOnline,
    isSyncing,
    pendingUploadCount,
    needsAttentionCount,
    conflictsCount,
    lastSyncedAt,
    toggleOnlineStatus,
    triggerSync,
  } = useSync();
  const { isDemoMode } = useDemo();

  const [isOpen, setIsOpen] = useState(false);
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useModalEscape(isOpen, () => setIsOpen(false));
  useModalEscape(showAttentionModal, () => setShowAttentionModal(false));
  useModalEscape(showConflictModal, () => setShowConflictModal(false));

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Never synced';
    const secondsAgo = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
    if (secondsAgo < 60) return 'Just now';
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo} min ago`;
  };

  // Determine indicator text and semantic dot status per Section 4 & Section 5.1
  let statusKey: 'synced' | 'waiting' | 'attention' | 'error' = 'synced';
  let statusText = '';

  if (isDemoMode) {
    statusKey = 'attention';
    statusText = 'Demo mode — sync disabled';
  } else {
    const parts: string[] = [];
    parts.push(isOnline ? 'Online' : 'Offline');

    if (isSyncing) {
      statusKey = 'waiting';
      parts.push('Syncing...');
    } else if (pendingUploadCount > 0) {
      statusKey = 'waiting';
      parts.push(`${pendingUploadCount} waiting to sync`);
    } else {
      parts.push('All saved and synced');
    }

    if (needsAttentionCount > 0) {
      statusKey = 'attention';
      parts.push(`${needsAttentionCount} Need Attention`);
    }

    statusText = parts.join(' • ');
  }

  return (
    <div className={`relative ${className}`}>
      {/* Interactive Single Sync Indicator Trigger */}
      <button
        onClick={() => {
          if (!isDemoMode && needsAttentionCount > 0) {
            setShowAttentionModal(true);
          } else {
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] hover:bg-[var(--surface-subtle)] border border-transparent hover:border-[var(--surface-border)] transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        title="Click to view synchronization details"
        aria-expanded={isOpen}
      >
        <StatusDot status={statusKey} label={statusText} />
      </button>

      {/* Flyout Sync Details Panel (Section 4) */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-xl z-50 p-4 text-[14px] space-y-3.5 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <div className="font-serif text-[16px] font-semibold text-[var(--text-primary)]">
                Sync &amp; Device Status
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Close sync panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Device & Connectivity Info */}
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Device Name:</span>
                </span>
                <span className="font-medium text-[var(--text-primary)]">ACCRA-MAIN-POS01</span>
              </div>

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Connectivity:</span>
                <button
                  onClick={toggleOnlineStatus}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)]"
                  title="Click to toggle network simulation"
                >
                  {isOnline ? (
                    <>
                      <Cloud className="w-3 h-3 text-[var(--status-green)]" />
                      <span className="text-[var(--status-green)]">Online</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3 text-[var(--status-amber)]" />
                      <span className="text-[var(--status-amber)]">Offline Mode</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Last Synchronized:</span>
                <span className="font-medium text-[var(--text-primary)]">{formatLastSync()}</span>
              </div>

              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Queued offline changes:</span>
                <span className="font-medium tabular-nums text-[var(--text-primary)]">
                  {pendingUploadCount} {pendingUploadCount === 1 ? 'entry' : 'entries'}
                </span>
              </div>
            </div>

            {/* Attention / Rejections Alert if any */}
            {needsAttentionCount > 0 && (
              <div className="p-2.5 rounded bg-[var(--status-red-bg)] border border-[var(--status-red)] text-[13px] space-y-1.5">
                <div className="flex items-center gap-2 text-[var(--status-red)] font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{needsAttentionCount} rejected items need review</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Some postings failed server validation rules (e.g., closed accounting period).
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setShowAttentionModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full text-xs h-7 mt-1"
                >
                  Review Rejected Postings
                </Button>
              </div>
            )}

            {/* Conflicts Alert if any */}
            {conflictsCount > 0 && (
              <div className="p-2.5 rounded bg-[var(--status-amber-bg)] border border-[var(--status-amber)] text-[13px] space-y-1.5">
                <div className="flex items-center gap-2 text-[var(--status-amber)] font-medium">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{conflictsCount} concurrent conflicts detected</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowConflictModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full text-xs h-7 mt-1"
                >
                  Resolve Conflicts
                </Button>
              </div>
            )}

            {/* Demo Mode Hard Guard Alert (Section 5.1) */}
            {isDemoMode && (
              <div className="p-2.5 rounded bg-[var(--status-amber)]/10 border border-[var(--status-amber)]/30 text-[12.5px] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--status-amber)] font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Demo Mode — Sync Disabled</span>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  Sandbox database is isolated. Automatic and manual sync to remote servers or devices is blocked to prevent data contamination.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-[var(--surface-border-subtle)] flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">
                {isDemoMode
                  ? 'Sync blocked in demo mode'
                  : isOnline
                  ? 'Direct sync connection ready'
                  : 'Reconnect to upload'}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => triggerSync()}
                disabled={isDemoMode || !isOnline || isSyncing}
                title={isDemoMode ? 'Sync is disabled in Demo Mode' : 'Trigger synchronization'}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modals for Attention & Conflict Resolution */}
      <NeedsAttentionModal
        isOpen={showAttentionModal}
        onClose={() => setShowAttentionModal(false)}
      />

      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </div>
  );
};
