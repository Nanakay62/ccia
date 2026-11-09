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
import { YearEndClosePage } from '../src/components/yearend/YearEndClosePage.js';
import { AnnualGivingStatementsPage } from '../src/components/yearend/AnnualGivingStatementsPage.js';
import { MemberDataRequestPage } from '../src/components/security/MemberDataRequestPage.js';
import { ItSecurityChecklistPage } from '../src/components/security/ItSecurityChecklistPage.js';
import { VersionGateBanner } from '../src/components/sync/VersionGateBanner.js';
import { NotificationCentrePopover } from '../src/components/ui/NotificationCentrePopover.js';

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

describe('Phase 7: Year-End Close, Member Privacy & Offline Version Control', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. renders Year-End Close workspace with pre-closing checklist and stages', async () => {
    render(
      <TestWrapper>
        <YearEndClosePage />
      </TestWrapper>
    );

    expect(screen.getByText(/Year-End Close & Financial Pack/i)).toBeDefined();
    expect(screen.getByText(/1. Year-End Checklist/i)).toBeDefined();
    expect(screen.getByText(/2. Fund Closing Preview/i)).toBeDefined();
    expect(screen.getByText(/3. Closing & Approvals/i)).toBeDefined();
    expect(screen.getByText(/4. Issued Year-End Pack/i)).toBeDefined();

    // Check that blocking items are listed
    expect(screen.getByText(/All 12 monthly periods closed/i)).toBeDefined();
    expect(screen.getByText(/General ledger trial balance balanced/i)).toBeDefined();
  });

  it('2. navigates to Fund Closing Preview and verifies fund segregation', async () => {
    render(
      <TestWrapper>
        <YearEndClosePage />
      </TestWrapper>
    );

    const previewTab = screen.getByRole('button', { name: /2. Fund Closing Preview/i });
    fireEvent.click(previewTab);

    expect(screen.getByText(/Fund Closing Balances Preview \(No Postings\)/i)).toBeDefined();
    expect(screen.getByText(/General Fund/i)).toBeDefined();
    expect(screen.getByText(/Net Surplus \/ \(Deficit\)/i)).toBeDefined();
  });

  it('3. renders Accruals and Prepayments modal and posts an adjusting entry', async () => {
    render(
      <TestWrapper>
        <YearEndClosePage />
      </TestWrapper>
    );

    const accrualBtn = screen.getByRole('button', { name: /Accruals & prepayments/i });
    fireEvent.click(accrualBtn);

    expect(screen.getByText(/Post Year-End Accrual or Prepayment/i)).toBeDefined();
    const descInput = screen.getByPlaceholderText(/e.g. Accrued December 2026 security/i);
    const amountInput = screen.getByPlaceholderText(/0.00/i);

    fireEvent.change(descInput, { target: { value: 'Accrued Electricity' } });
    fireEvent.change(amountInput, { target: { value: '450.00' } });

    const submitBtn = screen.getByRole('button', { name: /Post Accrual & Schedule Auto-Reversal/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Post Year-End Accrual or Prepayment/i)).toBeNull();
    });
  });

  it('4. renders Annual Giving Statements batch generator with zero-giving skipped', async () => {
    render(
      <TestWrapper>
        <AnnualGivingStatementsPage />
      </TestWrapper>
    );

    expect(screen.getByText(/Annual Member Giving Statements/i)).toBeDefined();
    expect(screen.getAllByText(/Contributing Members/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Total Statement Giving/i)).toBeDefined();

    const generateBtn = screen.getByRole('button', { name: /Generate Batch/i });
    expect(generateBtn).toBeDefined();
  });

  it('5. renders Member Data Request page and provides data dossier export', async () => {
    render(
      <TestWrapper>
        <MemberDataRequestPage />
      </TestWrapper>
    );

    expect(screen.getByText(/Member Data Requests & Privacy/i)).toBeDefined();
    expect(screen.getByText(/Statutory Confidential Access Log/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Export Full Dossier/i })).toBeDefined();
  });

  it('6. opens Anonymise Former Member modal with accounting invariant guarantee', async () => {
    render(
      <TestWrapper>
        <MemberDataRequestPage />
      </TestWrapper>
    );

    const anonBtn = screen.getByRole('button', { name: /Anonymise Record/i });
    fireEvent.click(anonBtn);

    expect(screen.getByText(/Anonymise Former Member Records/i)).toBeDefined();
    expect(screen.getByText(/Accounting Invariant Guarantee/i)).toBeDefined();
    expect(screen.getByText(/100% intact and untouched/i)).toBeDefined();
  });

  it('7. renders IT Security Checklist with role-by-role MFA adoption', async () => {
    render(
      <TestWrapper>
        <ItSecurityChecklistPage />
      </TestWrapper>
    );

    expect(screen.getByText(/IT Officer Security Checklist/i)).toBeDefined();
    expect(screen.getByText(/Role-by-Role Two-Step Verification \(MFA\) Status/i)).toBeDefined();
    expect(screen.getAllByText(/Treasurer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pastor \/ Elder/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Enrolled Devices & Version Gate/i)).toBeDefined();
  });

  it('8. renders Notification Centre Popover with security alerts', async () => {
    render(
      <TestWrapper>
        <NotificationCentrePopover />
      </TestWrapper>
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText(/Notification Centre/i)).toBeDefined();
  });

  it('9. renders Version Gate Banner and blocks posting when client is outdated', async () => {
    render(
      <VersionGateBanner
        clientAppVersion="0.8.0"
        clientSchemaVersion={1}
        serverPolicy={{
          minSupportedAppVersion: '1.0.0',
          minSupportedSchemaVersion: 1,
          latestAppVersion: '1.1.0',
        }}
      />
    );

    expect(screen.getByText(/Posting Disabled:/i)).toBeDefined();
    expect(screen.getByText(/This app needs an update/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Update Now/i })).toBeDefined();
  });
});
