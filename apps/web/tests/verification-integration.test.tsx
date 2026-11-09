import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FixedAssetsProvider } from '../src/context/FixedAssetsContext.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { FixedAssetsView } from '../src/components/assets/FixedAssetsView.js';

const renderVerificationModule = (initialTab: 'verification' = 'verification') => {
  return render(
    <AuthProvider>
      <DemoProvider>
        <ToastProvider>
          <LedgerProvider>
            <FixedAssetsProvider>
              <FixedAssetsView initialTab={initialTab} />
            </FixedAssetsProvider>
          </LedgerProvider>
        </ToastProvider>
      </DemoProvider>
    </AuthProvider>
  );
};

describe('Fixed Assets Physical Verification Integration (Phase 7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders verification tab with status summary line and seeded runs', () => {
    renderVerificationModule('verification');

    // Status summary line check
    expect(screen.getByText(/Total verifications/i)).toBeDefined();
    expect(screen.getAllByText(/In progress/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);

    // Seeded run VER-2026-001
    expect(screen.getByText('VER-2026-001')).toBeDefined();
    expect(screen.getByText(/Q3 2026 Physical Inventory - Main Auditorium & Stage/i)).toBeDefined();
  });

  it('can open New Verification Modal and start a scoped verification run', () => {
    renderVerificationModule('verification');

    // Click Start Verification toolbar button
    const startToolbarBtn = screen.getByRole('button', { name: /Start Verification/i });
    fireEvent.click(startToolbarBtn);

    // Modal appears
    expect(screen.getByText(/Start Physical Verification Run/i)).toBeDefined();

    // Fill title
    const titleInput = screen.getByPlaceholderText(/e\.g\. Q4 2026 Physical Inventory/i);
    fireEvent.change(titleInput, { target: { value: 'Q4 2026 Office Inventory' } });

    // Scope selection: By Location
    const scopeSelect = screen.getByDisplayValue(/By Physical Location/i);
    expect(scopeSelect).toBeDefined();

    // Submit form using the modal submit button
    const buttons = screen.getAllByRole('button', { name: /Start Verification/i });
    fireEvent.click(buttons[buttons.length - 1]!);

    // Modal closes and workspace modal opens for the new run
    expect(screen.getAllByText(/Q4 2026 Office Inventory/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/In Progress \(Active Scan\)/i)).toBeDefined();
  });

  it('can conduct physical checks: mark found, move, damage, and add unrecorded asset', () => {
    renderVerificationModule('verification');

    // Open existing run VER-2026-001
    const runRow = screen.getByText('VER-2026-001');
    fireEvent.click(runRow);

    // Verification workspace modal is displayed
    expect(screen.getByText(/VER-2026-001: Q3 2026 Physical Inventory - Main Auditorium & Stage/i)).toBeDefined();
    expect(screen.getByText(/Dual Signed by/i)).toBeDefined();

    // Switch to Print Report mode
    const printBtn = screen.getByRole('button', { name: /Print Report/i });
    fireEvent.click(printBtn);

    // Official Report appears
    expect(screen.getByText(/FIXED ASSET PHYSICAL VERIFICATION REPORT/i)).toBeDefined();
    expect(screen.getByText(/PHYSICAL VERIFICATION DISCREPANCY SUMMARY/i)).toBeDefined();
    expect(screen.getByText(/CHURCH BOARD RESOLUTION:/i)).toBeDefined();

    // Back to workspace
    const backBtn = screen.getByRole('button', { name: /Back to Workspace/i });
    fireEvent.click(backBtn);
    expect(screen.getAllByText(/VER-2026-001/i).length).toBeGreaterThan(0);
  });

  it('enforces dual sign-off rule to finalize verification run', () => {
    renderVerificationModule('verification');

    // Start a new verification run
    fireEvent.click(screen.getByRole('button', { name: /Start Verification/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Q4 2026 Physical Inventory/i), {
      target: { value: 'Media Room Inspection 2026' },
    });
    const buttons = screen.getAllByRole('button', { name: /Start Verification/i });
    fireEvent.click(buttons[buttons.length - 1]!);

    // In the workspace, click Dual Sign-off & Finalize
    const finalizeBtn = screen.getByRole('button', { name: /Dual Sign-off & Finalize/i });
    fireEvent.click(finalizeBtn);

    // Sign-off dialog
    expect(screen.getByText(/Dual Sign-off & Verification Completion/i)).toBeDefined();
    expect(screen.getByText(/1\. Physical Verifier/i)).toBeDefined();
    expect(screen.getByText(/2\. Authorizing Officer/i)).toBeDefined();

    // Check complete button
    const completeBtn = screen.getByRole('button', { name: /Complete Verification/i });
    fireEvent.click(completeBtn);

    // Run is marked as Completed
    expect(screen.getByText(/Completed & Signed/i)).toBeDefined();
  });
});
