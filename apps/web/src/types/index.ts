import type { Role, SyncQueueItem, SyncRejection, ConcurrencyConflict } from '@church/domain';

export interface UserSession {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: Role;
  readonly branchId: string;
  readonly branchName: string;
  readonly departmentId?: string;
  readonly deviceId: string;
  readonly devicePrefix: string;
}

export interface SyncStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingUploadCount: number;
  needsAttentionCount: number;
  conflictsCount: number;
  lastSyncedAt: Date | null;
  queue: SyncQueueItem[];
  rejections: SyncRejection[];
  conflicts: ConcurrencyConflict[];
}
