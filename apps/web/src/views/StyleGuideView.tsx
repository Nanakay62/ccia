import React, { useState } from 'react';
import {
  Button,
  StatusDot,
  MoneyCell,
  FundMarker,
  DataTable,
  EmptyState,
  PageHeader,
  StatementStrip,
  TodayPanel,
} from '../components/ui/index.js';
import { Moon, Sun, Plus, FileText, Download } from 'lucide-react';

export const StyleGuideView: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('church_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('church_theme', 'light');
    }
  };

  const sampleTableData = [
    {
      id: '1',
      date: '26 Oct 2026',
      docNo: 'CS-2026-0042',
      narration: 'Sunday Service 1st & 2nd Collection',
      fund: 'GEN',
      fundName: 'General Fund',
      isRestricted: false,
      amount: 845000n, // GHS 8,450.00
      user: 'Brother Kwame',
    },
    {
      id: '2',
      date: '25 Oct 2026',
      docNo: 'PV-2026-0089',
      narration: 'ECG Electricity & Water Utilities Voucher',
      fund: 'GEN',
      fundName: 'General Fund',
      isRestricted: false,
      amount: -120000n, // -GHS 1,200.00
      user: 'Sister Akua',
    },
    {
      id: '3',
      date: '24 Oct 2026',
      docNo: 'CS-2026-0041',
      narration: 'Building Fund Dedicated Pledges',
      fund: 'BLD',
      fundName: 'Building Fund',
      isRestricted: true,
      amount: 450000n, // GHS 4,500.00
      user: 'Kofi Mensah',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10 text-[var(--text-primary)]">
      {/* Page Header */}
      <PageHeader
        title="Design System & Style Guide"
        subtitle="Canonical component tokens, typography, and accessibility reference for Church Accounting System."
        breadcrumb={[
          { label: 'System & Audit' },
          { label: 'Style Guide' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            icon={isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          >
            {isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          </Button>
        }
      />

      {/* 1. Principles & Token Philosophy */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          1. Color Palette &amp; CSS Variables
        </h2>
        <p className="text-[15px] text-[var(--text-secondary)]">
          All components use CSS variables. The palette is calm, warm, and paper-toned, avoiding SaaS blue gradients or cool grey tech themes.
        </p>

        {/* Color Swatches Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 text-xs">
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--surface-ground)]">
            <div className="font-medium text-[var(--text-primary)]">Surface Ground</div>
            <div className="text-[11px] text-[var(--text-secondary)]">--surface-ground</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Paper tone off-white</div>
          </div>
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)]">
            <div className="font-medium text-[var(--text-primary)]">Surface Panel</div>
            <div className="text-[11px] text-[var(--text-secondary)]">--surface-panel</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Clean white panel</div>
          </div>
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)]">
            <div className="font-medium text-[var(--text-primary)]">Surface Subtle</div>
            <div className="text-[11px] text-[var(--text-secondary)]">--surface-subtle</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Table header / warm wash</div>
          </div>
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--accent)] text-[var(--accent-foreground)]">
            <div className="font-medium">Primary Accent</div>
            <div className="text-[11px] opacity-90">--accent</div>
            <div className="text-[11px] opacity-80 mt-1">Deep Forest Green</div>
          </div>
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--gold-subtle)] text-[var(--gold)]">
            <div className="font-medium">Gold / Brass</div>
            <div className="text-[11px] opacity-90">--gold</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Subtle rule marks only</div>
          </div>
          <div className="p-3 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)]">
            <div className="font-medium text-[var(--text-primary)]">Hairline Border</div>
            <div className="text-[11px] text-[var(--text-secondary)]">--surface-border</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">1px delicate rules</div>
          </div>
        </div>
      </section>

      {/* 2. Statement Strip (4 Key Metrics) */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          2. Statement Strip (Ledger Executive Metrics)
        </h2>
        <p className="text-[15px] text-[var(--text-secondary)]">
          One continuous panel with thin vertical hairline dividers. No icons, no gradient numbers. Proportional tabular numbers with currency prefixes.
        </p>
        <StatementStrip
          items={[
            {
              id: 'income',
              label: 'Total giving and income',
              ghsPesewas: 1610000n, // GHS 16,100.00
              changeText: '+8.4% vs last month',
              changeType: 'positive',
            },
            {
              id: 'expense',
              label: 'Total expenditure',
              ghsPesewas: 120000n, // GHS 1,200.00
              changeText: '−3.1% vs budget',
              changeType: 'positive',
            },
            {
              id: 'surplus',
              label: 'Net operating surplus',
              ghsPesewas: 1490000n, // GHS 14,900.00
              changeText: 'Operating with surplus',
              changeType: 'positive',
            },
            {
              id: 'cash',
              label: 'Cash and bank reserves',
              ghsPesewas: 1490000n, // GHS 14,900.00
              changeText: 'Bank, MoMo & cash float',
              changeType: 'neutral',
            },
          ]}
        />
      </section>

      {/* 3. Typography & Numerals */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          3. Typography &amp; Tabular Figures
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] p-5">
          <div>
            <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">
              Headings: Humanist / Ledger Serif
            </div>
            <h1 className="font-serif text-2xl font-bold mb-1">Church of Christ International</h1>
            <h2 className="font-serif text-xl font-medium text-[var(--text-primary)] mb-1">
              Trial Balance as at 31 October 2026
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mt-2">
              Body text uses clean, readable sans-serif at 16px minimum body size. All secondary copy maintains at least 4.5:1 contrast against surface ground.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">
              Money Figures: Tabular Lining Digits
            </div>
            <div className="space-y-2 border-l border-[var(--surface-border)] pl-4">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[var(--text-secondary)]">Sunday Divine Worship:</span>
                <MoneyCell amountPesewas={1610000n} size="base" />
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[var(--text-secondary)]">Utilities &amp; Maintenance:</span>
                <MoneyCell amountPesewas={-120000n} size="base" />
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[var(--text-secondary)]">USD Cash Foreign Donation:</span>
                <MoneyCell amountMajor={1038.71} currency="USD" size="base" />
              </div>
              <div className="flex items-center justify-between text-[16px] font-semibold pt-2 border-t border-[var(--surface-border-subtle)]">
                <span>Net Ledger Balance:</span>
                <MoneyCell amountPesewas={1490000n} size="lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Base Components: Buttons & Status Dots */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          4. Buttons, Status Dots &amp; Fund Markers
        </h2>
        <div className="space-y-4 bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] p-5">
          {/* Buttons */}
          <div>
            <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">
              Button Variants (Radius 6px, restrained styling)
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
                Primary Action
              </Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="outline" icon={<Download className="w-4 h-4" />}>
                Export PDF
              </Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Reverse Entry</Button>
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="lg">Large Target</Button>
            </div>
          </div>

          <hr className="ledger-rule-subtle" />

          {/* Status Dots */}
          <div>
            <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">
              Status Dots (Always paired with text or icon, never colour alone)
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <StatusDot status="synced" label="All saved and synced" />
              <StatusDot status="waiting" label="Working offline, 3 waiting" />
              <StatusDot status="attention" label="1 needs attention" />
              <StatusDot status="error" label="2 sync conflicts" />
              <StatusDot status="balanced" label="Ledger in balance" />
            </div>
          </div>

          <hr className="ledger-rule-subtle" />

          {/* Fund Markers */}
          <div>
            <div className="text-xs uppercase font-semibold text-[var(--text-secondary)] mb-2">
              Fund Markers (Fixed muted markers + text code + lock for restricted)
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <FundMarker fundCode="GEN" fundName="General Fund" isRestricted={false} showType />
              <FundMarker fundCode="BLD" fundName="Building Fund" isRestricted={true} showType />
              <FundMarker fundCode="MIS" fundName="Missions & Outreach" isRestricted={true} showType />
              <FundMarker fundCode="WEL" fundName="Welfare & Benevolence" isRestricted={true} showType />
              <FundMarker fundCode="YTH" fundName="Youth Ministry" isRestricted={false} showType />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Data Table Sample */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          5. Data Table (Slim rows, hairline dividers, no zebra striping)
        </h2>
        <DataTable
          columns={[
            { key: 'date', header: 'Date', width: '130px' },
            { key: 'docNo', header: 'Document #', width: '150px' },
            { key: 'narration', header: 'Description / Narration' },
            {
              key: 'fund',
              header: 'Fund',
              width: '180px',
              render: (row) => (
                <FundMarker
                  fundCode={row.fund}
                  fundName={row.fundName}
                  isRestricted={row.isRestricted}
                  showType
                />
              ),
            },
            {
              key: 'amount',
              header: 'Amount (GHS)',
              align: 'right',
              width: '160px',
              render: (row) => <MoneyCell amountPesewas={row.amount} align="right" />,
            },
            { key: 'user', header: 'Prepared By', width: '150px' },
          ]}
          data={sampleTableData}
          keyExtractor={(row) => row.id}
        />
      </section>

      {/* 6. Today Panel Sample */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          6. Today Panel (Right-Hand Desk Companion)
        </h2>
        <p className="text-[15px] text-[var(--text-secondary)]">
          Provides quick daily status without cluttering the main ledger view. Used at 1,500px+ width or via slide-over.
        </p>
        <div className="max-w-md">
          <TodayPanel
            monthName="October 2026"
            isMonthOpen={true}
            closeDeadline="5 Nov 2026"
            onStartCloseChecklist={() => alert('Start close checklist')}
            usdRate={15.5}
            rateDate="24 Oct 2026"
            rateEnteredBy="Kofi Mensah"
            isTbBalanced={true}
            tbLastCheckedMinutesAgo={1}
            onCheckDoctor={() => alert('Check doctor')}
            pendingApprovals={[
              {
                id: 'req-1',
                description: 'PA System Microphone Cables',
                amountGhs: 450,
                department: 'Media Ministry',
              },
            ]}
            syncStatusText="All saved and synced"
            syncState="synced"
            onSyncNow={() => alert('Syncing...')}
          />
        </div>
      </section>

      {/* 7. Empty State Sample */}
      <section className="space-y-4">
        <h2 className="font-serif text-[20px] font-semibold text-[var(--text-primary)] pb-1 border-b border-[var(--surface-border)]">
          7. Contextual Empty State
        </h2>
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          message="No giving recorded for this Sunday service yet. Begin counting with two team members to post the first entry."
          actionLabel="Start Sunday Counting Sheet"
          onAction={() => alert('Start counting sheet')}
        />
      </section>
    </div>
  );
};
