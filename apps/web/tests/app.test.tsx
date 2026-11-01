import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { PayrollProvider } from '../src/context/PayrollContext.js';

describe('Web App Shell, Core Ledger & TB Doctor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderApp = () =>
    render(
      <AuthProvider>
        <DemoProvider>
          <SyncProvider>
            <LedgerProvider>
              <GivingProvider>
                <ExpensesProvider>
                  <ReportsProvider>
                    <BudgetProvider>
                      <PayrollProvider>
                        <App />
                      </PayrollProvider>
                    </BudgetProvider>
                  </ReportsProvider>
                </ExpensesProvider>
              </GivingProvider>
            </LedgerProvider>
          </SyncProvider>
        </DemoProvider>
      </AuthProvider>
    );

  it('renders header with Accra Central Church branding and Treasurer by default', () => {
    renderApp();
    expect(screen.getAllByText(/Accra Central/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Accra Central Branch/i)).toBeDefined();
    expect(screen.getAllByText(/Treasurer/i).length).toBeGreaterThan(0);
  });

  it('renders the persistent sync status indicator', () => {
    renderApp();
    expect(screen.getAllByText(/Online/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/waiting to sync/i)).toBeDefined();
    expect(screen.getByText(/Need Attention/i)).toBeDefined();
  });

  it('renders trial balance and verifies accounts are in balance', () => {
    renderApp();

    // Click "Trial Balance" in navigation
    const tbTab = screen.getAllByText('Trial Balance')[0]!;
    fireEvent.click(tbTab);

    expect(screen.getByText(/Trial Balance & Fund Position/i)).toBeDefined();
    expect(screen.getByText(/Books are in Perfect Balance/i)).toBeDefined();
    expect(screen.getByText('Check & Diagnose')).toBeDefined();
  });

  it('renders Trial Balance Doctor and detects injected sign inversion error', () => {
    renderApp();

    // Navigate to TB Doctor tab
    const doctorTab = screen.getAllByText('TB Doctor')[0]!;
    fireEvent.click(doctorTab);

    expect(screen.getAllByText(/Trial Balance Doctor/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/10-Check Audit Sequence/i)).toBeDefined();
    expect(screen.getByText(/No diagnostic defects found/i)).toBeDefined();

    // Inject real-world accounting corruption: Debit/Credit Sign Flip
    const injectFlipBtn = screen.getByText(/Inject Debit\/Credit Sign Flip/i);
    fireEvent.click(injectFlipBtn);

    // Doctor should immediately update with warning and Rule 7 detection
    expect(screen.getByText(/Debit\/Credit Sign Inversion/i)).toBeDefined();
    expect(screen.getByText(/mistakenly entered as a credit/i)).toBeDefined();
  });

  it('allows switching to Counter role and masks individual giving records', () => {
    renderApp();

    // Default Treasurer sees unmasked donor names
    expect(screen.getByText('Kwame Mensah')).toBeDefined();

    // Open Role Switcher
    const roleButton = screen.getByTitle(/Click to switch test role/i);
    fireEvent.click(roleButton);

    // Select Counter
    const counterOption = screen.getByText(/Kwame Boateng \(Counter A\)/i);
    fireEvent.click(counterOption);

    // After switching to Counter, privacy rule should mask individual giving
    expect(screen.queryByText('Kwame Mensah')).toBeNull();
    expect(screen.getAllByText(/Confidential/i).length).toBeGreaterThan(0);
  });

  it('locks the app and unlocks with PIN 1234', () => {
    renderApp();

    // Click lock button
    const lockBtn = screen.getByTitle('Lock App');
    fireEvent.click(lockBtn);

    expect(screen.getByText('App Locked')).toBeDefined();

    // Enter PIN 1 2 3 4
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));

    // Should unlock and show dashboard again
    expect(screen.getAllByText(/Accra Central/i).length).toBeGreaterThan(0);
  });

  it('toggles Demo Mode on and off, loading 300 members and displaying sandbox banner', () => {
    renderApp();

    // Toggle demo mode on
    const demoBtn = screen.getByTitle(/Toggle Demo Mode/i);
    fireEvent.click(demoBtn);

    // Sandbox banner should appear
    expect(screen.getByText(/Demo Mode Active:/i)).toBeDefined();
    expect(screen.getByText(/300 Ghanaian church members/i)).toBeDefined();

    // Navigate to Giving Directory
    const givingTab = screen.getAllByText('Giving Directory')[0]!;
    fireEvent.click(givingTab);

    // Should display 300 members in the directory tab
    expect(screen.getByText(/Member Directory \(300\)/i)).toBeDefined();

    // Toggle demo mode off
    const exitDemoBtn = screen.getByRole('button', { name: /Exit Demo Mode/i });
    fireEvent.click(exitDemoBtn);

    // Sandbox banner disappears and returns to default seeded members
    expect(screen.queryByText(/Demo Mode Active:/i)).toBeNull();
    expect(screen.getByText(/Member Directory \(5\)/i)).toBeDefined();
  });
});
