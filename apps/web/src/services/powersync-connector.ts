import {
  type SyncQueueItem,
  type SyncRejection,
  type ConcurrencyConflict,
  type SyncActionType,
  isPermanentSyncError,
} from '@church/domain';

export type RpcCaller = (rpcName: string, params: Record<string, unknown>) => Promise<{
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}>;

export interface UploadBatchResult {
  processedCount: number;
  succeededCount: number;
  newRejections: SyncRejection[];
  newConflicts: ConcurrencyConflict[];
  remainingQueue: SyncQueueItem[];
}

export class PowerSyncUploadConnector {
  private rpcCaller: RpcCaller;

  constructor(rpcCaller: RpcCaller) {
    this.rpcCaller = rpcCaller;
  }

  /**
   * Process pending offline queue items sequentially.
   * Permanent errors do NOT block the queue: they are converted to SyncRejections.
   * Concurrency conflicts are recorded with server & client snapshots.
   * Transient network errors halt the batch for exponential backoff retry.
   */
  async processUploadBatch(queue: SyncQueueItem[]): Promise<UploadBatchResult> {
    const remainingQueue: SyncQueueItem[] = [];
    const newRejections: SyncRejection[] = [];
    const newConflicts: ConcurrencyConflict[] = [];
    let processedCount = 0;
    let succeededCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]!;

      // Map action to corresponding RPC function name
      const rpcName = this.mapActionToRpc(item.action);
      if (!rpcName) {
        // Unknown action - permanent error
        newRejections.push({
          id: `rej-${item.id}`,
          transactionId: item.entityId,
          entityType: item.entityType,
          reason: `No RPC mapped for action ${item.action}`,
          payload: typeof item.payload === 'object' && item.payload !== null
            ? (item.payload as Record<string, unknown>)
            : { raw: item.payload },
          deviceId: item.deviceId,
          rejectedAt: new Date().toISOString(),
        });
        processedCount++;
        continue;
      }

      const payload = typeof item.payload === 'object' && item.payload !== null
        ? (item.payload as Record<string, unknown>)
        : {};

      try {
        const response = await this.rpcCaller(rpcName, payload);
        processedCount++;

        if (response.success) {
          succeededCount++;
          // Item successfully posted - do not add to remainingQueue
          continue;
        }

        const err = response.error ?? { code: 'UNKNOWN_ERROR', message: 'Unknown RPC error' };
        const fullErrorStr = `${err.code}: ${err.message}`;

        // Check for Optimistic Concurrency Conflict
        if (err.code === 'VERSION_CONFLICT') {
          newConflicts.push({
            entityType: item.entityType,
            recordId: item.entityId,
            clientVersion: (payload['client_version'] as number) ?? 1,
            serverVersion: ((err.details as Record<string, unknown>)?.['server_version'] as number) ?? 2,
            clientState: payload,
            serverState: ((err.details as Record<string, unknown>)?.['server_data'] as Record<string, unknown>) ?? {},
            message: err.message,
          });
          // Conflict recorded - remove from active upload queue
          continue;
        }

        // Check if error is permanent or transient
        if (isPermanentSyncError(fullErrorStr)) {
          // Permanent validation / business rule error: route to Needs Attention queue
          newRejections.push({
            id: `rej-${item.id}`,
            transactionId: item.entityId,
            entityType: item.entityType,
            reason: err.message,
            payload,
            deviceId: item.deviceId,
            rejectedAt: new Date().toISOString(),
          });
          // Does NOT block subsequent items
          continue;
        }

        // Transient error (e.g. timeout, 503, network drop)
        const nextAttempts = item.attempts + 1;
        remainingQueue.push({
          ...item,
          attempts: nextAttempts,
          status: 'QUEUED',
          lastAttemptedAt: new Date().toISOString(),
          rejectionReason: err.message,
        });

        // For transient errors, append all remaining items without attempting them now
        for (let j = i + 1; j < queue.length; j++) {
          remainingQueue.push(queue[j]!);
        }
        break;
      } catch (networkException) {
        // Network threw an exception (offline / unreachable)
        const nextAttempts = item.attempts + 1;
        const errMsg = networkException instanceof Error ? networkException.message : 'Network offline';

        remainingQueue.push({
          ...item,
          attempts: nextAttempts,
          status: 'QUEUED',
          lastAttemptedAt: new Date().toISOString(),
          rejectionReason: errMsg,
        });

        // Append remaining items to queue
        for (let j = i + 1; j < queue.length; j++) {
          remainingQueue.push(queue[j]!);
        }
        break;
      }
    }

    return {
      processedCount,
      succeededCount,
      newRejections,
      newConflicts,
      remainingQueue,
    };
  }

  private mapActionToRpc(action: SyncActionType): string | null {
    switch (action) {
      case 'POST_JOURNAL_ENTRY':
        return 'post_journal_entry';
      case 'SUBMIT_COUNTING_SHEET':
        return 'submit_counting_sheet';
      case 'UPDATE_MEMBER':
        return 'update_member_with_conflict_check';
      case 'CLOSE_PERIOD':
        return 'close_period_with_doctor_check';
      default:
        return null;
    }
  }
}
