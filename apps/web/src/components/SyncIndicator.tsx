import React, { useState } from 'react';
import { useSync } from '../context/SyncContext.js';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { NeedsAttentionModal } from './sync/NeedsAttentionModal.js';
import { ConflictResolutionModal } from './sync/ConflictResolutionModal.js';

interface SyncIndicatorProps {
  embedded?: boolean;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ embedded = false }) => {
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

  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Never synced';
    const secondsAgo = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
    if (secondsAgo < 60) return 'Just now';
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo} min ago`;
  };

  const content = (
    <div className={`flex flex-wrap items-center gap-2 sm:gap-3 text-xs ${embedded ? '' : 'justify-between w-full'}`}>
      {/* Left: Connectivity Toggle & Queue Status */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          onClick={toggleOnlineStatus}
          title="Click to toggle network simulation"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition shadow-sm ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
          }`}
        >
          {isOnline ? (
            <>
              <Cloud className="w-3.5 h-3.5" />
              <span>Online</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5" />
              <span>Offline Mode</span>
            </>
          )}
        </button>

        {pendingUploadCount > 0 ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-numeric tabular-nums">{pendingUploadCount}</span>
            <span>{pendingUploadCount === 1 ? 'entry' : 'entries'} waiting to sync</span>
          </span>
        ) : (
          <span className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Synced {formatLastSync()}</span>
          </span>
        )}
      </div>

      {/* Right: Attention Alert, Conflict Alert & Sync Button */}
      <div className="flex items-center gap-2">
        {conflictsCount > 0 && (
          <button
            onClick={() => setShowConflictModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-semibold transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>{conflictsCount} {conflictsCount === 1 ? 'Conflict' : 'Conflicts'}</span>
          </button>
        )}

        {needsAttentionCount > 0 && (
          <button
            onClick={() => setShowAttentionModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 font-semibold transition animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{needsAttentionCount} Need Attention</span>
          </button>
        )}

        <button
          onClick={() => triggerSync()}
          disabled={!isOnline || isSyncing}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg font-semibold transition text-xs shadow-sm ${
            !isOnline || isSyncing
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-blue-500/20'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          <span className="sm:hidden">{isSyncing ? 'Sync...' : 'Sync'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {embedded ? (
        content
      ) : (
        <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          {content}
        </div>
      )}

      <NeedsAttentionModal
        isOpen={showAttentionModal}
        onClose={() => setShowAttentionModal(false)}
      />

      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </>
  );
};
