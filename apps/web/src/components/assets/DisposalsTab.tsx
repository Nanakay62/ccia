import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { FixedAssetRecord } from '@church/domain';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';

interface DisposalsTabProps {
  onSelectAsset: (asset: FixedAssetRecord) => void;
}

export const DisposalsTab: React.FC<DisposalsTabProps> = ({ onSelectAsset }) => {
  const { assets } = useFixedAssets();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const disposedAssets = useMemo(() => {
    return assets.filter((a) => a.status === 'DISPOSED');
  }, [assets]);

  const filteredDisposals = useMemo(() => {
    return disposedAssets.filter((a) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const match =
          a.assetNumber.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.categoryName.toLowerCase().includes(query) ||
          (a.disposalDetails?.buyerOrRecipient?.toLowerCase().includes(query) ?? false);
        if (!match) return false;
      }
      if (typeFilter !== 'ALL') {
        if (a.disposalDetails?.disposalType !== typeFilter) return false;
      }
      return true;
    });
  }, [disposedAssets, search, typeFilter]);

  // Aggregate metrics
  const totalCost = disposedAssets.reduce((sum, a) => sum + a.costInGhsPesewas, 0n);
  const totalProceeds = disposedAssets.reduce(
    (sum, a) => sum + (a.disposalDetails?.proceedsPesewas || 0n),
    0n
  );
  const totalGainLoss = disposedAssets.reduce(
    (sum, a) => sum + (a.disposalDetails?.gainOrLossPesewas || 0n),
    0n
  );

  const costFormatted = (Number(totalCost) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const proceedsFormatted = (Number(totalProceeds) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const gainLossFormatted = (Math.abs(Number(totalGainLoss)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-4">
      {/* Plain Accounting Status Line per Section 6 */}
      <div className="py-2.5 px-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-4">
        <div className="font-medium">
          <span className="text-[var(--text-primary)] font-semibold">{disposedAssets.length}</span> disposed items · Cost written off{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{costFormatted}</span> · Proceeds{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">{proceedsFormatted}</span> · Net {totalGainLoss >= 0n ? 'gain' : 'loss'}{' '}
          <span className={`font-mono font-semibold ${totalGainLoss >= 0n ? 'text-emerald-800' : 'text-amber-800'}`}>
            {gainLossFormatted}
          </span>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">
          All derecognized items preserved for audit trail (never deleted)
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search disposed assets by tag, description, buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
          >
            <option value="ALL">All Disposal Types</option>
            <option value="SOLD">Sold</option>
            <option value="SCRAPPED">Scrapped</option>
            <option value="DONATED_AWAY">Donated Away</option>
            <option value="LOST_OR_STOLEN">Lost or Stolen</option>
            <option value="WRITTEN_OFF">Written Off</option>
          </select>
        </div>
      </div>

      {/* Disposals Table */}
      <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--text-secondary)]">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Asset No.</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Disposal Date</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Cost (GHS)</th>
                <th className="py-2.5 px-3 text-right">Acc. Dep</th>
                <th className="py-2.5 px-3 text-right">NBV</th>
                <th className="py-2.5 px-3 text-right">Proceeds</th>
                <th className="py-2.5 px-3 text-right">Gain / (Loss)</th>
                <th className="py-2.5 px-3">Approved By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {filteredDisposals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[var(--text-muted)]">
                    No disposed assets matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredDisposals.map((asset) => {
                  const disp = asset.disposalDetails;
                  const cost = (Number(asset.costInGhsPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
                  const accDep = (Number(asset.accumulatedDepreciationPesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
                  const nbv = (Number(asset.netBookValuePesewas) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
                  const proceeds = ((Number(disp?.proceedsPesewas || 0n)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
                  const gainLoss = Number(disp?.gainOrLossPesewas || 0n) / 100;
                  const gainLossStr = Math.abs(gainLoss).toLocaleString('en-US', { minimumFractionDigits: 2 });

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => onSelectAsset(asset)}
                      className="hover:bg-[var(--surface-hover)] cursor-pointer transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                        {asset.assetNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)] max-w-[200px]">
                        <div className="truncate">{asset.description}</div>
                        {disp?.buyerOrRecipient && (
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            Buyer: {disp.buyerOrRecipient}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{asset.categoryName}</td>
                      <td className="py-2.5 px-3">{disp?.disposalDate || asset.acquisitionDate}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-medium text-[11px]">
                          {disp?.disposalType || 'DISPOSED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{cost}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)]">{accDep}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{nbv}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{proceeds}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-semibold ${gainLoss >= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {gainLoss < 0 ? `(${gainLossStr})` : gainLossStr}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {disp?.approvedByPastorOrElder || 'Senior Pastor'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
