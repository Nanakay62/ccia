import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ExpensesView } from '../src/components/expenses/ExpensesView.js';
import { RequisitionDetailPage } from '../src/components/expenses/RequisitionDetailPage.js';
import { ToastProvider } from '../src/context/ToastContext.js';

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <ExpensesProvider>
              <ToastProvider>{children}</ToastProvider>
            </ExpensesProvider>
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 5: Requisitions & Pastoral Approval Workflow', () => {
  it('renders requisitions, displays status badges, and approves pending requisition', async () => {
    const { unmount } = render(
      <TestAppProviders>
        <ExpensesView />
      </TestAppProviders>
    );

    expect(screen.getByText(/Expenditure Requisitions/i)).toBeDefined();
    expect(screen.getByText('REQ-0014')).toBeDefined();
    expect(screen.getByText('REQ-0015')).toBeDefined();
    unmount();

    // Default user is Treasurer -> has approval power on RequisitionDetailPage
    render(
      <TestAppProviders>
        <RequisitionDetailPage id="req-002" />
      </TestAppProviders>
    );

    const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    const confirmBtn = screen.getByRole('button', { name: /Approve Requisition/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Approved/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits a new requisition with estimated amount and justification', async () => {
    render(
      <TestAppProviders>
        <ExpensesView />
      </TestAppProviders>
    );

    const submitReqBtn = screen.getAllByRole('button', { name: /Submit Requisition/i })[0]!;
    fireEvent.click(submitReqBtn);

    expect(screen.getByText('Submit Department Requisition')).toBeDefined();

    const purposeInput = screen.getByPlaceholderText(/Detail the expenditure need/i);
    const amountInput = screen.getByPlaceholderText('0.00');

    fireEvent.change(purposeInput, { target: { value: 'Sunday School workbooks and crayons' } });
    fireEvent.change(amountInput, { target: { value: '850.00' } });

    const saveBtn = screen.getAllByRole('button', { name: /Submit Requisition/i })[1]!;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Requisition submitted for Pastoral \/ Elder approval/i)).toBeDefined();
      expect(screen.getByText('Sunday School workbooks and crayons')).toBeDefined();
    });
  });
});

describe('Phase 5: Payment Vouchers & Ghana WHT Deduction', () => {
  it('switches to Vouchers tab, creates voucher with 5% WHT, and posts balanced transaction', async () => {
    render(
      <TestAppProviders>
        <ExpensesView />
      </TestAppProviders>
    );

    // Switch to Vouchers tab
    const vouchersTab = screen.getByText(/Payment Vouchers & WHT/i);
    fireEvent.click(vouchersTab);

    expect(screen.getByText('PV-0041')).toBeDefined();
    expect(screen.getByText(/5% WHT applied/i)).toBeDefined();

    // Open New Voucher modal
    const newVoucherBtn = screen.getByText('New Payment Voucher');
    fireEvent.click(newVoucherBtn);

    expect(screen.getByText(/Issue Payment Voucher \(with Ghana WHT\)/i)).toBeDefined();

    // Fill form
    const payeeInput = screen.getByPlaceholderText(/e\.g\. Akwasi Sound Ltd/i);
    const purposeInput = screen.getByPlaceholderText(/Auditorium acoustic mixer/i);
    const grossInput = screen.getByPlaceholderText('0.00');

    fireEvent.change(payeeInput, { target: { value: 'Volta River Authority Facility Mgt' } });
    fireEvent.change(purposeInput, { target: { value: 'Auditorium central HVAC preventive maintenance' } });
    fireEvent.change(grossInput, { target: { value: '4000.00' } }); // GHS 4,000.00

    // Select 5% WHT
    const selects = screen.getAllByRole('combobox');
    const whtSelect = selects.find((s) => (s as HTMLSelectElement).value === '0')!;
    fireEvent.change(whtSelect, { target: { value: '5' } });

    // Submit voucher
    const postVoucherBtn = screen.getByRole('button', { name: /Authorize & Post Voucher/i });
    fireEvent.click(postVoucherBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment Voucher PV-/i)).toBeDefined();
      expect(screen.getByText(/posted to Tax Payable/i)).toBeDefined();
    });
  });
});

describe('Phase 5: Petty Cash Imprest System', () => {
  it('displays float status, records minor disbursement, and enables replenishment', async () => {
    render(
      <TestAppProviders>
        <ExpensesView />
      </TestAppProviders>
    );

    // Switch to Petty Cash tab
    const pcTab = screen.getByRole('button', { name: /Petty Cash Imprest/i });
    fireEvent.click(pcTab);

    expect(screen.getByText(/Fixed imprest float/i)).toBeDefined();
    expect(screen.getByText(/1,?000\.00/)).toBeDefined();
    expect(screen.getByText(/Disburse Minor Expense/i)).toBeDefined();

    // Open disbursement modal
    const disburseBtn = screen.getByText('Disburse Minor Expense');
    fireEvent.click(disburseBtn);

    const descInput = screen.getByPlaceholderText(/Generator diesel fuel/i);
    const amtInput = screen.getByPlaceholderText('0.00');
    const paidToInput = screen.getByPlaceholderText(/Vendor \/ Shop Name/i);

    fireEvent.change(descInput, { target: { value: 'Church drinking water dispenser bottle refill' } });
    fireEvent.change(amtInput, { target: { value: '100.00' } });
    fireEvent.change(paidToInput, { target: { value: 'Voltic Ghana Ltd' } });

    const confirmDisburseBtn = screen.getByRole('button', { name: 'Disburse Cash' });
    fireEvent.click(confirmDisburseBtn);

    await waitFor(() => {
      expect(screen.getByText(/Church drinking water dispenser bottle refill/i)).toBeDefined();
      expect(screen.getByText(/Petty cash disbursed and logged/i)).toBeDefined();
    });

    // Test Replenish Float button
    const replenishBtn = screen.getByRole('button', { name: 'Replenish Float' });
    fireEvent.click(replenishBtn);

    await waitFor(() => {
      expect(screen.getByText(/Petty cash float replenished to GHS 1,?000\.00/i)).toBeDefined();
    });
  });
});

describe('Phase 5: Fixed Asset Register & Depreciation', () => {
  it('displays assets and straight-line depreciation metrics', async () => {
    render(
      <TestAppProviders>
        <ExpensesView />
      </TestAppProviders>
    );

    // Switch to Assets tab
    const assetsTab = screen.getByText(/Fixed Asset Register/i);
    fireEvent.click(assetsTab);

    expect(screen.getByText('Yamaha Montage 8 Synthesizer Keyboard')).toBeDefined();
    expect(screen.getByText('Perkins 50kVA Soundproof Standby Diesel Generator')).toBeDefined();
    expect(screen.getAllByText('AST-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Net Book Value/i)[0]).toBeDefined();
  });
});
