import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { CashbookProvider } from '../src/context/CashbookContext.js';
import { TithesProvider } from '../src/context/TithesContext.js';
import { TithesView } from '../src/components/tithes/TithesView.js';
import { TitheBatchDetailPage } from '../src/components/tithes/TitheBatchDetailPage.js';
import { TitheRecordDetailPage } from '../src/components/tithes/TitheRecordDetailPage.js';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('church_demo_mode', 'true');
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <ExpensesProvider>
              <CashbookProvider>
                <TithesProvider>
                  <ToastProvider>{children}</ToastProvider>
                </TithesProvider>
              </CashbookProvider>
            </ExpensesProvider>
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Tithes Module Integration & Specification Compliance', () => {
  it('renders TithesView with underline tabs and monthly status line', () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Tithes' })).toBeDefined();

    // Verify top underline tabs
    expect(screen.getByRole('tab', { name: 'Batches' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Records' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Remittance' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Reports' })).toBeDefined();

    // Verify October status line (3 of 4 services reconciled)
    expect(screen.getByText(/October 2026: 3 of 4 services reconciled/i)).toBeDefined();
  });

  it('displays the unreconciled batch with 350.00 GHS difference as required by demo spec', () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    // Look for 25 Oct 2026 batch
    expect(screen.getByText(/25 Oct 2026/i)).toBeDefined();

    // Check unallocated amounts are visible
    const unallocatedMatches = screen.getAllByText('350.00');
    expect(unallocatedMatches.length).toBeGreaterThan(0);
  });

  it('opens Fast Entry grid page when viewing a tithe batch', async () => {
    render(
      <TestAppProviders>
        <TitheBatchDetailPage id="tb-2026-10-04" />
      </TestAppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText(/Counting Sheet: CS-2026-W40/i)).toBeDefined();
    });

    // Check sticky reconciliation header exists
    expect(screen.getAllByText(/Counted/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Allocated/i).length).toBeGreaterThan(0);
  });

  it('navigates to Records tab and displays confidential warning banner with records', async () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    const recordsTab = screen.getByRole('tab', { name: 'Records' });
    fireEvent.click(recordsTab);

    // Check confidential warning line
    expect(screen.getByText(/Individual tithe records are confidential under church governance/i)).toBeDefined();

    // Check records exist for prominent members
    expect(screen.getAllByText('Elder Kofi Mensah').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sister Akua Mansa').length).toBeGreaterThan(0);
  });

  it('shows YTD consistency and months paid on tithe record detail page', async () => {
    render(
      <TestAppProviders>
        <TitheRecordDetailPage id="rec-001" />
      </TestAppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText(/YTD Total Tithes/i)).toBeDefined();
      expect(screen.getByText(/Giving Consistency/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Annual Statement/i })).toBeDefined();
    });
  });

  it('allows opening Direct Tithe modal to record a non-service MoMo / Bank tithe', async () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    const recordsTab = screen.getByRole('tab', { name: 'Records' });
    fireEvent.click(recordsTab);

    const directTitheBtn = screen.getByRole('button', { name: /Record Direct Tithe/i });
    fireEvent.click(directTitheBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Record direct tithe' })).toBeDefined();
      expect(screen.getByText(/Cr Tithes/i)).toBeDefined();
    });
  });

  it('displays anonymous participation metrics and distribution bands under Reports', async () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    const reportsTab = screen.getByRole('tab', { name: 'Reports' });
    fireEvent.click(reportsTab);

    // Verify statistical counts and demographic bands
    expect(screen.getByText(/Active Congregation:/i)).toBeDefined();
    expect(screen.getByText(/Contributing Givers:/i)).toBeDefined();
    expect(screen.getByText(/Average Tithe:/i)).toBeDefined();
    expect(screen.getByText(/Median Tithe:/i)).toBeDefined();
    expect(screen.getByText(/Giving Band/i)).toBeDefined();
    expect(screen.getByText(/Under 50 GHS/i)).toBeDefined();
    expect(screen.getByText(/50 to 199 GHS/i)).toBeDefined();
    expect(screen.getByText(/200 GHS and over/i)).toBeDefined();
  });

  it('shows Remittance tab with October 2026 accrued liability to District HQ', async () => {
    render(
      <TestAppProviders>
        <TithesView />
      </TestAppProviders>
    );

    const remittanceTab = screen.getByRole('tab', { name: 'Remittance' });
    fireEvent.click(remittanceTab);

    expect(screen.getByText(/Active Rule: District Headquarters Remittance/i)).toBeDefined();
    expect(screen.getByText(/Monthly Denominational Remittance Schedule/i)).toBeDefined();
    expect(screen.getByText(/10 Nov 2026/i)).toBeDefined();
  });
});
