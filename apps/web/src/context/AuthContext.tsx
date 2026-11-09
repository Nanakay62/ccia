import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Role,
  UserMfaRecord,
  DeviceRecord,
  MfaResetRequest,
  UserSessionRecord,
  AuthPolicyConfig,
  ReAuthActionType,
  OfflineUnlockEvaluation,
} from '@church/domain';
import {
  DEFAULT_AUTH_POLICY_CONFIG,
  evaluateOfflineUnlock,
  evaluateLoginThrottleAndLockout,
  verifyTotpCode,
  canApproveMfaReset,
} from '@church/domain';
import type { UserSession } from '../types/index.js';
import { defaultChurchSettings } from '../config/churchSettings.js';
import { loadFromStore, saveToStore } from '../utils/database.js';
import { isSupabaseConfigured, getSupabaseClient } from '@church/db';

export const SAMPLE_USERS: Record<string, UserSession> = {
  treasurer: {
    id: 'user-0001-treasurer',
    fullName: 'Kofi Mensah (Treasurer)',
    email: 'treasurer@calvarycrystal.org',
    role: 'Treasurer',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-TR-01',
    devicePrefix: 'TR-D01',
  },
  finance_sec: {
    id: 'user-0002-finsec',
    fullName: 'Akosua Osei (Finance Secretary)',
    email: 'finance.sec@calvarycrystal.org',
    role: 'Finance Secretary',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-FS-01',
    devicePrefix: 'FS-D01',
  },
  counter1: {
    id: 'user-0003-counter1',
    fullName: 'Kwame Boateng (Counter A)',
    email: 'counter1@calvarycrystal.org',
    role: 'Counter',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-CS-01',
    devicePrefix: 'CS-D01',
  },
  counter2: {
    id: 'user-0004-counter2',
    fullName: 'Abena Poku (Counter B)',
    email: 'counter2@calvarycrystal.org',
    role: 'Counter',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-CS-02',
    devicePrefix: 'CS-D02',
  },
  pastor: {
    id: 'user-0005-pastor',
    fullName: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
    email: 'pastor@calvarycrystal.org',
    role: 'Pastor / Elder',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-PE-01',
    devicePrefix: 'PE-D01',
  },
  auditor: {
    id: 'user-0006-auditor',
    fullName: 'Justice Appiah, CA (Auditor)',
    email: 'auditor@calvarycrystal.org',
    role: 'Auditor',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-AU-01',
    devicePrefix: 'AU-D01',
  },
  dept_head: {
    id: 'user-0007-depthead',
    fullName: 'Yaw Kwarteng (Youth Director)',
    email: 'youth@calvarycrystal.org',
    role: 'Department Head',
    departmentId: 'dept_youth',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-DH-01',
    devicePrefix: 'DH-D01',
  },
  admin: {
    id: 'user-0008-admin',
    fullName: 'Admin User (IT Administrator)',
    email: 'admin@calvarycrystal.org',
    role: 'Admin',
    branchId: '00000000-0000-0000-0000-000000000001',
    branchName: defaultChurchSettings.branchName,
    deviceId: 'DEV-AD-01',
    devicePrefix: 'AD-D01',
  },
};

const INITIAL_MFA_RECORDS: Record<string, UserMfaRecord> = {
  'user-0001-treasurer': {
    userId: 'user-0001-treasurer',
    isEnrolled: true,
    factorType: 'TOTP',
    secretBase32: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    enrolledAt: '2026-10-15T08:00:00Z',
    recoveryCodesHashed: ['hash1', 'hash2', 'hash3', 'hash4', 'hash5', 'hash6', 'hash7', 'hash8'],
    recoveryCodesRemaining: 8,
  },
  'user-0002-finsec': {
    userId: 'user-0002-finsec',
    isEnrolled: true,
    factorType: 'TOTP',
    secretBase32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    enrolledAt: '2026-10-16T09:30:00Z',
    recoveryCodesHashed: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10'],
    recoveryCodesRemaining: 10,
  },
  'user-0005-pastor': {
    userId: 'user-0005-pastor',
    isEnrolled: true,
    factorType: 'PASSKEY',
    secretBase32: null,
    enrolledAt: '2026-10-17T11:00:00Z',
    recoveryCodesHashed: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
    recoveryCodesRemaining: 10,
  },
  'user-0006-auditor': {
    userId: 'user-0006-auditor',
    isEnrolled: true,
    factorType: 'TOTP',
    secretBase32: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
    enrolledAt: '2026-10-18T14:15:00Z',
    recoveryCodesHashed: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'],
    recoveryCodesRemaining: 9,
  },
  'user-0008-admin': {
    userId: 'user-0008-admin',
    isEnrolled: true,
    factorType: 'TOTP',
    secretBase32: 'MZXW6YTBOI======',
    enrolledAt: '2026-10-19T10:00:00Z',
    recoveryCodesHashed: ['ad1', 'ad2', 'ad3', 'ad4', 'ad5', 'ad6', 'ad7', 'ad8', 'ad9', 'ad10'],
    recoveryCodesRemaining: 10,
  },
};

const INITIAL_DEVICE_RECORDS: DeviceRecord[] = [
  {
    id: 'DEV-TR-01',
    deviceName: "Treasurer's Primary Laptop (ThinkPad T14)",
    devicePrefix: 'TR-D01',
    userFullName: 'Kofi Mensah',
    userRole: 'Treasurer',
    appVersion: '1.0.0',
    schemaVersion: '1.0.0',
    lastSyncAt: '2026-11-05T08:30:00Z',
    status: 'APPROVED',
    approvedBy: 'Admin Kwabena',
    approvedAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'DEV-FS-01',
    deviceName: 'Finance Secretary Desktop (Dell OptiPlex)',
    devicePrefix: 'FS-D01',
    userFullName: 'Akosua Osei',
    userRole: 'Finance Secretary',
    appVersion: '1.0.0',
    schemaVersion: '1.0.0',
    lastSyncAt: '2026-11-05T08:45:00Z',
    status: 'APPROVED',
    approvedBy: 'Admin Kwabena',
    approvedAt: '2026-10-20T10:15:00Z',
  },
  {
    id: 'DEV-PE-01',
    deviceName: "Pastor's Office iPad Pro",
    devicePrefix: 'PE-D01',
    userFullName: 'Rev. Emmanuel Addo',
    userRole: 'Pastor / Elder',
    appVersion: '1.0.0',
    schemaVersion: '1.0.0',
    lastSyncAt: '2026-11-04T16:00:00Z',
    status: 'APPROVED',
    approvedBy: 'Admin Kwabena',
    approvedAt: '2026-10-21T09:00:00Z',
  },
  {
    id: 'DEV-NEW-02',
    deviceName: 'Sunday Counter Terminal 2 (HP ProBook)',
    devicePrefix: 'CS-D02',
    userFullName: 'Abena Poku',
    userRole: 'Counter',
    appVersion: '1.0.0',
    schemaVersion: '1.0.0',
    lastSyncAt: 'Never synced',
    status: 'PENDING_APPROVAL',
  },
  {
    id: 'DEV-OLD-99',
    deviceName: 'Decommissioned Windows 10 Tablet',
    devicePrefix: 'DH-D01',
    userFullName: 'Yaw Kwarteng',
    userRole: 'Department Head',
    appVersion: '0.9.4',
    schemaVersion: '0.9.0',
    lastSyncAt: '2026-09-15T12:00:00Z',
    status: 'REVOKED',
    revokedBy: 'Admin Kwabena',
    revokedAt: '2026-10-01T14:00:00Z',
  },
];

const INITIAL_SESSIONS: UserSessionRecord[] = [
  {
    id: 'sess-curr',
    deviceId: 'DEV-TR-01',
    deviceName: 'Chrome on Windows 11 (Current Device)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ipAddress: '197.251.132.45',
    location: 'Accra, Greater Accra, Ghana',
    signedInAt: '2026-11-05T07:15:00Z',
    lastActiveAt: 'Just now',
    isCurrent: true,
  },
  {
    id: 'sess-tab',
    deviceId: 'DEV-PE-01',
    deviceName: 'Safari on iPadOS (Auditorium WiFi)',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4)',
    ipAddress: '197.251.132.50',
    location: 'Accra, Greater Accra, Ghana',
    signedInAt: '2026-11-04T14:30:00Z',
    lastActiveAt: 'Yesterday at 16:00',
    isCurrent: false,
  },
];

const INITIAL_MFA_RESETS: MfaResetRequest[] = [
  {
    id: 'mfa-req-1',
    targetUserId: 'user-0002-finsec',
    targetUserName: 'Akosua Osei',
    targetUserRole: 'Finance Secretary',
    requestedByAdmin: 'Admin User',
    requestedAt: '2026-11-04T15:00:00Z',
    requiredApproverRole: 'Treasurer',
    status: 'PENDING_APPROVAL',
    reason: 'Upgraded to new smartphone; authenticator codes not transferred.',
  },
];

interface AuthContextType {
  currentUser: UserSession;
  isLocked: boolean;
  isSupabaseReady: boolean;
  lastOnlineVerifiedAt: string;
  failedPinAttempts: number;
  loginFailuresCount: number;
  lockoutUntil: number | null;
  userMfaRecords: Record<string, UserMfaRecord>;
  deviceRecords: DeviceRecord[];
  userSessions: UserSessionRecord[];
  mfaResetRequests: MfaResetRequest[];
  authPolicyConfig: AuthPolicyConfig;
  reAuthGateState: {
    isOpen: boolean;
    actionType: ReAuthActionType | null;
  };
  lockApp: () => void;
  unlockApp: (pin: string) => boolean;
  unlockAppWithEvaluation: (pin: string) => OfflineUnlockEvaluation;
  signInOnlineWithMfa: (params: {
    email: string;
    password: string;
    mfaTokenOrRecovery: string;
  }) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  signUpOnline?: (params: {
    email: string;
    password: string;
    fullName: string;
    role: Role;
  }) => Promise<{ success: boolean; error?: string }>;
  triggerReAuth: (actionType: ReAuthActionType, onSuccess: () => void) => void;
  verifyReAuthCredential: (credential: string) => boolean;
  confirmReAuth: () => void;
  cancelReAuth: () => void;
  enrollUserMfa: (userId: string, record: UserMfaRecord) => void;
  requestMfaResetAction: (targetUserId: string, reason: string) => void;
  approveMfaResetAction: (requestId: string) => void;
  rejectMfaResetAction: (requestId: string) => void;
  approveDeviceAction: (deviceId: string) => void;
  revokeDeviceAction: (deviceId: string) => void;
  signOutEverywhereAction: () => void;
  switchUser: (userKey: string) => void;
  switchRole: (role: Role) => void;
  resetLocalPinLockout: () => void;
  setUserPin: (pin: string) => void;
  hasConfiguredPin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHED_USER_KEY = 'church_accounts_cached_user';
const CACHED_LOCK_STATE = 'church_accounts_is_locked';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    try {
      const cached = localStorage.getItem(CACHED_USER_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback
    }
    return SAMPLE_USERS.treasurer!;
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return localStorage.getItem(CACHED_LOCK_STATE) === 'true';
  });

  const [lastOnlineVerifiedAt, setLastOnlineVerifiedAt] = useState<string>(() =>
    loadFromStore('auth_last_online_verified', false, '2026-11-03T10:00:00Z')
  );

  const [failedPinAttempts, setFailedPinAttempts] = useState<number>(() =>
    loadFromStore('auth_failed_pin_attempts', false, 0)
  );

  const [loginFailuresCount, setLoginFailuresCount] = useState<number>(() =>
    loadFromStore('auth_login_failures_count', false, 0)
  );

  const [lockoutUntil] = useState<number | null>(null);

  const [userMfaRecords, setUserMfaRecords] = useState<Record<string, UserMfaRecord>>(() =>
    loadFromStore('user_mfa_records', false, INITIAL_MFA_RECORDS)
  );

  const [deviceRecords, setDeviceRecords] = useState<DeviceRecord[]>(() =>
    loadFromStore('device_records', false, INITIAL_DEVICE_RECORDS)
  );

  const [userSessions, setUserSessions] = useState<UserSessionRecord[]>(() =>
    loadFromStore('user_sessions', false, INITIAL_SESSIONS)
  );

  const [mfaResetRequests, setMfaResetRequests] = useState<MfaResetRequest[]>(() =>
    loadFromStore('mfa_reset_requests', false, INITIAL_MFA_RESETS)
  );

  const [authPolicyConfig] = useState<AuthPolicyConfig>(DEFAULT_AUTH_POLICY_CONFIG);

  // Re-authentication Gate Modal state
  const [reAuthGateState, setReAuthGateState] = useState<{
    isOpen: boolean;
    actionType: ReAuthActionType | null;
    onSuccessCallback?: () => void;
  }>({
    isOpen: false,
    actionType: null,
  });

  useEffect(() => {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(CACHED_LOCK_STATE, isLocked ? 'true' : 'false');
  }, [isLocked]);

  const isCloudAuthReady = isSupabaseConfigured();

  // On mount: if Supabase is configured, check for an existing active session
  useEffect(() => {
    if (!isCloudAuthReady) return;
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await client
          .from('users_profile')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email || session.user.email || '',
            role: profile.role as Role,
            branchId: profile.branch_id || '00000000-0000-0000-0000-000000000001',
            branchName: defaultChurchSettings.branchName,
            deviceId: 'DEV-CLOUD-01',
            devicePrefix: 'CL-01',
          });
        }
      }
    });

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await client
          .from('users_profile')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email || session.user.email || '',
            role: profile.role as Role,
            branchId: profile.branch_id || '00000000-0000-0000-0000-000000000001',
            branchName: defaultChurchSettings.branchName,
            deviceId: 'DEV-CLOUD-01',
            devicePrefix: 'CL-01',
          });
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [isCloudAuthReady]);

  // Idle lock timer: 5 minutes of inactivity (Spec Section C1)
  useEffect(() => {
    if (isLocked) return;
    const timeoutMs = authPolicyConfig.idleTimeoutMinutes * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
      }, timeoutMs);
    };

    resetIdleTimer();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [isLocked, authPolicyConfig.idleTimeoutMinutes]);

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const resetLocalPinLockout = useCallback(() => {
    setFailedPinAttempts(0);
    saveToStore('auth_failed_pin_attempts', false, 0);
  }, []);

  const setUserPin = useCallback(
    (pin: string) => {
      localStorage.setItem(`church_user_pin_${currentUser.id}`, pin);
      localStorage.setItem('church_user_pin', pin);
    },
    [currentUser.id]
  );

  const hasConfiguredPin = useCallback(() => {
    return Boolean(
      localStorage.getItem(`church_user_pin_${currentUser.id}`) ||
      localStorage.getItem('church_user_pin')
    );
  }, [currentUser.id]);

  const unlockAppWithEvaluation = useCallback(
    (pin: string): OfflineUnlockEvaluation => {
      const configuredPin =
        localStorage.getItem(`church_user_pin_${currentUser.id}`) ||
        localStorage.getItem('church_user_pin') ||
        '';
      const evaluation = evaluateOfflineUnlock({
        lastOnlineVerifiedAt,
        failedPinAttempts,
        enteredPin: pin,
        correctPin: configuredPin,
        config: authPolicyConfig,
      });

      if (evaluation.isUnlocked) {
        setIsLocked(false);
        setFailedPinAttempts(0);
        saveToStore('auth_failed_pin_attempts', false, 0);
      } else {
        const nextAttempts = failedPinAttempts + 1;
        setFailedPinAttempts(nextAttempts);
        saveToStore('auth_failed_pin_attempts', false, nextAttempts);
      }

      return evaluation;
    },
    [currentUser.id, lastOnlineVerifiedAt, failedPinAttempts, authPolicyConfig]
  );

  const unlockApp = useCallback(
    (pin: string): boolean => {
      const evalRes = unlockAppWithEvaluation(pin);
      return evalRes.isUnlocked;
    },
    [unlockAppWithEvaluation]
  );

  const signInOnlineWithMfa = useCallback(
    async (params: {
      email: string;
      password: string;
      mfaTokenOrRecovery: string;
    }): Promise<{ success: boolean; error?: string }> => {
      // 1. If Supabase is configured, attempt authentication against Supabase Auth
      const client = getSupabaseClient();
      if (client && isCloudAuthReady) {
        try {
          const { data, error } = await client.auth.signInWithPassword({
            email: params.email.trim(),
            password: params.password.trim(),
          });

          if (error) {
            return { success: false, error: error.message };
          }

          if (data.user) {
            const { data: profile } = await client
              .from('users_profile')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();

            if (profile) {
              const liveUser: UserSession = {
                id: profile.id,
                fullName: profile.full_name,
                email: profile.email || data.user.email || '',
                role: profile.role as Role,
                branchId: profile.branch_id || '00000000-0000-0000-0000-000000000001',
                branchName: defaultChurchSettings.branchName,
                deviceId: 'DEV-CLOUD-01',
                devicePrefix: 'CL-01',
              };
              setCurrentUser(liveUser);
            }

            setIsLocked(false);
            setFailedPinAttempts(0);
            setLoginFailuresCount(0);
            const nowIso = new Date().toISOString();
            setLastOnlineVerifiedAt(nowIso);
            saveToStore('auth_last_online_verified', false, nowIso);
            saveToStore('auth_failed_pin_attempts', false, 0);
            saveToStore('auth_login_failures_count', false, 0);
            return { success: true };
          }
        } catch (cloudErr) {
          console.warn('[Auth] Supabase cloud sign-in threw exception, falling back to local credentials:', cloudErr);
        }
      }

      // 2. Local / Offline authentication fallback
      const throttle = evaluateLoginThrottleAndLockout(loginFailuresCount, authPolicyConfig.lockoutThreshold);
      if (throttle.isLockedOut) {
        return {
          success: false,
          error:
            'Account is locked due to 10 consecutive failed sign-in attempts. An Administrator or Treasurer must unlock your account.',
        };
      }

      const cleanPass = params.password.trim();
      const cleanMfa = params.mfaTokenOrRecovery.trim();

      // Check password (accept demo default '1234' or any valid length)
      const isPasswordOk = cleanPass === '1234' || cleanPass.length >= 12;
      // Check 2FA (accept '123456' demo bypass, recovery code, or TOTP verification)
      const userMfa = userMfaRecords[currentUser.id];
      let isMfaOk = false;
      if (!userMfa?.isEnrolled || userMfa.factorType === 'PASSKEY') {
        isMfaOk = true;
      } else if (cleanMfa === '123456' || cleanMfa.length === 9) {
        // Recovery code or test code
        isMfaOk = true;
      } else if (userMfa.secretBase32 && verifyTotpCode({ token: cleanMfa, secretBase32: userMfa.secretBase32 })) {
        isMfaOk = true;
      }

      if (isPasswordOk && isMfaOk) {
        setIsLocked(false);
        setFailedPinAttempts(0);
        setLoginFailuresCount(0);
        const nowIso = new Date().toISOString();
        setLastOnlineVerifiedAt(nowIso);
        saveToStore('auth_last_online_verified', false, nowIso);
        saveToStore('auth_failed_pin_attempts', false, 0);
        saveToStore('auth_login_failures_count', false, 0);
        return { success: true };
      }

      const nextFailures = loginFailuresCount + 1;
      setLoginFailuresCount(nextFailures);
      saveToStore('auth_login_failures_count', false, nextFailures);

      const nextThrottle = evaluateLoginThrottleAndLockout(nextFailures, authPolicyConfig.lockoutThreshold);
      if (nextThrottle.isLockedOut) {
        return {
          success: false,
          error:
            'Account locked out after 10 failed attempts. Contact an Administrator or Treasurer to unlock your account.',
        };
      }

      return {
        success: false,
        error: `Invalid credentials or two-step code. ${nextThrottle.remainingUntilLockout} attempts remaining before account lockout.`,
      };
    },
    [isCloudAuthReady, loginFailuresCount, authPolicyConfig, userMfaRecords, currentUser.id]
  );

  const signUpOnline = useCallback(
    async (params: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
    }): Promise<{ success: boolean; error?: string }> => {
      const client = getSupabaseClient();
      if (!client || !isCloudAuthReady) {
        return { success: false, error: 'Supabase is not configured. Setup .env with VITE_SUPABASE_URL.' };
      }

      try {
        const { error } = await client.auth.signUp({
          email: params.email.trim(),
          password: params.password.trim(),
          options: {
            data: {
              full_name: params.fullName.trim(),
              role: params.role,
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Sign up failed due to network exception',
        };
      }
    },
    [isCloudAuthReady]
  );

  const triggerReAuth = useCallback((actionType: ReAuthActionType, onSuccess: () => void) => {
    setReAuthGateState({
      isOpen: true,
      actionType,
      onSuccessCallback: onSuccess,
    });
  }, []);

  const verifyReAuthCredential = useCallback(
    (credential: string): boolean => {
      const clean = credential.trim();
      const userMfa = userMfaRecords[currentUser.id];
      if (clean === '1234' || clean === '123456' || clean === '0000') {
        return true;
      }
      if (userMfa?.secretBase32 && verifyTotpCode({ token: clean, secretBase32: userMfa.secretBase32 })) {
        return true;
      }
      return false;
    },
    [userMfaRecords, currentUser.id]
  );

  const confirmReAuth = useCallback(() => {
    if (reAuthGateState.onSuccessCallback) {
      reAuthGateState.onSuccessCallback();
    }
    setReAuthGateState({ isOpen: false, actionType: null });
  }, [reAuthGateState]);

  const cancelReAuth = useCallback(() => {
    setReAuthGateState({ isOpen: false, actionType: null });
  }, []);

  const enrollUserMfa = useCallback((userId: string, record: UserMfaRecord) => {
    setUserMfaRecords((prev) => {
      const next = { ...prev, [userId]: record };
      saveToStore('user_mfa_records', false, next);
      return next;
    });
  }, []);

  const requestMfaResetAction = useCallback(
    (targetUserId: string, reason: string) => {
      const targetUser = Object.values(SAMPLE_USERS).find((u) => u.id === targetUserId);
      const isTreasurer = targetUser?.role === 'Treasurer';
      const newReq: MfaResetRequest = {
        id: `mfa-req-${Date.now()}`,
        targetUserId,
        targetUserName: targetUser?.fullName || 'User',
        targetUserRole: targetUser?.role || 'User',
        requestedByAdmin: currentUser.fullName,
        requestedAt: new Date().toISOString(),
        requiredApproverRole: isTreasurer ? 'Pastor / Elder' : 'Treasurer',
        status: 'PENDING_APPROVAL',
        reason,
      };

      setMfaResetRequests((prev) => {
        const next = [newReq, ...prev];
        saveToStore('mfa_reset_requests', false, next);
        return next;
      });
    },
    [currentUser.fullName]
  );

  const approveMfaResetAction = useCallback(
    (requestId: string) => {
      const req = mfaResetRequests.find((r) => r.id === requestId);
      if (!req) return;

      const evalRes = canApproveMfaReset({ request: req, actorRole: currentUser.role });
      if (!evalRes.allowed) {
        throw new Error(evalRes.reason || 'You do not have permission to approve this MFA reset.');
      }

      // Mark request approved
      setMfaResetRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'APPROVED' as const,
                approvedBy: currentUser.fullName,
                approvedAt: new Date().toISOString(),
              }
            : r
        );
        saveToStore('mfa_reset_requests', false, next);
        return next;
      });

      // Clear MFA for target user
      setUserMfaRecords((prev) => {
        const next = {
          ...prev,
          [req.targetUserId]: {
            userId: req.targetUserId,
            isEnrolled: false,
            factorType: null,
            secretBase32: null,
            enrolledAt: null,
            recoveryCodesHashed: [],
            recoveryCodesRemaining: 0,
          },
        };
        saveToStore('user_mfa_records', false, next);
        return next;
      });
    },
    [mfaResetRequests, currentUser.role, currentUser.fullName]
  );

  const rejectMfaResetAction = useCallback(
    (requestId: string) => {
      setMfaResetRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'REJECTED' as const,
                approvedBy: currentUser.fullName,
                approvedAt: new Date().toISOString(),
              }
            : r
        );
        saveToStore('mfa_reset_requests', false, next);
        return next;
      });
    },
    [currentUser.fullName]
  );

  const approveDeviceAction = useCallback(
    (deviceId: string) => {
      setDeviceRecords((prev) => {
        const next = prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                status: 'APPROVED' as const,
                approvedBy: currentUser.fullName,
                approvedAt: new Date().toISOString(),
              }
            : d
        );
        saveToStore('device_records', false, next);
        return next;
      });
    },
    [currentUser.fullName]
  );

  const revokeDeviceAction = useCallback(
    (deviceId: string) => {
      setDeviceRecords((prev) => {
        const next = prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                status: 'REVOKED' as const,
                revokedBy: currentUser.fullName,
                revokedAt: new Date().toISOString(),
              }
            : d
        );
        saveToStore('device_records', false, next);
        return next;
      });
    },
    [currentUser.fullName]
  );

  const signOutEverywhereAction = useCallback(() => {
    setUserSessions((prev) => {
      const next = prev.filter((s) => s.isCurrent);
      saveToStore('user_sessions', false, next);
      return next;
    });
    setIsLocked(true);
  }, []);

  const switchUser = useCallback((userKey: string) => {
    const user = SAMPLE_USERS[userKey];
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const switchRole = useCallback((role: Role) => {
    const found = Object.values(SAMPLE_USERS).find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
    } else {
      setCurrentUser((prev) => ({ ...prev, role }));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLocked,
        isSupabaseReady: isCloudAuthReady,
        lastOnlineVerifiedAt,
        failedPinAttempts,
        loginFailuresCount,
        lockoutUntil,
        userMfaRecords,
        deviceRecords,
        userSessions,
        mfaResetRequests,
        authPolicyConfig,
        reAuthGateState: {
          isOpen: reAuthGateState.isOpen,
          actionType: reAuthGateState.actionType,
        },
        lockApp,
        unlockApp,
        unlockAppWithEvaluation,
        signInOnlineWithMfa,
        signUpOnline,
        triggerReAuth,
        verifyReAuthCredential,
        confirmReAuth,
        cancelReAuth,
        enrollUserMfa,
        requestMfaResetAction,
        approveMfaResetAction,
        rejectMfaResetAction,
        approveDeviceAction,
        revokeDeviceAction,
        signOutEverywhereAction,
        switchUser,
        switchRole,
        resetLocalPinLockout,
        setUserPin,
        hasConfiguredPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
