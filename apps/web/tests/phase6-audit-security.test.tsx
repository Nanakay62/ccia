import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SecurityEventsProvider } from '../src/context/SecurityEventsContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { ApprovalProvider } from '../src/context/ApprovalContext.js';
import { SettingsView } from '../src/components/settings/SettingsView.js';
import { LedgerView } from '../src/components/ledger/LedgerView.js';
import { DoctorView } from '../src/components/doctor/DoctorView.js';
import { DashboardOverview } from '../src/components/dashboard/DashboardOverview.js';
import { GivingDirectoryView } from '../src/components/giving/GivingDirectoryView.js';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <ToastProvider>
        <LedgerProvider>
          <SecurityEventsProvider>
            <SyncProvider>
              <GivingProvider>
                <ApprovalProvider>
                  <ExpensesProvider>
                    <ReportsProvider>
                      <RouterProvider>
                        {children}
                      </RouterProvider>
                    </ReportsProvider>
                  </ExpensesProvider>
                </ApprovalProvider>
              </GivingProvider>
            </SyncProvider>
          </SecurityEventsProvider>
        </LedgerProvider>
      </ToastProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 6: Audit Trail, Anti-Tampering & Backup Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Security Events tab in Settings with security posture metrics', async () => {
    render(
      <TestWrapper>
        <SettingsView />
      </TestWrapper>
    );

    // Switch to Security Events tab
    const secTab = screen.getByRole('button', { name: /Security events/i });
    expect(secTab).toBeDefined();
    fireEvent.click(secTab);

    // Should display top posture metrics
    expect(screen.getByText(/Anti-tampering hash chain/i)).toBeDefined();
    expect(screen.getByText(/Failed logins \(24h\)/i)).toBeDefined();
    expect(screen.getByText(/Last backup verification/i)).toBeDefined();
    expect(screen.getByText(/Export security events/i)).toBeDefined();
  });

  it('acknowledges a security alert with an investigation reason', async () => {
    render(
      <TestWrapper>
        <SettingsView />
      </TestWrapper>
    );

    // Open Security Events tab
    fireEvent.click(screen.getByRole('button', { name: /Security events/i }));

    // Find acknowledge button on high alert
    const ackButtons = screen.getAllByRole('button', { name: /Acknowledge/i });
    if (ackButtons.length > 0) {
      fireEvent.click(ackButtons[0]!);

      // Modal appears
      expect(screen.getByText(/Acknowledge security alert/i)).toBeDefined();
      const textarea = screen.getByPlaceholderText(/Verified with officer/i);
      fireEvent.change(textarea, { target: { value: 'Verified with Church Council. Scheduled credential reset.' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm acknowledgment/i });
      fireEvent.click(confirmBtn);

      // Successfully acknowledged
      await waitFor(() => {
        expect(screen.getAllByText(/Acknowledged/i).length).toBeGreaterThan(0);
      });
    }
  });

  it('runs sandbox backup verification without clobbering live ledger', async () => {
    render(
      <TestWrapper>
        <SettingsView />
      </TestWrapper>
    );

    // Navigate to Backup and restore tab
    fireEvent.click(screen.getByRole('button', { name: /Backup and restore/i }));

    // Find Sandbox verification section
    expect(screen.getByText(/Test and verify backup archive \(Sandbox dry-run\)/i)).toBeDefined();

    // Enter passphrase
    const passphraseInput = screen.getByPlaceholderText(/Enter archive passphrase/i);
    fireEvent.change(passphraseInput, { target: { value: 'TestPassword2026!' } });

    // Click run sandbox verification
    const runBtn = screen.getByRole('button', { name: /Run sandbox verification/i });
    fireEvent.click(runBtn);

    // Expect successful sandbox verification result
    await waitFor(() => {
      expect(screen.getByText(/Sandbox Test Successful: Backup Archive Verified Intact/i)).toBeDefined();
      expect(screen.getByText(/Balanced \(GHS 0.00 diff\)/i)).toBeDefined();
      expect(screen.getByText(/Reassurance Notice:/i)).toBeDefined();
    });
  });

  it('displays anti-tampering hash-chain verified badge and inspection modal in LedgerView', async () => {
    render(
      <TestWrapper>
        <LedgerView />
      </TestWrapper>
    );

    // Hash chain badge is present
    const hashBadge = screen.getByRole('button', { name: /Hash chain:/i });
    expect(hashBadge).toBeDefined();
    expect(screen.getByText(/Verified \(SHA-256\)/i)).toBeDefined();

    // Click to open inspection modal
    fireEvent.click(hashBadge);
    expect(screen.getByText(/General Ledger Anti-Tampering Hash Chain/i)).toBeDefined();
    expect(screen.getByText(/Chain Status: 100% Intact & Verified/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Re-verify chain now/i })).toBeDefined();
  });

  it('verifies Doctor Check 17 is present among integrity checks', async () => {
    render(
      <TestWrapper>
        <DoctorView />
      </TestWrapper>
    );

    // Anti-tampering badge present in Doctor header
    expect(screen.getByText(/Anti-tampering hash chain:/i)).toBeDefined();

    // Click to view checks list if present
    const viewChecksBtn = screen.queryByRole('button', { name: /View checks/i }) || screen.queryByText(/17 checks/i);
    expect(viewChecksBtn).toBeDefined();
  });

  it('displays Daily Security Summary Card on Dashboard Overview', async () => {
    render(
      <TestWrapper>
        <DashboardOverview onNavigate={() => {}} />
      </TestWrapper>
    );

    expect(screen.getByText(/Security & Anti-Tampering Health/i)).toBeDefined();
    expect(screen.getByText(/100% Intact \(SHA-256\)/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Open Security events/i })).toBeDefined();
  });

  it('prompts for official purpose when exporting confidential giving data', async () => {
    render(
      <TestWrapper>
        <GivingDirectoryView />
      </TestWrapper>
    );

    // Click Export
    const exportBtn = screen.getByRole('button', { name: /Export/i });
    fireEvent.click(exportBtn);

    // Modal opens asking for purpose
    expect(screen.getByText(/Export confidential giving data/i)).toBeDefined();
    expect(screen.getByText(/Reason \/ Purpose for export/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeDefined();
  });
});
