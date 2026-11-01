import React, { useState } from 'react';
import { useSync } from '../../context/SyncContext.js';
import { AlertTriangle, X, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

interface NeedsAttentionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NeedsAttentionModal: React.FC<NeedsAttentionModalProps> = ({ isOpen, onClose }) => {
  const { rejections, dismissRejection, requeueRejection } = useSync();
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<{ [id: string]: string }>({});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-lg">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <span>Sync Rejections: Needs Attention ({rejections.length})</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational banner */}
        <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-200">
          <p className="font-semibold text-rose-300">Non-Blocking Rejection Protocol:</p>
          <p className="mt-1">
            When an offline transaction violates server constraints (such as an entry into a closed period or an unauthorized posting), the system isolates it here without blocking subsequent transactions. As Treasurer or Finance Secretary, you may inspect the failure trace, dismiss it with an audit note, or edit and re-queue.
          </p>
        </div>

        {/* Rejection List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {rejections.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p className="font-medium text-slate-200">All Rejections Cleared</p>
              <p className="text-xs text-slate-500 mt-1">There are no pending rejected transactions.</p>
            </div>
          ) : (
            rejections.map((rej) => (
              <div
                key={rej.id}
                className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {String(rej.payload['document_number'] || rej.transactionId)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">
                      {rej.entityType}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
                      {rej.deviceId}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    {new Date(rej.rejectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-slate-200">
                  <span className="font-semibold text-rose-300">Rejection Cause: </span>
                  {rej.reason}
                </div>

                {/* Collapsible raw payload */}
                <div>
                  <button
                    onClick={() =>
                      setExpandedPayloadId((prev) => (prev === rej.id ? null : rej.id))
                    }
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {expandedPayloadId === rej.id ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>{expandedPayloadId === rej.id ? 'Hide Raw Payload' : 'View Raw Payload'}</span>
                  </button>

                  {expandedPayloadId === rej.id && (
                    <pre className="mt-2 p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-36">
                      {JSON.stringify(rej.payload, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Action Bar */}
                <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder="Audit reason for resolution..."
                    value={resolutionNote[rej.id] || ''}
                    onChange={(e) =>
                      setResolutionNote({ ...resolutionNote, [rej.id]: e.target.value })
                    }
                    className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        dismissRejection(rej.id, resolutionNote[rej.id] || 'Dismissed by Treasurer')
                      }
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-medium transition"
                    >
                      Dismiss & Log
                    </button>
                    <button
                      onClick={() => requeueRejection(rej.id)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition"
                    >
                      Re-queue
                    </button>
                  </div>
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
