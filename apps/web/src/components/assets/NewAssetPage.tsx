import React, { useState } from 'react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { parsePesewas } from '../../utils/formatters.js';
import { Save, RotateCcw } from 'lucide-react';
import type { FixedAssetCategoryCode, AcquisitionType } from '@church/domain';

export const NewAssetPage: React.FC = () => {
  const { categories, createAsset } = useFixedAssets();
  const { funds } = useLedger();
  const { showToast } = useToast();
  const { goBack, navigate } = useRouter();

  const [description, setDescription] = useState('');
  const [categoryCode, setCategoryCode] = useState<FixedAssetCategoryCode>('SOUND_AV');
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>('PURCHASED');
  const [acquisitionDate, setAcquisitionDate] = useState('2026-10-25');
  const [costGhs, setCostGhs] = useState('');
  const [location, setLocation] = useState('Main Sanctuary');
  const [custodian, setCustodian] = useState('Head of Sound');
  const [department, setDepartment] = useState('Sound & Media');
  const [fundId, setFundId] = useState('fund-gen');
  const [supplier, setSupplier] = useState('');
  const [serialOrModel, setSerialOrModel] = useState('');
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('60');
  const [residualValueGhs, setResidualValueGhs] = useState('0.00');
  const valuationBasis = '';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setDescription('');
    setCostGhs('');
    setSerialOrModel('');
    setSupplier('');
  };

  const handleSave = (addAnother = false) => {
    if (!description.trim()) {
      showToast('Please provide an asset description.', 'error');
      return;
    }
    const costPesewas = parsePesewas(costGhs);
    if (costPesewas <= 0n) {
      showToast('Asset cost must be greater than zero.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fund = funds.find((f) => f.id === fundId) || funds[0]!;
      const newAsset = createAsset({
        description: description.trim(),
        categoryCode,
        acquisitionType,
        acquisitionDate,
        currency: 'GHS',
        costInOriginalCurrency: costPesewas,
        location: location.trim(),
        custodian: custodian.trim(),
        department: department.trim(),
        fundId: fund.id,
        fundName: fund.name,
        supplier: supplier.trim() || undefined,
        serialOrModelNumber: serialOrModel.trim() || undefined,
        usefulLifeMonths: parseInt(usefulLifeMonths, 10) || 0,
        residualValuePesewas: parsePesewas(residualValueGhs),
        valuationBasis: acquisitionType === 'DONATED' ? valuationBasis.trim() : undefined,
      });

      showToast(`Asset ${newAsset.assetNumber} added to Register and capitalized.`, 'success');

      if (addAnother) {
        resetForm();
      } else {
        navigate(`#/assets/${encodeURIComponent(newAsset.id)}`);
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to add fixed asset.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-4xl mx-auto">
      <PageBreadcrumb
        items={[
          { label: 'Fixed Assets', onClick: () => navigate('#/assets') },
          { label: 'Register', onClick: () => navigate('#/assets') },
          { label: 'New Fixed Asset' },
        ]}
        onBack={() => goBack('assets')}
      />

      <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 space-y-6">
        <div>
          <h1 className="font-serif text-[20px] font-semibold text-[var(--text-primary)]">
            Add Capital Fixed Asset
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Record equipment, property, furniture, or vehicle. Generates an offline barcode tag and posts capitalization journal.
          </p>
        </div>

        <div className="space-y-4 text-[14px]">
          {/* Description & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Asset Description / Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Yamaha TF5 32-Channel Digital Mixing Console"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Asset Category *
              </label>
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value as any)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.defaultUsefulLifeMonths} mo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Acquisition Type *
              </label>
              <select
                value={acquisitionType}
                onChange={(e) => setAcquisitionType(e.target.value as any)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="PURCHASED">Purchased (Voucher / Invoice)</option>
                <option value="DONATED">Donated / Gift-in-kind</option>
                <option value="OPENING_BALANCE">Opening Balance / Conversion</option>
              </select>
            </div>
          </div>

          {/* Cost & Acquisition Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Historical Cost / Valuation (GHS) *
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={costGhs}
                onChange={(e) => setCostGhs(e.target.value)}
                className="w-full px-3 py-2 text-[15px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Acquisition Date *
              </label>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Location & Custodian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Physical Location *
              </label>
              <input
                type="text"
                placeholder="e.g. Main Auditorium Sound Booth"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Assigned Custodian *
              </label>
              <input
                type="text"
                placeholder="e.g. Yaw Kwarteng (Media Director)"
                value={custodian}
                onChange={(e) => setCustodian(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Department & Fund */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Department *
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Sound & Media"
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
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

          {/* Serial & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Serial / Model Number
              </label>
              <input
                type="text"
                placeholder="e.g. SN-YTF5-99214"
                value={serialOrModel}
                onChange={(e) => setSerialOrModel(e.target.value)}
                className="w-full px-3 py-2 text-[14px] font-sans tabular-nums rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Supplier / Vendor
              </label>
              <input
                type="text"
                placeholder="e.g. SoundCity Ghana Ltd"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 text-[14px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Depreciation Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Useful Life (Months)
              </label>
              <input
                type="number"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                className="w-full px-3 py-1.5 text-[14px] font-sans tabular-nums rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Residual Value (GHS)
              </label>
              <input
                type="text"
                value={residualValueGhs}
                onChange={(e) => setResidualValueGhs(e.target.value)}
                className="w-full px-3 py-1.5 text-[14px] font-sans tabular-nums rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons: Save & Save and Add Another */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--surface-border-subtle)]">
          <button
            type="button"
            onClick={() => goBack('assets')}
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
              <span>Save Asset Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
