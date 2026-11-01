export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'REVERSAL'
  | 'APPROVAL'
  | 'REJECTION'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ROLE_CHANGE'
  | 'PERIOD_CLOSE'
  | 'PERIOD_REOPEN'
  | 'EXCHANGE_RATE_SET'
  | 'TREASURER_OVERRIDE'
  | 'INTEGRITY_RUN';

export interface AuditLogEntry {
  readonly id: string; // UUID
  readonly branchId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly performedBy: string; // User UUID or name
  readonly performedAt: string; // ISO 8601
  readonly deviceId: string;
  readonly reason?: string | null;
  readonly beforeState?: Record<string, unknown> | null;
  readonly afterState?: Record<string, unknown> | null;
  readonly clientMetadata?: Record<string, unknown> | null;
}

/**
 * Creates an audit log payload adhering to the append-only schema.
 */
export function createAuditRecord(params: {
  id: string;
  branchId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  deviceId: string;
  reason?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  clientMetadata?: Record<string, unknown> | null;
}): AuditLogEntry {
  return {
    id: params.id,
    branchId: params.branchId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    performedBy: params.performedBy,
    performedAt: new Date().toISOString(),
    deviceId: params.deviceId,
    reason: params.reason ?? null,
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
    clientMetadata: params.clientMetadata ?? null,
  };
}

/**
 * Calculates a shallow or property-level difference between two states for clear audit viewing.
 */
export function computeStateDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): {
  added: Record<string, unknown>;
  modified: Record<string, { before: unknown; after: unknown }>;
  deleted: Record<string, unknown>;
} {
  const b = before ?? {};
  const a = after ?? {};

  const added: Record<string, unknown> = {};
  const modified: Record<string, { before: unknown; after: unknown }> = {};
  const deleted: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);

  for (const key of allKeys) {
    if (!(key in b)) {
      added[key] = a[key];
    } else if (!(key in a)) {
      deleted[key] = b[key];
    } else if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      modified[key] = { before: b[key], after: a[key] };
    }
  }

  return { added, modified, deleted };
}
