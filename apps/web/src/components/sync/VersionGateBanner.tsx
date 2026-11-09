import React, { useState } from 'react';
import { AlertOctagon, RefreshCw, X, Info } from 'lucide-react';
import { evaluateVersionGate } from '@church/domain';
import type { ServerVersionPolicy } from '@church/domain';

interface VersionGateBannerProps {
  readonly clientAppVersion?: string;
  readonly clientSchemaVersion?: number;
  readonly serverPolicy?: ServerVersionPolicy;
}

export const VersionGateBanner: React.FC<VersionGateBannerProps> = ({
  clientAppVersion = '1.0.0',
  clientSchemaVersion = 1,
  serverPolicy = {
    minSupportedAppVersion: '1.0.0',
    minSupportedSchemaVersion: 1,
    latestAppVersion: '1.0.0',
  },
}) => {
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const evaluation = evaluateVersionGate({
    clientAppVersion,
    clientSchemaVersion,
    serverPolicy,
  });

  if (evaluation.status === 'UP_TO_DATE') {
    return null;
  }

  // Blocking Banner: Outdated client below minimum supported version
  if (evaluation.status === 'BLOCKED_OUTDATED') {
    return (
      <div className="w-full bg-rose-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-[13px] z-50">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 shrink-0 text-white" />
          <div>
            <strong className="font-bold">Posting Disabled:</strong>{' '}
            <span>{evaluation.userMessage}</span>
            <span className="text-rose-100 text-[12px] block sm:inline sm:ml-2">
              (Current: v{clientAppVersion} • Required: v{serverPolicy.minSupportedAppVersion}+). All records remain viewable in read-only mode.
            </span>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 px-3 py-1 rounded-[var(--radius-sm)] bg-white text-rose-800 font-bold text-[12px] hover:bg-rose-50 transition cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Update Now</span>
        </button>
      </div>
    );
  }

  // Non-blocking update prompt
  if (evaluation.status === 'UPDATE_AVAILABLE' && !dismissedUpdate) {
    return (
      <div className="w-full bg-[#1e3a2f] text-emerald-50 px-4 py-2 shadow-xs flex items-center justify-between gap-3 text-[12px] z-40">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>
            {evaluation.userMessage}{' '}
            {evaluation.releaseNotes && <span className="text-emerald-200">({evaluation.releaseNotes})</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-[11px] transition cursor-pointer"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissedUpdate(true)}
            className="text-emerald-300 hover:text-white p-0.5"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
