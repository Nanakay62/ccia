import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { useDemo } from './context/DemoContext.js';
import { Header } from './components/Header.js';
import { SyncIndicator } from './components/SyncIndicator.js';
import { Navigation, type NavTab } from './components/Navigation.js';
import { RoleSwitcherModal } from './components/RoleSwitcherModal.js';
import { LockScreen } from './components/LockScreen.js';
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

export const App: React.FC = () => {
  const { isLocked } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

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

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SyncIndicator />
      <Header
        onOpenRoleSwitcher={() => setIsRoleModalOpen(true)}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
      />

      {isDemoMode && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-purple-700/60 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-400 text-purple-950 font-black text-[10px] uppercase tracking-wider">
              Sandbox
            </span>
            <span>
              <strong>Demo Mode Active:</strong> 300 Ghanaian church members & 26 weeks of balanced Sunday collections loaded. Live records remain safely untouched.
            </span>
          </div>
          <button
            onClick={toggleDemoMode}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition border border-white/20 text-[11px]"
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto flex pb-20 md:pb-8">
        <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {activeTab === 'dashboard' && <DashboardOverview onNavigate={(t) => setActiveTab(t as NavTab)} />}
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
        </main>
      </div>

      <RoleSwitcherModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />
    </div>
  );
};
