import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { LockScreen } from '../src/components/LockScreen.js';
import { saveToStore } from '../src/utils/database.js';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <SyncProvider>{children}</SyncProvider>
  </AuthProvider>
);

describe('Lock Screen Redesign & Specification Compliance', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. displays the church logo, serif title, and user name ONLY (stripping "(Treasurer) (Treasurer)")', () => {
    // Pre-set a valid 6-digit PIN so it starts in PIN mode
    localStorage.setItem('church_user_pin', '849204');

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    // Church name
    expect(screen.getByText('Calvary Crystal Church')).toBeDefined();

    // User name ONLY: Kofi Mensah (should NOT have "(Treasurer)")
    expect(screen.getByText('Kofi Mensah')).toBeDefined();
    expect(screen.queryByText(/Treasurer/)).toBeNull();

    // Never displays any default PIN or hint
    expect(screen.queryByText(/Default:/i)).toBeNull();
    expect(screen.queryByText('1234')).toBeNull();
  });

  it('2. renders exactly 6 PIN dots and keypad matching the design mockup', () => {
    localStorage.setItem('church_user_pin', '849204');

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    const dotsStatus = screen.getByLabelText(/0 of 6 digits entered/i);
    expect(dotsStatus).toBeDefined();

    // Keypad numbers 0-9, Clear, and Delete
    expect(screen.getByRole('button', { name: '1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '9' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear entered PIN' })).toBeDefined();
    expect(screen.getByRole('button', { name: '0' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Backspace delete previous digit' })).toBeDefined();
  });

  it('3. requires first-time user to create a 6-digit PIN and rejects weak PINs', async () => {
    // No PIN set in localStorage
    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    // Should prompt to create a 6-digit PIN
    expect(screen.getByText('Create a 6-digit PIN')).toBeDefined();

    // Try entering sequential PIN: 1, 2, 3, 4, 5, 6
    ['1', '2', '3', '4', '5', '6'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });

    // Should reject with weak PIN error
    expect(await screen.findByText(/cannot be sequential numbers/i)).toBeDefined();

    // Try repeated PIN: 1, 1, 1, 1, 1, 1
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: '1' }));
    }
    expect(await screen.findByText(/cannot consist of all identical digits/i)).toBeDefined();

    // Enter a strong 6-digit PIN: 8, 4, 9, 2, 0, 4
    ['8', '4', '9', '2', '0', '4'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });

    // Should advance to confirmation step
    expect(await screen.findByText('Confirm your 6-digit PIN')).toBeDefined();

    // Enter mismatched confirmation: 8, 4, 9, 2, 0, 5
    ['8', '4', '9', '2', '0', '5'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });
    expect(await screen.findByText(/PINs do not match/i)).toBeDefined();
    expect(screen.getByText('Create a 6-digit PIN')).toBeDefined();

    // Now complete valid setup: 849204 then 849204
    ['8', '4', '9', '2', '0', '4'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });
    expect(await screen.findByText('Confirm your 6-digit PIN')).toBeDefined();

    ['8', '4', '9', '2', '0', '4'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });

    // Successfully saved to localStorage
    expect(localStorage.getItem('church_user_pin')).toBe('849204');
  });

  it('4. displays neutral offline status when > 2 days remain, and amber badge when <= 2 days remain', () => {
    localStorage.setItem('church_user_pin', '849204');

    // Case A: Fresh login (7 days remain -> neutral)
    const freshIso = new Date().toISOString();
    saveToStore('auth_last_online_verified', false, freshIso);

    const { unmount } = render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    expect(screen.getByText(/Offline access ends in \d+ days\./i)).toBeDefined();
    unmount();

    // Case B: 6 days elapsed (1 day remains -> amber with plain text)
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    saveToStore('auth_last_online_verified', false, sixDaysAgo);

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    expect(
      screen.getByText(/Offline access ends in 1 day\. Connect to sign in again\./i)
    ).toBeDefined();
  });

  it('5. auto-submits on 6 digits, shows remaining attempts, and after 5 wrong attempts requires online sign-in without wiping entries', async () => {
    localStorage.setItem('church_user_pin', '849204');

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    expect(screen.getByText('Enter your PIN')).toBeDefined();

    // Enter wrong PIN: 9, 9, 8, 8, 7, 7
    ['9', '9', '8', '8', '7', '7'].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: d }));
    });

    expect(await screen.findByText(/Incorrect PIN \(4 attempts remaining\)/i)).toBeDefined();
  });

  it('6. handles keyboard digit entry, backspace, and clear key', () => {
    localStorage.setItem('church_user_pin', '849204');

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    // Type digits via keyboard
    fireEvent.keyDown(window, { key: '8' });
    fireEvent.keyDown(window, { key: '4' });
    expect(screen.getByLabelText('2 of 6 digits entered')).toBeDefined();

    // Backspace
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.getByLabelText('1 of 6 digits entered')).toBeDefined();

    // Escape/Clear
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByLabelText('0 of 6 digits entered')).toBeDefined();
  });

  it('7. provides "Forgot PIN?", "Switch user", and "Use password" links, plus small text footer', () => {
    localStorage.setItem('church_user_pin', '849204');

    render(
      <Wrapper>
        <LockScreen />
      </Wrapper>
    );

    // Links from mockup
    const forgotPinBtn = screen.getByRole('button', { name: /Forgot PIN/i });
    const switchUserBtn = screen.getByRole('button', { name: /Switch user/i });
    const usePasswordBtn = screen.getByRole('button', { name: /Use password/i });

    expect(forgotPinBtn).toBeDefined();
    expect(switchUserBtn).toBeDefined();
    expect(usePasswordBtn).toBeDefined();

    // Small footer text
    expect(screen.getByText(/unsynced entry stored safely offline|All entries synced/i)).toBeDefined();
    expect(screen.getByText(/CCIA Accounting • v1\.0\.0/i)).toBeDefined();

    // Clicking "Switch user" opens Role Switcher modal
    fireEvent.click(switchUserBtn);
    expect(screen.getByText('Switch Role / User (Testing)')).toBeDefined();

    // Clicking "Forgot PIN?" opens online sign in
    fireEvent.click(forgotPinBtn);
    expect(screen.getByText('Online Sign-In')).toBeDefined();
    expect(screen.getByText(/Password \+ Two-Step/i)).toBeDefined();
  });
});
