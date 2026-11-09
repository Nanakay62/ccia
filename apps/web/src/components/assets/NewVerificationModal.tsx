import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, Play } from 'lucide-react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import type { VerificationScope } from '@church/domain';

interface NewVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStarted: (verificationId: string) => void;
}

export const NewVerificationModal: React.FC<NewVerificationModalProps> = ({
  isOpen,
  onClose,
  onStarted,
}) => {
  useModalEscape(isOpen, onClose);
  const { assets, categories, startVerification } = useFixedAssets();

  // Distinct locations and custodians for dropdown selection
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.location))).filter(Boolean).sort();
  }, [assets]);

  const uniqueCustodians = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.custodian))).filter(Boolean).sort();
  }, [assets]);

  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<VerificationScope>('LOCATION');
  const [scopeValue, setScopeValue] = useState(() => uniqueLocations[0] || '');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default scopeValue on scope change
  const handleScopeChange = (newScope: VerificationScope) => {
    setScope(newScope);
    setErrorMsg(null);
    if (newScope === 'LOCATION' && uniqueLocations.length > 0) {
      setScopeValue(uniqueLocations[0]!);
    } else if (newScope === 'CUSTODIAN' && uniqueCustodians.length > 0) {
      setScopeValue(uniqueCustodians[0]!);
    } else if (newScope === 'CATEGORY' && categories.length > 0) {
      setScopeValue(categories[0]!.code);
    } else {
      setScopeValue('');
    }
  };

  // Count estimated assets in scope
  const estimatedAssetsCount = useMemo(() => {
    const active = assets.filter((a) => a.status !== 'DISPOSED');
    if (scope === 'ALL') return active.length;
    if (scope === 'LOCATION') return active.filter((a) => a.location === scopeValue).length;
    if (scope === 'CUSTODIAN') return active.filter((a) => a.custodian === scopeValue).length;
    if (scope === 'CATEGORY') return active.filter((a) => a.categoryCode === scopeValue).length;
    return active.length;
  }, [assets, scope, scopeValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a descriptive title for this verification run.');
      return;
    }

    const resolvedScopeValue =
      scopeValue ||
      (scope === 'LOCATION'
        ? uniqueLocations[0]
        : scope === 'CUSTODIAN'
        ? uniqueCustodians[0]
        : scope === 'CATEGORY'
        ? categories[0]?.code
        : undefined);

    if (scope !== 'ALL' && !resolvedScopeValue) {
      setErrorMsg('Please select a target scope value.');
      return;
    }

    const verification = startVerification({
      title: title.trim(),
      scope,
      scopeValue: scope !== 'ALL' ? resolvedScopeValue : undefined,
      startDate,
    });

    onStarted(verification.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ver-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#1e4620]" />
            <h2 id="new-ver-title" className="text-base font-semibold text-[var(--text-primary)]">
              Start Physical Verification Run
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-medium text-[var(--text-primary)] mb-1">
              Verification Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 2026 Physical Inventory - Main Sanctuary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Verification Scope
              </label>
              <select
                value={scope}
                onChange={(e) => handleScopeChange(e.target.value as VerificationScope)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                <option value="LOCATION">By Physical Location</option>
                <option value="CUSTODIAN">By Custodian / Dept</option>
                <option value="CATEGORY">By Asset Category</option>
                <option value="ALL">Entire Church Register</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
              </input>
            </div>
          </div>

          {scope === 'LOCATION' && (
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Target Location <span className="text-red-500">*</span>
              </label>
              <select
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'CUSTODIAN' && (
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Target Custodian <span className="text-red-500">*</span>
              </label>
              <select
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                {uniqueCustodians.map((cust) => (
                  <option key={cust} value={cust}>
                    {cust}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'CATEGORY' && (
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Target Asset Category <span className="text-red-500">*</span>
              </label>
              <select
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                {categories.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scope Summary Preview */}
          <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] flex items-center justify-between">
            <span>Expected Assets to Inspect:</span>
            <span className="font-semibold text-[var(--text-primary)] font-mono">
              {estimatedAssetsCount} active items
            </span>
          </div>

          <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Start Verification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
