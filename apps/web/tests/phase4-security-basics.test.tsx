import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { RouterProvider } from '../src/context/RouterContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { LockScreen } from '../src/components/LockScreen.js';
import { MfaEnrollmentModal } from '../src/components/security/MfaEnrollmentModal.js';
import { ReAuthGateModal } from '../src/components/security/ReAuthGateModal.js';
import { SettingsView } from '../src/components/settings/SettingsView.js';

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

describe('Phase 4: Security Basics & Dual-Custody Verification (Spec Section C1, C2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. LockScreen & Offline Unlock Protection', () => {
    it('renders LockScreen with PIN pad, offline window indicator, and switch to online sign-in', () => {
      render(
        <TestWrapper>
          <LockScreen />
        </TestWrapper>
      );

      expect(screen.getByText(/Calvary Crystal Church/i)).toBeTruthy();
      expect(screen.getByText(/Create a 6-digit PIN|Enter your PIN/i)).toBeTruthy();
      expect(screen.getByText(/Offline access ends in/i)).toBeTruthy();

      // Digits 0-9 are present
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeTruthy();
      }
    });

    it('exhausting 5 offline PIN attempts switches to online mode with spec-verbatim reassurance banner', () => {
      const PinExhaustionTester: React.FC = () => {
        const { unlockAppWithEvaluation, failedPinAttempts } = useAuth();
        return (
          <div>
            <span data-testid="attempts-count">{failedPinAttempts}</span>
            <button
              onClick={() => unlockAppWithEvaluation('0000')}
              data-testid="enter-wrong-pin"
            >
              Enter Wrong PIN
            </button>
            <LockScreen />
          </div>
        );
      };

      render(
        <TestWrapper>
          <PinExhaustionTester />
        </TestWrapper>
      );

      const wrongPinBtn = screen.getByTestId('enter-wrong-pin');

      // Click 5 times to exhaust attempts
      for (let i = 0; i < 5; i++) {
        fireEvent.click(wrongPinBtn);
      }

      // Spec verbatim banner must appear:
      // "Offline unlock limit reached. Sign in online to continue. Your unsynced entries are safely encrypted on this device."
      expect(
        screen.getAllByText(/Offline unlock limit reached/i).length
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(/Your unsynced entries are safely encrypted on this device\./i)
      ).toBeTruthy();

      // In online mode, password field is visible
      expect(screen.getByPlaceholderText(/Enter password/i)).toBeTruthy();
    });

    it('allows unlocking via online sign-in with password and TOTP code', () => {
      const OnlineSignInTester: React.FC = () => {
        const { isAppLocked } = useAuth();
        return (
          <div>
            <span data-testid="lock-status">{isAppLocked ? 'LOCKED' : 'UNLOCKED'}</span>
            <LockScreen />
          </div>
        );
      };

      render(
        <TestWrapper>
          <OnlineSignInTester />
        </TestWrapper>
      );

      // Switch to online mode
      const switchBtn = screen.getByRole('button', { name: /Use password|Sign in with password/i });
      fireEvent.click(switchBtn);

      const passwordInput = screen.getByPlaceholderText(/Enter password/i);
      const mfaInput = screen.getByPlaceholderText(/6-digit code/i);
      const signInBtn = screen.getByRole('button', { name: /Sign in online/i });

      fireEvent.change(passwordInput, { target: { value: 'CorrectPassword123!' } });
      fireEvent.change(mfaInput, { target: { value: '123456' } });
      fireEvent.click(signInBtn);

      expect(screen.getByTestId('lock-status').textContent).toBe('UNLOCKED');
    });
  });

  describe('2. MfaEnrollmentModal (TOTP & Recovery Codes)', () => {
    it('walks through Step 1 (QR & Secret), Step 2 (Verification), and Step 3 (10 Recovery Codes)', () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <MfaEnrollmentModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Step 1: Scan QR Code or manual entry
      expect(screen.getByText(/Set up two-step verification/i)).toBeTruthy();
      expect(screen.getByText(/Scan this QR code with Google Authenticator/i)).toBeTruthy();

      // Advance to Step 2
      const nextBtn = screen.getByRole('button', { name: /Next: Verify code/i });
      fireEvent.click(nextBtn);

      // Step 2: Verification
      expect(screen.getByText(/6-digit verification code/i)).toBeTruthy();
      const codeInput = screen.getByPlaceholderText(/000000/i);

      // Enter test code and verify
      fireEvent.change(codeInput, { target: { value: '123456' } });
      const verifyBtn = screen.getByRole('button', { name: /Verify and activate/i });
      fireEvent.click(verifyBtn);

      // Step 3: 10 Recovery Codes
      expect(screen.getByText(/Save these one-time recovery codes\./i)).toBeTruthy();

      // Verify that recovery codes are displayed in XXXX-XXXX format
      const recoveryCodeElements = screen.getAllByText(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
      expect(recoveryCodeElements.length).toBe(10);

      // Finish enrollment
      const doneBtn = screen.getByRole('button', { name: /Done: Finish activation/i });
      fireEvent.click(doneBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('3. SettingsView Security & Dual-Custody Reset', () => {
    it('displays 2FA status column, dual-custody MFA reset queue, and active sessions on Users tab', () => {
      render(
        <TestWrapper>
          <SettingsView />
        </TestWrapper>
      );

      // Verify 2FA status column header
      expect(screen.getByText(/Two-step sign-in/i)).toBeTruthy();

      // Verify enrolled badges
      const enrolledBadges = screen.getAllByText(/Enrolled \(TOTP\)/i);
      expect(enrolledBadges.length).toBeGreaterThan(0);

      // Verify Dual-Custody Reset Requests section
      expect(screen.getByText(/Pending 2FA Reset Requests \(Dual-Custody\)/i)).toBeTruthy();
      expect(
        screen.getByText(/Per Spec C1: Lost authenticators are reset by the Admin with Treasurer approval/i)
      ).toBeTruthy();

      // Verify pending request in mock data
      expect(screen.getAllByText(/Akosua Osei/i).length).toBeGreaterThan(0);

      // Verify Active User Sessions section
      expect(screen.getByText(/Active User Sessions/i)).toBeTruthy();
      expect(screen.getByText(/Sign out everywhere/i)).toBeTruthy();
    });

    it('displays device approval queue and permits approving/revoking on Devices tab', () => {
      render(
        <TestWrapper>
          <SettingsView />
        </TestWrapper>
      );

      // Navigate to Devices tab
      const devicesTab = screen.getByRole('button', { name: /^Devices/i });
      fireEvent.click(devicesTab);

      expect(screen.getByText(/Authorized local devices/i)).toBeTruthy();
      expect(screen.getByText(/Per Spec C2: New devices must be approved before syncing/i)).toBeTruthy();

      // Check status badges
      expect(screen.getAllByText(/Approved/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Pending approval/i).length).toBeGreaterThan(0);

      // Approve pending device
      const approveBtn = screen.getByRole('button', { name: /Approve device/i });
      fireEvent.click(approveBtn);

      // Remote Wipe Policy notice is present
      expect(screen.getByText(/Remote Wipe Policy:/i)).toBeTruthy();
    });
  });

  describe('4. ReAuthGateModal (Sensitive Operation Protection)', () => {
    it('prompts for password/TOTP re-authentication before executing sensitive actions', () => {
      const onActionSuccess = vi.fn();

      const ReAuthTester: React.FC = () => {
        const { triggerReAuth, reAuthGateState, confirmReAuth, cancelReAuth } = useAuth();
        return (
          <div>
            <button
              onClick={() => triggerReAuth('CHANGE_USER_ROLE', onActionSuccess)}
            >
              Trigger Role Change
            </button>
            <ReAuthGateModal
              isOpen={reAuthGateState.isOpen}
              actionType={reAuthGateState.actionType}
              onConfirm={confirmReAuth}
              onCancel={cancelReAuth}
            />
          </div>
        );
      };

      render(
        <TestWrapper>
          <ReAuthTester />
        </TestWrapper>
      );

      // Trigger gate
      const triggerBtn = screen.getByRole('button', { name: /Trigger Role Change/i });
      fireEvent.click(triggerBtn);

      // Modal appears
      expect(screen.getByText(/Re-authenticate: User Role Modification/i)).toBeTruthy();
      expect(
        screen.getByText(/Granting or modifying financial roles .* requires re-authentication\./i)
      ).toBeTruthy();

      // Enter valid credential
      const pwdInput = screen.getByPlaceholderText(/Enter password or code\.\.\./i);
      fireEvent.change(pwdInput, { target: { value: '1234' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm identity/i });
      fireEvent.click(confirmBtn);

      // Callback executed
      expect(onActionSuccess).toHaveBeenCalled();
    });
  });
});
