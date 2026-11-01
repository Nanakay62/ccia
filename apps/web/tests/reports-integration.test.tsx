/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { ReportsView } from '../src/components/reports/ReportsView.js';
import { DashboardOverview } from '../src/components/dashboard/DashboardOverview.js';

// Mock window.URL.createObjectURL and HTMLAnchorElement.prototype.click
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
          <GivingProvider>
            <ExpensesProvider>
              <ReportsProvider>{children}</ReportsProvider>
            </ExpensesProvider>
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 6: Financial Reports & Statements UI', () => {
  it('renders ReportsView and displays Statement of Income and Expenditure', () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    expect(screen.getByText('Church Financial Statements & Reports')).toBeDefined();
    expect(screen.getByText('Statement of Income and Expenditure')).toBeDefined();
    expect(screen.getByText('Accra Central Grace Chapel')).toBeDefined();
    expect(screen.getByText('Total Revenue Inflows')).toBeDefined();
    expect(screen.getByText('Total Expenditures')).toBeDefined();
    expect(screen.getByText('Net Operating Surplus / (Deficit)')).toBeDefined();
  });

  it('navigates to Balance Sheet and shows Assets and Fund Balances', () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    const balSheetTab = screen.getByRole('button', { name: /Balance Sheet/i });
    fireEvent.click(balSheetTab);

    expect(screen.getByText(/Statement of Financial Position \(Balance Sheet\)/i)).toBeDefined();
    expect(screen.getByText('Total Assets')).toBeDefined();
    expect(screen.getByText('Total Liabilities & Fund Balances')).toBeDefined();
    expect(screen.getByText(/Current & Fixed Assets/i)).toBeDefined();
  });

  it('navigates to Fund Balances and verifies Restricted vs Unrestricted breakdown', () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    const fundBalTab = screen.getByRole('button', { name: /Fund Balances/i });
    fireEvent.click(fundBalTab);

    expect(screen.getByText(/Fund Balance Report \(Restricted vs\. Unrestricted\)/i)).toBeDefined();
    expect(screen.getAllByText(/General Fund/i)[0]).toBeDefined();
    expect(screen.getAllByText(/Building Fund/i)[0]).toBeDefined();
  });

  it('navigates to Budget vs Actual and displays variance comparisons', () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    const budgetTab = screen.getByRole('button', { name: /Budget vs\. Actual/i });
    fireEvent.click(budgetTab);

    expect(screen.getByText(/Departmental Budget vs\. Actual Expenditure/i)).toBeDefined();
    expect(screen.getByText('Annual Budget')).toBeDefined();
    expect(screen.getByText('Actual To Date')).toBeDefined();
    expect(screen.getAllByText(/FAVOURABLE/i).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles currency to USD Summary and renders denominational disclosure footnote', () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    const usdToggle = screen.getByRole('button', { name: 'USD Summary' });
    fireEvent.click(usdToggle);

    expect(screen.getByText(/USD Reporting View:/i)).toBeDefined();
    expect(screen.getByText(/Month-End Closing Rate/i)).toBeDefined();

    // Switch to USD Summary tab
    const usdReportTab = screen.getByRole('button', { name: /USD Summary Report/i });
    fireEvent.click(usdReportTab);

    expect(screen.getByText(/Denominational Financial Summary \(USD Translation\)/i)).toBeDefined();
    expect(screen.getByText(/USD Total Revenue/i)).toBeDefined();
    expect(screen.getByText(/denominational reporting purposes only/i)).toBeDefined();
  });

  it('triggers offline export buttons (PDF, Excel, CSV) without errors', async () => {
    render(
      <TestAppProviders>
        <ReportsView />
      </TestAppProviders>
    );

    const pdfBtn = screen.getByRole('button', { name: /Export PDF/i });
    const excelBtn = screen.getByRole('button', { name: /Export Excel/i });
    const csvBtn = screen.getByRole('button', { name: 'CSV' });

    // Click CSV
    fireEvent.click(csvBtn);
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Click Excel
    fireEvent.click(excelBtn);

    // Click PDF
    fireEvent.click(pdfBtn);

    await waitFor(() => {
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});

describe('Phase 6: Executive Dashboard Component', () => {
  it('renders DashboardOverview with KPIs, Fund Allocation Bar, and quick action buttons', () => {
    const handleNavigate = vi.fn();
    render(
      <TestAppProviders>
        <DashboardOverview onNavigate={handleNavigate} />
      </TestAppProviders>
    );

    expect(screen.getByText('Financial Administration Dashboard')).toBeDefined();
    expect(screen.getByText('Total Giving & Income')).toBeDefined();
    expect(screen.getByText('Liquid Cash & Bank')).toBeDefined();
    expect(screen.getByText('Fund Integrity & Restricted Capital Protection')).toBeDefined();

    const countingBtn = screen.getByRole('heading', { name: 'Counting Sheet' });
    fireEvent.click(countingBtn);
    expect(handleNavigate).toHaveBeenCalledWith('counting');
  });
});
