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
import { X } from 'lucide-react';

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
import { SettingsView } from './components/SectionViews.js';
import { StyleGuideView } from './views/StyleGuideView.js';

export const App: React.FC = () => {
  const { isLocked, currentUser } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const { trialBalance } = useLedger();
  const { triggerSync, isSyncing, isOnline, pendingUploadCount, needsAttentionCount } = useSync();

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'style-guide') return 'style-guide';
    return 'dashboard';
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isTodaySlideOverOpen, setIsTodaySlideOverOpen] = useState(false);

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

  // Update browser tab title with [DEMO] watermark when demo mode is active (Section 5.2)
  useEffect(() => {
    document.title = isDemoMode
      ? '[DEMO] Church Accounting System — Accra'
      : 'Church Accounting System — Accra';
  }, [isDemoMode]);

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-ground)] text-[var(--text-primary)] transition-colors">
      {/* Demo Warning Strip across top of every screen (Section 5.2) */}
      {isDemoMode && (
        <div className="bg-[var(--status-amber)] text-white px-4 py-1.5 text-[13px] flex items-center justify-between font-medium shadow-sm z-50 select-none animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-black/25">
              Demo Mode Active:
            </span>
            <span>
              300 Ghanaian church members loaded. DEMO MODE: sample data only, nothing here is real. Live church records remain safely untouched.
            </span>
          </div>
          <button
            onClick={toggleDemoMode}
            className="px-2.5 py-0.5 rounded text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition border border-white/30"
            aria-label="Exit Demo Mode"
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      {/* Top Bar with Single Sync Indicator, Logo, and User Menu (Section 4) */}
      <Header
        onOpenRoleSwitcher={() => setIsRoleModalOpen(true)}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        onToggleTodaySlideOver={() => setIsTodaySlideOverOpen((prev) => !prev)}
        isTodaySlideOverOpen={isTodaySlideOverOpen}
      />

      {/* =========================================================================
          Full-Height App Shell: 248px flush sidebar + fluid content (Section 2)
         ========================================================================= */}
      <div className="flex-1 flex w-full min-h-[calc(100vh-57px)]">
        {/* Full-Height Left Sidebar flush to screen edge (248px) */}
        <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Fluid Main Content Area */}
        <div className="flex-1 min-w-0 flex justify-center overflow-x-hidden">
          <div className="w-full max-w-[1800px] flex p-4 sm:p-6 pb-24 md:pb-8 gap-6">
            {/* Primary Ledger Workspace */}
            <main className="flex-1 min-w-0 overflow-x-hidden">
              {activeTab === 'dashboard' && (
                <DashboardOverview onNavigate={(t) => setActiveTab(t as NavTab)} />
              )}
              {activeTab === 'ledger' && <LedgerView />}
              {activeTab === 'trial-balance' && (
                <TrialBalanceView onNavigateToDoctor={() => setActiveTab('doctor')} />
              )}
              {activeTab === 'doctor' && <DoctorView />}
              {activeTab === 'counting' && <CountingSheetView />}
              {activeTab === 'expenses' && <ExpensesView />}
              {activeTab === 'giving' && <GivingDirectoryView />}
              {activeTab === 'budgets' && <BudgetManagerView />}
              {activeTab === 'payroll' && <PayrollView />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'style-guide' && <StyleGuideView />}
            </main>

            {/* Right-Hand "Today" Panel (Fixed 320px at 1,500px and wider per Section 2) */}
            <div className="hidden min-[1500px]:block w-[320px] shrink-0">
              <div className="sticky top-[73px]">
                <TodayPanel
                  monthName="October 2026"
                  isMonthOpen={true}
                  closeDeadline="5 Nov 2026"
                  isTreasurer={currentUser.role === 'Treasurer'}
                  onStartCloseChecklist={() => setActiveTab('settings')}
                  usdRate={15.5}
                  rateDate="24 Oct 2026"
                  rateEnteredBy="Kofi Mensah"
                  isRateStale={false}
                  onUpdateRate={() => setActiveTab('settings')}
                  isTbBalanced={trialBalance.isBalanced}
                  tbDifferenceGhs={Number(trialBalance.differenceGhs) / 100}
                  tbLastCheckedMinutesAgo={2}
                  onCheckDoctor={() => setActiveTab('doctor')}
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-Over Today Panel for Viewports < 1,500px (Section 2) */}
      {isTodaySlideOverOpen && (
        <div className="min-[1500px]:hidden fixed inset-0 z-50 overflow-hidden animate-fadeIn">
          {/* Backdrop */}
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
                  setActiveTab('settings');
                  setIsTodaySlideOverOpen(false);
                }}
                usdRate={15.5}
                rateDate="24 Oct 2026"
                rateEnteredBy="Kofi Mensah"
                isRateStale={false}
                onUpdateRate={() => {
                  setActiveTab('settings');
                  setIsTodaySlideOverOpen(false);
                }}
                isTbBalanced={trialBalance.isBalanced}
                tbDifferenceGhs={Number(trialBalance.differenceGhs) / 100}
                tbLastCheckedMinutesAgo={2}
                onCheckDoctor={() => {
                  setActiveTab('doctor');
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
    </div>
  );
};
