import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PowerSyncUploadConnector } from '../src/services/powersync-connector.js';
import type { SyncQueueItem } from '@church/domain';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { SyncIndicator } from '../src/components/SyncIndicator.js';
import { BackupRestoreCard } from '../src/components/settings/BackupRestoreCard.js';

describe('Phase 3: PowerSync Upload Connector & Rejection Routing', () => {
  it('processes valid transactions and clears them from upload batch', async () => {
    const mockRpc = async (rpcName: string, _params: Record<string, unknown>) => {
      expect(rpcName).toBe('post_journal_entry');
      return { success: true, data: { id: 'posted-1' } };
    };

    const connector = new PowerSyncUploadConnector(mockRpc);
    const queue: SyncQueueItem[] = [
      {
        id: 'q1',
        entityId: 'entry-1',
        entityType: 'JOURNAL_ENTRY',
        action: 'POST_JOURNAL_ENTRY',
        payload: { document_number: 'JE-001' },
        deviceId: 'DEV-01',
        attempts: 0,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await connector.processUploadBatch(queue);
    expect(result.succeededCount).toBe(1);
    expect(result.newRejections.length).toBe(0);
    expect(result.remainingQueue.length).toBe(0);
  });

  it('isolates permanent failure into Needs Attention queue without blocking subsequent items', async () => {
    const mockRpc = async (rpcName: string, params: Record<string, unknown>) => {
      if (params['document_number'] === 'JE-CLOSED') {
        return {
          success: false,
          error: {
            code: 'PERIOD_CLOSED',
            message: 'Accounting period 2026-09 is closed.',
          },
        };
      }
      return { success: true, data: { id: 'posted-ok' } };
    };

    const connector = new PowerSyncUploadConnector(mockRpc);
    const queue: SyncQueueItem[] = [
      {
        id: 'q-bad',
        entityId: 'entry-closed',
        entityType: 'JOURNAL_ENTRY',
        action: 'POST_JOURNAL_ENTRY',
        payload: { document_number: 'JE-CLOSED' },
        deviceId: 'DEV-01',
        attempts: 0,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q-good',
        entityId: 'entry-valid',
        entityType: 'JOURNAL_ENTRY',
        action: 'POST_JOURNAL_ENTRY',
        payload: { document_number: 'JE-VALID' },
        deviceId: 'DEV-01',
        attempts: 0,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await connector.processUploadBatch(queue);
    expect(result.processedCount).toBe(2);
    expect(result.succeededCount).toBe(1);
    expect(result.newRejections.length).toBe(1);
    expect(result.newRejections[0]?.transactionId).toBe('entry-closed');
    expect(result.newRejections[0]?.reason).toContain('period 2026-09 is closed');
    expect(result.remainingQueue.length).toBe(0); // Valid item succeeded, invalid item isolated!
  });

  it('detects optimistic concurrency conflicts on mutable records and preserves snapshots', async () => {
    const mockRpc = async (_rpcName: string, _params: Record<string, unknown>) => {
      return {
        success: false,
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Client version 1 superseded by server version 2',
          details: {
            server_version: 2,
            server_data: { phone: '+233 24 000 1111' },
          },
        },
      };
    };

    const connector = new PowerSyncUploadConnector(mockRpc);
    const queue: SyncQueueItem[] = [
      {
        id: 'q-conf',
        entityId: 'mem-101',
        entityType: 'MEMBER',
        action: 'UPDATE_MEMBER',
        payload: { client_version: 1, phone: '+233 50 222 3333' },
        deviceId: 'DEV-02',
        attempts: 0,
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await connector.processUploadBatch(queue);
    expect(result.newConflicts.length).toBe(1);
    expect(result.newConflicts[0]?.recordId).toBe('mem-101');
    expect(result.newConflicts[0]?.clientVersion).toBe(1);
    expect(result.newConflicts[0]?.serverVersion).toBe(2);
  });
});

describe('Phase 3: Web UI Sync & Backup Components', () => {
  it('renders SyncIndicator and opens Needs Attention modal when rejections exist', async () => {
    render(
      <AuthProvider>
        <DemoProvider>
          <LedgerProvider>
            <SyncProvider>
              <SyncIndicator />
            </SyncProvider>
          </LedgerProvider>
        </DemoProvider>
      </AuthProvider>
    );

    // Initial state has seed rejection
    const needAttentionBtn = screen.getByText(/Need Attention/i);
    expect(needAttentionBtn).toBeDefined();

    // Click to open modal
    fireEvent.click(needAttentionBtn);
    expect(screen.getByText(/Sync Rejections: Needs Attention/i)).toBeDefined();
    expect(screen.getByText(/Non-Blocking Rejection Protocol/i)).toBeDefined();

    // Verify rejection details are shown
    expect(screen.getByText(/JE-FS-000088/i)).toBeDefined();
    expect(screen.getByText(/Closed period cannot receive new postings/i)).toBeDefined();
  });

  it('renders BackupRestoreCard and provides multi-device simulation controls', async () => {
    render(
      <AuthProvider>
        <DemoProvider>
          <LedgerProvider>
            <SyncProvider>
              <BackupRestoreCard />
            </SyncProvider>
          </LedgerProvider>
        </DemoProvider>
      </AuthProvider>
    );

    expect(screen.getByText(/Encrypted Local Backups/i)).toBeDefined();
    expect(screen.getByText(/Export Encrypted Snapshot/i)).toBeDefined();
    expect(screen.getByText(/Multi-Device Offline Simulation Sandbox/i)).toBeDefined();

    // Run Non-Conflicting simulation
    const scenario1Btn = screen.getByText(/Scenario 1: Non-Conflicting Sync/i);
    fireEvent.click(scenario1Btn);

    await waitFor(() => {
      expect(screen.getByText(/SIMULATION START: Two devices go offline simultaneously/i)).toBeDefined();
      expect(screen.getByText(/DOCTOR STATUS: Trial balance is balanced/i)).toBeDefined();
    });
  });
});
