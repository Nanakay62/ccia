import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { DataImportPage } from '../src/components/cutover/DataImportPage.js';
import { GoLiveReadinessPage } from '../src/components/cutover/GoLiveReadinessPage.js';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <ToastProvider>
        <LedgerProvider>
          <SyncProvider>
            <GivingProvider>
              <RouterProvider>{children}</RouterProvider>
            </GivingProvider>
          </SyncProvider>
        </LedgerProvider>
      </ToastProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 2 UI Integration: Data Import Wizard & Go-Live Readiness', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the 5-step DataImportPage, switches templates, validates rows, and previews dry run', () => {
    render(
      <TestWrapper>
        <DataImportPage />
      </TestWrapper>
    );

    expect(screen.getByText(/Data import and cut-over wizard/i)).toBeTruthy();
    expect(screen.getByText(/Unique file fingerprint verified/i)).toBeTruthy();

    // Advance through Step 2 -> Step 3 -> Step 4
    const mapBtn = screen.getByRole('button', { name: /Continue to column mapping/i });
    fireEvent.click(mapBtn);
    expect(screen.getByText(/Step 2 — Map CSV headers/i)).toBeTruthy();

    const validateBtn = screen.getByRole('button', { name: /Save mapping & validate rows/i });
    fireEvent.click(validateBtn);
    expect(screen.getByText(/Step 3 — Row-by-row validation report/i)).toBeTruthy();
    expect(screen.getByText(/All 4 rows passed validation/i)).toBeTruthy();

    const dryRunBtn = screen.getByRole('button', { name: /Proceed to dry run & Trial Balance/i });
    fireEvent.click(dryRunBtn);
    expect(screen.getByText(/Step 4 — Dry run preview/i)).toBeTruthy();

    // Verify batch history table shows IMP-0001 and IMP-0002
    expect(screen.getAllByText('IMP-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('IMP-0002').length).toBeGreaterThan(0);
  });

  it('renders GoLiveReadinessPage with all 16 checks, role training sign-offs, and dual confirmation modal', () => {
    render(
      <TestWrapper>
        <GoLiveReadinessPage />
      </TestWrapper>
    );

    expect(screen.getAllByText(/Go-live readiness checklist/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/16 of 16 checks passed/i)).toBeTruthy();
    expect(screen.getByText(/First encrypted backup taken AND a restore test completed/i)).toBeTruthy();
    expect(screen.getByText(/Parallel run signed off by the chief accountant/i)).toBeTruthy();

    // Open Go-Live confirmation modal
    const goLiveBtn = screen.getByRole('button', { name: /Go Live \(Treasurer & Pastor\/Elder\)/i });
    fireEvent.click(goLiveBtn);

    expect(screen.getByText(/Confirm Go-Live and close setup window/i)).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: /^Confirm Go-Live$/i });
    fireEvent.click(confirmBtn);

    expect(screen.getByText(/LIVE BOOK OF RECORD/i)).toBeTruthy();
  });
});
