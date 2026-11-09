import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  GENESIS_PREV_HASH,
  chainJournalEntries,
  verifyLedgerHashChain,
  evaluateSecurityEventRules,
  isOffHoursPosting,
  isHighValueManualJournal,
  detectRepeatedReversals,
  generateDailySecuritySummary,
  createEncryptedBackup,
  verifyBackupArchiveSandbox,
  diagnoseLedger,
  type JournalEntry,
  type Account,
  type Fund,
  type AccountingPeriod,
  type ExchangeRate,
} from '../index.js';

describe('Phase 6: Anti-Tampering Hash-Chain & Security Events Domain Logic', () => {
  const sampleAccounts: Account[] = [
    {
      id: 'acc-1010',
      branchId: '00000000-0000-0000-0000-000000000001',
      code: '1010',
      name: 'Cash in Vault',
      type: 'Asset',
      currency: 'GHS',
      isBankOrCash: true,
      isActive: true,
    },
    {
      id: 'acc-4010',
      branchId: '00000000-0000-0000-0000-000000000001',
      code: '4010',
      name: 'Tithes Income',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
  ];

  const sampleFunds: Fund[] = [
    {
      id: 'fund-gen',
      branchId: '00000000-0000-0000-0000-000000000001',
      code: 'GEN',
      name: 'General Fund',
      type: 'Unrestricted',
      allowOverdraft: false,
      isActive: true,
    },
  ];

  const samplePeriods: AccountingPeriod[] = [
    {
      id: 'per-2026-10',
      branchId: '00000000-0000-0000-0000-000000000001',
      year: 2026,
      month: 10,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      isClosed: false,
    },
  ];

  const sampleRates: ExchangeRate[] = [];

  const rawEntries: JournalEntry[] = [
    {
      id: 'ent-001',
      branchId: '00000000-0000-0000-0000-000000000001',
      documentNumber: 'CS-2026-001',
      entryDate: '2026-10-05',
      entryType: 'COUNTING_SHEET',
      narration: 'Sunday Morning Service Tithes',
      lineCount: 2,
      totalDebitGhs: 500000n, // GHS 5,000.00
      totalCreditGhs: 500000n,
      isReversal: false,
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
      createdAt: '2026-10-05T12:00:00Z',
      lines: [
        {
          id: 'lin-001',
          journalEntryId: 'ent-001',
          accountId: 'acc-1010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 500000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'lin-002',
          journalEntryId: 'ent-001',
          accountId: 'acc-4010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 500000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'ent-002',
      branchId: '00000000-0000-0000-0000-000000000001',
      documentNumber: 'CS-2026-002',
      entryDate: '2026-10-12',
      entryType: 'COUNTING_SHEET',
      narration: 'Sunday Second Service Tithes',
      lineCount: 2,
      totalDebitGhs: 300000n, // GHS 3,000.00
      totalCreditGhs: 300000n,
      isReversal: false,
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
      createdAt: '2026-10-12T12:00:00Z',
      lines: [
        {
          id: 'lin-003',
          journalEntryId: 'ent-002',
          accountId: 'acc-1010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 300000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 300000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'lin-004',
          journalEntryId: 'ent-002',
          accountId: 'acc-4010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 300000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 300000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
  ];

  describe('1. SHA-256 and Cryptographic Hash Chain (Spec C6)', () => {
    it('computes standard RFC 6234 SHA-256 digests accurately', () => {
      // Known standard SHA-256 test vectors
      expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('builds an unbroken hash chain from genesis to latest entry', () => {
      const chained = chainJournalEntries(rawEntries);
      expect(chained).toHaveLength(2);
      expect(chained[0]!.prevHash).toBe(GENESIS_PREV_HASH);
      expect(chained[0]!.entryHash).toHaveLength(64);
      expect(chained[1]!.prevHash).toBe(chained[0]!.entryHash);
      expect(chained[1]!.entryHash).toHaveLength(64);

      const verification = verifyLedgerHashChain(chained);
      expect(verification.isClean).toBe(true);
      expect(verification.verifiedChainLength).toBe(2);
      expect(verification.brokenLinks).toHaveLength(0);
    });

    it('detects tampering when an entry debit/credit amount is modified post-signing', () => {
      const chained = chainJournalEntries(rawEntries);
      // Tamper with the second entry's line amount
      const tampered = [
        chained[0]!,
        {
          ...chained[1]!,
          totalDebitGhs: 999999n, // Tampered total
        },
      ];

      const verification = verifyLedgerHashChain(tampered);
      expect(verification.isClean).toBe(false);
      expect(verification.brokenLinks.length).toBeGreaterThan(0);
      expect(verification.brokenLinks[0]!.errorType).toBe('HASH_MISMATCH');
      expect(verification.brokenLinks[0]!.documentNumber).toBe('CS-2026-002');
    });

    it('detects broken links when an entry is deleted or reordered', () => {
      const chained = chainJournalEntries(rawEntries);
      // Only verify the second entry without the first
      const missingFirst = [chained[1]!];

      const verification = verifyLedgerHashChain(missingFirst);
      expect(verification.isClean).toBe(false);
      expect(verification.brokenLinks[0]!.errorType).toBe('GENESIS_CORRUPTED');
    });
  });

  describe('2. Security Events Rules and Anomaly Detection (Spec C5)', () => {
    it('evaluates alert rules with correct categories, severities and notification roles', () => {
      const lockoutRule = evaluateSecurityEventRules('ACCOUNT_LOCKOUT');
      expect(lockoutRule.category).toBe('AUTHENTICATION');
      expect(lockoutRule.severity).toBe('HIGH');
      expect(lockoutRule.requiresNotification).toBe(true);
      expect(lockoutRule.targetRoles).toContain('Treasurer');

      const backupRestoreRule = evaluateSecurityEventRules('BACKUP_RESTORED');
      expect(backupRestoreRule.category).toBe('DATA_PRIVACY');
      expect(backupRestoreRule.severity).toBe('CRITICAL');
      expect(backupRestoreRule.requiresNotification).toBe(true);

      const overrideRule = evaluateSecurityEventRules('TREASURER_OVERRIDE');
      expect(overrideRule.category).toBe('GOVERNANCE');
      expect(overrideRule.severity).toBe('HIGH');
      expect(overrideRule.targetRoles).toContain('Auditor');
    });

    it('detects off-hours posting outside 06:00 to 22:00 window', () => {
      expect(isOffHoursPosting('2026-11-05T02:30:00Z')).toBe(true); // 2:30 AM is off-hours
      expect(isOffHoursPosting('2026-11-05T23:15:00Z')).toBe(true); // 11:15 PM is off-hours
      expect(isOffHoursPosting('2026-11-05T14:00:00Z')).toBe(false); // 2:00 PM is normal
    });

    it('detects high-value manual journal entries exceeding threshold', () => {
      const standardEntry: JournalEntry = {
        ...rawEntries[0]!,
        entryType: 'STANDARD',
        totalDebitGhs: 1500000n, // GHS 15,000.00 > GHS 10,000 threshold
      };
      expect(isHighValueManualJournal(standardEntry, 1000000n)).toBe(true);

      const belowThresholdEntry: JournalEntry = {
        ...rawEntries[0]!,
        entryType: 'STANDARD',
        totalDebitGhs: 500000n, // GHS 5,000.00
      };
      expect(isHighValueManualJournal(belowThresholdEntry, 1000000n)).toBe(false);

      // System entry (e.g. counting sheet) is not flagged as manual journal
      expect(isHighValueManualJournal(rawEntries[0]!, 1000000n)).toBe(false);
    });

    it('detects repeated reversals in a short time window by one user', () => {
      const entriesWithReversals: JournalEntry[] = [
        {
          ...rawEntries[0]!,
          id: 'rev-01',
          isReversal: true,
          createdBy: 'usr-bad-actor',
          createdAt: '2026-11-05T10:00:00Z',
        },
        {
          ...rawEntries[0]!,
          id: 'rev-02',
          isReversal: true,
          createdBy: 'usr-bad-actor',
          createdAt: '2026-11-05T10:10:00Z',
        },
        {
          ...rawEntries[0]!,
          id: 'rev-03',
          isReversal: true,
          createdBy: 'usr-bad-actor',
          createdAt: '2026-11-05T10:20:00Z',
        },
      ];

      const detected = detectRepeatedReversals(entriesWithReversals, 60, 3);
      expect(detected).toHaveLength(1);
      expect(detected[0]!.actor).toBe('usr-bad-actor');
      expect(detected[0]!.count).toBe(3);
    });

    it('generates daily security summary metrics correctly', () => {
      const summary = generateDailySecuritySummary(
        [
          {
            id: 'ev-1',
            timestamp: new Date().toISOString(),
            eventType: 'FAILED_LOGIN',
            category: 'AUTHENTICATION',
            severity: 'LOW',
            actorId: 'usr-1',
            actorName: 'Anonymous',
            actorRole: 'Viewer',
            deviceId: 'DEV-01',
            ipAddress: '192.168.1.10',
            description: 'Failed password attempt for treasurer',
            requiresNotification: false,
            targetRoles: ['Treasurer'],
          },
          {
            id: 'ev-2',
            timestamp: new Date().toISOString(),
            eventType: 'ACCOUNT_LOCKOUT',
            category: 'AUTHENTICATION',
            severity: 'HIGH',
            actorId: 'usr-1',
            actorName: 'Anonymous',
            actorRole: 'Viewer',
            deviceId: 'DEV-01',
            ipAddress: '192.168.1.10',
            description: 'Account locked due to 10 consecutive failed attempts',
            requiresNotification: true,
            targetRoles: ['Treasurer', 'Admin'],
          },
        ],
        true,
        '2026-11-04'
      );

      expect(summary.failedLogins24h).toBe(1);
      expect(summary.accountLockouts24h).toBe(1);
      expect(summary.unacknowledgedHighAlertsCount).toBe(1);
      expect(summary.healthStatus).toBe('NEEDS_ATTENTION');
    });
  });

  describe('3. Sandbox Backup Verification (Spec C6)', () => {
    it('successfully dry-runs backup verification in isolated sandbox without touching live data', async () => {
      const backupBundle = await createEncryptedBackup({
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Calvary Crystal Assembly',
        exportedBy: 'Kofi Mensah (Treasurer)',
        passphrase: 'SecureChurchPassword2026!',
        accounts: sampleAccounts,
        funds: sampleFunds,
        periods: samplePeriods,
        exchangeRates: sampleRates,
        entries: rawEntries,
      });

      const verification = await verifyBackupArchiveSandbox(backupBundle, 'SecureChurchPassword2026!');
      expect(verification.isValid).toBe(true);
      expect(verification.checksumVerified).toBe(true);
      expect(verification.accountsCount).toBe(2);
      expect(verification.fundsCount).toBe(1);
      expect(verification.entriesCount).toBe(2);
      expect(verification.isTrialBalanceBalanced).toBe(true);
      expect(verification.isDoctorClean).toBe(true);
      expect(verification.plainLanguageSummary).toContain('verified intact');
    });

    it('rejects backup verification with incorrect passphrase', async () => {
      const backupBundle = await createEncryptedBackup({
        branchId: '00000000-0000-0000-0000-000000000001',
        branchName: 'Calvary Crystal Assembly',
        exportedBy: 'Kofi Mensah (Treasurer)',
        passphrase: 'CorrectPassword123!',
        accounts: sampleAccounts,
        funds: sampleFunds,
        periods: samplePeriods,
        exchangeRates: sampleRates,
        entries: rawEntries,
      });

      await expect(verifyBackupArchiveSandbox(backupBundle, 'WrongPassword456!')).rejects.toThrow();
    });
  });

  describe('4. Doctor Check 17: Hash Chain Verification', () => {
    it('passes Doctor Check 17 when hash chain is verified clean', () => {
      const chained = chainJournalEntries(rawEntries);
      const report = diagnoseLedger({
        entries: chained,
        accounts: sampleAccounts,
        funds: sampleFunds,
        periods: samplePeriods,
        exchangeRates: sampleRates,
      });

      const r17Finding = report.findings.find((f) => f.ruleNumber === 17);
      expect(r17Finding).toBeUndefined();
    });

    it('flags an ERROR finding in Doctor Check 17 when hash chain tampering is detected', () => {
      const chained = chainJournalEntries(rawEntries);
      const tampered = [
        chained[0]!,
        {
          ...chained[1]!,
          totalDebitGhs: 888888n, // Tampered post-signing
        },
      ];

      const report = diagnoseLedger({
        entries: tampered,
        accounts: sampleAccounts,
        funds: sampleFunds,
        periods: samplePeriods,
        exchangeRates: sampleRates,
      });

      const r17Finding = report.findings.find((f) => f.ruleNumber === 17);
      expect(r17Finding).toBeDefined();
      expect(r17Finding!.severity).toBe('ERROR');
      expect(r17Finding!.title).toContain('General Ledger Anti-Tampering Hash-Chain Broken');
    });
  });
});
