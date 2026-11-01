import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Account,
  Fund,
  AccountingPeriod,
  ExchangeRate,
  JournalEntry,
  TrialBalanceReport,
  DoctorReport,
} from '@church/domain';
import {
  calculateTrialBalance,
  diagnoseLedger,
  createJournalEntry,
  createReversalEntry,
} from '@church/domain';
import { useAuth } from './AuthContext.js';

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acct-1010', branchId: '00000000-0000-0000-0000-000000000001', code: '1010', name: 'Cash on Hand (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1020', branchId: '00000000-0000-0000-0000-000000000001', code: '1020', name: 'Cash on Hand (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
  { id: 'acct-1030', branchId: '00000000-0000-0000-0000-000000000001', code: '1030', name: 'Bank Account (GHS)', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-1040', branchId: '00000000-0000-0000-0000-000000000001', code: '1040', name: 'Bank Account (USD)', type: 'Asset', currency: 'USD', isBankOrCash: true, isActive: true },
  { id: 'acct-1050', branchId: '00000000-0000-0000-0000-000000000001', code: '1050', name: 'Mobile Money (MoMo) Wallet', type: 'Asset', currency: 'GHS', isBankOrCash: true, isActive: true },
  { id: 'acct-2010', branchId: '00000000-0000-0000-0000-000000000001', code: '2010', name: 'Accounts Payable', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-2020', branchId: '00000000-0000-0000-0000-000000000001', code: '2020', name: 'Interfund Due To / Due From', type: 'Liability', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-3010', branchId: '00000000-0000-0000-0000-000000000001', code: '3010', name: 'General Fund Equity', type: 'Equity', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4010', branchId: '00000000-0000-0000-0000-000000000001', code: '4010', name: 'Tithes', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4020', branchId: '00000000-0000-0000-0000-000000000001', code: '4020', name: 'General Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4030', branchId: '00000000-0000-0000-0000-000000000001', code: '4030', name: 'Special Offerings', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-4040', branchId: '00000000-0000-0000-0000-000000000001', code: '4040', name: 'Pledge Payments', type: 'Income', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5010', branchId: '00000000-0000-0000-0000-000000000001', code: '5010', name: 'Salaries and Allowances', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5020', branchId: '00000000-0000-0000-0000-000000000001', code: '5020', name: 'Utilities', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5030', branchId: '00000000-0000-0000-0000-000000000001', code: '5030', name: 'Maintenance & Repairs', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5040', branchId: '00000000-0000-0000-0000-000000000001', code: '5040', name: 'Outreach and Missions', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
  { id: 'acct-5050', branchId: '00000000-0000-0000-0000-000000000001', code: '5050', name: 'Welfare Support', type: 'Expense', currency: 'GHS', isBankOrCash: false, isActive: true },
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

export const INITIAL_PERIODS: AccountingPeriod[] = [
  {
    id: 'per-2026-10',
    branchId: '00000000-0000-0000-0000-000000000001',
    year: 2026,
    month: 10,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    isClosed: false,
  },
  {
    id: 'per-2026-09',
    branchId: '00000000-0000-0000-0000-000000000001',
    year: 2026,
    month: 9,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    isClosed: true,
    closedAt: '2026-10-02T10:00:00Z',
    closedBy: 'user-0001-treasurer',
  },
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

interface LedgerContextType {
  accounts: Account[];
  funds: Fund[];
  periods: AccountingPeriod[];
  exchangeRates: ExchangeRate[];
  entries: JournalEntry[];
  trialBalance: TrialBalanceReport;
  doctorReport: DoctorReport;
  addEntry: (entry: JournalEntry) => void;
  reverseEntry: (originalId: string, reason: string) => JournalEntry;
  runDoctor: () => DoctorReport;
  simulateCorruption: (type: 'sign_flip' | 'digit_transposition' | 'sync_gap' | 'unbalanced') => void;
  resetLedger: () => void;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [accounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [funds] = useState<Fund[]>(INITIAL_FUNDS);
  const [periods] = useState<AccountingPeriod[]>(INITIAL_PERIODS);
  const [exchangeRates] = useState<ExchangeRate[]>(INITIAL_EXCHANGE_RATES);

  const [entries, setEntries] = useState<JournalEntry[]>(() => createSeedEntries());

  const trialBalance = calculateTrialBalance(entries, accounts, funds);
  const doctorReport = diagnoseLedger({
    entries,
    accounts,
    funds,
    periods,
    exchangeRates,
  });

  const addEntry = useCallback((entry: JournalEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

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

      setEntries((prev) => [reversal, ...prev]);
      return reversal;
    },
    [entries, currentUser]
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
    [currentUser]
  );

  const resetLedger = useCallback(() => {
    setEntries(createSeedEntries());
  }, []);

  return (
    <LedgerContext.Provider
      value={{
        accounts,
        funds,
        periods,
        exchangeRates,
        entries,
        trialBalance,
        doctorReport,
        addEntry,
        reverseEntry,
        runDoctor,
        simulateCorruption,
        resetLedger,
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
