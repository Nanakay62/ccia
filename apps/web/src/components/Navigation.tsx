import React, { useState, useEffect, useCallback } from 'react';
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
  Wallet,
  Coins,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLedger } from '../context/LedgerContext.js';
import { hasPermission } from '@church/domain';
import { useModalEscape } from '../utils/useModalEscape.js';
import { defaultChurchSettings } from '../config/churchSettings.js';

export type NavTab =
  | 'dashboard'
  | 'ledger'
  | 'trial-balance'
  | 'counting'
  | 'tithes'
  | 'expenses'
  | 'cashbook'
  | 'giving'
  | 'budgets'
  | 'payroll'
  | 'reports'
  | 'doctor'
  | 'settings'
  | 'assets'
  | 'style-guide';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenUserManual?: () => void;
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
  onOpenUserManual,
  className = '',
}) => {
  const { currentUser } = useAuth();
  const { trialBalance } = useLedger();
  const role = currentUser.role;
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useModalEscape(isMobileDrawerOpen, () => setIsMobileDrawerOpen(false));

  // Sidebar Collapse state per user (Requirement 4)
  const userStorageKey = `church_sidebar_collapsed_${currentUser.id}`;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      return true;
    }
    try {
      return localStorage.getItem(userStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Group Collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(userStorageKey, String(next));
      } catch {}
      return next;
    });
  }, [userStorageKey]);

  // Auto-collapse below 1,280px (Requirement 4)
  useEffect(() => {
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsCollapsed(true);
      }
    };
    if (!isTest) {
      handleResize();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut Ctrl+B or Cmd+B (Requirement 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  // Grouped Navigation structure: Daily, Books, People, Reports, System
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
          visible:
            hasPermission(role, 'income:create_counting_sheet') ||
            hasPermission(role, 'income:enter_giving'),
        },
        {
          id: 'tithes',
          label: 'Tithes',
          icon: Coins,
          visible:
            hasPermission(role, 'tithes:view_summary') ||
            hasPermission(role, 'tithes:view_individual') ||
            hasPermission(role, 'tithes:record_batch'),
        },
        {
          id: 'expenses',
          label: 'Expenditure',
          icon: Receipt,
          visible:
            hasPermission(role, 'expenses:submit_requisition') ||
            hasPermission(role, 'expenses:approve_requisition') ||
            hasPermission(role, 'expenses:prepare_voucher'),
        },
        {
          id: 'cashbook',
          label: 'Cashbook',
          icon: Wallet,
          visible: hasPermission(role, 'cashbook:view'),
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
          visible:
            hasPermission(role, 'ledger:post_entry') ||
            hasPermission(role, 'reports:view_financial'),
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
          label: 'Integrity Check',
          icon: Stethoscope,
          visible:
            (role === 'Treasurer' || role === 'Auditor') &&
            hasPermission(role, 'ledger:run_trial_balance_doctor'),
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
        {
          id: 'assets',
          label: 'Fixed Assets',
          icon: Building2,
          visible: hasPermission(role, 'assets:view_register'),
        },
      ],
    },
    {
      groupName: 'People',
      items: [
        {
          id: 'giving',
          label: 'Members',
          icon: Users,
          visible: true,
        },
        {
          id: 'payroll',
          label: 'Payroll',
          icon: Briefcase,
          visible:
            hasPermission(role, 'payroll:view') ||
            hasPermission(role, 'payroll:process'),
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
          visible:
            hasPermission(role, 'reports:view_financial') ||
            role === 'Department Head',
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
          visible:
            hasPermission(role, 'admin:manage_users') ||
            hasPermission(role, 'audit:view_log'),
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
          Desktop & Laptop Sidebar: Sticky, Full Viewport Height, Its Own Scroll
          Row height ~40px, font 15px, groups collapse, icon strip collapse (Requirement 4)
         ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 border-r border-[var(--surface-border)] bg-[var(--surface-panel)] py-3 select-none transition-all duration-200 overflow-y-auto ${
          isCollapsed ? 'w-[64px]' : 'w-[240px]'
        } ${className}`}
        aria-label="Accounting Navigation Sidebar"
      >
        {/* Sidebar Header: Toggle button and Branding */}
        <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-[var(--surface-border)] min-h-[40px]">
          {!isCollapsed && (
            <div className="min-w-0 pr-2">
              <span className="font-semibold text-[13px] text-[var(--text-primary)] block truncate">
                {defaultChurchSettings.shortName}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block truncate">
                {defaultChurchSettings.branchName}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapse}
            className={`p-1.5 rounded-[var(--radius)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4 text-[var(--accent)]" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Groups List */}
        <div className="flex-1 space-y-3">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((i) => i.visible);
            if (visibleItems.length === 0) return null;

            const isGroupCollapsed = !isCollapsed && Boolean(collapsedGroups[group.groupName]);

            return (
              <div key={group.groupName} className="space-y-0.5">
                {/* Group Header (with collapse toggle when expanded) */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.groupName)}
                    className="w-full flex items-center justify-between px-3.5 py-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                  >
                    <span>{group.groupName}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
                        isGroupCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>
                ) : (
                  <div className="my-1 border-t border-[var(--surface-border-subtle)]" />
                )}

                {/* Group Items (hidden if group is collapsed) */}
                {!isGroupCollapsed && (
                  <div>
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      if (isCollapsed) {
                        return (
                          <button
                            key={item.id}
                            onClick={() => onSelectTab(item.id)}
                            className={`w-full h-10 min-h-[40px] flex items-center justify-center relative transition rounded-[var(--radius)] text-[15px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
                              isActive
                                ? 'bg-[var(--surface-subtle)] text-[var(--accent)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]/50'
                            }`}
                            title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                            aria-label={item.label}
                          >
                            <Icon
                              className={`w-5 h-5 shrink-0 ${
                                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                              }`}
                            />
                            <span className="sr-only">{item.label}</span>
                            {item.badge && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--status-amber)] ring-1 ring-[var(--surface-panel)]" />
                            )}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => onSelectTab(item.id)}
                          className={`w-full h-10 min-h-[40px] flex items-center justify-between px-3.5 text-[15px] transition text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded-[var(--radius)] ${
                            isActive
                              ? 'bg-[var(--surface-subtle)] text-[var(--accent)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]/50 font-normal'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {/* Plain text count/badge */}
                          {item.badge && (
                            <span className="text-[12px] font-sans tabular-nums text-[var(--text-muted)] shrink-0 ml-2">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info block */}
        <div className="pt-3 border-t border-[var(--surface-border-subtle)] px-3 text-[11px] text-[var(--text-muted)] space-y-2">
          {onOpenUserManual && (
            <button
              onClick={onOpenUserManual}
              className={`flex items-center gap-2 rounded-[var(--radius)] text-xs text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] font-medium border border-[var(--surface-border)] transition ${
                isCollapsed
                  ? 'w-full h-9 justify-center'
                  : 'w-full px-2.5 py-1.5'
              }`}
              title="Open Platform User Manual"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              {!isCollapsed && <span>User manual</span>}
            </button>
          )}
          {!isCollapsed && (
            <>
              <div>{defaultChurchSettings.churchName}</div>
              <div>{defaultChurchSettings.branchName}</div>
              <div>Offline Ledger v1.0</div>
            </>
          )}
        </div>
      </aside>

      {/* =========================================================================
          Mobile Bottom Navigation Bar (< 768px): 5 primary tabs + slide-in drawer
          (Allowed for mobile navigation only per Requirement 1)
         ========================================================================= */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-panel)] border-t border-[var(--surface-border)] flex items-center justify-around px-1 py-1 shadow-lg select-none"
        aria-label="Mobile Navigation"
      >
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

        <button
          onClick={() => onSelectTab('expenses')}
          className={`flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] rounded transition ${
            activeTab === 'expenses'
              ? 'text-[var(--accent)] font-semibold'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Expenditure</span>
        </button>

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

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center p-1.5 min-w-[56px] min-h-[44px] text-[11px] text-[var(--text-secondary)] rounded transition"
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Slide-in Drawer */}
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

            {onOpenUserManual && (
              <div className="pt-2 border-t border-[var(--surface-border)]">
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenUserManual();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border-subtle)] text-[var(--accent)] font-semibold text-xs border border-[var(--surface-border)] min-h-[44px] transition"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>User manual</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};
