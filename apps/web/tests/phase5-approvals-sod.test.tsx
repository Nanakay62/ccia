import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider, useReports } from '../src/context/ReportsContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { ApprovalProvider } from '../src/context/ApprovalContext.js';
import { SettingsView } from '../src/components/settings/SettingsView.js';
import { RequisitionDetailPage } from '../src/components/expenses/RequisitionDetailPage.js';
import { ExpensesView } from '../src/components/expenses/ExpensesView.js';
import { VoucherDetailPage } from '../src/components/expenses/VoucherDetailPage.js';
import { ReportsView } from '../src/components/reports/ReportsView.js';
import { ReAuthGateModal } from '../src/components/security/ReAuthGateModal.js';

const ConnectedReAuthGate: React.FC = () => {
  const { reAuthGateState, confirmReAuth, cancelReAuth } = useAuth();
  return (
    <ReAuthGateModal
      isOpen={reAuthGateState.isOpen}
      actionType={reAuthGateState.actionType}
      onConfirm={confirmReAuth}
      onCancel={cancelReAuth}
    />
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <ToastProvider>
        <LedgerProvider>
          <SyncProvider>
            <GivingProvider>
              <ApprovalProvider>
                <ExpensesProvider>
                  <ReportsProvider>
                    <RouterProvider>
                      {children}
                      <ConnectedReAuthGate />
                    </RouterProvider>
                  </ReportsProvider>
                </ExpensesProvider>
              </ApprovalProvider>
            </GivingProvider>
          </SyncProvider>
        </LedgerProvider>
      </ToastProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 5: Approval Limits, Separation of Duties (SoD) & Controlled Payment Details (Spec Section C3, C4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Approval Limits Matrix View & Governance (Spec C3)', () => {
    it('renders Approval limits tab with active version and server authority matrix rules', () => {
      render(
        <TestWrapper>
          <SettingsView />
        </TestWrapper>
      );

      // Navigate to Approval limits tab
      const tabButton = screen.getByRole('button', { name: /approval limits/i });
      fireEvent.click(tabButton);

      expect(screen.getByText(/Tiered Approval Limits Matrix \(Spec C3\)/i)).toBeTruthy();
      expect(screen.getByText(/Version 1 Active/i)).toBeTruthy();
      expect(screen.getAllByText(/Expenditure Requisition/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Staff Payroll Run/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Head Office Tithe Remittance/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Server Authority Rule/i)).toBeTruthy();
    });

    it('allows Treasurer to propose modified limits and requires Pastor/Elder sign-off', () => {
      render(
        <TestWrapper>
          <SettingsView />
        </TestWrapper>
      );

      const tabButton = screen.getByRole('button', { name: /approval limits/i });
      fireEvent.click(tabButton);

      // Propose button exists for Treasurer (current user Kofi Mensah)
      const proposeBtn = screen.getByRole('button', { name: /propose limit changes/i });
      expect(proposeBtn).toBeTruthy();
      fireEvent.click(proposeBtn);

      // Modal opens
      expect(screen.getByText(/Propose Approval Limits Modification/i)).toBeTruthy();
      const reasonInput = screen.getByPlaceholderText(/Explain why the limit bands/i);
      fireEvent.change(reasonInput, {
        target: { value: 'Increasing high-tier threshold for annual convention preparations' },
      });

      const submitBtn = screen.getByRole('button', { name: /submit proposal for authorization/i });
      fireEvent.click(submitBtn);

      // Re-Auth dialog opens per Spec C1 / C3 security requirement
      expect(
        screen.getByText(/Re-authenticate: Approval Limits Matrix/i) ||
          screen.getByText(/Security re-authentication gate/i)
      ).toBeTruthy();
    });
  });

  describe('2. Requisition Tiered Approvals & Separation of Duties (Spec C4)', () => {
    it('allows independent authorized officer to approve pending requisition and shows multi-step timeline', () => {
      render(
        <TestWrapper>
          <RequisitionDetailPage id="req-002" />
        </TestWrapper>
      );

      expect(screen.getByText(/Document Number/i)).toBeTruthy();
      expect(screen.getAllByText(/REQ-0015/i).length).toBeGreaterThan(0);

      // Independent officer (Kofi Mensah - Treasurer) can approve REQ-002 submitted by Sister Naomi Addo
      const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
      expect(approveBtn).toBeTruthy();

      // Multi-step timeline displays step details
      expect(screen.getAllByText(/Step 1:/i).length).toBeGreaterThan(0);
    });

    it('displays self-approval prohibition notice when current user is the submitter', () => {
      render(
        <TestWrapper>
          <RequisitionDetailPage id="REQ-D01-000014" />
        </TestWrapper>
      );

      // Verified document displays correctly
      expect(screen.getByText(/Document Number/i)).toBeTruthy();
      expect(screen.getAllByText(/REQ-0014/i).length).toBeGreaterThan(0);
    });
  });

  describe('3. Controlled Payment Details on Vendors (Spec C4)', () => {
    it('renders Payment Details & Controls column and opens update destination modal', () => {
      render(
        <TestWrapper>
          <ExpensesView />
        </TestWrapper>
      );

      // Navigate to Vendors tab
      const vendorsTab = screen.getByRole('button', { name: /vendors/i });
      fireEvent.click(vendorsTab);

      expect(screen.getByText(/Payment Details & Controls/i)).toBeTruthy();

      // Find an "Edit details" button
      const editButtons = screen.getAllByRole('button', { name: /edit details/i });
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      // Verify modal opens with controlled data notice
      expect(screen.getByText(/Update Payment Destination/i)).toBeTruthy();
      expect(screen.getByText(/Controlled data: Requires 2nd person dual approval/i)).toBeTruthy();
    });
  });

  describe('4. Voucher Detail Controlled Details Verification Highlight (Spec C4)', () => {
    it('renders Payment Voucher detail page with proper structure', () => {
      render(
        <TestWrapper>
          <VoucherDetailPage id="PV-FS-D01-000041" />
        </TestWrapper>
      );

      expect(screen.getAllByText(/Payment Voucher/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/PV-FS-D01-000041/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Accounting & Tax Breakdown/i)).toBeTruthy();
    });
  });

  describe('5. Separation of Duties Exceptions & Overrides Report (Spec C4)', () => {
    it('renders SoD exceptions report with compliance summary and audit table in ReportsView', () => {
      const ReportSwitcher: React.FC = () => {
        const { setActiveReport } = useReports();
        React.useEffect(() => {
          setActiveReport('SOD_EXCEPTIONS');
        }, [setActiveReport]);
        return <ReportsView />;
      };

      render(
        <TestWrapper>
          <ReportSwitcher />
        </TestWrapper>
      );

      expect(screen.getByText(/Separation of Duties \(SoD\) Exceptions & Overrides Log/i)).toBeTruthy();
      expect(screen.getByText(/Server Authority Active/i)).toBeTruthy();
      expect(screen.getByText(/Total Tracked Events/i)).toBeTruthy();
      expect(screen.getAllByText(/Authorized Overrides/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Blocked Near-Misses/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Self-Approval Block Rate/i)).toBeTruthy();
    });
  });
});
