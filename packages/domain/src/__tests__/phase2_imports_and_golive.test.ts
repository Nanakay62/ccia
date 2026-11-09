import { describe, it, expect } from 'vitest';
import {
  computeImportFileSha256,
  maskPiiInDiagnostic,
  getImportTemplate,
  parseGenericCsv,
  buildDefaultColumnMapping,
  validateAndDryRunImport,
  reverseImportBatch,
  evaluateGoLiveReadiness,
  confirmGoLiveTransition,
  generateFinancialYearWithPeriods,
  type Account,
  type Fund,
  type ImportBatchRecord,
} from '../index.js';

const TEST_ACCOUNTS: Account[] = [
  { id: 'acct-1010', branchId: 'b1', code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: 'b1', code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-2010', branchId: 'b1', code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3010', branchId: 'b1', code: '3010', name: 'General Fund Equity', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3020', branchId: 'b1', code: '3020', name: 'Restricted Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4020', branchId: 'b1', code: '4020', name: 'General Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5020', branchId: 'b1', code: '5020', name: 'Utilities', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
];

const TEST_FUNDS: Fund[] = [
  { id: 'fund-gen', branchId: 'b1', code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
  { id: 'fund-bld', branchId: 'b1', code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-mis', branchId: 'b1', code: 'MIS', name: 'Missions Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
];

const FY2026 = generateFinancialYearWithPeriods({
  id: 'fy-2026',
  branchId: 'b1',
  label: 'FY2026',
  startYear: 2026,
  startMonth: 1,
  hasAdjustmentPeriod: true,
});

describe('Phase 2: Import Tool & Go-Live Readiness', () => {
  describe('B3: Import Tool (Fingerprinting, PII Masking, Atomic All-or-Nothing & Batch Reversal)', () => {
    it('computes deterministic SHA-256 fingerprint and refuses uploading the same file twice', () => {
      const template = getImportTemplate('MEMBERS');
      const { headers } = parseGenericCsv(template.sampleCsv);
      const mapping = buildDefaultColumnMapping(template, headers);
      const sha = computeImportFileSha256(template.sampleCsv);
      expect(sha).toHaveLength(64);

      const committedBatch: ImportBatchRecord = {
        id: 'batch-1',
        batchNumber: 'IMP-0001',
        templateType: 'MEMBERS',
        fileName: 'members.csv',
        fileSha256: sha,
        columnMapping: mapping,
        rowCount: 4,
        totalImpactGhs: 0n,
        status: 'COMMITTED',
        periodId: 'per-2026-01',
        createdJournalEntryIds: [],
        createdRecordIds: ['m1', 'm2', 'm3', 'm4'],
        mappedRows: [],
        committedBy: 'Kofi Mensah',
        committedAt: '2026-01-01T10:00:00Z',
      };

      const secondUpload = validateAndDryRunImport({
        templateType: 'MEMBERS',
        fileName: 'members_copy.csv',
        csvContent: template.sampleCsv,
        columnMapping: mapping,
        existingBatches: [committedBatch],
        accounts: TEST_ACCOUNTS,
        funds: TEST_FUNDS,
        existingEntries: [],
        branchId: 'b1',
        financialYearId: 'fy-2026',
        period: FY2026.periods[0]!,
        cutOverDate: '2026-01-01',
        nextBatchNumber: 'IMP-0002',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-TR-01',
      });

      expect(secondUpload.isDuplicateFile).toBe(true);
      expect(secondUpload.duplicateOfBatchNumber).toBe('IMP-0001');
      expect(secondUpload.canCommit).toBe(false);
      expect(secondUpload.diagnostics.some((d) => d.message.includes('IMP-0001'))).toBe(true);
    });

    it('detects duplicate members by name and phone and masks PII in diagnostic messages', () => {
      const template = getImportTemplate('MEMBERS');
      const csvWithDuplicate = [
        'member_number,envelope_number,full_name,phone,email,household_name',
        'MEM-2026-101,ENV-101,Nana Yaw Asante,+233244810111,nana@church.org,Asante Household',
        'MEM-2026-102,ENV-102,Nana Yaw Asante,+233244810111,nana2@church.org,Asante Household',
      ].join('\n');

      const { headers } = parseGenericCsv(csvWithDuplicate);
      const mapping = buildDefaultColumnMapping(template, headers);

      const res = validateAndDryRunImport({
        templateType: 'MEMBERS',
        fileName: 'members_dup.csv',
        csvContent: csvWithDuplicate,
        columnMapping: mapping,
        existingBatches: [],
        accounts: TEST_ACCOUNTS,
        funds: TEST_FUNDS,
        existingEntries: [],
        branchId: 'b1',
        financialYearId: 'fy-2026',
        period: FY2026.periods[0]!,
        cutOverDate: '2026-01-01',
        nextBatchNumber: 'IMP-0001',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-TR-01',
      });

      expect(res.canCommit).toBe(false);
      expect(res.errorCount).toBe(1);
      const errMsg = res.diagnostics[0]!.message;
      // Full phone number +233244810111 must be masked!
      expect(errMsg).not.toContain('244810111');
      expect(errMsg).toContain('+233 ** *** *111');
      expect(maskPiiInDiagnostic('kofi.mensah@gmail.com')).toBe('ko***@gmail.com');
    });

    it('enforces all-or-nothing atomic rollback when one row in a batch has an error', () => {
      const template = getImportTemplate('HISTORICAL_TRANSACTIONS');
      const csvWithOneBadRow = [
        'entry_date,document_number,debit_account_code,credit_account_code,fund_code,amount_ghs,narration',
        '2026-01-04,HIST-001,1010,4020,GEN,1250.00,Valid first Sunday offering',
        '2026-01-11,HIST-002,9999,1010,GEN,350.00,Invalid account 9999 on row 2',
      ].join('\n');

      const { headers } = parseGenericCsv(csvWithOneBadRow);
      const mapping = buildDefaultColumnMapping(template, headers);

      const res = validateAndDryRunImport({
        templateType: 'HISTORICAL_TRANSACTIONS',
        fileName: 'hist_bad.csv',
        csvContent: csvWithOneBadRow,
        columnMapping: mapping,
        existingBatches: [],
        accounts: TEST_ACCOUNTS,
        funds: TEST_FUNDS,
        existingEntries: [],
        branchId: 'b1',
        financialYearId: 'fy-2026',
        period: FY2026.periods[0]!,
        cutOverDate: '2026-01-01',
        nextBatchNumber: 'IMP-0003',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-TR-01',
      });

      expect(res.canCommit).toBe(false);
      // All-or-nothing: zero entries proposed when any row fails
      expect(res.proposedJournalEntries).toHaveLength(0);
    });

    it('supports Prior Giving History as non-posting memo records without general ledger impact', () => {
      const template = getImportTemplate('PRIOR_GIVING_HISTORY');
      const { headers } = parseGenericCsv(template.sampleCsv);
      const mapping = buildDefaultColumnMapping(template, headers);

      const res = validateAndDryRunImport({
        templateType: 'PRIOR_GIVING_HISTORY',
        fileName: 'prior_giving_2025.csv',
        csvContent: template.sampleCsv,
        columnMapping: mapping,
        existingBatches: [],
        accounts: TEST_ACCOUNTS,
        funds: TEST_FUNDS,
        existingEntries: [],
        branchId: 'b1',
        financialYearId: 'fy-2026',
        period: FY2026.periods[0]!,
        cutOverDate: '2026-01-01',
        nextBatchNumber: 'IMP-0004',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-TR-01',
      });

      expect(res.canCommit).toBe(true);
      expect(res.proposedJournalEntries).toHaveLength(0);
      expect(res.resultingTrialBalance.totalDebitsGhs).toBe(0n);
      expect(res.recordSummaries[0]!.count).toBe(3);
      expect(res.recordSummaries[0]!.totalAmountGhs).toBe(175000n); // GHS 1,750.00
    });

    it('reverses an entire committed import batch while period is open and blocks reversal when period is closed', () => {
      const template = getImportTemplate('OPENING_BALANCES');
      const { headers } = parseGenericCsv(template.sampleCsv);
      const mapping = buildDefaultColumnMapping(template, headers);

      const dryRun = validateAndDryRunImport({
        templateType: 'OPENING_BALANCES',
        fileName: 'ob.csv',
        csvContent: template.sampleCsv,
        columnMapping: mapping,
        existingBatches: [],
        accounts: TEST_ACCOUNTS,
        funds: TEST_FUNDS,
        existingEntries: [],
        branchId: 'b1',
        financialYearId: 'fy-2026',
        period: FY2026.periods[0]!,
        cutOverDate: '2026-01-01',
        nextBatchNumber: 'IMP-0005',
        createdBy: 'Kofi Mensah',
        deviceId: 'DEV-TR-01',
      });

      expect(dryRun.canCommit).toBe(true);
      expect(dryRun.proposedJournalEntries).toHaveLength(2); // GEN and BLD

      const batchRecord: ImportBatchRecord = {
        id: 'b-5',
        batchNumber: 'IMP-0005',
        templateType: 'OPENING_BALANCES',
        fileName: 'ob.csv',
        fileSha256: dryRun.fileSha256,
        columnMapping: mapping,
        rowCount: dryRun.totalRows,
        totalImpactGhs: 7500000n,
        status: 'COMMITTED',
        periodId: FY2026.periods[0]!.id,
        createdJournalEntryIds: dryRun.proposedJournalEntries.map((e) => e.id),
        createdRecordIds: [],
        mappedRows: dryRun.mappedRows,
        committedBy: 'Kofi Mensah',
        committedAt: '2026-01-01T12:00:00Z',
      };

      const revResult = reverseImportBatch({
        batch: batchRecord,
        period: FY2026.periods[0]!,
        existingEntries: dryRun.proposedJournalEntries,
        reversedBy: 'Kofi Mensah',
        reversalReason: 'Uploaded preliminary draft instead of audited cut-over sheet',
        deviceId: 'DEV-TR-01',
      });

      expect(revResult.updatedBatch.status).toBe('REVERSED');
      expect(revResult.reversalEntries).toHaveLength(2);

      // Closed period must block batch reversal
      const closedPeriod = { ...FY2026.periods[0]!, status: 'CLOSED' as const, isClosed: true };
      expect(() =>
        reverseImportBatch({
          batch: batchRecord,
          period: closedPeriod,
          existingEntries: dryRun.proposedJournalEntries,
          reversedBy: 'Kofi Mensah',
          reversalReason: 'Attempt after close',
          deviceId: 'DEV-TR-01',
        })
      ).toThrow(/closed/i);
    });
  });

  describe('B5: Go-Live Readiness Checklist & Dual Confirmation', () => {
    const baseInput = {
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
        { userId: 'u1', userName: 'Kofi Mensah', role: 'Treasurer', trained: true, trainedDate: '2026-10-28' },
        { userId: 'u2', userName: 'Akosua Osei', role: 'Finance Secretary', trained: true, trainedDate: '2026-10-28' },
      ],
      backupTaken: true,
      lastBackupDate: '2026-10-30',
      restoreTested: true,
      lastRestoreTestDate: '2026-10-30',
      parallelRunApproved: true,
      parallelRunSummary: 'September & October 2026 parallel run signed off',
      isDemoModeActive: false,
    };

    it('blocks Go-Live when backup is taken but restore has not been tested', () => {
      const report = evaluateGoLiveReadiness({
        ...baseInput,
        restoreTested: false,
      });

      expect(report.allChecksPassed).toBe(false);
      const backupCheck = report.items.find((i) => i.key === 'BACKUP_TAKEN_AND_RESTORE_TESTED');
      expect(backupCheck?.passed).toBe(false);

      expect(() =>
        confirmGoLiveTransition({
          readiness: report,
          treasurerName: 'Kofi Mensah',
          pastorOrElderName: 'Rev. Emmanuel Addo',
          permanentlyDisableDemoMode: true,
        })
      ).toThrow(/Cannot Go Live until all 16 readiness checks pass/i);
    });

    it('confirms Go-Live when all 16 checks pass and two distinct officers sign off', () => {
      const report = evaluateGoLiveReadiness(baseInput);
      expect(report.allChecksPassed).toBe(true);
      expect(report.passedCount).toBe(16);

      const confirmed = confirmGoLiveTransition({
        readiness: report,
        treasurerName: 'Kofi Mensah (Treasurer)',
        pastorOrElderName: 'Rev. Emmanuel Addo (Senior Pastor)',
        permanentlyDisableDemoMode: true,
      });

      expect(confirmed.isLive).toBe(true);
      expect(confirmed.demoModePermanentlyDisabled).toBe(true);
    });
  });
});
