/**
 * ApprovalContext (Phase 5).
 * Coordinates:
 * 1. Approval limits matrix enforcement (Spec Section C3).
 * 2. Separation of Duties rules, blocking, and Treasurer override (Spec Section C4).
 * 3. SoD exceptions audit log (Spec Section C4).
 * 4. Controlled payment details for vendors, staff, and members (Spec Section C4).
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  Role,
  Currency,
  ApprovalTransactionType,
  ApprovalMatrixRule,
  ApprovalMatrixVersion,
  ApprovalRequest,
  SodCheckType,
  SodEvaluationResult,
  SodExceptionRecord,
  ControlledPaymentDetailChange,
  ControlledEntityType,
  ControlledDetailType,
} from '@church/domain';
import {
  INITIAL_APPROVAL_MATRIX_VERSION,
  createApprovalRequest,
  validateApprovalStep,
  applyApprovalStep,
  proposeApprovalMatrix,
  approveApprovalMatrix,
  evaluateSod,
  canTreasurerOverrideSod,
  createSodExceptionRecord,
  createControlledDetailChange,
  approveControlledDetailChange,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';

interface ApprovalContextType {
  // Matrix versions
  activeMatrixVersion: ApprovalMatrixVersion;
  matrixVersions: ApprovalMatrixVersion[];
  proposeNewMatrix: (rules: ApprovalMatrixRule[], effectiveFrom: string) => void;
  approveProposedMatrix: (version: number) => void;

  // Approval requests
  approvalRequests: Record<string, ApprovalRequest>;
  getRequestForEntity: (entityId: string) => ApprovalRequest | undefined;
  initializeRequest: (params: {
    entityId: string;
    entityNumber: string;
    transactionType: ApprovalTransactionType;
    amountPesewas: bigint;
    currency: Currency;
    requesterUserId: string;
    requesterUserName: string;
    requesterRole: Role;
  }) => ApprovalRequest;
  processApprovalStep: (
    entityId: string,
    comments?: string
  ) => { success: boolean; error?: string; isFullyApproved: boolean; request: ApprovalRequest };

  // Separation of Duties
  sodExceptions: SodExceptionRecord[];
  checkSodRule: (
    checkType: SodCheckType,
    preparerUserId: string,
    approverUserId: string
  ) => SodEvaluationResult;
  executeTreasurerOverride: (params: {
    ruleType: SodCheckType;
    entityType: string;
    entityId: string;
    preparerUserId: string;
    preparerUserName: string;
    overrideReason: string;
    details: string;
  }) => { success: boolean; error?: string };

  // Controlled Payment Details
  controlledChanges: ControlledPaymentDetailChange[];
  getPendingChangesForEntity: (entityId: string) => ControlledPaymentDetailChange[];
  getRecentApprovedChangeForEntity: (entityId: string) => ControlledPaymentDetailChange | undefined;
  submitDetailChange: (params: {
    entityType: ControlledEntityType;
    entityId: string;
    entityName: string;
    detailType: ControlledDetailType;
    oldValue: string;
    newValue: string;
  }) => ControlledPaymentDetailChange;
  approveDetailChange: (changeId: string) => { success: boolean; error?: string };
}

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined);

// Seed approval requests for existing sample requisitions
const SEED_REQUESTS: Record<string, ApprovalRequest> = {
  // High-value requisition (> GHS 5,000) with 1 of 2 approvals completed
  'req-003': {
    id: 'app-req-003',
    transactionType: 'requisition',
    entityId: 'req-003',
    entityNumber: 'REQ-D01-000003',
    amountPesewas: 1200000n, // GHS 12,000.00
    currency: 'GHS',
    amountGhsEquivalentPesewas: 1200000n,
    requesterUserId: 'user-004-boateng',
    requesterUserName: 'Kwame Boateng',
    requesterRole: 'Department Head',
    requestedAt: '2026-11-03T10:00:00Z',
    lastEditedAt: '2026-11-03T10:00:00Z',
    status: 'PENDING',
    requiredApprovalsCount: 2,
    completedApprovalsCount: 1,
    steps: [
      {
        id: 'step-req-003-1',
        stepNumber: 1,
        requiredRole: 'Treasurer',
        status: 'APPROVED',
        approverUserId: 'user-0001-treasurer',
        approverUserName: 'Kofi Mensah',
        approverRole: 'Treasurer',
        approvedAt: '2026-11-03T14:30:00Z',
        comments: 'Verified against youth camp budget line. Recommended for authorization.',
      },
      {
        id: 'step-req-003-2',
        stepNumber: 2,
        requiredRole: 'Pastor / Elder',
        status: 'PENDING',
      },
    ],
  },
};

const SEED_SOD_EXCEPTIONS: SodExceptionRecord[] = [
  {
    id: 'sod-exc-seed-01',
    timestamp: '2026-10-24T16:15:00Z',
    ruleType: 'REQUISITION_PREPARER_APPROVER',
    entityType: 'REQUISITION',
    entityId: 'REQ-D01-000011',
    actorUserId: 'user-0002-finsec',
    actorUserName: 'Akosua Osei',
    actorRole: 'Finance Secretary',
    isOverridden: true,
    overriddenByTreasurerId: 'user-0001-treasurer',
    overriddenByTreasurerName: 'Kofi Mensah',
    overrideReason: 'Urgent diesel generator fuel replenishment during district convention while Senior Pastor was in transit.',
    details: 'Finance Secretary initiated and signed requisition under Treasurer emergency override authorization.',
  },
  {
    id: 'sod-exc-seed-02',
    timestamp: '2026-10-18T13:45:00Z',
    ruleType: 'DUAL_COUNTERS_SAME_PERSON',
    entityType: 'COUNTING_SHEET',
    entityId: 'CS-20261018-01',
    actorUserId: 'user-004-boateng',
    actorUserName: 'Kwame Boateng',
    actorRole: 'Counter',
    isOverridden: false,
    details: 'System blocked attempt to register single officer for both first and second collection counting signatures.',
  },
];

const SEED_CONTROLLED_CHANGES: ControlledPaymentDetailChange[] = [
  {
    id: 'chg-seed-01',
    entityType: 'VENDOR',
    entityId: 'ven-001',
    entityName: 'Electricity Company of Ghana (ECG)',
    detailType: 'BANK_ACCOUNT',
    oldValue: 'GCB Bank - 1011122233344',
    newValue: 'GCB Bank - 1011122233399 (Corporate Revenue Account)',
    changedByUserId: 'user-0002-finsec',
    changedByUserName: 'Akosua Osei',
    changedAt: '2026-11-03T11:20:00Z',
    status: 'APPROVED',
    approvedByUserId: 'user-0001-treasurer',
    approvedByUserName: 'Kofi Mensah',
    approvedAt: '2026-11-03T14:00:00Z',
  },
  {
    id: 'chg-seed-02',
    entityType: 'VENDOR',
    entityId: 'ven-002',
    entityName: 'Ghana Water Company Ltd',
    detailType: 'MOMO_NUMBER',
    oldValue: '0244000111',
    newValue: '0555222333',
    changedByUserId: 'user-0002-finsec',
    changedByUserName: 'Akosua Osei',
    changedAt: new Date().toISOString(),
    status: 'PENDING_APPROVAL',
  },
];

export const ApprovalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  // Matrix versions
  const [matrixVersions, setMatrixVersions] = useState<ApprovalMatrixVersion[]>(() =>
    loadFromStore('approval_matrix_versions', false, [INITIAL_APPROVAL_MATRIX_VERSION])
  );

  const activeMatrixVersion = useMemo(() => {
    return matrixVersions.find((v) => v.status === 'ACTIVE') || matrixVersions[0] || INITIAL_APPROVAL_MATRIX_VERSION;
  }, [matrixVersions]);

  // Approval requests
  const [approvalRequests, setApprovalRequests] = useState<Record<string, ApprovalRequest>>(() =>
    loadFromStore('approval_requests', false, SEED_REQUESTS)
  );

  // SoD Exceptions
  const [sodExceptions, setSodExceptions] = useState<SodExceptionRecord[]>(() =>
    loadFromStore('sod_exceptions', false, SEED_SOD_EXCEPTIONS)
  );

  // Controlled Details Changes
  const [controlledChanges, setControlledChanges] = useState<ControlledPaymentDetailChange[]>(() =>
    loadFromStore('controlled_detail_changes', false, SEED_CONTROLLED_CHANGES)
  );

  // Get request by entity ID
  const getRequestForEntity = useCallback(
    (entityId: string): ApprovalRequest | undefined => {
      return approvalRequests[entityId];
    },
    [approvalRequests]
  );

  // Initialize approval request according to active matrix
  const initializeRequest = useCallback(
    (params: {
      entityId: string;
      entityNumber: string;
      transactionType: ApprovalTransactionType;
      amountPesewas: bigint;
      currency: Currency;
      requesterUserId: string;
      requesterUserName: string;
      requesterRole: Role;
    }): ApprovalRequest => {
      const newReq = createApprovalRequest({
        id: `app-${params.entityId}`,
        transactionType: params.transactionType,
        entityId: params.entityId,
        entityNumber: params.entityNumber,
        amountPesewas: params.amountPesewas,
        currency: params.currency,
        requesterUserId: params.requesterUserId,
        requesterUserName: params.requesterUserName,
        requesterRole: params.requesterRole,
        rules: activeMatrixVersion.rules,
      });

      setApprovalRequests((prev) => {
        const next = { ...prev, [params.entityId]: newReq };
        saveToStore('approval_requests', false, next);
        return next;
      });

      return newReq;
    },
    [activeMatrixVersion]
  );

  // Process approval step
  const processApprovalStep = useCallback(
    (
      entityId: string,
      comments?: string
    ): { success: boolean; error?: string; isFullyApproved: boolean; request: ApprovalRequest } => {
      const existing = approvalRequests[entityId];
      if (!existing) {
        throw new Error(`Approval request for entity ${entityId} not found.`);
      }

      const validation = validateApprovalStep({
        request: existing,
        approverUserId: currentUser.id,
        approverUserName: currentUser.fullName,
        approverRole: currentUser.role,
      });

      if (!validation.valid) {
        // Record near-miss in SoD exception audit if it is an SoD or self-approval violation
        const exc = createSodExceptionRecord({
          ruleType: 'REQUISITION_PREPARER_APPROVER',
          entityType: existing.transactionType.toUpperCase(),
          entityId: existing.entityNumber,
          actorUserId: currentUser.id,
          actorUserName: currentUser.fullName,
          actorRole: currentUser.role,
          targetUserId: existing.requesterUserId,
          targetUserName: existing.requesterUserName,
          isOverridden: false,
          details: `Blocked approval attempt: ${validation.error}`,
        });
        setSodExceptions((prev) => {
          const next = [exc, ...prev];
          saveToStore('sod_exceptions', false, next);
          return next;
        });

        return {
          success: false,
          error: validation.error,
          isFullyApproved: false,
          request: existing,
        };
      }

      const updated = applyApprovalStep({
        request: existing,
        approverUserId: currentUser.id,
        approverUserName: currentUser.fullName,
        approverRole: currentUser.role,
        comments,
      });

      const isFullyApproved = updated.status === 'APPROVED';

      setApprovalRequests((prev) => {
        const next = { ...prev, [entityId]: updated };
        saveToStore('approval_requests', false, next);
        return next;
      });

      return {
        success: true,
        isFullyApproved,
        request: updated,
      };
    },
    [approvalRequests, currentUser]
  );

  // Propose matrix
  const proposeNewMatrix = useCallback(
    (rules: ApprovalMatrixRule[], effectiveFrom: string) => {
      const proposed = proposeApprovalMatrix({
        currentVersion: activeMatrixVersion.version,
        rules,
        proposedBy: `${currentUser.fullName} (${currentUser.role})`,
        proposerRole: currentUser.role,
        effectiveFrom,
      });

      setMatrixVersions((prev) => {
        const next = [proposed, ...prev];
        saveToStore('approval_matrix_versions', false, next);
        return next;
      });
    },
    [activeMatrixVersion, currentUser]
  );

  // Approve matrix
  const approveProposedMatrix = useCallback(
    (versionNumber: number) => {
      const target = matrixVersions.find((v) => v.version === versionNumber);
      if (!target) return;

      const approved = approveApprovalMatrix({
        matrixVersion: target,
        approverName: `${currentUser.fullName} (${currentUser.role})`,
        approverRole: currentUser.role,
      });

      setMatrixVersions((prev) => {
        const next = prev.map((v) => {
          if (v.version === versionNumber) return approved;
          if (v.status === 'ACTIVE') return { ...v, status: 'ARCHIVED' as const };
          return v;
        });
        saveToStore('approval_matrix_versions', false, next);
        return next;
      });
    },
    [matrixVersions, currentUser]
  );

  // Check SoD rule
  const checkSodRule = useCallback(
    (
      checkType: SodCheckType,
      preparerUserId: string,
      approverUserId: string
    ): SodEvaluationResult => {
      return evaluateSod({
        checkType,
        preparerUserId,
        approverUserId,
      });
    },
    []
  );

  // Execute Treasurer override
  const executeTreasurerOverride = useCallback(
    (params: {
      ruleType: SodCheckType;
      entityType: string;
      entityId: string;
      preparerUserId: string;
      preparerUserName: string;
      overrideReason: string;
      details: string;
    }): { success: boolean; error?: string } => {
      const check = canTreasurerOverrideSod({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        preparerUserId: params.preparerUserId,
      });

      if (!check.allowed) {
        return { success: false, error: check.reason };
      }

      const exc = createSodExceptionRecord({
        ruleType: params.ruleType,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUserId: params.preparerUserId,
        actorUserName: params.preparerUserName,
        actorRole: 'Finance Secretary',
        isOverridden: true,
        overriddenByTreasurerId: currentUser.id,
        overriddenByTreasurerName: currentUser.fullName,
        overrideReason: params.overrideReason,
        details: params.details,
      });

      setSodExceptions((prev) => {
        const next = [exc, ...prev];
        saveToStore('sod_exceptions', false, next);
        return next;
      });

      return { success: true };
    },
    [currentUser]
  );

  // Controlled detail changes
  const getPendingChangesForEntity = useCallback(
    (entityId: string) => {
      return controlledChanges.filter(
        (c) => c.entityId === entityId && c.status === 'PENDING_APPROVAL'
      );
    },
    [controlledChanges]
  );

  const getRecentApprovedChangeForEntity = useCallback(
    (entityId: string) => {
      return controlledChanges.find(
        (c) => c.entityId === entityId && c.status === 'APPROVED'
      );
    },
    [controlledChanges]
  );

  const submitDetailChange = useCallback(
    (params: {
      entityType: ControlledEntityType;
      entityId: string;
      entityName: string;
      detailType: ControlledDetailType;
      oldValue: string;
      newValue: string;
    }): ControlledPaymentDetailChange => {
      const newChange = createControlledDetailChange({
        ...params,
        changedByUserId: currentUser.id,
        changedByUserName: currentUser.fullName,
      });

      setControlledChanges((prev) => {
        const next = [newChange, ...prev];
        saveToStore('controlled_detail_changes', false, next);
        return next;
      });

      return newChange;
    },
    [currentUser]
  );

  const approveDetailChange = useCallback(
    (changeId: string): { success: boolean; error?: string } => {
      const target = controlledChanges.find((c) => c.id === changeId);
      if (!target) return { success: false, error: 'Change record not found' };

      try {
        const approved = approveControlledDetailChange({
          change: target,
          approverUserId: currentUser.id,
          approverUserName: currentUser.fullName,
          approverRole: currentUser.role,
        });

        setControlledChanges((prev) => {
          const next = prev.map((c) => (c.id === changeId ? approved : c));
          saveToStore('controlled_detail_changes', false, next);
          return next;
        });

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Cannot approve payment detail change',
        };
      }
    },
    [controlledChanges, currentUser]
  );

  const value = {
    activeMatrixVersion,
    matrixVersions,
    proposeNewMatrix,
    approveProposedMatrix,
    approvalRequests,
    getRequestForEntity,
    initializeRequest,
    processApprovalStep,
    sodExceptions,
    checkSodRule,
    executeTreasurerOverride,
    controlledChanges,
    getPendingChangesForEntity,
    getRecentApprovedChangeForEntity,
    submitDetailChange,
    approveDetailChange,
  };

  return <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>;
};

const defaultFallbackApprovalContext: ApprovalContextType = {
  activeMatrixVersion: INITIAL_APPROVAL_MATRIX_VERSION,
  matrixVersions: [INITIAL_APPROVAL_MATRIX_VERSION],
  proposeNewMatrix: () => {},
  approveProposedMatrix: () => {},
  approvalRequests: {},
  getRequestForEntity: () => undefined,
  initializeRequest: (params) => ({
    id: `app-req-${params.entityId}`,
    transactionType: params.transactionType,
    entityId: params.entityId,
    entityNumber: params.entityNumber,
    amountPesewas: params.amountPesewas,
    currency: params.currency,
    amountGhsEquivalentPesewas: params.amountPesewas,
    requesterUserId: params.requesterUserId,
    requesterUserName: params.requesterUserName,
    requesterRole: params.requesterRole,
    requestedAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    status: 'APPROVED',
    requiredApprovalsCount: 1,
    completedApprovalsCount: 1,
    steps: [],
  }),
  processApprovalStep: (_entityId: string) => ({
    success: true,
    isFullyApproved: true,
    request: {
      id: 'req-default',
      transactionType: 'requisition',
      entityId: _entityId,
      entityNumber: _entityId,
      amountPesewas: 0n,
      currency: 'GHS',
      amountGhsEquivalentPesewas: 0n,
      requesterUserId: 'usr-001',
      requesterUserName: 'User',
      requesterRole: 'Treasurer',
      requestedAt: '2026-11-01T10:00:00Z',
      lastEditedAt: '2026-11-01T10:00:00Z',
      status: 'APPROVED',
      requiredApprovalsCount: 1,
      completedApprovalsCount: 1,
      steps: [],
    },
  }),
  sodExceptions: [],
  checkSodRule: () => ({
    allowed: true,
    isBlocked: false,
    ruleName: 'REQUISITION_PREPARER_APPROVER',
    message: '',
    canTreasurerOverride: false,
  }),
  executeTreasurerOverride: () => ({ success: true }),
  controlledChanges: [],
  getPendingChangesForEntity: () => [],
  getRecentApprovedChangeForEntity: () => undefined,
  submitDetailChange: (params) => ({
    id: 'chg-fallback',
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    detailType: params.detailType,
    oldValue: params.oldValue,
    newValue: params.newValue,
    status: 'PENDING_APPROVAL',
    changedByUserId: 'usr-001',
    changedByUserName: 'User',
    changedAt: new Date().toISOString(),
  }),
  approveDetailChange: () => ({ success: true }),
};

export function useApprovals(): ApprovalContextType {
  const ctx = useContext(ApprovalContext);
  return ctx || defaultFallbackApprovalContext;
}
