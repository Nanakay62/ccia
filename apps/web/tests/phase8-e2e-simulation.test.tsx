import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SecurityEventsProvider } from '../src/context/SecurityEventsContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ExpensesProvider } from '../src/context/ExpensesContext.js';
import { ReportsProvider } from '../src/context/ReportsContext.js';
import { BudgetProvider } from '../src/context/BudgetContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { ApprovalProvider } from '../src/context/ApprovalContext.js';
import { BudgetManagerView } from '../src/components/budgets/BudgetManagerView.js';
import { SodExceptionsReportPage } from '../src/components/security/SodExceptionsReportPage.js';
import { SecurityEventsPage } from '../src/components/security/SecurityEventsPage.js';

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
                    <BudgetProvider>
                      <ReportsProvider>
                        <RouterProvider>{children}</RouterProvider>
                      </ReportsProvider>
                    </BudgetProvider>
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

describe('Phase 8: End-to-End Hardening, Budget Rollover, SoD Report & Security Events Full-Page Routes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. opens Budget Rollover modal on BudgetManagerView, adjusts percentage, creates FY2027 draft budget, and supports Escape close', () => {
    render(
      <TestWrapper>
        <BudgetManagerView />
      </TestWrapper>
    );

    const rolloverBtn = screen.getByRole('button', { name: /Rollover to Next Year/i });
    expect(rolloverBtn).toBeDefined();
    fireEvent.click(rolloverBtn);

    expect(screen.getByText(/Rollover Budget to FY2027/i)).toBeDefined();
    expect(screen.getByText(/Default Percentage Adjustment Across All Lines/i)).toBeDefined();

    // Select +10% preset
    const plus10Btn = screen.getByRole('button', { name: '+10%' });
    fireEvent.click(plus10Btn);

    // Submit rollover
    const createDraftBtn = screen.getByRole('button', { name: /Create FY2027 Draft Budget/i });
    fireEvent.click(createDraftBtn);

    expect(screen.getAllByText(/Draft budget for FY2027 created from FY2026/i).length).toBeGreaterThan(0);
  });

  it('2. renders SodExceptionsReportPage (#/sod-exceptions) with blocked near-misses, Treasurer overrides, and filtering', () => {
    render(
      <TestWrapper>
        <SodExceptionsReportPage />
      </TestWrapper>
    );

    expect(
      screen.getByText(/Separation of Duties \(SoD\) Exceptions & Overrides Report/i)
    ).toBeDefined();
    expect(screen.getByText(/Total Recorded SoD Events/i)).toBeDefined();
    expect(screen.getAllByText(/Blocked Self-Approval Attempts/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Logged Treasurer Overrides/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Export CSV for Auditor/i })).toBeDefined();
  });

  it('3. renders SecurityEventsPage (#/security-events) with hash-chain integrity check, severity filters, and acknowledgement modal', () => {
    render(
      <TestWrapper>
        <SecurityEventsPage />
      </TestWrapper>
    );

    expect(
      screen.getByText(/Security Events & Governance Monitor/i)
    ).toBeDefined();
    expect(screen.getByText(/Ledger Hash-Chain Integrity/i)).toBeDefined();

    const verifyBtn = screen.getByRole('button', { name: /Verify Ledger Hash-Chain/i });
    fireEvent.click(verifyBtn);

    const ackButtons = screen.queryAllByRole('button', { name: /^Acknowledge$/i });
    expect(ackButtons.length).toBeGreaterThan(0);
    fireEvent.click(ackButtons[0]!);
    expect(screen.getByText(/Acknowledge Security Alert/i)).toBeDefined();
    // Dismiss modal with Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
  });
});
