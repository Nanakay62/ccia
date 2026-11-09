import type {
  GoLiveCheckItem,
  GoLiveReadinessReport,
  RoleTrainingRecord,
} from './types.js';

export interface EvaluateGoLiveReadinessInput {
  readonly isLive: boolean;
  readonly wentLiveAt?: string | null;
  readonly treasurerConfirmedBy?: string | null;
  readonly pastorOrElderConfirmedBy?: string | null;
  readonly demoModePermanentlyDisabled: boolean;

  readonly churchProfileComplete: boolean;
  readonly churchName: string;
  readonly fiscalYearLabel: string;

  readonly chartOfAccountsReviewed: boolean;
  readonly activeAccountCount: number;

  readonly fundsConfigured: boolean;
  readonly activeFundCount: number;

  readonly bankMomoCashConfigured: boolean;
  readonly cashAndBankAccountCount: number;

  readonly remittanceRuleConfigured: boolean;
  readonly remittanceRuleSummary: string;

  readonly exchangeRateEntered: boolean;
  readonly latestUsdRate: string;
  readonly latestUsdRateDate: string;

  readonly openingBalancesPostedAndBalanced: boolean;
  readonly openingBalanceBatchNumber?: string | null;

  readonly openingBankReconciliationsSignedOff: boolean;
  readonly openingCashCountsSignedOff: boolean;
  readonly fixedAssetRegisterReconciled: boolean;

  readonly usersCreatedAndMfaEnrolled: boolean;
  readonly mfaEnrolledCount: number;
  readonly mfaRequiredCount: number;

  readonly approvalLimitsConfigured: boolean;
  readonly roleTrainings: readonly RoleTrainingRecord[];

  readonly backupTaken: boolean;
  readonly lastBackupDate?: string | null;
  readonly restoreTested: boolean;
  readonly lastRestoreTestDate?: string | null;

  readonly parallelRunApproved: boolean;
  readonly parallelRunSummary: string;

  readonly isDemoModeActive: boolean;
}

/**
 * Evaluates all 16 Go-Live Readiness checks required by Spec Section B5.
 */
export function evaluateGoLiveReadiness(
  input: EvaluateGoLiveReadinessInput
): GoLiveReadinessReport {
  const allRolesTrained =
    input.roleTrainings.length > 0 &&
    input.roleTrainings.every((t) => t.trained && Boolean(t.trainedDate));
  const trainedCount = input.roleTrainings.filter((t) => t.trained && Boolean(t.trainedDate)).length;

  const backupAndRestorePassed = input.backupTaken && input.restoreTested;
  const demoAbsentPassed = !input.isDemoModeActive;

  const items: GoLiveCheckItem[] = [
    {
      key: 'CHURCH_PROFILE_SET',
      number: 1,
      title: 'Church profile and financial year set',
      description: 'Church name, branch, functional currency (GHS), and financial year start month configured.',
      passed: input.churchProfileComplete,
      statusText: input.churchProfileComplete
        ? `${input.churchName} · ${input.fiscalYearLabel} configured`
        : 'Church profile or financial year incomplete',
      targetRoute: '#/settings',
      actionLabel: 'Review profile',
    },
    {
      key: 'CHART_OF_ACCOUNTS_REVIEWED',
      number: 2,
      title: 'Chart of accounts reviewed',
      description: 'All active asset, liability, equity, income, and expense accounts verified.',
      passed: input.chartOfAccountsReviewed && input.activeAccountCount > 0,
      statusText: `${input.activeAccountCount} active accounts verified`,
      targetRoute: '#/settings',
      actionLabel: 'View accounts',
    },
    {
      key: 'FUNDS_SET_UP',
      number: 3,
      title: 'Funds set up (unrestricted and restricted)',
      description: 'General Fund and restricted funds configured with strict balance rules.',
      passed: input.fundsConfigured && input.activeFundCount >= 2,
      statusText: `${input.activeFundCount} funds active (Unrestricted & Restricted)`,
      targetRoute: '#/settings',
      actionLabel: 'View funds',
    },
    {
      key: 'BANK_MOMO_CASH_CONFIGURED',
      number: 4,
      title: 'Bank, MoMo and cash accounts configured',
      description: 'Operating bank accounts, Mobile Money wallet, and petty/safe cash accounts active.',
      passed: input.bankMomoCashConfigured && input.cashAndBankAccountCount >= 3,
      statusText: `${input.cashAndBankAccountCount} bank, MoMo, and cash accounts active`,
      targetRoute: '#/cashbook',
      actionLabel: 'Open cashbook',
    },
    {
      key: 'DENOMINATIONAL_REMITTANCE_RULE_SET',
      number: 5,
      title: 'Denominational remittance rule set (or marked not applicable)',
      description: 'Headquarters/District tithe remittance percentage and payable account configured.',
      passed: input.remittanceRuleConfigured,
      statusText: input.remittanceRuleSummary,
      targetRoute: '#/tithes',
      actionLabel: 'Review rule',
    },
    {
      key: 'EXCHANGE_RATE_ENTERED',
      number: 6,
      title: 'Initial USD exchange rate entered',
      description: 'Benchmark USD to GHS exchange rate recorded for foreign currency transactions.',
      passed: input.exchangeRateEntered,
      statusText: input.exchangeRateEntered
        ? `1 USD = GHS ${input.latestUsdRate} (${input.latestUsdRateDate})`
        : 'Initial USD rate not entered',
      targetRoute: '#/settings',
      actionLabel: 'Update rate',
    },
    {
      key: 'OPENING_BALANCES_POSTED_AND_BALANCED',
      number: 7,
      title: 'Opening balances posted and balanced by fund',
      description: 'One balanced opening entry per fund committed with Treasurer and Pastor/Elder sign-off.',
      passed: input.openingBalancesPostedAndBalanced,
      statusText: input.openingBalancesPostedAndBalanced
        ? `Committed (${input.openingBalanceBatchNumber ?? 'IMP-OB-0001'}) — balanced overall and per fund`
        : 'Opening balances not yet committed',
      targetRoute: '#/opening-balances',
      actionLabel: 'Opening balances',
    },
    {
      key: 'OPENING_BANK_RECONCILIATIONS_SIGNED_OFF',
      number: 8,
      title: 'Opening bank and MoMo reconciliations signed off',
      description: 'Cut-over bank and Mobile Money ledger balances agreed to statements.',
      passed: input.openingBankReconciliationsSignedOff,
      statusText: input.openingBankReconciliationsSignedOff
        ? 'GCB Bank & MTN MoMo cut-over statements agreed and signed off'
        : 'Pending bank/MoMo statement sign-off',
      targetRoute: '#/opening-balances',
      actionLabel: 'Verify statements',
    },
    {
      key: 'OPENING_CASH_COUNTS_SIGNED_OFF',
      number: 9,
      title: 'Opening cash counts signed off',
      description: 'Physical safe cash counts (GHS and USD) agreed to cut-over cash accounts.',
      passed: input.openingCashCountsSignedOff,
      statusText: input.openingCashCountsSignedOff
        ? 'GHS & USD physical safe cash counts verified'
        : 'Pending opening cash count sign-off',
      targetRoute: '#/opening-balances',
      actionLabel: 'Verify cash count',
    },
    {
      key: 'FIXED_ASSET_REGISTER_RECONCILED',
      number: 10,
      title: 'Fixed asset register reconciled to the ledger',
      description: 'Imported asset cost and accumulated depreciation match the general ledger.',
      passed: input.fixedAssetRegisterReconciled,
      statusText: input.fixedAssetRegisterReconciled
        ? 'Asset register cost & accumulated depreciation agree with ledger'
        : 'Asset register does not match ledger',
      targetRoute: '#/assets',
      actionLabel: 'Fixed assets',
    },
    {
      key: 'USERS_CREATED_MFA_ENROLLED',
      number: 11,
      title: 'Users created, roles assigned, two-step sign-in enrolled',
      description: 'Required roles assigned and authenticator 2FA enrolled for financial officers.',
      passed: input.usersCreatedAndMfaEnrolled,
      statusText: `${input.mfaEnrolledCount} of ${input.mfaRequiredCount} required officers enrolled in 2FA`,
      targetRoute: '#/settings',
      actionLabel: 'Users & 2FA',
    },
    {
      key: 'APPROVAL_LIMITS_CONFIGURED',
      number: 12,
      title: 'Approval limits configured',
      description: 'Transaction approval bands proposed by Treasurer and approved by Pastor/Elder.',
      passed: input.approvalLimitsConfigured,
      statusText: input.approvalLimitsConfigured
        ? 'Approval limits matrix configured and active'
        : 'Approval limits matrix not yet configured',
      targetRoute: '#/settings',
      actionLabel: 'Configure limits',
    },
    {
      key: 'ROLE_TRAINING_COMPLETED',
      number: 13,
      title: 'Each role trained on their screens (marked "Trained" with date)',
      description: 'All officers have completed role-specific walkthrough training.',
      passed: allRolesTrained,
      statusText: `${trainedCount} of ${input.roleTrainings.length} officers marked "Trained" with date`,
      targetRoute: '#/go-live',
      actionLabel: 'Manage below',
    },
    {
      key: 'BACKUP_TAKEN_AND_RESTORE_TESTED',
      number: 14,
      title: 'First encrypted backup taken AND a restore test completed',
      description: 'Encrypted snapshot exported and test restore verified before going live.',
      passed: backupAndRestorePassed,
      statusText: backupAndRestorePassed
        ? `Backup taken (${input.lastBackupDate}) · Restore tested (${input.lastRestoreTestDate})`
        : !input.backupTaken
        ? 'Encrypted backup not yet taken'
        : 'Backup taken, but restore test not yet completed',
      targetRoute: '#/settings',
      actionLabel: 'Backup & restore',
    },
    {
      key: 'PARALLEL_RUN_APPROVED',
      number: 15,
      title: 'Parallel run signed off by the chief accountant',
      description: 'Old books vs. new system compared for 2–3 month-ends and signed off.',
      passed: input.parallelRunApproved,
      statusText: input.parallelRunSummary,
      targetRoute: '#/parallel-run',
      actionLabel: 'Parallel run',
    },
    {
      key: 'DEMO_DATA_ABSENT',
      number: 16,
      title: 'Demo data confirmed absent from the live database',
      description: 'System is operating on the clean live database partition with demo sandbox exited.',
      passed: demoAbsentPassed,
      statusText: demoAbsentPassed
        ? 'Clean live database active (0 demo records in live partition)'
        : 'Currently in Demo Mode — exit Demo Mode before going live',
      targetRoute: '#/settings',
      actionLabel: 'Check mode',
    },
  ];

  const passedCount = items.filter((i) => i.passed).length;
  const totalCount = items.length;
  const allChecksPassed = passedCount === totalCount;

  return {
    isLive: input.isLive,
    wentLiveAt: input.wentLiveAt ?? null,
    treasurerConfirmedBy: input.treasurerConfirmedBy ?? null,
    pastorOrElderConfirmedBy: input.pastorOrElderConfirmedBy ?? null,
    demoModePermanentlyDisabled: input.demoModePermanentlyDisabled,
    allChecksPassed,
    passedCount,
    totalCount,
    items,
    roleTrainings: input.roleTrainings,
  };
}

/**
 * Validates the dual-custody Go-Live confirmation (Spec Section B5: Treasurer + Pastor/Elder).
 */
export function confirmGoLiveTransition(params: {
  readonly readiness: GoLiveReadinessReport;
  readonly treasurerName: string;
  readonly pastorOrElderName: string;
  readonly permanentlyDisableDemoMode: boolean;
  readonly nowIso?: string;
}): {
  readonly isLive: true;
  readonly wentLiveAt: string;
  readonly treasurerConfirmedBy: string;
  readonly pastorOrElderConfirmedBy: string;
  readonly demoModePermanentlyDisabled: boolean;
} {
  if (!params.readiness.allChecksPassed) {
    const failing = params.readiness.items.filter((i) => !i.passed).map((i) => `#${i.number} ${i.title}`);
    throw new Error(
      `Cannot Go Live until all 16 readiness checks pass. Remaining: ${failing.join('; ')}`
    );
  }
  const t = params.treasurerName.trim();
  const p = params.pastorOrElderName.trim();
  if (!t || !p) {
    throw new Error('Both Treasurer sign-off and Pastor/Elder confirmation are required to Go Live.');
  }
  if (t.toLowerCase() === p.toLowerCase()) {
    throw new Error(
      'Separation of duties: The Treasurer and the Pastor/Elder confirming Go-Live must be two different people.'
    );
  }

  return {
    isLive: true,
    wentLiveAt: params.nowIso ?? new Date().toISOString(),
    treasurerConfirmedBy: t,
    pastorOrElderConfirmedBy: p,
    demoModePermanentlyDisabled: params.permanentlyDisableDemoMode,
  };
}
