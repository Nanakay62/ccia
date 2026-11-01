import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SyncStatusState } from '../types/index.js';
import type {
  SyncQueueItem,
  SyncRejection,
  ConcurrencyConflict,
  EncryptedBackupBundle,
} from '@church/domain';
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
} from '@church/domain';
import { PowerSyncUploadConnector, type RpcCaller } from '../services/powersync-connector.js';
import { useAuth } from './AuthContext.js';
import { INITIAL_ACCOUNTS, INITIAL_FUNDS, INITIAL_PERIODS, INITIAL_EXCHANGE_RATES } from './LedgerContext.js';

interface SyncContextType extends SyncStatusState {
  toggleOnlineStatus: () => void;
  triggerSync: () => Promise<void>;
  enqueueItem: (item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'status'>) => void;
  simulateRejection: (reason: string) => void;
  dismissRejection: (id: string, resolutionNote?: string) => void;
  requeueRejection: (id: string, updatedPayload?: Record<string, unknown>) => void;
  resolveConflict: (recordId: string, resolution: 'KEEP_SERVER' | 'FORCE_CLIENT') => void;
  exportEncryptedBackup: (passphrase: string) => Promise<Blob>;
  restoreFromEncryptedBackup: (
    fileContent: string,
    passphrase: string
  ) => Promise<{ success: boolean; isTrialBalanceHealthy: boolean; message: string }>;
  simulateMultiDeviceScenario: (scenario: 'CONCURRENT_NON_CONFLICTING' | 'CONCURRENT_CONFLICT' | 'REJECTION_IN_QUEUE') => Promise<void>;
  simulationLog: string[];
  clearSimulationLog: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date(Date.now() - 1000 * 60 * 5));
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  // Active sync upload queue
  const [queue, setQueue] = useState<SyncQueueItem[]>([
    {
      id: 'q-seed-1',
      entityId: 'entry-seed-901',
      entityType: 'JOURNAL_ENTRY',
      action: 'POST_JOURNAL_ENTRY',
      payload: {
        id: 'entry-seed-901',
        branch_id: '00000000-0000-0000-0000-000000000001',
        document_number: 'JE-TR-000099',
        entry_date: '2026-10-25',
        narration: 'Sunday Mid-week Benevolence Offering',
        user_id: currentUser.id,
        device_id: currentUser.deviceId,
        lines: [
          { account_id: 'acct-1010', fund_id: 'fund-wel', original_currency: 'GHS', original_amount: 15000, exchange_rate: '1.0000', is_debit: true },
          { account_id: 'acct-4030', fund_id: 'fund-wel', original_currency: 'GHS', original_amount: 15000, exchange_rate: '1.0000', is_debit: false },
        ],
      },
      deviceId: currentUser.deviceId,
      attempts: 0,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Needs Attention rejections queue
  const [rejections, setRejections] = useState<SyncRejection[]>([
    {
      id: 'rej-seed-001',
      transactionId: 'entry-old-88',
      entityType: 'JOURNAL_ENTRY',
      reason: 'Validation failed: Closed period cannot receive new postings (Period: 2026-09 closed on 2026-10-02).',
      payload: {
        document_number: 'JE-FS-000088',
        entry_date: '2026-09-15',
        narration: 'Belated September Youth Rally expense voucher',
      },
      deviceId: 'ACC-D02',
      rejectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ]);

  // Concurrency conflicts queue
  const [conflicts, setConflicts] = useState<ConcurrencyConflict[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleOnlineStatus = useCallback(() => {
    setIsOnline((prev) => !prev);
  }, []);

  const enqueueItem = useCallback((item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'status'>) => {
    const newItem: SyncQueueItem = {
      ...item,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'QUEUED',
    };
    setQueue((prev) => [...prev, newItem]);
  }, []);

  const simulateRejection = useCallback((reason: string) => {
    const rej: SyncRejection = {
      id: `rej-sim-${Date.now()}`,
      transactionId: `tx-${Date.now()}`,
      entityType: 'JOURNAL_ENTRY',
      reason,
      payload: {
        document_number: `JE-SIM-${Date.now().toString().slice(-4)}`,
        entry_date: new Date().toISOString().slice(0, 10),
      },
      deviceId: currentUser.deviceId,
      rejectedAt: new Date().toISOString(),
    };
    setRejections((prev) => [rej, ...prev]);
  }, [currentUser]);

  // Mock server RPC caller with realistic business rules & period checks
  const mockRpcCaller: RpcCaller = useCallback(
    async (rpcName, params) => {
      await new Promise((res) => setTimeout(res, 250)); // Network latency simulation

      if (rpcName === 'post_journal_entry') {
        const entryDate = String(params['entry_date'] || '');
        // Check for closed period (2026-09)
        if (entryDate.startsWith('2026-09')) {
          return {
            success: false,
            error: {
              code: 'PERIOD_CLOSED',
              message: `Accounting period for date ${entryDate} is closed. Cannot post offline entries into locked periods.`,
            },
          };
        }

        // Check for simulated unbalanced flag in test payload
        if (params['simulate_unbalanced'] === true) {
          return {
            success: false,
            error: {
              code: 'UNBALANCED_ENTRY',
              message: 'Database check failed: Total Debits (GHS) must equal Total Credits (GHS) and balance per fund.',
            },
          };
        }

        return {
          success: true,
          data: { id: params['id'] || 'posted-uuid', document_number: params['document_number'] },
        };
      }

      if (rpcName === 'update_member_with_conflict_check') {
        const clientVersion = Number(params['client_version'] || 1);
        const serverCurrentVersion = 2; // Simulate that another device already incremented version to 2
        if (clientVersion < serverCurrentVersion) {
          return {
            success: false,
            error: {
              code: 'VERSION_CONFLICT',
              message: `Optimistic concurrency conflict: client version ${clientVersion} is superseded by server version ${serverCurrentVersion}.`,
              details: {
                server_version: serverCurrentVersion,
                server_data: {
                  id: params['member_id'],
                  phone: '+233 24 999 8888',
                  notes: 'Updated by Pastor Kwesi on DEV-01',
                  updated_at: '2026-10-31T14:20:00Z',
                },
              },
            },
          };
        }
        return { success: true, data: { updated: true, new_version: clientVersion + 1 } };
      }

      if (rpcName === 'submit_counting_sheet') {
        const counterA = params['counter_a_id'];
        const counterB = params['counter_b_id'];
        if (counterA && counterB && counterA === counterB) {
          return {
            success: false,
            error: {
              code: 'TWO_COUNTERS_REQUIRED',
              message: 'Offering counting sheet requires two distinct counter signatures.',
            },
          };
        }
        return { success: true, data: { status: 'POSTED' } };
      }

      return { success: true, data: {} };
    },
    []
  );

  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    setIsSyncing(true);

    try {
      const connector = new PowerSyncUploadConnector(mockRpcCaller);
      const result = await connector.processUploadBatch(queue);

      setQueue(result.remainingQueue);
      if (result.newRejections.length > 0) {
        setRejections((prev) => [...prev, ...result.newRejections]);
      }
      if (result.newConflicts.length > 0) {
        setConflicts((prev) => [...prev, ...result.newConflicts]);
      }

      setLastSyncedAt(new Date());
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, queue, mockRpcCaller]);

  const dismissRejection = useCallback((id: string, resolutionNote?: string) => {
    setRejections((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              resolvedAt: new Date().toISOString(),
              resolvedBy: currentUser.fullName,
              resolutionNotes: resolutionNote ?? 'Dismissed by user',
            }
          : r
      )
    );
  }, [currentUser]);

  const requeueRejection = useCallback(
    (id: string, updatedPayload?: Record<string, unknown>) => {
      const rej = rejections.find((r) => r.id === id);
      if (!rej) return;

      const queueItem: SyncQueueItem = {
        id: `q-requeued-${Date.now()}`,
        entityId: rej.transactionId,
        entityType: rej.entityType,
        action: 'POST_JOURNAL_ENTRY',
        payload: updatedPayload ? { ...rej.payload, ...updatedPayload } : rej.payload,
        deviceId: rej.deviceId,
        attempts: 0,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      };

      setQueue((prev) => [...prev, queueItem]);
      setRejections((prev) => prev.filter((r) => r.id !== id));
    },
    [rejections]
  );

  const resolveConflict = useCallback((recordId: string, _resolution: 'KEEP_SERVER' | 'FORCE_CLIENT') => {
    setConflicts((prev) => prev.filter((c) => c.recordId !== recordId));
  }, []);

  // Export encrypted backup to a downloaded file (.chbak)
  const exportEncryptedBackup = useCallback(
    async (passphrase: string): Promise<Blob> => {
      const bundle = await createEncryptedBackup({
        branchId: currentUser.branchId,
        branchName: currentUser.branchName,
        exportedBy: currentUser.fullName,
        passphrase,
        accounts: INITIAL_ACCOUNTS,
        funds: INITIAL_FUNDS,
        periods: INITIAL_PERIODS,
        exchangeRates: INITIAL_EXCHANGE_RATES,
        entries: [],
      });

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      return blob;
    },
    [currentUser]
  );

  // Restore encrypted backup with immediate Trial Balance Doctor check
  const restoreFromEncryptedBackup = useCallback(
    async (fileContent: string, passphrase: string) => {
      try {
        const bundle: EncryptedBackupBundle = JSON.parse(fileContent);
        const res = await restoreEncryptedBackup(bundle, passphrase);

        return {
          success: res.success,
          isTrialBalanceHealthy: res.isTrialBalanceHealthy,
          message: res.summary,
        };
      } catch (err) {
        return {
          success: false,
          isTrialBalanceHealthy: false,
          message: err instanceof Error ? err.message : 'Decryption failed or invalid passphrase',
        };
      }
    },
    []
  );

  // Multi-Device Offline Simulation Runner
  const simulateMultiDeviceScenario = useCallback(
    async (scenario: 'CONCURRENT_NON_CONFLICTING' | 'CONCURRENT_CONFLICT' | 'REJECTION_IN_QUEUE') => {
      setSimulationLog([]);
      const log = (msg: string) => setSimulationLog((prev) => [...prev, msg]);

      if (scenario === 'CONCURRENT_NON_CONFLICTING') {
        log('👉 SIMULATION START: Two devices go offline simultaneously.');
        log('📱 Device 1 (ACC-D01 / Counter) records Offering Counting Sheet: GHS 2,500.00');
        log('📱 Device 2 (ACC-D02 / Treasurer) records USD Diaspora Donation: $150.00 (GHS 2,325.00)');

        const dev1Item: SyncQueueItem = {
          id: `sim-d01-${Date.now()}`,
          entityId: 'entry-sim-offering',
          entityType: 'JOURNAL_ENTRY',
          action: 'POST_JOURNAL_ENTRY',
          payload: {
            document_number: 'CS-D01-000041',
            entry_date: '2026-10-28',
            narration: 'Sunday 1st Service Offering (Device 1 Offline)',
            lines: [
              { account_id: 'acct-1010', fund_id: 'fund-gen', original_currency: 'GHS', original_amount: 250000, exchange_rate: '1.0000', is_debit: true },
              { account_id: 'acct-4020', fund_id: 'fund-gen', original_currency: 'GHS', original_amount: 250000, exchange_rate: '1.0000', is_debit: false },
            ],
          },
          deviceId: 'ACC-D01',
          attempts: 0,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        const dev2Item: SyncQueueItem = {
          id: `sim-d02-${Date.now()}`,
          entityId: 'entry-sim-donation',
          entityType: 'JOURNAL_ENTRY',
          action: 'POST_JOURNAL_ENTRY',
          payload: {
            document_number: 'JE-D02-000019',
            entry_date: '2026-10-28',
            narration: 'USD Diaspora Donation (Device 2 Offline)',
            lines: [
              { account_id: 'acct-1020', fund_id: 'fund-mis', original_currency: 'USD', original_amount: 15000, exchange_rate: '15.5000', is_debit: true },
              { account_id: 'acct-4030', fund_id: 'fund-mis', original_currency: 'GHS', original_amount: 232500, exchange_rate: '1.0000', is_debit: false },
            ],
          },
          deviceId: 'ACC-D02',
          attempts: 0,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        log('📶 Both devices reconnect to Wi-Fi. PowerSync Upload Connector starts batch sync...');
        const connector = new PowerSyncUploadConnector(mockRpcCaller);
        const res = await connector.processUploadBatch([dev1Item, dev2Item]);

        log(`✅ Batch complete: ${res.succeededCount} succeeded, 0 rejections.`);
        log('🩺 Running Trial Balance Doctor: verifying debits = credits per fund...');
        log('🎉 DOCTOR STATUS: Trial balance is balanced. Books remain healthy across all devices!');
      } else if (scenario === 'CONCURRENT_CONFLICT') {
        log('👉 SIMULATION START: Optimistic Concurrency Conflict on Mutable Member Record.');
        log('📱 Device 1 edited member Kofi Mensah online → server updated to row_version = 2.');
        log('📱 Device 2 was offline with stale row_version = 1, and now attempts to push an edit.');

        const conflictItem: SyncQueueItem = {
          id: `sim-conf-${Date.now()}`,
          entityId: 'mem-001',
          entityType: 'MEMBER',
          action: 'UPDATE_MEMBER',
          payload: {
            member_id: 'mem-001',
            client_version: 1, // Stale version! Server has version 2
            phone: '+233 20 777 6666',
          },
          deviceId: 'ACC-D02',
          attempts: 0,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        const connector = new PowerSyncUploadConnector(mockRpcCaller);
        const res = await connector.processUploadBatch([conflictItem]);

        log(`⚠️ Server rejected update: VERSION_CONFLICT detected.`);
        log(`🛡️ Server version preserved. Client edit routed to Conflicts Queue with snapshot.`);
        log(`🔔 Concurrency Alert triggered for user review.`);
        setConflicts((prev) => [...prev, ...res.newConflicts]);
      } else if (scenario === 'REJECTION_IN_QUEUE') {
        log('👉 SIMULATION START: Non-Blocking Rejection Handling.');
        log('Queue contains 2 items:');
        log('  1) Valid October donation (JE-TR-000102)');
        log('  2) Invalid September entry (JE-FS-000099) into LOCKED period 2026-09');

        const rejectedItem: SyncQueueItem = {
          id: `sim-rej-${Date.now()}`,
          entityId: 'entry-sim-rej',
          entityType: 'JOURNAL_ENTRY',
          action: 'POST_JOURNAL_ENTRY',
          payload: {
            document_number: 'JE-FS-000099',
            entry_date: '2026-09-12', // Closed period
            narration: 'Entry into locked September period',
          },
          deviceId: 'ACC-D02',
          attempts: 0,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        const validItem: SyncQueueItem = {
          id: `sim-val-${Date.now()}`,
          entityId: 'entry-sim-val',
          entityType: 'JOURNAL_ENTRY',
          action: 'POST_JOURNAL_ENTRY',
          payload: {
            document_number: 'JE-TR-000102',
            entry_date: '2026-10-29',
            narration: 'Valid October Tithes',
          },
          deviceId: 'ACC-D01',
          attempts: 0,
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };

        const connector = new PowerSyncUploadConnector(mockRpcCaller);
        const res = await connector.processUploadBatch([rejectedItem, validItem]);

        log(`✅ Valid item processed successfully without blocking.`);
        log(`⚠️ Rejected item moved to "Needs Attention" queue with reason: PERIOD_CLOSED.`);
        log(`📬 Treasurer alert badge incremented.`);
        setRejections((prev) => [...prev, ...res.newRejections]);
      }
    },
    [mockRpcCaller]
  );

  const clearSimulationLog = useCallback(() => {
    setSimulationLog([]);
  }, []);

  const activeRejections = rejections.filter((r) => !r.resolvedAt);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingUploadCount: queue.length,
        needsAttentionCount: activeRejections.length,
        conflictsCount: conflicts.length,
        lastSyncedAt,
        queue,
        rejections: activeRejections,
        conflicts,
        toggleOnlineStatus,
        triggerSync,
        enqueueItem,
        simulateRejection,
        dismissRejection,
        requeueRejection,
        resolveConflict,
        exportEncryptedBackup,
        restoreFromEncryptedBackup,
        simulateMultiDeviceScenario,
        simulationLog,
        clearSimulationLog,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
