import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
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
    <DemoProvider>
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
    </DemoProvider>
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

      // Verify header and default run per Spec 3.3
      expect(screen.getByRole('heading', { level: 2, name: /^Payroll$/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Payroll runs/i })).toBeDefined();
      expect(screen.getByText(/Approved 28 Oct 2026/i)).toBeDefined();
      expect(screen.getByText(/Overdue/i)).toBeDefined();

      // Check statutory Ghana SSNIT & PAYE neutral metrics
      expect(screen.getByText(/Employee SSNIT \(5.5%\)/i)).toBeDefined();
      expect(screen.getAllByText(/PAYE/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Net pay/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Employer SSNIT \(13%\)/i)).toBeDefined();
      expect(screen.getByText(/Total cost to church/i)).toBeDefined();
    });

    it('switches to Staff Registry and registers a new church worker', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Switch to Staff tab (Spec 3.3)
      const staffTab = screen.getByRole('button', { name: /^Staff/i });
      fireEvent.click(staffTab);

      // Check existing seeded staff
      expect(screen.getAllByText(/Rev. Emmanuel Addo/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Pastor Samuel Osei/i)).toBeDefined();
      expect(screen.getAllByText(/Kwame Agyeman/i).length).toBeGreaterThan(0);

      // Click Add staff member
      const addStaffBtn = screen.getByRole('button', { name: /Add staff member/i });
      fireEvent.click(addStaffBtn);

      // Fill in new staff form
      const nameInput = screen.getByPlaceholderText(/e.g. Emmanuel Mensah/i);
      const roleInput = screen.getByPlaceholderText(/e.g. Media & Sound Lead/i);
      const basicInput = screen.getAllByPlaceholderText(/0.00/i)[0]!;

      fireEvent.change(nameInput, { target: { value: 'David Osei' } });
      fireEvent.change(roleInput, { target: { value: 'Youth Coordinator' } });
      fireEvent.change(basicInput, { target: { value: '2800.00' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Save Staff Member/i });
      fireEvent.click(submitBtn);

      // Should now appear in registry
      expect(screen.getByText(/David Osei/i)).toBeDefined();
      expect(screen.getByText(/Youth Coordinator/i)).toBeDefined();
    });

    it('executes a monthly payroll run with automated balanced journal entry', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Open Prepare run modal (Spec 3.3)
      const prepareRunBtn = screen.getByRole('button', { name: /Prepare run/i });
      fireEvent.click(prepareRunBtn);

      expect(screen.getByText(/Prepare Monthly Payroll Run/i)).toBeDefined();

      // Submit payroll run
      const confirmRunBtn = screen.getByRole('button', { name: /Generate Draft Run/i });
      fireEvent.click(confirmRunBtn);

      // Verify draft run status
      expect(screen.getByText(/Draft prepared by/i)).toBeDefined();
    });

    it('views and renders printable individual payslip with Ghanaian legal tender', () => {
      render(
        <AllProviders>
          <PayrollView />
        </AllProviders>
      );

      // Switch to Payslips tab
      const payslipsTab = screen.getByRole('button', { name: /^Payslips/i });
      fireEvent.click(payslipsTab);

      // Verify payslip table rows
      expect(screen.getAllByText(/Rev. Emmanuel Addo/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Senior Pastor/i).length).toBeGreaterThan(0);

      // Open preview modal
      const previewBtn = screen.getAllByRole('button', { name: /Preview & Print/i })[0]!;
      fireEvent.click(previewBtn);

      expect(screen.getAllByText(/STAFF PAYSLIP/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Gross Earnings/i)).toBeDefined();
      expect(screen.getByText(/Statutory Deductions/i)).toBeDefined();
      expect(screen.getByText(/Net Salary Disbursed:/i)).toBeDefined();
      expect(screen.getAllByRole('button', { name: /Print Payslip/i }).length).toBeGreaterThan(0);
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

      // Clicking member row opens detail panel (Spec 2.2)
      const memberRow = screen.getByText(/Kofi Mensah/i);
      fireEvent.click(memberRow);

      // Detail panel contains "Print statement" action
      const printStatementBtn = screen.getByRole('button', { name: /Print statement/i });
      fireEvent.click(printStatementBtn);

      // Statement modal should be visible
      expect(screen.getByText(/Official Church Financial Contribution Statement/i)).toBeDefined();
      expect(screen.getAllByText(/Calvary Crystal Church/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Kofi Mensah/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ENV-012/i).length).toBeGreaterThan(0);

      // Check legal tender in words
      expect(screen.getByText(/Ghana Cedis Only/i)).toBeDefined();

      // Check pledge campaign section
      expect(screen.getByText(/Building & Special Pledges/i)).toBeDefined();
      expect(screen.getAllByText(/Auditorium Expansion Project 2026/i).length).toBeGreaterThan(0);

      // Check pastoral gratitude note and certification block
      expect(screen.getByText(/We gratefully acknowledge and thank you/i)).toBeDefined();
      expect(screen.getByText(/Authorized Signature & Church Stamp/i)).toBeDefined();

      // Close modal
      const printBtns = screen.getAllByRole('button', { name: /Print Statement/i });
      const closeBtn = printBtns[printBtns.length - 1]?.nextElementSibling;
      if (closeBtn) {
        fireEvent.click(closeBtn);
      }
    });
  });
});
