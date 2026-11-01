import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { PayrollProvider } from '../src/context/PayrollContext.js';
import { PayrollView } from '../src/components/payroll/PayrollView.js';
import { BudgetManagerView } from '../src/components/budgets/BudgetManagerView.js';
import { GivingDirectoryView } from '../src/components/giving/GivingDirectoryView.js';

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <SyncProvider>
      <LedgerProvider>
        <GivingProvider>
          <ExpensesProvider>
            <ReportsProvider>
              <BudgetProvider>
                <PayrollProvider>{children}</PayrollProvider>
              </BudgetProvider>
            </ReportsProvider>
          </ExpensesProvider>
        </GivingProvider>
      </LedgerProvider>
    </SyncProvider>
  </AuthProvider>
);

describe('Phase 7: Payroll, Budgets, and Member Statements Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Staff & Payroll Management (Ghana SSNIT & PAYE)', () => {
    it('renders PayrollView with default October 2026 run and statutory breakdowns', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Verify header and default run
      expect(screen.getByText(/Church Staff Payroll & Allowances Management/i)).toBeDefined();
      expect(screen.getByText(/Monthly Payroll Runs/i)).toBeDefined();
      expect(screen.getByText(/Payroll Itemization/i)).toBeDefined();

      // Check statutory Ghana SSNIT & PAYE badges and metrics
      expect(screen.getByText(/SSNIT \(Emp 5.5%\)/i)).toBeDefined();
      expect(screen.getAllByText(/PAYE Tax/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Net Disbursed/i)).toBeDefined();
    });

    it('switches to Staff Registry and registers a new church worker', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Switch to Staff Registry tab
      const staffTab = screen.getByRole('button', { name: /Staff Registry/i });
      fireEvent.click(staffTab);

      // Check existing seeded staff
      expect(screen.getByText(/Rev. Emmanuel Appiah/i)).toBeDefined();
      expect(screen.getByText(/Pastor Samuel Osei/i)).toBeDefined();
      expect(screen.getByText(/Kwame Agyeman/i)).toBeDefined();

      // Click Add Staff
      const addStaffBtn = screen.getByRole('button', { name: /Add Staff/i });
      fireEvent.click(addStaffBtn);

      // Fill in new staff form
      const nameInput = screen.getByPlaceholderText(/e.g. Pastor David Quaye/i);
      const roleInput = screen.getByPlaceholderText(/e.g. Associate Pastor/i);
      const basicInput = screen.getAllByPlaceholderText(/0.00/i)[0]!;

      fireEvent.change(nameInput, { target: { value: 'Pastor David Osei' } });
      fireEvent.change(roleInput, { target: { value: 'Youth Pastor' } });
      fireEvent.change(basicInput, { target: { value: '2800.00' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Save Staff Member/i });
      fireEvent.click(submitBtn);

      // Should now appear in registry
      expect(screen.getByText(/Pastor David Osei/i)).toBeDefined();
      expect(screen.getAllByText(/Youth Pastor/i).length).toBeGreaterThanOrEqual(2);
    });

    it('executes a monthly payroll run with automated balanced journal entry', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Open Run Monthly Payroll modal
      const runPayrollBtn = screen.getByRole('button', { name: /Run Monthly Payroll/i });
      fireEvent.click(runPayrollBtn);

      expect(screen.getByText(/Execute Monthly Church Staff Payroll/i)).toBeDefined();

      // Submit payroll run
      const confirmRunBtn = screen.getByRole('button', { name: /Authorize & Disburse Payroll/i });
      fireEvent.click(confirmRunBtn);

      // Verify success message with ledger posting
      expect(screen.getByText(/Balanced ledger entry posted/i)).toBeDefined();
    });

    it('views and renders printable individual payslip with Ghanaian legal tender', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Switch to Payslips tab
      const payslipsTab = screen.getByRole('button', { name: /Staff Payslips/i });
      fireEvent.click(payslipsTab);

      // Verify payslip cards
      expect(screen.getAllByText(/Rev. Emmanuel Appiah/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Senior Pastor/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Gross Salary:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Total Deductions:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Net Pay:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Print Payslip/i).length).toBeGreaterThan(0);
    });
  });

  describe('Annual Budgets & Departmental Quarterly Allocations', () => {
    it('renders BudgetManagerView with annual targets and quarterly matrix', () => {
      render(
        <AllProviders>
          <BudgetManagerView />
        </AllProviders>
      );

      expect(screen.getByText(/Church Operating Budget & Departmental Allocations/i)).toBeDefined();
      expect(screen.getByText(/Approved 2026 Operating Budget/i)).toBeDefined();

      // Check quarterly headers
      expect(screen.getAllByText('Q1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Q2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Q3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Q4').length).toBeGreaterThan(0);

      // Check budget line items
      expect(screen.getByText(/Salaries and Allowances/i)).toBeDefined();
      expect(screen.getByText(/Utilities/i)).toBeDefined();
    });

    it('applies a budget revision with mandatory audit justification', () => {
      render(
        <AllProviders>
          <BudgetManagerView />
        </AllProviders>
      );

      // Click Revise Allocation
      const reviseBtn = screen.getByRole('button', { name: /Revise Allocation/i });
      fireEvent.click(reviseBtn);

      expect(screen.getByText(/Revise Budget Line Allocation/i)).toBeDefined();

      // Enter revised amount and justification
      const amountInput = screen.getByPlaceholderText(/0.00/i);
      const reasonInput = screen.getByPlaceholderText(/e.g. Unanticipated surge in utilities tariff by regulatory commission/i);

      fireEvent.change(amountInput, { target: { value: '45000.00' } });
      fireEvent.change(reasonInput, { target: { value: 'ECG utility tariff increase Q4' } });

      // Save revision
      const saveRevisionBtn = screen.getByRole('button', { name: /Authorize Revision/i });
      fireEvent.click(saveRevisionBtn);

      // Verify success banner
      expect(screen.getByText(/Budget revised successfully/i)).toBeDefined();

      // Check Revision History tab
      const revisionsTab = screen.getByRole('button', { name: /Revision History/i });
      fireEvent.click(revisionsTab);

      expect(screen.getByText(/ECG utility tariff increase Q4/i)).toBeDefined();
    });
  });

  describe('Official Member Giving Statements & Privacy', () => {
    it('generates high-fidelity member giving statement with Ghanaian currency in words', () => {
      render(
        <AllProviders>
          <GivingDirectoryView />
        </AllProviders>
      );

      // Find Statement buttons for members
      const statementButtons = screen.getAllByRole('button', { name: /Statement/i });
      expect(statementButtons.length).toBeGreaterThan(0);

      // Click statement for the first member (Kofi Mensah)
      fireEvent.click(statementButtons[0]!);

      // Statement modal should be visible
      expect(screen.getByText(/Official Church Financial Contribution Statement/i)).toBeDefined();
      expect(screen.getByText(/Accra Community Church/i)).toBeDefined();
      expect(screen.getAllByText(/Kofi Mensah/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ENV-012/i).length).toBeGreaterThan(0);

      // Check legal tender in words
      expect(screen.getByText(/Ghana Cedis Only/i)).toBeDefined();

      // Check pledge campaign section
      expect(screen.getByText(/Building & Special Pledges/i)).toBeDefined();
      expect(screen.getByText(/Auditorium Expansion Project 2026/i)).toBeDefined();

      // Check pastoral gratitude note and certification block
      expect(screen.getByText(/We gratefully acknowledge and thank you/i)).toBeDefined();
      expect(screen.getByText(/Authorized Signature & Church Stamp/i)).toBeDefined();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Print Statement/i }).nextElementSibling;
      if (closeBtn) {
        fireEvent.click(closeBtn);
      }
    });
  });
});
