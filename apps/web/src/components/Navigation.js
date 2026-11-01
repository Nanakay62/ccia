import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { LayoutDashboard, BookOpen, Calculator, Receipt, Users, BarChart3, Stethoscope, Settings, } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { hasPermission } from '@church/domain';
export const Navigation = ({ activeTab, onSelectTab }) => {
    const { currentUser } = useAuth();
    const role = currentUser.role;
    const navItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            visible: true,
        },
        {
            id: 'ledger',
            label: 'Ledger',
            icon: BookOpen,
            visible: hasPermission(role, 'ledger:post_entry') || hasPermission(role, 'reports:view_financial'),
        },
        {
            id: 'counting',
            label: 'Counting',
            icon: Calculator,
            visible: hasPermission(role, 'income:create_counting_sheet') || hasPermission(role, 'income:enter_giving'),
        },
        {
            id: 'expenses',
            label: 'Expenses',
            icon: Receipt,
            visible: hasPermission(role, 'expenses:submit_requisition') || hasPermission(role, 'expenses:approve_requisition') || hasPermission(role, 'expenses:prepare_voucher'),
        },
        {
            id: 'giving',
            label: 'Giving',
            icon: Users,
            visible: true, // Clickable, but content strictly filtered by privacy rule
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: BarChart3,
            visible: hasPermission(role, 'reports:view_financial') || role === 'Department Head',
        },
        {
            id: 'doctor',
            label: 'TB Doctor',
            icon: Stethoscope,
            visible: hasPermission(role, 'ledger:run_trial_balance_doctor'),
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            visible: hasPermission(role, 'admin:manage_users') || hasPermission(role, 'audit:view_log'),
        },
    ];
    return (_jsxs(_Fragment, { children: [_jsxs("aside", { className: "hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shrink-0", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-3", children: "Accounting Navigation" }), _jsx("nav", { className: "space-y-1", children: navItems.filter((i) => i.visible).map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (_jsxs("button", { onClick: () => onSelectTab(item.id), className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`, children: [_jsx(Icon, { className: `w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}` }), _jsx("span", { children: item.label })] }, item.id));
                        }) })] }), _jsx("nav", { className: "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 py-1.5 shadow-lg", children: navItems.filter((i) => i.visible).slice(0, 5).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (_jsxs("button", { onClick: () => onSelectTab(item.id), className: `flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-medium min-w-[58px] transition ${isActive
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-500 dark:text-slate-400'}`, children: [_jsx(Icon, { className: `w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}` }), _jsx("span", { children: item.label })] }, item.id));
                }) })] }));
};
