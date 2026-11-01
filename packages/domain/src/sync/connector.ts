import type {
  SyncQueueItem,
  SyncRejection,
  ConcurrencyConflict,
} from './types.js';

export interface ProcessItemResult {
  readonly success: boolean;
  readonly isPermanentError: boolean;
  readonly retryAfterMs?: number;
  readonly rejection?: SyncRejection;
  readonly conflict?: ConcurrencyConflict;
  readonly message?: string;
}

export const PERMANENT_ERROR_CODES = [
  'PERIOD_CLOSED',
  'PERMISSION_DENIED',
  'UNBALANCED_ENTRY',
  'VALIDATION_FAILED',
  'CONFLICT_DETECTED',
  'ALREADY_CLOSED',
  'DUPLICATE_DOCUMENT',
  'INVALID_EXCHANGE_RATE',
] as const;

/**
 * Checks whether an error message or code represents an unrecoverable validation failure
 * that must be moved to the Needs Attention queue rather than retried indefinitely.
 */
export function isPermanentSyncError(errorString: string): boolean {
  return PERMANENT_ERROR_CODES.some((code) => errorString.includes(code));
}

/**
 * Computes exponential backoff for transient upload failures.
 */
export function calculateBackoffMs(attempts: number, baseMs: number = 1000, maxMs: number = 30000): number {
  const exp = Math.min(attempts, 6);
  const backoff = baseMs * Math.pow(2, exp);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(backoff + jitter, maxMs);
}

/**
 * Validates mutable record version for optimistic locking.
 */
export function verifyOptimisticConcurrency(
  clientVersion: number,
  serverVersion: number,
  entityType: string,
  recordId: string,
  clientState: Record<string, unknown>,
  serverState: Record<string, unknown>
): ConcurrencyConflict | null {
  if (clientVersion !== serverVersion) {
    return {
      entityType,
      recordId,
      clientVersion,
      serverVersion,
      clientState,
      serverState,
      message: `Conflict detected on ${entityType}: Server version is ${serverVersion}, but local device is on ${clientVersion}.`,
    };
  }
  return null;
}

/**
 * Simulates or handles execution of a single queued transaction.
 * Permanently rejected items are removed from upload queue and placed into `sync_rejections`.
 */
export function evaluateQueueItemResult(
  item: SyncQueueItem,
  errorString?: string
): ProcessItemResult {
  if (!errorString) {
    return {
      success: true,
      isPermanentError: false,
      message: 'Transaction successfully processed and confirmed by server.',
    };
  }

  const isPermanent = isPermanentSyncError(errorString);

  if (isPermanent) {
    const rejection: SyncRejection = {
      id: `rej-${Date.now()}-${item.id}`,
      transactionId: item.entityId,
      entityType: item.entityType,
      reason: errorString,
      payload: (typeof item.payload === 'object' && item.payload !== null)
        ? (item.payload as Record<string, unknown>)
        : { raw: item.payload },
      deviceId: item.deviceId,
      rejectedAt: new Date().toISOString(),
    };

    return {
      success: false,
      isPermanentError: true,
      rejection,
      message: `Permanent failure: Moved to Needs Attention queue without blocking upload queue. Reason: ${errorString}`,
    };
  }

  // Transient failure (network/timeout)
  return {
    success: false,
    isPermanentError: false,
    retryAfterMs: calculateBackoffMs(item.attempts),
    message: `Transient failure: Scheduled for retry with exponential backoff. Details: ${errorString}`,
  };
}
