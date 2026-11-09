import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { FixedAssetCategoryCode, AcquisitionType, Currency, FixedAssetCondition } from '@church/domain';
import { DEFAULT_ASSET_CATEGORIES } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillVoucherId?: string;
  prefillAmountPesewas?: bigint;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  prefillVoucherId,
  prefillAmountPesewas,
}) => {
  useModalEscape(isOpen, onClose);
  const { createAsset } = useFixedAssets();
  const { funds } = useLedger();

  const [description, setDescription] = useState('');
  const [categoryCode, setCategoryCode] = useState<FixedAssetCategoryCode>('SOUND_AV');
  const [serialOrModelNumber, setSerialOrModelNumber] = useState('');
  const [location, setLocation] = useState('Auditorium Main Stage');
  const [custodian, setCustodian] = useState('Media & Sound Team');
  const [department, setDepartment] = useState('Media');
  const [supplier, setSupplier] = useState('');
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>('PURCHASED');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<Currency>('GHS');
  const [amountInput, setAmountInput] = useState(
    prefillAmountPesewas ? (Number(prefillAmountPesewas) / 100).toFixed(2) : ''
  );
  const [exchangeRate, setExchangeRate] = useState('15.50');
  const [fundId, setFundId] = useState(funds[0]?.id || 'fund-gen');
  const invoiceOrReceiptNumber = '';
  const [valuationBasis, setValuationBasis] = useState('');
  const [condition, setCondition] = useState<FixedAssetCondition>('EXCELLENT');
  const warrantyExpiry = '';
  const insurancePolicy = '';
  const [residualValueInput, setResidualValueInput] = useState('0.00');

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Asset description is required.');
      return;
    }

    const costNum = parseFloat(amountInput);
    if (isNaN(costNum) || costNum <= 0) {
      setError('Please enter a valid positive asset cost.');
      return;
    }

    const selectedFund = funds.find((f) => f.id === fundId);
    const fundName = selectedFund?.name || 'General Fund';

    const costMinorUnits = BigInt(Math.round(costNum * 100));
    const residualNum = parseFloat(residualValueInput) || 0;
    const residualMinorUnits = BigInt(Math.round(residualNum * 100));

    try {
      createAsset({
        description: description.trim(),
        categoryCode,
        serialOrModelNumber: serialOrModelNumber.trim() || undefined,
        location: location.trim(),
        custodian: custodian.trim(),
        department: department.trim(),
        supplier: supplier.trim() || undefined,
        acquisitionType,
        acquisitionDate,
        currency,
        exchangeRate: currency === 'USD' ? exchangeRate : '1.0000',
        costInOriginalCurrency: costMinorUnits,
        fundId,
        fundName,
        invoiceOrReceiptNumber: invoiceOrReceiptNumber.trim() || undefined,
        voucherId: prefillVoucherId,
        valuationBasis: acquisitionType === 'DONATED' ? valuationBasis.trim() : undefined,
        condition,
        warrantyExpiry: warrantyExpiry || undefined,
        insurancePolicy: insurancePolicy || undefined,
        residualValuePesewas: residualMinorUnits,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register asset');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded shadow-xl w-full max-w-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-asset-title"
      >
        <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          <div>
            <h2 id="add-asset-title" className="text-base font-semibold text-[var(--text-primary)]">
              Register Fixed Asset
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Record a new capital item, donated asset, or asset from a payment voucher
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded">
              {error}
            </div>
          )}

          {prefillVoucherId && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center justify-between">
              <span>Linked to approved payment voucher: <strong>{prefillVoucherId}</strong></span>
              <span className="text-[11px] font-mono">Capital Voucher</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Asset Description *
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Yamaha Montage 8 Synthesizer Keyboard"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Category *
              </label>
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value as FixedAssetCategoryCode)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                {DEFAULT_ASSET_CATEGORIES.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name} ({cat.isDepreciable ? `${Math.round(cat.defaultUsefulLifeMonths / 12)} yrs` : 'No Dep.'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Serial / Model Number
              </label>
              <input
                type="text"
                value={serialOrModelNumber}
                onChange={(e) => setSerialOrModelNumber(e.target.value)}
                placeholder="e.g. YAM-MON-88190"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                How Acquired *
              </label>
              <select
                value={acquisitionType}
                onChange={(e) => setAcquisitionType(e.target.value as AcquisitionType)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                <option value="PURCHASED">Purchased (Capital Expenditure)</option>
                <option value="DONATED">Donated / In-Kind (Assessed Value)</option>
                <option value="TRANSFERRED_IN">Transferred In (From other branch)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Acquisition Date *
              </label>
              <input
                type="date"
                required
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            {acquisitionType === 'DONATED' && (
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Valuation Basis & Valuer Details *
                </label>
                <input
                  type="text"
                  required
                  value={valuationBasis}
                  onChange={(e) => setValuationBasis(e.target.value)}
                  placeholder="e.g. Professional valuation report by Apex Musical Valuations Ltd (Ref: APX-VAL-2023)"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Currency & Cost *
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-24 px-2 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                >
                  <option value="GHS">GHS</option>
                  <option value="USD">USD ($)</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00 (Cost)"
                  className="flex-1 px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-right font-mono bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            </div>

            {currency === 'USD' ? (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Exchange Rate (USD to GHS) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-right font-mono bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Residual Value (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={residualValueInput}
                  onChange={(e) => setResidualValueInput(e.target.value)}
                  placeholder="0.00 (Residual)"
                  className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-right font-mono bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Funding Fund *
              </label>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Physical Location *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Auditorium Main Stage, Sound Booth"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Custodian (Department or Person) *
              </label>
              <input
                type="text"
                required
                value={custodian}
                onChange={(e) => setCustodian(e.target.value)}
                placeholder="e.g. Media Team, Music Ministry"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Department *
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Media, Music, Administration"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Supplier / Vendor
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Yamaha Music Centre Accra"
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Physical Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as FixedAssetCondition)}
                className="w-full px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>
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
              className="px-5 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs"
            >
              Save Asset Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
