/**
 * Year-End Checklist Evaluator (Spec Section A2).
 * Evaluates 11 blocking items and 4 advisory items before year-end close.
 * Blocking items can only be overridden by the Treasurer with a logged written reason.
 */

import type {
  YearEndCheckKey,
  YearEndCheckResult,
  YearEndOverride,
  YearEndChecklistEvaluation,
} from './types.js';

export interface YearEndChecklistInput {
  readonly allMonthsClosed: boolean;
  readonly bankAndMomoReconciled: boolean;
  readonly cashCountsCompleted: boolean;
  readonly payrollAllMonthsPaid: boolean;
  readonly usdRevaluationRun: boolean;
  readonly depreciationRun: boolean;
  readonly integrityCheckPasses: boolean;
  readonly trialBalanceBalanced: boolean;
  readonly suspenseAndClearingZero: boolean;
  readonly needsAttentionQueueEmpty: boolean;
  readonly remittancePayableAgrees: boolean;

  // Advisory items
  readonly nextYearBudgetCreated?: boolean;
  readonly assetVerificationDone?: boolean;
  readonly openRequisitionsPendingCount?: number;
  readonly outstandingPledgesCount?: number;

  // Existing Treasurer overrides
  readonly overrides?: readonly YearEndOverride[];
}

export function evaluateYearEndChecklist(input: YearEndChecklistInput): YearEndChecklistEvaluation {
  const overrides = input.overrides ?? [];
  const overrideMap = new Map<YearEndCheckKey, YearEndOverride>();
  for (const o of overrides) {
    overrideMap.set(o.checkKey, o);
  }

  function getStatus(passed: boolean, key: YearEndCheckKey): {
    status: 'PASS' | 'FAIL' | 'OVERRIDDEN';
    override?: YearEndOverride;
  } {
    if (passed) return { status: 'PASS' };
    const ov = overrideMap.get(key);
    if (ov) return { status: 'OVERRIDDEN', override: ov };
    return { status: 'FAIL' };
  }

  const checks: YearEndCheckResult[] = [];

  // 1. ALL_MONTHS_CLOSED
  const c1 = getStatus(input.allMonthsClosed, 'ALL_MONTHS_CLOSED');
  checks.push({
    key: 'ALL_MONTHS_CLOSED',
    title: 'All 12 monthly periods closed',
    description: 'All regular monthly periods in the financial year must be marked as closed.',
    category: 'BLOCKING',
    status: c1.status,
    targetRoute: '#/settings',
    details: input.allMonthsClosed ? 'All periods closed.' : 'One or more regular monthly periods remain open.',
    overrideReason: c1.override?.reason,
    overriddenBy: c1.override?.overriddenByTreasurerName,
    overriddenAt: c1.override?.timestamp,
  });

  // 2. BANK_MOMO_RECONCILED
  const c2 = getStatus(input.bankAndMomoReconciled, 'BANK_MOMO_RECONCILED');
  checks.push({
    key: 'BANK_MOMO_RECONCILED',
    title: 'Bank and mobile money accounts reconciled',
    description: 'Every bank and MoMo account must have a signed-off reconciliation statement as of year-end.',
    category: 'BLOCKING',
    status: c2.status,
    targetRoute: '#/cashbook',
    details: input.bankAndMomoReconciled ? 'All accounts reconciled.' : 'Pending bank or MoMo reconciliation statements.',
    overrideReason: c2.override?.reason,
    overriddenBy: c2.override?.overriddenByTreasurerName,
    overriddenAt: c2.override?.timestamp,
  });

  // 3. CASH_COUNTS_DONE
  const c3 = getStatus(input.cashCountsCompleted, 'CASH_COUNTS_DONE');
  checks.push({
    key: 'CASH_COUNTS_DONE',
    title: 'Year-end physical cash counts completed',
    description: 'Physical cash counts for petty cash and custody boxes must be completed and signed off.',
    category: 'BLOCKING',
    status: c3.status,
    targetRoute: '#/cashbook',
    details: input.cashCountsCompleted ? 'Cash counts verified.' : 'Year-end cash counts not recorded.',
    overrideReason: c3.override?.reason,
    overriddenBy: c3.override?.overriddenByTreasurerName,
    overriddenAt: c3.override?.timestamp,
  });

  // 4. PAYROLL_POSTED_PAID
  const c4 = getStatus(input.payrollAllMonthsPaid, 'PAYROLL_POSTED_PAID');
  checks.push({
    key: 'PAYROLL_POSTED_PAID',
    title: 'Payroll for all 12 months posted and paid',
    description: 'Statutory PAYE and SSNIT tiers for all 12 payroll runs must be processed and paid.',
    category: 'BLOCKING',
    status: c4.status,
    targetRoute: '#/payroll',
    details: input.payrollAllMonthsPaid ? 'All 12 payroll runs posted & paid.' : 'Unposted or unpaid payroll months remain.',
    overrideReason: c4.override?.reason,
    overriddenBy: c4.override?.overriddenByTreasurerName,
    overriddenAt: c4.override?.timestamp,
  });

  // 5. USD_REVALUATION_RUN
  const c5 = getStatus(input.usdRevaluationRun, 'USD_REVALUATION_RUN');
  checks.push({
    key: 'USD_REVALUATION_RUN',
    title: 'Foreign currency year-end revaluation run',
    description: 'Foreign currency accounts revalued at Bank of Ghana year-end closing rates.',
    category: 'BLOCKING',
    status: c5.status,
    targetRoute: '#/settings',
    details: input.usdRevaluationRun ? 'Revaluation completed.' : 'Year-end currency revaluation pending.',
    overrideReason: c5.override?.reason,
    overriddenBy: c5.override?.overriddenByTreasurerName,
    overriddenAt: c5.override?.timestamp,
  });

  // 6. DEPRECIATION_RUN
  const c6 = getStatus(input.depreciationRun, 'DEPRECIATION_RUN');
  checks.push({
    key: 'DEPRECIATION_RUN',
    title: 'Fixed asset annual depreciation posted',
    description: 'Annual straight-line depreciation for tagged assets posted to general ledger.',
    category: 'BLOCKING',
    status: c6.status,
    targetRoute: '#/fixed-assets',
    details: input.depreciationRun ? 'Depreciation posted.' : 'Annual depreciation run has not been executed.',
    overrideReason: c6.override?.reason,
    overriddenBy: c6.override?.overriddenByTreasurerName,
    overriddenAt: c6.override?.timestamp,
  });

  // 7. INTEGRITY_CHECK_PASS
  const c7 = getStatus(input.integrityCheckPasses, 'INTEGRITY_CHECK_PASS');
  checks.push({
    key: 'INTEGRITY_CHECK_PASS',
    title: 'Trial Balance Doctor integrity audit passes',
    description: 'All 17 integrity checks (subledger balances and SHA-256 hash chains) must pass cleanly.',
    category: 'BLOCKING',
    status: c7.status,
    targetRoute: '#/doctor',
    details: input.integrityCheckPasses ? 'All 17 integrity checks passed.' : 'Doctor detected integrity warnings or discrepancies.',
    overrideReason: c7.override?.reason,
    overriddenBy: c7.override?.overriddenByTreasurerName,
    overriddenAt: c7.override?.timestamp,
  });

  // 8. TRIAL_BALANCE_BALANCED
  const c8 = getStatus(input.trialBalanceBalanced, 'TRIAL_BALANCE_BALANCED');
  checks.push({
    key: 'TRIAL_BALANCE_BALANCED',
    title: 'General ledger trial balance balanced',
    description: 'Total debits must strictly equal total credits across all accounts and funds.',
    category: 'BLOCKING',
    status: c8.status,
    targetRoute: '#/reports',
    details: input.trialBalanceBalanced ? 'Debits equal Credits.' : 'General ledger is out of balance.',
    overrideReason: c8.override?.reason,
    overriddenBy: c8.override?.overriddenByTreasurerName,
    overriddenAt: c8.override?.timestamp,
  });

  // 9. SUSPENSE_CLEARING_ZERO
  const c9 = getStatus(input.suspenseAndClearingZero, 'SUSPENSE_CLEARING_ZERO');
  checks.push({
    key: 'SUSPENSE_CLEARING_ZERO',
    title: 'Suspense and interfund clearing accounts zeroed',
    description: 'Interfund clearing and temporary suspense accounts must have zero balances before close.',
    category: 'BLOCKING',
    status: c9.status,
    targetRoute: '#/ledger',
    details: input.suspenseAndClearingZero ? 'Suspense accounts clear.' : 'Non-zero balances in suspense or clearing accounts.',
    overrideReason: c9.override?.reason,
    overriddenBy: c9.override?.overriddenByTreasurerName,
    overriddenAt: c9.override?.timestamp,
  });

  // 10. NEEDS_ATTENTION_EMPTY
  const c10 = getStatus(input.needsAttentionQueueEmpty, 'NEEDS_ATTENTION_EMPTY');
  checks.push({
    key: 'NEEDS_ATTENTION_EMPTY',
    title: 'Needs Attention and sync queue clear',
    description: 'No unposted offline transactions or rejected sync entries can remain in the attention queue.',
    category: 'BLOCKING',
    status: c10.status,
    targetRoute: '#/sync',
    details: input.needsAttentionQueueEmpty ? 'Attention queue empty.' : 'Unresolved items exist in Needs Attention queue.',
    overrideReason: c10.override?.reason,
    overriddenBy: c10.override?.overriddenByTreasurerName,
    overriddenAt: c10.override?.timestamp,
  });

  // 11. REMITTANCE_PAYABLE_AGREES
  const c11 = getStatus(input.remittancePayableAgrees, 'REMITTANCE_PAYABLE_AGREES');
  checks.push({
    key: 'REMITTANCE_PAYABLE_AGREES',
    title: 'Denominational remittance payable reconciled',
    description: 'Accrued tithe remittances must equal total assessed less remittances transferred.',
    category: 'BLOCKING',
    status: c11.status,
    targetRoute: '#/tithes',
    details: input.remittancePayableAgrees ? 'Remittances reconciled.' : 'Variance in accrued vs paid denominational remittance.',
    overrideReason: c11.override?.reason,
    overriddenBy: c11.override?.overriddenByTreasurerName,
    overriddenAt: c11.override?.timestamp,
  });

  // Advisory 1: NEXT_YEAR_BUDGET_CREATED
  const nextBudget = input.nextYearBudgetCreated ?? true;
  checks.push({
    key: 'NEXT_YEAR_BUDGET_CREATED',
    title: 'Next financial year budget created',
    description: 'Draft operational budget for next year should be configured or rolled over.',
    category: 'ADVISORY',
    status: nextBudget ? 'PASS' : 'WARNING',
    targetRoute: '#/budgets',
    details: nextBudget ? 'Next year budget exists.' : 'Budget for next year has not been established yet.',
  });

  // Advisory 2: ASSET_VERIFICATION_DONE
  const assetVer = input.assetVerificationDone ?? true;
  checks.push({
    key: 'ASSET_VERIFICATION_DONE',
    title: 'Annual physical asset verification completed',
    description: 'Physical existence of tagged church property should be verified.',
    category: 'ADVISORY',
    status: assetVer ? 'PASS' : 'WARNING',
    targetRoute: '#/fixed-assets',
    details: assetVer ? 'Asset verification completed.' : 'Annual physical asset verification not recorded.',
  });

  // Advisory 3: OPEN_REQUISITIONS_PENDING
  const openReqs = input.openRequisitionsPendingCount ?? 0;
  checks.push({
    key: 'OPEN_REQUISITIONS_PENDING',
    title: 'Open expenditure requisitions reviewed',
    description: 'Review pending department requisitions to avoid unrecorded commitments.',
    category: 'ADVISORY',
    status: openReqs === 0 ? 'PASS' : 'WARNING',
    targetRoute: '#/expenses',
    details: openReqs === 0 ? 'No open requisitions.' : `${openReqs} pending requisitions are still open.`,
  });

  // Advisory 4: OUTSTANDING_PLEDGES_REVIEW
  const openPledges = input.outstandingPledgesCount ?? 0;
  checks.push({
    key: 'OUTSTANDING_PLEDGES_REVIEW',
    title: 'Annual pledge campaign balances reviewed',
    description: 'Review open pledges to determine carry-forward balances for next year.',
    category: 'ADVISORY',
    status: 'PASS',
    targetRoute: '#/pledges',
    details: `${openPledges} active pledges rolling forward into next year.`,
  });

  let blockingFailedCount = 0;
  let blockingOverriddenCount = 0;
  let advisoryWarningCount = 0;

  for (const c of checks) {
    if (c.category === 'BLOCKING') {
      if (c.status === 'FAIL') blockingFailedCount++;
      else if (c.status === 'OVERRIDDEN') blockingOverriddenCount++;
    } else {
      if (c.status === 'WARNING') advisoryWarningCount++;
    }
  }

  const isCloseAllowed = blockingFailedCount === 0;

  return {
    isCloseAllowed,
    blockingFailedCount,
    blockingOverriddenCount,
    advisoryWarningCount,
    checks,
    overrides,
  };
}
