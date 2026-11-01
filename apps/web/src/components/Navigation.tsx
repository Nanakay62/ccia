import React, { useState } from 'react';
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
  Briefcase,
  PieChart,
  Palette,
  X,
  MoreHorizontal,
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
  | 'budgets'
  | 'payroll'
  | 'reports'
  | 'doctor'
  | 'settings'
  | 'style-guide';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  className?: string;
}

interface NavItemDef {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  badge?: string | null;
}

interface NavGroupDef {
  groupName: string;
  items: NavItemDef[];
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  className = '',
}) => {
  const { currentUser } = useAuth();
  const { trialBalance } = useLedger();
  const role = currentUser.role;
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Grouped Navigation structure per Section 2: Daily, Books, People, Reports, System
  const navGroups: NavGroupDef[] = [
    {
      groupName: 'Daily',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          visible: true,
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
          visible:
            hasPermission(role, 'expenses:submit_requisition') ||
            hasPermission(role, 'expenses:approve_requisition') ||
            hasPermission(role, 'expenses:prepare_voucher'),
        },
      ],
    },
    {
      groupName: 'Books',
      items: [
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
          id: 'budgets',
          label: 'Budgets & Targets',
          icon: PieChart,
          visible:
            hasPermission(role, 'budget:view_all') ||
            hasPermission(role, 'budget:view_own_department') ||
            hasPermission(role, 'budget:manage'),
        },
      ],
    },
    {
      groupName: 'People',
      items: [
        {
          id: 'giving',
          label: 'Giving Directory',
          icon: Users,
          visible: true,
        },
        {
          id: 'payroll',
          label: 'Staff & Payroll',
          icon: Briefcase,
          visible: hasPermission(role, 'payroll:view') || hasPermission(role, 'payroll:process'),
        },
      ],
    },
    {
      groupName: 'Reports',
      items: [
        {
          id: 'reports',
          label: 'Reports & Statements',
          icon: BarChart3,
          visible: hasPermission(role, 'reports:view_financial') || role === 'Department Head',
        },
      ],
    },
    {
      groupName: 'System',
      items: [
        {
          id: 'settings',
          label: 'Settings & Audit',
          icon: Settings,
          visible: hasPermission(role, 'admin:manage_users') || hasPermission(role, 'audit:view_log'),
        },
        {
          id: 'style-guide',
          label: 'Style Guide',
          icon: Palette,
          visible: true,
        },
      ],
    },
  ];

  return (
    <>
      {/* =========================================================================
          Desktop & Laptop Sidebar: 248px flush to screen edge (Section 2)
         ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col w-[248px] shrink-0 border-r border-[var(--surface-border)] bg-[var(--surface-panel)] py-4 px-2 select-none ${className}`}
        aria-label="Accounting Navigation Sidebar"
      >
        <div className="flex-1 space-y-4 overflow-y-auto">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((i) => i.visible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupName} className="space-y-1">
                {/* Small Group Label */}
                <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 py-1">
                  {group.groupName}
                </div>

                {/* Nav Items */}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius)] text-[14px] transition text-left ${
                          isActive
                            ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border-l-2 border-[var(--accent)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] font-normal'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--status-red-bg)] text-[var(--status-red)] border border-[var(--status-red)]">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info block */}
        <div className="pt-3 border-t border-[var(--surface-border-subtle)] px-3 text-[11px] text-[var(--text-muted)]">
          <div>Accra Main Branch</div>
          <div>Offline Ledger v1.0</div>
        </div>
      </aside>

      {/* =========================================================================
          Mobile Bottom Navigation Bar (< 768px): 5 primary tabs + drawer (Section 2)
         ========================================================================= */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-panel)] border-t border-[var(--surface-border)] flex items-center justify-around px-1 py-1 shadow-lg select-none"
        aria-label="Mobile Navigation"
      >
        {/* 1. Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] rounded transition ${
            activeTab === 'dashboard'
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </button>

        {/* 2. Counting */}
        <button
          onClick={() => onSelectTab('counting')}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] rounded transition ${
            activeTab === 'counting'
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <Calculator className="w-5 h-5 mb-0.5" />
          <span>Giving</span>
        </button>

        {/* 3. Expenses */}
        <button
          onClick={() => onSelectTab('expenses')}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] rounded transition ${
            activeTab === 'expenses'
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Expenses</span>
        </button>

        {/* 4. Reports */}
        <button
          onClick={() => onSelectTab('reports')}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] rounded transition ${
            activeTab === 'reports'
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span>Reports</span>
        </button>

        {/* 5. More Drawer Trigger */}
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] text-[var(--text-secondary)] rounded transition"
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer */}
      {isMobileDrawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface-panel)] border-t border-[var(--surface-border)] rounded-t-[var(--radius)] p-5 max-h-[80vh] overflow-y-auto space-y-4 animate-slideUp">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)]">
              <span className="font-serif text-[17px] font-semibold text-[var(--text-primary)]">
                More Navigation
              </span>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[14px]">
              {navGroups
                .flatMap((g) => g.items)
                .filter((item) => item.visible)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`flex items-center gap-2 p-3 rounded-[var(--radius)] text-left min-h-[44px] transition ${
                        isActive
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-border-subtle)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </>
  );
};
