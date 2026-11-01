import type { Role } from '@church/domain';

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
  lastSyncedAt: Date | null;
  rejections: Array<{
    id: string;
    entityType: string;
    reason: string;
    rejectedAt: string;
  }>;
}
