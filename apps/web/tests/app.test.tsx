import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LedgerProvider, useLedger } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { PayrollProvider } from '../src/context/PayrollContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';

describe('Web App Shell, Core Ledger & TB Doctor', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
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
                        <ToastProvider>
                          <App />
                        </ToastProvider>
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

  it('renders header with Calvary Crystal Church branding and Treasurer by default', () => {
    renderApp();
    expect(screen.getAllByText(/Calvary Crystal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Main Branch/i).length).toBeGreaterThan(0);
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

    expect(screen.getByRole('heading', { level: 1, name: /Trial balance/i })).toBeDefined();
    expect(screen.getByText(/Balanced\. Debits/i)).toBeDefined();
    expect(screen.getByText(/Check and diagnose/i)).toBeDefined();
  });

  it('renders Integrity Check and guards simulation sandbox to demo mode only', () => {
    renderApp();

    // Navigate to Integrity Check tab
    const doctorTab = screen.getAllByText('Integrity Check')[0]!;
    fireEvent.click(doctorTab);

    // 1. Live mode quiet healthy state
    expect(screen.getByRole('heading', { level: 1, name: /Integrity check/i })).toBeDefined();
    expect(screen.getAllByText(/All checks passed/i).length).toBeGreaterThan(0);
    // Testing sandbox must NOT be rendered in live mode
    expect(screen.queryByText(/Simulation Sandbox/i)).toBeNull();
    expect(screen.queryByText(/Inject Debit\/Credit Sign Flip/i)).toBeNull();

    // 2. Toggle Demo mode on to safely enable simulation sandbox
    const demoBtn = screen.getByTitle(/Toggle Demo Mode/i);
    fireEvent.click(demoBtn);

    // Now simulation sandbox is available in demo mode
    expect(screen.getByText(/Demo Mode: Simulation Sandbox/i)).toBeDefined();

    // Reset to clean state in demo mode
    const resetBtn = screen.getByText(/Reset Clean Ledger/i);
    fireEvent.click(resetBtn);
    expect(screen.getAllByText(/All checks passed/i).length).toBeGreaterThan(0);

    // Inject real-world accounting corruption: Debit/Credit Sign Flip
    const injectFlipBtn = screen.getByText(/Inject Debit\/Credit Sign Flip/i);
    fireEvent.click(injectFlipBtn);

    // Diagnostic findings immediately detected
    expect(screen.getByText(/Out of balance by GHS/i)).toBeDefined();
    expect(screen.getByText(/Debit\/Credit Sign Inversion/i)).toBeDefined();

    // 3. Reset ledger in demo mode returns to clean state
    fireEvent.click(resetBtn);
    expect(screen.getAllByText(/All checks passed/i).length).toBeGreaterThan(0);
  });

  it('proves that ledger corruption simulation and reset functions throw in live mode', () => {
    let capturedLedger: any = null;
    const TestConsumer = () => {
      capturedLedger = useLedger();
      return null;
    };

    render(
      <AuthProvider>
        <DemoProvider>
          <SyncProvider>
            <LedgerProvider>
              <TestConsumer />
            </LedgerProvider>
          </SyncProvider>
        </DemoProvider>
      </AuthProvider>
    );

    expect(() => {
      capturedLedger.simulateCorruption('sign_flip');
    }).toThrow(/strictly disabled in live mode/i);

    expect(() => {
      capturedLedger.resetLedger();
    }).toThrow(/strictly disabled in live mode/i);
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

  it('locks the app and unlocks with 6-digit PIN', () => {
    localStorage.setItem('church_user_pin', '849204');
    renderApp();

    // Click lock button
    const lockBtn = screen.getByTitle('Lock App');
    fireEvent.click(lockBtn);

    expect(screen.getByText('App Locked')).toBeDefined();

    // Enter 6-digit PIN: 8 4 9 2 0 4
    ['8', '4', '9', '2', '0', '4'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });

    // Should unlock and show dashboard again
    expect(screen.getAllByText(/Calvary Crystal/i).length).toBeGreaterThan(0);
  });

  it('toggles Demo Mode on and off, loading 300 members and displaying sandbox banner', () => {
    renderApp();

    // Toggle demo mode on
    const demoBtn = screen.getByTitle(/Toggle Demo Mode/i);
    fireEvent.click(demoBtn);

    // Sandbox banner should appear
    expect(screen.getByText(/Demo Mode Active:/i)).toBeDefined();
    expect(screen.getByText(/300 Ghanaian church members/i)).toBeDefined();

    // Navigate to Members
    const membersNav = screen.getAllByRole('button', { name: /Members/i })[0]!;
    fireEvent.click(membersNav);

    // Should display members in the directory tab
    expect(screen.getByText('300')).toBeDefined();

    // Toggle demo mode off
    const exitDemoBtn = screen.getByRole('button', { name: /Exit Demo Mode/i });
    fireEvent.click(exitDemoBtn);

    // Sandbox banner disappears and returns to default seeded members (40 members per spec 1.3)
    expect(screen.queryByText(/Demo Mode Active:/i)).toBeNull();
    expect(screen.getByText('40')).toBeDefined();
  });
});
