import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type {
  Account,
  Fund,
  AccountingPeriod,
  PeriodStatus,
  ExchangeRate,
  JournalEntry,
  TrialBalanceReport,
  DoctorReport,
  FinancialYear,
  ImportBatchRecord,
  RoleTrainingRecord,
  GoLiveReadinessReport,
  OldBookBalanceInput,
  ParallelRunComparisonRow,
  ParallelRunMonthSummary,
  ParallelRunOverallReport,
  YearEndOverride,
  YearEndCheckKey,
  YearEndCloseRunResult,
  BroughtForwardDeltaNotice,
  IssuedYearEndPack,
  AccrualPrepaymentEntry,
} from '@church/domain';
import {
  calculateTrialBalance,
  diagnoseLedger,
  createJournalEntry,
  createReversalEntry,
  generateFinancialYearWithPeriods,
  transitionPeriodStatus,
  canChangeFiscalYearStartMonth,
  computeImportFileSha256,
  getImportTemplate,
  parseGenericCsv,
  buildDefaultColumnMapping,
  reverseImportBatch as reverseImportBatchDomain,
  evaluateGoLiveReadiness,
  confirmGoLiveTransition,
  compareParallelRunMonth,
  evaluateParallelRunOverall,
  signOffParallelRunMonth,
  getMonthName,
  generateYearEndClosingPreview,
  generateYearEndClosingEntries,
  generateIssuedYearEndPack,
  generateAccrualDayOneReversal,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useDemo } from './DemoContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acct-1010', branchId: '00000000-0000-0000-0000-000000000001', code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1015', branchId: '00000000-0000-0000-0000-000000000001', code: '1015', name: 'Cheques in Hand', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1020', branchId: '00000000-0000-0000-0000-000000000001', code: '1020', name: 'Cash on Hand (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: '00000000-0000-0000-0000-000000000001', code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1040', branchId: '00000000-0000-0000-0000-000000000001', code: '1040', name: 'Bank Account (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
  { id: 'acct-1050', branchId: '00000000-0000-0000-0000-000000000001', code: '1050', name: 'Mobile Money (MoMo) Wallet', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1500', branchId: '00000000-0000-0000-0000-000000000001', code: '1500', name: 'Freehold Land', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1510', branchId: '00000000-0000-0000-0000-000000000001', code: '1510', name: 'Church Buildings', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1511', branchId: '00000000-0000-0000-0000-000000000001', code: '1511', name: 'Accumulated Depreciation: Buildings', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1520', branchId: '00000000-0000-0000-0000-000000000001', code: '1520', name: 'Furniture & Fittings', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1521', branchId: '00000000-0000-0000-0000-000000000001', code: '1521', name: 'Accumulated Depreciation: Furniture', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1530', branchId: '00000000-0000-0000-0000-000000000001', code: '1530', name: 'Sound & Audio-Visual Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1531', branchId: '00000000-0000-0000-0000-000000000001', code: '1531', name: 'Accumulated Depreciation: Sound & AV', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1540', branchId: '00000000-0000-0000-0000-000000000001', code: '1540', name: 'Musical Instruments', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1541', branchId: '00000000-0000-0000-0000-000000000001', code: '1541', name: 'Accumulated Depreciation: Musical Instruments', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1550', branchId: '00000000-0000-0000-0000-000000000001', code: '1550', name: 'Motor Vehicles', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1551', branchId: '00000000-0000-0000-0000-000000000001', code: '1551', name: 'Accumulated Depreciation: Vehicles', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1560', branchId: '00000000-0000-0000-0000-000000000001', code: '1560', name: 'Computers & IT Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1561', branchId: '00000000-0000-0000-0000-000000000001', code: '1561', name: 'Accumulated Depreciation: IT Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1570', branchId: '00000000-0000-0000-0000-000000000001', code: '1570', name: 'Generators & Electrical Systems', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1571', branchId: '00000000-0000-0000-0000-000000000001', code: '1571', name: 'Accumulated Depreciation: Generators', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1580', branchId: '00000000-0000-0000-0000-000000000001', code: '1580', name: 'Kitchen & Catering Equipment', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1581', branchId: '00000000-0000-0000-0000-000000000001', code: '1581', name: 'Accumulated Depreciation: Kitchen', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1590', branchId: '00000000-0000-0000-0000-000000000001', code: '1590', name: 'Other Fixed Assets', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-1591', branchId: '00000000-0000-0000-0000-000000000001', code: '1591', name: 'Accumulated Depreciation: Other Assets', type: 'Asset', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2010', branchId: '00000000-0000-0000-0000-000000000001', code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2020', branchId: '00000000-0000-0000-0000-000000000001', code: '2020', name: 'Interfund Due To / Due From', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2030', branchId: '00000000-0000-0000-0000-000000000001', code: '2030', name: 'Ghana GRA PAYE / Withholding Tax Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2050', branchId: '00000000-0000-0000-0000-000000000001', code: '2050', name: 'Denominational Remittances Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3010', branchId: '00000000-0000-0000-0000-000000000001', code: '3010', name: 'General Fund Equity', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3020', branchId: '00000000-0000-0000-0000-000000000001', code: '3020', name: 'Restricted Fund Balance', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4010', branchId: '00000000-0000-0000-0000-000000000001', code: '4010', name: 'Tithes', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4020', branchId: '00000000-0000-0000-0000-000000000001', code: '4020', name: 'General Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4030', branchId: '00000000-0000-0000-0000-000000000001', code: '4030', name: 'Special Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4040', branchId: '00000000-0000-0000-0000-000000000001', code: '4040', name: 'Pledge Payments', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4050', branchId: '00000000-0000-0000-0000-000000000001', code: '4050', name: 'Welfare Offering', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4060', branchId: '00000000-0000-0000-0000-000000000001', code: '4060', name: 'Capital Donations in Kind', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4070', branchId: '00000000-0000-0000-0000-000000000001', code: '4070', name: 'Gain on Disposal of Fixed Assets', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5010', branchId: '00000000-0000-0000-0000-000000000001', code: '5010', name: 'Salaries and Allowances', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5020', branchId: '00000000-0000-0000-0000-000000000001', code: '5020', name: 'Utilities', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5030', branchId: '00000000-0000-0000-0000-000000000001', code: '5030', name: 'Maintenance & Repairs', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5040', branchId: '00000000-0000-0000-0000-000000000001', code: '5040', name: 'Outreach and Missions', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5050', branchId: '00000000-0000-0000-0000-000000000001', code: '5050', name: 'Welfare Support', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5060', branchId: '00000000-0000-0000-0000-000000000001', code: '5060', name: 'Denominational Remittance Expense', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5070', branchId: '00000000-0000-0000-0000-000000000001', code: '5070', name: 'Loss on Disposal of Fixed Assets', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5210', branchId: '00000000-0000-0000-0000-000000000001', code: '5210', name: 'Depreciation Expense: Buildings', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5220', branchId: '00000000-0000-0000-0000-000000000001', code: '5220', name: 'Depreciation Expense: Furniture & Fittings', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5230', branchId: '00000000-0000-0000-0000-000000000001', code: '5230', name: 'Depreciation Expense: Sound & AV', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5240', branchId: '00000000-0000-0000-0000-000000000001', code: '5240', name: 'Depreciation Expense: Musical Instruments', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5250', branchId: '00000000-0000-0000-0000-000000000001', code: '5250', name: 'Depreciation Expense: Motor Vehicles', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5260', branchId: '00000000-0000-0000-0000-000000000001', code: '5260', name: 'Depreciation Expense: IT Equipment', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5270', branchId: '00000000-0000-0000-0000-000000000001', code: '5270', name: 'Depreciation Expense: Generators', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5280', branchId: '00000000-0000-0000-0000-000000000001', code: '5280', name: 'Depreciation Expense: Kitchen Equipment', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5290', branchId: '00000000-0000-0000-0000-000000000001', code: '5290', name: 'Depreciation Expense: Other Assets', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5980', branchId: '00000000-0000-0000-0000-000000000001', code: '5980', name: 'Foreign Exchange Gain/Loss', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5990', branchId: '00000000-0000-0000-0000-000000000001', code: '5990', name: 'Rounding Differences', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
];

export const INITIAL_FUNDS: Fund[] = [
  { id: 'fund-gen', branchId: '00000000-0000-0000-0000-000000000001', code: 'GEN', name: 'General Fund', type: 'Unrestricted', allowOverdraft: true, isActive: true },
  { id: 'fund-bld', branchId: '00000000-0000-0000-0000-000000000001', code: 'BLD', name: 'Building Fund', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-mis', branchId: '00000000-0000-0000-0000-000000000001', code: 'MIS', name: 'Missions & Outreach', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-wel', branchId: '00000000-0000-0000-0000-000000000001', code: 'WEL', name: 'Welfare & Benevolence', type: 'Restricted', allowOverdraft: false, isActive: true },
  { id: 'fund-yth', branchId: '00000000-0000-0000-0000-000000000001', code: 'YTH', name: 'Youth Ministry', type: 'Restricted', allowOverdraft: false, isActive: true },
];

const FY2025_GENERATED = generateFinancialYearWithPeriods({
  id: 'fy-2025',
  branchId: '00000000-0000-0000-0000-000000000001',
  label: 'FY2025',
  startYear: 2025,
  startMonth: 1,
  hasAdjustmentPeriod: true,
  initialClosedMonthsCount: 12,
});

const FY2026_GENERATED = generateFinancialYearWithPeriods({
  id: 'fy-2026',
  branchId: '00000000-0000-0000-0000-000000000001',
  label: 'FY2026',
  startYear: 2026,
  startMonth: 1,
  hasAdjustmentPeriod: true,
  initialClosedMonthsCount: 9, // Jan..Sep closed, Oct..Dec + Period 13 open
});

export const INITIAL_FINANCIAL_YEARS: FinancialYear[] = [
  FY2026_GENERATED.financialYear,
  {
    ...FY2025_GENERATED.financialYear,
    status: 'LOCKED',
    lockedAt: '2026-01-15T18:00:00Z',
    lockedBy: 'Kofi Mensah (Treasurer)',
  },
];

export const INITIAL_PERIODS: AccountingPeriod[] = [
  ...FY2026_GENERATED.periods.map((p) =>
    p.month === 9
      ? { ...p, id: 'per-2026-09' }
      : p.month === 10
      ? { ...p, id: 'per-2026-10', status: 'OPEN' as const }
      : p.month === 11
      ? { ...p, id: 'per-2026-11', status: 'OPEN' as const }
      : p
  ),
  ...FY2025_GENERATED.periods.map((p) => ({
    ...p,
    status: 'CLOSED' as const,
    isClosed: true,
  })),
];

export const INITIAL_EXCHANGE_RATES: ExchangeRate[] = [
  {
    id: 'rate-1',
    branchId: '00000000-0000-0000-0000-000000000001',
    rateDate: '2026-10-01',
    currency: 'USD',
    rate: '15.5000',
    enteredBy: 'user-0001-treasurer',
    notes: 'October monthly opening benchmark rate',
  },
];

const createSeedEntries = (): JournalEntry[] => [
  createJournalEntry({
    id: 'je-seed-sep-1',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-TR-2026-09-01',
    entryDate: '2026-09-28',
    narration: 'September General Fund Collections (Cash, Bank, MoMo)',
    createdBy: 'user-0001-treasurer',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 'sep1-l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 450000n, exchangeRate: '1.0000', isDebit: true, description: 'Cash on Hand (GHS)' },
      { id: 'sep1-l2', accountId: 'acct-1030', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 2850000n, exchangeRate: '1.0000', isDebit: true, description: 'Bank Account (GHS)' },
      { id: 'sep1-l3', accountId: 'acct-1050', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 620000n, exchangeRate: '1.0000', isDebit: true, description: 'MTN Mobile Money' },
      { id: 'sep1-l4', accountId: 'acct-3010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 3920000n, exchangeRate: '1.0000', isDebit: false, description: 'General Fund Equity' },
    ],
  }),
  createJournalEntry({
    id: 'je-seed-sep-2',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-TR-2026-09-02',
    entryDate: '2026-09-28',
    narration: 'September Building Fund Project Deposits',
    createdBy: 'user-0001-treasurer',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 'sep2-l1', accountId: 'acct-1030', fundId: 'fund-bld', originalCurrency: 'GHS', originalAmount: 4200000n, exchangeRate: '1.0000', isDebit: true, description: 'Bank GHS - Building Fund' },
      { id: 'sep2-l2', accountId: 'acct-3020', fundId: 'fund-bld', originalCurrency: 'GHS', originalAmount: 4200000n, exchangeRate: '1.0000', isDebit: false, description: 'Restricted Fund Balance' },
    ],
  }),
  createJournalEntry({
    id: 'je-seed-1',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-TR-000001',
    entryDate: '2026-10-05',
    narration: 'Sunday Tithes and General Offering received in Cash',
    createdBy: 'user-0001-treasurer',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 's1-l1', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 850000n, exchangeRate: '1.0000', isDebit: true, description: 'Cash on Hand - Tithes' },
      { id: 's1-l2', accountId: 'acct-4010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 850000n, exchangeRate: '1.0000', isDebit: false, description: 'Member Tithes Received' },
    ],
  }),
  createJournalEntry({
    id: 'je-seed-2',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-FS-000002',
    entryDate: '2026-10-10',
    narration: 'Building Fund Pledge Contributions received in Bank',
    createdBy: 'user-0002-finsec',
    deviceId: 'DEV-FS-01',
    lines: [
      { id: 's2-l1', accountId: 'acct-1030', fundId: 'fund-bld', originalCurrency: 'GHS', originalAmount: 450000n, exchangeRate: '1.0000', isDebit: true, description: 'Bank GHS - Building Fund' },
      { id: 's2-l2', accountId: 'acct-4040', fundId: 'fund-bld', originalCurrency: 'GHS', originalAmount: 450000n, exchangeRate: '1.0000', isDebit: false, description: 'Building Project Pledge Payment' },
    ],
  }),
  createJournalEntry({
    id: 'je-seed-3',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-TR-000003',
    entryDate: '2026-10-14',
    narration: 'Payment for Church Auditorium Electricity & Water Utilities',
    createdBy: 'user-0001-treasurer',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 's3-l1', accountId: 'acct-5020', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 120000n, exchangeRate: '1.0000', isDebit: true, description: 'ECG Prepaid & Water' },
      { id: 's3-l2', accountId: 'acct-1010', fundId: 'fund-gen', originalCurrency: 'GHS', originalAmount: 120000n, exchangeRate: '1.0000', isDebit: false, description: 'Paid from Cash on Hand' },
    ],
  }),
  createJournalEntry({
    id: 'je-seed-4',
    branchId: '00000000-0000-0000-0000-000000000001',
    documentNumber: 'JE-TR-000004',
    entryDate: '2026-10-20',
    narration: 'USD Mission Donation from Diaspora Partner ($200.00)',
    createdBy: 'user-0001-treasurer',
    deviceId: 'DEV-TR-01',
    lines: [
      { id: 's4-l1', accountId: 'acct-1020', fundId: 'fund-mis', originalCurrency: 'USD', originalAmount: 20000n, exchangeRate: '15.5000', isDebit: true, description: '$200.00 Cash USD' },
      { id: 's4-l2', accountId: 'acct-4030', fundId: 'fund-mis', originalCurrency: 'GHS', originalAmount: 310000n, exchangeRate: '1.0000', isDebit: false, description: 'Foreign Missions Special Gift' },
    ],
  }),
];

export interface OpeningBalanceCommittedBatch {
  readonly batchNumber: string;
  readonly cutOverDate: string;
  readonly entryCount: number;
  readonly totalDebitGhs: bigint;
  readonly totalCreditGhs: bigint;
  readonly treasurerSignedBy: string;
  readonly pastorApprovedBy: string;
  readonly committedAt: string;
}

export interface GoLiveStatusState {
  readonly isLive: boolean;
  readonly wentLiveAt: string | null;
  readonly treasurerConfirmedBy: string | null;
  readonly pastorOrElderConfirmedBy: string | null;
  readonly demoModePermanentlyDisabled: boolean;
  readonly backupTaken: boolean;
  readonly lastBackupDate: string;
  readonly restoreTested: boolean;
  readonly lastRestoreTestDate: string;
  readonly parallelRunApproved: boolean;
  readonly parallelRunSummary: string;
  readonly approvalLimitsConfigured: boolean;
}

export interface StoredParallelRunPeriod {
  readonly rows: readonly OldBookBalanceInput[];
  readonly isApproved: boolean;
  readonly approvedByTreasurer?: string | null;
  readonly approvedAt?: string | null;
}

const INITIAL_PARALLEL_RUN_DATA: Record<string, StoredParallelRunPeriod> = {
  'per-2026-09': {
    rows: [
      { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 450000n },
      { accountCode: '1030', fundCode: 'GEN', oldBookBalanceGhs: 2850000n },
      { accountCode: '1050', fundCode: 'GEN', oldBookBalanceGhs: 620000n },
      { accountCode: '3010', fundCode: 'GEN', oldBookBalanceGhs: 3920000n },
      { accountCode: '1030', fundCode: 'BLD', oldBookBalanceGhs: 4200000n },
      { accountCode: '3020', fundCode: 'BLD', oldBookBalanceGhs: 4200000n },
    ],
    isApproved: true,
    approvedByTreasurer: 'Kofi Mensah (Treasurer)',
    approvedAt: '2026-10-05T14:30:00Z',
  },
  'per-2026-10': {
    rows: [
      { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 1180000n },
      { accountCode: '1030', fundCode: 'GEN', oldBookBalanceGhs: 2850000n },
      { accountCode: '1050', fundCode: 'GEN', oldBookBalanceGhs: 620000n },
      { accountCode: '3010', fundCode: 'GEN', oldBookBalanceGhs: 3920000n },
      { accountCode: '4010', fundCode: 'GEN', oldBookBalanceGhs: 850000n },
      { accountCode: '5020', fundCode: 'GEN', oldBookBalanceGhs: 120000n },
      { accountCode: '1030', fundCode: 'BLD', oldBookBalanceGhs: 4650000n },
      { accountCode: '3020', fundCode: 'BLD', oldBookBalanceGhs: 4200000n },
      { accountCode: '4040', fundCode: 'BLD', oldBookBalanceGhs: 450000n },
      { accountCode: '1020', fundCode: 'MIS', oldBookBalanceGhs: 310000n },
      { accountCode: '4030', fundCode: 'MIS', oldBookBalanceGhs: 310000n },
    ],
    isApproved: true,
    approvedByTreasurer: 'Kofi Mensah (Treasurer)',
    approvedAt: '2026-11-02T16:00:00Z',
  },
  'per-2026-11': {
    rows: [
      { accountCode: '1010', fundCode: 'GEN', oldBookBalanceGhs: 1200000n }, // 200.00 difference (oldBook 12,000 vs system 11,800)
      { accountCode: '1030', fundCode: 'GEN', oldBookBalanceGhs: 2850000n },
      { accountCode: '1050', fundCode: 'GEN', oldBookBalanceGhs: 620000n },
      { accountCode: '3010', fundCode: 'GEN', oldBookBalanceGhs: 3920000n },
      { accountCode: '4010', fundCode: 'GEN', oldBookBalanceGhs: 850000n },
      { accountCode: '5020', fundCode: 'GEN', oldBookBalanceGhs: 120000n },
      { accountCode: '1030', fundCode: 'BLD', oldBookBalanceGhs: 4650000n },
      { accountCode: '3020', fundCode: 'BLD', oldBookBalanceGhs: 4200000n },
      { accountCode: '4040', fundCode: 'BLD', oldBookBalanceGhs: 450000n },
      { accountCode: '1020', fundCode: 'MIS', oldBookBalanceGhs: 310000n },
      { accountCode: '4030', fundCode: 'MIS', oldBookBalanceGhs: 310000n },
    ],
    isApproved: false,
    approvedByTreasurer: null,
    approvedAt: null,
  },
};


const INITIAL_ROLE_TRAININGS: RoleTrainingRecord[] = [
  { userId: 'usr-001', userName: 'Kofi Mensah', role: 'Treasurer', trained: true, trainedDate: '2026-10-25' },
  { userId: 'usr-002', userName: 'Akosua Osei', role: 'Finance Secretary', trained: true, trainedDate: '2026-10-25' },
  { userId: 'usr-003', userName: 'Rev. Emmanuel Addo', role: 'Pastor / Elder', trained: true, trainedDate: '2026-10-26' },
  { userId: 'usr-004', userName: 'Kwame Boateng', role: 'Counter', trained: true, trainedDate: '2026-10-27' },
  { userId: 'usr-005', userName: 'Abena Poku', role: 'Counter', trained: true, trainedDate: '2026-10-27' },
  { userId: 'usr-006', userName: 'Justice Appiah, CA', role: 'Auditor', trained: true, trainedDate: '2026-10-28' },
  { userId: 'usr-007', userName: 'Yaw Kwarteng', role: 'Department Head', trained: true, trainedDate: '2026-10-29' },
  { userId: 'usr-008', userName: 'Kwabena Acheampong', role: 'Administrator', trained: true, trainedDate: '2026-10-29' },
];

const INITIAL_IMPORT_BATCHES: ImportBatchRecord[] = (() => {
  const membersTpl = getImportTemplate('MEMBERS');
  const membersParsed = parseGenericCsv(membersTpl.sampleCsv);
  const membersMap = buildDefaultColumnMapping(membersTpl, membersParsed.headers);

  const assetsTpl = getImportTemplate('FIXED_ASSETS');
  const assetsParsed = parseGenericCsv(assetsTpl.sampleCsv);
  const assetsMap = buildDefaultColumnMapping(assetsTpl, assetsParsed.headers);

  return [
    {
      id: 'imp-batch-1',
      batchNumber: 'IMP-0001',
      templateType: 'MEMBERS',
      fileName: 'calvary_crystal_members_cutover.csv',
      fileSha256: computeImportFileSha256(membersTpl.sampleCsv + '\n#seed-1'),
      columnMapping: membersMap,
      rowCount: 4,
      totalImpactGhs: 0n,
      status: 'COMMITTED',
      periodId: 'per-2026-10',
      createdJournalEntryIds: [],
      createdRecordIds: ['MEM-2026-101', 'MEM-2026-102', 'MEM-2026-103', 'MEM-2026-104'],
      mappedRows: membersParsed.rows,
      committedBy: 'Kofi Mensah',
      committedAt: '2026-10-28T09:30:00Z',
    },
    {
      id: 'imp-batch-2',
      batchNumber: 'IMP-0002',
      templateType: 'FIXED_ASSETS',
      fileName: 'calvary_crystal_fixed_assets_2026.csv',
      fileSha256: computeImportFileSha256(assetsTpl.sampleCsv + '\n#seed-2'),
      columnMapping: assetsMap,
      rowCount: 3,
      totalImpactGhs: 35000000n, // GHS 350,000.00 Net Book Value
      status: 'COMMITTED',
      periodId: 'per-2026-10',
      createdJournalEntryIds: [],
      createdRecordIds: ['AST-2026-001', 'AST-2026-002', 'AST-2026-003'],
      mappedRows: assetsParsed.rows,
      committedBy: 'Kofi Mensah',
      committedAt: '2026-10-29T14:15:00Z',
    },
  ];
})();

const INITIAL_GO_LIVE_STATE: GoLiveStatusState = {
  isLive: false,
  wentLiveAt: null,
  treasurerConfirmedBy: null,
  pastorOrElderConfirmedBy: null,
  demoModePermanentlyDisabled: false,
  backupTaken: true,
  lastBackupDate: '2026-10-30',
  restoreTested: true,
  lastRestoreTestDate: '2026-10-31',
  parallelRunApproved: true,
  parallelRunSummary: 'Parallel run: September agrees, October agrees (signed off by Kofi Mensah)',
  approvalLimitsConfigured: true,
};

interface LedgerContextType {
  accounts: Account[];
  funds: Fund[];
  financialYears: FinancialYear[];
  selectedFinancialYearId: string;
  selectedFinancialYear: FinancialYear;
  setSelectedFinancialYearId: (id: string) => void;
  showComparatives: boolean;
  setShowComparatives: (show: boolean) => void;
  fiscalYearStartMonth: number;
  hasAdjustmentPeriod: boolean;
  canEditFiscalYearStartMonth: boolean;
  updateFiscalYearConfig: (params: {
    startMonth: number;
    label: string;
    hasAdjustmentPeriod: boolean;
  }) => void;
  periods: AccountingPeriod[];
  currentYearPeriods: AccountingPeriod[];
  updatePeriodStatus: (periodId: string, nextStatus: PeriodStatus) => void;
  exchangeRates: ExchangeRate[];
  entries: JournalEntry[];
  trialBalance: TrialBalanceReport;
  doctorReport: DoctorReport;
  addEntry: (entry: JournalEntry) => void;
  addEntriesBatch: (entries: readonly JournalEntry[]) => void;
  openingBalanceBatch: OpeningBalanceCommittedBatch | null;
  recordOpeningBalanceBatch: (params: {
    entries: readonly JournalEntry[];
    cutOverDate: string;
    treasurerSignedBy: string;
    pastorApprovedBy: string;
  }) => void;
  importBatches: ImportBatchRecord[];
  commitImportBatch: (params: {
    templateType: ImportBatchRecord['templateType'];
    fileName: string;
    fileSha256: string;
    columnMapping: Record<string, string>;
    mappedRows: readonly Record<string, string>[];
    proposedJournalEntries: readonly JournalEntry[];
    totalImpactGhs: bigint;
    postGoLiveApprovedBy?: string;
    postGoLiveReason?: string;
  }) => ImportBatchRecord;
  reverseImportBatch: (batchId: string, reason: string) => ImportBatchRecord;
  goLiveState: GoLiveStatusState;
  roleTrainings: RoleTrainingRecord[];
  goLiveReadiness: GoLiveReadinessReport;
  markRoleTrained: (userId: string, trained: boolean, trainedDate?: string) => void;
  recordBackupAndRestoreTest: (type: 'BACKUP' | 'RESTORE_TEST') => void;
  updateGoLiveFlags: (patch: Partial<GoLiveStatusState>) => void;
  confirmGoLive: (params: {
    treasurerName: string;
    pastorOrElderName: string;
    permanentlyDisableDemoMode: boolean;
  }) => void;
  parallelRunData: Record<string, StoredParallelRunPeriod>;
  getParallelRunComparison: (periodId: string) => {
    summary: ParallelRunMonthSummary;
    rows: readonly ParallelRunComparisonRow[];
  };
  saveParallelRunMonthRows: (periodId: string, rows: readonly OldBookBalanceInput[]) => void;
  updateParallelRunRowExplanation: (
    periodId: string,
    accountCode: string,
    fundCode: string,
    explanation: string
  ) => void;
  signOffParallelRunMonthAction: (periodId: string, treasurerName: string) => ParallelRunMonthSummary;
  parallelRunOverall: ParallelRunOverallReport;
  reverseEntry: (originalId: string, reason: string) => JournalEntry;
  runDoctor: () => DoctorReport;
  simulateCorruption: (type: 'sign_flip' | 'digit_transposition' | 'sync_gap' | 'unbalanced') => void;
  resetLedger: () => void;

  // Year-End Close & Accruals (Spec Section A2, A3, A4 & D3)
  yearEndChecklistOverrides: YearEndOverride[];
  overrideYearEndCheck: (key: YearEndCheckKey, reason: string) => void;
  executeYearEndClose: (params: {
    pastorApproverName: string;
    auditorSignOffName?: string;
  }) => YearEndCloseRunResult;
  reopenYearForAdjustment: (params: {
    yearId: string;
    pastorApproverName: string;
    reason: string;
  }) => void;
  latestDeltaNotice: BroughtForwardDeltaNotice | null;
  dismissDeltaNotice: () => void;
  issuedYearEndPacks: Record<string, IssuedYearEndPack>;
  accrualEntries: AccrualPrepaymentEntry[];
  postAccrualPrepayment: (accrual: {
    type: AccrualPrepaymentEntry['type'];
    description: string;
    debitAccountId: string;
    creditAccountId: string;
    amountPesewas: bigint;
    fundId: string;
  }) => void;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isDemoMode, demoDataset, demoResetKey, markDemoChanged } = useDemo();
  const [accounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [funds] = useState<Fund[]>(INITIAL_FUNDS);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>(() =>
    loadFromStore('financial_years', isDemoMode, INITIAL_FINANCIAL_YEARS)
  );
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<string>('fy-2026');
  const [showComparatives, setShowComparatives] = useState<boolean>(false);
  const [periods, setPeriods] = useState<AccountingPeriod[]>(() =>
    loadFromStore('periods', isDemoMode, INITIAL_PERIODS)
  );
  const [exchangeRates] = useState<ExchangeRate[]>(INITIAL_EXCHANGE_RATES);
  const [openingBalanceBatch, setOpeningBalanceBatch] = useState<OpeningBalanceCommittedBatch | null>(() =>
    loadFromStore('opening_balance_batch', isDemoMode, {
      batchNumber: 'IMP-OB-0001',
      cutOverDate: '2026-01-01',
      entryCount: 3,
      totalDebitGhs: 43500000n,
      totalCreditGhs: 43500000n,
      treasurerSignedBy: 'Kofi Mensah (Treasurer)',
      pastorApprovedBy: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
      committedAt: '2026-10-25T10:00:00Z',
    })
  );
  const [importBatches, setImportBatches] = useState<ImportBatchRecord[]>(() =>
    loadFromStore('import_batches', isDemoMode, INITIAL_IMPORT_BATCHES)
  );
  const [roleTrainings, setRoleTrainings] = useState<RoleTrainingRecord[]>(() =>
    loadFromStore('role_trainings', isDemoMode, INITIAL_ROLE_TRAININGS)
  );
  const [goLiveState, setGoLiveState] = useState<GoLiveStatusState>(() =>
    loadFromStore('go_live_state', isDemoMode, INITIAL_GO_LIVE_STATE)
  );
  const [parallelRunData, setParallelRunData] = useState<Record<string, StoredParallelRunPeriod>>(() =>
    loadFromStore('parallel_run_data', isDemoMode, INITIAL_PARALLEL_RUN_DATA)
  );

  const [yearEndChecklistOverrides, setYearEndChecklistOverrides] = useState<YearEndOverride[]>(() =>
    loadFromStore('year_end_overrides', isDemoMode, [])
  );
  const [issuedYearEndPacks, setIssuedYearEndPacks] = useState<Record<string, IssuedYearEndPack>>(() =>
    loadFromStore('issued_year_end_packs', isDemoMode, {})
  );
  const [latestDeltaNotice, setLatestDeltaNotice] = useState<BroughtForwardDeltaNotice | null>(() =>
    loadFromStore('latest_delta_notice', isDemoMode, null)
  );
  const [accrualEntries, setAccrualEntries] = useState<AccrualPrepaymentEntry[]>(() =>
    loadFromStore('accrual_entries', isDemoMode, [])
  );

  const [entries, setEntries] = useState<JournalEntry[]>(() =>
    loadFromStore('entries', isDemoMode, isDemoMode ? (demoDataset.entries as JournalEntry[]) : createSeedEntries())
  );

  // Reload state from database partition on mode switch or demo reset (Section 5.1)
  React.useEffect(() => {
    setEntries(
      loadFromStore('entries', isDemoMode, isDemoMode ? (demoDataset.entries as JournalEntry[]) : createSeedEntries())
    );
    setFinancialYears(loadFromStore('financial_years', isDemoMode, INITIAL_FINANCIAL_YEARS));
    setPeriods(loadFromStore('periods', isDemoMode, INITIAL_PERIODS));
    setOpeningBalanceBatch(
      loadFromStore('opening_balance_batch', isDemoMode, {
        batchNumber: 'IMP-OB-0001',
        cutOverDate: '2026-01-01',
        entryCount: 3,
        totalDebitGhs: 43500000n,
        totalCreditGhs: 43500000n,
        treasurerSignedBy: 'Kofi Mensah (Treasurer)',
        pastorApprovedBy: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
        committedAt: '2026-10-25T10:00:00Z',
      })
    );
    setImportBatches(loadFromStore('import_batches', isDemoMode, INITIAL_IMPORT_BATCHES));
    setRoleTrainings(loadFromStore('role_trainings', isDemoMode, INITIAL_ROLE_TRAININGS));
    setGoLiveState(loadFromStore('go_live_state', isDemoMode, INITIAL_GO_LIVE_STATE));
    setParallelRunData(loadFromStore('parallel_run_data', isDemoMode, INITIAL_PARALLEL_RUN_DATA));
  }, [isDemoMode, demoResetKey]);

  const selectedFinancialYear =
    financialYears.find((fy) => fy.id === selectedFinancialYearId) ?? financialYears[0]!;

  const currentYearPeriods = periods.filter(
    (p) => (p.financialYearId ?? 'fy-2026') === selectedFinancialYear.id
  );

  const canEditFiscalYearStartMonth = canChangeFiscalYearStartMonth(entries.length).allowed;

  const updateFiscalYearConfig = useCallback(
    (params: { startMonth: number; label: string; hasAdjustmentPeriod: boolean }) => {
      if (params.startMonth !== selectedFinancialYear.startMonth && !canEditFiscalYearStartMonth) {
        throw new Error(
          'The financial year start month cannot be changed after the first journal entry has been posted.'
        );
      }

      const startYearNum = Number(params.label.replace(/\D/g, '')) || 2026;
      const regenerated = generateFinancialYearWithPeriods({
        id: selectedFinancialYear.id,
        branchId: selectedFinancialYear.branchId,
        label: params.label,
        startYear: startYearNum,
        startMonth: params.startMonth,
        hasAdjustmentPeriod: params.hasAdjustmentPeriod,
        initialClosedMonthsCount: 9,
      });

      setFinancialYears((prev) => {
        const next = prev.map((fy) =>
          fy.id === selectedFinancialYear.id ? regenerated.financialYear : fy
        );
        saveToStore('financial_years', isDemoMode, next);
        return next;
      });

      setPeriods((prev) => {
        const others = prev.filter((p) => (p.financialYearId ?? 'fy-2026') !== selectedFinancialYear.id);
        const next = [...regenerated.periods, ...others];
        saveToStore('periods', isDemoMode, next);
        return next;
      });
    },
    [selectedFinancialYear, canEditFiscalYearStartMonth, isDemoMode]
  );

  const updatePeriodStatus = useCallback(
    (periodId: string, nextStatus: PeriodStatus) => {
      setPeriods((prev) => {
        const next = prev.map((p) =>
          p.id === periodId
            ? transitionPeriodStatus({
                period: p,
                nextStatus,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              })
            : p
        );
        saveToStore('periods', isDemoMode, next);
        return next;
      });
    },
    [currentUser.fullName, currentUser.role, isDemoMode]
  );

  const effectiveEntries = entries;

  const trialBalance = calculateTrialBalance(effectiveEntries, accounts, funds);
  const doctorReport = diagnoseLedger({
    entries: effectiveEntries,
    accounts,
    funds,
    periods,
    exchangeRates,
  });

  const addEntry = useCallback((entry: JournalEntry) => {
    setEntries((prev) => {
      const next = [entry, ...prev];
      saveToStore('entries', isDemoMode, next);
      return next;
    });
    if (isDemoMode) {
      markDemoChanged();
    }
  }, [isDemoMode, markDemoChanged]);

  const addEntriesBatch = useCallback(
    (newEntries: readonly JournalEntry[]) => {
      setEntries((prev) => {
        const next = [...newEntries, ...prev];
        saveToStore('entries', isDemoMode, next);
        return next;
      });
      if (isDemoMode) {
        markDemoChanged();
      }
    },
    [isDemoMode, markDemoChanged]
  );

  const recordOpeningBalanceBatch = useCallback(
    (params: {
      entries: readonly JournalEntry[];
      cutOverDate: string;
      treasurerSignedBy: string;
      pastorApprovedBy: string;
    }) => {
      addEntriesBatch(params.entries);
      let totalDebitGhs = 0n;
      let totalCreditGhs = 0n;
      for (const e of params.entries) {
        totalDebitGhs += e.totalDebitGhs;
        totalCreditGhs += e.totalCreditGhs;
      }
      const batchRecord: OpeningBalanceCommittedBatch = {
        batchNumber: 'IMP-OB-0001',
        cutOverDate: params.cutOverDate,
        entryCount: params.entries.length,
        totalDebitGhs,
        totalCreditGhs,
        treasurerSignedBy: params.treasurerSignedBy,
        pastorApprovedBy: params.pastorApprovedBy,
        committedAt: new Date().toISOString(),
      };
      setOpeningBalanceBatch(batchRecord);
      saveToStore('opening_balance_batch', isDemoMode, batchRecord);
    },
    [addEntriesBatch, isDemoMode]
  );

  const commitImportBatch = useCallback(
    (params: {
      templateType: ImportBatchRecord['templateType'];
      fileName: string;
      fileSha256: string;
      columnMapping: Record<string, string>;
      mappedRows: readonly Record<string, string>[];
      proposedJournalEntries: readonly JournalEntry[];
      totalImpactGhs: bigint;
      postGoLiveApprovedBy?: string;
      postGoLiveReason?: string;
    }) => {
      if (goLiveState.isLive && (!params.postGoLiveReason?.trim() || !params.postGoLiveApprovedBy?.trim())) {
        throw new Error(
          'Setup window is closed: After go-live, imports require the Treasurer, a written reason, and Pastor/Elder approval.'
        );
      }

      const nextIndex = importBatches.length + 1;
      const batchNumber = `IMP-${String(nextIndex).padStart(4, '0')}`;

      if (params.proposedJournalEntries.length > 0) {
        addEntriesBatch(params.proposedJournalEntries);
      }

      const openPeriod =
        currentYearPeriods.find((p) => !p.isClosed && p.status !== 'CLOSED') ?? currentYearPeriods[0];

      const recordIds = params.mappedRows.map(
        (r, idx) =>
          r.memberNumber ||
          r.assetTag ||
          r.documentNumber ||
          `${batchNumber}-R${String(idx + 1).padStart(3, '0')}`
      );

      const createdBatch: ImportBatchRecord = {
        id: `imp-batch-${Date.now()}`,
        batchNumber,
        templateType: params.templateType,
        fileName: params.fileName,
        fileSha256: params.fileSha256,
        columnMapping: params.columnMapping,
        rowCount: params.mappedRows.length,
        totalImpactGhs: params.totalImpactGhs,
        status: 'COMMITTED',
        periodId: openPeriod?.id ?? 'per-2026-10',
        createdJournalEntryIds: params.proposedJournalEntries.map((e) => e.id),
        createdRecordIds: recordIds,
        mappedRows: params.mappedRows,
        committedBy: currentUser.fullName,
        committedAt: new Date().toISOString(),
        postGoLiveApprovedBy: params.postGoLiveApprovedBy ?? null,
        postGoLiveReason: params.postGoLiveReason ?? null,
      };

      setImportBatches((prev) => {
        const next = [createdBatch, ...prev];
        saveToStore('import_batches', isDemoMode, next);
        return next;
      });

      return createdBatch;
    },
    [goLiveState.isLive, importBatches.length, addEntriesBatch, currentYearPeriods, currentUser.fullName, isDemoMode]
  );

  const reverseImportBatch = useCallback(
    (batchId: string, reason: string) => {
      const target = importBatches.find((b) => b.id === batchId || b.batchNumber === batchId);
      if (!target) {
        throw new Error(`Import batch ${batchId} not found.`);
      }
      const period = periods.find((p) => p.id === target.periodId) ?? null;

      const { updatedBatch, reversalEntries } = reverseImportBatchDomain({
        batch: target,
        period,
        existingEntries: entries,
        reversedBy: currentUser.fullName,
        reversalReason: reason,
        deviceId: currentUser.deviceId,
      });

      if (reversalEntries.length > 0) {
        addEntriesBatch(reversalEntries);
      }

      setImportBatches((prev) => {
        const next = prev.map((b) => (b.id === target.id ? updatedBatch : b));
        saveToStore('import_batches', isDemoMode, next);
        return next;
      });

      return updatedBatch;
    },
    [importBatches, periods, entries, currentUser.fullName, currentUser.deviceId, addEntriesBatch, isDemoMode]
  );

  const markRoleTrained = useCallback(
    (userId: string, trained: boolean, trainedDate?: string) => {
      setRoleTrainings((prev) => {
        const next = prev.map((r) =>
          r.userId === userId
            ? {
                ...r,
                trained,
                trainedDate: trained ? trainedDate || new Date().toISOString().slice(0, 10) : null,
              }
            : r
        );
        saveToStore('role_trainings', isDemoMode, next);
        return next;
      });
    },
    [isDemoMode]
  );

  const recordBackupAndRestoreTest = useCallback(
    (type: 'BACKUP' | 'RESTORE_TEST') => {
      const todayStr = new Date().toISOString().slice(0, 10);
      setGoLiveState((prev) => {
        const next: GoLiveStatusState =
          type === 'BACKUP'
            ? { ...prev, backupTaken: true, lastBackupDate: todayStr }
            : { ...prev, restoreTested: true, lastRestoreTestDate: todayStr };
        saveToStore('go_live_state', isDemoMode, next);
        return next;
      });
    },
    [isDemoMode]
  );

  const updateGoLiveFlags = useCallback(
    (patch: Partial<GoLiveStatusState>) => {
      setGoLiveState((prev) => {
        const next = { ...prev, ...patch };
        saveToStore('go_live_state', isDemoMode, next);
        return next;
      });
    },
    [isDemoMode]
  );

  const getParallelRunComparison = useCallback(
    (periodId: string) => {
      const period = periods.find((p) => p.id === periodId) ?? currentYearPeriods[0] ?? periods[0]!;
      const stored = parallelRunData[period.id] ?? {
        rows: [],
        isApproved: false,
        approvedByTreasurer: null,
        approvedAt: null,
      };

      return compareParallelRunMonth({
        periodId: period.id,
        periodLabel: `${getMonthName(period.month)} ${period.year}`,
        asOfDate: period.endDate,
        oldBookRows: stored.rows,
        entries,
        accounts,
        funds,
        isApproved: stored.isApproved,
        approvedByTreasurer: stored.approvedByTreasurer,
        approvedAt: stored.approvedAt,
      });
    },
    [periods, currentYearPeriods, parallelRunData, entries, accounts, funds]
  );

  const parallelRunOverall = useMemo(() => {
    const comparedPeriods = currentYearPeriods
      .filter((p) => !p.isAdjustmentPeriod && (p.month === 9 || p.month === 10 || p.month === 11));

    const monthSummaries = comparedPeriods.map((p) => {
      const cmp = getParallelRunComparison(p.id);
      return cmp.summary;
    });

    return evaluateParallelRunOverall({
      months: monthSummaries,
      requiredMonthEnds: 2,
    });
  }, [currentYearPeriods, getParallelRunComparison]);

  const saveParallelRunMonthRows = useCallback(
    (periodId: string, rows: readonly OldBookBalanceInput[]) => {
      setParallelRunData((prev) => {
        const next = {
          ...prev,
          [periodId]: {
            rows: [...rows],
            isApproved: false,
            approvedByTreasurer: null,
            approvedAt: null,
          },
        };
        saveToStore('parallel_run_data', isDemoMode, next);
        return next;
      });
    },
    [isDemoMode]
  );

  const updateParallelRunRowExplanation = useCallback(
    (periodId: string, accountCode: string, fundCode: string, explanation: string) => {
      setParallelRunData((prev) => {
        const current = prev[periodId] ?? { rows: [], isApproved: false };
        const updatedRows = current.rows.map((r) =>
          r.accountCode === accountCode && r.fundCode.toUpperCase() === fundCode.toUpperCase()
            ? { ...r, explanation: explanation.trim() }
            : r
        );
        const next = {
          ...prev,
          [periodId]: {
            ...current,
            rows: updatedRows,
          },
        };
        saveToStore('parallel_run_data', isDemoMode, next);
        return next;
      });
    },
    [isDemoMode]
  );

  const signOffParallelRunMonthAction = useCallback(
    (periodId: string, treasurerName: string) => {
      const cmp = getParallelRunComparison(periodId);
      const signedSummary = signOffParallelRunMonth({
        summary: cmp.summary,
        treasurerName,
        actorRole: currentUser.role,
      });

      setParallelRunData((prev) => {
        const current = prev[periodId] ?? { rows: [] };
        const next = {
          ...prev,
          [periodId]: {
            rows: current.rows,
            isApproved: true,
            approvedByTreasurer: signedSummary.approvedByTreasurer,
            approvedAt: signedSummary.approvedAt,
          },
        };
        saveToStore('parallel_run_data', isDemoMode, next);
        return next;
      });

      return signedSummary;
    },
    [getParallelRunComparison, currentUser.role, isDemoMode]
  );

  const goLiveReadiness = evaluateGoLiveReadiness({
    isLive: goLiveState.isLive,
    wentLiveAt: goLiveState.wentLiveAt,
    treasurerConfirmedBy: goLiveState.treasurerConfirmedBy,
    pastorOrElderConfirmedBy: goLiveState.pastorOrElderConfirmedBy,
    demoModePermanentlyDisabled: goLiveState.demoModePermanentlyDisabled,
    churchProfileComplete: true,
    churchName: 'Calvary Crystal Church',
    fiscalYearLabel: selectedFinancialYear.label,
    chartOfAccountsReviewed: true,
    activeAccountCount: accounts.filter((a) => a.isActive).length,
    fundsConfigured: true,
    activeFundCount: funds.filter((f) => f.isActive).length,
    bankMomoCashConfigured: true,
    cashAndBankAccountCount: accounts.filter((a) => a.isBankOrCash && a.isActive).length,
    remittanceRuleConfigured: true,
    remittanceRuleSummary: '15% of Tithes to Headquarters (Denominational Remittances Payable)',
    exchangeRateEntered: exchangeRates.length > 0,
    latestUsdRate: exchangeRates[0]?.rate ?? '15.5000',
    latestUsdRateDate: exchangeRates[0]?.rateDate ?? '2026-10-01',
    openingBalancesPostedAndBalanced: Boolean(openingBalanceBatch) && trialBalance.isBalanced,
    openingBalanceBatchNumber: openingBalanceBatch?.batchNumber ?? 'IMP-OB-0001',
    openingBankReconciliationsSignedOff: true,
    openingCashCountsSignedOff: true,
    fixedAssetRegisterReconciled: true,
    usersCreatedAndMfaEnrolled: true,
    mfaEnrolledCount: 5,
    mfaRequiredCount: 5,
    approvalLimitsConfigured: goLiveState.approvalLimitsConfigured,
    roleTrainings,
    backupTaken: goLiveState.backupTaken,
    lastBackupDate: goLiveState.lastBackupDate,
    restoreTested: goLiveState.restoreTested,
    lastRestoreTestDate: goLiveState.lastRestoreTestDate,
    parallelRunApproved: parallelRunOverall.isParallelRunComplete,
    parallelRunSummary: parallelRunOverall.summaryLine,
    isDemoModeActive: isDemoMode,
  });

  const confirmGoLive = useCallback(
    (params: {
      treasurerName: string;
      pastorOrElderName: string;
      permanentlyDisableDemoMode: boolean;
    }) => {
      const confirmed = confirmGoLiveTransition({
        readiness: goLiveReadiness,
        treasurerName: params.treasurerName,
        pastorOrElderName: params.pastorOrElderName,
        permanentlyDisableDemoMode: params.permanentlyDisableDemoMode,
      });

      setGoLiveState((prev) => {
        const next: GoLiveStatusState = {
          ...prev,
          isLive: true,
          wentLiveAt: confirmed.wentLiveAt,
          treasurerConfirmedBy: confirmed.treasurerConfirmedBy,
          pastorOrElderConfirmedBy: confirmed.pastorOrElderConfirmedBy,
          demoModePermanentlyDisabled: confirmed.demoModePermanentlyDisabled,
        };
        saveToStore('go_live_state', isDemoMode, next);
        return next;
      });
    },
    [goLiveReadiness, isDemoMode]
  );

  const reverseEntry = useCallback(
    (originalId: string, reason: string) => {
      const orig = entries.find((e) => e.id === originalId);
      if (!orig) throw new Error('Original entry not found');

      const revDocNum = `REV-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;
      const reversal = createReversalEntry({
        reversalEntryId: `rev-${Date.now()}`,
        originalEntry: orig,
        documentNumber: revDocNum,
        reversalDate: new Date().toISOString().slice(0, 10),
        reason,
        reversedBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
      });

      setEntries((prev) => {
        const next = [reversal, ...prev];
        saveToStore('entries', isDemoMode, next);
        return next;
      });
      if (isDemoMode) {
        markDemoChanged();
      }
      return reversal;
    },
    [entries, currentUser, isDemoMode, markDemoChanged]
  );

  const runDoctor = useCallback(() => {
    return diagnoseLedger({
      entries,
      accounts,
      funds,
      periods,
      exchangeRates,
    });
  }, [entries, accounts, funds, periods, exchangeRates]);

  const simulateCorruption = useCallback(
    (type: 'sign_flip' | 'digit_transposition' | 'sync_gap' | 'unbalanced') => {
      if (!isDemoMode) {
        throw new Error('Ledger corruption simulation is strictly disabled in live mode.');
      }
      if (type === 'sign_flip') {
        // Line of GHS 500 (50,000p) posted as Debit instead of Credit -> Diff = 100,000p (GHS 1,000)
        const corruptEntry: JournalEntry = {
          id: `corrupt-flip-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: 'JE-SIM-FLIP',
          entryDate: new Date().toISOString().slice(0, 10),
          entryType: 'STANDARD',
          narration: 'SIMULATED: Sign Inversion on Cash line',
          lineCount: 2,
          totalDebitGhs: 150000n,
          totalCreditGhs: 50000n,
          isReversal: false,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          createdAt: new Date().toISOString(),
          lines: [
            { id: 'c1', journalEntryId: 'corrupt-flip', accountId: 'acct-1010', fundId: 'fund-gen', lineNumber: 1, originalCurrency: 'GHS', originalAmount: 150000n, exchangeRate: '1.0000', debitAmountGhs: 150000n, creditAmountGhs: 0n, roundingDifferencePesewas: 0n },
            { id: 'c2', journalEntryId: 'corrupt-flip', accountId: 'acct-4010', fundId: 'fund-gen', lineNumber: 2, originalCurrency: 'GHS', originalAmount: 50000n, exchangeRate: '1.0000', debitAmountGhs: 0n, creditAmountGhs: 50000n, roundingDifferencePesewas: 0n },
          ],
        };
        setEntries((prev) => [corruptEntry, ...prev]);
      } else if (type === 'digit_transposition') {
        // 5400 vs 4500 (diff 900 pesewas, divisible by 9)
        const transEntry: JournalEntry = {
          id: `corrupt-trans-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: 'JE-SIM-TRANS',
          entryDate: new Date().toISOString().slice(0, 10),
          entryType: 'STANDARD',
          narration: 'SIMULATED: Digit Transposition (54 vs 45)',
          lineCount: 2,
          totalDebitGhs: 5400n,
          totalCreditGhs: 4500n,
          isReversal: false,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          createdAt: new Date().toISOString(),
          lines: [
            { id: 't1', journalEntryId: 'corrupt-trans', accountId: 'acct-1010', fundId: 'fund-gen', lineNumber: 1, originalCurrency: 'GHS', originalAmount: 5400n, exchangeRate: '1.0000', debitAmountGhs: 5400n, creditAmountGhs: 0n, roundingDifferencePesewas: 0n },
            { id: 't2', journalEntryId: 'corrupt-trans', accountId: 'acct-4010', fundId: 'fund-gen', lineNumber: 2, originalCurrency: 'GHS', originalAmount: 4500n, exchangeRate: '1.0000', debitAmountGhs: 0n, creditAmountGhs: 4500n, roundingDifferencePesewas: 0n },
          ],
        };
        setEntries((prev) => [transEntry, ...prev]);
      } else if (type === 'sync_gap') {
        const syncGapEntry: JournalEntry = {
          id: `corrupt-sync-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: 'JE-SIM-SYNCGAP',
          entryDate: new Date().toISOString().slice(0, 10),
          entryType: 'STANDARD',
          narration: 'SIMULATED: Interrupted sync (missing lines)',
          lineCount: 4, // Expects 4 lines
          totalDebitGhs: 20000n,
          totalCreditGhs: 20000n,
          isReversal: false,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          createdAt: new Date().toISOString(),
          lines: [
            // Only 1 line synced
            { id: 'sg1', journalEntryId: 'corrupt-sync', accountId: 'acct-1010', fundId: 'fund-gen', lineNumber: 1, originalCurrency: 'GHS', originalAmount: 10000n, exchangeRate: '1.0000', debitAmountGhs: 10000n, creditAmountGhs: 0n, roundingDifferencePesewas: 0n },
          ],
        };
        setEntries((prev) => [syncGapEntry, ...prev]);
      } else if (type === 'unbalanced') {
        const unbalEntry: JournalEntry = {
          id: `corrupt-unbal-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: 'JE-SIM-UNBAL',
          entryDate: new Date().toISOString().slice(0, 10),
          entryType: 'STANDARD',
          narration: 'SIMULATED: Unbalanced Entry (Dr: 8,000, Cr: 5,000)',
          lineCount: 2,
          totalDebitGhs: 8000n,
          totalCreditGhs: 5000n,
          isReversal: false,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          createdAt: new Date().toISOString(),
          lines: [
            { id: 'u1', journalEntryId: 'corrupt-unbal', accountId: 'acct-1010', fundId: 'fund-gen', lineNumber: 1, originalCurrency: 'GHS', originalAmount: 8000n, exchangeRate: '1.0000', debitAmountGhs: 8000n, creditAmountGhs: 0n, roundingDifferencePesewas: 0n },
            { id: 'u2', journalEntryId: 'corrupt-unbal', accountId: 'acct-4010', fundId: 'fund-gen', lineNumber: 2, originalCurrency: 'GHS', originalAmount: 5000n, exchangeRate: '1.0000', debitAmountGhs: 0n, creditAmountGhs: 5000n, roundingDifferencePesewas: 0n },
          ],
        };
        setEntries((prev) => [unbalEntry, ...prev]);
      }
    },
    [currentUser, isDemoMode]
  );

  const resetLedger = useCallback(() => {
    if (!isDemoMode) {
      throw new Error('Ledger reset is strictly disabled in live mode.');
    }
    const cleanEntries = (demoDataset.entries as JournalEntry[]).filter(
      (e) => !e.id.includes('corrupt') && e.id !== 'demo-je-rounding'
    );
    setEntries(cleanEntries);
    saveToStore('entries', true, cleanEntries);
  }, [isDemoMode, demoDataset.entries]);

  const overrideYearEndCheck = useCallback(
    (key: YearEndCheckKey, reason: string) => {
      const override: YearEndOverride = {
        checkKey: key,
        reason,
        overriddenByTreasurerId: currentUser.id,
        overriddenByTreasurerName: `${currentUser.fullName} (${currentUser.role})`,
        timestamp: new Date().toISOString(),
      };
      setYearEndChecklistOverrides((prev) => {
        const next = [...prev.filter((o) => o.checkKey !== key), override];
        saveToStore('year_end_overrides', isDemoMode, next);
        return next;
      });
    },
    [currentUser, isDemoMode]
  );

  const executeYearEndClose = useCallback(
    (params: {
      pastorApproverName: string;
      auditorSignOffName?: string;
    }): YearEndCloseRunResult => {
      const preview = generateYearEndClosingPreview({
        financialYearId: selectedFinancialYear.id,
        yearLabel: selectedFinancialYear.label,
        branchId: selectedFinancialYear.branchId,
        effectiveClosingDate: selectedFinancialYear.endDate,
        accounts,
        funds,
        entries,
      });

      const closingEntries = generateYearEndClosingEntries({
        financialYearId: selectedFinancialYear.id,
        yearLabel: selectedFinancialYear.label,
        branchId: selectedFinancialYear.branchId,
        effectiveClosingDate: selectedFinancialYear.endDate,
        accounts,
        funds,
        entries,
        executedByTreasurer: `${currentUser.fullName} (${currentUser.role})`,
      });

      const issuedPack = generateIssuedYearEndPack({
        financialYearId: selectedFinancialYear.id,
        yearLabel: selectedFinancialYear.label,
        generatedBy: `${currentUser.fullName} (${currentUser.role})`,
        preview,
        overridesCount: yearEndChecklistOverrides.length,
      });

      const now = new Date().toISOString();

      setEntries((prev) => {
        const next = [...closingEntries, ...prev];
        saveToStore('entries', isDemoMode, next);
        return next;
      });

      setFinancialYears((prev) => {
        const next = prev.map((fy) =>
          fy.id === selectedFinancialYear.id
            ? {
                ...fy,
                status: 'LOCKED' as const,
                lockedAt: now,
                lockedBy: `${currentUser.fullName} (${currentUser.role})`,
              }
            : fy
        );
        saveToStore('financial_years', isDemoMode, next);
        return next;
      });

      setIssuedYearEndPacks((prev) => {
        const next = { ...prev, [selectedFinancialYear.id]: issuedPack };
        saveToStore('issued_year_end_packs', isDemoMode, next);
        return next;
      });

      const result: YearEndCloseRunResult = {
        financialYearId: selectedFinancialYear.id,
        yearLabel: selectedFinancialYear.label,
        closingEntries,
        signOff: {
          executedByTreasurerId: currentUser.id,
          executedByTreasurerName: currentUser.fullName,
          executedAt: now,
          approvedByPastorId: 'pastor-001',
          approvedByPastorName: params.pastorApproverName,
          approvedAt: now,
          auditorSignOffName: params.auditorSignOffName,
          auditorSignOffAt: params.auditorSignOffName ? now : null,
        },
        issuedPackId: issuedPack.id,
        lockedAt: now,
      };

      return result;
    },
    [selectedFinancialYear, accounts, funds, entries, currentUser, isDemoMode, yearEndChecklistOverrides]
  );

  const reopenYearForAdjustment = useCallback(
    (params: { yearId: string; pastorApproverName: string; reason: string }) => {
      const now = new Date().toISOString();
      setFinancialYears((prev) => {
        const next = prev.map((fy) =>
          fy.id === params.yearId
            ? {
                ...fy,
                status: 'REOPENED_ADJUSTMENT_ONLY' as const,
                reopenedAt: now,
                reopenedBy: `${currentUser.fullName} (${currentUser.role})`,
                reopenApprovedBy: params.pastorApproverName,
                reopenReason: params.reason,
              }
            : fy
        );
        saveToStore('financial_years', isDemoMode, next);
        return next;
      });

      setPeriods((prev) => {
        const next = prev.map((p) =>
          p.financialYearId === params.yearId && p.isAdjustmentPeriod
            ? { ...p, status: 'OPEN' as const, isClosed: false }
            : p
        );
        saveToStore('periods', isDemoMode, next);
        return next;
      });
    },
    [currentUser, isDemoMode]
  );

  const dismissDeltaNotice = useCallback(() => {
    setLatestDeltaNotice(null);
    saveToStore('latest_delta_notice', isDemoMode, null);
  }, [isDemoMode]);

  const postAccrualPrepayment = useCallback(
    (accrual: {
      type: AccrualPrepaymentEntry['type'];
      description: string;
      debitAccountId: string;
      creditAccountId: string;
      amountPesewas: bigint;
      fundId: string;
    }) => {
      const now = new Date().toISOString();
      const accrualId = `accrual-${Date.now()}`;
      const yearEnd = selectedFinancialYear.endDate;
      const nextYearStart = `${parseInt(yearEnd.slice(0, 4), 10) + 1}-01-01`;

      const newAccrual: AccrualPrepaymentEntry = {
        id: accrualId,
        type: accrual.type,
        date: yearEnd,
        autoReverseDate: nextYearStart,
        description: accrual.description,
        debitAccountId: accrual.debitAccountId,
        creditAccountId: accrual.creditAccountId,
        amountPesewas: accrual.amountPesewas,
        fundId: accrual.fundId,
        createdBy: `${currentUser.fullName} (${currentUser.role})`,
        createdAt: now,
      };

      setAccrualEntries((prev) => {
        const next = [newAccrual, ...prev];
        saveToStore('accrual_entries', isDemoMode, next);
        return next;
      });

      const adjEntryId = `je-${accrualId}`;
      const adjEntry: JournalEntry = {
        id: adjEntryId,
        branchId: selectedFinancialYear.branchId,
        documentNumber: `ADJ-${accrualId.slice(-6).toUpperCase()}`,
        entryDate: yearEnd,
        narration: `Accrual/Prepayment: ${accrual.description}`,
        entryType: 'ACCRUAL_PREPAYMENT',
        lineCount: 2,
        totalDebitGhs: accrual.amountPesewas,
        totalCreditGhs: accrual.amountPesewas,
        isReversal: false,
        deviceId: 'device-treasurer-main',
        lines: [
          {
            id: `l-${adjEntryId}-1`,
            journalEntryId: adjEntryId,
            accountId: accrual.debitAccountId,
            fundId: accrual.fundId,
            lineNumber: 1,
            originalCurrency: 'GHS',
            originalAmount: accrual.amountPesewas,
            exchangeRate: '1.0000',
            debitAmountGhs: accrual.amountPesewas,
            creditAmountGhs: 0n,
            roundingDifferencePesewas: 0n,
            description: accrual.description,
          },
          {
            id: `l-${adjEntryId}-2`,
            journalEntryId: adjEntryId,
            accountId: accrual.creditAccountId,
            fundId: accrual.fundId,
            lineNumber: 2,
            originalCurrency: 'GHS',
            originalAmount: accrual.amountPesewas,
            exchangeRate: '1.0000',
            debitAmountGhs: 0n,
            creditAmountGhs: accrual.amountPesewas,
            roundingDifferencePesewas: 0n,
            description: accrual.description,
          },
        ],
        createdAt: now,
        createdBy: `${currentUser.fullName} (${currentUser.role})`,
      };

      const revEntry = generateAccrualDayOneReversal(newAccrual, selectedFinancialYear.branchId);

      setEntries((prev) => {
        const next = [adjEntry, revEntry, ...prev];
        saveToStore('entries', isDemoMode, next);
        return next;
      });
    },
    [selectedFinancialYear, currentUser, isDemoMode]
  );

  return (
    <LedgerContext.Provider
      value={{
        accounts,
        funds,
        financialYears,
        selectedFinancialYearId,
        selectedFinancialYear,
        setSelectedFinancialYearId,
        showComparatives,
        setShowComparatives,
        fiscalYearStartMonth: selectedFinancialYear.startMonth,
        hasAdjustmentPeriod: selectedFinancialYear.hasAdjustmentPeriod,
        canEditFiscalYearStartMonth,
        updateFiscalYearConfig,
        periods,
        currentYearPeriods,
        updatePeriodStatus,
        exchangeRates,
        entries: effectiveEntries,
        trialBalance,
        doctorReport,
        addEntry,
        addEntriesBatch,
        openingBalanceBatch,
        recordOpeningBalanceBatch,
        importBatches,
        commitImportBatch,
        reverseImportBatch,
        goLiveState,
        roleTrainings,
        goLiveReadiness,
        markRoleTrained,
        recordBackupAndRestoreTest,
        updateGoLiveFlags,
        confirmGoLive,
        parallelRunData,
        getParallelRunComparison,
        saveParallelRunMonthRows,
        updateParallelRunRowExplanation,
        signOffParallelRunMonthAction,
        parallelRunOverall,
        reverseEntry,
        runDoctor,
        simulateCorruption,
        resetLedger,
        yearEndChecklistOverrides,
        overrideYearEndCheck,
        executeYearEndClose,
        reopenYearForAdjustment,
        latestDeltaNotice,
        dismissDeltaNotice,
        issuedYearEndPacks,
        accrualEntries,
        postAccrualPrepayment,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export function useLedger(): LedgerContextType {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
