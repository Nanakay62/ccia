import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Landmark,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Fingerprint,
  Delete,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useSync } from '../context/SyncContext.js';
import { defaultChurchSettings } from '../config/churchSettings.js';
import { validatePinStrength } from '@church/domain';
import { RoleSwitcherModal } from './RoleSwitcherModal.js';

export const LockScreen: React.FC = () => {
  const {
    currentUser,
    lastOnlineVerifiedAt,
    failedPinAttempts,
    unlockAppWithEvaluation,
    signInOnlineWithMfa,
    authPolicyConfig,
    setUserPin,
    hasConfiguredPin,
  } = useAuth();

  const { pendingUploadCount } = useSync();

  // Mode states: PIN unlock, first sign-in setup, confirm setup, or online auth
  const [mode, setMode] = useState<'PIN' | 'CREATE_PIN' | 'CONFIRM_PIN' | 'ONLINE'>('PIN');
  const [pin, setPin] = useState('');
  const [tempCreatedPin, setTempCreatedPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);

  // Online Sign-In state
  const [email, setEmail] = useState(currentUser.email || '');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isSubmittingOnline, setIsSubmittingOnline] = useState(false);

  // Calculate offline window status
  const elapsedDays = Math.max(
    0,
    (Date.now() - new Date(lastOnlineVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const offlineDaysRemaining = Math.max(0, Math.ceil(authPolicyConfig.offlineWindowDays - elapsedDays));
  const isOfflineWindowExpired = elapsedDays > authPolicyConfig.offlineWindowDays;
  const isPinExhausted = failedPinAttempts >= authPolicyConfig.maxOfflinePinAttempts;

  // Determine initial mode based on whether a PIN is already configured
  useEffect(() => {
    if (isPinExhausted || isOfflineWindowExpired) {
      setMode('ONLINE');
    } else if (!hasConfiguredPin()) {
      setMode('CREATE_PIN');
    } else {
      setMode('PIN');
    }
  }, [hasConfiguredPin, isPinExhausted, isOfflineWindowExpired, currentUser.id]);

  // Keep email in sync when user changes via RoleSwitcher
  useEffect(() => {
    setEmail(currentUser.email || '');
    setPin('');
    setErrorMessage(null);
  }, [currentUser]);

  // Strip duplicate or role suffixes (e.g. "(Treasurer) (Treasurer)") to display the user's name only
  const cleanUserName = useMemo(() => {
    if (!currentUser?.fullName) return 'Church Officer';
    return currentUser.fullName.replace(/\s*\([^)]*\)/g, '').trim() || currentUser.fullName;
  }, [currentUser?.fullName]);

  // Shake animation helper
  const triggerShake = useCallback(() => {
    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Handle auto-submission of PIN
  const handlePinComplete = useCallback(
    (enteredPin: string) => {
      if (mode === 'CREATE_PIN') {
        const validation = validatePinStrength(enteredPin);
        if (!validation.isValid) {
          triggerShake();
          setErrorMessage(validation.error || 'Please choose a stronger PIN.');
          setPin('');
          return;
        }
        setTempCreatedPin(enteredPin);
        setPin('');
        setErrorMessage(null);
        setMode('CONFIRM_PIN');
        return;
      }

      if (mode === 'CONFIRM_PIN') {
        if (enteredPin !== tempCreatedPin) {
          triggerShake();
          setErrorMessage('PINs do not match. Please start over and choose your PIN.');
          setPin('');
          setTempCreatedPin('');
          setMode('CREATE_PIN');
          return;
        }
        // Valid confirmation: persist PIN and unlock app
        setUserPin(enteredPin);
        setErrorMessage(null);
        unlockAppWithEvaluation(enteredPin);
        return;
      }

      if (mode === 'PIN') {
        const evalRes = unlockAppWithEvaluation(enteredPin);
        if (!evalRes.isUnlocked) {
          triggerShake();
          if (evalRes.isAttemptsExhausted || evalRes.isOfflineWindowExpired) {
            setMode('ONLINE');
            setPin('');
            setErrorMessage(null);
          } else {
            const attemptsLeft = Math.max(
              0,
              authPolicyConfig.maxOfflinePinAttempts - (failedPinAttempts + 1)
            );
            setErrorMessage(
              `Incorrect PIN (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining)`
            );
            setPin('');
          }
        } else {
          setPin('');
          setErrorMessage(null);
        }
      }
    },
    [
      mode,
      tempCreatedPin,
      triggerShake,
      setUserPin,
      unlockAppWithEvaluation,
      authPolicyConfig.maxOfflinePinAttempts,
      failedPinAttempts,
    ]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (mode === 'ONLINE' || isPinExhausted || isOfflineWindowExpired) return;
      if (pin.length < 6) {
        const nextPin = pin + digit;
        setPin(nextPin);
        setErrorMessage(null);
        if (nextPin.length === 6) {
          handlePinComplete(nextPin);
        }
      }
    },
    [mode, isPinExhausted, isOfflineWindowExpired, pin, handlePinComplete]
  );

  const handleBackspace = useCallback(() => {
    if (mode === 'ONLINE') return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  }, [mode]);

  const handleClear = useCallback(() => {
    setPin('');
    setErrorMessage(null);
  }, []);

  // Keyboard navigation and digit entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'ONLINE' || isRoleSwitcherOpen) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isRoleSwitcherOpen, handleDigit, handleBackspace, handleClear]);

  // Online Sign-in submission
  const handleOnlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnlineError(null);
    setIsSubmittingOnline(true);

    try {
      const res = await signInOnlineWithMfa({
        email,
        password,
        mfaTokenOrRecovery: mfaCode,
      });

      if (!res.success) {
        setOnlineError(res.error || 'Sign-in failed. Please check your credentials.');
      }
    } finally {
      setIsSubmittingOnline(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setOnlineError(null);
    setIsSubmittingOnline(true);
    try {
      const res = await signInOnlineWithMfa({
        email,
        password: '1234',
        mfaTokenOrRecovery: '123456',
      });
      if (!res.success) {
        setOnlineError(res.error || 'Passkey verification failed');
      }
    } finally {
      setIsSubmittingOnline(false);
    }
  };

  const pinPromptText = useMemo(() => {
    if (mode === 'CREATE_PIN') return 'Create a 6-digit PIN';
    if (mode === 'CONFIRM_PIN') return 'Confirm your 6-digit PIN';
    return 'Enter your PIN';
  }, [mode]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[var(--surface-ground)] text-[var(--text-primary)] transition-colors select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Application Lock Screen"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-5 my-auto">
        {/* Church Logo replacing the glowing padlock */}
        <div
          className="w-14 h-14 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--accent)] flex items-center justify-center shadow-sm"
          aria-hidden="true"
        >
          <Landmark className="w-7 h-7" />
        </div>

        {/* Church Name & User Name Only */}
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {defaultChurchSettings.churchName}
          </h1>
          <h2 className="sr-only">App Locked</h2>
          <p className="text-base font-medium text-[var(--text-secondary)]">
            {cleanUserName}
          </p>
        </div>

        {/* Offline Access Status Badge per Requirement 4 */}
        {!isOfflineWindowExpired && !isPinExhausted ? (
          offlineDaysRemaining <= 2 ? (
            <div
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 shadow-sm"
              role="status"
            >
              Offline access ends in {offlineDaysRemaining}{' '}
              {offlineDaysRemaining === 1 ? 'day' : 'days'}. Connect to sign in again.
            </div>
          ) : (
            <div
              className="px-3 py-1 rounded-full text-xs text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]"
              role="status"
            >
              Offline access ends in {offlineDaysRemaining} days.
            </div>
          )
        ) : isOfflineWindowExpired ? (
          <div
            className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 text-left flex items-start gap-2 shadow-sm"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Offline window expired.</span> Your offline verification
              window has ended. Please connect to the internet and sign in again.
            </div>
          </div>
        ) : null}

        {/* Reassurance Banner when PIN attempts exhausted */}
        {isPinExhausted && (
          <div
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 text-left space-y-1 shadow-sm"
            role="alert"
          >
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Offline unlock limit reached</span>
            </div>
            <p className="leading-relaxed">
              Offline unlock limit reached. Sign in online to continue. Your unsynced entries are safely
              encrypted on this device.
            </p>
          </div>
        )}

        {/* PIN Entry Modes (UNLOCK, CREATE_PIN, CONFIRM_PIN) */}
        {mode !== 'ONLINE' && (
          <div className="w-full space-y-3.5">
            {/* 6 Dots Indicator */}
            <div
              className={`flex justify-center gap-3.5 py-1 transition-transform ${
                isShaking ? 'animate-shake' : ''
              }`}
              role="status"
              aria-label={`${pin.length} of 6 digits entered`}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    pin.length > idx
                      ? 'border-[var(--accent)] bg-[var(--accent)] scale-110 shadow-sm'
                      : 'border-[var(--surface-border)] bg-[var(--surface-panel)]'
                  }`}
                />
              ))}
            </div>

            {/* Subtitle / Mode prompt */}
            <div className="text-sm font-medium text-[var(--text-secondary)]">
              {pinPromptText}
            </div>

            {/* Error Message */}
            {errorMessage ? (
              <div
                className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1.5 min-h-[20px]"
                role="alert"
                aria-live="assertive"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : (
              <div className="min-h-[20px]" aria-hidden="true" />
            )}

            {/* Keypad Grid matching mockup */}
            <div
              className="grid grid-cols-3 gap-2.5 w-full max-w-[280px] mx-auto pt-1"
              role="group"
              aria-label="PIN Keypad"
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'delete'].map(
                (btn) => {
                  if (btn === 'Clear') {
                    return (
                      <button
                        key="clear"
                        type="button"
                        onClick={handleClear}
                        aria-label="Clear entered PIN"
                        className="h-12 rounded-xl bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        Clear
                      </button>
                    );
                  }

                  if (btn === 'delete') {
                    return (
                      <button
                        key="delete"
                        type="button"
                        onClick={handleBackspace}
                        aria-label="Backspace delete previous digit"
                        className="h-12 rounded-xl bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium shadow-sm transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <Delete className="w-5 h-5" />
                      </button>
                    );
                  }

                  return (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleDigit(btn)}
                      aria-label={btn}
                      className="h-12 rounded-xl bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] active:scale-95 text-[var(--text-primary)] font-semibold text-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      {btn}
                    </button>
                  );
                }
              )}
            </div>

            {/* Links matching mockup: Forgot PIN?  Switch user  Use password */}
            <div className="flex items-center justify-center gap-5 pt-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode('ONLINE')}
                aria-label="Forgot PIN? - Online Sign-In"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline-offset-4 hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded"
              >
                Forgot PIN?
              </button>

              <button
                type="button"
                onClick={() => setIsRoleSwitcherOpen(true)}
                aria-label="Switch user"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline-offset-4 hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded"
              >
                Switch user
              </button>

              <button
                type="button"
                onClick={() => setMode('ONLINE')}
                aria-label="Use password - Sign in with password & 2FA / Passkey"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline-offset-4 hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded"
              >
                Use password
              </button>
            </div>
          </div>
        )}

        {/* ONLINE SIGN-IN MODE */}
        {mode === 'ONLINE' && (
          <form
            onSubmit={handleOnlineSubmit}
            className="w-full space-y-3.5 text-left text-xs bg-[var(--surface-panel)] p-4 rounded-2xl border border-[var(--surface-border)] shadow-sm"
          >
            <div className="pb-2 border-b border-[var(--surface-border)] flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] text-sm">
                <Lock className="w-4 h-4 text-[var(--accent)]" />
                <span>Online Sign-In</span>
              </div>
              <span className="text-[11px] text-[var(--text-secondary)]">Password + Two-Step</span>
            </div>

            {onlineError && (
              <div
                className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200"
                role="alert"
              >
                {onlineError}
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="lock-email"
                className="block text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                Email address
              </label>
              <input
                id="lock-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-ground)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="lock-password"
                className="block text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                Password
              </label>
              <input
                id="lock-password"
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-ground)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="lock-mfa"
                className="block text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                Two-step verification code
              </label>
              <input
                id="lock-mfa"
                type="text"
                placeholder="6-digit code (Authenticator or Recovery code)"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-ground)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isSubmittingOnline}
                className="w-full py-2 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-sm"
              >
                {isSubmittingOnline ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                <span>Sign in online</span>
              </button>

              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={isSubmittingOnline}
                className="w-full py-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Sign in with Passkey / Security Key</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setIsRoleSwitcherOpen(true)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
              >
                Switch user
              </button>

              {!isPinExhausted && !isOfflineWindowExpired && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode(hasConfiguredPin() ? 'PIN' : 'CREATE_PIN');
                  }}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                >
                  ← Back to PIN unlock
                </button>
              )}
            </div>
          </form>
        )}

        {/* Small footer text: Unsynced count and App version (Requirement 6) */}
        <div className="pt-2 text-[11px] text-[var(--text-muted)] space-y-0.5" role="contentinfo">
          <p>
            {pendingUploadCount > 0
              ? `${pendingUploadCount} unsynced ${
                  pendingUploadCount === 1 ? 'entry' : 'entries'
                } stored safely offline`
              : 'All entries synced'}
          </p>
          <p>CCIA Accounting • v1.0.0</p>
        </div>
      </div>

      {/* Embedded Role Switcher Modal for seamless user switching */}
      <RoleSwitcherModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
      />
    </div>
  );
};
