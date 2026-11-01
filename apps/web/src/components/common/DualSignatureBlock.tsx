/**
 * Official Dual / Triple Signature Block Component.
 * Implements Section 1.6 & Phase 5 of the specification:
 * - Prepared by / Approved by (and optional Received/Certified by)
 * - Signature line, printed name, title/role, date
 * - Official church stamp box
 * - Clean ledger formatting with strong print contrast
 */

import React from 'react';

export interface SignerInfo {
  label?: string; // e.g. "Prepared by", "Approved by", "Received by"
  name: string;
  role: string;
  date?: string;
  signaturePlaceholder?: string; // e.g. "(Signed Digitally)" or empty
}

interface DualSignatureBlockProps {
  preparedBy: SignerInfo;
  approvedBy: SignerInfo;
  thirdSigner?: SignerInfo;
  showStampBox?: boolean;
  notes?: string;
  className?: string;
}

export const DualSignatureBlock: React.FC<DualSignatureBlockProps> = ({
  preparedBy,
  approvedBy,
  thirdSigner,
  showStampBox = true,
  notes,
  className = '',
}) => {
  const signers = [
    { ...preparedBy, defaultLabel: 'Prepared by' },
    { ...approvedBy, defaultLabel: 'Approved by' },
    ...(thirdSigner ? [{ ...thirdSigner, defaultLabel: 'Received / Certified by' }] : []),
  ];

  const gridColsClass = signers.length === 3 || showStampBox 
    ? 'grid-cols-1 sm:grid-cols-3' 
    : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`mt-8 pt-4 border-t border-[var(--surface-border)] break-inside-avoid print:border-slate-800 ${className}`}>
      {notes && (
        <p className="text-[11px] text-[var(--text-muted)] italic mb-6 print:text-slate-600">
          {notes}
        </p>
      )}

      <div className={`grid ${gridColsClass} gap-6 sm:gap-8`}>
        {signers.map((signer, idx) => (
          <div key={idx} className="flex flex-col justify-end space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] print:text-slate-700">
              {signer.label || signer.defaultLabel}:
            </span>

            {/* Signature rule */}
            <div className="h-12 border-b-2 border-slate-700 flex items-end pb-1 print:border-black">
              {signer.signaturePlaceholder ? (
                <span className="font-serif italic text-xs text-[var(--accent)] font-semibold print:text-black">
                  {signer.signaturePlaceholder}
                </span>
              ) : (
                <span className="text-[10px] text-slate-300 print:hidden font-mono">Sign here</span>
              )}
            </div>

            {/* Printed Name & Role */}
            <div className="pt-1">
              <div className="text-xs font-bold text-[var(--text-primary)] print:text-black leading-tight">
                {signer.name || '_________________________'}
              </div>
              <div className="text-[11px] font-medium text-[var(--text-secondary)] print:text-slate-700">
                {signer.role}
              </div>
              {signer.date && (
                <div className="text-[10.5px] text-[var(--text-muted)] print:text-slate-600">
                  Date: <span className="font-medium text-[var(--text-primary)] print:text-black">{signer.date}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Optional Official Stamp Box */}
        {showStampBox && !thirdSigner && (
          <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[var(--radius)] text-center min-h-[90px] print:border-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 print:text-slate-600 font-bold">
              [ OFFICIAL CHURCH STAMP ]
            </span>
            <span className="text-[9.5px] text-[var(--text-muted)] mt-1 print:text-slate-500 font-medium">
              Authorized Signature & Church Stamp
            </span>
          </div>
        )}
      </div>

      {/* Legal accounting footer note */}
      <div className="mt-6 pt-2 border-t border-[var(--surface-border)]/60 text-[10px] text-[var(--text-muted)] flex flex-col sm:flex-row justify-between items-center gap-1 print:text-slate-600">
        <span>This is a formal accounting record of Christ Church of Grace, Adabraka.</span>
        <span>Dual signature required for audit compliance and internal controls.</span>
      </div>
    </div>
  );
};
