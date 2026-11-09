import React from 'react';
import { X, Printer } from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { generateQrCodeSvg } from '@church/domain';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface BatchLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: FixedAssetRecord[];
}

export const BatchLabelsModal: React.FC<BatchLabelsModalProps> = ({
  isOpen,
  onClose,
  assets,
}) => {
  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-labels-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
          <div>
            <h2 id="batch-labels-title" className="text-base font-semibold text-[var(--text-primary)]">
              Print Asset Inventory Tags ({assets.length} labels)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              High-resolution offline QR codes formatted for sticker label sheets (A4 or thermal)
            </p>
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

        <div className="flex-1 overflow-y-auto p-6 bg-neutral-100">
          <div className="grid grid-cols-2 gap-4">
            {assets.map((asset) => {
              const qrSvg = generateQrCodeSvg(`church://assets/${asset.assetNumber}`, {
                size: 90,
                margin: 2,
              });

              return (
                <div
                  key={asset.id}
                  className="bg-white border-2 border-neutral-800 rounded p-3 text-neutral-900 shadow-xs flex items-center gap-3"
                >
                  <div
                    className="shrink-0 p-1 bg-white border border-neutral-200 rounded"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                      Accra Central AG
                    </div>
                    <div className="text-sm font-black font-mono tracking-tight text-neutral-900">
                      {asset.assetNumber}
                    </div>
                    <div className="text-xs font-semibold text-neutral-800 truncate">
                      {asset.description}
                    </div>
                    <div className="text-[10px] text-neutral-600 truncate">
                      {asset.categoryName} · {asset.location}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between shrink-0">
          <div className="text-xs text-[var(--text-muted)]">
            Ready to print on standard 2-column Avery sticker labels
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print All {assets.length} Labels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
