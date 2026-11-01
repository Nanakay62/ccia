import React from 'react';
import { Lock } from 'lucide-react';

export interface FundMarkerProps {
  fundCode: string; // GEN, BLD, MIS, WEL, YTH
  fundName: string;
  isRestricted: boolean;
  showName?: boolean;
  showType?: boolean;
  className?: string;
}

export const FundMarker: React.FC<FundMarkerProps> = ({
  fundCode,
  fundName,
  isRestricted,
  showName = true,
  showType = false,
  className = '',
}) => {
  // Muted, distinguishable color tokens
  const code = fundCode.toUpperCase();
  const markerColor =
    code === 'GEN'
      ? 'var(--fund-gen)'
      : code === 'BLD'
      ? 'var(--fund-bld)'
      : code === 'MIS'
      ? 'var(--fund-mis)'
      : code === 'WEL'
      ? 'var(--fund-wel)'
      : code === 'YTH'
      ? 'var(--fund-yth)'
      : 'var(--text-secondary)';

  return (
    <div className={`inline-flex items-center gap-2 text-sm ${className}`}>
      {/* Small fixed color indicator bar/dot */}
      <span
        className="w-2 h-3.5 rounded-[2px] shrink-0"
        style={{ backgroundColor: markerColor }}
        aria-hidden="true"
      />

      {/* Fund Code as clear text */}
      <span className="font-medium text-[13px] text-[var(--text-secondary)] uppercase tracking-wide">
        {fundCode}
      </span>

      {/* Fund Name */}
      {showName && (
        <span className="text-[15px] font-normal text-[var(--text-primary)] truncate">
          {fundName}
        </span>
      )}

      {/* Restricted Label with Lock Icon (Never color alone) */}
      {showType && (
        <span className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] ml-1">
          {isRestricted ? (
            <>
              <Lock className="w-3.5 h-3.5 text-[var(--status-amber)]" aria-label="Restricted Fund" />
              <span>Restricted</span>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">Unrestricted</span>
          )}
        </span>
      )}
    </div>
  );
};
