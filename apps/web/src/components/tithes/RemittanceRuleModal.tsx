import React, { useState } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import type { TitheRemittanceRule, TitheRemittanceBasis } from '@church/domain';

interface RemittanceRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRule?: TitheRemittanceRule;
}

export const RemittanceRuleModal: React.FC<RemittanceRuleModalProps> = ({
  isOpen,
  onClose,
  existingRule,
}) => {
  const { currentUser } = useAuth();
  const { saveRemittanceRule } = useTithes();
  const { showToast } = useToast();

  const [name, setName] = useState(existingRule?.name || 'District Headquarters Assessment');
  const [payeeName, setPayeeName] = useState(existingRule?.payeeName || 'Accra District Office');
  const [basis, setBasis] = useState<TitheRemittanceBasis>(existingRule?.basis || 'PERCENTAGE');
  const [rateOrAmount, setRateOrAmount] = useState(
    existingRule?.percentageOrAmount || '10'
  );
  const [currency, setCurrency] = useState(existingRule?.currency || 'GHS');
  const [dueDayOfMonth, setDueDayOfMonth] = useState<number>(existingRule?.dueDayOfMonth || 10);
  const [effectiveFrom, setEffectiveFrom] = useState(
    existingRule?.effectiveFrom || '2026-01-01'
  );
  const [isActive, setIsActive] = useState(existingRule ? existingRule.isActive : true);

  if (!isOpen) return null;

  const isTreasurer = currentUser?.role === 'Treasurer';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTreasurer) {
      showToast('Only the Treasurer is authorized to configure remittance rules.', 'error');
      return;
    }

    if (!name.trim()) {
      showToast('Rule name is required.', 'error');
      return;
    }
    if (!payeeName.trim()) {
      showToast('Payee name is required.', 'error');
      return;
    }

    const numVal = parseFloat(rateOrAmount);
    if (isNaN(numVal) || numVal <= 0) {
      showToast('Please enter a valid positive percentage or amount.', 'error');
      return;
    }

    try {
      saveRemittanceRule(
        {
          branchId: '00000000-0000-0000-0000-000000000001',
          name: name.trim(),
          basis,
          percentageOrAmount: basis === 'PERCENTAGE' ? String(numVal) : String(BigInt(Math.round(numVal * 100))),
          currency,
          frequency: 'MONTHLY',
          dueDayOfMonth: Math.min(28, Math.max(1, dueDayOfMonth)),
          effectiveFrom,
          payeeName: payeeName.trim(),
          isActive,
        },
        existingRule?.id
      );

      showToast('Denominational remittance rule saved successfully.', 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save remittance rule.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl w-full max-w-lg overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div>
            <h3 className="font-semibold text-[15px] text-[var(--text-primary)]">
              {existingRule ? 'Edit Remittance Rule' : 'Configure Remittance Rule'}
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">
              Denominational tithe assessment policy (Treasurer only)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-border)]/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isTreasurer && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-[12px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Read-only: Only the Treasurer is authorized to modify remittance policies.</span>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Rule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isTreasurer}
              placeholder="e.g. District Headquarters Assessment"
              required
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Payee (Denominational Body)
            </label>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              disabled={!isTreasurer}
              placeholder="e.g. Accra District Office / National Secretariat"
              required
              className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Assessment Basis
              </label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as TitheRemittanceBasis)}
                disabled={!isTreasurer}
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
              >
                <option value="PERCENTAGE">Percentage of Gross Tithes</option>
                <option value="FIXED">Fixed Monthly Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                {basis === 'PERCENTAGE' ? 'Rate (%)' : 'Amount'}
              </label>
              <input
                type="number"
                step={basis === 'PERCENTAGE' ? '0.1' : '1'}
                value={rateOrAmount}
                onChange={(e) => setRateOrAmount(e.target.value)}
                disabled={!isTreasurer}
                placeholder={basis === 'PERCENTAGE' ? '10' : '2500.00'}
                required
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Remittance Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!isTreasurer}
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
              >
                <option value="GHS">Ghana Cedi (GHS)</option>
                <option value="USD">US Dollar (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Due Day of Following Month
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={dueDayOfMonth}
                onChange={(e) => setDueDayOfMonth(parseInt(e.target.value, 10) || 10)}
                disabled={!isTreasurer}
                required
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-1">
                Effective From
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={!isTreasurer}
                required
                className="w-full px-3 py-1.5 text-[13px] border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-60"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={!isTreasurer}
                  className="rounded border-[var(--surface-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span>Active Rule</span>
              </label>
            </div>
          </div>

          {/* Footer Actions (Rule A1: One filled primary button) */}
          <div className="pt-4 border-t border-[var(--surface-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium border border-[var(--surface-border)] rounded-[var(--radius)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Cancel
            </button>
            {isTreasurer && (
              <button
                type="submit"
                className="px-4 py-2 text-[13px] font-medium rounded-[var(--radius)] bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Save Remittance Rule
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
