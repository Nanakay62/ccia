/**
 * DemoWizardCard Component.
 * Implements Section 5.2 (Demo wizard walkthrough card).
 * 
 * Features:
 * - Headline & explanation for training sandbox
 * - 3 guided tasks with one-click direct action buttons
 * - "Reset demo data" button (with confirmation)
 * - "Exit demo" button
 * - "Dismiss walkthrough" link
 */

import React from 'react';
import { useDemo, GuidedTask } from '../../context/DemoContext.js';
import { defaultChurchSettings } from '../../config/churchSettings.js';
import { Button } from '../ui/Button.js';
import {
  Compass,
  FileCheck,
  CheckCircle2,
  Stethoscope,
  RotateCcw,
  LogOut,
  X,
  ArrowRight,
} from 'lucide-react';

interface DemoWizardCardProps {
  onNavigate: (tab: string) => void;
}

export const DemoWizardCard: React.FC<DemoWizardCardProps> = ({ onNavigate }) => {
  const {
    isDemoMode,
    isWizardDismissed,
    dismissWizard,
    requestResetDemoData,
    requestExitDemoMode,
    startGuideTask,
  } = useDemo();

  if (!isDemoMode || isWizardDismissed) {
    return null;
  }

  const handleTaskClick = (task: GuidedTask, tab: string) => {
    startGuideTask(task);
    onNavigate(tab);
  };

  return (
    <div className="rounded-[var(--radius)] border-2 border-[var(--status-amber)]/40 bg-[var(--surface-panel)] p-5 shadow-sm space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--surface-border-subtle)]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[var(--radius)] bg-[var(--status-amber)]/15 text-[var(--status-amber)] flex items-center justify-center shrink-0 mt-0.5">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-[18px] font-semibold text-[var(--text-primary)] leading-tight">
                Demo mode: training sandbox
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[var(--status-amber)]/15 text-[var(--status-amber)]">
                Sandbox
              </span>
            </div>
            <p className="text-[13.5px] text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              You are working with sample data for <strong className="text-[var(--text-primary)]">{defaultChurchSettings.churchName} ({defaultChurchSettings.branchName})</strong>. Nothing you do here affects the real church accounts. Explore freely, or follow the guided tasks below.
            </p>
          </div>
        </div>

        <button
          onClick={dismissWizard}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 self-start sm:self-auto px-2 py-1 rounded hover:bg-[var(--surface-subtle)] transition"
          title="Dismiss walkthrough card"
          aria-label="Dismiss walkthrough"
        >
          <X className="w-3.5 h-3.5" />
          <span>Dismiss walkthrough</span>
        </button>
      </div>

      {/* Guided Tasks (Section 5.2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Task 1: Post Sunday's giving */}
        <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-ground)] border border-[var(--surface-border)] hover:border-[var(--status-amber)] transition flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <FileCheck className="w-4 h-4 shrink-0 text-[var(--status-amber)]" />
              <span>1. Post Sunday's giving</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Sunday sheet <strong className="text-[var(--text-primary)]">#CS-2026-043</strong> (GHS 8,450.00) signed by Counter A, waiting for second signature.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTaskClick('counting', 'counting')}
            className="w-full text-xs font-medium justify-between"
          >
            <span>Review &amp; Sign Sheet</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Task 2: Approve a requisition */}
        <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-ground)] border border-[var(--surface-border)] hover:border-[var(--status-amber)] transition flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--status-amber)]" />
              <span>2. Approve a requisition</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Requisition <strong className="text-[var(--text-primary)]">#REQ-DEMO-001</strong> (50L generator diesel, GHS 850.00) waiting for approval.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTaskClick('expenses', 'expenses')}
            className="w-full text-xs font-medium justify-between"
          >
            <span>Review Requisition</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Task 3: Diagnose an unbalanced month */}
        <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-ground)] border border-[var(--surface-border)] hover:border-[var(--status-amber)] transition flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <Stethoscope className="w-4 h-4 shrink-0 text-[var(--status-amber)]" />
              <span>3. Diagnose an unbalanced month</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              A 20-pesewa foreign missions currency rounding difference in August 2026 needs diagnosis.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTaskClick('doctor', 'doctor')}
            className="w-full text-xs font-medium justify-between"
          >
            <span>Run Doctor Check</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Footer Controls: Reset & Exit Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[var(--surface-border-subtle)]">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={requestResetDemoData}
            className="text-xs flex items-center gap-1.5"
            title="Reset sandbox to original sample dataset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset demo data</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={requestExitDemoMode}
            className="text-xs flex items-center gap-1.5"
            title="Exit demo mode and load real church accounts"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit demo</span>
          </Button>
        </div>

        <span className="text-[12px] text-[var(--text-muted)]">
          Demo actions are stored in your local sandbox only.
        </span>
      </div>
    </div>
  );
};
