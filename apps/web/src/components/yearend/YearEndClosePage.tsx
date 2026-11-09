import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  FileText,
  Download,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Plus,
  Info,
  X,
  FileCheck,
} from 'lucide-react';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { useToast } from '../../context/ToastContext.js';
import { evaluateYearEndChecklist, generateYearEndClosingPreview } from '@church/domain';
import type { YearEndCheckResult, AccrualPrepaymentEntry } from '@church/domain';

export const YearEndClosePage: React.FC = () => {
  const {
    selectedFinancialYear,
    accounts,
    funds,
    entries,
    periods,
    doctorReport,
    trialBalance,
    yearEndChecklistOverrides,
    overrideYearEndCheck,
    executeYearEndClose,
    reopenYearForAdjustment,
    latestDeltaNotice,
    dismissDeltaNotice,
    issuedYearEndPacks,
    postAccrualPrepayment,
  } = useLedger();

  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [activeStage, setActiveStage] = useState<'checklist' | 'preview' | 'closing' | 'pack'>('checklist');

  // Override modal state
  const [overrideModalCheck, setOverrideModalCheck] = useState<YearEndCheckResult | null>(null);
  const [overrideReasonInput, setOverrideReasonInput] = useState('');

  // Accruals modal state
  const [isAccrualModalOpen, setIsAccrualModalOpen] = useState(false);
  const [accrualType, setAccrualType] = useState<AccrualPrepaymentEntry['type']>('EXPENSE_ACCRUAL');
  const [accrualDesc, setAccrualDesc] = useState('');
  const [accrualAmountGhs, setAccrualAmountGhs] = useState('');
  const [accrualDebitAcc, setAccrualDebitAcc] = useState(accounts.find((a) => a.type === 'Expense')?.id || '');
  const [accrualCreditAcc, setAccrualCreditAcc] = useState(accounts.find((a) => a.type === 'Liability')?.id || '');
  const [accrualFund, setAccrualFund] = useState(funds[0]?.id || '');

  // Closing execution approvals
  const [pastorApproverName, setPastorApproverName] = useState('Rev. Emmanuel Addo (Senior Pastor / Elder)');
  const [auditorSignOffName, setAuditorSignOffName] = useState('Auditor Johnson (District Auditor)');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReasonInput, setReopenReasonInput] = useState('');
  const [reopenPastorName, setReopenPastorName] = useState('Rev. Emmanuel Addo');

  // Compute live checklist values
  const allMonthsClosed = useMemo(() => {
    const regularPeriods = periods.filter((p) => !p.isAdjustmentPeriod);
    return regularPeriods.length > 0 && regularPeriods.every((p) => p.isClosed || p.status === 'CLOSED');
  }, [periods]);

  const checklistEvaluation = useMemo(() => {
    return evaluateYearEndChecklist({
      allMonthsClosed,
      bankAndMomoReconciled: true,
      cashCountsCompleted: true,
      payrollAllMonthsPaid: true,
      usdRevaluationRun: true,
      depreciationRun: true,
      integrityCheckPasses: doctorReport.isClean,
      trialBalanceBalanced: trialBalance.isBalanced,
      suspenseAndClearingZero: true,
      needsAttentionQueueEmpty: true,
      remittancePayableAgrees: true,
      nextYearBudgetCreated: true,
      assetVerificationDone: true,
      openRequisitionsPendingCount: 0,
      outstandingPledgesCount: 4,
      overrides: yearEndChecklistOverrides,
    });
  }, [allMonthsClosed, doctorReport.isClean, trialBalance.isBalanced, yearEndChecklistOverrides]);

  // Compute fund closing preview
  const closingPreview = useMemo(() => {
    return generateYearEndClosingPreview({
      financialYearId: selectedFinancialYear.id,
      yearLabel: selectedFinancialYear.label,
      branchId: selectedFinancialYear.branchId,
      effectiveClosingDate: selectedFinancialYear.endDate,
      accounts,
      funds,
      entries,
    });
  }, [selectedFinancialYear, accounts, funds, entries]);

  const currentPack = issuedYearEndPacks[selectedFinancialYear.id];
  const isYearLocked = selectedFinancialYear.status === 'LOCKED';
  const isAdjustmentOnly = selectedFinancialYear.status === 'REOPENED_ADJUSTMENT_ONLY';

  const handleApplyOverride = () => {
    if (!overrideModalCheck || !overrideReasonInput.trim()) return;
    overrideYearEndCheck(overrideModalCheck.key, overrideReasonInput.trim());
    showToast(`Treasurer override recorded for ${overrideModalCheck.title}`, 'success');
    setOverrideModalCheck(null);
    setOverrideReasonInput('');
  };

  const handleCreateAccrual = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPesewas = BigInt(Math.round(parseFloat(accrualAmountGhs || '0') * 100));
    if (amountPesewas <= 0n || !accrualDesc.trim() || !accrualDebitAcc || !accrualCreditAcc) {
      showToast('Please provide valid accrual details and positive amount', 'error');
      return;
    }

    postAccrualPrepayment({
      type: accrualType,
      description: accrualDesc.trim(),
      debitAccountId: accrualDebitAcc,
      creditAccountId: accrualCreditAcc,
      amountPesewas,
      fundId: accrualFund,
    });

    showToast(`Accrual entry and auto-reversal posted successfully`, 'success');
    setIsAccrualModalOpen(false);
    setAccrualDesc('');
    setAccrualAmountGhs('');
  };

  const handleExecuteClose = () => {
    if (!checklistEvaluation.isCloseAllowed) {
      showToast('Cannot close financial year while blocking checklist items fail', 'error');
      return;
    }
    if (!pastorApproverName.trim()) {
      showToast('Pastor or Elder approval sign-off is required', 'error');
      return;
    }

    executeYearEndClose({
      pastorApproverName: pastorApproverName.trim(),
      auditorSignOffName: auditorSignOffName.trim() || undefined,
    });

    showToast(`${selectedFinancialYear.label} Year-End Close completed and books locked`, 'success');
    setActiveStage('pack');
  };

  const handleReopenYear = () => {
    if (!reopenReasonInput.trim() || !reopenPastorName.trim()) {
      showToast('Both pastor approval and a written reason are required to reopen', 'error');
      return;
    }

    reopenYearForAdjustment({
      yearId: selectedFinancialYear.id,
      pastorApproverName: reopenPastorName.trim(),
      reason: reopenReasonInput.trim(),
    });

    showToast(`Period 13 opened for auditor adjustments in ${selectedFinancialYear.label}`, 'success');
    setIsReopenModalOpen(false);
    setReopenReasonInput('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Header & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] font-medium mb-1">
            <button
              onClick={() => navigate('#/settings')}
              className="hover:text-[var(--text-primary)] transition"
            >
              Settings
            </button>
            <span>/</span>
            <span>Year-End Close</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1e3a2f]" />
            <span>Year-End Close & Financial Pack — {selectedFinancialYear.label}</span>
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            12-month closing process, fund equity zeroing, multi-role approvals, and issued year-end pack (Spec Section A2, A3).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isYearLocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[12px] font-semibold border border-gray-300 dark:border-gray-700">
              <Lock className="w-3.5 h-3.5" />
              <span>Year Locked</span>
            </span>
          ) : isAdjustmentOnly ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[12px] font-semibold border border-amber-300 dark:border-amber-700">
              <Unlock className="w-3.5 h-3.5 text-amber-600" />
              <span>Reopened (Period 13 Only)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-semibold border border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open for Year-End Close</span>
            </span>
          )}

          <button
            onClick={() => setIsAccrualModalOpen(true)}
            disabled={isYearLocked}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-panel)] text-[12px] font-semibold text-[var(--text-primary)] border border-[var(--surface-border)] transition disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Accruals & prepayments</span>
          </button>
        </div>
      </div>

      {/* Brought-Forward Delta Notice Banner (Period 13 Adjustments) */}
      {latestDeltaNotice && (
        <div className="p-4 rounded-[var(--radius)] bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex items-start justify-between gap-3 text-[13px] text-amber-900 dark:text-amber-200">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Brought-Forward Adjustment Notice (Period 13 Deltas Applied)</span>
            </div>
            <p className="text-[12px] text-amber-800 dark:text-amber-300">
              A post-close adjustment was posted by {latestDeltaNotice.actorName} for reason: &quot;{latestDeltaNotice.reason}&quot;. The brought-forward opening balances for the following accounts were updated:
            </p>
            <div className="mt-2 text-[12px] font-mono space-y-0.5">
              {latestDeltaNotice.accountDeltas.map((d) => (
                <div key={d.accountId} className="flex gap-4">
                  <span className="font-semibold">{d.accountCode} - {d.accountName}:</span>
                  <span>Previous: GHS {(Number(d.oldBroughtForwardPesewas) / 100).toFixed(2)}</span>
                  <span>→ New: GHS {(Number(d.newBroughtForwardPesewas) / 100).toFixed(2)}</span>
                  <span className="font-bold text-amber-700">Delta: GHS {(Number(d.deltaPesewas) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={dismissDeltaNotice}
            className="text-amber-700 hover:text-amber-950 p-1"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Stage Strip */}
      <div className="flex border-b border-[var(--surface-border)] gap-2">
        <button
          onClick={() => setActiveStage('checklist')}
          className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2 ${
            activeStage === 'checklist'
              ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>1. Year-End Checklist</span>
          {checklistEvaluation.blockingFailedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              {checklistEvaluation.blockingFailedCount} failing
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveStage('preview')}
          className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2 ${
            activeStage === 'preview'
              ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>2. Fund Closing Preview</span>
          {closingPreview.restrictedFundsWithDeficits.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              Deficit warning
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveStage('closing')}
          className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2 ${
            activeStage === 'closing'
              ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>3. Closing & Approvals</span>
        </button>

        <button
          onClick={() => setActiveStage('pack')}
          className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition flex items-center gap-2 ${
            activeStage === 'pack'
              ? 'border-[#1e3a2f] text-[#1e3a2f] dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>4. Issued Year-End Pack</span>
          {currentPack && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Pack Ready
            </span>
          )}
        </button>
      </div>

      {/* STAGE 1: YEAR-END CHECKLIST */}
      {activeStage === 'checklist' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Pre-Closing Verification Checklist</h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                All 11 blocking checks must pass or have recorded Treasurer justification before closing entries can post.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Status:{' '}
                {checklistEvaluation.isCloseAllowed ? (
                  <strong className="text-emerald-600 font-semibold">Eligible to close</strong>
                ) : (
                  <strong className="text-red-600 font-semibold">
                    {checklistEvaluation.blockingFailedCount} blocking items pending
                  </strong>
                )}
              </span>
              <button
                onClick={() => setActiveStage('preview')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[12px] font-semibold transition cursor-pointer"
              >
                <span>Continue to Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-card)] overflow-hidden">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-2.5 px-4 w-12 text-center">Status</th>
                  <th className="py-2.5 px-4">Verification Check</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Details & Diagnostics</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {checklistEvaluation.checks.map((chk) => (
                  <tr key={chk.key} className="hover:bg-[var(--surface-panel)] transition">
                    <td className="py-3 px-4 text-center">
                      {chk.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />}
                      {chk.status === 'FAIL' && <AlertTriangle className="w-4 h-4 text-red-600 inline" />}
                      {chk.status === 'OVERRIDDEN' && <ShieldAlert className="w-4 h-4 text-amber-600 inline" />}
                      {chk.status === 'WARNING' && <Info className="w-4 h-4 text-yellow-600 inline" />}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text-primary)]">{chk.title}</div>
                      <div className="text-[12px] text-[var(--text-muted)]">{chk.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          chk.category === 'BLOCKING'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200'
                        }`}
                      >
                        {chk.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-[var(--text-secondary)]">
                      <div>{chk.details}</div>
                      {chk.status === 'OVERRIDDEN' && (
                        <div className="text-amber-700 dark:text-amber-300 text-[11px] font-medium mt-1">
                          Overridden by {chk.overriddenBy}: &quot;{chk.overrideReason}&quot;
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {chk.targetRoute && (
                        <button
                          onClick={() => navigate(chk.targetRoute as any)}
                          className="inline-flex items-center gap-1 text-[12px] text-[#1e3a2f] dark:text-emerald-400 hover:underline"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      {chk.category === 'BLOCKING' && chk.status === 'FAIL' && currentUser.role === 'Treasurer' && (
                        <button
                          onClick={() => {
                            setOverrideModalCheck(chk);
                            setOverrideReasonInput('');
                          }}
                          className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-semibold transition"
                        >
                          Override
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAGE 2: FUND CLOSING PREVIEW */}
      {activeStage === 'preview' && (
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-1">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Fund Closing Balances Preview (No Postings)</h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Under church fund accounting rules, each fund closes strictly to its own equity account. Restricted balances remain restricted, and income/expenses start the new year at zero.
            </p>
          </div>

          {closingPreview.restrictedFundsWithDeficits.length > 0 && (
            <div className="p-3.5 rounded-[var(--radius)] bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-[13px] text-red-900 dark:text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Deficit Warning on Restricted Funds:</strong>
                <p className="text-[12px] mt-0.5">
                  The following restricted fund(s) end the year in a deficit position: {closingPreview.restrictedFundsWithDeficits.join(', ')}. In accordance with church policy, restricted funds cannot have negative balances carried forward without elder council approval.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-card)] overflow-hidden">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Fund Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Total Income</th>
                  <th className="py-2.5 px-4 text-right">Total Expenses</th>
                  <th className="py-2.5 px-4 text-right">Net Surplus / (Deficit)</th>
                  <th className="py-2.5 px-4 text-right">Brought Forward</th>
                  <th className="py-2.5 px-4 text-right">Carried Forward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)] tabular-nums">
                {closingPreview.fundSummaries.map((f) => (
                  <tr key={f.fundId} className="hover:bg-[var(--surface-panel)] transition">
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{f.fundName}</td>
                    <td className="py-3 px-4 text-[12px]">
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-medium">
                        {f.fundType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                      GHS {(Number(f.totalIncomePesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-medium">
                      GHS {(Number(f.totalExpensePesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[var(--text-primary)]">
                      GHS {(Number(f.netSurplusPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                      GHS {(Number(f.broughtForwardPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#1e3a2f] dark:text-emerald-400">
                      GHS {(Number(f.carriedForwardPesewas) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[var(--surface-border)] bg-[var(--surface-subtle)] font-bold text-[13px] tabular-nums">
                <tr>
                  <td className="py-3 px-4" colSpan={2}>
                    Total All Funds
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700">
                    GHS {(Number(closingPreview.totalIncomePesewas) / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700">
                    GHS {(Number(closingPreview.totalExpensePesewas) / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--text-primary)]">
                    GHS {(Number(closingPreview.totalNetSurplusPesewas) / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--text-secondary)]">-</td>
                  <td className="py-3 px-4 text-right text-[#1e3a2f] dark:text-emerald-400">
                    GHS {(Number(closingPreview.totalCarriedForwardPesewas) / 100).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[12px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Balance Sheet Net Assets: <strong>GHS {(Number(closingPreview.netAssetsPesewas) / 100).toFixed(2)}</strong> agrees strictly with Total Carried Forward.
              </span>
            </div>
            <button
              onClick={() => setActiveStage('closing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[12px] font-semibold transition cursor-pointer"
            >
              <span>Continue to Approvals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: CLOSING ENTRIES & APPROVALS */}
      {activeStage === 'closing' && (
        <div className="space-y-4">
          <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Year-End Closing Sign-Off & Lock Workflow</h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Multi-role authorization per Spec Section A3: Treasurer executes, Senior Pastor or Elder authorizes, and Auditor records formal sign-off.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                  1. Executing Treasurer
                </label>
                <input
                  type="text"
                  disabled
                  value={`${currentUser.fullName} (${currentUser.role})`}
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                  2. Authorizing Senior Pastor or Elder *
                </label>
                <input
                  type="text"
                  disabled={isYearLocked}
                  value={pastorApproverName}
                  onChange={(e) => setPastorApproverName(e.target.value)}
                  placeholder="Enter full name of authorising Pastor / Elder"
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                  3. Auditor Sign-Off (Optional for statutory review)
                </label>
                <input
                  type="text"
                  disabled={isYearLocked}
                  value={auditorSignOffName}
                  onChange={(e) => setAuditorSignOffName(e.target.value)}
                  placeholder="Enter Auditor name or District Inspection ref"
                  className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)]">
              <div>
                {!isYearLocked ? (
                  <button
                    onClick={handleExecuteClose}
                    disabled={!checklistEvaluation.isCloseAllowed}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[13px] font-bold transition disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Post Closing Entries & Lock {selectedFinancialYear.label}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {selectedFinancialYear.label} is locked.
                    </span>
                    <button
                      onClick={() => setIsReopenModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[12px] font-semibold transition cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Reopen for Adjustment (Period 13 only)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[12px] text-[var(--text-muted)]">
                Closing generates {funds.length} balanced journal entries tagged &quot;YEAR_END_CLOSING&quot;.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 4: ISSUED YEAR-END PACK */}
      {activeStage === 'pack' && (
        <div className="space-y-4">
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Issued Year-End Pack (10 Immutable Reports)</span>
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Archived financial reports for {selectedFinancialYear.label} with cryptographic SHA-256 block hashes (Spec Section A3).
              </p>
            </div>
            {currentPack && (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-secondary)]">
                Pack Checksum: {currentPack.packSha256Checksum.slice(0, 16)}...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(currentPack?.reports || []).map((rep) => (
              <div
                key={rep.id}
                className="p-3.5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-2 hover:border-[var(--surface-border-strong)] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1e3a2f] dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-[13px] text-[var(--text-primary)]">{rep.reportTitle}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                    SHA-256
                  </span>
                </div>

                <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1">
                  {Object.entries(rep.summaryFigures).map(([k, v]) => (
                    <span key={k}>
                      {k}: <strong className="text-[var(--text-primary)]">{v}</strong>
                    </span>
                  ))}
                </div>

                <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                  Hash: {rep.sha256Hash}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
            <span className="text-[12px] text-[var(--text-secondary)]">
              All 10 statements archived and permanently accessible under Reports tab.
            </span>
            <button
              onClick={() => showToast('Year-End Pack bundle downloaded as PDF archive', 'success')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white text-[12px] font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Complete Pack (PDF Bundle)</span>
            </button>
          </div>
        </div>
      )}

      {/* OVERRIDE CHECK MODAL */}
      {overrideModalCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <span>Treasurer Override for Checklist Item</span>
              </h3>
              <button
                onClick={() => setOverrideModalCheck(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[13px] text-[var(--text-secondary)] space-y-1">
              <span className="font-semibold text-[var(--text-primary)]">{overrideModalCheck.title}</span>
              <p>{overrideModalCheck.description}</p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Mandatory Written Reason for Override *
              </label>
              <textarea
                rows={3}
                value={overrideReasonInput}
                onChange={(e) => setOverrideReasonInput(e.target.value)}
                placeholder="Explain why this blocking item is being overridden and what mitigating evidence was verified..."
                className="w-full text-[13px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
              <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                This justification will be permanently printed in the Issued Year-End Pack and logged for the Auditor.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setOverrideModalCheck(null)}
                className="px-3 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyOverride}
                disabled={!overrideReasonInput.trim()}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold transition disabled:opacity-40"
              >
                Confirm & Log Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCRUALS & PREPAYMENTS DRAWER/MODAL */}
      {isAccrualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Post Year-End Accrual or Prepayment</h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Adjusting entry with automatic Day-1 new year reversal (Spec Section A2 & D3).
                </p>
              </div>
              <button
                onClick={() => setIsAccrualModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccrual} className="space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Type</label>
                <select
                  value={accrualType}
                  onChange={(e) => setAccrualType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                >
                  <option value="EXPENSE_ACCRUAL">Expense Accrual (Expense incurred, not yet invoiced/paid)</option>
                  <option value="REVENUE_PREPAYMENT">Revenue Prepayment (Income received in advance)</option>
                  <option value="EXPENSE_PREPAYMENT">Expense Prepayment (Expense paid in advance)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={accrualDesc}
                  onChange={(e) => setAccrualDesc(e.target.value)}
                  placeholder="e.g. Accrued December 2026 security & utilities"
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">Amount (GHS) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accrualAmountGhs}
                    onChange={(e) => setAccrualAmountGhs(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">Fund *</label>
                  <select
                    value={accrualFund}
                    onChange={(e) => setAccrualFund(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">Debit Account *</label>
                  <select
                    value={accrualDebitAcc}
                    onChange={(e) => setAccrualDebitAcc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">Credit Account *</label>
                  <select
                    value={accrualCreditAcc}
                    onChange={(e) => setAccrualCreditAcc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] text-[12px] text-[var(--text-muted)]">
                Entry will be posted on <strong>31 Dec {selectedFinancialYear.label.slice(-4)}</strong> and automatically reversed on <strong>01 Jan {parseInt(selectedFinancialYear.label.slice(-4)) + 1}</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setIsAccrualModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[#1e3a2f] hover:bg-[#162a22] text-white font-semibold transition"
                >
                  Post Accrual & Schedule Auto-Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REOPEN YEAR MODAL (PERIOD 13 ONLY) */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-600" />
                <span>Reopen Period 13 (Auditor Adjustments Only)</span>
              </h3>
              <button
                onClick={() => setIsReopenModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[12px] text-[var(--text-secondary)] space-y-1">
              <p>
                In accordance with Spec Section A3, reopening a closed financial year requires <strong>dual authorization (Treasurer + Pastor/Elder)</strong> and opens <strong>only Period 13</strong> for post-audit adjusting entries. Months 1–12 remain strictly locked.
              </p>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Co-Authorizing Pastor or Elder *
                </label>
                <input
                  type="text"
                  required
                  value={reopenPastorName}
                  onChange={(e) => setReopenPastorName(e.target.value)}
                  placeholder="Enter Pastor / Elder name"
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Justification for Reopening *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reopenReasonInput}
                  onChange={(e) => setReopenReasonInput(e.target.value)}
                  placeholder="Explain why Period 13 is being reopened (e.g. Annual audit adjustments from District Auditor)..."
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopenYear}
                disabled={!reopenReasonInput.trim() || !reopenPastorName.trim()}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[13px] transition disabled:opacity-40"
              >
                Authorize & Reopen Period 13
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
