import { describe, it, expect } from 'vitest';
import {
  generateFinancialYearWithPeriods,
  canPostToPeriod,
  evaluateYearEndChecklist,
  generateYearEndClosingPreview,
  generateYearEndClosingEntries,
  generateIssuedYearEndPack,
  generateAccrualDayOneReversal,
  calculateBroughtForwardDeltas,
  rolloverBudget,
  calculateTrialBalance,
  type Account,
  type Fund,
  type JournalEntry,
} from '../index.js';

describe('Phase 8 Hardening Suite: Year-End Close & Multi-Year Lifecycle (yearend.test.ts)', () => {
  const BRANCH_ID = 'br-calvary-main';

  const funds: Fund[] = [
    {
      id: 'fund-gen',
      branchId: BRANCH_ID,
      code: '01',
      name: 'General Fund',
      type: 'Unrestricted',
      allowOverdraft: true,
      isActive: true,
    },
    {
      id: 'fund-bld',
      branchId: BRANCH_ID,
      code: '02',
      name: 'Building Project Fund',
      type: 'Restricted',
      allowOverdraft: false,
      isActive: true,
    },
    {
      id: 'fund-mis',
      branchId: BRANCH_ID,
      code: '03',
      name: 'Missions & Evangelism Fund',
      type: 'Restricted',
      allowOverdraft: false,
      isActive: true,
    },
  ];

  const accounts: Account[] = [
    {
      id: 'acc-1010',
      branchId: BRANCH_ID,
      code: '1010',
      name: 'Cash & Bank (GHS)',
      type: 'Asset',
      currency: 'GHS',
      isBankOrCash: true,
      isActive: true,
    },
    {
      id: 'acc-2010',
      branchId: BRANCH_ID,
      code: '2010',
      name: 'Accrued Expenses Payable',
      type: 'Liability',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-3010',
      branchId: BRANCH_ID,
      code: '3010',
      name: 'General Fund Balance',
      type: 'Equity',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-3020',
      branchId: BRANCH_ID,
      code: '3020',
      name: 'Building Project Fund Balance',
      type: 'Equity',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-3030',
      branchId: BRANCH_ID,
      code: '3030',
      name: 'Missions & Evangelism Fund Balance',
      type: 'Equity',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-4010',
      branchId: BRANCH_ID,
      code: '4010',
      name: 'Tithes & General Offerings',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-4020',
      branchId: BRANCH_ID,
      code: '4020',
      name: 'Building Harvest Contributions',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-4030',
      branchId: BRANCH_ID,
      code: '4030',
      name: 'Missions Pledges & Offerings',
      type: 'Income',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-5010',
      branchId: BRANCH_ID,
      code: '5010',
      name: 'Pastoral & Administration Expense',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-5020',
      branchId: BRANCH_ID,
      code: '5020',
      name: 'Sanctuary Construction Expense',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
    {
      id: 'acc-5030',
      branchId: BRANCH_ID,
      code: '5030',
      name: 'Rural Missions Crusade Expense',
      type: 'Expense',
      currency: 'GHS',
      isBankOrCash: false,
      isActive: true,
    },
  ];

  const baseEntries: JournalEntry[] = [
    // Opening Balance at 01 Jan 2026: General Fund 50,000 GHS, Building Fund 20,000 GHS
    {
      id: 'je-ob-gen',
      branchId: BRANCH_ID,
      documentNumber: 'OB-2026-01',
      entryDate: '2026-01-01',
      narration: 'Opening balance General Fund',
      entryType: 'OPENING_BALANCE',
      lineCount: 2,
      totalDebitGhs: 5000000n,
      totalCreditGhs: 5000000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-01-01T08:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-ob-1',
          journalEntryId: 'je-ob-gen',
          accountId: 'acc-1010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 5000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 5000000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-ob-2',
          journalEntryId: 'je-ob-gen',
          accountId: 'acc-3010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 5000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 5000000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'je-ob-bld',
      branchId: BRANCH_ID,
      documentNumber: 'OB-2026-02',
      entryDate: '2026-01-01',
      narration: 'Opening balance Building Fund',
      entryType: 'OPENING_BALANCE',
      lineCount: 2,
      totalDebitGhs: 2000000n,
      totalCreditGhs: 2000000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-01-01T08:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-ob-3',
          journalEntryId: 'je-ob-bld',
          accountId: 'acc-1010',
          fundId: 'fund-bld',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 2000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 2000000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-ob-4',
          journalEntryId: 'je-ob-bld',
          accountId: 'acc-3020',
          fundId: 'fund-bld',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 2000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 2000000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    // General Fund activity: 120,000 GHS Income, 85,000 GHS Expense -> Surplus 35,000 GHS
    {
      id: 'je-gen-inc',
      branchId: BRANCH_ID,
      documentNumber: 'JE-2026-010',
      entryDate: '2026-06-15',
      narration: 'Annual tithes & general offerings',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 12000000n,
      totalCreditGhs: 12000000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-06-15T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-gi-1',
          journalEntryId: 'je-gen-inc',
          accountId: 'acc-1010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 12000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 12000000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-gi-2',
          journalEntryId: 'je-gen-inc',
          accountId: 'acc-4010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 12000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 12000000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'je-gen-exp',
      branchId: BRANCH_ID,
      documentNumber: 'JE-2026-011',
      entryDate: '2026-09-20',
      narration: 'Pastoral & utility expenses',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 8500000n,
      totalCreditGhs: 8500000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-09-20T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-ge-1',
          journalEntryId: 'je-gen-exp',
          accountId: 'acc-5010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 8500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 8500000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-ge-2',
          journalEntryId: 'je-gen-exp',
          accountId: 'acc-1010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 8500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 8500000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    // Building Fund activity (Restricted): 40,000 GHS Income, 15,000 GHS Expense -> Surplus 25,000 GHS
    {
      id: 'je-bld-inc',
      branchId: BRANCH_ID,
      documentNumber: 'JE-2026-020',
      entryDate: '2026-08-10',
      narration: 'Building Harvest receipts',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 4000000n,
      totalCreditGhs: 4000000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-08-10T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-bi-1',
          journalEntryId: 'je-bld-inc',
          accountId: 'acc-1010',
          fundId: 'fund-bld',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 4000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 4000000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-bi-2',
          journalEntryId: 'je-bld-inc',
          accountId: 'acc-4020',
          fundId: 'fund-bld',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 4000000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 4000000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
    {
      id: 'je-bld-exp',
      branchId: BRANCH_ID,
      documentNumber: 'JE-2026-021',
      entryDate: '2026-11-05',
      narration: 'Roofing trusses payment',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 1500000n,
      totalCreditGhs: 1500000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-11-05T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-be-1',
          journalEntryId: 'je-bld-exp',
          accountId: 'acc-5020',
          fundId: 'fund-bld',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 1500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 1500000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-be-2',
          journalEntryId: 'je-bld-exp',
          accountId: 'acc-1010',
          fundId: 'fund-bld',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 1500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 1500000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    },
  ];

  it('1. generates per-fund closing entries that zero all income and expense accounts, keeps restricted funds segregated, and balances post-close Trial Balance', () => {
    const preview = generateYearEndClosingPreview({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: baseEntries,
    });

    // General Fund: B/F 50,000 + Surplus 35,000 = C/F 85,000 GHS
    const genSummary = preview.fundSummaries.find((f) => f.fundId === 'fund-gen')!;
    expect(genSummary.totalIncomePesewas).toBe(12000000n);
    expect(genSummary.totalExpensePesewas).toBe(8500000n);
    expect(genSummary.netSurplusPesewas).toBe(3500000n);
    expect(genSummary.broughtForwardPesewas).toBe(5000000n);
    expect(genSummary.carriedForwardPesewas).toBe(8500000n);

    // Building Fund (Restricted): B/F 20,000 + Surplus 25,000 = C/F 45,000 GHS
    const bldSummary = preview.fundSummaries.find((f) => f.fundId === 'fund-bld')!;
    expect(bldSummary.totalIncomePesewas).toBe(4000000n);
    expect(bldSummary.totalExpensePesewas).toBe(1500000n);
    expect(bldSummary.netSurplusPesewas).toBe(2500000n);
    expect(bldSummary.broughtForwardPesewas).toBe(2000000n);
    expect(bldSummary.carriedForwardPesewas).toBe(4500000n);
    expect(bldSummary.hasDeficitWarning).toBe(false);

    // Sum of fund carried-forward balances == Balance Sheet Net Assets (130,000 GHS)
    expect(preview.totalCarriedForwardPesewas).toBe(13000000n);
    expect(preview.netAssetsPesewas).toBe(13000000n);
    expect(preview.isReconciledToNetAssets).toBe(true);

    // Generate closing entries (one per fund)
    const closingEntries = generateYearEndClosingEntries({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: baseEntries,
      executedByTreasurer: 'Kofi Mensah (Treasurer)',
    });

    expect(closingEntries).toHaveLength(funds.length);
    for (const ce of closingEntries) {
      expect(ce.entryType).toBe('YEAR_END_CLOSING');
      expect(ce.totalDebitGhs).toBe(ce.totalCreditGhs);
    }

    // Post-close Trial Balance must be balanced and all Income/Expense accounts must have 0 net balance
    const postCloseEntries = [...baseEntries, ...closingEntries];
    const postCloseTb = calculateTrialBalance(postCloseEntries, accounts, funds);
    expect(postCloseTb.isBalanced).toBe(true);
    expect(postCloseTb.differenceGhs).toBe(0n);

    for (const item of postCloseTb.accounts) {
      const acct = accounts.find((a) => a.id === item.accountId)!;
      if (acct.type === 'Income' || acct.type === 'Expense') {
        expect(item.debitGhs - item.creditGhs).toBe(0n);
      }
    }
  });

  it('2. flags restricted funds in deficit and never auto-transfers from General Fund', () => {
    const deficitEntry: JournalEntry = {
      id: 'je-mis-def',
      branchId: BRANCH_ID,
      documentNumber: 'JE-2026-099',
      entryDate: '2026-12-10',
      narration: 'Missions crusade overspend',
      entryType: 'STANDARD',
      lineCount: 2,
      totalDebitGhs: 500000n,
      totalCreditGhs: 500000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2026-12-10T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-md-1',
          journalEntryId: 'je-mis-def',
          accountId: 'acc-5030',
          fundId: 'fund-mis',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 500000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-md-2',
          journalEntryId: 'je-mis-def',
          accountId: 'acc-1010',
          fundId: 'fund-mis',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 500000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 500000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    };

    const preview = generateYearEndClosingPreview({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: [...baseEntries, deficitEntry],
    });

    const misSummary = preview.fundSummaries.find((f) => f.fundId === 'fund-mis')!;
    expect(misSummary.carriedForwardPesewas).toBe(-500000n);
    expect(misSummary.hasDeficitWarning).toBe(true);
    expect(preview.restrictedFundsWithDeficits).toHaveLength(1);
  });

  it('3. enforces locked-year rejection and dual-approver reopening of Period 13 only', () => {
    const { financialYear, periods } = generateFinancialYearWithPeriods({
      id: 'fy-2026',
      branchId: BRANCH_ID,
      label: 'FY2026',
      startYear: 2026,
      startMonth: 1,
      hasAdjustmentPeriod: true,
      initialClosedMonthsCount: 12,
    });

    const lockedYear = {
      ...financialYear,
      status: 'LOCKED' as const,
      lockedAt: '2027-01-10T12:00:00Z',
      lockedBy: 'Kofi Mensah (Treasurer)',
    };

    // Both regular month 12 and Period 13 are blocked when year is LOCKED
    const decPeriod = periods[11]!;
    const period13 = periods[12]!;
    expect(canPostToPeriod({ period: decPeriod, financialYear: lockedYear, userRole: 'Treasurer' }).allowed).toBe(false);
    expect(canPostToPeriod({ period: period13, financialYear: lockedYear, userRole: 'Treasurer' }).allowed).toBe(false);

    // Reopen Year for Adjustment (Period 13 only)
    const reopenedYear = {
      ...lockedYear,
      status: 'REOPENED_ADJUSTMENT_ONLY' as const,
      reopenedAt: '2027-01-18T09:00:00Z',
      reopenedBy: 'Kofi Mensah (Treasurer)',
      reopenApprovedBy: 'Rev. Emmanuel Addo (Pastor / Elder)',
      reopenReason: 'External auditor accrual adjustment for December electricity invoice',
    };
    const openPeriod13 = { ...period13, status: 'OPEN' as const, isClosed: false };

    // Regular months 1..12 remain strictly blocked
    expect(canPostToPeriod({ period: decPeriod, financialYear: reopenedYear, userRole: 'Treasurer' }).allowed).toBe(false);

    // Period 13 allows Treasurer posting
    expect(canPostToPeriod({ period: openPeriod13, financialYear: reopenedYear, userRole: 'Treasurer' }).allowed).toBe(true);
  });

  it('4. computes Period 13 post-close adjustment delta notice for brought-forward balances', () => {
    const period13Adjustment: JournalEntry = {
      id: 'je-p13-adj',
      branchId: BRANCH_ID,
      documentNumber: 'ADJ-2026-P13',
      entryDate: '2026-12-31',
      narration: 'Period 13 auditor electricity accrual',
      entryType: 'STANDARD',
      isAdjustmentPeriodEntry: true,
      lineCount: 2,
      totalDebitGhs: 180000n,
      totalCreditGhs: 180000n,
      isReversal: false,
      deviceId: 'dev-1',
      createdAt: '2027-01-18T10:00:00Z',
      createdBy: 'Kofi Mensah',
      lines: [
        {
          id: 'l-p13-1',
          journalEntryId: 'je-p13-adj',
          accountId: 'acc-5010',
          fundId: 'fund-gen',
          lineNumber: 1,
          originalCurrency: 'GHS',
          originalAmount: 180000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 180000n,
          creditAmountGhs: 0n,
          roundingDifferencePesewas: 0n,
        },
        {
          id: 'l-p13-2',
          journalEntryId: 'je-p13-adj',
          accountId: 'acc-2010',
          fundId: 'fund-gen',
          lineNumber: 2,
          originalCurrency: 'GHS',
          originalAmount: 180000n,
          exchangeRate: '1.0000',
          debitAmountGhs: 0n,
          creditAmountGhs: 180000n,
          roundingDifferencePesewas: 0n,
        },
      ],
    };

    const deltaNotice = calculateBroughtForwardDeltas({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      actorName: 'Kofi Mensah (Treasurer)',
      reason: 'External auditor electricity accrual in Period 13',
      accounts,
      funds,
      oldClosingEntries: baseEntries,
      newClosingEntries: [...baseEntries, period13Adjustment],
    });

    expect(deltaNotice.adjustedPeriodNumber).toBe(13);
    expect(deltaNotice.accountDeltas.length).toBeGreaterThan(0);
    const payableDelta = deltaNotice.accountDeltas.find((d) => d.accountId === 'acc-2010')!;
    expect(payableDelta.deltaPesewas).toBe(180000n);
  });

  it('5. evaluates 11 blocking + 4 advisory checks, generates 10-report Issued Pack, Day-1 accrual reversal, and budget rollover', () => {
    const evalBlocked = evaluateYearEndChecklist({
      allMonthsClosed: false,
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
      nextYearBudgetCreated: false,
      assetVerificationDone: true,
      openRequisitionsPendingCount: 2,
      outstandingPledgesCount: 5,
      overrides: [],
    });

    expect(evalBlocked.isCloseAllowed).toBe(false);
    expect(evalBlocked.blockingFailedCount).toBe(1);

    // Override with Treasurer reason
    const evalOverridden = evaluateYearEndChecklist({
      allMonthsClosed: false,
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
      nextYearBudgetCreated: false,
      assetVerificationDone: true,
      openRequisitionsPendingCount: 0,
      outstandingPledgesCount: 0,
      overrides: [
        {
          checkKey: 'ALL_MONTHS_CLOSED',
          reason: 'December soft-closed pending final utility receipt',
          overriddenByTreasurerId: 'usr-1',
          overriddenByTreasurerName: 'Kofi Mensah',
          timestamp: '2026-12-31T18:00:00Z',
        },
      ],
    });
    expect(evalOverridden.isCloseAllowed).toBe(true);

    const preview = generateYearEndClosingPreview({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      branchId: BRANCH_ID,
      effectiveClosingDate: '2026-12-31',
      accounts,
      funds,
      entries: baseEntries,
    });

    const pack = generateIssuedYearEndPack({
      financialYearId: 'fy-2026',
      yearLabel: 'FY2026',
      generatedBy: 'Kofi Mensah (Treasurer)',
      preview,
      overridesCount: 1,
    });
    expect(pack.reports).toHaveLength(10);
    expect(pack.reports.every((r) => r.sha256Hash.length === 64)).toBe(true);

    // Accrual Day-1 auto-reversal
    const reversal = generateAccrualDayOneReversal(
      {
        id: 'accr-1',
        type: 'EXPENSE_ACCRUAL',
        date: '2026-12-31',
        autoReverseDate: '2027-01-01',
        description: 'Accrued December security services',
        debitAccountId: 'acc-5010',
        creditAccountId: 'acc-2010',
        amountPesewas: 250000n,
        fundId: 'fund-gen',
        createdBy: 'Kofi Mensah',
        createdAt: '2026-12-31T19:00:00Z',
      },
      BRANCH_ID
    );
    expect(reversal.entryDate).toBe('2027-01-01');
    expect(reversal.isReversal).toBe(true);
    expect(reversal.totalDebitGhs).toBe(250000n);
    expect(reversal.totalCreditGhs).toBe(250000n);

    // Budget rollover (+10%)
    const rolled = rolloverBudget({
      currentBudgetLines: [
        { id: 'bl-1', accountId: 'acc-4010', fundId: 'fund-gen', annualAmountPesewas: 10000000n },
      ],
      percentageAdjustment: 10,
      nextYearLabel: 'FY2027',
    });
    expect(rolled[0]!.annualAmountPesewas).toBe(11000000n);
    expect(rolled[0]!.rolledOverFromYear).toBe('FY2027');
  });
});
