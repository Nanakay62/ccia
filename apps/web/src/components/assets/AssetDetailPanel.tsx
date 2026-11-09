import React, { useState } from 'react';
import {
  Printer,
  ArrowRightLeft,
  Wrench,
  Trash2,
  MapPin,
  User,
  Shield,
  DollarSign,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { generateQrCodeSvg } from '@church/domain';
import { SlideOverPanel } from '../ui/SlideOverPanel.js';
import { StatusDot } from '../ui/StatusDot.js';
import { UnderlineTabs } from '../ui/UnderlineTabs.js';
import { TransferAssetModal } from './TransferAssetModal.js';
import { LogRepairModal } from './LogRepairModal.js';
import { DisposeAssetModal } from './DisposeAssetModal.js';
import { AssetLabelModal } from './AssetLabelModal.js';
import { useAuth } from '../../context/AuthContext.js';

interface AssetDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetRecord | null;
}

type DetailTab = 'overview' | 'movement' | 'maintenance' | 'audit';

export const AssetDetailPanel: React.FC<AssetDetailPanelProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  if (!asset) return null;

  const isDisposed = asset.status === 'DISPOSED';

  // Permission flags per Section 0 roles table:
  const canTransfer = !isDisposed && (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Department Head');
  const canRepair = !isDisposed && (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Department Head');
  const canDispose = !isDisposed && (role === 'Treasurer' || role === 'Pastor / Elder');

  const statusType =
    asset.status === 'IN_USE'
      ? 'approved'
      : asset.status === 'UNDER_REPAIR'
      ? 'waiting'
      : asset.status === 'STORED'
      ? 'inactive'
      : asset.status === 'DISPOSED'
      ? 'paid'
      : 'error';

  const qrSvg = generateQrCodeSvg(`church://assets/${asset.assetNumber}`, {
    size: 70,
    margin: 1,
  });

  const costFormatted = (Number(asset.costInGhsPesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const accDepFormatted = (Number(asset.accumulatedDepreciationPesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const nbvFormatted = (Number(asset.netBookValuePesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <SlideOverPanel
        isOpen={isOpen}
        onClose={onClose}
        title={asset.assetNumber}
        subtitle={asset.description}
        width="max-w-[500px]"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsLabelModalOpen(true)}
              className="px-2.5 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> Label
            </button>
            {canTransfer && (
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="px-2.5 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
              </button>
            )}
            {canRepair && (
              <button
                type="button"
                onClick={() => setIsRepairModalOpen(true)}
                className="px-2.5 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-1"
              >
                <Wrench className="w-3.5 h-3.5" /> Log Repair
              </button>
            )}
            {canDispose && (
              <button
                type="button"
                onClick={() => setIsDisposeModalOpen(true)}
                className="px-2.5 py-1.5 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Dispose
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Status and QR Header Card */}
          <div className="p-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StatusDot status={statusType} label={asset.status.replace('_', ' ')} />
                <span className="text-xs px-2 py-0.5 bg-[var(--surface-border)]/50 rounded font-medium text-[var(--text-secondary)]">
                  {asset.condition}
                </span>
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {asset.description}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {asset.categoryName} · {asset.fundName}
              </div>
            </div>

            <div
              className="shrink-0 p-1 bg-white border border-[var(--surface-border)] rounded shadow-2xs cursor-pointer hover:border-[#1e4620]"
              onClick={() => setIsLabelModalOpen(true)}
              title="Click to view printable label"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>

          {/* Disposed Banner if applicable */}
          {isDisposed && asset.disposalDetails && (
            <div className="p-3 bg-neutral-100 border border-neutral-300 rounded text-xs text-neutral-800 space-y-1">
              <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-neutral-600" />
                Asset Disposed ({asset.disposalDetails.disposalType}) on {asset.disposalDetails.disposalDate}
              </div>
              <p className="text-[11px] text-neutral-600">
                Proceeds: GH₵ {(Number(asset.disposalDetails.proceedsPesewas) / 100).toFixed(2)} ·{' '}
                {asset.disposalDetails.gainOrLossPesewas > 0n
                  ? `Gain: GH₵ ${(Number(asset.disposalDetails.gainOrLossPesewas) / 100).toFixed(2)}`
                  : `Loss: GH₵ ${(Number(-asset.disposalDetails.gainOrLossPesewas) / 100).toFixed(2)}`}
              </p>
              <p className="text-[11px] text-neutral-600 italic">
                &ldquo;{asset.disposalDetails.reason}&rdquo; — Approved by {asset.disposalDetails.approvedByPastorOrElder}
              </p>
            </div>
          )}

          {/* Underline Tabs */}
          <UnderlineTabs<DetailTab>
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'movement', label: 'Transfers', count: asset.events.filter((e) => e.eventType === 'TRANSFER').length || null },
              { id: 'maintenance', label: 'Repairs', count: asset.events.filter((e) => e.eventType === 'MAINTENANCE_REPAIR' || e.eventType === 'IMPROVEMENT').length || null },
              { id: 'audit', label: 'Audit Trail', count: asset.events.length },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              {/* Financial Valuation Block */}
              <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded space-y-2">
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Book Value & Depreciation
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[var(--surface-border)]">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Cost (GHS)</div>
                    <div className="font-mono font-medium text-[var(--text-primary)]">
                      {costFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Accumulated Dep.</div>
                    <div className="font-mono font-medium text-[var(--text-secondary)]">
                      {accDepFormatted}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Net Book Value</div>
                    <div className="font-mono font-bold text-[var(--text-primary)]">
                      {nbvFormatted}
                    </div>
                  </div>
                </div>

                {/* Foreign Currency Detail (USD historical cost note) */}
                {asset.currency === 'USD' && (
                  <div className="pt-2 border-t border-[var(--surface-border)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                    <span>Original USD Cost:</span>
                    <span className="font-mono font-medium text-[var(--text-primary)]">
                      ${(Number(asset.costInOriginalCurrency) / 100).toFixed(2)} @ {asset.exchangeRate}
                    </span>
                  </div>
                )}

                <div className="pt-1 text-[10px] text-[var(--text-muted)] italic">
                  Straight-line method · Useful life: {asset.usefulLifeMonths} months ({asset.usefulLifeYears} yrs) · Non-monetary item carried at historical cost
                </div>
              </div>

              {/* Physical Location & Custodian */}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Location & Custody
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5" />
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Location</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.location}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5" />
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Custodian</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.custodian}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Department</div>
                    <div className="font-medium text-[var(--text-primary)]">{asset.department}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">Serial / Model</div>
                    <div className="font-mono font-medium text-[var(--text-primary)]">
                      {asset.serialOrModelNumber || 'None recorded'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Acquisition & Vendor Details */}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Acquisition Information
                </div>
                <div className="p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Acquired</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.acquisitionDate}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">How Acquired</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.acquisitionType}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Funding Fund</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.fundName}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Supplier</div>
                      <div className="font-medium text-[var(--text-primary)]">{asset.supplier || 'N/A'}</div>
                    </div>
                  </div>

                  {asset.valuationBasis && (
                    <div className="pt-2 border-t border-[var(--surface-border)]">
                      <div className="text-[10px] text-[var(--text-muted)]">Valuation Basis (In-Kind Donation)</div>
                      <div className="text-[11px] text-[var(--text-primary)] italic">{asset.valuationBasis}</div>
                    </div>
                  )}

                  {asset.voucherId && (
                    <div className="pt-2 border-t border-[var(--surface-border)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">Capital Payment Voucher:</span>
                      <span className="font-mono text-xs text-[#1e4620] font-semibold">{asset.voucherId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warranty & Insurance */}
              {(asset.warrantyExpiry || asset.insurancePolicy) && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Protection & Policies
                  </div>
                  <div className="p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded space-y-1.5">
                    {asset.warrantyExpiry && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)]">Warranty Expiry:</span>
                        <span className="font-medium text-[var(--text-primary)]">{asset.warrantyExpiry}</span>
                      </div>
                    )}
                    {asset.insurancePolicy && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)]">Insurance Policy:</span>
                        <span className="font-medium text-[var(--text-primary)]">{asset.insurancePolicy}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'movement' && (
            <div className="space-y-3 text-xs">
              {asset.events.filter((e) => e.eventType === 'TRANSFER').length === 0 ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-dashed border-[var(--surface-border)] rounded">
                  No relocation or transfer events recorded for this asset.
                </div>
              ) : (
                asset.events
                  .filter((e) => e.eventType === 'TRANSFER')
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--text-primary)]">{evt.date}</span>
                        <span className="text-[var(--text-muted)]">By: {evt.performedBy}</span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]">{evt.details}</p>
                      {evt.notes && <p className="text-[11px] text-[var(--text-muted)] italic">&ldquo;{evt.notes}&rdquo;</p>}
                    </div>
                  ))
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-3 text-xs">
              {asset.events.filter((e) => e.eventType === 'MAINTENANCE_REPAIR' || e.eventType === 'IMPROVEMENT').length === 0 ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-dashed border-[var(--surface-border)] rounded">
                  No routine maintenance or repairs logged for this asset.
                </div>
              ) : (
                asset.events
                  .filter((e) => e.eventType === 'MAINTENANCE_REPAIR' || e.eventType === 'IMPROVEMENT')
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--text-primary)]">{evt.date}</span>
                        <span className="font-mono text-[#1e4620] font-semibold">
                          GH₵ {(Number(evt.costPesewas || 0n) / 100).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)]">{evt.details}</p>
                      <div className="text-[10px] text-[var(--text-muted)]">Logged by {evt.performedBy}</div>
                    </div>
                  ))
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3 text-xs">
              {asset.events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                      {evt.date} · {evt.eventType}
                    </span>
                    <span className="text-[var(--text-muted)]">{evt.performedBy}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{evt.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SlideOverPanel>

      {/* Sub-Modals */}
      <TransferAssetModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        asset={asset}
      />
      <LogRepairModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        asset={asset}
      />
      <DisposeAssetModal
        isOpen={isDisposeModalOpen}
        onClose={() => {
          setIsDisposeModalOpen(false);
          onClose();
        }}
        asset={asset}
      />
      <AssetLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        asset={asset}
      />
    </>
  );
};
