export type SyncActionType =
  | 'POST_JOURNAL_ENTRY'
  | 'SUBMIT_COUNTING_SHEET'
  | 'APPROVE_REQUISITION'
  | 'UPDATE_MEMBER'
  | 'UPDATE_VENDOR'
  | 'CLOSE_PERIOD';

export type SyncItemStatus = 'QUEUED' | 'UPLOADING' | 'REJECTED' | 'CONFIRMED';

export interface SyncQueueItem<T = unknown> {
  readonly id: string; // Queue item UUID
  readonly entityType: string;
  readonly entityId: string; // Record UUID
  readonly action: SyncActionType;
  readonly payload: T;
  readonly deviceId: string;
  readonly attempts: number;
  readonly status: SyncItemStatus;
  readonly createdAt: string;
  readonly lastAttemptedAt?: string | null;
  readonly rejectionReason?: string | null;
}

export interface SyncRejection {
  readonly id: string;
  readonly transactionId: string;
  readonly entityType: string;
  readonly reason: string;
  readonly payload: Record<string, unknown>;
  readonly deviceId: string;
  readonly rejectedAt: string;
  readonly resolvedAt?: string | null;
  readonly resolvedBy?: string | null;
  readonly resolutionNotes?: string | null;
}

export interface ConcurrencyConflict {
  readonly entityType: string;
  readonly recordId: string;
  readonly clientVersion: number;
  readonly serverVersion: number;
  readonly clientState: Record<string, unknown>;
  readonly serverState: Record<string, unknown>;
  readonly message: string;
}

export interface BackupMetadata {
  readonly version: 1;
  readonly branchId: string;
  readonly branchName: string;
  readonly createdAt: string;
  readonly exportedBy: string;
  readonly entryCount: number;
  readonly checksum: string;
}

export interface EncryptedBackupBundle {
  readonly metadata: BackupMetadata;
  readonly salt: string; // Base64
  readonly iv: string;   // Base64
  readonly ciphertext: string; // Base64 encrypted JSON
}
