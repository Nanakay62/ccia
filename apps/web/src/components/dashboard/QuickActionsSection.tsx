import React from 'react';
import { Coins, Calculator, Receipt, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { hasPermission } from '@church/domain';

interface QuickActionsSectionProps {
  onNavigate: (tab: string) => void;
}

export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const actions = [
    {
      id: 'giving',
      title: 'Record giving',
      help: 'Enter Sunday tithes or direct member gifts',
      icon: Coins,
      tab: 'giving',
      visible: hasPermission(role, 'income:enter_giving'),
    },
    {
      id: 'counting',
      title: 'Counting Sheet',
      help: 'Tally physical cash denominations with dual sign-off',
      icon: Calculator,
      tab: 'counting',
      visible:
        role === 'Treasurer' ||
        role === 'Finance Secretary' ||
        hasPermission(role, 'income:create_counting_sheet'),
    },
    {
      id: 'requisition',
      title: 'New requisition',
      help: 'Submit expenditure request or prepare voucher',
      icon: Receipt,
      tab: 'expenses',
      visible:
        hasPermission(role, 'expenses:submit_requisition') ||
        hasPermission(role, 'expenses:prepare_voucher'),
    },
    {
      id: 'reports',
      title: 'Open reports',
      help: 'View Income Statement, Balance Sheet, or Trial Balance',
      icon: BarChart3,
      tab: 'reports',
      visible: hasPermission(role, 'reports:view_financial'),
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Quick Actions
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onNavigate(action.tab)}
              className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:border-[var(--accent)] hover:bg-[var(--surface-subtle)] text-left transition group shadow-2xs"
            >
              <div className="flex items-center justify-between text-[var(--accent)] mb-2">
                <Icon className="w-4 h-4" />
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                {action.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                {action.help}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
