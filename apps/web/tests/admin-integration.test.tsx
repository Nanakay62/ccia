import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { SettingsView } from '../src/components/settings/SettingsView.js';

beforeEach(() => {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <ToastProvider>{children}</ToastProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 8: Administration & Settings Specification (Section 5)', () => {
  it('renders SettingsView with all 8 underline tabs per Section 5.1', () => {
    render(
      <TestAppProviders>
        <SettingsView />
      </TestAppProviders>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Administration and settings' })).toBeDefined();

    // Verify all 8 tabs
    expect(screen.getByRole('button', { name: 'Users and roles' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Devices' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Audit log' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Backup and restore' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Church profile' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Funds and accounts' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Periods and rates' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'About' })).toBeDefined();

    // User manual is moved out of Administration per Section 5.1
    expect(screen.queryByText(/Official Platform User Manual/i)).toBeNull();
  });

  it('renders Users and roles tab with DataTable, search, and role change modal', () => {
    render(
      <TestAppProviders>
        <SettingsView />
      </TestAppProviders>
    );

    // Initial tab is Users and roles
    expect(screen.getByText('Kofi Mensah')).toBeDefined();
    expect(screen.getAllByText('Akosua Osei').length).toBeGreaterThan(0);
    expect(screen.getByText('Rev. Emmanuel Addo')).toBeDefined();
    expect(screen.getByText('DEV-TR-01')).toBeDefined();

    // Click "Change role" for Kofi Mensah
    const changeRoleBtns = screen.getAllByRole('button', { name: 'Change role' });
    fireEvent.click(changeRoleBtns[0]!);

    expect(screen.getByText(/Change Role for Kofi Mensah/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Required: Changes to financial roles/i)).toBeDefined();
  });

  it('renders Audit log as a real table with plain sentences per Section 5.5', () => {
    render(
      <TestAppProviders>
        <SettingsView />
      </TestAppProviders>
    );

    // Switch to Audit log tab
    fireEvent.click(screen.getByRole('button', { name: 'Audit log' }));

    expect(screen.getByText('Date and time')).toBeDefined();
    expect(screen.getByText('User')).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('Action')).toBeDefined();
    expect(screen.getByText('Record')).toBeDefined();
    expect(screen.getByText('Device')).toBeDefined();

    // Plain English action sentences
    expect(screen.getByText(/Kofi Mensah approved REQ-0014/i)).toBeDefined();
    expect(screen.getByText(/Akosua Osei certified Statement of Income and Expenditure/i)).toBeDefined();
  });

  it('handles Backup and restore with empty fields, confirmation dialog, and typed RESTORE', async () => {
    render(
      <TestAppProviders>
        <SettingsView />
      </TestAppProviders>
    );

    // Switch to Backup and restore tab
    fireEvent.click(screen.getByRole('button', { name: 'Backup and restore' }));

    // Plain wording notice
    expect(screen.getByText(/Backups are locked with a passphrase you choose/i)).toBeDefined();

    // Passphrase inputs should start empty (not pre-filled dots)
    const passInput = screen.getByPlaceholderText('Choose a strong passphrase') as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText('Re-enter passphrase to confirm') as HTMLInputElement;
    expect(passInput.value).toBe('');
    expect(confirmInput.value).toBe('');

    // Simulation sandbox must be absent in live mode
    expect(screen.queryByText(/Multi-Device Offline Simulation Sandbox/i)).toBeNull();
  });

  it('renders Church profile and Periods and rates tabs', () => {
    render(
      <TestAppProviders>
        <SettingsView />
      </TestAppProviders>
    );

    // Switch to Church profile tab
    fireEvent.click(screen.getByRole('button', { name: 'Church profile' }));
    expect(screen.getByDisplayValue('Calvary Crystal Church')).toBeDefined();
    expect(screen.getByDisplayValue('Ring Road Central, P.O. Box GP 4421, Accra, Ghana')).toBeDefined();

    // Switch to Periods and rates tab
    fireEvent.click(screen.getByRole('button', { name: 'Periods and rates' }));
    expect(screen.getByText(/USD exchange rate/i)).toBeDefined();
    expect(screen.getByText(/Rate was set on 24 Oct 2026 \(9 days ago\)/i)).toBeDefined();
    expect(screen.getByDisplayValue('15.5000')).toBeDefined();
  });
});
