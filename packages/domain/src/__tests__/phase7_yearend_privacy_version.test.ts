import { describe, it, expect } from 'vitest';
import type { Account, Fund, JournalEntry } from '../ledger/types.js';
import {
  evaluateYearEndChecklist,
  generateYearEndClosingPreview,
  generateYearEndClosingEntries,
  generateIssuedYearEndPack,
  generateAccrualDayOneReversal,
  calculateBroughtForwardDeltas,
  rolloverBudget,
  generateMemberDataDossier,
  anonymiseFormerMember,
  evaluateVersionGate,
  compareVersions,
} from '../index.js';
import { calculateTrialBalance } from '../ledger/rules.js';

describe('Phase 7: Year-End Close, Member Privacy & Version Gate', () => {
  const sampleFunds: Fund[] = [
    { id: 'f-gen', branchId: 'br-1', code: '01', name: 'General Fund', type: 'Unrestricted', allowOverdraft: false, isActive: true },
    { id: 'f-bld', branchId: 'br-1', code: '02', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  ];

  const sampleAccounts: Account[] = [
    // Assets & Liabilities
    { id: 'acc-1000', branchId: 'br-1', code: '1000', name: 'Cash and Bank', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
    { id: 'acc-2000', branchId: 'br-1', code: '2000', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
    // Equities
    { id: 'acc-3000', branchId: 'br-1', code: '3000', name: 'General Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
    { id: 'acc-3001', branchId: 'br-1', code: '3001', name: 'Building Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
    // Incomes
    { id: 'acc-4000', branchId: 'br-1', code: '4000', name: 'Tithes & Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
    { id: 'acc-4001', branchId: 'br-1', code: '4001', name: 'Building Donations', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
    // Expenses
    { id: 'acc-5000', branchId: 'br-1', code: '5000', name: 'Ministry Operations', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
    { id: 'acc-5001', branchId: 'br-1', code: '5001', name: 'Building Repairs', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  ];

  const sampleEntries: JournalEntry[] = [
    // General Fund: 10,000 Income, 4,000 Expense -> Net Surplus: 6,000
    {
      id: 'e-1',
      branchId: 'br-1',
      documentNumber: 'JE-001',
      entryDate: '2026-03-15',
      narration: 'Sunday tithes',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 1000000n,
      totalCreditGhs: 1000000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-03-15T12:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l1',
          journalEntryId: 'e-1',
          accountId: 'acc-1000',
          fundId: 'f-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 1000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 1000000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l2',
          journalEntryId: 'e-1',
          accountId: 'acc-4000',
          fundId: 'f-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 1000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 1000000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'e-2',
      branchId: 'br-1',
      documentNumber: 'JE-002',
      entryDate: '2026-06-20',
      narration: 'Stationery & electricity',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 400000n,
      totalCreditGhs: 400000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-06-20T12:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l3',
          journalEntryId: 'e-2',
          accountId: 'acc-5000',
          fundId: 'f-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 400000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 400000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l4',
          journalEntryId: 'e-2',
          accountId: 'acc-1000',
          fundId: 'f-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 400000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 400000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    // Building Fund: 5,000 Income, 2,000 Expense -> Net Surplus: 3,000
    {
      id: 'e-3',
      branchId: 'br-1',
      documentNumber: 'JE-003',
      entryDate: '2026-08-10',
      narration: 'Special building donation',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 500000n,
      totalCreditGhs: 500000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-08-10T12:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l5',
          journalEntryId: 'e-3',
          accountId: 'acc-1000',
          fundId: 'f-bld',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 500000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l6',
          journalEntryId: 'e-3',
          accountId: 'acc-4001',
          fundId: 'f-bld',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 500000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'e-4',
      branchId: 'br-1',
      documentNumber: 'JE-004',
      entryDate: '2026-09-05',
      narration: 'Roof maintenance',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 200000n,
      totalCreditGhs: 200000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-09-05T12:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l7',
          journalEntryId: 'e-4',
          accountId: 'acc-5001',
          fundId: 'f-bld',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 200000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 200000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l8',
          journalEntryId: 'e-4',
          accountId: 'acc-1000',
          fundId: 'f-bld',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 200000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 200000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
  ];

  describe('1. Year-End Checklist Evaluator (Spec Section A2)', () => {
    it('allows year-end close when all 11 blocking checks pass', () => {
      const result = evaluateYearEndChecklist({
        allMonthsClosed: true,
        bankAndMomoReconciled: true,
        cashCountsCompleted: true,
        payrollAllMonthsPaid: true,
        usdRevaluationRun: true,
        depreciationRun: true,
        integrityCheckPasses: true,
        trialBalanceBalanced: true,
        suspenseAndClearingZero: true,
        needsAttentionQueueEmpty: true,
        remittancePayableAgrees: true,
      });

      expect(result.isCloseAllowed).toBe(true);
      expect(result.blockingFailedCount).toBe(0);
      expect(result.checks).toHaveLength(15);
    });

    it('blocks year-end close when any blocking check fails', () => {
      const result = evaluateYearEndChecklist({
        allMonthsClosed: true,
        bankAndMomoReconciled: false, // Fails
        cashCountsCompleted: true,
        payrollAllMonthsPaid: true,
        usdRevaluationRun: true,
        depreciationRun: true,
        integrityCheckPasses: true,
        trialBalanceBalanced: true,
        suspenseAndClearingZero: true,
        needsAttentionQueueEmpty: true,
        remittancePayableAgrees: true,
      });

      expect(result.isCloseAllowed).toBe(false);
      expect(result.blockingFailedCount).toBe(1);
      const bankCheck = result.checks.find((c) => c.key === 'BANK_MOMO_RECONCILED');
      expect(bankCheck?.status).toBe('FAIL');
    });

    it('permits close when a blocking check is overridden by the Treasurer with written justification', () => {
      const result = evaluateYearEndChecklist({
        allMonthsClosed: true,
        bankAndMomoReconciled: false, // Overridden
        cashCountsCompleted: true,
        payrollAllMonthsPaid: true,
        usdRevaluationRun: true,
        depreciationRun: true,
        integrityCheckPasses: true,
        trialBalanceBalanced: true,
        suspenseAndClearingZero: true,
        needsAttentionQueueEmpty: true,
        remittancePayableAgrees: true,
        overrides: [
          {
            checkKey: 'BANK_MOMO_RECONCILED',
            reason: 'Bank statement delayed due to branch holiday; reconciled against online portal export.',
            overriddenByTreasurerId: 'usr-kofi',
            overriddenByTreasurerName: 'Kofi Mensah',
            timestamp: '2026-12-31T20:00:00Z',
          },
        ],
      });

      expect(result.isCloseAllowed).toBe(true);
      expect(result.blockingFailedCount).toBe(0);
      expect(result.blockingOverriddenCount).toBe(1);
      const bankCheck = result.checks.find((c) => c.key === 'BANK_MOMO_RECONCILED');
      expect(bankCheck?.status).toBe('OVERRIDDEN');
      expect(bankCheck?.overrideReason).toContain('Bank statement delayed');
    });
  });

  describe('2. Fund Closing Preview & Closing Entries (Spec Section A3)', () => {
    it('previews fund surplus, carried forward, and reconciles with net assets', () => {
      const preview = generateYearEndClosingPreview({
        financialYearId: 'fy-2026',
        yearLabel: 'FY2026',
        branchId: 'br-1',
        effectiveClosingDate: '2026-12-31',
        accounts: sampleAccounts,
        funds: sampleFunds,
        entries: sampleEntries,
      });

      expect(preview.fundSummaries).toHaveLength(2);
      const genSummary = preview.fundSummaries.find((f) => f.fundId === 'f-gen');
      expect(genSummary?.totalIncomePesewas).toBe(1000000n);
      expect(genSummary?.totalExpensePesewas).toBe(400000n);
      expect(genSummary?.netSurplusPesewas).toBe(600000n); // GHS 6,000

      const bldSummary = preview.fundSummaries.find((f) => f.fundId === 'f-bld');
      expect(bldSummary?.totalIncomePesewas).toBe(500000n);
      expect(bldSummary?.totalExpensePesewas).toBe(200000n);
      expect(bldSummary?.netSurplusPesewas).toBe(300000n); // GHS 3,000

      expect(preview.totalNetSurplusPesewas).toBe(900000n);
      expect(preview.isReconciledToNetAssets).toBe(true);
      expect(preview.restrictedFundsWithDeficits).toHaveLength(0);
    });

    it('generates one balanced YEAR_END_CLOSING entry per fund and zeroes income/expenses', () => {
      const closingEntries = generateYearEndClosingEntries({
        financialYearId: 'fy-2026',
        yearLabel: 'FY2026',
        branchId: 'br-1',
        effectiveClosingDate: '2026-12-31',
        accounts: sampleAccounts,
        funds: sampleFunds,
        entries: sampleEntries,
        executedByTreasurer: 'Kofi Mensah',
      });

      expect(closingEntries).toHaveLength(2);
      // Verify every closing entry is balanced
      for (const entry of closingEntries) {
        expect(entry.entryType).toBe('YEAR_END_CLOSING');
        const dr = entry.lines.reduce((s, l) => s + l.debitAmountGhs, 0n);
        const cr = entry.lines.reduce((s, l) => s + l.creditAmountGhs, 0n);
        expect(dr).toBe(cr);
      }

      // Combine original entries and closing entries, then calculate trial balance
      const allEntries = [...sampleEntries, ...closingEntries];
      const tb = calculateTrialBalance(allEntries, sampleAccounts, sampleFunds);

      // Verify that every income and expense account now has zero balance!
      for (const accItem of tb.accounts) {
        const acc = sampleAccounts.find((a) => a.id === accItem.accountId);
        if (acc?.type === 'Income' || acc?.type === 'Expense') {
          const net = accItem.debitGhs - accItem.creditGhs;
          expect(net).toBe(0n);
        }
      }

      // Balance Sheet accounts must remain intact: Cash & Bank = 9,000 net debits
      const cashRow = tb.accounts.find((r) => r.accountId === 'acc-1000');
      expect((cashRow?.debitGhs ?? 0n) - (cashRow?.creditGhs ?? 0n)).toBe(900000n);
    });
  });

  describe('3. Issued Year-End Pack & Reports (Spec Section A3)', () => {
    it('generates 10 immutable reports with cryptographic SHA-256 digests', () => {
      const preview = generateYearEndClosingPreview({
        financialYearId: 'fy-2026',
        yearLabel: 'FY2026',
        branchId: 'br-1',
        effectiveClosingDate: '2026-12-31',
        accounts: sampleAccounts,
        funds: sampleFunds,
        entries: sampleEntries,
      });

      const pack = generateIssuedYearEndPack({
        financialYearId: 'fy-2026',
        yearLabel: 'FY2026',
        generatedBy: 'Kofi Mensah',
        preview,
        overridesCount: 0,
      });

      expect(pack.reports).toHaveLength(10);
      for (const rep of pack.reports) {
        expect(rep.sha256Hash).toHaveLength(64);
        expect(rep.summaryFigures).toBeDefined();
      }
      expect(pack.packSha256Checksum).toHaveLength(64);
    });
  });

  describe('4. Accrual Automatic Day-1 Reversal (Spec Section A2 & D3)', () => {
    it('creates automatic Day-1 new-year reversal entry with inverted debits and credits', () => {
      const reversal = generateAccrualDayOneReversal(
        {
          id: 'accrual-001',
          type: 'EXPENSE_ACCRUAL',
          date: '2026-12-31',
          autoReverseDate: '2027-01-01',
          description: 'Accrued December 2026 electricity bill',
          debitAccountId: 'acc-5000',
          creditAccountId: 'acc-2000',
          amountPesewas: 75000n,
          fundId: 'f-gen',
          createdBy: 'Kofi Mensah',
          createdAt: '2026-12-31T18:00:00Z',
        },
        'br-1'
      );

      expect(reversal.entryDate).toBe('2027-01-01');
      expect(reversal.entryType).toBe('ACCRUAL_PREPAYMENT');
      expect(reversal.lines[0]?.accountId).toBe('acc-2000');
      expect(reversal.lines[0]?.debitAmountGhs).toBe(75000n);
      expect(reversal.lines[1]?.accountId).toBe('acc-5000');
      expect(reversal.lines[1]?.creditAmountGhs).toBe(75000n);
    });
  });

  describe('5. Brought-Forward Deltas & Period 13 Adjustment (Spec Section A3)', () => {
    it('calculates exact account and fund differences after Period 13 adjustment', () => {
      const notice = calculateBroughtForwardDeltas({
        financialYearId: 'fy-2026',
        yearLabel: 'FY2026',
        actorName: 'Auditor Johnson',
        reason: 'Post-audit depreciation adjustment',
        accounts: sampleAccounts,
        funds: sampleFunds,
        oldClosingEntries: sampleEntries,
        newClosingEntries: [
          ...sampleEntries,
          {
            id: 'e-adj-13',
            branchId: 'br-1',
            documentNumber: 'ADJ-13-001',
            entryDate: '2026-12-31',
            narration: 'Auditor post-close adjustment',
            entryType: 'STANDARD',
            lineCount: 2,
            totalDebitGhs: 50000n,
            totalCreditGhs: 50000n,
            isReversal: false,
            deviceId: 'dev-1',
            createdAt: '2027-01-15T10:00:00Z',
            createdBy: 'Auditor Johnson',
            lines: [
              {
                id: 'al1',
                journalEntryId: 'e-adj-13',
                accountId: 'acc-1000',
                fundId: 'f-gen',
                lineNumber: 1,
                originalCurrency: 'GHS',
                originalAmount: 50000n,
                exchangeRate: '1.0000',
                debitAmountGhs: 50000n,
                creditAmountGhs: 0n,
                roundingDifferencePesewas: 0n,
              },
              {
                id: 'al2',
                journalEntryId: 'e-adj-13',
                accountId: 'acc-3000',
                fundId: 'f-gen',
                lineNumber: 2,
                originalCurrency: 'GHS',
                originalAmount: 50000n,
                exchangeRate: '1.0000',
                debitAmountGhs: 0n,
                creditAmountGhs: 50000n,
                roundingDifferencePesewas: 0n,
              },
            ],
          },
        ],
      });

      expect(notice.adjustedPeriodNumber).toBe(13);
      expect(notice.accountDeltas.length).toBeGreaterThan(0);
      const cashDelta = notice.accountDeltas.find((d) => d.accountId === 'acc-1000');
      expect(cashDelta).toBeDefined();
    });
  });

  describe('6. Budget Rollover (Spec Section A4)', () => {
    it('rolls over budget lines with positive and negative percentage adjustments', () => {
      const currentLines = [
        { id: 'b1', accountId: 'acc-5000', fundId: 'f-gen', annualAmountPesewas: 1000000n }, // 10,000
      ];

      // +5% adjustment
      const rolledPlus5 = rolloverBudget({
        currentBudgetLines: currentLines,
        percentageAdjustment: 5,
        nextYearLabel: 'FY2027',
      });
      expect(rolledPlus5[0]?.annualAmountPesewas).toBe(1050000n); // 10,500

      // -10% adjustment
      const rolledMinus10 = rolloverBudget({
        currentBudgetLines: currentLines,
        percentageAdjustment: -10,
        nextYearLabel: 'FY2027',
      });
      expect(rolledMinus10[0]?.annualAmountPesewas).toBe(900000n); // 9,000
    });
  });

  describe('7. Member Data Dossier & Anonymisation (Spec Section C6)', () => {
    const sampleMember = {
      id: 'mem-001',
      fullName: 'Emmanuel Quaye',
      memberNumber: 'MEM-001',
      envelopeNumber: 'ENV-055',
      phoneNumber: '+233244112233',
      email: 'emmanuel@example.com',
      address: 'Spintex Road, Accra',
      status: 'ACTIVE' as const,
    };

    const sampleGiving = [
      {
        id: 'giv-1',
        branchId: 'br-1',
        memberId: 'mem-001',
        memberName: 'Emmanuel Quaye',
        serviceDate: '2026-05-10',
        fundId: 'f-gen',
        fundName: 'General Fund',
        amountPesewas: 50000n,
        currency: 'GHS' as const,
        paymentMethod: 'MOMO' as const,
        category: 'Tithe' as const,
        receiptNumber: 'REC-001',
        createdAt: '2026-05-10T10:00:00Z',
      },
    ];

    it('generates complete member data dossier with statutory compliance notice', () => {
      const dossier = generateMemberDataDossier({
        member: sampleMember,
        givingRecords: sampleGiving,
        pledges: [],
        accessAuditTrail: [],
        exportedBy: 'Kofi Mensah (Treasurer)',
        exportPurpose: 'Data subject access request by member',
      });

      expect(dossier.memberId).toBe('mem-001');
      expect(dossier.totalGivingPesewas).toBe(50000n);
      expect(dossier.ghanaDataProtectionActNotice).toContain('Ghana Data Protection Act, 2012');
    });

    it('anonymises former member while preserving giving amounts and ledger integrity', () => {
      const res = anonymiseFormerMember({
        member: sampleMember,
        givingRecords: sampleGiving,
        pledges: [],
        executedBy: 'Kofi Mensah (Treasurer)',
        reason: 'Member relocated abroad and requested record anonymisation',
      });

      expect(res.anonymisedMember.fullName).toContain('Former Member (Anonymised');
      expect(res.anonymisedMember.phoneNumber).toBeUndefined();
      expect(res.anonymisedMember.email).toBeUndefined();
      expect(res.anonymisedMember.status).toBe('ANONYMISED');

      // Giving record name anonymised but amount strictly unchanged
      expect(res.anonymisedGivingRecords[0]?.memberName).toContain('Former Member (Anonymised');
      expect(res.anonymisedGivingRecords[0]?.amountPesewas).toBe(50000n);
      expect(res.anonymisationAuditRecord.ledgerIntactNotice).toContain('100% intact');
    });
  });

  describe('8. Offline Device Version Control Gate (Spec Section D)', () => {
    it('compares semantic version strings correctly', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('blocks outdated clients from posting while preserving offline read access', () => {
      const evalResult = evaluateVersionGate({
        clientAppVersion: '0.9.5',
        clientSchemaVersion: 1,
        serverPolicy: {
          minSupportedAppVersion: '1.0.0',
          minSupportedSchemaVersion: 1,
          latestAppVersion: '1.2.0',
        },
      });

      expect(evalResult.status).toBe('BLOCKED_OUTDATED');
      expect(evalResult.isPostingAllowed).toBe(false);
      expect(evalResult.isSyncAllowed).toBe(false);
      expect(evalResult.isReadAllowed).toBe(true); // Read-only access preserved
      expect(evalResult.userMessage).toContain('This app needs an update');
    });

    it('allows posting and informs user when non-breaking update is available', () => {
      const evalResult = evaluateVersionGate({
        clientAppVersion: '1.0.0',
        clientSchemaVersion: 1,
        serverPolicy: {
          minSupportedAppVersion: '1.0.0',
          minSupportedSchemaVersion: 1,
          latestAppVersion: '1.2.0',
          releaseNotes: 'Performance enhancements and bug fixes.',
        },
      });

      expect(evalResult.status).toBe('UPDATE_AVAILABLE');
      expect(evalResult.isPostingAllowed).toBe(true);
      expect(evalResult.isSyncAllowed).toBe(true);
      expect(evalResult.userMessage).toContain('Update available (1.2.0)');
    });
  });
});
