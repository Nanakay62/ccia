import React, { useState } from 'react';
import { useTithes } from '../../context/TithesContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { parsePesewas } from '../../utils/formatters.js';
import { Save, RotateCcw } from 'lucide-react';

export const NewTitheBatchPage: React.FC = () => {
  const { createBatchFromCountingSheet } = useTithes();
  const { showToast } = useToast();
  const { goBack, navigate } = useRouter();

  const [serviceDate, setServiceDate] = useState('2026-10-25');
  const [serviceName, setServiceName] = useState('Sunday Morning Service - Tithe Batch');
  const [countingSheetId, setCountingSheetId] = useState('CS-0042');
  const [countedTotalGhs, setCountedTotalGhs] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setCountedTotalGhs('');
    setNotes('');
  };

  const handleSave = (addAnother = false) => {
    if (!serviceName.trim()) {
      showToast('Please provide a descriptive service name.', 'error');
      return;
    }
    const countedPesewas = parsePesewas(countedTotalGhs);
    if (countedPesewas <= 0n) {
      showToast('Counted total must be greater than zero.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newBatch = createBatchFromCountingSheet({
        countingSheetId: countingSheetId.trim() || 'CS-MANUAL',
        serviceDate,
        serviceName: serviceName.trim(),
        currency: 'GHS',
        countedTotal: countedPesewas,
      });

      showToast(`Tithe batch for ${newBatch.serviceDate} created successfully.`, 'success');

      if (addAnother) {
        resetForm();
      } else {
        navigate(`#/tithes/batches/${encodeURIComponent(newBatch.id)}`);
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to create tithe batch.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-4xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Tithes', onClick: () => navigate('#/tithes') },
          { label: 'Batches', onClick: () => navigate('#/tithes') },
          { label: 'New Tithe Batch' },
        ]}
        onBack={() => goBack('tithes')}
      />

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        <div>
          <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
            Create Sunday Service Tithe Batch
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Initializes an envelope allocation batch corresponding to a Sunday counting sheet.
          </p>
        </div>

        <div className="space-y-4 text-[14px]">
          {/* Service Date & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Service Date *
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Service Description *
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Sunday Morning 1st Service - Envelope Tithes"
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Counting Sheet & Counted Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Linked Counting Sheet Number
              </label>
              <input
                type="text"
                value={countingSheetId}
                onChange={(e) => setCountingSheetId(e.target.value)}
                placeholder="e.g. CS-0042"
                className="w-full px-3 py-2 text-[14px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                Ties envelope allocations to the physical counting sheet signed by counters.
              </span>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Total Counted Envelope Tithes (GHS) *
              </label>
              <input
                type="text"
                value={countedTotalGhs}
                onChange={(e) => setCountedTotalGhs(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-[15px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                The target allocation sum to be distributed across member envelopes.
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Batch Notes / Observations
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details regarding counting discrepancies, envelopes without names, or special gifts..."
              className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Action Buttons: Save & Save and Add Another */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--surface-border-subtle)]">
          <button
            type="button"
            onClick={() => goBack('tithes')}
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
              <span>Create Batch & Enter Tithes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
