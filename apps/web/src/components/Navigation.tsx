import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Scale,
  Calculator,
  Receipt,
  Users,
  BarChart3,
  Stethoscope,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLedger } from '../context/LedgerContext.js';
import { hasPermission } from '@church/domain';

export type NavTab =
  | 'dashboard'
  | 'ledger'
  | 'trial-balance'
  | 'counting'
  | 'expenses'
  | 'giving'
  | 'reports'
  | 'doctor'
  | 'settings';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { currentUser } = useAuth();
  const { trialBalance } = useLedger();
  const role = currentUser.role;

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    badge?: string | null;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'ledger',
      label: 'Journal & Ledger',
      icon: BookOpen,
      visible: hasPermission(role, 'ledger:post_entry') || hasPermission(role, 'reports:view_financial'),
    },
    {
      id: 'trial-balance',
      label: 'Trial Balance',
      icon: Scale,
      visible: hasPermission(role, 'reports:view_financial'),
      badge: !trialBalance.isBalanced ? 'DIFF' : null,
    },
    {
      id: 'doctor',
      label: 'TB Doctor',
      icon: Stethoscope,
      visible: hasPermission(role, 'ledger:run_trial_balance_doctor'),
      badge: !trialBalance.isBalanced ? 'ALERT' : null,
    },
    {
      id: 'counting',
      label: 'Counting Sheets',
      icon: Calculator,
      visible: hasPermission(role, 'income:create_counting_sheet') || hasPermission(role, 'income:enter_giving'),
    },
    {
      id: 'expenses',
      label: 'Expenses & Vouchers',
      icon: Receipt,
      visible: hasPermission(role, 'expenses:submit_requisition') || hasPermission(role, 'expenses:approve_requisition') || hasPermission(role, 'expenses:prepare_voucher'),
    },
    {
      id: 'giving',
      label: 'Giving Directory',
      icon: Users,
      visible: true, // Clickable, but content strictly filtered by privacy rule
    },
    {
      id: 'reports',
      label: 'Reports & Statements',
      icon: BarChart3,
      visible: hasPermission(role, 'reports:view_financial') || role === 'Department Head',
    },
    {
      id: 'settings',
      label: 'System & Audit',
      icon: Settings,
      visible: hasPermission(role, 'admin:manage_users') || hasPermission(role, 'audit:view_log'),
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shrink-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-3">
          Accounting Navigation
        </div>
        <nav className="space-y-1">
          {navItems.filter((i) => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 py-1.5 shadow-lg">
        {navItems.filter((i) => i.visible).slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-[10px] font-medium min-w-[58px] transition relative ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
