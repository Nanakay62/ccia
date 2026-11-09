import React, { useState } from 'react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { StatusDot } from '../ui/StatusDot.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { TransferAssetModal } from './TransferAssetModal.js';
import { LogRepairModal } from './LogRepairModal.js';
import { DisposeAssetModal } from './DisposeAssetModal.js';
import { AssetLabelModal } from './AssetLabelModal.js';
import { formatDate } from '../../config/churchSettings.js';
import { generateQrCodeSvg } from '@church/domain';
import {
  Printer,
  ArrowRightLeft,
  Wrench,
  Trash2,
} from 'lucide-react';

export interface AssetDetailPageProps {
  id: string;
}

export const AssetDetailPage: React.FC<AssetDetailPageProps> = ({ id }) => {
  const { assets } = useFixedAssets();
  const { currentUser } = useAuth();
  const { navigate, goBack } = useRouter();
  const role = currentUser.role;

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  const asset = assets.find((a) => a.id === id || a.assetNumber === id);

  if (!asset) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Books', onClick: () => navigate('#/assets') },
            { label: 'Fixed Assets', onClick: () => navigate('#/assets') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('assets')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Fixed asset <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('assets')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Asset Register
          </button>
        </div>
      </div>
    );
  }

  const isDisposed = asset.status === 'DISPOSED';
  const canTransfer = !isDisposed && (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Department Head');
  const canRepair = !isDisposed && (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Department Head');
  const canDispose = !isDisposed && (role === 'Treasurer' || role === 'Pastor / Elder');

  const qrSvg = generateQrCodeSvg(`church://assets/${asset.assetNumber}`, {
    size: 80,
    margin: 1,
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Fixed Assets', onClick: () => navigate('#/assets') },
          { label: 'Register', onClick: () => navigate('#/assets') },
          { label: `${asset.assetNumber} · ${asset.description}` },
        ]}
        currentId={asset.id}
        listKey="assets"
        onBack={() => goBack('assets')}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsLabelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Label</span>
            </button>

            {canTransfer && (
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>Transfer</span>
              </button>
            )}

            {canRepair && (
              <button
                type="button"
                onClick={() => setIsRepairModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>Repair</span>
              </button>
            )}

            {canDispose && (
              <button
                type="button"
                onClick={() => setIsDisposeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[13px] font-medium border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--status-red)] hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dispose</span>
              </button>
            )}
          </div>
        }
      />

      {/* Main Asset Container */}
      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        {/* Header Block with QR Code */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--surface-border)]">
          <div className="flex items-start gap-4">
            <div
              className="p-1 bg-white rounded border border-[var(--surface-border)] shrink-0 shadow-2xs"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-[20px] text-[var(--text-primary)]">
                  {asset.assetNumber}
                </span>
                <StatusDot
                  status={
                    asset.status === 'IN_USE'
                      ? 'healthy'
                      : asset.status === 'UNDER_REPAIR'
                      ? 'attention'
                      : asset.status === 'STORED'
                      ? 'inactive'
                      : 'error'
                  }
                  label={asset.status.replace(/_/g, ' ')}
                />
              </div>
              <h1 className="text-[16px] font-medium text-[var(--text-secondary)] mt-1">
                {asset.description}
              </h1>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Category: <strong className="text-[var(--text-primary)]">{asset.categoryName}</strong> ({asset.categoryCode}) · Serial: {asset.serialOrModelNumber || 'N/A'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[12px] text-[var(--text-muted)] block">Net Book Value</span>
            <MoneyCell amountPesewas={asset.netBookValuePesewas} size="xl" align="right" />
          </div>
        </div>

        {/* Financial Numbers Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[14px]">
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Historical Cost (GHS)</span>
            <MoneyCell amountPesewas={asset.costInGhsPesewas} size="base" align="left" />
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Accumulated Depreciation</span>
            <MoneyCell amountPesewas={asset.accumulatedDepreciationPesewas} size="base" align="left" />
          </div>
          <div>
            <span className="text-[12px] text-[var(--text-muted)] block">Useful Life & Residual</span>
            <span className="font-medium text-[var(--text-primary)]">
              {asset.usefulLifeMonths ? `${asset.usefulLifeMonths} months` : 'Non-depreciable'} · Resid: {(Number(asset.residualValuePesewas || 0n) / 100).toFixed(2)} GHS
            </span>
          </div>
        </div>

        {/* Custody & Location Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Location</span>
            <span className="font-medium text-[var(--text-primary)]">{asset.location}</span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Custodian</span>
            <span className="font-medium text-[var(--text-primary)]">{asset.custodian}</span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Department</span>
            <span className="font-medium text-[var(--text-primary)]">{asset.department}</span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Acquisition Date</span>
            <span className="font-medium text-[var(--text-primary)]">{formatDate(asset.acquisitionDate)}</span>
          </div>
        </div>

        {/* Event History / Audit Trail */}
        <div className="pt-4 border-t border-[var(--surface-border-subtle)] space-y-3">
          <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
            Lifecycle History & Asset Events
          </span>

          <div className="space-y-2 border-l-2 border-[var(--surface-border)] pl-4">
            {asset.events && asset.events.length > 0 ? (
              asset.events.map((evt) => (
                <div key={evt.id} className="text-[13px] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {evt.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {formatDate(evt.date)} · by {evt.performedBy}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    {evt.details}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[var(--text-muted)] italic">
                Initial acquisition recorded on {formatDate(asset.acquisitionDate)}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {isTransferModalOpen && (
        <TransferAssetModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          asset={asset}
        />
      )}

      {isRepairModalOpen && (
        <LogRepairModal
          isOpen={isRepairModalOpen}
          onClose={() => setIsRepairModalOpen(false)}
          asset={asset}
        />
      )}

      {isDisposeModalOpen && (
        <DisposeAssetModal
          isOpen={isDisposeModalOpen}
          onClose={() => setIsDisposeModalOpen(false)}
          asset={asset}
        />
      )}

      {isLabelModalOpen && (
        <AssetLabelModal
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          asset={asset}
        />
      )}
    </div>
  );
};
