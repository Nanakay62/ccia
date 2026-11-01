import React, { useState } from 'react';
import { useSync } from '../context/SyncContext.js';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle, X } from 'lucide-react';

export const SyncIndicator: React.FC = () => {
  const {
    isOnline,
    isSyncing,
    pendingUploadCount,
    needsAttentionCount,
    lastSyncedAt,
    rejections,
    toggleOnlineStatus,
    triggerSync,
    dismissRejection,
  } = useSync();

  const [showAttentionModal, setShowAttentionModal] = useState(false);

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
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {pendingUploadCount} {pendingUploadCount === 1 ? 'entry' : 'entries'} waiting to sync
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Synced {formatLastSync()}
            </span>
          )}
        </div>

        {/* Right: Attention Alert & Sync Button */}
        <div className="flex items-center gap-3">
          {needsAttentionCount > 0 && (
            <button
              onClick={() => setShowAttentionModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 font-medium"
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

      {/* Needs Attention Queue Modal */}
      {showAttentionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>Sync Rejections: Needs Attention ({rejections.length})</span>
              </div>
              <button
                onClick={() => setShowAttentionModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              The following offline transactions failed server-side validation. To prevent blocking the upload queue, they have been moved to this queue for Treasurer review.
            </p>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {rejections.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-medium text-rose-300">
                    <span>{item.entityType}</span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(item.rejectedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-300">{item.reason}</p>
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      onClick={() => dismissRejection(item.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                    >
                      Dismiss & Log
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAttentionModal(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
