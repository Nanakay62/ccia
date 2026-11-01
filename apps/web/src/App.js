import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Header } from './components/Header.js';
import { SyncIndicator } from './components/SyncIndicator.js';
import { Navigation } from './components/Navigation.js';
import { RoleSwitcherModal } from './components/RoleSwitcherModal.js';
import { LockScreen } from './components/LockScreen.js';
import { DashboardView } from './components/DashboardView.js';
import { LedgerView } from './components/ledger/LedgerView.js';
import { TrialBalanceView } from './components/ledger/TrialBalanceView.js';
import { DoctorView } from './components/doctor/DoctorView.js';
import { CountingView, ExpensesView, GivingView, ReportsView, SettingsView, } from './components/SectionViews.js';
export const App = () => {
    const { isLocked } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('church_theme') === 'dark';
    });
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('church_theme', 'dark');
        }
        else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('church_theme', 'light');
        }
    }, [isDark]);
    if (isLocked) {
        return _jsx(LockScreen, {});
    }
    return (_jsxs("div", { className: "min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100", children: [_jsx(SyncIndicator, {}), _jsx(Header, { onOpenRoleSwitcher: () => setIsRoleModalOpen(true), isDark: isDark, onToggleDark: () => setIsDark((d) => !d) }), _jsxs("div", { className: "flex-1 max-w-7xl w-full mx-auto flex pb-20 md:pb-8", children: [_jsx(Navigation, { activeTab: activeTab, onSelectTab: setActiveTab }), _jsxs("main", { className: "flex-1 p-4 sm:p-6 overflow-x-hidden", children: [activeTab === 'dashboard' && _jsx(DashboardView, { onNavigate: setActiveTab }), activeTab === 'ledger' && _jsx(LedgerView, {}), activeTab === 'trial-balance' && (_jsx(TrialBalanceView, { onNavigateToDoctor: () => setActiveTab('doctor') })), activeTab === 'doctor' && _jsx(DoctorView, {}), activeTab === 'counting' && _jsx(CountingView, {}), activeTab === 'expenses' && _jsx(ExpensesView, {}), activeTab === 'giving' && _jsx(GivingView, {}), activeTab === 'reports' && _jsx(ReportsView, {}), activeTab === 'settings' && _jsx(SettingsView, {})] })] }), _jsx(RoleSwitcherModal, { isOpen: isRoleModalOpen, onClose: () => setIsRoleModalOpen(false) })] }));
};
