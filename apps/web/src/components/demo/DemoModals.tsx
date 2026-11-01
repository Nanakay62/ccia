import React from 'react';
import { useDemo } from '../../context/DemoContext.js';
import { Button } from '../ui/Button.js';
import { RotateCcw, LogOut } from 'lucide-react';

export const DemoModals: React.FC = () => {
  const {
    isExitConfirmOpen,
    confirmExitDemoMode,
    cancelExitDemoMode,
    isResetConfirmOpen,
    confirmResetDemoData,
    cancelResetDemoData,
  } = useDemo();

  return (
    <>
      {/* Exit Confirmation Dialog */}
      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--status-amber)]/10 text-[var(--status-amber)] flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                  Leave Demo Mode?
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Confirm return to live church accounts
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              You have performed actions in the training sandbox. Your demo entries remain stored in your local sandbox until reset, but will never affect live church records.
            </p>

            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border-subtle)] text-xs text-[var(--text-secondary)]">
              Switching back to live mode will immediately reload real church financial statements.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={cancelExitDemoMode}>
                Stay in Demo
              </Button>
              <Button variant="primary" onClick={confirmExitDemoMode}>
                Exit to Live Mode
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--status-red)]/10 text-[var(--status-red)] flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                  Reset Demo Sandbox Data?
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Restore pristine sample dataset
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              This will erase all changes made in the demo sandbox and restore the default training state for Christ Church of Grace: 300 Ghanaian church members, 6 months of balanced transactions, and the original open action items.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={cancelResetDemoData}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={confirmResetDemoData}
                className="!bg-[var(--status-red)] hover:!bg-red-700"
              >
                Reset Demo Data
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
