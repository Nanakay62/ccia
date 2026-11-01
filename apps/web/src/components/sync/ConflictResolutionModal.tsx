import React from 'react';
import { useSync } from '../../context/SyncContext.js';
import { ShieldAlert, X, Check, ArrowRight } from 'lucide-react';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { conflicts, resolveConflict } = useSync();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-lg">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <span>Concurrency Conflicts ({conflicts.length})</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational description */}
        <p className="mt-3 text-xs text-slate-300">
          An offline modification collided with a newer revision on the server (optimistic concurrency check failed on <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">row_version</code>). To prevent silent overwriting of data, compare both versions below.
        </p>

        {/* Conflicts list */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {conflicts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Check className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p className="font-medium text-slate-200">No Active Conflicts</p>
              <p className="text-xs text-slate-500 mt-1">All local records match server version.</p>
            </div>
          ) : (
            conflicts.map((conf, idx) => (
              <div
                key={`${conf.recordId}-${idx}`}
                className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="font-mono text-amber-400 font-bold">{conf.entityType} ({conf.recordId})</span>
                  <span className="text-slate-400 text-[11px]">
                    {conf.message}
                  </span>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Server Version */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-emerald-900/50 space-y-2">
                    <div className="flex items-center justify-between text-emerald-400 font-semibold">
                      <span>Server Version (Active)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-[10px]">
                        v{conf.serverVersion}
                      </span>
                    </div>
                    <pre className="p-2 rounded bg-slate-950 text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(conf.serverState, null, 2)}
                    </pre>
                  </div>

                  {/* Client Version */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-amber-900/50 space-y-2">
                    <div className="flex items-center justify-between text-amber-400 font-semibold">
                      <span>Local Device Attempt</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-[10px]">
                        v{conf.clientVersion} (Stale)
                      </span>
                    </div>
                    <pre className="p-2 rounded bg-slate-950 text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(conf.clientState, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Resolution buttons */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-end gap-2">
                  <button
                    onClick={() => resolveConflict(conf.recordId, 'KEEP_SERVER')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium text-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Keep Server Version (Recommended)</span>
                  </button>
                  <button
                    onClick={() => resolveConflict(conf.recordId, 'FORCE_CLIENT')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-medium text-xs transition"
                  >
                    <span>Force Local Override</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
