import type { Role } from '../permissions/index.js';
import {
  DEFAULT_AUTH_POLICY_CONFIG,
  type AuthPolicyConfig,
  type DeviceRecord,
  type MfaResetRequest,
  type OfflineUnlockEvaluation,
  type PasswordValidationResult,
  type PinValidationResult,
  type ReAuthActionMetadata,
  type ReAuthActionType,
} from './types.js';

export const COMMON_PASSWORD_BLOCKLIST: readonly string[] = [
  'password',
  'password123',
  'password1234',
  '123456789012',
  'administrator',
  'admin123456',
  'calvarycrystal',
  'calvary123456',
  'church2026acc',
  'treasurer1234',
  'financesecretary',
  'pastorelder12',
  'welcometochurch',
  'qwertyuiop12',
  'accraaccounting',
  'ghanafinance1',
];

/**
 * Validates password strength per Spec C1:
 * - Minimum 12 characters OR a multi-word passphrase (>= 3 words separated by spaces or hyphens, total length >= 14).
 * - Checked against local blocklist of common and church-specific terms.
 * - No forced periodic changes.
 */
export function validatePasswordStrength(
  password: string,
  customBlocklist?: readonly string[]
): PasswordValidationResult {
  const trimmed = password.trim();
  const errors: string[] = [];

  // Check passphrase pattern: at least 3 words separated by space or hyphen, total length >= 14
  const words = trimmed.split(/[\s-]+/).filter(Boolean);
  const isPassphrase = words.length >= 3 && trimmed.length >= 14;

  if (!isPassphrase && trimmed.length < 12) {
    errors.push('Password must be at least 12 characters long (or a passphrase of at least 3 words).');
  }

  // Normalize and check against blocklist
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const blocklist = customBlocklist ?? COMMON_PASSWORD_BLOCKLIST;

  for (const blocked of blocklist) {
    const cleanBlocked = blocked.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.includes(cleanBlocked) || cleanBlocked.includes(normalized)) {
      errors.push('Password contains a common or easily guessable church or dictionary phrase.');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    isPassphrase,
    errors,
  };
}

/**
 * Validates a 6-digit offline PIN per Spec C1 & Lock Screen rules:
 * - Exactly 6 digits
 * - Rejects repeated digits (e.g. 111111, 000000)
 * - Rejects sequential digits ascending or descending (e.g. 123456, 654321, 012345)
 * - Rejects repeated pairs (e.g. 121212) or triplets (e.g. 123123) or consecutive pairs (e.g. 112233)
 * - Rejects known common weak 6-digit PIN patterns
 */
export function validatePinStrength(pin: string): PinValidationResult {
  const trimmed = pin.trim();

  // 1. Must be exactly 6 numeric digits
  if (!/^\d{6}$/.test(trimmed)) {
    return { isValid: false, error: 'PIN must be exactly 6 numeric digits.' };
  }

  // 2. All identical digits (e.g. 111111, 000000, 999999)
  if (/^(\d)\1{5}$/.test(trimmed)) {
    return { isValid: false, error: 'PIN cannot consist of all identical digits (e.g. 111111).' };
  }

  // 3. Sequential ascending or descending
  let isAscending = true;
  let isDescending = true;
  for (let i = 1; i < 6; i++) {
    const prev = Number(trimmed[i - 1]);
    const curr = Number(trimmed[i]);
    if (curr !== prev + 1) isAscending = false;
    if (curr !== prev - 1) isDescending = false;
  }
  if (isAscending || isDescending) {
    return { isValid: false, error: 'PIN cannot be sequential numbers (e.g. 123456 or 654321).' };
  }

  // 4. Repeated 2-digit patterns (e.g. 121212, 585858, 696969)
  if (
    trimmed[0] === trimmed[2] &&
    trimmed[2] === trimmed[4] &&
    trimmed[1] === trimmed[3] &&
    trimmed[3] === trimmed[5]
  ) {
    return { isValid: false, error: 'PIN cannot be a repeating 2-digit pattern (e.g. 121212).' };
  }

  // 5. Repeated 3-digit patterns (e.g. 123123, 456456)
  if (trimmed.slice(0, 3) === trimmed.slice(3, 6)) {
    return { isValid: false, error: 'PIN cannot repeat a 3-digit sequence (e.g. 123123).' };
  }

  // 6. Consecutive paired digits (e.g. 112233, 332211)
  if (trimmed[0] === trimmed[1] && trimmed[2] === trimmed[3] && trimmed[4] === trimmed[5]) {
    return { isValid: false, error: 'PIN cannot be consecutive paired digits (e.g. 112233).' };
  }

  // 7. Common weak PIN blocklist
  const commonWeakPins = new Set([
    '123123',
    '121212',
    '112233',
    '654321',
    '123456',
    '012345',
    '543210',
    '135791',
    '246802',
    '111222',
    '123450',
    '696969',
    '123321',
    '654123',
    '000123',
    '000000',
    '111111',
    '222222',
    '333333',
    '444444',
    '555555',
    '666666',
    '777777',
    '888888',
    '999999',
    '159753',
    '357159',
    '147258',
    '963852',
    '258000',
    '000258',
  ]);

  if (commonWeakPins.has(trimmed)) {
    return { isValid: false, error: 'This PIN is too common or easily guessed. Please choose a more secure PIN.' };
  }

  return { isValid: true };
}

/**
 * Evaluates login attempt throttling and lockout per Spec C1:
 * - Exponential backoff delay after 5 failed attempts.
 * - Lockout after 10 consecutive failed attempts until unlocked by an Admin or Treasurer.
 */
export function evaluateLoginThrottleAndLockout(
  consecutiveFailures: number,
  maxFailures = 10
): {
  readonly allowed: boolean;
  readonly isLockedOut: boolean;
  readonly delaySeconds: number;
  readonly remainingUntilLockout: number;
  readonly alertRequired: boolean;
} {
  const isLockedOut = consecutiveFailures >= maxFailures;
  const remainingUntilLockout = Math.max(0, maxFailures - consecutiveFailures);

  let delaySeconds = 0;
  if (!isLockedOut && consecutiveFailures >= 5) {
    // 5 failures -> 2s, 6 failures -> 4s, 7 failures -> 8s, 8 failures -> 16s, 9 failures -> 32s
    delaySeconds = Math.min(60, Math.pow(2, consecutiveFailures - 5) * 2);
  }

  return {
    allowed: !isLockedOut && delaySeconds === 0,
    isLockedOut,
    delaySeconds,
    remainingUntilLockout,
    alertRequired: isLockedOut || consecutiveFailures >= 5,
  };
}

/**
 * Evaluates offline unlock per Spec C1:
 * - Two-step verification is verified when online.
 * - Offline PIN unlock is permitted within the offline window (default 7 days).
 * - Local PIN attempts are limited to 5.
 * - If attempts exhausted, app locks until online sign-in.
 * - CRITICAL: Unsynced entries are NEVER wiped by failed attempts!
 */
export function evaluateOfflineUnlock(params: {
  readonly lastOnlineVerifiedAt: string; // ISO date string
  readonly failedPinAttempts: number;
  readonly enteredPin: string;
  readonly correctPin: string;
  readonly nowIso?: string;
  readonly config?: Partial<AuthPolicyConfig>;
}): OfflineUnlockEvaluation {
  const cfg = {
    ...DEFAULT_AUTH_POLICY_CONFIG,
    ...params.config,
  };

  const now = params.nowIso ? new Date(params.nowIso).getTime() : Date.now();
  const lastVerifiedTime = new Date(params.lastOnlineVerifiedAt).getTime();
  const elapsedDays = (now - lastVerifiedTime) / (1000 * 60 * 60 * 24);
  const offlineDaysRemaining = Math.max(0, Math.ceil(cfg.offlineWindowDays - elapsedDays));
  const isOfflineWindowExpired = elapsedDays > cfg.offlineWindowDays;

  // 1. Check offline window expiration
  if (isOfflineWindowExpired) {
    return {
      status: 'OFFLINE_WINDOW_EXPIRED',
      isUnlocked: false,
      remainingAttempts: 0,
      offlineDaysRemaining: 0,
      isOfflineWindowExpired: true,
      isAttemptsExhausted: false,
      requiresOnlineSignIn: true,
      reassuranceMessage: `Your ${cfg.offlineWindowDays}-day offline window has expired. Please connect to the internet and complete an online sign-in. Your unsynced records remain safely encrypted on this device.`,
    };
  }

  // 2. Check if attempts already exhausted prior to this attempt
  if (params.failedPinAttempts >= cfg.maxOfflinePinAttempts) {
    return {
      status: 'PIN_ATTEMPTS_EXHAUSTED',
      isUnlocked: false,
      remainingAttempts: 0,
      offlineDaysRemaining,
      isOfflineWindowExpired: false,
      isAttemptsExhausted: true,
      requiresOnlineSignIn: true,
      reassuranceMessage:
        'Offline unlock limit reached. Sign in online to continue. Your unsynced entries are safely encrypted on this device.',
    };
  }

  // 3. Check entered PIN
  const cleanEntered = params.enteredPin.trim();
  const cleanCorrect = params.correctPin.trim();

  if (cleanCorrect && cleanEntered === cleanCorrect) {
    return {
      status: 'UNLOCKED',
      isUnlocked: true,
      remainingAttempts: cfg.maxOfflinePinAttempts,
      offlineDaysRemaining,
      isOfflineWindowExpired: false,
      isAttemptsExhausted: false,
      requiresOnlineSignIn: false,
      reassuranceMessage: 'App unlocked successfully.',
    };
  }

  // 4. Incorrect PIN
  const nextFailures = params.failedPinAttempts + 1;
  const remaining = Math.max(0, cfg.maxOfflinePinAttempts - nextFailures);
  const attemptsExhaustedNow = nextFailures >= cfg.maxOfflinePinAttempts;

  if (attemptsExhaustedNow) {
    return {
      status: 'PIN_ATTEMPTS_EXHAUSTED',
      isUnlocked: false,
      remainingAttempts: 0,
      offlineDaysRemaining,
      isOfflineWindowExpired: false,
      isAttemptsExhausted: true,
      requiresOnlineSignIn: true,
      reassuranceMessage:
        'Offline unlock limit reached. Sign in online to continue. Your unsynced entries are safely encrypted on this device.',
    };
  }

  return {
    status: 'INVALID_PIN',
    isUnlocked: false,
    remainingAttempts: remaining,
    offlineDaysRemaining,
    isOfflineWindowExpired: false,
    isAttemptsExhausted: false,
    requiresOnlineSignIn: false,
    reassuranceMessage: `Incorrect PIN. ${remaining} ${
      remaining === 1 ? 'attempt' : 'attempts'
    } remaining before local unlock is locked.`,
  };
}

/**
 * Determines if 2FA (TOTP / Passkey) is mandatory for a given role per Spec C1:
 * Mandatory: Treasurer, Finance Secretary, Pastor / Elder, Auditor, Admin.
 * Optional: Counter, Department Head.
 */
export function isRoleMfaMandatory(role: Role): boolean {
  switch (role) {
    case 'Treasurer':
    case 'Finance Secretary':
    case 'Pastor / Elder':
    case 'Auditor':
    case 'Admin':
      return true;
    case 'Counter':
    case 'Department Head':
    default:
      return false;
  }
}

/**
 * Metadata and descriptions for sensitive action re-authentication gates per Spec C1:
 * "Re-authentication for sensitive actions, even in an active session (password or code)"
 */
export function getReAuthActionMetadata(actionType: ReAuthActionType): ReAuthActionMetadata {
  switch (actionType) {
    case 'CLOSE_OR_REOPEN_PERIOD':
      return {
        title: 'Re-authenticate: Period Close / Reopen',
        description: 'Closing or reopening a financial period or year modifies ledger locking status and requires identity confirmation.',
        warningNote: 'Reopening financial years requires Pastor/Elder co-sign off and alerts the Auditor.',
      };
    case 'CHANGE_USER_ROLE':
      return {
        title: 'Re-authenticate: User Role Modification',
        description: 'Granting or modifying financial roles (Treasurer, Finance Secretary, Pastor, Auditor) requires re-authentication.',
      };
    case 'CHANGE_APPROVAL_LIMITS':
      return {
        title: 'Re-authenticate: Approval Limits Matrix',
        description: 'Modifying financial delegation bands and required approver counts alters internal control thresholds.',
      };
    case 'RESTORE_BACKUP':
      return {
        title: 'Re-authenticate: Restore Encrypted Backup',
        description: 'Restoring an encrypted database snapshot overwrites existing local data and requires re-authentication.',
        warningNote: 'A dual-custody verification is logged and notified to the Church Auditor.',
      };
    case 'EXPORT_GIVING_DATA':
      return {
        title: 'Re-authenticate: Confidential Giving Export',
        description: 'Exporting member giving, tithe statements, or pledge records is strictly confidential under church privacy rules.',
      };
    case 'RESET_MFA':
      return {
        title: 'Re-authenticate: Dual-Custody MFA Reset',
        description: 'Resetting two-step verification for an enrolled officer requires re-authentication and dual authorization.',
      };
    case 'CHANGE_PAYMENT_DETAILS':
      return {
        title: 'Re-authenticate: Controlled Payment Details',
        description: 'Modifying bank account or Mobile Money numbers for vendors, staff, or members requires identity verification.',
      };
    case 'APPROVE_PAYROLL':
      return {
        title: 'Re-authenticate: Payroll Run Approval',
        description: 'Authorizing monthly staff compensation, GRA PAYE, and SSNIT deductions requires re-authentication.',
      };
  }
}

/**
 * Validates dual-custody MFA reset rules per Spec C1:
 * - Admin initiates.
 * - Approved by Treasurer.
 * - For Treasurer's own MFA reset: approved by Pastor or Elder.
 * - Resets are logged and notify user and Auditor.
 */
export function canApproveMfaReset(params: {
  readonly request: MfaResetRequest;
  readonly actorRole: Role;
}): {
  readonly allowed: boolean;
  readonly reason?: string;
} {
  const isTreasurerTarget = params.request.targetUserRole === 'Treasurer';

  if (isTreasurerTarget) {
    if (params.actorRole !== 'Pastor / Elder') {
      return {
        allowed: false,
        reason: "The Treasurer's MFA reset requires approval from a Senior Pastor or Elder.",
      };
    }
    return { allowed: true };
  }

  if (params.actorRole !== 'Treasurer' && params.actorRole !== 'Admin') {
    return {
      allowed: false,
      reason: "User MFA resets must be approved by the Church Treasurer or Admin.",
    };
  }

  return { allowed: true };
}

/**
 * Evaluates device access and sync permission per Spec C2:
 * - New device must be approved before it can sync (Admin approves, Treasurer notified).
 * - Revoked device is blocked and wiped at next connection.
 */
export function evaluateDeviceAccess(device: DeviceRecord): {
  readonly canSync: boolean;
  readonly shouldWipeLocalCache: boolean;
  readonly statusMessage: string;
} {
  if (device.status === 'APPROVED') {
    return {
      canSync: true,
      shouldWipeLocalCache: false,
      statusMessage: `Device ${device.deviceName} (${device.id}) is approved and active.`,
    };
  }

  if (device.status === 'PENDING_APPROVAL') {
    return {
      canSync: false,
      shouldWipeLocalCache: false,
      statusMessage: `Device ${device.deviceName} is pending Administrator approval before initial sync can begin.`,
    };
  }

  return {
    canSync: false,
    shouldWipeLocalCache: true,
    statusMessage: `Device ${device.deviceName} has been revoked by an Administrator. Local cache will be wiped on next connection.`,
  };
}
