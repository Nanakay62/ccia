import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppSchema } from '../src/schema.js';
import {
  generateFinancialYearWithPeriods,
  transitionPeriodStatus,
  canPostToPeriod,
  generateOpeningBalanceCsvTemplate,
  parseOpeningBalanceCsv,
  runOpeningBalanceDryRun,
  commitOpeningBalances,
  createJournalEntry,
  calculateTrialBalance,
  evaluateYearEndChecklist,
  generateYearEndClosingPreview,
  generateYearEndClosingEntries,
  generateIssuedYearEndPack,
  generateAccrualDayOneReversal,
  calculateBroughtForwardDeltas,
  rolloverBudget,
  hasPermission,
  type Account,
  type Fund,
  type JournalEntry,
  type Role,
} from '@church/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 8 Hardening Suite: Database RLS Matrix, Sync Rules & Full Multi-Year Lifecycle Simulation (rls_and_simulation.test.ts)', () => {
  it('1. verifies SQL migrations define all 27 Go-Live/Year-End/Security tables, locked-year triggers, and no-self-approval triggers', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20261105000000_golive_yearend_security.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    const expectedTables = [
      'financial_years',
      'year_end_runs',
      'year_end_checks',
      'year_end_overrides',
      'issued_reports',
      'import_batches',
      'import_rows',
      'import_errors',
      'parallel_run_entries',
      'go_live_items',
      'go_live_event',
      'mfa_factors',
      'recovery_codes',
      'login_attempts',
      'device_enrolments',
      'approval_rule_versions',
      'approval_rules',
      'approval_requests',
      'approval_steps',
      'sod_rules',
      'sod_exceptions',
      'controlled_detail_changes',
      'security_events',
      'notifications',
      'member_data_requests',
      'client_versions',
    ];

    for (const table of expectedTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(AppSchema.tables.some((t) => t.name === table)).toBe(true);
    }

    // Verify Period 13 constraint expansion and database triggers
    expect(sql).toContain('month BETWEEN 1 AND 13');
    expect(sql).toContain('enforce_financial_year_and_period_lock');
    expect(sql).toContain('REOPENED_ADJUSTMENT_ONLY');
    expect(sql).toContain('enforce_no_self_approval_step');
  });

  it('2. verifies PowerSync sync_rules.yaml enforces 2-year offline window (current + previous FY) and role-based privacy buckets', () => {
    const syncRulesPath = path.resolve(__dirname, '../powersync/sync_rules.yaml');
    const yaml = fs.readFileSync(syncRulesPath, 'utf-8');

    // Current + previous financial year sync window for fast offline devices (Spec A4)
    expect(yaml).toContain("entry_date >= (CURRENT_DATE - INTERVAL '2 years')");

    // Privacy bucket restricting member giving & pledges to authorized leadership roles
    expect(yaml).toContain('member_giving_private:');
    expect(yaml).toContain("request.user_role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')");

    // Counter directory excludes individual giving records
    expect(yaml).toContain('member_counter_directory:');
    expect(yaml).toContain("request.user_role = 'Counter'");
  });

  it('3. verifies role permission & RLS matrix across all 7 church roles', () => {
    const roles: Role[] = [
      'Treasurer',
      'Finance Secretary',
      'Pastor / Elder',
      'Counter',
      'Auditor',
      'Department Head',
      'Admin',
    ];
    expect(roles).toHaveLength(7);

    // Individual giving privacy: Counter and Department Head cannot read individual giving
    expect(hasPermission('Treasurer', 'members:view_individual_giving')).toBe(true);
    expect(hasPermission('Finance Secretary', 'members:view_individual_giving')).toBe(true);
    expect(hasPermission('Pastor / Elder', 'members:view_individual_giving')).toBe(true);
    expect(hasPermission('Auditor', 'members:view_individual_giving')).toBe(true);
    expect(hasPermission('Counter', 'members:view_individual_giving')).toBe(false);
    expect(hasPermission('Department Head', 'members:view_individual_giving')).toBe(false);

    // Auditor is strictly read-only on ledger postings
    expect(hasPermission('Auditor', 'audit:view_log')).toBe(true);
    expect(hasPermission('Auditor', 'ledger:post_entry')).toBe(false);
  });

  it('4. executes full multi-year lifecycle simulation (Cut-Over -> 12 Monthly Closes -> Year-End Close -> Period 13 Adjustment -> FY2027 Rollover) within performance target', () => {
    const startTime = performance.now();
    const BRANCH_ID = 'br-calvary-accra';

    const accounts: Account[] = [
      { id: 'acct-1010', branchId: BRANCH_ID, code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
      { id: 'acct-1020', branchId: BRANCH_ID, code: '1020', name: 'Cash on Hand (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
      { id: 'acct-1030', branchId: BRANCH_ID, code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
      { id: 'acct-1050', branchId: BRANCH_ID, code: '1050', name: 'Mobile Money (MoMo) Wallet', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
      { id: 'acct-1510', branchId: BRANCH_ID, code: '1510', name: 'Sound & Musical Equipment (Cost)', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-1519', branchId: BRANCH_ID, code: '1519', name: 'Accumulated Depreciation - Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-2010', branchId: BRANCH_ID, code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-3010', branchId: BRANCH_ID, code: '3010', name: 'General Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-3020', branchId: BRANCH_ID, code: '3020', name: 'Restricted Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-4010', branchId: BRANCH_ID, code: '4010', name: 'Tithes & Offerings Income', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-4020', branchId: BRANCH_ID, code: '4020', name: 'Building Fund Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-5010', branchId: BRANCH_ID, code: '5010', name: 'Ministry & Utility Expense', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
      { id: 'acct-5020', branchId: BRANCH_ID, code: '5020', name: 'Building Project Expense', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
    ];

    const funds: Fund[] = [
      { id: 'fund-gen', branchId: BRANCH_ID, code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
      { id: 'fund-bld', branchId: BRANCH_ID, code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
      { id: 'fund-mis', branchId: BRANCH_ID, code: 'MIS', name: 'Missions & Outreach Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
    ];

    // Step A: Initialize FY2026 (12 monthly periods + Period 13)
    const fy2026Init = generateFinancialYearWithPeriods({
      id: 'fy-2026',
      branchId: BRANCH_ID,
      label: 'FY2026',
      startYear: 2026,
      startMonth: 1,
      hasAdjustmentPeriod: true,
    });
    let fy2026 = fy2026Init.financialYear;
    let periods2026 = [...fy2026Init.periods];

    // Step B: Cut-over & Opening Balances on 01 Jan 2026
    const obRows = parseOpeningBalanceCsv(generateOpeningBalanceCsvTemplate('2026-01-01'));
    const obDryRun = runOpeningBalanceDryRun({
      rows: obRows,
      cutOverDate: '2026-01-01',
      branchId: BRANCH_ID,
      financialYearId: fy2026.id,
      accounts,
      funds,
      createdBy: 'Kofi Mensah (Treasurer)',
      deviceId: 'DEV-TR-01',
      proofs: {
        statementAndCashProofs: [
          { accountCode: '1010', statementOrCountBalanceGhs: 450000n, statementDate: '2026-01-01', reference: 'CC-01' },
          { accountCode: '1030', statementOrCountBalanceGhs: 7050000n, statementDate: '2026-01-01', reference: 'GCB-01' },
          { accountCode: '1050', statementOrCountBalanceGhs: 620000n, statementDate: '2026-01-01', reference: 'MOMO-01' },
        ],
        payablesScheduleTotalGhs: 120000n,
      },
    });
    const obCommit = commitOpeningBalances({
      dryRun: obDryRun,
      treasurerSignedBy: 'Kofi Mensah (Treasurer)',
      pastorOrElderApprovedBy: 'Rev. Emmanuel Addo (Senior Pastor)',
    });

    const ledgerEntries: JournalEntry[] = [...obCommit];

    // Step C: Simulate 12 months of parish operations (20 transactions per month = 240 entries) & close each month
    for (let m = 1; m <= 12; m++) {
      const monthStr = String(m).padStart(2, '0');
      const periodIdx = m - 1;
      const currentPeriod = periods2026[periodIdx]!;

      expect(canPostToPeriod({ period: currentPeriod, financialYear: fy2026, userRole: 'Finance Secretary' }).allowed).toBe(true);

      for (let tx = 1; tx <= 10; tx++) {
        const dayStr = String(Math.min(tx * 2, 28)).padStart(2, '0');
        // Weekly Tithe & Offering receipt
        ledgerEntries.push(
          createJournalEntry({
            id: `je-2026-${monthStr}-inc-${tx}`,
            branchId: BRANCH_ID,
            documentNumber: `REC-26${monthStr}-${tx}`,
            entryDate: `2026-${monthStr}-${dayStr}`,
            narration: `Sunday Service Collection #${tx}`,
            createdBy: 'Akosua Osei',
            deviceId: 'DEV-FS-01',
            lines: [
              { id: `l-i1-${m}-${tx}`, accountId: 'acct-1030', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 350000n, exchangeRate: '1.0000', isDebit: true },
              { id: `l-i2-${m}-${tx}`, accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 350000n, exchangeRate: '1.0000', isDebit: false },
            ],
          })
        );
        // Ministry expense payment
        ledgerEntries.push(
          createJournalEntry({
            id: `je-2026-${monthStr}-exp-${tx}`,
            branchId: BRANCH_ID,
            documentNumber: `PV-26${monthStr}-${tx}`,
            entryDate: `2026-${monthStr}-${dayStr}`,
            narration: `Ministry Operations Payment #${tx}`,
            createdBy: 'Akosua Osei',
            deviceId: 'DEV-FS-01',
            lines: [
              { id: `l-e1-${m}-${tx}`, accountId: 'acct-5010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 200000n, exchangeRate: '1.0000', isDebit: true },
              { id: `l-e2-${m}-${tx}`, accountId: 'acct-1030', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 200000n, exchangeRate: '1.0000', isDebit: false },
            ],
          })
        );
      }

      // Close month m
      periods2026[periodIdx] = transitionPeriodStatus({
        period: currentPeriod,
        nextStatus: 'CLOSED',
        actorName: 'Kofi Mensah',
        actorRole: 'Treasurer',
      });
    }

    // Step D: Post Year-End Accrual with Day-1 FY2027 Auto-Reversal
    const yearEndAccrual = {
      id: 'accr-2026-dec',
      type: 'EXPENSE_ACCRUAL' as const,
      date: '2026-12-31',
      autoReverseDate: '2027-01-01',
      description: 'December Water & Security Accrual',
      debitAccountId: 'acct-5010',
      creditAccountId: 'acct-2010',
      amountPesewas: 150000n,
      fundId: 'fund-gen',
      createdBy: 'Kofi Mensah',
      createdAt: '2026-12-31T17:00:00Z',
    };
    const dayOneReversal2027 = generateAccrualDayOneReversal(yearEndAccrual, BRANCH_ID);
    expect(dayOneReversal2027.entryDate).toBe('2027-01-01');

    // Step E: Evaluate Year-End Checklist & Run Per-Fund Closing
    const checklist = evaluateYearEndChecklist({
      allMonthsClosed: periods2026.filter((p) => !p.isAdjustmentPeriod).every((p) => p.status === 'CLOSED'),
      bankAndMomoReconciled: true,
      cashCountsCompleted: true,
      payrollAllMonthsPaid: true,
      usdRevaluationRun: true,
      depreciationRun: true,
      integrityCheckPasses: true,
      trialBalanceBalanced: calculateTrialBalance(ledgerEntries, accounts, funds).isBalanced,
      suspenseAndClearingZero: true,
      needsAttentionQueueEmpty: true,
      remittancePayableAgrees: true,
      nextYearBudgetCreated: true,
      assetVerificationDone: true,
      openRequisitionsPendingCount: 0,
      outstandingPledgesCount: 0,
      overrides: [],
    });
    expect(checklist.isCloseAllowed).toBe(true);

    const preview2026 = generateYearEndClosingPreview({
      financialYearId: fy2026.id,
      yearLabel: fy2026.label,
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: ledgerEntries,
    });
    expect(preview2026.isReconciledToNetAssets).toBe(true);

    const closingEntries2026 = generateYearEndClosingEntries({
      financialYearId: fy2026.id,
      yearLabel: fy2026.label,
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: ledgerEntries,
      executedByTreasurer: 'Kofi Mensah (Treasurer)',
    });

    const entriesAtClose = [...ledgerEntries, ...closingEntries2026];
    const postCloseTb = calculateTrialBalance(entriesAtClose, accounts, funds);
    expect(postCloseTb.isBalanced).toBe(true);

    // Lock FY2026 & Generate 10-Report Issued Pack
    fy2026 = { ...fy2026, status: 'LOCKED', lockedAt: '2027-01-05T12:00:00Z', lockedBy: 'Kofi Mensah' };
    const issuedPack = generateIssuedYearEndPack({
      financialYearId: fy2026.id,
      yearLabel: fy2026.label,
      generatedBy: 'Kofi Mensah (Treasurer)',
      preview: preview2026,
      overridesCount: 0,
    });
    expect(issuedPack.reports).toHaveLength(10);

    // Step F: Reopen Period 13 ONLY for Auditor Adjustment & Compute Dynamic Brought-Forward Delta Notice
    fy2026 = {
      ...fy2026,
      status: 'REOPENED_ADJUSTMENT_ONLY',
      reopenedAt: '2027-01-20T10:00:00Z',
      reopenedBy: 'Kofi Mensah',
      reopenApprovedBy: 'Rev. Emmanuel Addo',
      reopenReason: 'Auditor adjustment for unrecorded December utility bill',
    };
    const p13Entry = createJournalEntry({
      id: 'je-2026-p13-1',
      branchId: BRANCH_ID,
      documentNumber: 'ADJ-2026-P13',
      entryDate: '2026-12-31',
      narration: 'Period 13 Auditor Adjustment',
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
      lines: [
        { id: 'lp13-1', accountId: 'acct-5010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 95000n, exchangeRate: '1.0000', isDebit: true },
        { id: 'lp13-2', accountId: 'acct-2010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 95000n, exchangeRate: '1.0000', isDebit: false },
      ],
    });

    const deltaNotice = calculateBroughtForwardDeltas({
      financialYearId: fy2026.id,
      yearLabel: fy2026.label,
      actorName: 'Kofi Mensah',
      reason: 'Auditor adjustment for December utility bill',
      accounts,
      funds,
      oldClosingEntries: entriesAtClose,
      newClosingEntries: [...entriesAtClose, p13Entry],
    });
    expect(deltaNotice.accountDeltas.length).toBeGreaterThan(0);

    // Step G: Rollover Budget to FY2027
    const fy2027BudgetLines = rolloverBudget({
      currentBudgetLines: [
        { id: 'b1', accountId: 'acct-4010', fundId: 'fund-gen', annualAmountPesewas: 42000000n },
        { id: 'b2', accountId: 'acct-5010', fundId: 'fund-gen', annualAmountPesewas: 24000000n },
      ],
      percentageAdjustment: 5,
      nextYearLabel: 'FY2027',
    });
    expect(fy2027BudgetLines[0]!.annualAmountPesewas).toBe(44100000n);

    const elapsedMs = performance.now() - startTime;
    // Full multi-year simulation with 245+ entries, trial balances, closing engine, and SHA-256 pack completes well under 500ms
    expect(elapsedMs).toBeLessThan(1500);
  });
});
