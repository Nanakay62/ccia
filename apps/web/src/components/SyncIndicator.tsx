import React, { useState } from 'react';
import { useSync } from '../context/SyncContext.js';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { NeedsAttentionModal } from './sync/NeedsAttentionModal.js';
import { ConflictResolutionModal } from './sync/ConflictResolutionModal.js';

export const SyncIndicator: React.FC = () => {
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

  return (
    <>
      <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Connectivity & Queue Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleOnlineStatus}
            title="Click to toggle network simulation"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition ${
              isOnline
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                : 'bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900'
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
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{pendingUploadCount} {pendingUploadCount === 1 ? 'entry' : 'entries'} waiting to sync</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Synced {formatLastSync()}</span>
            </span>
          )}
        </div>

        {/* Right: Attention Alert, Conflict Alert & Sync Button */}
        <div className="flex items-center gap-3">
          {conflictsCount > 0 && (
            <button
              onClick={() => setShowConflictModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 font-medium"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>{conflictsCount} {conflictsCount === 1 ? 'Conflict' : 'Conflicts'}</span>
            </button>
          )}

          {needsAttentionCount > 0 && (
            <button
              onClick={() => setShowAttentionModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 font-medium animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{needsAttentionCount} Need Attention</span>
            </button>
          )}

          <button
            onClick={() => triggerSync()}
            disabled={!isOnline || isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition ${
              !isOnline || isSyncing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

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
