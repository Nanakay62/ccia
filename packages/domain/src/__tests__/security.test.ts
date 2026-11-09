import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  validatePinStrength,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  evaluateLoginThrottleAndLockout,
  evaluateOfflineUnlock,
  isRoleMfaMandatory,
  canApproveMfaReset,
  evaluateDeviceAccess,
  DEFAULT_APPROVAL_MATRIX_RULES,
  calculateGhsEquivalentPesewas,
  resolveAmountBand,
  createApprovalRequest,
  validateApprovalStep,
  applyApprovalStep,
  evaluateSod,
  evaluateTwoCounters,
  evaluateVendorPayer,
  canTreasurerOverrideSod,
  createSodExceptionRecord,
  createControlledDetailChange,
  approveControlledDetailChange,
  formatPaymentDetailHighlight,
  generateMemberDataDossier,
  anonymiseFormerMember,
  evaluateVersionGate,
} from '../index.js';

describe('Phase 8 Hardening Suite: Comprehensive Security Controls & Offline Version Gate (security.test.ts)', () => {
  it('1. enforces role-based MFA, RFC 6238 TOTP codes, single-use recovery codes, and dual-custody MFA reset', () => {
    expect(isRoleMfaMandatory('Treasurer')).toBe(true);
    expect(isRoleMfaMandatory('Finance Secretary')).toBe(true);
    expect(isRoleMfaMandatory('Pastor / Elder')).toBe(true);
    expect(isRoleMfaMandatory('Auditor')).toBe(true);
    expect(isRoleMfaMandatory('Admin')).toBe(true);
    expect(isRoleMfaMandatory('Counter')).toBe(false);

    const secret = generateTotpSecret();
    const nowSec = 1762339200;
    const code = generateTotpCode(secret, nowSec);
    expect(verifyTotpCode({ token: code, secretBase32: secret, timestampSeconds: nowSec })).toBe(true);
    expect(verifyTotpCode({ token: '000000', secretBase32: secret, timestampSeconds: nowSec })).toBe(false);

    // Single-use recovery codes
    const { plainCodes, hashedCodes } = generateRecoveryCodes(10);
    expect(plainCodes).toHaveLength(10);
    const firstUse = verifyAndConsumeRecoveryCode({
      enteredCode: plainCodes[0]!,
      remainingHashedCodes: hashedCodes,
    });
    expect(firstUse.isValid).toBe(true);
    const secondUse = verifyAndConsumeRecoveryCode({
      enteredCode: plainCodes[0]!,
      remainingHashedCodes: firstUse.remainingHashedCodes,
    });
    expect(secondUse.isValid).toBe(false);

    // Dual-custody MFA reset: Treasurer reset requires Pastor / Elder
    const trResetReq = {
      id: 'mfa-rst-1',
      targetUserId: 'u-tr',
      targetUserName: 'Kofi Mensah',
      targetUserRole: 'Treasurer' as const,
      requestedByAdmin: 'Admin Kwabena',
      requestedAt: '2026-11-05T10:00:00Z',
      requiredApproverRole: 'Pastor / Elder' as const,
      status: 'PENDING_APPROVAL' as const,
      reason: 'New smartphone setup',
    };
    expect(canApproveMfaReset({ request: trResetReq, actorRole: 'Admin' }).allowed).toBe(false);
    expect(canApproveMfaReset({ request: trResetReq, actorRole: 'Pastor / Elder' }).allowed).toBe(true);
  });

  it('2. enforces password policy, 10-attempt lockout, 7-day offline window, 5-attempt local PIN preserving unsynced queue, and device approval', () => {
    expect(validatePasswordStrength('short123').isValid).toBe(false);
    expect(validatePasswordStrength('calvarycrystal2026').isValid).toBe(false);
    expect(validatePasswordStrength('grace abundantly given today').isValid).toBe(true);

    // Exponential backoff & 10-attempt lockout
    expect(evaluateLoginThrottleAndLockout(5).delaySeconds).toBe(2);
    expect(evaluateLoginThrottleAndLockout(10).isLockedOut).toBe(true);

    // 7-day offline window & 5-attempt local PIN lock preserving unsynced entries
    const pinLock = evaluateOfflineUnlock({
      lastOnlineVerifiedAt: '2026-11-01T10:00:00Z',
      failedPinAttempts: 4,
      enteredPin: '0000',
      correctPin: '4321',
      nowIso: '2026-11-02T10:00:00Z',
    });
    expect(pinLock.isUnlocked).toBe(false);
    expect(pinLock.status).toBe('PIN_ATTEMPTS_EXHAUSTED');
    expect(pinLock.reassuranceMessage).toContain('Your unsynced entries are safely encrypted on this device');

    const windowExpired = evaluateOfflineUnlock({
      lastOnlineVerifiedAt: '2026-10-15T10:00:00Z',
      failedPinAttempts: 0,
      enteredPin: '4321',
      correctPin: '4321',
      nowIso: '2026-11-05T10:00:00Z',
    });
    expect(windowExpired.status).toBe('OFFLINE_WINDOW_EXPIRED');

    // 6-digit offline PIN strength validator (Spec C1 & Lock Screen)
    expect(validatePinStrength('1234').isValid).toBe(false);
    expect(validatePinStrength('12345').isValid).toBe(false);
    expect(validatePinStrength('111111').isValid).toBe(false);
    expect(validatePinStrength('000000').isValid).toBe(false);
    expect(validatePinStrength('123456').isValid).toBe(false);
    expect(validatePinStrength('012345').isValid).toBe(false);
    expect(validatePinStrength('654321').isValid).toBe(false);
    expect(validatePinStrength('121212').isValid).toBe(false);
    expect(validatePinStrength('123123').isValid).toBe(false);
    expect(validatePinStrength('112233').isValid).toBe(false);
    expect(validatePinStrength('696969').isValid).toBe(false);
    expect(validatePinStrength('849204').isValid).toBe(true);
    expect(validatePinStrength('573918').isValid).toBe(true);

    // Default '1234' is never accepted as fallback when a custom 6-digit PIN is configured
    const defaultPinRejected = evaluateOfflineUnlock({
      lastOnlineVerifiedAt: '2026-11-01T10:00:00Z',
      failedPinAttempts: 0,
      enteredPin: '1234',
      correctPin: '849204',
      nowIso: '2026-11-02T10:00:00Z',
    });
    expect(defaultPinRejected.isUnlocked).toBe(false);
    expect(defaultPinRejected.status).toBe('INVALID_PIN');

    const customPinAccepted = evaluateOfflineUnlock({
      lastOnlineVerifiedAt: '2026-11-01T10:00:00Z',
      failedPinAttempts: 0,
      enteredPin: '849204',
      correctPin: '849204',
      nowIso: '2026-11-02T10:00:00Z',
    });
    expect(customPinAccepted.isUnlocked).toBe(true);
    expect(customPinAccepted.status).toBe('UNLOCKED');

    // Unapproved device sync block
    const unapprovedDevice = evaluateDeviceAccess({
      id: 'd-99',
      deviceName: 'Unknown Tablet',
      devicePrefix: 'UN-01',
      userFullName: 'Kwame Boateng',
      userRole: 'Counter',
      appVersion: '1.0.0',
      schemaVersion: '1.0.0',
      lastSyncAt: '2026-11-05T09:00:00Z',
      status: 'PENDING_APPROVAL',
    });
    expect(unapprovedDevice.canSync).toBe(false);
  });

  it('3. enforces GHS-equivalent approval matrix for USD requests, no self-approval, no double-counting, SoD blocks, and controlled payment details', () => {
    // USD 500 @ 15.50 = 7,750 GHS (> 5,000 GHS band -> 2 approvals required)
    const ghsEquiv = calculateGhsEquivalentPesewas(50000n, 'USD', '15.5000');
    expect(ghsEquiv).toBe(775000n);
    const band = resolveAmountBand(DEFAULT_APPROVAL_MATRIX_RULES, 'requisition', ghsEquiv);
    expect(band.requiredApprovalsCount).toBe(2);

    const req = createApprovalRequest({
      id: 'ar-1',
      transactionType: 'requisition',
      entityId: 'req-500',
      entityNumber: 'REQ-0500',
      amountPesewas: 50000n,
      currency: 'USD',
      exchangeRateUsd: '15.5000',
      requesterUserId: 'u-dept',
      requesterUserName: 'Yaw Kwarteng',
      requesterRole: 'Department Head',
    });

    // Self-approval blocked
    expect(
      validateApprovalStep({
        request: req,
        approverUserId: 'u-dept',
        approverUserName: 'Yaw Kwarteng',
        approverRole: 'Department Head',
      }).valid
    ).toBe(false);

    // Step 1 by Treasurer
    const afterStep1 = applyApprovalStep({
      request: req,
      approverUserId: 'u-tr',
      approverUserName: 'Kofi Mensah',
      approverRole: 'Treasurer',
    });
    expect(afterStep1.status).toBe('PENDING');

    // Double-counted approver blocked
    expect(
      validateApprovalStep({
        request: afterStep1,
        approverUserId: 'u-tr',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
      }).valid
    ).toBe(false);

    // Step 2 by Pastor / Elder completes approval
    const afterStep2 = applyApprovalStep({
      request: afterStep1,
      approverUserId: 'u-pe',
      approverUserName: 'Rev. Emmanuel Addo',
      approverRole: 'Pastor / Elder',
    });
    expect(afterStep2.status).toBe('APPROVED');

    // SoD rules & controlled bank/MoMo detail changes
    expect(evaluateTwoCounters('c1', 'c1').allowed).toBe(false);
    expect(
      evaluateSod({
        checkType: 'REQUISITION_PREPARER_APPROVER',
        preparerUserId: 'u-fs',
        approverUserId: 'u-fs',
      }).allowed
    ).toBe(false);
    expect(
      evaluateVendorPayer({
        vendorCreatorId: 'u-fs',
        payerUserId: 'u-fs',
        isSamePeriod: true,
        hasSecondApproval: false,
      }).allowed
    ).toBe(false);
    expect(
      canTreasurerOverrideSod({
        actorUserId: 'u-tr',
        actorRole: 'Treasurer',
        preparerUserId: 'u-tr',
      }).allowed
    ).toBe(false);

    const sodExc = createSodExceptionRecord({
      ruleType: 'REQUISITION_PREPARER_APPROVER',
      entityType: 'REQUISITION',
      entityId: 'REQ-0100',
      actorUserId: 'u-fs',
      actorUserName: 'Akosua Osei',
      actorRole: 'Finance Secretary',
      isOverridden: true,
      overriddenByTreasurerId: 'u-tr',
      overriddenByTreasurerName: 'Kofi Mensah',
      overrideReason: 'Emergency generator repair during power outage',
      details: 'Treasurer override logged',
    });
    expect(sodExc.isOverridden).toBe(true);

    const detailChange = createControlledDetailChange({
      entityType: 'VENDOR',
      entityId: 'v-1',
      entityName: 'ECG Power Services',
      detailType: 'BANK_ACCOUNT',
      oldValue: '101000222',
      newValue: '101000999',
      changedByUserId: 'u-fs',
      changedByUserName: 'Akosua Osei',
    });
    expect(formatPaymentDetailHighlight(detailChange).canDisburse).toBe(false);

    const approvedDetail = approveControlledDetailChange({
      change: detailChange,
      approverUserId: 'u-tr',
      approverUserName: 'Kofi Mensah',
      approverRole: 'Treasurer',
    });
    expect(formatPaymentDetailHighlight(approvedDetail).canDisburse).toBe(true);
  });

  it('4. anonymises former members under Ghana Data Protection Act while preserving GL totals and blocks outdated clients from posting', () => {
    const member = {
      id: 'mem-77',
      fullName: 'Kwesi Appiah',
      memberNumber: 'MEM-077',
      envelopeNumber: 'ENV-077',
      phoneNumber: '+233244000777',
      email: 'kwesi@example.com',
      address: 'East Legon, Accra',
      status: 'FORMER' as const,
    };

    const givingRecords = [
      {
        id: 'gr-1',
        branchId: 'br-1',
        memberId: 'mem-77',
        memberName: 'Kwesi Appiah',
        fundId: 'fund-gen',
        fundName: 'General Fund',
        amountPesewas: 250000n,
        currency: 'GHS' as const,
        serviceDate: '2026-04-12',
        paymentMethod: 'MOMO' as const,
        category: 'Tithe' as const,
        receiptNumber: 'REC-077',
        createdAt: '2026-04-12T10:00:00Z',
      },
    ];

    const dossier = generateMemberDataDossier({
      member,
      givingRecords,
      pledges: [],
      accessAuditTrail: [],
      exportedBy: 'Kofi Mensah (Treasurer)',
      exportPurpose: 'Subject Access Request under Act 843',
    });
    expect(dossier.totalGivingPesewas).toBe(250000n);

    const anon = anonymiseFormerMember({
      member,
      givingRecords,
      pledges: [],
      executedBy: 'Kofi Mensah (Treasurer)',
      reason: 'Member relocated and requested anonymisation under Act 843',
    });
    expect(anon.anonymisedMember.fullName).toContain('Former Member (Anonymised');
    expect(anon.anonymisedMember.phoneNumber).toBeUndefined();
    expect(anon.anonymisedMember.email).toBeUndefined();
    // Financial total remains 100% intact
    expect(anon.anonymisedGivingRecords[0]!.amountPesewas).toBe(250000n);
    expect(anon.anonymisationAuditRecord.ledgerIntactNotice).toContain('100% intact');

    // Offline Version Gate: outdated client blocked from posting/syncing but retains local read-only access
    const gate = evaluateVersionGate({
      clientAppVersion: '0.9.0',
      clientSchemaVersion: 1,
      serverPolicy: {
        minSupportedAppVersion: '1.0.0',
        minSupportedSchemaVersion: 1,
        latestAppVersion: '1.1.0',
      },
    });
    expect(gate.status).toBe('BLOCKED_OUTDATED');
    expect(gate.isPostingAllowed).toBe(false);
    expect(gate.isSyncAllowed).toBe(false);
    expect(gate.isReadAllowed).toBe(true);
    expect(gate.userMessage).toContain('This app needs an update. Connect to the internet and tap Update');
  });
});
