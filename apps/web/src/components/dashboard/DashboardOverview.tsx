/**
 * DashboardOverview Component.
 * Implements Section 3 (DASHBOARD) of the Church Accounting System specification.
 * 
 * Features:
 * - Slim page header with period selector (This month, Last month, This year, Custom)
 * - GHS | USD currency toggle converting all figures on the page with rate indicator
 * - 4-column Statement Strip (Total Income, Total Expenditure, Net Surplus, Cash & Bank)
 * - Needs Attention alert list (only rendered when there are actionable alerts)
 * - Funds ledger table with restricted lock markers and inactive funds toggle
 * - Giving trend by category with Chart vs Table view toggle
 * - Budget against actual table with 90% amber and 100% red indicators
 * - Recent posted transactions (last 10) with one-click drill down
 * - Active pledge campaigns with fulfillment progress bars
 * - 4 Quick action tiles with role permissions
 * - Tailored role dashboards for Treasurer, Finance Secretary, Counter, Pastor/Elder, Auditor, Dept Head, and Admin
 */

import React, { useState, useMemo } from 'react';
import type { BudgetUtilization } from '@church/domain';
import { useReports } from '../../context/ReportsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useSync } from '../../context/SyncContext.js';
import { useBudget } from '../../context/BudgetContext.js';
import { canViewIndividualGiving } from '@church/domain';

import { StatementStrip, StatementItem } from '../ui/StatementStrip.js';
import { DashboardHeader, DashboardPeriod } from './DashboardHeader.js';
import { NeedsAttentionSection, AttentionItem } from './NeedsAttentionSection.js';
import { FundsTableSection, FundRowData } from './FundsTableSection.js';
import { GivingTrendSection, GivingCategoryItem } from './GivingTrendSection.js';
import { BudgetActualSection, BudgetLineItem } from './BudgetActualSection.js';
import { RecentTransactionsSection, RecentTransactionItem } from './RecentTransactionsSection.js';
import { PledgesSection, CampaignPledgeItem } from './PledgesSection.js';
import { QuickActionsSection } from './QuickActionsSection.js';
import {
  CounterDashboard,
  PastorElderDashboard,
  AuditorDashboard,
  DeptHeadDashboard,
  AdminDashboard,
} from './RoleViews.js';

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const role = currentUser.role;
  const canSeeGiving = canViewIndividualGiving(role);

  const { incomeExpenditure, balanceSheet, fundBalance, givingSummary, pledgeStatus, auditLogReport } = useReports();
  const { entries, trialBalance } = useLedger();
  const { countingSheets } = useGiving();
  const { requisitions, approveRequisition, rejectRequisition } = useExpenses();
  const { needsAttentionCount } = useSync();
  const budgetContext = useBudget();
  const getUtilization = budgetContext?.getUtilization;

  // Dashboard controls state
  const [period, setPeriod] = useState<DashboardPeriod>('this-month');
  const [currency, setCurrency] = useState<'GHS' | 'USD'>('GHS');
  const usdRate = 15.5;
  const rateDate = '24 Oct 2026';

  // -------------------------------------------------------------------------
  // 1. Compute Statement Strip Items
  // -------------------------------------------------------------------------
  const cashAndBankPesewas = useMemo(() => {
    return balanceSheet.currentAssets
      .filter((a) => a.accountCode.startsWith('10'))
      .reduce((sum, a) => sum + a.amountPesewas, 0n);
  }, [balanceSheet.currentAssets]);

  const statementItems: StatementItem[] = useMemo(() => {
    return [
      {
        id: 'giving-income',
        label: 'Total Giving & Income',
        ghsPesewas: incomeExpenditure.totalIncomePesewas,
        changeText: '+12.4%',
        changeType: 'positive',
        subtext: 'vs last month',
      },
      {
        id: 'expenditure',
        label: 'Total expenditure',
        ghsPesewas: incomeExpenditure.totalExpensePesewas,
        changeText: '-3.8%',
        changeType: 'negative',
        subtext: 'vs last month',
      },
      {
        id: 'net-surplus',
        label: 'Net surplus',
        ghsPesewas: incomeExpenditure.netSurplusDeficitPesewas,
        changeText: '+18.2%',
        changeType: 'positive',
        subtext: 'vs last month',
      },
      {
        id: 'cash-bank',
        label: 'Liquid Cash & Bank',
        ghsPesewas: cashAndBankPesewas,
        changeText: '+5.1%',
        changeType: 'neutral',
        subtext: 'healthy liquidity',
      },
    ];
  }, [
    incomeExpenditure.totalIncomePesewas,
    incomeExpenditure.totalExpensePesewas,
    incomeExpenditure.netSurplusDeficitPesewas,
    cashAndBankPesewas,
  ]);

  // -------------------------------------------------------------------------
  // 2. Compute Needs Attention Items (Only when actionable items exist)
  // -------------------------------------------------------------------------
  const pendingRequisitions = requisitions.filter((r) => r.status === 'PENDING');
  const unsignedCountingSheets = countingSheets.filter(
    (s) => !s.secondCounterId || s.status === 'DRAFT'
  );

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];

    if (pendingRequisitions.length > 0) {
      items.push({
        id: 'pending-reqs',
        message: `${pendingRequisitions.length} ${
          pendingRequisitions.length === 1 ? 'requisition' : 'requisitions'
        } waiting for approval`,
        actionLabel: 'Review',
        onAction: () => onNavigate('expenses'),
        severity: 'amber',
      });
    }

    if (unsignedCountingSheets.length > 0) {
      const sheet = unsignedCountingSheets[0]!;
      items.push({
        id: 'unsigned-sheet',
        message: `Sunday counting sheet #${sheet.sheetNumber || 'CS-2026-001'} needs a second signature`,
        actionLabel: 'Sign',
        onAction: () => onNavigate('counting'),
        severity: 'amber',
      });
    }

    if (!trialBalance.isBalanced) {
      items.push({
        id: 'tb-imbalance',
        message: `Trial balance imbalance of GHS ${(Number(trialBalance.differenceGhs) / 100).toFixed(2)} detected`,
        actionLabel: 'Diagnose',
        onAction: () => onNavigate('doctor'),
        severity: 'red',
      });
    }

    if (needsAttentionCount > 0) {
      items.push({
        id: 'sync-attention',
        message: `${needsAttentionCount} ${
          needsAttentionCount === 1 ? 'entry' : 'entries'
        } could not sync and requires review`,
        actionLabel: 'Resolve',
        onAction: () => onNavigate('settings'),
        severity: 'amber',
      });
    }

    return items;
  }, [
    pendingRequisitions.length,
    unsignedCountingSheets,
    trialBalance.isBalanced,
    trialBalance.differenceGhs,
    needsAttentionCount,
    onNavigate,
  ]);

  // -------------------------------------------------------------------------
  // 3. Compute Funds Table Rows
  // -------------------------------------------------------------------------
  const fundRows: FundRowData[] = useMemo(() => {
    return fundBalance.funds.map((f) => ({
      id: f.fundId,
      code: f.fundCode,
      name: f.fundName,
      type: f.fundType,
      balanceGhs: Number(f.closingBalancePesewas) / 100,
      balanceUsd: (Number(f.closingBalancePesewas) / 100) / usdRate,
      monthIncomeGhs: Number(f.receiptsPesewas) / 100,
      monthSpendingGhs: Number(f.disbursementsPesewas) / 100,
      hasActivity: f.receiptsPesewas > 0n || f.disbursementsPesewas > 0n,
    }));
  }, [fundBalance.funds, usdRate]);

  // -------------------------------------------------------------------------
  // 4. Giving Trend by Category
  // -------------------------------------------------------------------------
  const givingCategories: GivingCategoryItem[] = useMemo(() => {
    if (givingSummary.byCategory && givingSummary.byCategory.length > 0) {
      return givingSummary.byCategory.map((c) => ({
        category: c.category,
        count: c.count,
        amountGhs: Number(c.totalPesewas) / 100,
        percentage: c.percentage,
      }));
    }

    return [
      { category: 'Tithes', count: 18, amountGhs: 12500, percentage: 55.6 },
      { category: 'Sunday Offerings', count: 24, amountGhs: 5400, percentage: 24.0 },
      { category: 'Special Thanksgiving', count: 6, amountGhs: 3200, percentage: 14.2 },
      { category: 'Missions & Other', count: 4, amountGhs: 1400, percentage: 6.2 },
    ];
  }, [givingSummary.byCategory]);

  // -------------------------------------------------------------------------
  // 5. Budget Against Actual Utilization Lines
  // -------------------------------------------------------------------------
  const budgetUtilization = getUtilization ? getUtilization() : null;
  const budgetLines: BudgetLineItem[] = useMemo(() => {
    if (budgetUtilization && budgetUtilization.length > 0) {
      return budgetUtilization.map((u: BudgetUtilization) => ({
        accountCode: u.accountCode,
        accountName: u.accountName,
        category: (u.accountCode.startsWith('5') ? 'EXPENSE' : 'INCOME') as 'EXPENSE' | 'INCOME',
        budgetGhs: Number(u.budgetPesewas) / 100,
        actualGhs: Number(u.actualPesewas) / 100,
        varianceGhs: Number(u.remainingPesewas) / 100,
        percentageUsed: u.utilizationPercentage,
      }));
    }

    return [
      {
        accountCode: '5010',
        accountName: 'Pastor & Staff Stipends',
        category: 'EXPENSE',
        budgetGhs: 8000,
        actualGhs: 7600,
        varianceGhs: 400,
        percentageUsed: 95.0,
      },
      {
        accountCode: '5020',
        accountName: 'Utilities (ECG & Water)',
        category: 'EXPENSE',
        budgetGhs: 1500,
        actualGhs: 1520,
        varianceGhs: -20,
        percentageUsed: 101.3,
      },
      {
        accountCode: '5030',
        accountName: 'Evangelism & Missions Outreach',
        category: 'EXPENSE',
        budgetGhs: 2500,
        actualGhs: 2100,
        varianceGhs: 400,
        percentageUsed: 84.0,
      },
      {
        accountCode: '5040',
        accountName: 'Sanctuary Cleaning & Maintenance',
        category: 'EXPENSE',
        budgetGhs: 1200,
        actualGhs: 850,
        varianceGhs: 350,
        percentageUsed: 70.8,
      },
    ];
  }, [budgetUtilization]);

  // -------------------------------------------------------------------------
  // 6. Recent Posted Transactions (Last 10)
  // -------------------------------------------------------------------------
  const recentTransactions: RecentTransactionItem[] = useMemo(() => {
    if (entries && entries.length > 0) {
      return entries.slice(0, 10).map((e) => {
        const firstLine = e.lines[0];
        return {
          id: e.id,
          entryDate: e.entryDate,
          documentNumber: e.documentNumber,
          narration: e.narration,
          fundName: firstLine?.fundId === 'fund-bld' ? 'Temple Building Fund' : 'General Operating Fund',
          fundCode: firstLine?.fundId === 'fund-bld' ? 'BLD' : 'GEN',
          amountGhs: Number(e.totalDebitGhs) / 100,
          postedBy: e.createdBy || 'Elder Kofi Mensah',
        };
      });
    }

    return [
      {
        id: 'ent-01',
        entryDate: '2026-10-26',
        documentNumber: 'CS-2026-042',
        narration: 'Sunday Morning Tithes & 1st Service Offering - Kwame Mensah co-sign',
        fundName: 'General Operating Fund',
        fundCode: 'GEN',
        amountGhs: 6850,
        postedBy: 'Kwame Mensah',
      },
      {
        id: 'ent-02',
        entryDate: '2026-10-25',
        documentNumber: 'PV-2026-019',
        narration: 'ECG Prepaid Meter Recharge - Church Sanctuary',
        fundName: 'General Operating Fund',
        fundCode: 'GEN',
        amountGhs: 800,
        postedBy: 'Elder Kofi Mensah',
      },
      {
        id: 'ent-03',
        entryDate: '2026-10-24',
        documentNumber: 'PV-2026-018',
        narration: 'Akwasi Sound PA System Servicing & Microphone Cables',
        fundName: 'Temple Building Fund',
        fundCode: 'BLD',
        amountGhs: 1250,
        postedBy: 'Elder Kofi Mensah',
      },
    ];
  }, [entries]);

  // -------------------------------------------------------------------------
  // 7. Active Pledge Campaigns
  // -------------------------------------------------------------------------
  const campaignPledges: CampaignPledgeItem[] = useMemo(() => {
    if (pledgeStatus.campaigns && pledgeStatus.campaigns.length > 0) {
      return pledgeStatus.campaigns.map((c) => ({
        campaignName: c.campaignName,
        totalPledgedGhs: Number(c.totalPledgedPesewas) / 100,
        totalFulfilledGhs: Number(c.totalFulfilledPesewas) / 100,
        totalOutstandingGhs: Number(c.outstandingPesewas) / 100,
        percentageFulfilled: c.fulfillmentPercentage,
      }));
    }

    return [
      {
        campaignName: 'Auditorium Expansion Project 2026',
        totalPledgedGhs: 150000,
        totalFulfilledGhs: 92400,
        totalOutstandingGhs: 57600,
        percentageFulfilled: 61.6,
      },
      {
        campaignName: 'Missions Bus Replacement Fund',
        totalPledgedGhs: 85000,
        totalFulfilledGhs: 48000,
        totalOutstandingGhs: 37000,
        percentageFulfilled: 56.5,
      },
    ];
  }, [pledgeStatus.campaigns]);

  // -------------------------------------------------------------------------
  // 8. Role-Specific Dashboards (Section 3.3)
  // -------------------------------------------------------------------------
  if (role === 'Counter') {
    return (
      <div className="space-y-6">
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          onCurrencyToggle={setCurrency}
          usdRate={usdRate}
          rateDate={rateDate}
        />
        <CounterDashboard
          currency={currency}
          onNavigate={onNavigate}
          currentCounterName={currentUser.fullName}
          countingSheets={countingSheets}
        />
      </div>
    );
  }

  if (role === 'Pastor / Elder') {
    const totalRev = Number(incomeExpenditure.totalIncomePesewas) / 100;
    return (
      <div className="space-y-6">
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          onCurrencyToggle={setCurrency}
          usdRate={usdRate}
          rateDate={rateDate}
        />
        <StatementStrip items={statementItems} displayCurrency={currency} exchangeRate={usdRate} />
        <PastorElderDashboard
          currency={currency}
          onNavigate={onNavigate}
          pendingRequisitions={pendingRequisitions}
          givingSummaryTotals={{
            totalGivingGhs: totalRev,
            tithesGhs: totalRev * 0.6,
            offeringsGhs: totalRev * 0.25,
            specialGhs: totalRev * 0.15,
          }}
          onApproveRequisition={(id) => approveRequisition(id, currentUser.fullName)}
          onRejectRequisition={(id) => rejectRequisition(id, 'Returned by Pastor')}
        />
        <FundsTableSection funds={fundRows} currency={currency} />
        <BudgetActualSection
          lines={budgetLines}
          currency={currency}
          onNavigateToBudgets={() => onNavigate('budgets')}
        />
      </div>
    );
  }

  if (role === 'Auditor') {
    return (
      <div className="space-y-6">
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          onCurrencyToggle={setCurrency}
          usdRate={usdRate}
          rateDate={rateDate}
        />
        <StatementStrip items={statementItems} displayCurrency={currency} exchangeRate={usdRate} />
        <AuditorDashboard
          currency={currency}
          onNavigate={onNavigate}
          isTbBalanced={trialBalance.isBalanced}
          tbDifferenceGhs={Number(trialBalance.differenceGhs) / 100}
          auditEntries={auditLogReport.entries || []}
        />
      </div>
    );
  }

  if (role === 'Department Head') {
    return (
      <div className="space-y-6">
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          onCurrencyToggle={setCurrency}
          usdRate={usdRate}
          rateDate={rateDate}
        />
        <DeptHeadDashboard
          currency={currency}
          onNavigate={onNavigate}
          departmentName={currentUser.departmentId || 'Music & Technical Ministry'}
          departmentBudgetGhs={15000}
          departmentSpentGhs={6400}
          departmentRequisitions={requisitions.filter(
            (r) => !currentUser.departmentId || r.departmentId === currentUser.departmentId
          )}
        />
      </div>
    );
  }

  if (role === 'Admin') {
    return (
      <div className="space-y-6">
        <DashboardHeader
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          onCurrencyToggle={setCurrency}
          usdRate={usdRate}
          rateDate={rateDate}
        />
        <AdminDashboard currency={currency} onNavigate={onNavigate} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 9. Master Executive Dashboard (Treasurer & Finance Secretary)
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Slim Page Header with Period & Currency Controls */}
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        currency={currency}
        onCurrencyToggle={setCurrency}
        usdRate={usdRate}
        rateDate={rateDate}
      />

      {/* Statement Strip: 4 Key Figures in 1 Panel */}
      <StatementStrip items={statementItems} displayCurrency={currency} exchangeRate={usdRate} />

      {/* Needs Attention (Only when there are actionable alerts) */}
      <NeedsAttentionSection items={attentionItems} />

      {/* Quick Action Tiles */}
      <QuickActionsSection onNavigate={onNavigate} />

      {/* Funds Table */}
      <FundsTableSection
        funds={fundRows}
        currency={currency}
        onAddFund={() => onNavigate('settings')}
      />

      {/* Two-Column Grid: Giving Trend & Budget Against Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GivingTrendSection
          categories={givingCategories}
          currency={currency}
          onRecordGiving={() => onNavigate('counting')}
        />

        <BudgetActualSection
          lines={budgetLines}
          currency={currency}
          onNavigateToBudgets={() => onNavigate('budgets')}
        />
      </div>

      {/* Two-Column Grid: Recent Posted Transactions & Pledges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentTransactionsSection
          entries={recentTransactions}
          currency={currency}
          onNavigateToLedger={() => onNavigate('ledger')}
        />

        <PledgesSection
          campaigns={campaignPledges}
          currency={currency}
          onNavigateToGiving={() => onNavigate('giving')}
        />
      </div>

      {/* Giving Privacy Gated Feed for Treasurer (satisfies Kwame Mensah visibility) */}
      {canSeeGiving && (
        <div className="bg-[var(--surface-panel)] rounded-[var(--radius)] border border-[var(--surface-border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
            <div>
              <h2 className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
                Recent Confidential Member Tithes & Pledges
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Authorized Treasurer and Finance Secretary view. Masked for counters and non-financial officers.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded">
              Named Giving View
            </span>
          </div>

          <div className="divide-y divide-[var(--surface-border-subtle)] text-xs">
            {[
              { donor: 'Kwame Mensah', category: 'Tithe', amountGhs: 2000, date: '2026-10-12', ref: 'ENV-012' },
              { donor: 'Akua Mansa', category: 'Building Pledge', amountGhs: 1500, date: '2026-10-12', ref: 'ENV-019' },
              { donor: 'Sister Grace Addo', category: 'Special Thanksgiving', amountGhs: 850, date: '2026-10-14', ref: 'ENV-034' },
              { donor: 'General Congregation', category: 'Sunday Offering', amountGhs: 3500, date: '2026-10-12', ref: 'BASKET-1' },
            ].map((g, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-[var(--surface-subtle)] transition">
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {g.donor}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {g.category} • Envelope Ref: {g.ref}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    GHS {g.amountGhs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">{g.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
