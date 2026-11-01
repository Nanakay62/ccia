/**
 * Official Church Letterhead Component.
 * Implements Section 1.6 & Phase 5 of the specification:
 * - Logo / Church crest
 * - Church name, branch, physical address, contact phone/email
 * - Official Tax / Charity Registration Number (GRA TIN & DSW)
 * - Tasteful kente-inspired accent strip (accent & gold)
 * - Document title, document number, and date
 * - Watermark support: 'DRAFT' for unapproved/unposted documents, 'DEMO — NOT OFFICIAL' for demo mode
 */

import React from 'react';
import { defaultChurchSettings } from '../../config/churchSettings.js';
import { Landmark, ShieldAlert } from 'lucide-react';
import { useDemo } from '../../context/DemoContext.js';

interface ChurchLetterheadProps {
  documentTitle: string;
  documentNumber?: string;
  documentDate?: string;
  periodText?: string;
  currency?: 'GHS' | 'USD';
  isDraft?: boolean;
  churchName?: string;
  branchName?: string;
  address?: string;
  className?: string;
}

export const ChurchLetterhead: React.FC<ChurchLetterheadProps> = ({
  documentTitle,
  documentNumber,
  documentDate,
  periodText,
  currency = 'GHS',
  isDraft = false,
  churchName = defaultChurchSettings.churchName,
  branchName = defaultChurchSettings.branchName,
  address = defaultChurchSettings.address,
  className = '',
}) => {
  const { isDemoMode } = useDemo();

  return (
    <div className={`relative border-b-2 border-[var(--text-primary)] pb-4 space-y-3 ${className}`}>
      {/* Subtle Woven Kente-Inspired Accent Strip (Section 1.6) */}
      {defaultChurchSettings.kentePatternEnabled && (
        <div className="flex h-1.5 w-full rounded-full overflow-hidden mb-2">
          <div className="flex-1 bg-[var(--accent)]" />
          <div className="w-12 bg-[var(--gold)]" />
          <div className="flex-1 bg-[var(--accent)]" />
          <div className="w-12 bg-[var(--gold)]" />
          <div className="flex-1 bg-[var(--accent)]" />
        </div>
      )}

      {/* Main Header Container */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left: Church Identity & Legal Contacts */}
        <div className="flex items-start gap-3.5">
          {defaultChurchSettings.logoUrl ? (
            <img
              src={defaultChurchSettings.logoUrl}
              alt={churchName}
              className="w-12 h-12 object-contain rounded shrink-0 print:w-12 print:h-12"
            />
          ) : (
            <div className="w-11 h-11 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--accent)] flex items-center justify-center shrink-0 print:border-black print:text-black">
              <Landmark className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-0.5">
            <h1 className="font-serif text-[18px] sm:text-[20px] font-bold text-[var(--text-primary)] tracking-tight leading-snug print:text-black">
              {churchName}
            </h1>
            <p className="text-[13px] font-semibold text-[var(--text-secondary)] print:text-slate-800">
              {branchName}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] print:text-slate-600">
              {address}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] print:text-slate-600">
              Tel: {defaultChurchSettings.phone} • Email: {defaultChurchSettings.email}
            </p>
            <p className="text-[10.5px] font-medium text-[var(--text-secondary)] tracking-wide pt-0.5 print:text-slate-800">
              {defaultChurchSettings.taxRegNumber}
            </p>
          </div>
        </div>

        {/* Right: Official Document Title, Number, & Date Badge */}
        <div className="sm:text-right shrink-0 space-y-1">
          <div className="inline-block px-3 py-1 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] print:border-black print:text-black print:bg-transparent">
            {documentTitle}
          </div>

          {documentNumber && (
            <div className="text-xs text-[var(--text-secondary)] font-mono print:text-slate-900">
              <span className="font-sans text-[11px] text-[var(--text-muted)] mr-1">
                {documentTitle.toLowerCase().includes('receipt') ? 'Receipt No:' : 'Doc No:'}
              </span>
              <strong className="text-[var(--text-primary)] print:text-black font-bold">
                {documentNumber}
              </strong>
            </div>
          )}

          {documentDate && (
            <div className="text-xs text-[var(--text-secondary)] print:text-slate-900">
              <span className="text-[11px] text-[var(--text-muted)] mr-1">Date:</span>
              <span className="font-medium text-[var(--text-primary)] print:text-black">
                {documentDate}
              </span>
            </div>
          )}

          {periodText && (
            <div className="text-[11.5px] text-[var(--text-muted)] print:text-slate-800">
              <span>Period: </span>
              <strong className="text-[var(--text-primary)] print:text-black font-semibold">
                {periodText}
              </strong>
            </div>
          )}

          <div className="text-[11px] text-[var(--text-muted)] print:text-slate-700">
            <span>Currency: </span>
            <strong className="font-semibold text-[var(--text-primary)] print:text-black">
              {currency === 'GHS' ? 'Ghana Cedis (GHS)' : 'US Dollars (USD)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Draft Status Banner if applicable */}
      {isDraft && (
        <div className="mt-2 py-1 px-3 rounded bg-[var(--status-amber)]/10 border border-[var(--status-amber)]/40 flex items-center justify-between text-xs text-[var(--status-amber)] print:border-black print:text-black print:bg-transparent">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>DRAFT DOCUMENT — PENDING FINAL POSTING / SIGN-OFF</span>
          </div>
          <span className="text-[10px] font-mono">UNOFFICIAL COPY</span>
        </div>
      )}

      {/* Demo Sandbox Alert if in Demo Mode */}
      {isDemoMode && (
        <div className="mt-1 py-0.5 px-2.5 rounded bg-black/5 text-[10.5px] font-semibold text-[var(--text-secondary)] flex items-center justify-between print:text-black">
          <span>DEMO SANDBOX RECORD — CHRIST CHURCH OF GRACE, ADABRAKA</span>
          <span className="font-mono text-[10px]">SAMPLE ONLY</span>
        </div>
      )}
    </div>
  );
};
