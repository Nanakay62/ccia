/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { PayrollProvider } from '../src/context/PayrollContext.js';
import { CashbookProvider } from '../src/context/CashbookContext.js';
import { TithesProvider } from '../src/context/TithesContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { TithesView } from '../src/components/tithes/TithesView.js';
import { TodayPanel } from '../src/components/ui/TodayPanel.js';

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <ExpensesProvider>
              <ReportsProvider>
                <BudgetProvider>
                  <PayrollProvider>
                    <CashbookProvider>
                      <TithesProvider>
                        <ToastProvider>{children}</ToastProvider>
                      </TithesProvider>
                    </CashbookProvider>
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

describe('Phase 4: Tithe Remittance Specification Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('church_demo_mode', 'true');
  });

  it('Section 2.4: displays Remittance tab with active rule policy line and monthly schedule', async () => {
    render(
      <TestAppProviders>
        <TithesView initialTab="remittance" />
      </TestAppProviders>
    );

    // Verify Active Rule Policy line (Rule A3)
    expect(
      screen.getByText(/Active Rule: District Headquarters Remittance/i)
    ).toBeDefined();
    expect(screen.getByText(/Due: 10th of following month/i)).toBeDefined();
    expect(screen.getByText(/Payee: Accra District Office/i)).toBeDefined();

    // Verify schedule table headers and periods
    expect(
      screen.getByText(/Monthly Denominational Remittance Schedule/i)
    ).toBeDefined();
    expect(screen.getByText(/August 2026/i)).toBeDefined();
    expect(screen.getByText(/September 2026/i)).toBeDefined();
    expect(screen.getByText(/October 2026/i)).toBeDefined();

    // Verify October 2026 accrued state
    expect(screen.getAllByText(/10 Nov 2026/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Accrued/i).length).toBeGreaterThan(0);
  });

  it('Section 2.4: allows Treasurer to open Rule Configuration modal', async () => {
    render(
      <TestAppProviders>
        <TithesView initialTab="remittance" />
      </TestAppProviders>
    );

    const configureBtn = screen.getByRole('button', { name: /Configure Rule/i });
    fireEvent.click(configureBtn);

    // Modal opens
    expect(screen.getByText(/Edit Remittance Rule/i)).toBeDefined();
    expect(
      screen.getByText(/Denominational tithe assessment policy \(Treasurer only\)/i)
    ).toBeDefined();
    expect(screen.getByDisplayValue(/District Headquarters Remittance/i)).toBeDefined();
    expect(screen.getByDisplayValue(/Accra District Office/i)).toBeDefined();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
  });

  it('Section 2.4: opens Pay Remittance modal and dispatches payment voucher through cashbook', async () => {
    render(
      <TestAppProviders>
        <TithesView initialTab="remittance" />
      </TestAppProviders>
    );

    // Find "Pay via Voucher" button for October 2026
    const payBtn = screen.getByRole('button', { name: /Pay via Voucher/i });
    fireEvent.click(payBtn);

    // Modal opens
    expect(screen.getByText(/Pay Denominational Remittance · 2026-10/i)).toBeDefined();
    expect(screen.getByText(/Bank Account \(GHS\)/i)).toBeDefined();

    // Click "Disburse Payment & Record Voucher"
    const disburseBtn = screen.getByRole('button', {
      name: /Disburse Payment & Record Voucher/i,
    });
    fireEvent.click(disburseBtn);

    // Toast notification and update in schedule table
    await waitFor(() => {
      expect(screen.getAllByText(/Paid/i).length).toBeGreaterThan(0);
    });
  });

  it('Section 2.4: opens Printable Denominational Remittance Statement with letterhead and dual signatures', async () => {
    render(
      <TestAppProviders>
        <TithesView initialTab="remittance" />
      </TestAppProviders>
    );

    const statementBtns = screen.getAllByRole('button', { name: /Statement/i });
    fireEvent.click(statementBtns[0]!); // First row statement

    // Modal opens
    expect(
      screen.getAllByText(/Denominational Tithe Remittance Statement/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/1\. Gross Tithes Collections Breakdown/i)
    ).toBeDefined();
    expect(
      screen.getByText(/2\. Assessment Calculation & Accrual/i)
    ).toBeDefined();
    expect(
      screen.getByText(/3\. Remittance Payments & Disbursements/i)
    ).toBeDefined();

    // Verify dual signature roles
    expect(screen.getByText(/Treasurer \/ Finance Secretary/i)).toBeDefined();
    expect(screen.getByText(/Head Pastor \/ Senior Elder/i)).toBeDefined();

    // Verify Print button
    expect(screen.getByRole('button', { name: /Print Statement/i })).toBeDefined();
  });

  it('Section 2.4: renders Remittance reminder in Today panel when payment is due', () => {
    const handleNavigate = vi.fn();

    render(
      <TodayPanel
        remittanceAlert={{
          period: '2026-10',
          amountGhs: 2490,
          dueDate: '10 Nov 2026',
          isOverdue: false,
          payee: 'Accra District Office',
        }}
        onNavigateToRemittance={handleNavigate}
      />
    );

    // Verify section header and details
    expect(screen.getByText(/Denominational remittance/i)).toBeDefined();
    expect(screen.getByText(/Due 10 Nov 2026/i)).toBeDefined();
    expect(screen.getByText(/2026-10 assessment \(Accra District Office\)/i)).toBeDefined();
    expect(screen.getByText(/GHS 2,490\.00/i)).toBeDefined();

    // Click navigation action
    const actionLink = screen.getByRole('button', {
      name: /Review and pay remittance →/i,
    });
    fireEvent.click(actionLink);
    expect(handleNavigate).toHaveBeenCalledTimes(1);
  });
});
