export type MfaFactorType = 'TOTP' | 'PASSKEY' | 'RECOVERY_CODE';

export interface UserMfaRecord {
  readonly userId: string;
  readonly isEnrolled: boolean;
  readonly factorType: MfaFactorType | null;
  readonly secretBase32: string | null;
  readonly enrolledAt: string | null;
  readonly recoveryCodesHashed: readonly string[]; // SHA-256 hashes of one-time codes
  readonly recoveryCodesRemaining: number;
}

export interface AuthPolicyConfig {
  readonly minPasswordLength: number; // default 12
  readonly lockoutThreshold: number; // default 10 consecutive failed attempts
  readonly offlineWindowDays: number; // default 7 days
  readonly maxOfflinePinAttempts: number; // default 5 attempts
  readonly idleTimeoutMinutes: number; // default 5 minutes
}

export const DEFAULT_AUTH_POLICY_CONFIG: AuthPolicyConfig = {
  minPasswordLength: 12,
  lockoutThreshold: 10,
  offlineWindowDays: 7,
  maxOfflinePinAttempts: 5,
  idleTimeoutMinutes: 5,
};

export interface OfflineUnlockEvaluation {
  readonly status: 'UNLOCKED' | 'INVALID_PIN' | 'PIN_ATTEMPTS_EXHAUSTED' | 'OFFLINE_WINDOW_EXPIRED';
  readonly isUnlocked: boolean;
  readonly remainingAttempts: number;
  readonly offlineDaysRemaining: number;
  readonly isOfflineWindowExpired: boolean;
  readonly isAttemptsExhausted: boolean;
  readonly requiresOnlineSignIn: boolean;
  readonly reassuranceMessage: string;
}

export interface PasswordValidationResult {
  readonly isValid: boolean;
  readonly isPassphrase: boolean;
  readonly errors: readonly string[];
}

export interface PinValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

export type ReAuthActionType =
  | 'CLOSE_OR_REOPEN_PERIOD'
  | 'CHANGE_USER_ROLE'
  | 'CHANGE_APPROVAL_LIMITS'
  | 'RESTORE_BACKUP'
  | 'EXPORT_GIVING_DATA'
  | 'RESET_MFA'
  | 'CHANGE_PAYMENT_DETAILS'
  | 'APPROVE_PAYROLL';

export interface ReAuthActionMetadata {
  readonly title: string;
  readonly description: string;
  readonly warningNote?: string;
}

export type DeviceStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REVOKED';

export interface DeviceRecord {
  readonly id: string;
  readonly deviceName: string;
  readonly devicePrefix: string;
  readonly userFullName: string;
  readonly userRole: string;
  readonly appVersion: string;
  readonly schemaVersion: string;
  readonly lastSyncAt: string;
  readonly status: DeviceStatus;
  readonly approvedBy?: string | null;
  readonly approvedAt?: string | null;
  readonly revokedBy?: string | null;
  readonly revokedAt?: string | null;
}

export interface MfaResetRequest {
  readonly id: string;
  readonly targetUserId: string;
  readonly targetUserName: string;
  readonly targetUserRole: string;
  readonly requestedByAdmin: string;
  readonly requestedAt: string;
  readonly requiredApproverRole: 'Treasurer' | 'Pastor / Elder';
  readonly status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  readonly approvedBy?: string | null;
  readonly approvedAt?: string | null;
  readonly reason: string;
}

export interface UserSessionRecord {
  readonly id: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly location: string;
  readonly signedInAt: string;
  readonly lastActiveAt: string;
  readonly isCurrent: boolean;
}
