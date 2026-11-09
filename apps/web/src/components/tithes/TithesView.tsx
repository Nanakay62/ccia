import React, { useState } from 'react';
import { PageHeader } from '../ui/PageHeader.js';
import { UnderlineTabs, type TabItem } from '../ui/UnderlineTabs.js';
import { TitheBatchesTab } from './TitheBatchesTab.js';
import { TitheRecordsTab } from './TitheRecordsTab.js';
import { TitheRemittanceTab } from './TitheRemittanceTab.js';
import { TitheReportsTab } from './TitheReportsTab.js';
import { ShieldCheck } from 'lucide-react';

export type TithesTabId = 'batches' | 'records' | 'remittance' | 'reports';

const TABS: TabItem<TithesTabId>[] = [
  { id: 'batches', label: 'Batches' },
  { id: 'records', label: 'Records' },
  { id: 'remittance', label: 'Remittance' },
  { id: 'reports', label: 'Reports' },
];

export interface TithesViewProps {
  initialTab?: TithesTabId;
}

export const TithesView: React.FC<TithesViewProps> = ({ initialTab = 'batches' }) => {
  const [activeTab, setActiveTab] = useState<TithesTabId>(initialTab);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Page Header */}
      <PageHeader
        title="Tithes"
        statusLine={
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span>
              Sub-ledger for Sunday service envelope batches, direct transfers, and denominational remittances.
            </span>
          </div>
        }
        helpContent={
          <div className="space-y-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
            <p>
              <strong>Sub-Ledger Integration:</strong> The counting sheet records Sunday envelope tithes and posts them directly to the Tithes income account (<code>acct-4010</code>). Tithe batches allocate that posted income to individual members without double-posting to the ledger.
            </p>
            <p>
              <strong>Privacy & Compliance:</strong> In accordance with the Ghana Data Protection Act and church bylaws, individual member tithes are visible only to permitted leadership roles (Treasurer, Finance Secretary, and Pastor). Every view, export, and statement generation is immutably logged.
            </p>
            <p>
              <strong>Append-Only Corrections:</strong> Posted records are permanent. Misallocations or data entry errors are corrected via reversing entries with a mandatory reason.
            </p>
          </div>
        }
      />

      {/* Top Underline Tabs (Rule A4) */}
      <UnderlineTabs<TithesTabId>
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab Panels */}
      <div>
        {activeTab === 'batches' && <TitheBatchesTab />}
        {activeTab === 'records' && <TitheRecordsTab />}
        {activeTab === 'remittance' && <TitheRemittanceTab />}
        {activeTab === 'reports' && <TitheReportsTab />}
      </div>
    </div>
  );
};
