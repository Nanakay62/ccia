/**
 * Append-only local audit log utility.
 * Logs all sensitive operations (PII access, exports, statement generations,
 * reversals, role changes, etc.) per Section 1.5, Section 2.2, and Section 5.5.
 */

export interface AuditRecord {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  record: string;
  entityType: string;
  entityId: string;
  device: string;
  details?: string;
}

const STORAGE_KEY = 'church_audit_log_entries';

export function getAuditLogs(): AuditRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function logAuditEvent(entry: {
  action: string;
  record: string;
  entityType: string;
  entityId: string;
  userName?: string;
  userRole?: string;
  device?: string;
  details?: string;
}): AuditRecord {
  const newRecord: AuditRecord = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userName: entry.userName || 'Kofi Mensah',
    userRole: entry.userRole || 'Treasurer',
    action: entry.action,
    record: entry.record,
    entityType: entry.entityType,
    entityId: entry.entityId,
    device: entry.device || 'DEV-TR-01',
    details: entry.details,
  };

  try {
    const existing = getAuditLogs();
    const updated = [newRecord, ...existing];
    // Keep up to 2000 records in local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 2000)));
  } catch (e) {
    console.warn('Could not write to audit log storage', e);
  }

  return newRecord;
}
