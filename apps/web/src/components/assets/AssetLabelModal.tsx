import React, { useMemo } from 'react';
import { X, Printer, QrCode } from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { generateQrCodeSvg } from '@church/domain';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface AssetLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetRecord;
}

export const AssetLabelModal: React.FC<AssetLabelModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  useModalEscape(isOpen, onClose);

  // Generate offline QR code containing the asset tag and deep identification link
  const qrSvg = useMemo(() => {
    const qrData = `church://assets/${asset.assetNumber}`;
    return generateQrCodeSvg(qrData, { size: 130, margin: 2 });
  }, [asset.assetNumber]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-label-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[var(--text-primary)]" />
            <h2 id="asset-label-title" className="text-base font-semibold text-[var(--text-primary)]">
              Asset Tag & QR Code
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

        <div className="p-6 flex flex-col items-center">
          {/* Physical Sticker / Tag Preview */}
          <div
            id="printable-asset-label"
            className="w-full bg-white border-2 border-neutral-800 rounded-lg p-5 shadow-sm text-neutral-900"
          >
            <div className="text-center border-b border-neutral-300 pb-2 mb-3">
              <div className="text-[11px] font-bold tracking-wider text-neutral-800 uppercase">
                Accra Central Assembly of God
              </div>
              <div className="text-[10px] text-neutral-500 font-medium">
                Fixed Asset Inventory Tag
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="shrink-0 p-1 bg-white border border-neutral-200 rounded"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              <div className="flex-1 space-y-1.5 min-w-0">
                <div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Asset Number
                  </div>
                  <div className="text-base font-black tracking-tight font-mono text-neutral-900">
                    {asset.assetNumber}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Description
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 leading-tight truncate">
                    {asset.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div>
                    <span className="text-neutral-500">Category: </span>
                    <span className="font-medium text-neutral-800">{asset.categoryName}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Location: </span>
                    <span className="font-medium text-neutral-800">{asset.location}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-200 text-center text-[9px] text-neutral-400">
              Property of Church · Scan with Camera to Inspect or Report
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)]">
            Formatted for thermal tag or standard sticker sheet
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
