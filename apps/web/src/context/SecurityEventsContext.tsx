import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  type SecurityEvent,
  type SecurityEventType,
  type SecuritySeverity,
  type SecurityEventCategory,
  type HashChainVerificationResult,
  type DailySecuritySummary,
  type BackupSandboxVerificationResult,
  evaluateSecurityEventRules,
  verifyLedgerHashChain,
  chainJournalEntries,
  generateDailySecuritySummary,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { logAuditEvent } from '../utils/auditLogger.js';

export interface SecurityEventsContextType {
  events: SecurityEvent[];
  logSecurityEvent: (params: {
    eventType: SecurityEventType;
    description: string;
    severity?: SecuritySeverity;
    category?: SecurityEventCategory;
    metadata?: Record<string, unknown>;
  }) => SecurityEvent;
  acknowledgeSecurityEvent: (id: string, reason: string) => void;
  hashChainResult: HashChainVerificationResult;
  verifyHashChainNow: () => HashChainVerificationResult;
  lastBackupVerification: {
    testedAt: string;
    isValid: boolean;
    summary: string;
    entriesCount: number;
  } | null;
  recordBackupVerification: (result: BackupSandboxVerificationResult) => void;
  dailySecuritySummary: DailySecuritySummary;
}

const STORAGE_KEY = 'church_security_events_v1';
const BACKUP_VERIFICATION_KEY = 'church_last_backup_verification_v1';

const INITIAL_SEED_EVENTS: SecurityEvent[] = [
  {
    id: 'sec-ev-001',
    timestamp: '2026-11-04T09:15:00Z',
    eventType: 'BACKUP_VERIFIED',
    category: 'DATA_PRIVACY',
    severity: 'LOW',
    actorId: 'usr-001',
    actorName: 'Kofi Mensah',
    actorRole: 'Treasurer',
    deviceId: 'DEV-TR-01',
    ipAddress: '192.168.1.101',
    description: 'Sandbox dry-run test completed for backup archive. 142 entries verified in perfect balance.',
    requiresNotification: false,
    targetRoles: ['Treasurer', 'Auditor'],
    acknowledgedAt: '2026-11-04T09:16:00Z',
    acknowledgedBy: 'Kofi Mensah',
  },
  {
    id: 'sec-ev-002',
    timestamp: '2026-11-04T10:30:00Z',
    eventType: 'DEVICE_ENROLLED',
    category: 'ACCESS_CONTROL',
    severity: 'MEDIUM',
    actorId: 'usr-002',
    actorName: 'Akosua Osei',
    actorRole: 'Finance Secretary',
    deviceId: 'DEV-FIN-02',
    ipAddress: '192.168.1.104',
    description: 'Enrolled workstation DEV-FIN-02 for Finance Secretary. Approved by Kofi Mensah (Treasurer).',
    requiresNotification: true,
    targetRoles: ['Treasurer', 'Admin'],
    acknowledgedAt: '2026-11-04T10:32:00Z',
    acknowledgedBy: 'Kofi Mensah',
  },
  {
    id: 'sec-ev-003',
    timestamp: '2026-11-05T08:00:00Z',
    eventType: 'MFA_RESET_APPROVED',
    category: 'AUTHENTICATION',
    severity: 'HIGH',
    actorId: 'usr-001',
    actorName: 'Kofi Mensah',
    actorRole: 'Treasurer',
    deviceId: 'DEV-TR-01',
    ipAddress: '192.168.1.101',
    description: 'Dual-control MFA reset approved for Deaconess Grace Mensah following device loss report.',
    requiresNotification: true,
    targetRoles: ['Treasurer', 'Auditor', 'Admin'],
    acknowledgedAt: null,
    acknowledgedBy: null,
  },
];

const SecurityEventsContext = createContext<SecurityEventsContextType | undefined>(undefined);

export const SecurityEventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { entries } = useLedger();

  // Load persistent security events
  const [events, setEvents] = useState<SecurityEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return INITIAL_SEED_EVENTS;
  });

  // Save persistent security events
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {}
  }, [events]);

  // Load last backup verification state
  const [lastBackupVerification, setLastBackupVerification] = useState<{
    testedAt: string;
    isValid: boolean;
    summary: string;
    entriesCount: number;
  } | null>(() => {
    try {
      const stored = localStorage.getItem(BACKUP_VERIFICATION_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      testedAt: '2026-11-04T09:15:00Z',
      isValid: true,
      summary: 'Sandbox dry-run test completed. 142 entries verified intact with zero corruption.',
      entriesCount: 142,
    };
  });

  // Dynamic hash chain verification state
  const [hashChainResult, setHashChainResult] = useState<HashChainVerificationResult>(() => {
    const chained = chainJournalEntries(entries || []);
    return verifyLedgerHashChain(chained);
  });

  const verifyHashChainNow = useCallback((): HashChainVerificationResult => {
    const chained = chainJournalEntries(entries || []);
    const res = verifyLedgerHashChain(chained);
    setHashChainResult(res);
    return res;
  }, [entries]);

  // Auto-verify hash chain whenever entries change
  useEffect(() => {
    verifyHashChainNow();
  }, [verifyHashChainNow]);

  // Log a security event with automatic rules evaluation
  const logSecurityEvent = useCallback(
    (params: {
      eventType: SecurityEventType;
      description: string;
      severity?: SecuritySeverity;
      category?: SecurityEventCategory;
      metadata?: Record<string, unknown>;
    }): SecurityEvent => {
      const rule = evaluateSecurityEventRules(params.eventType, params.metadata);

      const newEvent: SecurityEvent = {
        id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        eventType: params.eventType,
        category: params.category || rule.category,
        severity: params.severity || rule.severity,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        deviceId: currentUser.deviceId || 'DEV-WEB-01',
        ipAddress: '192.168.1.101',
        description: params.description,
        metadata: params.metadata || null,
        requiresNotification: rule.requiresNotification,
        targetRoles: rule.targetRoles,
        acknowledgedAt: null,
        acknowledgedBy: null,
      };

      setEvents((prev) => [newEvent, ...prev]);

      // Mirror to local audit log
      logAuditEvent({
        action: params.eventType,
        record: params.description,
        entityType: 'SECURITY_EVENT',
        entityId: newEvent.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        device: currentUser.deviceId || 'DEV-WEB-01',
        details: params.description,
      });

      return newEvent;
    },
    [currentUser]
  );

  // Acknowledge a security event
  const acknowledgeSecurityEvent = useCallback(
    (id: string, reason: string) => {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id
            ? {
                ...ev,
                acknowledgedAt: new Date().toISOString(),
                acknowledgedBy: currentUser.fullName,
                acknowledgmentReason: reason,
              }
            : ev
        )
      );

      logAuditEvent({
        action: 'SECURITY_ALERT_ACKNOWLEDGED',
        record: `Acknowledged security alert ${id}`,
        entityType: 'SECURITY_EVENT',
        entityId: id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        device: currentUser.deviceId || 'DEV-WEB-01',
        details: reason,
      });
    },
    [currentUser]
  );

  // Record a backup sandbox verification result
  const recordBackupVerification = useCallback(
    (result: BackupSandboxVerificationResult) => {
      const record = {
        testedAt: result.testedAt,
        isValid: result.isValid,
        summary: result.plainLanguageSummary,
        entriesCount: result.entriesCount,
      };
      setLastBackupVerification(record);
      try {
        localStorage.setItem(BACKUP_VERIFICATION_KEY, JSON.stringify(record));
      } catch {}

      logSecurityEvent({
        eventType: 'BACKUP_VERIFIED',
        description: `Backup archive sandbox test: ${result.entriesCount} entries verified across ${result.fundsCount} funds. ${result.checksumVerified ? 'SHA-256 checksum confirmed.' : 'Warning on checksum.'}`,
        metadata: {
          entriesCount: result.entriesCount,
          isValid: result.isValid,
          fundsCount: result.fundsCount,
        },
      });
    },
    [logSecurityEvent]
  );

  // Daily security summary
  const dailySecuritySummary = useMemo(() => {
    return generateDailySecuritySummary(
      events,
      hashChainResult.isClean,
      lastBackupVerification?.testedAt?.slice(0, 10) || null
    );
  }, [events, hashChainResult, lastBackupVerification]);

  const value = useMemo(
    () => ({
      events,
      logSecurityEvent,
      acknowledgeSecurityEvent,
      hashChainResult,
      verifyHashChainNow,
      lastBackupVerification,
      recordBackupVerification,
      dailySecuritySummary,
    }),
    [
      events,
      logSecurityEvent,
      acknowledgeSecurityEvent,
      hashChainResult,
      verifyHashChainNow,
      lastBackupVerification,
      recordBackupVerification,
      dailySecuritySummary,
    ]
  );

  return <SecurityEventsContext.Provider value={value}>{children}</SecurityEventsContext.Provider>;
};

const defaultFallbackSecurityEventsContext: SecurityEventsContextType = {
  events: INITIAL_SEED_EVENTS,
  logSecurityEvent: (params) => ({
    id: `sec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    eventType: params.eventType,
    category: params.category || 'GOVERNANCE',
    severity: params.severity || 'LOW',
    actorId: 'usr-001',
    actorName: 'Kofi Mensah',
    actorRole: 'Treasurer',
    deviceId: 'DEV-TR-01',
    ipAddress: '192.168.1.101',
    description: params.description,
    metadata: params.metadata || null,
    requiresNotification: false,
    targetRoles: ['Treasurer'],
    acknowledgedAt: null,
    acknowledgedBy: null,
  }),
  acknowledgeSecurityEvent: () => {},
  hashChainResult: {
    isClean: true,
    totalEntriesChecked: 0,
    verifiedChainLength: 0,
    brokenLinks: [],
    latestChainHash: '0000000000000000000000000000000000000000000000000000000000000000',
    verificationTimestamp: new Date().toISOString(),
    summary: 'Hash chain intact',
  },
  verifyHashChainNow: () => ({
    isClean: true,
    totalEntriesChecked: 0,
    verifiedChainLength: 0,
    brokenLinks: [],
    latestChainHash: '0000000000000000000000000000000000000000000000000000000000000000',
    verificationTimestamp: new Date().toISOString(),
    summary: 'Hash chain intact',
  }),
  lastBackupVerification: {
    testedAt: '2026-11-04T09:15:00Z',
    isValid: true,
    summary: 'Sandbox test healthy',
    entriesCount: 142,
  },
  recordBackupVerification: () => {},
  dailySecuritySummary: {
    date: '2026-11-05',
    failedLogins24h: 0,
    accountLockouts24h: 0,
    highValueManualJournals24h: 0,
    offHoursPostings24h: 0,
    unacknowledgedHighAlertsCount: 0,
    isHashChainIntact: true,
    lastBackupVerificationDate: '2026-11-04',
    healthStatus: 'HEALTHY',
    headline: 'Security systems normal.',
  },
};

export const useSecurityEvents = (): SecurityEventsContextType => {
  const context = useContext(SecurityEventsContext);
  return context || defaultFallbackSecurityEventsContext;
};
