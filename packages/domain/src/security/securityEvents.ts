import type { Role } from '../permissions/index.js';
import type { JournalEntry } from '../ledger/types.js';

export type SecurityEventCategory =
  | 'AUTHENTICATION'
  | 'ACCESS_CONTROL'
  | 'FINANCIAL_ANOMALY'
  | 'GOVERNANCE'
  | 'DATA_PRIVACY';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'ACCOUNT_LOCKOUT'
  | 'DEVICE_ENROLLED'
  | 'ROLE_CHANGED'
  | 'MFA_RESET_REQUESTED'
  | 'MFA_RESET_APPROVED'
  | 'APPROVAL_LIMITS_CHANGED'
  | 'PERIOD_REOPENED'
  | 'YEAR_REOPENED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_RESTORED'
  | 'BACKUP_VERIFIED'
  | 'GIVING_DATA_EXPORTED'
  | 'ANNUAL_STATEMENTS_GENERATED'
  | 'TREASURER_OVERRIDE'
  | 'HIGH_VALUE_MANUAL_JOURNAL'
  | 'OFF_HOURS_POSTING'
  | 'REPEATED_REVERSALS'
  | 'HASH_CHAIN_CORRUPTION_DETECTED';

export interface SecurityEvent {
  readonly id: string;
  readonly timestamp: string; // ISO 8601
  readonly eventType: SecurityEventType;
  readonly category: SecurityEventCategory;
  readonly severity: SecuritySeverity;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorRole: string;
  readonly deviceId: string;
  readonly ipAddress: string;
  readonly description: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly requiresNotification: boolean;
  readonly targetRoles: readonly Role[];
  readonly acknowledgedAt?: string | null;
  readonly acknowledgedBy?: string | null;
  readonly acknowledgmentReason?: string | null;
}

export interface SecurityAlertEvaluation {
  readonly category: SecurityEventCategory;
  readonly severity: SecuritySeverity;
  readonly requiresNotification: boolean;
  readonly targetRoles: readonly Role[];
}

/**
 * Evaluates default category, severity, notification necessity and audience for each security event type.
 */
export function evaluateSecurityEventRules(
  eventType: SecurityEventType,
  metadata?: Record<string, unknown>
): SecurityAlertEvaluation {
  switch (eventType) {
    case 'ACCOUNT_LOCKOUT':
      return {
        category: 'AUTHENTICATION',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Admin'],
      };

    case 'FAILED_LOGIN': {
      const attempts = (metadata?.consecutiveAttempts as number) || 1;
      const isHigh = attempts >= 5;
      return {
        category: 'AUTHENTICATION',
        severity: isHigh ? 'HIGH' : 'LOW',
        requiresNotification: isHigh,
        targetRoles: ['Treasurer', 'Admin'],
      };
    }

    case 'DEVICE_ENROLLED':
      return {
        category: 'ACCESS_CONTROL',
        severity: 'MEDIUM',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Admin'],
      };

    case 'ROLE_CHANGED':
      return {
        category: 'ACCESS_CONTROL',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder'],
      };

    case 'MFA_RESET_REQUESTED':
      return {
        category: 'AUTHENTICATION',
        severity: 'MEDIUM',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Pastor / Elder'],
      };

    case 'MFA_RESET_APPROVED':
      return {
        category: 'AUTHENTICATION',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Admin'],
      };

    case 'APPROVAL_LIMITS_CHANGED':
      return {
        category: 'ACCESS_CONTROL',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder'],
      };

    case 'PERIOD_REOPENED':
    case 'YEAR_REOPENED':
      return {
        category: 'GOVERNANCE',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder'],
      };

    case 'TREASURER_OVERRIDE':
      return {
        category: 'GOVERNANCE',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Auditor', 'Pastor / Elder'],
      };

    case 'BACKUP_EXPORTED':
      return {
        category: 'DATA_PRIVACY',
        severity: 'MEDIUM',
        requiresNotification: false,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'BACKUP_RESTORED':
      return {
        category: 'DATA_PRIVACY',
        severity: 'CRITICAL',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder', 'Admin'],
      };

    case 'BACKUP_VERIFIED':
      return {
        category: 'DATA_PRIVACY',
        severity: 'LOW',
        requiresNotification: false,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'GIVING_DATA_EXPORTED':
      return {
        category: 'DATA_PRIVACY',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder'],
      };

    case 'ANNUAL_STATEMENTS_GENERATED':
      return {
        category: 'DATA_PRIVACY',
        severity: 'MEDIUM',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'HIGH_VALUE_MANUAL_JOURNAL':
      return {
        category: 'FINANCIAL_ANOMALY',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'OFF_HOURS_POSTING':
      return {
        category: 'FINANCIAL_ANOMALY',
        severity: 'MEDIUM',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'REPEATED_REVERSALS':
      return {
        category: 'FINANCIAL_ANOMALY',
        severity: 'HIGH',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor'],
      };

    case 'HASH_CHAIN_CORRUPTION_DETECTED':
      return {
        category: 'FINANCIAL_ANOMALY',
        severity: 'CRITICAL',
        requiresNotification: true,
        targetRoles: ['Treasurer', 'Auditor', 'Pastor / Elder', 'Admin'],
      };
  }
}

/**
 * Checks whether a posting occurred outside normal church business hours.
 * Normal business hours default to 06:00 to 22:00 Ghana local time.
 */
export function isOffHoursPosting(timestampIsoOrHour: string | number, startHour = 6, endHour = 22): boolean {
  let hour: number;
  if (typeof timestampIsoOrHour === 'number') {
    hour = timestampIsoOrHour;
  } else {
    const d = new Date(timestampIsoOrHour);
    hour = d.getHours();
  }
  return hour < startHour || hour >= endHour;
}

/**
 * Checks whether an entry is a manual journal entry above a specified monetary threshold.
 * Standard threshold: 1,000,000 pesewas (GHS 10,000.00).
 */
export function isHighValueManualJournal(entry: JournalEntry, thresholdPesewas = 1000000n): boolean {
  if (entry.entryType !== 'STANDARD') {
    return false;
  }
  return entry.totalDebitGhs >= thresholdPesewas;
}

/**
 * Detects patterns of repeated reversals by the same user within a short time window.
 */
export function detectRepeatedReversals(
  entries: readonly JournalEntry[],
  windowMinutes = 60,
  thresholdCount = 3
): { actor: string; count: number; entryIds: string[] }[] {
  const reversals = entries
    .filter((e) => e.isReversal || e.entryType === 'REVERSAL')
    .slice()
    .sort((a, b) => new Date(a.createdAt || a.entryDate).getTime() - new Date(b.createdAt || b.entryDate).getTime());

  const results: { actor: string; count: number; entryIds: string[] }[] = [];
  const windowMs = windowMinutes * 60 * 1000;

  for (let i = 0; i < reversals.length; i++) {
    const current = reversals[i]!;
    const currentTime = new Date(current.createdAt || current.entryDate).getTime();
    const cluster = [current];

    for (let j = i + 1; j < reversals.length; j++) {
      const next = reversals[j]!;
      const nextTime = new Date(next.createdAt || next.entryDate).getTime();
      if (nextTime - currentTime > windowMs) break;

      if (next.createdBy === current.createdBy) {
        cluster.push(next);
      }
    }

    if (cluster.length >= thresholdCount) {
      const alreadyReported = results.some((r) => r.actor === current.createdBy);
      if (!alreadyReported) {
        results.push({
          actor: current.createdBy,
          count: cluster.length,
          entryIds: cluster.map((c) => c.id),
        });
      }
    }
  }

  return results;
}

export interface DailySecuritySummary {
  readonly date: string;
  readonly failedLogins24h: number;
  readonly accountLockouts24h: number;
  readonly highValueManualJournals24h: number;
  readonly offHoursPostings24h: number;
  readonly unacknowledgedHighAlertsCount: number;
  readonly isHashChainIntact: boolean;
  readonly lastBackupVerificationDate: string | null;
  readonly healthStatus: 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
  readonly headline: string;
}

/**
 * Aggregates daily security metrics for the Today page and Security summary widget.
 */
export function generateDailySecuritySummary(
  events: readonly SecurityEvent[],
  isHashChainIntact = true,
  lastBackupVerificationDate: string | null = null,
  referenceDate = new Date()
): DailySecuritySummary {
  const now = referenceDate.getTime();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let failedLogins24h = 0;
  let accountLockouts24h = 0;
  let highValueManualJournals24h = 0;
  let offHoursPostings24h = 0;
  let unacknowledgedHighAlertsCount = 0;

  for (const ev of events) {
    const evTime = new Date(ev.timestamp).getTime();
    if (evTime >= oneDayAgo) {
      if (ev.eventType === 'FAILED_LOGIN') failedLogins24h++;
      if (ev.eventType === 'ACCOUNT_LOCKOUT') accountLockouts24h++;
      if (ev.eventType === 'HIGH_VALUE_MANUAL_JOURNAL') highValueManualJournals24h++;
      if (ev.eventType === 'OFF_HOURS_POSTING') offHoursPostings24h++;
    }

    if (!ev.acknowledgedAt && (ev.severity === 'HIGH' || ev.severity === 'CRITICAL')) {
      unacknowledgedHighAlertsCount++;
    }
  }

  let healthStatus: 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL' = 'HEALTHY';
  let headline = 'Security systems normal. Ledger hash chain verified.';

  if (!isHashChainIntact) {
    healthStatus = 'CRITICAL';
    headline = 'CRITICAL: General ledger cryptographic hash chain failure detected!';
  } else if (accountLockouts24h > 0 || unacknowledgedHighAlertsCount > 0) {
    healthStatus = 'NEEDS_ATTENTION';
    headline = `Security attention required: ${unacknowledgedHighAlertsCount} unacknowledged security alerts.`;
  }

  return {
    date: referenceDate.toISOString().slice(0, 10),
    failedLogins24h,
    accountLockouts24h,
    highValueManualJournals24h,
    offHoursPostings24h,
    unacknowledgedHighAlertsCount,
    isHashChainIntact,
    lastBackupVerificationDate,
    healthStatus,
    headline,
  };
}
