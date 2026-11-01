/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider, useDemo } from '../src/context/DemoContext.js';
import { SyncProvider, useSync } from '../src/context/SyncContext.js';
import { LedgerProvider, useLedger } from '../src/context/LedgerContext.js';
import { GivingProvider, useGiving } from '../src/context/GivingContext.js';
import { ExpensesProvider, useExpenses } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { App } from '../src/App.js';
import { SyncIndicator } from '../src/components/SyncIndicator.js';
import { DemoWizardCard } from '../src/components/dashboard/DemoWizardCard.js';

const FullTestApp: React.FC = () => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <ExpensesProvider>
              <ReportsProvider>
                <BudgetProvider>
                  <App />
                </BudgetProvider>
              </ReportsProvider>
            </ExpensesProvider>
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 4: Demo Mode Specification Verification (Section 5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Section 5.1 & 5.3: toggles Demo Mode switch, displays amber status and persistent warning strip', () => {
    render(<FullTestApp />);

    // Initially in Live mode: switch shows 'Demo mode: off'
    expect(screen.getByText(/Demo mode: off/i)).toBeDefined();
    expect(screen.queryByText(/Demo mode: training sandbox/i)).toBeNull();

    // Toggle Demo Mode on
    const demoToggle = screen.getByTitle('Toggle Demo Mode');
    fireEvent.click(demoToggle);

    // Header switch now displays amber 'Demo mode: on'
    expect(screen.getByText(/Demo mode: on/i)).toBeDefined();

    // Top persistent banner displays warning with dark text per Section 5.3
    expect(screen.getByText(/Demo Mode Active:/i)).toBeDefined();
    expect(screen.getByText(/Changes will not be saved to live accounts/i)).toBeDefined();

    // Browser body carries demo-mode-active class for printable watermark
    expect(document.body.classList.contains('demo-mode-active')).toBe(true);
  });

  it('Section 5.2: renders Demo wizard walkthrough card with 3 guided tasks and action buttons', () => {
    localStorage.setItem('church_demo_mode', 'true');
    render(<FullTestApp />);

    // Walkthrough Card Headline & Explanation
    expect(screen.getByText(/Demo mode: training sandbox/i)).toBeDefined();
    expect(screen.getByText(/Christ Church of Grace, Adabraka/i)).toBeDefined();

    // 3 Guided Tasks
    expect(screen.getByText(/1\. Post Sunday's giving/i)).toBeDefined();
    expect(screen.getAllByText(/#CS-2026-043/i).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/2\. Approve a requisition/i)).toBeDefined();
    expect(screen.getAllByText(/#REQ-DEMO-001/i).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/3\. Diagnose an unbalanced month/i)).toBeDefined();
    expect(screen.getByText(/20-pesewa foreign missions currency rounding difference/i)).toBeDefined();

    // Action buttons
    expect(screen.getByRole('button', { name: /Reset demo data/i })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Exit demo/i }).length).toBeGreaterThanOrEqual(1);

    // Dismiss walkthrough card link
    const dismissBtn = screen.getByRole('button', { name: /Dismiss walkthrough/i });
    fireEvent.click(dismissBtn);

    // Card is hidden, but can be restored from top banner
    expect(screen.queryByText(/Demo mode: training sandbox/i)).toBeNull();
    const showCardLink = screen.getByText(/Show walkthrough card/i);
    expect(showCardLink).toBeDefined();

    fireEvent.click(showCardLink);
    expect(screen.getByText(/Demo mode: training sandbox/i)).toBeDefined();
  });

  it('Section 5.4: contains all 3 open items waiting for immediate action in Demo Mode', () => {
    localStorage.setItem('church_demo_mode', 'true');
    render(<FullTestApp />);

    // Needs attention list on dashboard displays open items:
    // 1. Pending requisitions
    expect(screen.getByText(/requisitions waiting for approval/i)).toBeDefined();

    // 2. Unsigned counting sheet CS-2026-043
    expect(screen.getByText(/Sunday counting sheet #CS-2026-043 needs a second signature/i)).toBeDefined();

    // 3. Trial balance imbalance of GHS 0.20 detected
    expect(screen.getByText(/Trial balance imbalance of GHS 0\.20 detected/i)).toBeDefined();
  });

  it('Section 5.1: enforces Sync Hard Guard when in Demo Mode', () => {
    localStorage.setItem('church_demo_mode', 'true');
    render(
      <AuthProvider>
        <DemoProvider>
          <SyncProvider>
            <SyncIndicator />
          </SyncProvider>
        </DemoProvider>
      </AuthProvider>
    );

    // Indicator displays 'Demo mode — sync disabled' with amber dot
    expect(screen.getByText(/Demo mode — sync disabled/i)).toBeDefined();

    // Open flyout panel
    const indicatorTrigger = screen.getByRole('button', { name: /Demo mode — sync disabled/i });
    fireEvent.click(indicatorTrigger);

    // Displays hard guard explanation
    expect(screen.getAllByText(/Demo Mode — Sync Disabled/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Sandbox database is isolated/i)).toBeDefined();

    // Sync now button is disabled
    const syncNowBtn = screen.getByRole('button', { name: /Sync now/i });
    expect(syncNowBtn.hasAttribute('disabled')).toBe(true);
  });
});
