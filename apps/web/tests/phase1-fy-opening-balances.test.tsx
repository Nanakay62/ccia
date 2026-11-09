import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { PayrollProvider } from '../src/context/PayrollContext.js';
import { CashbookProvider } from '../src/context/CashbookContext.js';
import { TithesProvider } from '../src/context/TithesContext.js';
import { FixedAssetsProvider } from '../src/context/FixedAssetsContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { SettingsView } from '../src/components/settings/SettingsView.js';
import { OpeningBalancesPage } from '../src/components/cutover/OpeningBalancesPage.js';

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <AuthProvider>
      <DemoProvider>
        <SyncProvider>
          <LedgerProvider>
            <GivingProvider>
              <ExpensesProvider>
                <BudgetProvider>
                  <PayrollProvider>
                    <CashbookProvider>
                      <TithesProvider>
                        <FixedAssetsProvider>
                          <ReportsProvider>
                            <RouterProvider>{children}</RouterProvider>
                          </ReportsProvider>
                        </FixedAssetsProvider>
                      </TithesProvider>
                    </CashbookProvider>
                  </PayrollProvider>
                </BudgetProvider>
              </ExpensesProvider>
            </GivingProvider>
          </LedgerProvider>
        </SyncProvider>
      </DemoProvider>
    </AuthProvider>
  </ToastProvider>
);

describe('Phase 1 Web Integration: Financial Years, Period 13 & Opening Balances', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Financial Year configuration, Period 13 adjustment period, and Soft-close controls in Settings', () => {
    render(
      <AllProviders>
        <SettingsView />
      </AllProviders>
    );

    const periodsTab = screen.getByRole('button', { name: /Periods and rates/i });
    fireEvent.click(periodsTab);

    expect(screen.getByText(/Financial year and cut-over configuration/i)).toBeDefined();
    expect(screen.getByText(/Adjustment period \(Period 13\)/i)).toBeDefined();
    expect(screen.getByText(/Period 13 \(Auditor Adjustment\)/i)).toBeDefined();

    // Soft-close button should transition an open period to Soft-closed (only Treasurer can post)
    const softCloseButtons = screen.getAllByRole('button', { name: /^Soft-close$/i });
    expect(softCloseButtons.length).toBeGreaterThan(0);
    fireEvent.click(softCloseButtons[0]!);
    expect(screen.getAllByText(/Soft-closed \(only Treasurer can post\)/i).length).toBeGreaterThan(0);
  });

  it('renders the Opening Balances & Cut-Over full page with per-fund balance checks, statement reconciliation, dry run, and dual-approval commit', () => {
    render(
      <AllProviders>
        <OpeningBalancesPage />
      </AllProviders>
    );

    expect(screen.getByText(/Opening balances and cut-over from old books/i)).toBeDefined();
    expect(screen.getByText(/Balance check by fund/i)).toBeDefined();
    expect(screen.getByText(/Bank, MoMo and cash statement agreement/i)).toBeDefined();
    expect(screen.getByText(/All opening balance validations pass/i)).toBeDefined();

    // Switch to Dry Run stage
    const dryRunBtn = screen.getByRole('button', { name: /2\. Dry run preview/i });
    fireEvent.click(dryRunBtn);
    expect(screen.getByText(/Proposed opening balance journal entries/i)).toBeDefined();
    expect(screen.getByText(/Resulting trial balance after dry run/i)).toBeDefined();

    // Open Commit dialog
    const commitBtn = screen.getByRole('button', { name: /Commit opening balances/i });
    fireEvent.click(commitBtn);
    expect(screen.getByText(/Approve and commit opening balances/i)).toBeDefined();
    expect(screen.getByText(/Treasurer sign-off/i)).toBeDefined();
    expect(screen.getByText(/Pastor or Elder approval/i)).toBeDefined();
  });
});
