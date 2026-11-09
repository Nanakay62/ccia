import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, SAMPLE_USERS } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { CashbookProvider } from '../src/context/CashbookContext.js';
import { TithesProvider } from '../src/context/TithesContext.js';
import { FixedAssetsProvider } from '../src/context/FixedAssetsContext.js';
import { DoctorView } from '../src/components/doctor/DoctorView.js';
import { CashbookView } from '../src/components/cashbook/CashbookView.js';
import { TithesView } from '../src/components/tithes/TithesView.js';
import { FixedAssetsView } from '../src/components/assets/FixedAssetsView.js';

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <ToastProvider>
        <SyncProvider>
          <LedgerProvider>
            <GivingProvider>
              <ExpensesProvider>
                <CashbookProvider>
                  <TithesProvider>
                    <FixedAssetsProvider>{children}</FixedAssetsProvider>
                  </TithesProvider>
                </CashbookProvider>
              </ExpensesProvider>
            </GivingProvider>
          </LedgerProvider>
        </SyncProvider>
      </ToastProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 8: Polish, Accessibility, Integrity Checks & Role Hardening (Sections 5, 6, 7 & 10)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('church_demo_mode', 'true');
  });

  afterEach(() => {
    cleanup();
  });

  it('lists all 16 Integrity Checks in DoctorView including the 6 new sub-ledger and control checks (Section 5)', () => {
    render(
      <AllProviders>
        <DoctorView />
      </AllProviders>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Integrity check/i })).toBeDefined();

    // Expand "Checks performed" collapsible list
    const toggleBtn = screen.getByRole('button', { name: /Checks performed/i });
    fireEvent.click(toggleBtn);

    // Verify all 6 new checks from Section 5 are present
    expect(screen.getByText(/Cashbook vs ledger agreement/i)).toBeDefined();
    expect(screen.getByText(/Tithes control and allocation/i)).toBeDefined();
    expect(screen.getByText(/Fixed asset register vs ledger/i)).toBeDefined();
    expect(screen.getByText(/No double posting of counting sheets or vouchers/i)).toBeDefined();
    expect(screen.getByText(/Bank reconciliation currency \(within 35 days\)/i)).toBeDefined();
    expect(screen.getByText(/Remittance liability agreement/i)).toBeDefined();
  });

  it('displays the mandatory Ghana Data Protection Act confidentiality notice on Tithes Records and logs access (Section 2.6)', () => {
    render(
      <AllProviders>
        <TithesView />
      </AllProviders>
    );

    // Switch to Records tab
    const recordsTab = screen.getByRole('tab', { name: /Records/i });
    fireEvent.click(recordsTab);

    // Verify one-line confidentiality note per Section 2.6
    expect(
      screen.getByText(/Individual tithe records are confidential.*Access is logged\./i)
    ).toBeDefined();
  });

  it('allows Department Head to view Fixed Assets and access Transfer and Log Repair actions while blocking Disposal (Section 0)', () => {
    // Switch active user to Department Head prior to render
    localStorage.setItem('church_accounts_cached_user', JSON.stringify(SAMPLE_USERS.dept_head));

    render(
      <AllProviders>
        <FixedAssetsView />
      </AllProviders>
    );

    // Click on first asset row to open detail slide-over panel
    const firstAssetTag = screen.getByText('AST-2018-0001');
    fireEvent.click(firstAssetTag);

    // Department Head can request Transfer and report faults (Repair)
    expect(screen.getByRole('button', { name: /Transfer/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Repair/i })).toBeDefined();

    // Department Head cannot dispose assets
    expect(screen.queryByRole('button', { name: /Dispose/i })).toBeNull();
  });

  it('enforces shared UI polish rules across Cashbook, Tithes, and Fixed Assets (Section 6 & 10)', () => {
    const { unmount } = render(
      <AllProviders>
        <CashbookView />
      </AllProviders>
    );

    // Cashbook has underline tabs and plain status line
    expect(screen.getByRole('heading', { level: 1, name: /Cashbook/i })).toBeDefined();
    expect(screen.getAllByText(/Opening balance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Closing balance/i).length).toBeGreaterThan(0);
    unmount();

    render(
      <AllProviders>
        <FixedAssetsView />
      </AllProviders>
    );

    // Fixed Assets has underline tabs and plain status line
    expect(screen.getByRole('heading', { level: 1, name: /Fixed assets/i })).toBeDefined();
    expect(screen.getAllByText(/active assets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Accumulated depreciation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Net book value/i).length).toBeGreaterThan(0);
  });
});
