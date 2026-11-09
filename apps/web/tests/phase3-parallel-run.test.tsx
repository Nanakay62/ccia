import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { ParallelRunPage } from '../src/components/cutover/ParallelRunPage.js';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <ToastProvider>
        <LedgerProvider>
          <SyncProvider>
            <GivingProvider>
              <RouterProvider>{children}</RouterProvider>
            </GivingProvider>
          </SyncProvider>
        </LedgerProvider>
      </ToastProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 3 UI Integration: Parallel Run & Comparison (Spec Section B4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders ParallelRunPage with month tabs, summary line, and account variance schedule', () => {
    render(
      <TestWrapper>
        <ParallelRunPage />
      </TestWrapper>
    );

    expect(screen.getAllByText(/Parallel run and comparison/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Parallel run: September.*agrees, October.*agrees/i)).toBeTruthy();

    // Verify month tabs
    expect(screen.getByRole('button', { name: /September 2026/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /October 2026/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /November 2026/i })).toBeTruthy();

    // Verify account row headers
    expect(screen.getByText(/Account-by-account variance schedule/i)).toBeTruthy();
    expect(screen.getByText('1010')).toBeTruthy();
  });

  it('switches to November tab, filters differences, explains an unexplained variance, and signs off', () => {
    render(
      <TestWrapper>
        <ParallelRunPage />
      </TestWrapper>
    );

    // Switch to November tab
    const novTab = screen.getByRole('button', { name: /November 2026/i });
    fireEvent.click(novTab);

    // Filter to differences only
    const diffFilterBtn = screen.getByRole('button', { name: /^Differences/i });
    fireEvent.click(diffFilterBtn);

    // Look for explanation input on an unexplained row
    const explanationInput = screen.getByPlaceholderText(/Write explanation for difference/i);
    expect(explanationInput).toBeTruthy();

    fireEvent.change(explanationInput, {
      target: { value: 'Accrual recorded in new system only per audit recommendation' },
    });

    // Chief Accountant sign-off button should now be enabled
    const signOffBtn = screen.getByRole('button', { name: /Chief Accountant Sign-Off/i });
    expect(signOffBtn).toBeTruthy();
    fireEvent.click(signOffBtn);

    // Verify sign-off modal
    expect(screen.getByText(/Chief Accountant Sign-Off — November 2026/i)).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: /Confirm parallel run sign-off/i });
    fireEvent.click(confirmBtn);

    // After sign-off, verify status badge indicates approval
    expect(screen.getByText(/Approved by Kofi Mensah/i)).toBeTruthy();
  });
});
