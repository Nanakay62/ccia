import React, { useState } from 'react';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { parsePesewas } from '../../utils/formatters.js';
import { RotateCcw, Save } from 'lucide-react';

export const NewRequisitionPage: React.FC = () => {
  const { funds } = useLedger();
  const { submitRequisition } = useExpenses();
  const { showToast } = useToast();
  const { goBack, navigate } = useRouter();

  const [department, setDepartment] = useState('Music & Choir');
  const [fundId, setFundId] = useState('fund-gen');
  const [purpose, setPurpose] = useState('');
  const [amountGhs, setAmountGhs] = useState('');
  const [quotes, setQuotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPurpose('');
    setAmountGhs('');
    setQuotes('');
  };

  const handleSave = (addAnother = false) => {
    if (!purpose.trim()) {
      showToast('Please state the purpose and justification.', 'error');
      return;
    }
    const pesewas = parsePesewas(amountGhs);
    if (pesewas <= 0n) {
      showToast('Estimated amount must be greater than zero.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fund = funds.find((f) => f.id === fundId) || funds[0]!;
      const newReq = submitRequisition({
        branchId: '00000000-0000-0000-0000-000000000001',
        departmentId: department.toLowerCase().replace(/\s+/g, '-'),
        departmentName: department,
        fundId: fund.id,
        fundName: fund.name,
        purpose: purpose.trim(),
        currency: 'GHS',
        estimatedAmountPesewas: pesewas,
        quotesNotes: quotes.trim() || undefined,
      });

      showToast(`Requisition ${newReq.reqNumber} submitted successfully.`, 'success');

      if (addAnother) {
        resetForm();
      } else {
        goBack('expenses');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to submit requisition.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-4xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Expenditure', onClick: () => navigate('#/expenses') },
          { label: 'Requisitions', onClick: () => navigate('#/expenses') },
          { label: 'New Requisition' },
        ]}
        onBack={() => goBack('expenses')}
      />

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        <div>
          <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
            New Requisition
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Submit a spending request for pastoral and treasurer approval before procurement.
          </p>
        </div>

        <div className="space-y-4 text-[14px]">
          {/* Department & Fund */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="Music & Choir">Music & Choir</option>
                <option value="Facilities & Operations">Facilities & Operations</option>
                <option value="Children & Teens">Children & Teens</option>
                <option value="Pastoral & Evangelism">Pastoral & Evangelism</option>
                <option value="Administration">Administration</option>
                <option value="Welfare & Hospitality">Welfare & Hospitality</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Fund Source *
              </label>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated Amount */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Estimated Amount (GHS) *
            </label>
            <input
              type="text"
              placeholder="e.g. 1,250.00"
              value={amountGhs}
              onChange={(e) => setAmountGhs(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 text-[15px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Purpose & Justification */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Purpose & Justification *
            </label>
            <textarea
              rows={4}
              placeholder="Detailed explanation of what needs to be purchased and why..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] leading-relaxed"
            />
          </div>

          {/* Quotes & Supplier Attachments */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Supplier Quotes & Reference Notes
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Quote #QT-2026-90 from SoundCity Ghana: 2x Shure SM58 microphones"
                value={quotes}
                onChange={(e) => setQuotes(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              Include vendor name, proforma invoice numbers, and warranty notes.
            </p>
          </div>
        </div>

        {/* Action Buttons: Save & Save and Add Another (Requirement 1) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--surface-border-subtle)]">
          <button
            type="button"
            onClick={() => goBack('expenses')}
            className="px-4 py-2 border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] rounded-[var(--radius)] text-[13px] font-medium transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius)] text-[13px] font-semibold transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Save and add another</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--accent)] text-white hover:opacity-90 rounded-[var(--radius)] text-[13px] font-semibold transition shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Requisition</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
