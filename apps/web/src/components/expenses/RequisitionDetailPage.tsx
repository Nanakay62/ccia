import React, { useState, useMemo } from 'react';
import { useExpenses } from '../../context/ExpensesContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { useApprovals } from '../../context/ApprovalContext.js';
import { evaluateApprovalProgress, canTreasurerOverrideSod, createApprovalRequest } from '@church/domain';
import { PageBreadcrumb } from '../ui/PageBreadcrumb.js';
import { StatusDot } from '../ui/StatusDot.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { formatDate, shortDocNumber, formatPesewas } from '../../utils/formatters.js';
import {
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export interface RequisitionDetailPageProps {
  id: string;
}

export const RequisitionDetailPage: React.FC<RequisitionDetailPageProps> = ({ id }) => {
  const { requisitions, approveRequisition, rejectRequisition } = useExpenses();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { navigate, goBack } = useRouter();

  const requisition = requisitions.find((r) => r.id === id || r.reqNumber === id);

  // Approval Dialog State
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');

  // Rejection Dialog State
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Emergency Treasurer Override State (Spec C4)
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Post-decision "Approve and next" state
  const [decisionMade, setDecisionMade] = useState<'APPROVED' | 'REJECTED' | null>(null);

  // Approval Limits & SoD Context (Spec C3 & C4)
  const {
    activeMatrixVersion,
    getRequestForEntity,
    initializeRequest,
    processApprovalStep,
    executeTreasurerOverride,
  } = useApprovals();

  const existingRequest = requisition ? getRequestForEntity(requisition.id) : undefined;

  React.useEffect(() => {
    if (requisition && !existingRequest) {
      initializeRequest({
        entityId: requisition.id,
        entityNumber: requisition.reqNumber,
        transactionType: 'requisition',
        amountPesewas: requisition.estimatedAmountPesewas,
        currency: 'GHS',
        requesterUserId: requisition.submittedById || 'usr-005',
        requesterUserName: requisition.submittedByName,
        requesterRole: 'Department Head',
      });
    }
  }, [requisition, existingRequest, initializeRequest]);

  const approvalRequest = useMemo(() => {
    if (existingRequest) return existingRequest;
    if (!requisition) return undefined;
    return createApprovalRequest({
      id: `app-${requisition.id}`,
      transactionType: 'requisition',
      entityId: requisition.id,
      entityNumber: requisition.reqNumber,
      amountPesewas: requisition.estimatedAmountPesewas,
      currency: 'GHS',
      requesterUserId: requisition.submittedById || 'usr-005',
      requesterUserName: requisition.submittedByName,
      requesterRole: 'Department Head',
      rules: activeMatrixVersion.rules,
    });
  }, [existingRequest, requisition, activeMatrixVersion.rules]);

  const approvalProgress = approvalRequest ? evaluateApprovalProgress(approvalRequest) : null;
  const nextPendingStep = approvalRequest?.steps.find((s) => s.status === 'PENDING');

  // Separation of Duties checks (Spec Section C4)
  const isPreparer = Boolean(
    approvalRequest &&
      (currentUser.id === approvalRequest.requesterUserId ||
        currentUser.fullName.toLowerCase() === approvalRequest.requesterUserName.toLowerCase())
  );

  const hasAlreadyApproved = Boolean(
    approvalRequest?.steps.some(
      (s) =>
        s.status === 'APPROVED' &&
        (s.approverUserId === currentUser.id || s.approverUserName === currentUser.fullName)
    )
  );

  const hasRequiredRole = Boolean(
    nextPendingStep &&
      (currentUser.role === nextPendingStep.requiredRole ||
        currentUser.role === 'Admin' ||
        (nextPendingStep.requiredRole === 'Department Head' &&
          (currentUser.role === 'Treasurer' || currentUser.role === 'Pastor / Elder')))
  );

  const canApproveStandard = Boolean(
    requisition?.status === 'PENDING' &&
      !isPreparer &&
      !hasAlreadyApproved &&
      hasRequiredRole &&
      approvalProgress &&
      !approvalProgress.isFullyApproved
  );

  const isTreasurer = currentUser.role === 'Treasurer' || currentUser.role === 'Admin';
  const canTreasurerOverride = Boolean(
    requisition?.status === 'PENDING' &&
      isTreasurer &&
      !isPreparer &&
      !canApproveStandard &&
      canTreasurerOverrideSod({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        preparerUserId: approvalRequest?.requesterUserId || '',
        approverUserId: approvalRequest?.steps.find((s) => s.status === 'APPROVED')?.approverUserId,
      })
  );

  if (!requisition) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: 'Expenditure', onClick: () => navigate('#/expenses') },
            { label: 'Requisitions', onClick: () => navigate('#/expenses') },
            { label: 'Not Found' },
          ]}
          onBack={() => goBack('expenses')}
        />
        <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-[var(--radius)] border border-[var(--surface-border)]">
          <p className="text-[14px] text-[var(--text-muted)]">
            Requisition <strong className="text-[var(--text-primary)]">{id}</strong> was not found.
          </p>
          <button
            type="button"
            onClick={() => goBack('expenses')}
            className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-[var(--radius)]"
          >
            Back to Requisitions
          </button>
        </div>
      </div>
    );
  }

  // Budget calculations for Department Budget Impact table
  const deptBudgetPesewas = 1500000n; // GHS 15,000.00
  const deptSpentPesewas = 480000n; // GHS 4,800.00
  const reqAmountPesewas = requisition.estimatedAmountPesewas;
  const remainingPesewas = deptBudgetPesewas - deptSpentPesewas - reqAmountPesewas;

  const handleConfirmApprove = () => {
    try {
      const res = processApprovalStep(requisition.id, approveComment.trim() || undefined);
      if (res.isFullyApproved) {
        approveRequisition(requisition.id, approveComment.trim() || undefined);
        showToast(`Requisition ${requisition.reqNumber} fully authorized.`, 'success');
        setDecisionMade('APPROVED');
      } else {
        const approvedCount = res.request.steps.filter((s) => s.status === 'APPROVED').length;
        showToast(
          `Step ${approvedCount} of ${res.request.steps.length} approved. Next: awaiting sign-off.`,
          'success'
        );
      }
      setIsApproveOpen(false);
      setApproveComment('');
    } catch (e: any) {
      showToast(e?.message || 'Failed to approve requisition', 'error');
    }
  };

  const handleConfirmEmergencyOverride = () => {
    if (!overrideReason.trim()) {
      showToast('A reason is mandatory for emergency Treasurer override.', 'error');
      return;
    }
    try {
      const res = executeTreasurerOverride({
        ruleType: 'REQUISITION_PREPARER_APPROVER',
        entityType: 'REQUISITION',
        entityId: requisition.reqNumber,
        preparerUserId: approvalRequest?.requesterUserId || 'unknown',
        preparerUserName: approvalRequest?.requesterUserName || requisition.submittedByName,
        overrideReason: overrideReason.trim(),
        details: `Treasurer override on ${shortDocNumber(requisition.reqNumber)}: ${overrideReason.trim()}`,
      });
      if (!res.success) {
        showToast(res.error || 'Cannot execute override', 'error');
        return;
      }
      approveRequisition(requisition.id, `[Treasurer Override: ${overrideReason.trim()}]`);
      showToast(
        'Requisition authorized via Treasurer Emergency Override. Logged to SoD exceptions report.',
        'warning'
      );
      setIsOverrideOpen(false);
      setOverrideReason('');
      setDecisionMade('APPROVED');
    } catch (e: any) {
      showToast(e?.message || 'Failed to execute override', 'error');
    }
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      showToast('A reason is required to reject a requisition.', 'error');
      return;
    }
    try {
      rejectRequisition(requisition.id, rejectReason.trim());
      showToast(`Requisition ${requisition.reqNumber} rejected.`, 'error');
      setIsRejectOpen(false);
      setDecisionMade('REJECTED');
      setRejectReason('');
    } catch (e: any) {
      showToast(e?.message || 'Failed to reject requisition', 'error');
    }
  };

  const handleNextPending = () => {
    const nextPending = requisitions.find((r) => r.status === 'PENDING' && r.id !== requisition.id);
    if (nextPending) {
      navigate(`#/requisitions/${encodeURIComponent(nextPending.id)}`);
      setDecisionMade(null);
    } else {
      goBack('expenses');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Breadcrumb Navigation */}
      <PageBreadcrumb
        items={[
          { label: 'Expenditure', onClick: () => navigate('#/expenses') },
          { label: 'Requisitions', onClick: () => navigate('#/expenses') },
          { label: shortDocNumber(requisition.reqNumber) },
        ]}
        currentId={requisition.id}
        listKey="requisitions"
        onBack={() => goBack('expenses')}
      />

      {/* Main Two-Column Layout above 1,200px (Requirement 2) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Left Column: Details, Attachments, Budget Impact */}
        <div className="space-y-6">
          {/* Separation of Duties & Tiered Approval Alerts (Spec C3 & C4) */}
          {isPreparer && requisition.status === 'PENDING' && (
            <div className="p-3.5 rounded-[var(--radius)] bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[13px] font-bold text-amber-900 dark:text-amber-200 block">
                  Separation of Duties (Spec Section C4)
                </span>
                <span className="text-[12px] text-amber-800 dark:text-amber-300">
                  You prepared this requisition. Preparers cannot authorize their own requisitions. An independent authorized officer ({nextPendingStep?.requiredRole || 'Treasurer / Pastor'}) must review and approve.
                </span>
              </div>
            </div>
          )}

          {hasAlreadyApproved && requisition.status === 'PENDING' && (
            <div className="p-3.5 rounded-[var(--radius)] bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[13px] font-bold text-blue-900 dark:text-blue-200 block">
                  Tiered Approval Progress
                </span>
                <span className="text-[12px] text-blue-800 dark:text-blue-300">
                  You authorized a previous step. Under dual-control rules, a second authorized officer ({nextPendingStep?.requiredRole}) must provide the final sign-off.
                </span>
              </div>
            </div>
          )}

          {/* Header Card / Info block (No box inside box) */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--surface-border-subtle)]">
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Document Number</span>
                <span className="font-semibold text-[17px] text-[var(--text-primary)]">
                  {shortDocNumber(requisition.reqNumber)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot
                  status={
                    requisition.status === 'APPROVED'
                      ? 'approved'
                      : requisition.status === 'PAID'
                      ? 'paid'
                      : requisition.status === 'REJECTED'
                      ? 'rejected'
                      : 'pending'
                  }
                  label={
                    requisition.status === 'PENDING'
                      ? 'Pending Approval'
                      : requisition.status === 'APPROVED'
                      ? 'Approved'
                      : requisition.status === 'PAID'
                      ? 'Paid'
                      : 'Rejected'
                  }
                />
                <span className="text-[12px] text-[var(--text-muted)] ml-2">
                  {formatDate(requisition.createdAt.slice(0, 10))}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div className="pt-1">
              <span className="text-[13px] text-[var(--text-secondary)] font-medium block mb-1">
                Amount Requested
              </span>
              <MoneyCell
                amountPesewas={requisition.estimatedAmountPesewas}
                size="xl"
                align="left"
              />
            </div>

            {/* Department and Fund in clean grid without nested box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--surface-border-subtle)] text-[14px]">
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Department</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {requisition.departmentName}
                </span>
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-muted)] block">Fund Allocated</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {requisition.fundName}
                </span>
              </div>
            </div>

            {/* Purpose & Justification */}
            <div className="pt-3 border-t border-[var(--surface-border-subtle)]">
              <span className="text-[13px] text-[var(--text-secondary)] font-medium block mb-1.5">
                Full Purpose & Justification
              </span>
              <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {requisition.purpose}
              </p>
            </div>
          </div>

          {/* Attachments with Inline Preview (Requirement 2) */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                Attachments & Supplier Quotes
              </span>
              <span className="text-[12px] text-[var(--text-muted)]">
                {requisition.quotesNotes ? '1 document attached' : '0 attachments'}
              </span>
            </div>

            {requisition.quotesNotes ? (
              <div className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-[var(--surface-panel)] border border-[var(--surface-border)] flex items-center justify-center shrink-0 text-[var(--accent)]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[13px] text-[var(--text-primary)] block">
                      Supplier Proforma Quote & Estimate
                    </span>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                      {requisition.quotesNotes}
                    </p>
                  </div>
                </div>

                {/* Inline document preview mockup */}
                <div className="mt-2 p-3 bg-[var(--surface-panel)] rounded border border-[var(--surface-border)] text-[12px] text-[var(--text-muted)] flex items-center justify-between">
                  <span className="font-sans tabular-nums">proforma_quote_2026.pdf (142 KB)</span>
                  <span className="text-[var(--accent)] font-medium hover:underline flex items-center gap-1 cursor-pointer">
                    Preview <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)] italic">
                No external quotes or files were attached to this requisition.
              </p>
            )}
          </div>

          {/* Budget Impact Table (Requirement 2) */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
              Department Budget Impact
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[12px] text-[var(--text-muted)]">
                    <th className="py-2 px-3 font-medium">Budget</th>
                    <th className="py-2 px-3 font-medium text-right">Spent</th>
                    <th className="py-2 px-3 font-medium text-right">This Request</th>
                    <th className="py-2 px-3 font-medium text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="divide-x divide-[var(--surface-border)] font-sans tabular-nums">
                    <td className="py-2.5 px-3">
                      <MoneyCell amountPesewas={deptBudgetPesewas} align="left" size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <MoneyCell amountPesewas={deptSpentPesewas} align="right" size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <MoneyCell amountPesewas={reqAmountPesewas} align="right" size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">
                      <MoneyCell
                        amountPesewas={remainingPesewas}
                        align="right"
                        size="sm"
                        className={remainingPesewas < 0n ? 'text-[var(--status-red)]' : 'text-emerald-700 dark:text-emerald-400'}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {remainingPesewas < 0n && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--status-red)] pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>This requisition will exceed the current department budget ceiling.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Progress and Approval History */}
        <div className="space-y-6">
          {/* Workflow Progress */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-4">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
              Workflow Progress
            </span>

            <div className="space-y-4 text-[13px]">
              {/* Step 1: Submission */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    1. Requisition Submitted
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)] block">
                    By {requisition.submittedByName} on {formatDate(requisition.createdAt.slice(0, 10))}
                  </span>
                </div>
              </div>

              {/* Step 2: Tiered Approvals (Spec Section C3 & C4) */}
              {approvalRequest && approvalRequest.steps.length > 0 ? (
                approvalRequest.steps.map((step) => {
                  const isStepDone = step.status === 'APPROVED';
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isStepDone
                            ? 'bg-emerald-600 text-white'
                            : requisition.status === 'REJECTED'
                            ? 'bg-rose-600 text-white'
                            : 'bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {isStepDone ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : requisition.status === 'REJECTED' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--text-primary)] block">
                          Step {step.stepNumber}: {step.requiredRole} Authorization
                        </span>
                        <span className="text-[12px] text-[var(--text-muted)] block">
                          {isStepDone
                            ? `Authorized by ${step.approverUserName || 'Officer'} on ${formatDate(
                                (step.approvedAt || '').slice(0, 10)
                              )}`
                            : requisition.status === 'REJECTED'
                            ? 'Process stopped (declined)'
                            : `Awaiting sign-off by ${step.requiredRole}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      requisition.status === 'APPROVED' || requisition.status === 'PAID'
                        ? 'bg-emerald-600 text-white'
                        : requisition.status === 'REJECTED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {requisition.status === 'APPROVED' || requisition.status === 'PAID' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : requisition.status === 'REJECTED' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--text-primary)] block">
                      2. Pastoral / Treasurer Approval
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)] block">
                      {requisition.status === 'APPROVED' || requisition.status === 'PAID'
                        ? 'Authorized by Pastoral Leadership'
                        : requisition.status === 'REJECTED'
                        ? 'Declined with stated reason'
                        : 'Awaiting pastoral authorization'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Payment */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    requisition.status === 'PAID'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-muted)]'
                  }`}
                >
                  {requisition.status === 'PAID' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    3. Payment Voucher Disbursed
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)] block">
                    {requisition.status === 'PAID'
                      ? 'Cheque / MoMo issued to payee'
                      : 'Pending voucher preparation'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Approval History / Audit Trail */}
          <div className="border border-[var(--surface-border)] rounded-[var(--radius)] bg-[var(--surface-panel)] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] block">
              Approval History
            </span>

            <div className="space-y-3 text-[13px] border-l-2 border-[var(--surface-border)] pl-3.5">
              <div>
                <span className="font-medium text-[var(--text-primary)] block">
                  Created by {requisition.submittedByName}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {formatDate(requisition.createdAt.slice(0, 10))} · Initial submission
                </span>
              </div>

              {requisition.status === 'APPROVED' && (
                <div>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400 block">
                    Approved by Pastoral Board
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Authorized for payment voucher issuance
                  </span>
                </div>
              )}

              {requisition.status === 'PAID' && (
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-400 block">
                    Voucher Issued & Paid
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Disbursed through Cashbook
                  </span>
                </div>
              )}

              {requisition.status === 'REJECTED' && (
                <div>
                  <span className="font-medium text-rose-700 dark:text-rose-400 block">
                    Rejected
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Ceiling reached or declined
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar at bottom with Approve and Reject (Requirement 2) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface-panel)] border-t border-[var(--surface-border)] px-6 py-3.5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--text-muted)] font-medium">
            Requisition {shortDocNumber(requisition.reqNumber)}
          </span>
          <span className="text-[13px] text-[var(--text-secondary)]">·</span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            <MoneyCell amountPesewas={requisition.estimatedAmountPesewas} />
          </span>
        </div>

        <div className="flex items-center gap-3">
          {decisionMade && (
            <button
              type="button"
              onClick={handleNextPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius)] hover:opacity-90 transition shadow-xs"
            >
              <span>Approve and next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {requisition.status === 'PENDING' && (
            <>
              {isPreparer ? (
                <span className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[12px] font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Self-approval prohibited (Spec C4)</span>
                </span>
              ) : hasAlreadyApproved ? (
                <span className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[12px] font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Step authorized · Dual control requires 2nd officer</span>
                </span>
              ) : canApproveStandard ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(true)}
                    className="px-4 py-2 border border-[var(--status-red)] text-[var(--status-red)] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[13px] font-medium rounded-[var(--radius)] transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsApproveOpen(true)}
                    className="px-5 py-2 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius)] hover:opacity-90 transition shadow-xs cursor-pointer"
                  >
                    Approve
                  </button>
                </>
              ) : canTreasurerOverride ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(true)}
                    className="px-4 py-2 border border-[var(--status-red)] text-[var(--status-red)] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[13px] font-medium rounded-[var(--radius)] transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOverrideOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-[13px] font-semibold rounded-[var(--radius)] hover:bg-amber-700 transition shadow-xs cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Emergency override</span>
                  </button>
                </>
              ) : (
                <span className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-muted)] text-[12px] font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Awaiting sign-off by {nextPendingStep?.requiredRole || 'Pastor / Elder'}</span>
                </span>
              )}
            </>
          )}

          {requisition.status === 'APPROVED' && (
            <button
              type="button"
              onClick={() => navigate(`#/vouchers/new?reqId=${requisition.id}`)}
              className="px-5 py-2 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius)] hover:opacity-90 transition"
            >
              Issue Payment Voucher
            </button>
          )}

          {requisition.status === 'PAID' && (
            <span className="text-[13px] text-[var(--text-muted)] font-medium">
              Voucher Disbursed
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Approve (Optional Comment) */}
      <ConfirmationDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        title="Approve Requisition"
        description={`Are you sure you want to authorize Requisition ${shortDocNumber(requisition.reqNumber)} for ${formatPesewas(requisition.estimatedAmountPesewas)} GHS?`}
        confirmLabel="Approve Requisition"
        requireReason={false}
        onConfirm={(comment) => {
          if (comment) setApproveComment(comment);
          handleConfirmApprove();
        }}
      />

      {/* Confirmation Dialog for Reject (Mandatory Reason per Requirement 2) */}
      <ConfirmationDialog
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        title="Reject Requisition"
        description={`Please enter the mandatory reason for declining Requisition ${shortDocNumber(requisition.reqNumber)}.`}
        confirmLabel="Reject Requisition"
        isDestructive={true}
        requireReason={true}
        reasonLabel="Rejection Reason (Mandatory)"
        reasonPlaceholder="e.g. Department budget limit reached for Q4; please resubmit next quarter."
        onConfirm={(reason) => {
          if (reason) setRejectReason(reason);
          handleConfirmReject();
        }}
      />

      {/* Confirmation Dialog for Treasurer Emergency Override (Mandatory Reason, Spec C4) */}
      <ConfirmationDialog
        isOpen={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
        title="Treasurer Emergency Override"
        description={`You are exercising Treasurer Emergency Override authority on Requisition ${shortDocNumber(requisition.reqNumber)} (${formatPesewas(requisition.estimatedAmountPesewas)} GHS). This bypasses the standard role sequence and is permanently recorded in the Separation of Duties (SoD) exceptions report for Auditor review.`}
        confirmLabel="Authorize with Override"
        isDestructive={false}
        requireReason={true}
        reasonLabel="Mandatory Emergency Reason"
        reasonPlaceholder="State the operational justification for overriding the standard approval sequence..."
        onConfirm={(reason) => {
          if (reason) setOverrideReason(reason);
          handleConfirmEmergencyOverride();
        }}
      />
    </div>
  );
};
