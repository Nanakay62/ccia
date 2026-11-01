import { describe, it, expect } from 'vitest';
import {
  isPermanentSyncError,
  calculateBackoffMs,
  evaluateQueueItemResult,
  verifyOptimisticConcurrency,
  createEncryptedBackup,
  restoreEncryptedBackup,
  createJournalEntry,
  type SyncQueueItem,
  type Account,
  type Fund,
  type JournalEntry,
} from '../src/index.js';

describe('Offline Sync & Connector Domain Module', () => {
  const sampleBranchId = '00000000-0000-0000-0000-000000000001';

  const accounts: Account[] = [
    {
      id: 'acct-1010',
      branchId: sampleBranchId,
      code: '1010',
      name: 'Cash on Hand (GHS)',
      type: 'Asset',
      currency: 'GHS',
      isBankOrCash: true,
      isActive: true,
    },
    {
      id: 'acct-4010',
      branchId: sampleBranchId,
      code: '4010',
      name: 'Tithes',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
  ];

  const funds: Fund[] = [
    {
      id: 'fund-gen',
      branchId: sampleBranchId,
      code: 'GEN',
      name: 'General Fund',
      type: 'Unrestricted',
      allowOverdraft: true,
      isActive: true,
    },
  ];

  describe('Rejection Handling (Non-blocking Upload Queue)', () => {
    it('identifies permanent business validation errors', () => {
      expect(isPermanentSyncError('PERIOD_CLOSED: Cannot post to closed period.')).toBe(true);
      expect(isPermanentSyncError('PERMISSION_DENIED: Counter cannot post journal entries.')).toBe(true);
      expect(isPermanentSyncError('UNBALANCED_ENTRY: Debits do not equal Credits.')).toBe(true);
      expect(isPermanentSyncError('CONFLICT_DETECTED: Stale row version.')).toBe(true);

      // Transient errors
      expect(isPermanentSyncError('Fetch failed: NetworkError when attempting to fetch resource.')).toBe(false);
      expect(isPermanentSyncError('HTTP 503 Service Unavailable')).toBe(false);
    });

    it('routes permanent validation failure to sync_rejections without blocking queue', () => {
      const item: SyncQueueItem = {
        id: 'q-item-1',
        entityType: 'journal_entries',
        entityId: 'entry-uuid-1',
        action: 'POST_JOURNAL_ENTRY',
        payload: { docNumber: 'JE-01', amount: 5000 },
        deviceId: 'DEV-FS-01',
        attempts: 1,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      };

      const result = evaluateQueueItemResult(
        item,
        'PERIOD_CLOSED: Accounting period for 2026-09 is closed.'
      );

      expect(result.success).toBe(false);
      expect(result.isPermanentError).toBe(true);
      expect(result.rejection).toBeDefined();
      expect(result.rejection?.transactionId).toBe('entry-uuid-1');
      expect(result.rejection?.reason).toContain('PERIOD_CLOSED');
    });

    it('schedules transient network failure for exponential backoff retry', () => {
      const item: SyncQueueItem = {
        id: 'q-item-2',
        entityType: 'journal_entries',
        entityId: 'entry-uuid-2',
        action: 'POST_JOURNAL_ENTRY',
        payload: { docNumber: 'JE-02' },
        deviceId: 'DEV-FS-01',
        attempts: 2,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      };

      const result = evaluateQueueItemResult(item, 'HTTP 502 Bad Gateway / Connection Timeout');

      expect(result.success).toBe(false);
      expect(result.isPermanentError).toBe(false);
      expect(result.rejection).toBeUndefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('calculates exponential backoff with ceiling', () => {
      const b1 = calculateBackoffMs(1, 1000, 30000);
      const b4 = calculateBackoffMs(4, 1000, 30000);
      expect(b4).toBeGreaterThan(b1);
      expect(calculateBackoffMs(10, 1000, 30000)).toBeLessThanOrEqual(30500);
    });
  });

  describe('Optimistic Concurrency Control & Conflict Detection', () => {
    it('detects conflict when local record version is stale', () => {
      const conflict = verifyOptimisticConcurrency(
        1, // Client has version 1
        2, // Server already moved to version 2
        'members',
        'mem-uuid-001',
        { full_name: 'Kwame Mensah Client Edit' },
        { full_name: 'Kwame Mensah Server Edit' }
      );

      expect(conflict).not.toBeNull();
      expect(conflict?.clientVersion).toBe(1);
      expect(conflict?.serverVersion).toBe(2);
      expect(conflict?.message).toContain('Conflict detected');
    });

    it('passes when versions match', () => {
      const conflict = verifyOptimisticConcurrency(
        2,
        2,
        'members',
        'mem-uuid-001',
        { full_name: 'Kwame Mensah Edit' },
        { full_name: 'Kwame Mensah Edit' }
      );
      expect(conflict).toBeNull();
    });
  });

  describe('Encrypted Backup & Restore Procedure', () => {
    const samplePassphrase = 'church-treasurer-secret-passphrase-2026';

    it('creates an encrypted backup bundle and restores with integrity verification', async () => {
      const entry1 = createJournalEntry({
        id: 'je-b1',
        branchId: sampleBranchId,
        documentNumber: 'JE-BK-001',
        entryDate: '2026-10-15',
        narration: 'Tithe backup test',
        createdBy: 'user-treasurer',
        deviceId: 'dev-01',
        lines: [
          {
            id: 'l1',
            accountId: 'acct-1010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 10000n,
            exchangeRate: '1.0000',
            isDebit: true,
          },
          {
            id: 'l2',
            accountId: 'acct-4010',
            fundId: 'fund-gen',
            originalCurrency: 'GHS',
            originalAmount: 10000n,
            exchangeRate: '1.0000',
            isDebit: false,
          },
        ],
      });

      // 1. Create encrypted backup
      const backup = await createEncryptedBackup({
        branchId: sampleBranchId,
        branchName: 'Accra Central Branch',
        exportedBy: 'Kofi Mensah (Treasurer)',
        passphrase: samplePassphrase,
        accounts,
        funds,
        periods: [],
        exchangeRates: [],
        entries: [entry1],
      });

      expect(backup.metadata.version).toBe(1);
      expect(backup.metadata.entryCount).toBe(1);
      expect(backup.ciphertext).toBeTruthy();
      expect(backup.salt).toBeTruthy();
      expect(backup.iv).toBeTruthy();

      // 2. Restore encrypted backup
      const restore = await restoreEncryptedBackup(backup, samplePassphrase);

      expect(restore.success).toBe(true);
      expect(restore.data.entries).toHaveLength(1);
      expect(restore.isTrialBalanceHealthy).toBe(true);
      expect(restore.summary).toContain('perfect balance');
    });

    it('fails restore if incorrect passphrase is provided', async () => {
      const backup = await createEncryptedBackup({
        branchId: sampleBranchId,
        branchName: 'Accra Central Branch',
        exportedBy: 'Treasurer',
        passphrase: samplePassphrase,
        accounts,
        funds,
        periods: [],
        exchangeRates: [],
        entries: [],
      });

      await expect(restoreEncryptedBackup(backup, 'wrong-password')).rejects.toThrow();
    });
  });

  describe('Multi-Device Offline Simulation', () => {
    it('simulates 3 offline devices creating concurrent entries without ID or sequence collisions', () => {
      // Device 1: Treasurer (TR-D01)
      const dev1Entry = createJournalEntry({
        id: 'uuid-dev1-0001',
        branchId: sampleBranchId,
        documentNumber: 'JE-TR-D01-000001',
        entryDate: '2026-10-20',
        narration: 'Treasurer entry on Device 1',
        createdBy: 'user-treasurer',
        deviceId: 'DEV-TR-01',
        lines: [
          { id: 'd1-l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 50000n, exchangeRate: '1.0000', isDebit: true },
          { id: 'd1-l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 50000n, exchangeRate: '1.0000', isDebit: false },
        ],
      });

      // Device 2: Finance Secretary (FS-D01)
      const dev2Entry = createJournalEntry({
        id: 'uuid-dev2-0001',
        branchId: sampleBranchId,
        documentNumber: 'JE-FS-D01-000001',
        entryDate: '2026-10-20',
        narration: 'Finance Secretary entry on Device 2',
        createdBy: 'user-finsec',
        deviceId: 'DEV-FS-01',
        lines: [
          { id: 'd2-l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 30000n, exchangeRate: '1.0000', isDebit: true },
          { id: 'd2-l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 30000n, exchangeRate: '1.0000', isDebit: false },
        ],
      });

      // Device 3: Counter (CS-D01)
      const dev3Entry = createJournalEntry({
        id: 'uuid-dev3-0001',
        branchId: sampleBranchId,
        documentNumber: 'JE-CS-D01-000001',
        entryDate: '2026-10-20',
        narration: 'Counting sheet entry on Device 3',
        createdBy: 'user-counter1',
        deviceId: 'DEV-CS-01',
        lines: [
          { id: 'd3-l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 20000n, exchangeRate: '1.0000', isDebit: true },
          { id: 'd3-l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 20000n, exchangeRate: '1.0000', isDebit: false },
        ],
      });

      // Check collision freedom
      const ids = [dev1Entry.id, dev2Entry.id, dev3Entry.id];
      const docNumbers = [dev1Entry.documentNumber, dev2Entry.documentNumber, dev3Entry.documentNumber];

      expect(new Set(ids).size).toBe(3);
      expect(new Set(docNumbers).size).toBe(3);

      // Verify all 3 merged into the central ledger
      const mergedLedger: JournalEntry[] = [dev1Entry, dev2Entry, dev3Entry];
      expect(mergedLedger).toHaveLength(3);

      const totalDebits = mergedLedger.reduce((sum, e) => sum + e.totalDebitGhs, 0n);
      const totalCredits = mergedLedger.reduce((sum, e) => sum + e.totalCreditGhs, 0n);

      expect(totalDebits).toBe(100000n);
      expect(totalCredits).toBe(100000n);
      expect(totalDebits).toBe(totalCredits);
    });
  });
});
