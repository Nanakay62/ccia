import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { useDemo } from './context/DemoContext.js';
import { Header } from './components/Header.js';
import { Navigation, type NavTab } from './components/Navigation.js';
import { RoleSwitcherModal } from './components/RoleSwitcherModal.js';
import { LockScreen } from './components/LockScreen.js';
import { TodayPanel } from './components/ui/TodayPanel.js';
import { useLedger } from './context/LedgerContext.js';
import { useSync } from './context/SyncContext.js';
import { useTithes } from './context/TithesContext.js';
import { formatDate } from './utils/formatters.js';
import { X } from 'lucide-react';
import { useModalEscape } from './utils/useModalEscape.js';
import { defaultChurchSettings } from './config/churchSettings.js';
import { RouterProvider, useRouter } from './context/RouterContext.js';

// View Imports
import { DashboardOverview } from './components/dashboard/DashboardOverview.js';
import { LedgerView } from './components/ledger/LedgerView.js';
import { TrialBalanceView } from './components/ledger/TrialBalanceView.js';
import { DoctorView } from './components/doctor/DoctorView.js';
import { CountingSheetView } from './components/giving/CountingSheetView.js';
import { GivingDirectoryView } from './components/giving/GivingDirectoryView.js';
import { ExpensesView } from './components/expenses/ExpensesView.js';
import { ReportsView } from './components/reports/ReportsView.js';
import { BudgetManagerView } from './components/budgets/BudgetManagerView.js';
import { PayrollView } from './components/payroll/PayrollView.js';
import { CashbookView } from './components/cashbook/CashbookView.js';
import { TithesView } from './components/tithes/TithesView.js';
import { FixedAssetsView } from './components/assets/FixedAssetsView.js';
import { SettingsView } from './components/SectionViews.js';
import { StyleGuideView } from './views/StyleGuideView.js';
import { DemoModals } from './components/demo/DemoModals.js';
import { UserManualModal } from './components/manual/UserManualModal.js';

// Full Page Record & Form Imports (Requirements 1, 2, 3)
import { RequisitionDetailPage } from './components/expenses/RequisitionDetailPage.js';
import { NewRequisitionPage } from './components/expenses/NewRequisitionPage.js';
import { VoucherDetailPage } from './components/expenses/VoucherDetailPage.js';
import { NewReceiptPage } from './components/cashbook/NewReceiptPage.js';
import { NewPaymentPage } from './components/cashbook/NewPaymentPage.js';
import { BankReconciliationDetailPage } from './components/cashbook/BankReconciliationDetailPage.js';
import { TitheBatchDetailPage } from './components/tithes/TitheBatchDetailPage.js';
import { NewTitheBatchPage } from './components/tithes/NewTitheBatchPage.js';
import { TitheRecordDetailPage } from './components/tithes/TitheRecordDetailPage.js';
import { AssetDetailPage } from './components/assets/AssetDetailPage.js';
import { NewAssetPage } from './components/assets/NewAssetPage.js';
import { MemberDetailPage } from './components/giving/MemberDetailPage.js';
import { JournalEntryDetailPage } from './components/ledger/JournalEntryDetailPage.js';
import { BudgetLineDetailPage } from './components/budgets/BudgetLineDetailPage.js';
import { OpeningBalancesPage } from './components/cutover/OpeningBalancesPage.js';
import { DataImportPage } from './components/cutover/DataImportPage.js';
import { GoLiveReadinessPage } from './components/cutover/GoLiveReadinessPage.js';
import { ParallelRunPage } from './components/cutover/ParallelRunPage.js';
import { ReAuthGateModal } from './components/security/ReAuthGateModal.js';
import { YearEndClosePage } from './components/yearend/YearEndClosePage.js';
import { AnnualGivingStatementsPage } from './components/yearend/AnnualGivingStatementsPage.js';
import { MemberDataRequestPage } from './components/security/MemberDataRequestPage.js';
import { ItSecurityChecklistPage } from './components/security/ItSecurityChecklistPage.js';
import { SodExceptionsReportPage } from './components/security/SodExceptionsReportPage.js';
import { SecurityEventsPage } from './components/security/SecurityEventsPage.js';
import { VersionGateBanner } from './components/sync/VersionGateBanner.js';

const AppContent: React.FC = () => {
  const { isLocked, currentUser, reAuthGateState, confirmReAuth, cancelReAuth } = useAuth();
  const { isDemoMode, requestExitDemoMode, isWizardDismissed, restoreWizard } = useDemo();
  const { trialBalance, goLiveReadiness } = useLedger();
  const { triggerSync, isSyncing, isOnline, pendingUploadCount, needsAttentionCount } = useSync();
  const { remittances, remittanceRules } = useTithes();
  const { route, activeTab, navigateToTab, navigate } = useRouter();

  // Active or overdue remittance alert for Today panel (Section 2.4)
  const pendingRemittance = remittances.find(
    (r) => r.balanceOutstanding > 0n && (r.status === 'OVERDUE' || r.status === 'ACCRUED' || r.period === '2026-10')
  );

  const remittanceAlert = pendingRemittance
    ? {
        period: pendingRemittance.period,
        amountGhs: Number(pendingRemittance.balanceOutstanding) / 100,
        dueDate: formatDate(pendingRemittance.dueDate),
        isOverdue: pendingRemittance.status === 'OVERDUE' || pendingRemittance.dueDate < '2026-11-02',
        payee: pendingRemittance.ruleName || remittanceRules[0]?.payeeName || 'District Office',
      }
    : null;

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isTodaySlideOverOpen, setIsTodaySlideOverOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Today Panel collapse state per user (Requirement 4)
  const todayStorageKey = `church_today_collapsed_${currentUser.id}`;
  const [isTodayCollapsed, setIsTodayCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(todayStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  const toggleTodayCollapse = () => {
    setIsTodayCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(todayStorageKey, String(next));
      } catch {}
      return next;
    });
  };

  useModalEscape(isTodaySlideOverOpen, () => setIsTodaySlideOverOpen(false));

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('church_theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('church_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('church_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    document.title = isDemoMode
      ? `[DEMO] ${defaultChurchSettings.churchName}`
      : defaultChurchSettings.churchName;
  }, [isDemoMode]);

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-ground)] text-[var(--text-primary)] transition-colors">
      {/* Offline Device Version Gate Banner (Spec Section D) */}
      <VersionGateBanner />

      {/* Demo Warning Strip across top of every screen */}
      {isDemoMode && (
        <div className="bg-[#f59e0b] text-[#1c1917] px-4 py-1.5 text-[13px] flex items-center justify-between font-medium shadow-sm z-50 select-none">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/15 text-black">
              Demo Mode Active:
            </span>
            <span>
              300 Ghanaian church members loaded. DEMO MODE: Changes will not be saved to live accounts.
            </span>
            {isWizardDismissed && (
              <button
                onClick={restoreWizard}
                className="underline text-xs ml-2 hover:text-black font-semibold text-black/80"
              >
                Show walkthrough card
              </button>
            )}
          </div>
          <button
            onClick={requestExitDemoMode}
            className="px-2.5 py-0.5 rounded text-xs font-semibold bg-black/15 hover:bg-black/25 text-black transition border border-black/20 shrink-0"
            aria-label="Exit Demo Mode"
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      {/* Setup Mode Banner before Go-Live (Spec Section B5) */}
      {!goLiveReadiness.isLive && !isDemoMode && (
        <div className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] px-4 py-1.5 text-[13px] flex items-center justify-between font-medium z-40">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Setup mode: not yet live
            </span>
            <span className="text-[var(--text-secondary)] font-sans tabular-nums">
              {goLiveReadiness.passedCount} of {goLiveReadiness.totalCount} go-live readiness checks completed.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('#/imports')}
              className="text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              Data import tool
            </button>
            <button
              onClick={() => navigate('#/go-live')}
              className="px-2.5 py-0.5 rounded text-[12px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition"
            >
              Go-live checklist
            </button>
          </div>
        </div>
      )}

      {/* Top Bar with Single Sync Indicator, Logo, and User Menu */}
      <Header
        onOpenRoleSwitcher={() => setIsRoleModalOpen(true)}
        onOpenUserManual={() => setIsManualModalOpen(true)}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        onToggleTodaySlideOver={() => setIsTodaySlideOverOpen((prev) => !prev)}
        isTodaySlideOverOpen={isTodaySlideOverOpen}
      />

      {/* =========================================================================
          Full-Height App Shell: Sticky Sidebar + Fluid Workspace + Collapsible Today Panel
         ========================================================================= */}
      <div className="flex-1 flex w-full min-h-[calc(100vh-57px)]">
        {/* Left Sticky Sidebar (Requirement 4) */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          onOpenUserManual={() => setIsManualModalOpen(true)}
        />

        {/* Fluid Main Content Area */}
        <div className="flex-1 min-w-0 flex justify-center overflow-x-hidden">
          <div className="w-full max-w-[1800px] flex p-4 sm:p-6 pb-24 md:pb-8 gap-6">
            {/* Primary Ledger Workspace */}
            <main className="flex-1 min-w-0 overflow-x-hidden">
              {/* 1. Full Page Records & Forms (Requirements 1, 2, 3) */}
              {route.type === 'requisition' && <RequisitionDetailPage id={route.id} />}
              {route.type === 'new-requisition' && <NewRequisitionPage />}
              {route.type === 'voucher' && <VoucherDetailPage id={route.id} />}
              {route.type === 'new-receipt' && <NewReceiptPage />}
              {route.type === 'new-payment' && <NewPaymentPage />}
              {route.type === 'reconciliation' && <BankReconciliationDetailPage id={route.id} />}
              {route.type === 'tithe-batch' && <TitheBatchDetailPage id={route.id} />}
              {route.type === 'new-tithe-batch' && <NewTitheBatchPage />}
              {route.type === 'tithe-record' && <TitheRecordDetailPage id={route.id} />}
              {route.type === 'asset' && <AssetDetailPage id={route.id} />}
              {route.type === 'new-asset' && <NewAssetPage />}
              {route.type === 'member' && <MemberDetailPage id={route.id} />}
              {route.type === 'journal-entry' && <JournalEntryDetailPage id={route.id} />}
              {route.type === 'budget-line' && <BudgetLineDetailPage id={route.id} />}
              {route.type === 'opening-balances' && <OpeningBalancesPage />}
              {route.type === 'imports' && <DataImportPage initialBatchId={route.id} />}
              {route.type === 'go-live' && <GoLiveReadinessPage />}
              {route.type === 'parallel-run' && <ParallelRunPage />}
              {route.type === 'year-end' && <YearEndClosePage />}
              {route.type === 'annual-statements' && <AnnualGivingStatementsPage />}
              {route.type === 'member-data-requests' && <MemberDataRequestPage />}
              {route.type === 'security-checklist' && <ItSecurityChecklistPage />}
              {route.type === 'sod-exceptions' && <SodExceptionsReportPage />}
              {route.type === 'security-events' && <SecurityEventsPage />}

              {/* 2. Top-Level Tab Views */}
              {route.type === 'tab' && (
                <>
                  {activeTab === 'dashboard' && (
                    <DashboardOverview onNavigate={(t) => navigateToTab(t as NavTab)} />
                  )}
                  {activeTab === 'ledger' && <LedgerView />}
                  {activeTab === 'trial-balance' && (
                    <TrialBalanceView onNavigateToDoctor={() => navigateToTab('doctor')} />
                  )}
                  {activeTab === 'doctor' && (
                    <DoctorView onNavigateToJournal={() => navigateToTab('ledger')} />
                  )}
                  {activeTab === 'counting' && <CountingSheetView />}
                  {activeTab === 'tithes' && <TithesView />}
                  {activeTab === 'expenses' && <ExpensesView />}
                  {activeTab === 'cashbook' && <CashbookView />}
                  {activeTab === 'giving' && <GivingDirectoryView />}
                  {activeTab === 'budgets' && <BudgetManagerView />}
                  {activeTab === 'payroll' && <PayrollView />}
                  {activeTab === 'reports' && <ReportsView />}
                  {activeTab === 'assets' && <FixedAssetsView />}
                  {activeTab === 'settings' && <SettingsView />}
                  {activeTab === 'style-guide' && <StyleGuideView />}
                </>
              )}
            </main>

            {/* Right-Hand "Today" Panel with Collapse Option (Requirement 4) */}
            <div
              className={`hidden min-[1500px]:block transition-all duration-200 ${
                isTodayCollapsed ? 'w-[48px]' : 'w-[320px]'
              } shrink-0`}
            >
              <div className="sticky top-[73px]">
                <TodayPanel
                  monthName="October 2026"
                  isMonthOpen={true}
                  closeDeadline="5 Nov 2026"
                  isTreasurer={currentUser.role === 'Treasurer'}
                  onStartCloseChecklist={() => navigateToTab('settings')}
                  usdRate={15.5}
                  rateDate="24 Oct 2026"
                  rateEnteredBy="Kofi Mensah"
                  isRateStale={false}
                  onUpdateRate={() => navigateToTab('settings')}
                  isTbBalanced={trialBalance.isBalanced}
                  tbDifferenceGhs={Number(trialBalance.differenceGhs) / 100}
                  tbLastCheckedMinutesAgo={2}
                  onCheckDoctor={() => navigateToTab('doctor')}
                  syncStatusText={
                    needsAttentionCount > 0
                      ? `${needsAttentionCount} ${
                          needsAttentionCount === 1 ? 'item requires' : 'items require'
                        } review`
                      : !isOnline
                      ? `Working offline, ${pendingUploadCount} waiting to sync`
                      : 'All saved and synced'
                  }
                  syncState={
                    needsAttentionCount > 0
                      ? 'attention'
                      : !isOnline || pendingUploadCount > 0
                      ? 'waiting'
                      : 'synced'
                  }
                  onSyncNow={() => triggerSync()}
                  isSyncing={isSyncing}
                  remittanceAlert={remittanceAlert}
                  onNavigateToRemittance={() => navigateToTab('tithes')}
                  isCollapsed={isTodayCollapsed}
                  onToggleCollapse={toggleTodayCollapse}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-Over Today Panel for Viewports < 1,500px */}
      {isTodaySlideOverOpen && (
        <div className="min-[1500px]:hidden fixed inset-0 z-50 overflow-hidden animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsTodaySlideOverOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[var(--surface-panel)] border-l border-[var(--surface-border)] shadow-2xl p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
                <span className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                  Today Overview
                </span>
                <button
                  onClick={() => setIsTodaySlideOverOpen(false)}
                  className="p-1.5 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                  aria-label="Close Today Panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <TodayPanel
                monthName="October 2026"
                isMonthOpen={true}
                closeDeadline="5 Nov 2026"
                isTreasurer={currentUser.role === 'Treasurer'}
                onStartCloseChecklist={() => {
                  navigateToTab('settings');
                  setIsTodaySlideOverOpen(false);
                }}
                usdRate={15.5}
                rateDate="24 Oct 2026"
                rateEnteredBy="Kofi Mensah"
                isRateStale={false}
                onUpdateRate={() => {
                  navigateToTab('settings');
                  setIsTodaySlideOverOpen(false);
                }}
                isTbBalanced={trialBalance.isBalanced}
                tbDifferenceGhs={Number(trialBalance.differenceGhs) / 100}
                tbLastCheckedMinutesAgo={2}
                onCheckDoctor={() => {
                  navigateToTab('doctor');
                  setIsTodaySlideOverOpen(false);
                }}
                syncStatusText={
                  needsAttentionCount > 0
                    ? `${needsAttentionCount} items require review`
                    : !isOnline
                    ? `Working offline, ${pendingUploadCount} waiting to sync`
                    : 'All saved and synced'
                }
                syncState={
                  needsAttentionCount > 0
                    ? 'attention'
                    : !isOnline || pendingUploadCount > 0
                    ? 'waiting'
                    : 'synced'
                }
                onSyncNow={() => triggerSync()}
                isSyncing={isSyncing}
                remittanceAlert={remittanceAlert}
                onNavigateToRemittance={() => {
                  navigateToTab('tithes');
                  setIsTodaySlideOverOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />

      {/* Security Re-Authentication Gate Modal */}
      <ReAuthGateModal
        isOpen={reAuthGateState.isOpen}
        actionType={reAuthGateState.actionType}
        onConfirm={confirmReAuth}
        onCancel={cancelReAuth}
      />

      {/* Demo Exit and Reset Confirmation Dialogs */}
      <DemoModals />

      {/* Platform User Manual Modal */}
      <UserManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
};
