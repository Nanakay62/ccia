import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  generateTotpSecret,
  generateTotpUri,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  evaluateLoginThrottleAndLockout,
  evaluateOfflineUnlock,
  isRoleMfaMandatory,
  canApproveMfaReset,
  evaluateDeviceAccess,
  base32Decode,
  base32Encode,
  type MfaResetRequest,
  type DeviceRecord,
} from '../index.js';

describe('Phase 4: Security Basics Domain Logic (Spec Section C1 & C2)', () => {
  describe('Password Strength & Blocklist', () => {
    it('enforces minimum 12 characters or passphrase and checks common church blocklist', () => {
      // Too short
      const shortRes = validatePasswordStrength('Short1!');
      expect(shortRes.isValid).toBe(false);
      expect(shortRes.errors[0]).toContain('at least 12 characters');

      // Valid length >= 12
      const validRes = validatePasswordStrength('CalvaryGraceFaith2026!');
      expect(validRes.isValid).toBe(true);

      // Multi-word passphrase (>= 3 words separated by spaces or hyphens, length >= 14)
      const passphraseRes = validatePasswordStrength('grace abundantly given today');
      expect(passphraseRes.isValid).toBe(true);
      expect(passphraseRes.isPassphrase).toBe(true);

      // Blocked common church word
      const blockedRes = validatePasswordStrength('calvarycrystal123');
      expect(blockedRes.isValid).toBe(false);
      expect(blockedRes.errors[0]).toContain('common or easily guessable');
    });
  });

  describe('RFC 6238 TOTP Two-Step Authentication', () => {
    it('encodes and decodes base32 correctly', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base32Encode(bytes);
      expect(encoded).toBe('JBSWY3DP');

      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(bytes);
    });

    it('generates standard RFC 6238 TOTP codes matching RFC 6238 test vectors', () => {
      // RFC 6238 test secret: "12345678901234567890" ASCII
      // Base32 representation: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
      const testSecretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

      // RFC 6238 Table 1 test vectors:
      // Time 59s: TOTP = 287082
      expect(generateTotpCode(testSecretBase32, 59)).toBe('287082');

      // Time 1111111109s: TOTP = 081804
      expect(generateTotpCode(testSecretBase32, 1111111109)).toBe('081804');

      // Time 1111111111s: TOTP = 050471
      expect(generateTotpCode(testSecretBase32, 1111111111)).toBe('050471');

      // Time 1234567890s: TOTP = 005924
      expect(generateTotpCode(testSecretBase32, 1234567890)).toBe('005924');

      // Time 2000000000s: TOTP = 279037
      expect(generateTotpCode(testSecretBase32, 2000000000)).toBe('279037');
    });

    it('generates valid otpauth:// URI for authenticator QR codes', () => {
      const uri = generateTotpUri({
        issuer: 'Calvary Crystal Church',
        accountName: 'treasurer@calvarycrystal.org',
        secret: 'JBSWY3DPEHPK3PXP',
      });

      expect(uri).toContain('otpauth://totp/Calvary%20Crystal%20Church:treasurer%40calvarycrystal.org');
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(uri).toContain('issuer=Calvary%20Crystal%20Church');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });

    it('verifies TOTP codes with ±1 drift window tolerance', () => {
      const secret = generateTotpSecret(20);
      const now = 1700000000;
      const currentCode = generateTotpCode(secret, now);

      // Exact match
      expect(verifyTotpCode({ token: currentCode, secretBase32: secret, timestampSeconds: now })).toBe(true);

      // One step drift earlier (-30s)
      const prevCode = generateTotpCode(secret, now - 30);
      expect(verifyTotpCode({ token: prevCode, secretBase32: secret, timestampSeconds: now })).toBe(true);

      // One step drift later (+30s)
      const nextCode = generateTotpCode(secret, now + 30);
      expect(verifyTotpCode({ token: nextCode, secretBase32: secret, timestampSeconds: now })).toBe(true);

      // Two steps drift (out of window)
      const twoStepsAgo = generateTotpCode(secret, now - 60);
      expect(verifyTotpCode({ token: twoStepsAgo, secretBase32: secret, timestampSeconds: now })).toBe(false);

      // Invalid token format
      expect(verifyTotpCode({ token: '123', secretBase32: secret, timestampSeconds: now })).toBe(false);
    });

    it('generates 10 single-use recovery codes and consumes them once only', () => {
      const { plainCodes, hashedCodes } = generateRecoveryCodes(10);
      expect(plainCodes).toHaveLength(10);
      expect(hashedCodes).toHaveLength(10);
      expect(plainCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      // Consume first code
      const consume1 = verifyAndConsumeRecoveryCode({
        enteredCode: plainCodes[0]!,
        remainingHashedCodes: hashedCodes,
      });
      expect(consume1.isValid).toBe(true);
      expect(consume1.remainingHashedCodes).toHaveLength(9);

      // Attempting to reuse the same code fails
      const consumeReuse = verifyAndConsumeRecoveryCode({
        enteredCode: plainCodes[0]!,
        remainingHashedCodes: consume1.remainingHashedCodes,
      });
      expect(consumeReuse.isValid).toBe(false);
      expect(consumeReuse.remainingHashedCodes).toHaveLength(9);
    });
  });

  describe('Throttling & 10-Attempt Lockout', () => {
    it('allows normal attempts and escalates delay after 5 failures until 10-attempt lockout', () => {
      // Under 5 failures
      const res0 = evaluateLoginThrottleAndLockout(0);
      expect(res0.allowed).toBe(true);
      expect(res0.isLockedOut).toBe(false);
      expect(res0.delaySeconds).toBe(0);

      // 5 failures -> 2s delay
      const res5 = evaluateLoginThrottleAndLockout(5);
      expect(res5.allowed).toBe(false);
      expect(res5.delaySeconds).toBe(2);
      expect(res5.isLockedOut).toBe(false);

      // 9 failures -> 32s delay
      const res9 = evaluateLoginThrottleAndLockout(9);
      expect(res9.allowed).toBe(false);
      expect(res9.delaySeconds).toBe(32);
      expect(res9.isLockedOut).toBe(false);
      expect(res9.remainingUntilLockout).toBe(1);

      // 10 failures -> Lockout
      const res10 = evaluateLoginThrottleAndLockout(10);
      expect(res10.isLockedOut).toBe(true);
      expect(res10.allowed).toBe(false);
      expect(res10.remainingUntilLockout).toBe(0);
    });
  });

  describe('Offline Unlock Window & Safe Unsynced Queue Guarantee', () => {
    it('unlocks with valid PIN within 7-day offline window', () => {
      const res = evaluateOfflineUnlock({
        lastOnlineVerifiedAt: '2026-11-01T10:00:00Z',
        failedPinAttempts: 0,
        enteredPin: '1234',
        correctPin: '1234',
        nowIso: '2026-11-03T10:00:00Z', // 2 days later (< 7)
      });

      expect(res.isUnlocked).toBe(true);
      expect(res.status).toBe('UNLOCKED');
      expect(res.offlineDaysRemaining).toBe(5);
      expect(res.requiresOnlineSignIn).toBe(false);
    });

    it('enforces 5-attempt local PIN limit with spec reassurance message without wiping unsynced data', () => {
      // 4 failures, attempt wrong PIN again -> reaches 5
      const resExhausted = evaluateOfflineUnlock({
        lastOnlineVerifiedAt: '2026-11-01T10:00:00Z',
        failedPinAttempts: 4,
        enteredPin: '9999',
        correctPin: '1234',
        nowIso: '2026-11-02T10:00:00Z',
      });

      expect(resExhausted.isUnlocked).toBe(false);
      expect(resExhausted.status).toBe('PIN_ATTEMPTS_EXHAUSTED');
      expect(resExhausted.isAttemptsExhausted).toBe(true);
      expect(resExhausted.requiresOnlineSignIn).toBe(true);
      expect(resExhausted.reassuranceMessage).toBe(
        'Offline unlock limit reached. Sign in online to continue. Your unsynced entries are safely encrypted on this device.'
      );
    });

    it('blocks offline unlock when 7-day offline window expires', () => {
      const resExpired = evaluateOfflineUnlock({
        lastOnlineVerifiedAt: '2026-10-20T10:00:00Z',
        failedPinAttempts: 0,
        enteredPin: '1234',
        correctPin: '1234',
        nowIso: '2026-11-01T10:00:00Z', // 12 days later (> 7)
      });

      expect(resExpired.isUnlocked).toBe(false);
      expect(resExpired.status).toBe('OFFLINE_WINDOW_EXPIRED');
      expect(resExpired.isOfflineWindowExpired).toBe(true);
      expect(resExpired.requiresOnlineSignIn).toBe(true);
      expect(resExpired.reassuranceMessage).toContain('offline window has expired');
    });
  });

  describe('Role-Based MFA Mandate & Dual-Custody Reset', () => {
    it('mandates MFA for privileged roles and makes it optional for counters', () => {
      expect(isRoleMfaMandatory('Treasurer')).toBe(true);
      expect(isRoleMfaMandatory('Finance Secretary')).toBe(true);
      expect(isRoleMfaMandatory('Pastor / Elder')).toBe(true);
      expect(isRoleMfaMandatory('Auditor')).toBe(true);
      expect(isRoleMfaMandatory('Admin')).toBe(true);

      expect(isRoleMfaMandatory('Counter')).toBe(false);
      expect(isRoleMfaMandatory('Department Head')).toBe(false);
    });

    it('requires Pastor/Elder approval for Treasurer MFA reset, and Treasurer/Admin for others', () => {
      const reqTreasurer: MfaResetRequest = {
        id: 'req-1',
        targetUserId: 'u1',
        targetUserName: 'Kofi Mensah',
        targetUserRole: 'Treasurer',
        requestedByAdmin: 'Admin Kwabena',
        requestedAt: '2026-11-05T10:00:00Z',
        requiredApproverRole: 'Pastor / Elder',
        status: 'PENDING_APPROVAL',
        reason: 'Lost phone during travel',
      };

      // Admin or Treasurer cannot approve Treasurer's reset
      expect(canApproveMfaReset({ request: reqTreasurer, actorRole: 'Admin' }).allowed).toBe(false);
      expect(canApproveMfaReset({ request: reqTreasurer, actorRole: 'Treasurer' }).allowed).toBe(false);

      // Pastor / Elder can approve Treasurer's reset
      expect(canApproveMfaReset({ request: reqTreasurer, actorRole: 'Pastor / Elder' }).allowed).toBe(true);

      // Regular user (Finance Secretary) reset can be approved by Treasurer or Admin
      const reqFinSec: MfaResetRequest = {
        ...reqTreasurer,
        targetUserRole: 'Finance Secretary',
        requiredApproverRole: 'Treasurer',
      };
      expect(canApproveMfaReset({ request: reqFinSec, actorRole: 'Treasurer' }).allowed).toBe(true);
      expect(canApproveMfaReset({ request: reqFinSec, actorRole: 'Admin' }).allowed).toBe(true);
      expect(canApproveMfaReset({ request: reqFinSec, actorRole: 'Counter' }).allowed).toBe(false);
    });
  });

  describe('Device Approval & Revocation Controls', () => {
    it('gates sync for pending devices and marks revoked devices for local wipe', () => {
      const approvedDevice: DeviceRecord = {
        id: 'dev-1',
        deviceName: 'Church Office Laptop',
        devicePrefix: 'FS-D01',
        userFullName: 'Akosua Osei',
        userRole: 'Finance Secretary',
        appVersion: '1.0.0',
        schemaVersion: '1.0.0',
        lastSyncAt: '2026-11-05T09:00:00Z',
        status: 'APPROVED',
      };
      expect(evaluateDeviceAccess(approvedDevice).canSync).toBe(true);

      const pendingDevice: DeviceRecord = {
        ...approvedDevice,
        status: 'PENDING_APPROVAL',
      };
      const pendingRes = evaluateDeviceAccess(pendingDevice);
      expect(pendingRes.canSync).toBe(false);
      expect(pendingRes.statusMessage).toContain('pending Administrator approval');

      const revokedDevice: DeviceRecord = {
        ...approvedDevice,
        status: 'REVOKED',
      };
      const revokedRes = evaluateDeviceAccess(revokedDevice);
      expect(revokedRes.canSync).toBe(false);
      expect(revokedRes.shouldWipeLocalCache).toBe(true);
      expect(revokedRes.statusMessage).toContain('Local cache will be wiped');
    });
  });
});
