import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Printer,
} from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { DEFAULT_ASSET_CATEGORIES } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { StatusDot } from '../ui/StatusDot.js';
import { AddAssetModal } from './AddAssetModal.js';
import { BatchLabelsModal } from './BatchLabelsModal.js';
import { useRouter } from '../../context/RouterContext.js';

interface RegisterTabProps {
  onSelectAsset: (asset: FixedAssetRecord) => void;
}

export const RegisterTab: React.FC<RegisterTabProps> = ({ onSelectAsset }) => {
  const { navigate } = useRouter();
  const { assets, summary } = useFixedAssets();
  const { funds } = useLedger();
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [custodianFilter, setCustodianFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fundFilter, setFundFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchLabelsModalOpen, setIsBatchLabelsModalOpen] = useState(false);

  // Derive unique locations and custodians for filter dropdowns
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.location))).filter(Boolean);
  }, [assets]);

  const uniqueCustodians = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.custodian))).filter(Boolean);
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const match =
          asset.assetNumber.toLowerCase().includes(query) ||
          asset.description.toLowerCase().includes(query) ||
          asset.categoryName.toLowerCase().includes(query) ||
          (asset.serialOrModelNumber?.toLowerCase().includes(query) ?? false) ||
          asset.location.toLowerCase().includes(query) ||
          asset.custodian.toLowerCase().includes(query);
        if (!match) return false;
      }

      if (categoryFilter !== 'ALL' && asset.categoryCode !== categoryFilter) return false;
      if (locationFilter !== 'ALL' && asset.location !== locationFilter) return false;
      if (custodianFilter !== 'ALL' && asset.custodian !== custodianFilter) return false;
      if (statusFilter !== 'ALL' && asset.status !== statusFilter) return false;
      if (fundFilter !== 'ALL' && asset.fundId !== fundFilter) return false;
      if (sourceFilter !== 'ALL' && asset.acquisitionType !== sourceFilter) return false;

      return true;
    });
  }, [
    assets,
    search,
    categoryFilter,
    locationFilter,
    custodianFilter,
    statusFilter,
    fundFilter,
    sourceFilter,
  ]);

  // Summary figures
  const costFormatted = (Number(summary.totalCostPesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const accDepFormatted = (Number(summary.totalAccumulatedDepreciationPesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const nbvFormatted = (Number(summary.totalNetBookValuePesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const canAddAsset = role === 'Treasurer' || role === 'Finance Secretary';

  return (
    <div className="space-y-4">
      {/* Plain Accounting Summary Status Line per Section 3.9 & 6 */}
      <div className="py-2.5 px-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-4">
        <div className="font-medium">
          <span className="text-[var(--text-primary)] font-semibold">{summary.totalAssetsCount}</span> active assets · Cost{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{costFormatted}</span> · Accumulated depreciation{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{accDepFormatted}</span> · Net book value{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{nbvFormatted}</span>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Historical cost basis · Straight-line depreciation · Non-monetary items not revalued
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by tag, description, serial, location, custodian..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsBatchLabelsModalOpen(true)}
              className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print Labels
            </button>

            {canAddAsset && (
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(true);
                  try {
                    navigate('#/assets/new-asset');
                  } catch {}
                }}
                className="px-4 py-1.5 bg-[#1e4620] text-white rounded text-xs font-medium hover:bg-[#163518] transition shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Asset
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Categories</option>
            {DEFAULT_ASSET_CATEGORIES.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            value={custodianFilter}
            onChange={(e) => setCustodianFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Custodians</option>
            {uniqueCustodians.map((cust) => (
              <option key={cust} value={cust}>
                {cust}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_USE">In Use</option>
            <option value="UNDER_REPAIR">Under Repair</option>
            <option value="STORED">Stored</option>
            <option value="DISPOSED">Disposed</option>
            <option value="MISSING">Missing</option>
          </select>

          <select
            value={fundFilter}
            onChange={(e) => setFundFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Funds</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Sources</option>
            <option value="PURCHASED">Purchased</option>
            <option value="DONATED">Donated / In-Kind</option>
            <option value="TRANSFERRED_IN">Transferred In</option>
          </select>
        </div>
      </div>

      {/* Fixed Assets DataTable */}
      <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-secondary)]">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Asset No.</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Custodian</th>
                <th className="py-2.5 px-3">Acquired</th>
                <th className="py-2.5 px-3 text-right">Cost (GHS)</th>
                <th className="py-2.5 px-3 text-right">Acc. Dep</th>
                <th className="py-2.5 px-3 text-right">Net Book Value</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[var(--text-muted)]">
                    No fixed assets found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
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

                  const cost = (Number(asset.costInGhsPesewas) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  });
                  const accDep = (Number(asset.accumulatedDepreciationPesewas) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  });
                  const nbv = (Number(asset.netBookValuePesewas) / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  });

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => onSelectAsset(asset)}
                      className="hover:bg-[var(--surface-hover)] cursor-pointer transition select-none"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                        {asset.assetNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                        {asset.description}
                      </td>
                      <td className="py-2.5 px-3">{asset.categoryName}</td>
                      <td className="py-2.5 px-3">{asset.location}</td>
                      <td className="py-2.5 px-3">{asset.custodian}</td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)]">{asset.acquisitionDate}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{cost}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)]">{accDep}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {nbv}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusDot status={statusType} label={asset.status.replace('_', ' ')} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <BatchLabelsModal
        isOpen={isBatchLabelsModalOpen}
        onClose={() => setIsBatchLabelsModalOpen(false)}
        assets={filteredAssets}
      />
    </div>
  );
};
