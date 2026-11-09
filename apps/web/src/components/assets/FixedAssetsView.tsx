import React, { useState } from 'react';
import type { FixedAssetRecord } from '@church/domain';
import { PageHeader } from '../ui/PageHeader.js';
import { UnderlineTabs, type TabItem } from '../ui/UnderlineTabs.js';
import { RegisterTab } from './RegisterTab.js';
import { DisposalsTab } from './DisposalsTab.js';
import { DepreciationTab } from './DepreciationTab.js';
import { VerificationTab } from './VerificationTab.js';
import { ReportsTab } from './ReportsTab.js';
import { AssetDetailPanel } from './AssetDetailPanel.js';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { useRouter } from '../../context/RouterContext.js';

export type FixedAssetsTabId =
  | 'register'
  | 'depreciation'
  | 'disposals'
  | 'verification'
  | 'reports';

interface FixedAssetsViewProps {
  initialTab?: FixedAssetsTabId;
}

export const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({ initialTab = 'register' }) => {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<FixedAssetsTabId>(initialTab);
  const [selectedAsset, setSelectedAsset] = useState<FixedAssetRecord | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  const { assets, summary } = useFixedAssets();
  const disposedCount = assets.filter((a) => a.status === 'DISPOSED').length;

  const tabs: TabItem<FixedAssetsTabId>[] = [
    { id: 'register', label: 'Register', count: summary.totalAssetsCount },
    { id: 'depreciation', label: 'Depreciation' },
    { id: 'disposals', label: 'Disposals', count: disposedCount || null },
    { id: 'verification', label: 'Verification' },
    { id: 'reports', label: 'Reports' },
  ];

  const handleSelectAsset = (asset: FixedAssetRecord) => {
    setSelectedAsset(asset);
    setIsDetailPanelOpen(true);
    try {
      navigate(`#/assets/${asset.id}`, {
        listKey: 'assets',
        listItemIds: assets.map((a) => a.id),
      });
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Fixed assets"
        subtitle="Tangible property, plant, equipment, depreciation runs, custody transfers, and physical asset tagging"
      />

      {/* Underline Tabs */}
      <UnderlineTabs<FixedAssetsTabId>
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Fixed assets navigation tabs"
      />

      {/* Tab Panels */}
      {activeTab === 'register' && (
        <RegisterTab onSelectAsset={handleSelectAsset} />
      )}

      {activeTab === 'disposals' && (
        <DisposalsTab onSelectAsset={handleSelectAsset} />
      )}

      {activeTab === 'depreciation' && (
        <DepreciationTab />
      )}

      {activeTab === 'verification' && (
        <VerificationTab />
      )}

      {activeTab === 'reports' && (
        <ReportsTab />
      )}

      {/* Asset Detail Dialog (centred modal, no drawers) */}
      <AssetDetailPanel
        isOpen={isDetailPanelOpen}
        onClose={() => setIsDetailPanelOpen(false)}
        asset={selectedAsset}
      />
    </div>
  );
};
