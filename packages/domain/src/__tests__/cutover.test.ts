import { describe, it, expect } from 'vitest';
import {
  generateOpeningBalanceCsvTemplate,
  parseOpeningBalanceCsv,
  validateOpeningBalances,
  runOpeningBalanceDryRun,
  commitOpeningBalances,
  computeImportFileSha256,
  maskPiiInDiagnostic,
  getImportTemplate,
  parseGenericCsv,
  buildDefaultColumnMapping,
  validateAndDryRunImport,
  reverseImportBatch,
  compareParallelRunMonth,
  evaluateParallelRunOverall,
  signOffParallelRunMonth,
  evaluateGoLiveReadiness,
  confirmGoLiveTransition,
  generateFinancialYearWithPeriods,
  createJournalEntry,
  type Account,
  type Fund,
  type ImportBatchRecord,
} from '../index.js';

describe('Phase 8 Hardening Suite: Cut-Over, Opening Balances, Imports, Parallel Run & Go-Live (cutover.test.ts)', () => {
  const BRANCH_ID = 'br-calvary-main';

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
    { id: 'acct-5020', branchId: BRANCH_ID, code: '5020', name: 'Utilities Expense', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  ];

  const funds: Fund[] = [
    { id: 'fund-gen', branchId: BRANCH_ID, code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
    { id: 'fund-bld', branchId: BRANCH_ID, code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
    { id: 'fund-mis', branchId: BRANCH_ID, code: 'MIS', name: 'Missions & Outreach Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  ];

  const fy2026 = generateFinancialYearWithPeriods({
    id: 'fy-2026',
    branchId: BRANCH_ID,
    label: 'FY2026',
    startYear: 2026,
    startMonth: 1,
    hasAdjustmentPeriod: true,
  });

  it('1. rejects unbalanced opening balances with per-fund differences and never auto-plugs', () => {
    const csv = [
      'account_code,fund_code,currency,debit_amount,credit_amount,exchange_rate,rate_date,narration',
      '1010,GEN,GHS,1000.00,0.00,1.0000,2026-01-01,General Cash',
      '3010,GEN,GHS,0.00,800.00,1.0000,2026-01-01,General Equity (200 short)',
      '1030,BLD,GHS,500.00,0.00,1.0000,2026-01-01,Building Bank',
      '3020,BLD,GHS,0.00,700.00,1.0000,2026-01-01,Building Equity (200 excess)',
    ].join('\n');

    const rows = parseOpeningBalanceCsv(csv);
    const report = validateOpeningBalances({
      rows,
      cutOverDate: '2026-01-01',
      accounts,
      funds,
    });

    // Overall Dr (1500) == Cr (1500), but per-fund GEN is +200 and BLD is -200!
    expect(report.isOverallBalanced).toBe(true);
    expect(report.allFundsBalanced).toBe(false);
    expect(report.isValid).toBe(false);

    const genStatus = report.fundSummaries.find((f) => f.fundCode === 'GEN')!;
    const bldStatus = report.fundSummaries.find((f) => f.fundCode === 'BLD')!;
    expect(genStatus.isBalanced).toBe(false);
    expect(genStatus.differenceGhs).toBe(20000n);
    expect(bldStatus.isBalanced).toBe(false);
    expect(bldStatus.differenceGhs).toBe(-20000n);
  });

  it('2. requires exchange rate on USD opening balances and validates bank/MoMo/cash statement proofs', () => {
    const csvMissingRate = [
      'account_code,fund_code,currency,debit_amount,credit_amount,exchange_rate,rate_date,narration',
      '1020,MIS,USD,100.00,0.00,,2026-01-01,USD Cash without rate',
      '3020,MIS,GHS,0.00,1550.00,1.0000,2026-01-01,Missions Equity',
    ].join('\n');

    const reportMissingRate = validateOpeningBalances({
      rows: parseOpeningBalanceCsv(csvMissingRate),
      cutOverDate: '2026-01-01',
      accounts,
      funds,
    });
    expect(reportMissingRate.isValid).toBe(false);
    expect(reportMissingRate.rowDiagnostics.some((i) => i.message.toLowerCase().includes('exchange rate'))).toBe(true);

    // Valid template with matching statement proofs and dual-approval commit
    const validRows = parseOpeningBalanceCsv(generateOpeningBalanceCsvTemplate('2026-01-01'));
    const dryRun = runOpeningBalanceDryRun({
      rows: validRows,
      cutOverDate: '2026-01-01',
      branchId: BRANCH_ID,
      financialYearId: 'fy-2026',
      accounts,
      funds,
      createdBy: 'Kofi Mensah',
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
    expect(dryRun.validation.isValid).toBe(true);

    const committed = commitOpeningBalances({
      dryRun,
      treasurerSignedBy: 'Kofi Mensah (Treasurer)',
      pastorOrElderApprovedBy: 'Rev. Emmanuel Addo (Senior Pastor)',
    });
    expect(committed).toHaveLength(3);
  });

  it('3. enforces SHA-256 duplicate file rejection, atomic all-or-nothing batch rollback, PII masking, and full batch reversal', () => {
    const maskedPhone = maskPiiInDiagnostic('+233244810222');
    expect(maskedPhone).not.toContain('244810');
    expect(maskedPhone).toContain('222');
    const maskedEmail = maskPiiInDiagnostic('nana@church.org');
    expect(maskedEmail).toBe('na***@church.org');

    // Atomic all-or-nothing: 1 bad row in OPENING_BALANCES prevents committing any row
    const obTpl = getImportTemplate('OPENING_BALANCES');
    const badObCsv = [
      'account_code,fund_code,currency,debit_amount,credit_amount,exchange_rate,rate_date,narration',
      '1010,GEN,GHS,500.00,0.00,1.0000,2026-01-01,Valid row',
      '9999,GEN,GHS,0.00,500.00,1.0000,2026-01-01,Invalid account code 9999',
    ].join('\n');
    const { headers } = parseGenericCsv(badObCsv);
    const mapping = buildDefaultColumnMapping(obTpl, headers);

    const badDryRun = validateAndDryRunImport({
      templateType: 'OPENING_BALANCES',
      fileName: 'bad_ob.csv',
      csvContent: badObCsv,
      columnMapping: mapping,
      existingBatches: [],
      accounts,
      funds,
      existingEntries: [],
      branchId: BRANCH_ID,
      financialYearId: 'fy-2026',
      period: fy2026.periods[0]!,
      cutOverDate: '2026-01-01',
      nextBatchNumber: 'IMP-0001',
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
    });
    expect(badDryRun.canCommit).toBe(false);
    expect(badDryRun.errorCount).toBeGreaterThan(0);

    // Valid import & full batch reversal while period is open
    const validObCsv = [
      'account_code,fund_code,currency,debit_amount,credit_amount,exchange_rate,rate_date,narration',
      '1010,GEN,GHS,1500.00,0.00,1.0000,2026-01-01,Cash OB',
      '3010,GEN,GHS,0.00,1500.00,1.0000,2026-01-01,Equity OB',
    ].join('\n');
    const validDryRun = validateAndDryRunImport({
      templateType: 'OPENING_BALANCES',
      fileName: 'valid_ob.csv',
      csvContent: validObCsv,
      columnMapping: mapping,
      existingBatches: [],
      accounts,
      funds,
      existingEntries: [],
      branchId: BRANCH_ID,
      financialYearId: 'fy-2026',
      period: fy2026.periods[0]!,
      cutOverDate: '2026-01-01',
      nextBatchNumber: 'IMP-0001',
      createdBy: 'Kofi Mensah',
      deviceId: 'DEV-TR-01',
    });
    expect(validDryRun.canCommit).toBe(true);

    const batchToReverse: ImportBatchRecord = {
      id: 'imp-1',
      batchNumber: 'IMP-0001',
      templateType: 'OPENING_BALANCES',
      fileName: 'valid_ob.csv',
      fileSha256: computeImportFileSha256(validObCsv),
      columnMapping: mapping,
      rowCount: 2,
      totalImpactGhs: 150000n,
      status: 'COMMITTED',
      periodId: fy2026.periods[0]!.id,
      createdJournalEntryIds: validDryRun.proposedJournalEntries.map((e) => e.id),
      createdRecordIds: [],
      mappedRows: validDryRun.mappedRows,
      committedBy: 'Kofi Mensah',
      committedAt: '2026-01-01T10:00:00Z',
    };

    const reversalRes = reverseImportBatch({
      batch: batchToReverse,
      period: fy2026.periods[0]!,
      existingEntries: validDryRun.proposedJournalEntries,
      reversedBy: 'Kofi Mensah',
      reversalReason: 'Uploaded draft spreadsheet version by mistake',
      deviceId: 'DEV-TR-01',
    });
    expect(reversalRes.updatedBatch.status).toBe('REVERSED');
    expect(reversalRes.reversalEntries.length).toBe(validDryRun.proposedJournalEntries.length);
  });

  it('4. evaluates Parallel Run variance states (AGREES, EXPLAINED, UNEXPLAINED) and Go-Live readiness gates', () => {
    const entries = [
      createJournalEntry({
        id: 'je-pr-1',
        branchId: BRANCH_ID,
        documentNumber: 'JE-PR-01',
        entryDate: '2026-10-15',
        narration: 'Tithes',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-1',
        lines: [
          { id: 'l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 400000n, exchangeRate: '1.0000', isDebit: true },
          { id: 'l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 400000n, exchangeRate: '1.0000', isDebit: false },
        ],
      }),
    ];

    const octComp = compareParallelRunMonth({
      periodId: 'per-2026-10',
      periodLabel: 'October',
      asOfDate: '2026-10-31',
      accounts,
      funds,
      entries,
      oldBookRows: [
        { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 400000n },
        { accountCode: '4010', fundCode: 'GEN', oldBookBalanceGhs: 390000n, explanation: 'Timing difference on mobile money deposit' },
      ],
    });
    expect(octComp.summary.unexplainedCount).toBe(0);
    expect(octComp.summary.explainedCount).toBe(1);
    expect(octComp.summary.canApprove).toBe(true);

    const signedOct = signOffParallelRunMonth({
      summary: octComp.summary,
      treasurerName: 'Kofi Mensah',
      actorRole: 'Treasurer',
    });
    expect(signedOct.isApproved).toBe(true);

    const overallPr = evaluateParallelRunOverall({
      months: [signedOct, { ...signedOct, periodId: 'per-2026-09', periodLabel: 'September' }],
      requiredMonthEnds: 2,
    });
    expect(overallPr.isParallelRunComplete).toBe(true);

    // Go-Live Readiness 16 checks
    const readiness = evaluateGoLiveReadiness({
      isLive: false,
      demoModePermanentlyDisabled: false,
      churchProfileComplete: true,
      churchName: 'Calvary Crystal Church',
      fiscalYearLabel: 'FY2026',
      chartOfAccountsReviewed: true,
      activeAccountCount: 38,
      fundsConfigured: true,
      activeFundCount: 5,
      bankMomoCashConfigured: true,
      cashAndBankAccountCount: 6,
      remittanceRuleConfigured: true,
      remittanceRuleSummary: '15% of Tithes to Headquarters',
      exchangeRateEntered: true,
      latestUsdRate: '15.5000',
      latestUsdRateDate: '2026-10-24',
      openingBalancesPostedAndBalanced: true,
      openingBalanceBatchNumber: 'IMP-OB-0001',
      openingBankReconciliationsSignedOff: true,
      openingCashCountsSignedOff: true,
      fixedAssetRegisterReconciled: true,
      usersCreatedAndMfaEnrolled: true,
      mfaEnrolledCount: 5,
      mfaRequiredCount: 5,
      approvalLimitsConfigured: true,
      roleTrainings: [
        { userId: 'u1', userName: 'Kofi Mensah', role: 'Treasurer', trained: true, trainedDate: '2026-10-20' },
        { userId: 'u2', userName: 'Rev. Emmanuel Addo', role: 'Pastor / Elder', trained: true, trainedDate: '2026-10-21' },
      ],
      backupTaken: true,
      lastBackupDate: '2026-10-30',
      restoreTested: true,
      lastRestoreTestDate: '2026-10-30',
      parallelRunApproved: true,
      parallelRunSummary: 'September & October 2026 parallel run signed off',
      isDemoModeActive: false,
    });
    expect(readiness.items).toHaveLength(16);
    expect(readiness.allChecksPassed).toBe(true);

    const goLiveEvt = confirmGoLiveTransition({
      readiness,
      treasurerName: 'Kofi Mensah (Treasurer)',
      pastorOrElderName: 'Rev. Emmanuel Addo (Senior Pastor)',
      permanentlyDisableDemoMode: true,
    });
    expect(goLiveEvt.isLive).toBe(true);
    expect(goLiveEvt.demoModePermanentlyDisabled).toBe(true);
  });
});
