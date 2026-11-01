import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
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
import { SettingsView } from './components/SectionViews.js';

export const App: React.FC = () => {
  const { isLocked } = useAuth();
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
