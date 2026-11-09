import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { CashbookProvider } from '../src/context/CashbookContext.js';
import { CashbookView } from '../src/components/cashbook/CashbookView.js';

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
          <CashbookProvider>
            <ToastProvider>{children}</ToastProvider>
          </CashbookProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Cashbook Foundation Integration & Specification Compliance', () => {
  it('renders CashbookView with underline tabs for all 6 cash & bank accounts', () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Cashbook' })).toBeDefined();

    // Verify account tabs
    expect(screen.getByRole('tab', { name: 'Cash on Hand (GHS)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cash on Hand (USD)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Bank (GHS)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Bank (USD)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Mobile Money (MoMo)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Petty Cash' })).toBeDefined();

    // Verify plain accounting status line exists (no cards)
    expect(screen.getByText(/Opening balance:/i)).toBeDefined();
    expect(screen.getByText(/Closing balance:/i)).toBeDefined();
  });

  it('switches between cashbook accounts and updates running balance table', () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    // Click Bank (GHS) tab
    const bankGhsTab = screen.getByRole('tab', { name: 'Bank (GHS)' });
    fireEvent.click(bankGhsTab);

    // Verify Bank details appear
    expect(screen.getByText(/GCB Bank PLC/i)).toBeDefined();
    expect(screen.getByText(/\*\*\*\* \*\*\*\* 8819/i)).toBeDefined();

    // Verify bank table headers reflect GHS
    expect(screen.getByText(/Receipts \(GHS\)/i)).toBeDefined();
    expect(screen.getByText(/Payments \(GHS\)/i)).toBeDefined();
  });

  it('records a new Cashbook receipt and confirms balanced posting', async () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    // Click "Receipt" button
    const receiptBtn = screen.getByRole('button', { name: /Receipt/i });
    fireEvent.click(receiptBtn);

    // Modal opens
    expect(screen.getByText(/Record Cashbook Receipt/i)).toBeDefined();

    // Fill form
    const receivedFromInput = screen.getByPlaceholderText(/Brother Emmanuel Ofori/i);
    fireEvent.change(receivedFromInput, { target: { value: 'Sister Abena Poku' } });

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '1500.00' } });

    const narrationInput = screen.getByPlaceholderText(/October tithes envelope/i);
    fireEvent.change(narrationInput, { target: { value: 'Special Thanksgiving Tithe' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Record receipt' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Record Cashbook Receipt/i)).toBeNull();
    });

    // Verify row appears in table
    expect(screen.getByText(/Sister Abena Poku/i)).toBeDefined();
  });

  it('enforces approved voucher requirement on cashbook payments', async () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    // Open Payment slide-over
    const paymentBtn = screen.getByRole('button', { name: /Payment/i });
    fireEvent.click(paymentBtn);

    expect(screen.getByText(/Record Cashbook Payment/i)).toBeDefined();

    // Verify approved voucher selector is present
    expect(screen.getByText(/Linked approved voucher/i)).toBeDefined();
    expect(screen.getByText(/Exempt category \(Bank fee, interest, MoMo fee\)/i)).toBeDefined();
  });

  it('opens and tallies denomination breakdown in physical cash count', async () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    // Cash count button is visible on cash accounts
    const countBtn = screen.getByRole('button', { name: /Cash count/i });
    fireEvent.click(countBtn);

    expect(screen.getByText(/Physical Cash Count Verification/i)).toBeDefined();
    expect(screen.getByText(/GHS 200.00 note/i)).toBeDefined();
    expect(screen.getByText(/Dual Signatories/i)).toBeDefined();
  });

  it('toggles between standard running balance and analysed multi-column view', () => {
    render(
      <TestAppProviders>
        <CashbookView />
      </TestAppProviders>
    );

    // Default view has Counterpart account column
    expect(screen.getByText('Account (Counterpart)')).toBeDefined();

    // Click Analysed view toggle
    const toggleBtn = screen.getByRole('button', { name: /Analysed view/i });
    fireEvent.click(toggleBtn);

    // Analysed view shows category columns
    expect(screen.getByText('Tithes')).toBeDefined();
    expect(screen.getByText('Offerings')).toBeDefined();
    expect(screen.getByText('Salaries')).toBeDefined();
    expect(screen.getByText('Utilities')).toBeDefined();
  });

  describe('Phase 2: Bank Reconciliation & Cheque Register Integration', () => {
    it('switches to Bank Reconciliation tab and displays balanced reconciliation statement with dual sign-off', () => {
      render(
        <TestAppProviders>
          <CashbookView />
        </TestAppProviders>
      );

      // Click "Bank Reconciliation" module tab
      const bankRecTab = screen.getByRole('tab', { name: 'Bank Reconciliation' });
      fireEvent.click(bankRecTab);

      // Verify heading and standard reconciliation math lines
      expect(screen.getByText(/Bank Reconciliation Statement/i)).toBeDefined();
      expect(screen.getByText(/Balance per bank statement:/i)).toBeDefined();
      expect(screen.getByText(/Add: Deposits in transit/i)).toBeDefined();
      expect(screen.getByText(/Less: Unpresented cheques/i)).toBeDefined();
      expect(screen.getByText(/Adjusted bank balance:/i)).toBeDefined();
      expect(screen.getByText(/Cashbook closing balance:/i)).toBeDefined();
      expect(screen.getByText(/Balanced to zero/i)).toBeDefined();

      // Verify sign-off section
      expect(screen.getByText(/Prepared by \(Finance Secretary\):/i)).toBeDefined();
      expect(screen.getByText(/Akosua Osei/i)).toBeDefined();
      expect(screen.getByText(/Approve Reconciliation \(Treasurer\)/i)).toBeDefined();
    });

    it('approves bank reconciliation and updates status', async () => {
      render(
        <TestAppProviders>
          <CashbookView />
        </TestAppProviders>
      );

      // Switch to Bank Reconciliation tab
      const bankRecTab = screen.getByRole('tab', { name: 'Bank Reconciliation' });
      fireEvent.click(bankRecTab);

      // Click "Approve Reconciliation (Treasurer)" button
      const approveBtn = screen.getByRole('button', { name: /Approve Reconciliation \(Treasurer\)/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Reconciliation approved and locked for period close/i)).toBeDefined();
      });
    });

    it('switches to Cheque Register tab and displays all 4 cheque statuses with KPI summary', () => {
      render(
        <TestAppProviders>
          <CashbookView />
        </TestAppProviders>
      );

      // Click "Cheque Register" tab
      const chequeTab = screen.getByRole('tab', { name: 'Cheque Register' });
      fireEvent.click(chequeTab);

      // Verify KPI summary counts
      expect(screen.getByText(/Total Cheques:/i)).toBeDefined();
      expect(screen.getByText(/Issued \(Unpresented\):/i)).toBeDefined();
      expect(screen.getByText(/Presented:/i)).toBeDefined();
      expect(screen.getByText(/Stale \(>6 months\):/i)).toBeDefined();
      expect(screen.getByText(/Cancelled \/ Void:/i)).toBeDefined();

      // Verify cheques from demo data are listed with their statuses
      expect(screen.getByText('000381')).toBeDefined(); // Presented
      expect(screen.getByText('000395')).toBeDefined(); // Issued
      expect(screen.getByText('000390')).toBeDefined(); // Stale
      expect(screen.getByText('000392')).toBeDefined(); // Cancelled
    });

    it('issues a new cheque with automatic sequential numbering in Cheque Register', async () => {
      render(
        <TestAppProviders>
          <CashbookView />
        </TestAppProviders>
      );

      // Switch to Cheque Register
      const chequeTab = screen.getByRole('tab', { name: 'Cheque Register' });
      fireEvent.click(chequeTab);

      // Click Issue Cheque
      const issueBtn = screen.getByRole('button', { name: /Issue cheque/i });
      fireEvent.click(issueBtn);

      // Verify modal opens with auto-sequenced next number 000396
      expect(screen.getByText(/Issue Cheque —/i)).toBeDefined();
      const numInput = screen.getByDisplayValue('000396');
      expect(numInput).toBeDefined();

      // Fill in Payee and Amount
      const payeeInput = screen.getByPlaceholderText(/Electricity Company of Ghana/i);
      fireEvent.change(payeeInput, { target: { value: 'Kingdom Printers Ghana' } });

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '850.00' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Record Cheque Issue/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Issue Cheque —/i)).toBeNull();
      });

      // Verify new cheque appears in list
      expect(screen.getByText('Kingdom Printers Ghana')).toBeDefined();
    });

    it('voids an issued cheque requiring an explanatory cancellation reason', async () => {
      render(
        <TestAppProviders>
          <CashbookView />
        </TestAppProviders>
      );

      // Switch to Cheque Register
      const chequeTab = screen.getByRole('tab', { name: 'Cheque Register' });
      fireEvent.click(chequeTab);

      // Find Void button
      const voidBtns = screen.getAllByRole('button', { name: 'Void' });
      fireEvent.click(voidBtns[0]!);

      // Void modal appears
      expect(screen.getByRole('heading', { name: /Void Cheque/i })).toBeDefined();

      // Fill mandatory cancellation reason
      const reasonInput = screen.getByPlaceholderText(/Damaged during printing/i);
      fireEvent.change(reasonInput, { target: { value: 'Vendor requested direct bank wire transfer instead' } });

      // Confirm void
      const confirmBtn = screen.getByRole('button', { name: /Confirm Void Cheque/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Confirm Void Cheque/i)).toBeNull();
      });

      // Cheque now shows as Voided
      expect(screen.getByText(/Vendor requested direct bank wire transfer instead/i)).toBeDefined();
    });
  });
});
