/**
 * CashbookContext.
 * Book of original entry for Cash, Bank, Mobile Money, and Petty Cash.
 * Every movement creates a balanced double-entry journal entry in the General Ledger.
 * Sub-ledger balances strictly tie to the general ledger accounts.
 */

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type {
  CashAccount,
  CashbookEntry,
  CashCount,
  ChequeItem,
  BankReconciliation,
  BankReconciliationSignoff,
  BankStatementLine,
  CreateReceiptInput,
  CreatePaymentInput,
  CreateTransferInput,
} from '@church/domain';
import {
  calculateRunningBalances,
  createCashbookReceipt,
  createCashbookPayment,
  createCashbookTransfer,
  getNextChequeNumber as domainGetNextChequeNumber,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useDemo } from './DemoContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';

export interface CashbookFilter {
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly fundId?: string;
  readonly source?: string; // 'ALL' | 'COUNTING_SHEET' | 'VOUCHER' | 'GIVING' | 'TRANSFER' | 'MANUAL'
  readonly search?: string;
}

export interface CashbookAccountSummary {
  readonly openingBalance: bigint;
  readonly totalReceipts: bigint;
  readonly totalPayments: bigint;
  readonly closingBalance: bigint;
  readonly currency: 'GHS' | 'USD';
}

export interface CashbookContextValue {
  readonly cashAccounts: readonly CashAccount[];
  readonly selectedAccountId: string;
  readonly setSelectedAccountId: (id: string) => void;
  readonly entries: readonly CashbookEntry[];
  readonly cheques: readonly ChequeItem[];
  readonly cashCounts: readonly CashCount[];

  readonly getEntriesForAccount: (
    accountId: string,
    filter?: CashbookFilter
  ) => readonly CashbookEntry[];

  readonly getAccountSummary: (
    accountId: string,
    filter?: CashbookFilter
  ) => CashbookAccountSummary;

  readonly getTodaySummary: () => {
    readonly todayReceiptsGhs: bigint;
    readonly todayPaymentsGhs: bigint;
    readonly totalCashGhs: bigint;
    readonly totalBankGhs: bigint;
    readonly totalMomoGhs: bigint;
  };

  readonly recordReceipt: (
    input: Omit<CreateReceiptInput, 'branchId' | 'createdBy' | 'deviceId'>
  ) => { cashbookEntry: CashbookEntry };

  readonly createReceipt?: (
    input: any
  ) => any;

  readonly recordPayment: (
    input: Omit<CreatePaymentInput, 'branchId' | 'createdBy' | 'deviceId' | 'currentBookBalance'>
  ) => { cashbookEntry: CashbookEntry };

  readonly createPayment?: (
    input: any
  ) => any;

  readonly recordTransfer: (
    input: Omit<CreateTransferInput, 'branchId' | 'createdBy' | 'deviceId' | 'currentSourceBalance'>
  ) => { sourceEntry: CashbookEntry; destinationEntry: CashbookEntry };

  readonly recordCashCount: (
    count: Omit<CashCount, 'id' | 'branchId' | 'bookBalance' | 'difference' | 'status'>
  ) => CashCount;

  readonly updateChequeStatus: (
    chequeId: string,
    status: ChequeItem['status'],
    cancelReason?: string
  ) => void;

  // Phase 2: Bank Reconciliation & Cheque Register
  readonly reconciliations: readonly BankReconciliation[];
  readonly statementLines: readonly BankStatementLine[];
  readonly getReconciliationsForAccount: (bankAccountId: string) => readonly BankReconciliation[];
  readonly saveReconciliation: (rec: BankReconciliation) => void;
  readonly prepareReconciliation: (recId: string, signoff: BankReconciliationSignoff) => void;
  readonly approveReconciliation: (recId: string, signoff: BankReconciliationSignoff) => void;
  readonly toggleClearedEntry: (recId: string, entryId: string) => void;
  readonly importStatementLines: (
    bankAccountId: string,
    lines: Array<Omit<BankStatementLine, 'id' | 'branchId' | 'createdAt'>>
  ) => void;
  readonly recordCheque: (cheque: Omit<ChequeItem, 'id' | 'branchId'>) => ChequeItem;
  readonly markChequePresented: (chequeId: string, presentedDate: string) => void;
  readonly cancelCheque: (chequeId: string, reason: string) => void;
  readonly getNextChequeNumber: (bankAccountId: string) => string;
}

const CashbookContext = createContext<CashbookContextValue | null>(null);

const DEFAULT_CASH_ACCOUNTS: CashAccount[] = [
  {
    id: 'ca-cash-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1010',
    code: '1010',
    name: 'Cash on Hand (GHS)',
    kind: 'cash',
    currency: 'GHS',
    allowOverdraft: false,
    openingBalance: 1240000n, // GHS 12,400.00
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-cheques-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1015',
    code: '1015',
    name: 'Cheques in Hand',
    kind: 'cash',
    currency: 'GHS',
    allowOverdraft: false,
    openingBalance: 0n,
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-cash-usd',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1020',
    code: '1020',
    name: 'Cash on Hand (USD)',
    kind: 'cash',
    currency: 'USD',
    allowOverdraft: false,
    openingBalance: 250000n, // $2,500.00
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-bank-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1030',
    code: '1030',
    name: 'Bank Account (GHS)',
    kind: 'bank',
    currency: 'GHS',
    bankName: 'GCB Bank PLC',
    branchName: 'Ring Road Central Branch',
    accountNumberMasked: '**** **** 8819',
    allowOverdraft: false,
    openingBalance: 8520000n, // GHS 85,200.00
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-bank-usd',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1040',
    code: '1040',
    name: 'Bank Account (USD)',
    kind: 'bank',
    currency: 'USD',
    bankName: 'Ecobank Ghana PLC',
    branchName: 'Headquarters Branch',
    accountNumberMasked: '**** **** 1092',
    allowOverdraft: false,
    openingBalance: 1500000n, // $15,000.00
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-momo-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1050',
    code: '1050',
    name: 'Mobile Money (MoMo)',
    kind: 'mobile',
    currency: 'GHS',
    bankName: 'MTN Mobile Money Merchant',
    branchName: 'Accra',
    accountNumberMasked: '**** 24 455 6677',
    allowOverdraft: false,
    openingBalance: 345000n, // GHS 3,450.00
    openingDate: '2026-08-01',
    isActive: true,
  },
  {
    id: 'ca-petty-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    accountId: 'acct-1060',
    code: '1060',
    name: 'Petty Cash (Imprest)',
    kind: 'petty',
    currency: 'GHS',
    allowOverdraft: false,
    openingBalance: 100000n, // GHS 1,000.00
    openingDate: '2026-08-01',
    isActive: true,
  },
];

// Demo transactions across 3 months (August, September, October 2026)
const generateDemoEntries = (): CashbookEntry[] => [
  // 1. August Sunday Collection (From counting sheet CS-2026-W32)
  {
    id: 'cb-aug-cs',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-cs-w32',
    cashAccountId: 'ca-cash-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-08-09',
    refNumber: 'CS-2026-W32',
    details: 'From counting sheet CS-2026-W32: Sunday Tithes and General Offerings',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-4010',
    counterpartAccountName: 'Tithes & Offerings',
    category: 'Tithes',
    amount: 1420000n, // GHS 14,200.00
    amountGhs: 1420000n,
    method: 'CASH',
    linkedCountingSheetId: 'CS-2026-W32',
    source: 'COUNTING_SHEET',
    isReversal: false,
    createdBy: 'Kwame Boateng (Counter)',
    createdAt: '2026-08-09T13:30:00Z',
  },
  // 2. August Cash Deposit to GCB Bank (Transfer)
  {
    id: 'cb-aug-dep-out',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-tr-aug-01',
    cashAccountId: 'ca-cash-ghs',
    direction: 'PAYMENT',
    entryDate: '2026-08-10',
    refNumber: 'TR-202608-001',
    details: 'Bank Deposit: Cash on Hand deposited into GCB Bank (Deposit Slip GCB-99201)',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-1030',
    counterpartAccountName: 'Bank Account (GHS)',
    category: 'Transfers',
    amount: 1200000n, // GHS 12,000.00
    amountGhs: 1200000n,
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-08-10T10:15:00Z',
  },
  {
    id: 'cb-aug-dep-in',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-tr-aug-01',
    cashAccountId: 'ca-bank-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-08-10',
    refNumber: 'TR-202608-001',
    details: 'Deposit Received from Sunday Cash on Hand (Slip GCB-99201)',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-1010',
    counterpartAccountName: 'Cash on Hand (GHS)',
    category: 'Transfers',
    amount: 1200000n,
    amountGhs: 1200000n,
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-08-10T10:15:00Z',
  },
  // 3. August Voucher Payment for ECG Electricity (Bank Cheque)
  {
    id: 'cb-aug-ecg',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-v-aug-ecg',
    cashAccountId: 'ca-bank-ghs',
    direction: 'PAYMENT',
    entryDate: '2026-08-18',
    refNumber: 'PV-202608-0021',
    details: 'To: Electricity Company of Ghana — Auditorium Power Bill',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-5020',
    counterpartAccountName: 'Utilities',
    category: 'Utilities',
    amount: 285000n, // GHS 2,850.00
    amountGhs: 285000n,
    method: 'CHEQUE',
    chequeNumber: '000381',
    linkedVoucherId: 'V-202608-0021',
    source: 'VOUCHER',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-08-18T11:00:00Z',
  },
  // 4. September USD Transfer to GHS Bank with FX Gain/Loss
  {
    id: 'cb-sep-usd-out',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-tr-sep-usd',
    cashAccountId: 'ca-cash-usd',
    direction: 'PAYMENT',
    entryDate: '2026-09-12',
    refNumber: 'TR-202609-004',
    details: 'Conversion & Deposit: $500.00 USD cash converted at 15.5000 into GCB Bank',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-1030',
    counterpartAccountName: 'Bank Account (GHS)',
    category: 'Transfers',
    amount: 50000n, // $500.00 in cents
    exchangeRate: '15.5000',
    amountGhs: 775000n, // 500 * 15.5 = 7,750.00 GHS
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: 'Kofi Mensah (Treasurer)',
    createdAt: '2026-09-12T14:00:00Z',
  },
  {
    id: 'cb-sep-usd-in',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-tr-sep-usd',
    cashAccountId: 'ca-bank-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-09-12',
    refNumber: 'TR-202609-004',
    details: 'USD Cash conversion credited (Bank slip GCB-FX-1049, rate 15.5000)',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-1020',
    counterpartAccountName: 'Cash on Hand (USD)',
    category: 'Transfers',
    amount: 775000n,
    amountGhs: 775000n,
    method: 'BANK_TRANSFER',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: 'Kofi Mensah (Treasurer)',
    createdAt: '2026-09-12T14:00:00Z',
  },
  // 5. September MoMo Tithes & Donations
  {
    id: 'cb-sep-momo-rc',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-momo-sep-1',
    cashAccountId: 'ca-momo-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-09-20',
    refNumber: 'RC-202609-0082',
    details: 'MoMo Tithes & E-Giving (Aggregated MTN Merchant Settlement)',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-4010',
    counterpartAccountName: 'Tithes',
    category: 'Tithes',
    amount: 560000n, // GHS 5,600.00
    amountGhs: 560000n,
    method: 'MOMO',
    source: 'GIVING',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-09-20T18:00:00Z',
  },
  // 6. October Sunday Counting Sheet Collection (CS-2026-W42)
  {
    id: 'cb-oct-cs-ghs',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-cs-w42',
    cashAccountId: 'ca-cash-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-10-18',
    refNumber: 'CS-2026-W42',
    details: 'From counting sheet CS-2026-W42: Sunday Divine Worship Collection',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-4010',
    counterpartAccountName: 'Tithes & Offerings',
    category: 'Tithes',
    amount: 1845000n, // GHS 18,450.00
    amountGhs: 1845000n,
    method: 'CASH',
    linkedCountingSheetId: 'CS-2026-W42',
    source: 'COUNTING_SHEET',
    isReversal: false,
    createdBy: 'Kwame Boateng (Counter)',
    createdAt: '2026-10-18T13:45:00Z',
  },
  // 7. October Direct Receipt (Building Fund Donation)
  {
    id: 'cb-oct-rc-bld',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-rc-oct-01',
    cashAccountId: 'ca-bank-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-10-22',
    refNumber: 'RC-202610-0091',
    details: 'From: Elder Kwabena Acheampong — Auditorium Expansion Project pledge fulfillment',
    fundId: 'fund-bld',
    fundCode: 'BLD',
    counterpartAccountId: 'acct-4040',
    counterpartAccountName: 'Pledge Payments',
    category: 'Special',
    amount: 500000n, // GHS 5,000.00
    amountGhs: 500000n,
    method: 'BANK_TRANSFER',
    source: 'MANUAL',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-10-22T09:30:00Z',
  },
  // 8. October Unpresented Cheque for Sound Equipment Cable Replacement
  {
    id: 'cb-oct-unpresented-chk',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-v-oct-sound',
    cashAccountId: 'ca-bank-ghs',
    direction: 'PAYMENT',
    entryDate: '2026-10-28',
    refNumber: 'PV-202610-0014',
    details: 'To: Modern Sound Solutions Ltd — Audio cable replacement & maintenance',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-5030',
    counterpartAccountName: 'Maintenance & Repairs',
    category: 'Maintenance',
    amount: 450000n, // GHS 4,500.00
    amountGhs: 450000n,
    method: 'CHEQUE',
    chequeNumber: '000395',
    linkedVoucherId: 'REQ-0014',
    source: 'VOUCHER',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-10-28T14:10:00Z',
  },
  // 9. October Petty Cash replenishment
  {
    id: 'cb-oct-petty-rep',
    branchId: '00000000-0000-0000-0000-000000000001',
    journalEntryId: 'je-petty-oct',
    cashAccountId: 'ca-petty-ghs',
    direction: 'RECEIPT',
    entryDate: '2026-10-25',
    refNumber: 'TR-202610-008',
    details: 'Imprest replenishment drawn from Cash on Hand (Voucher PC-019)',
    fundId: 'fund-gen',
    fundCode: 'GEN',
    counterpartAccountId: 'acct-1010',
    counterpartAccountName: 'Cash on Hand (GHS)',
    category: 'Transfers',
    amount: 50000n, // GHS 500.00
    amountGhs: 50000n,
    method: 'CASH',
    source: 'TRANSFER',
    isReversal: false,
    createdBy: 'Akosua Osei (Finance Secretary)',
    createdAt: '2026-10-25T11:00:00Z',
  },
];

const DEFAULT_CHEQUES: ChequeItem[] = [
  {
    id: 'chk-000381',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    chequeNumber: '000381',
    payee: 'Electricity Company of Ghana',
    amount: 285000n,
    currency: 'GHS',
    issueDate: '2026-08-18',
    status: 'PRESENTED',
    presentedDate: '2026-08-22',
    staleDate: '2027-02-18',
    cashbookEntryId: 'cb-aug-ecg',
  },
  {
    id: 'chk-000390',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    chequeNumber: '000390',
    payee: 'Ghana Water Company Ltd',
    amount: 65000n,
    currency: 'GHS',
    issueDate: '2026-03-05',
    status: 'STALE', // Stale (>6 months)
    staleDate: '2026-09-05',
  },
  {
    id: 'chk-000392',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    chequeNumber: '000392',
    payee: 'Tech Support Direct',
    amount: 120000n,
    currency: 'GHS',
    issueDate: '2026-09-12',
    status: 'CANCELLED',
    cancelReason: 'Print alignment error, voided in presence of Treasurer and replaced with electronic transfer',
    staleDate: '2027-03-12',
  },
  {
    id: 'chk-000395',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    chequeNumber: '000395',
    payee: 'Modern Sound Solutions Ltd',
    amount: 450000n,
    currency: 'GHS',
    issueDate: '2026-10-28',
    status: 'ISSUED', // Unpresented cheque!
    staleDate: '2027-04-28',
    cashbookEntryId: 'cb-oct-unpresented-chk',
  },
];

const DEFAULT_STATEMENT_LINES: BankStatementLine[] = [
  {
    id: 'bsl-oct-01',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    statementDate: '2026-10-23',
    description: 'GCB DIRECT CREDIT BLD PLEDGE ACHEEAMPONG',
    reference: 'GCB-CR-88219',
    credit: 500000n,
    isMatched: true,
    matchedCashbookEntryId: 'cb-oct-rc-bld',
    createdAt: '2026-10-31T00:00:00Z',
  },
  {
    id: 'bsl-oct-02',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    statementDate: '2026-10-31',
    description: 'MONTHLY STATEMENT CLOSING POSITION GCB PLC',
    reference: 'GCB-BAL-OCT26',
    credit: 10710000n, // Ending balance
    isMatched: false,
    createdAt: '2026-10-31T23:59:59Z',
  },
];

const DEFAULT_RECONCILIATIONS: BankReconciliation[] = [
  {
    id: 'rec-2026-08',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    statementDate: '2026-08-31',
    statementEndingBalance: 9435000n,
    cashbookClosingBalance: 9435000n,
    depositsInTransit: 0n,
    unpresentedCheques: 0n,
    adjustedBankBalance: 9435000n,
    variance: 0n,
    clearedEntryIds: ['cb-aug-dep-in', 'cb-aug-ecg'],
    status: 'APPROVED',
    preparedBy: {
      userId: 'usr-sign-02',
      fullName: 'Akosua Osei',
      role: 'Finance Secretary',
      signedAt: '2026-08-31T17:00:00Z',
    },
    approvedBy: {
      userId: 'usr-tres-01',
      fullName: 'Kofi Mensah',
      role: 'Treasurer',
      signedAt: '2026-08-31T18:30:00Z',
    },
    createdAt: '2026-08-31T17:00:00Z',
    updatedAt: '2026-08-31T18:30:00Z',
  },
  {
    id: 'rec-2026-09',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    statementDate: '2026-09-30',
    statementEndingBalance: 10210000n,
    cashbookClosingBalance: 10210000n,
    depositsInTransit: 0n,
    unpresentedCheques: 0n,
    adjustedBankBalance: 10210000n,
    variance: 0n,
    clearedEntryIds: ['cb-sep-usd-in'],
    status: 'APPROVED',
    preparedBy: {
      userId: 'usr-sign-02',
      fullName: 'Akosua Osei',
      role: 'Finance Secretary',
      signedAt: '2026-09-30T16:45:00Z',
    },
    approvedBy: {
      userId: 'usr-tres-01',
      fullName: 'Kofi Mensah',
      role: 'Treasurer',
      signedAt: '2026-09-30T17:15:00Z',
    },
    createdAt: '2026-09-30T16:45:00Z',
    updatedAt: '2026-09-30T17:15:00Z',
  },
  {
    id: 'rec-2026-10',
    branchId: '00000000-0000-0000-0000-000000000001',
    bankAccountId: 'ca-bank-ghs',
    statementDate: '2026-10-31',
    statementEndingBalance: 10710000n, // GHS 107,100.00
    cashbookClosingBalance: 10260000n, // GHS 102,600.00
    depositsInTransit: 0n,
    unpresentedCheques: 450000n, // GHS 4,500.00 unpresented cheque 000395
    adjustedBankBalance: 10260000n, // 107,100 - 4,500 = 102,600
    variance: 0n, // Perfectly balanced to zero!
    clearedEntryIds: ['cb-aug-dep-in', 'cb-aug-ecg', 'cb-sep-usd-in', 'cb-oct-rc-bld'],
    status: 'PREPARED', // Prepared by Finance Sec, ready for Treasurer approval
    preparedBy: {
      userId: 'usr-sign-02',
      fullName: 'Akosua Osei',
      role: 'Finance Secretary',
      signedAt: '2026-10-31T17:00:00Z',
    },
    createdAt: '2026-10-31T17:00:00Z',
    updatedAt: '2026-10-31T17:00:00Z',
  },
];

export const CashbookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isDemoMode } = useDemo();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [cashAccounts] = useState<CashAccount[]>(() => {
    return loadFromStore('cash_accounts', isDemoMode, DEFAULT_CASH_ACCOUNTS);
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>('ca-cash-ghs');

  const [entries, setEntries] = useState<CashbookEntry[]>(() => {
    return loadFromStore('cashbook_entries', isDemoMode, isDemoMode ? generateDemoEntries() : []);
  });

  const [cheques, setCheques] = useState<ChequeItem[]>(() => {
    return loadFromStore('cheques', isDemoMode, isDemoMode ? DEFAULT_CHEQUES : []);
  });

  const [cashCounts, setCashCounts] = useState<CashCount[]>(() => {
    return loadFromStore('cash_counts', isDemoMode, []);
  });

  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>(() => {
    return loadFromStore('bank_reconciliations', isDemoMode, isDemoMode ? DEFAULT_RECONCILIATIONS : []);
  });

  const [statementLines, setStatementLines] = useState<BankStatementLine[]>(() => {
    return loadFromStore('bank_statement_lines', isDemoMode, isDemoMode ? DEFAULT_STATEMENT_LINES : []);
  });

  // Offline Sync Queue Helper
  const safeEnqueue = useCallback(
    (
      entityType: string,
      entityId: string,
      action: import('@church/domain').SyncActionType = 'POST_JOURNAL_ENTRY',
      payload: unknown = {}
    ) => {
      if (isDemoMode) return;
      enqueueItem({
        entityType,
        entityId,
        action,
        payload,
        deviceId: 'DEV-FS-01',
      });
    },
    [isDemoMode, enqueueItem]
  );

  // Save changes to localStorage
  useEffect(() => {
    saveToStore('cashbook_entries', isDemoMode, entries);
  }, [entries, isDemoMode]);

  useEffect(() => {
    saveToStore('cheques', isDemoMode, cheques);
  }, [cheques, isDemoMode]);

  useEffect(() => {
    saveToStore('cash_counts', isDemoMode, cashCounts);
  }, [cashCounts, isDemoMode]);

  useEffect(() => {
    saveToStore('bank_reconciliations', isDemoMode, reconciliations);
  }, [reconciliations, isDemoMode]);

  useEffect(() => {
    saveToStore('bank_statement_lines', isDemoMode, statementLines);
  }, [statementLines, isDemoMode]);

  const getEntriesForAccount = useCallback(
    (accountId: string, filter?: CashbookFilter): CashbookEntry[] => {
      const account = cashAccounts.find((a) => a.id === accountId);
      const opening = account ? account.openingBalance : 0n;

      let accountEntries = entries.filter((e) => e.cashAccountId === accountId);

      if (filter) {
        if (filter.fromDate) {
          accountEntries = accountEntries.filter((e) => e.entryDate >= filter.fromDate!);
        }
        if (filter.toDate) {
          accountEntries = accountEntries.filter((e) => e.entryDate <= filter.toDate!);
        }
        if (filter.fundId && filter.fundId !== 'ALL') {
          accountEntries = accountEntries.filter((e) => e.fundId === filter.fundId);
        }
        if (filter.source && filter.source !== 'ALL') {
          accountEntries = accountEntries.filter((e) => e.source === filter.source);
        }
        if (filter.search) {
          const q = filter.search.toLowerCase();
          accountEntries = accountEntries.filter(
            (e) =>
              e.refNumber.toLowerCase().includes(q) ||
              e.details.toLowerCase().includes(q) ||
              e.counterpartAccountName.toLowerCase().includes(q)
          );
        }
      }

      return calculateRunningBalances(accountEntries, opening);
    },
    [cashAccounts, entries]
  );

  const getAccountSummary = useCallback(
    (accountId: string, filter?: CashbookFilter): CashbookAccountSummary => {
      const account = cashAccounts.find((a) => a.id === accountId);
      const currency = account?.currency ?? 'GHS';
      const opening = account ? account.openingBalance : 0n;

      const accountEntries = getEntriesForAccount(accountId, filter);

      let receipts = 0n;
      let payments = 0n;

      for (const e of accountEntries) {
        if (e.direction === 'RECEIPT') {
          receipts += e.amount;
        } else if (e.direction === 'PAYMENT') {
          payments += e.amount;
        }
      }

      return {
        openingBalance: opening,
        totalReceipts: receipts,
        totalPayments: payments,
        closingBalance: opening + receipts - payments,
        currency,
      };
    },
    [cashAccounts, getEntriesForAccount]
  );

  const getTodaySummary = useCallback(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntries = entries.filter((e) => e.entryDate === todayStr);

    let todayReceiptsGhs = 0n;
    let todayPaymentsGhs = 0n;

    for (const e of todayEntries) {
      const amtGhs = e.amountGhs ?? e.amount;
      if (e.direction === 'RECEIPT') todayReceiptsGhs += amtGhs;
      else if (e.direction === 'PAYMENT') todayPaymentsGhs += amtGhs;
    }

    const cashGhsBal = getAccountSummary('ca-cash-ghs').closingBalance;
    const bankGhsBal = getAccountSummary('ca-bank-ghs').closingBalance;
    const momoGhsBal = getAccountSummary('ca-momo-ghs').closingBalance;

    return {
      todayReceiptsGhs,
      todayPaymentsGhs,
      totalCashGhs: cashGhsBal,
      totalBankGhs: bankGhsBal,
      totalMomoGhs: momoGhsBal,
    };
  }, [entries, getAccountSummary]);

  const recordReceipt = useCallback(
    (input: Omit<CreateReceiptInput, 'branchId' | 'createdBy' | 'deviceId'>) => {
      const { journalEntry, cashbookEntry } = createCashbookReceipt({
        ...input,
        branchId: '00000000-0000-0000-0000-000000000001',
        createdBy: currentUser.fullName,
        deviceId: 'DEV-FS-01',
      });

      // Post to General Ledger!
      addEntry(journalEntry);

      // Add to Cashbook Entries
      setEntries((prev) => [cashbookEntry, ...prev]);

      // Enqueue sync & audit
      safeEnqueue('CASHBOOK_ENTRY', cashbookEntry.id, 'POST_JOURNAL_ENTRY', {
        ...cashbookEntry,
        amount: cashbookEntry.amount.toString(),
        amountGhs: cashbookEntry.amountGhs?.toString(),
      });

      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} recorded cashbook receipt ${cashbookEntry.refNumber} from ${input.receivedFrom} for GHS ${Number(cashbookEntry.amount) / 100}`,
        performedBy: currentUser.fullName,
      });

      return { cashbookEntry };
    },
    [currentUser.fullName, addEntry, safeEnqueue]
  );

  const recordPayment = useCallback(
    (
      input: Omit<CreatePaymentInput, 'branchId' | 'createdBy' | 'deviceId' | 'currentBookBalance'>
    ) => {
      const currentBookBalance = getAccountSummary(input.cashAccount.id).closingBalance;

      const { journalEntry, cashbookEntry } = createCashbookPayment({
        ...input,
        branchId: '00000000-0000-0000-0000-000000000001',
        createdBy: currentUser.fullName,
        deviceId: 'DEV-FS-01',
        currentBookBalance,
      });

      // Post to General Ledger!
      addEntry(journalEntry);

      // If cheque was issued, record in cheque register
      if (input.method === 'CHEQUE' && input.chequeNumber) {
        const staleDate = new Date(input.entryDate);
        staleDate.setMonth(staleDate.getMonth() + 6);

        const newCheque: ChequeItem = {
          id: `chk-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          bankAccountId: input.cashAccount.id,
          chequeNumber: input.chequeNumber,
          payee: input.paidTo,
          amount: input.amount,
          currency: input.cashAccount.currency,
          issueDate: input.entryDate,
          status: 'ISSUED',
          staleDate: staleDate.toISOString().slice(0, 10),
          cashbookEntryId: cashbookEntry.id,
        };

        setCheques((prev) => [newCheque, ...prev]);
        safeEnqueue('CHEQUE', newCheque.id, 'POST_JOURNAL_ENTRY', {
          ...newCheque,
          amount: newCheque.amount.toString(),
        });
      }

      // Add to Cashbook Entries
      setEntries((prev) => [cashbookEntry, ...prev]);

      // Enqueue sync & audit
      safeEnqueue('CASHBOOK_ENTRY', cashbookEntry.id, 'POST_JOURNAL_ENTRY', {
        ...cashbookEntry,
        amount: cashbookEntry.amount.toString(),
        amountGhs: cashbookEntry.amountGhs?.toString(),
      });

      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} recorded cashbook payment ${cashbookEntry.refNumber} to ${input.paidTo} for GHS ${Number(cashbookEntry.amount) / 100}`,
        performedBy: currentUser.fullName,
      });

      return { cashbookEntry };
    },
    [currentUser.fullName, getAccountSummary, addEntry, safeEnqueue]
  );

  const recordTransfer = useCallback(
    (
      input: Omit<CreateTransferInput, 'branchId' | 'createdBy' | 'deviceId' | 'currentSourceBalance'>
    ) => {
      const currentSourceBalance = getAccountSummary(input.fromAccount.id).closingBalance;

      const { journalEntry, sourceEntry, destinationEntry } = createCashbookTransfer({
        ...input,
        branchId: '00000000-0000-0000-0000-000000000001',
        createdBy: currentUser.fullName,
        deviceId: 'DEV-FS-01',
        currentSourceBalance,
      });

      // Post to General Ledger!
      addEntry(journalEntry);

      // Add both entries to Cashbook
      setEntries((prev) => [sourceEntry, destinationEntry, ...prev]);

      // Enqueue sync & audit
      safeEnqueue('CASHBOOK_ENTRY', sourceEntry.id, 'POST_JOURNAL_ENTRY', { ...sourceEntry, amount: sourceEntry.amount.toString() });
      safeEnqueue('CASHBOOK_ENTRY', destinationEntry.id, 'POST_JOURNAL_ENTRY', { ...destinationEntry, amount: destinationEntry.amount.toString() });

      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} transferred funds from ${input.fromAccount.name} to ${input.toAccount.name} (Ref: ${sourceEntry.refNumber})`,
        performedBy: currentUser.fullName,
      });

      return { sourceEntry, destinationEntry };
    },
    [currentUser.fullName, getAccountSummary, addEntry, safeEnqueue]
  );

  const recordCashCount = useCallback(
    (
      countData: Omit<CashCount, 'id' | 'branchId' | 'bookBalance' | 'difference' | 'status'>
    ): CashCount => {
      const bookBalance = getAccountSummary(countData.cashAccountId).closingBalance;
      const difference = countData.physicalBalance - bookBalance;
      const isBalanced = difference === 0n;

      const newCount: CashCount = {
        ...countData,
        id: `cnt-${Date.now()}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        bookBalance,
        difference,
        status: isBalanced ? 'BALANCED' : 'PENDING_APPROVAL',
      };

      setCashCounts((prev) => [newCount, ...prev]);

      safeEnqueue('CASH_COUNT', newCount.id, 'POST_JOURNAL_ENTRY', {
        ...newCount,
        bookBalance: newCount.bookBalance.toString(),
        physicalBalance: newCount.physicalBalance.toString(),
        difference: newCount.difference.toString(),
        lines: newCount.lines.map((l) => ({ ...l, lineTotal: l.lineTotal.toString() })),
      });

      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${countData.firstSignatory.fullName} and ${countData.secondSignatory.fullName} performed cash count on ${countData.countDate} (Difference: GHS ${Number(difference) / 100})`,
        performedBy: currentUser.fullName,
      });

      return newCount;
    },
    [currentUser.fullName, getAccountSummary, safeEnqueue]
  );

  const updateChequeStatus = useCallback(
    (chequeId: string, status: ChequeItem['status'], cancelReason?: string) => {
      setCheques((prev) =>
        prev.map((c) => (c.id === chequeId ? { ...c, status, cancelReason } : c))
      );

      safeEnqueue('CHEQUE', chequeId, 'POST_JOURNAL_ENTRY', { status, cancelReason });
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} updated cheque ${chequeId} status to ${status}${cancelReason ? ` (Reason: ${cancelReason})` : ''}`,
        performedBy: currentUser.fullName,
      });
    },
    [currentUser.fullName, safeEnqueue]
  );

  const getReconciliationsForAccount = useCallback(
    (bankAccountId: string): BankReconciliation[] => {
      return reconciliations
        .filter((r) => r.bankAccountId === bankAccountId)
        .sort((a, b) => b.statementDate.localeCompare(a.statementDate));
    },
    [reconciliations]
  );

  const saveReconciliation = useCallback(
    (rec: BankReconciliation) => {
      setReconciliations((prev) => {
        const index = prev.findIndex((r) => r.id === rec.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = rec;
          return updated;
        }
        return [rec, ...prev];
      });

      safeEnqueue('BANK_RECONCILIATION', rec.id, 'POST_JOURNAL_ENTRY', rec);
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} saved bank reconciliation ${rec.id} for ${rec.statementDate} (${rec.status})`,
        performedBy: currentUser.fullName,
      });
    },
    [currentUser.fullName, safeEnqueue]
  );

  const prepareReconciliation = useCallback(
    (recId: string, signoff: BankReconciliationSignoff) => {
      setReconciliations((prev) =>
        prev.map((r) => {
          if (r.id === recId) {
            return {
              ...r,
              status: 'PREPARED',
              preparedBy: signoff,
              updatedAt: new Date().toISOString(),
            };
          }
          return r;
        })
      );

      safeEnqueue('BANK_RECONCILIATION', recId, 'POST_JOURNAL_ENTRY', { status: 'PREPARED', preparedBy: signoff });
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${signoff.fullName} (${signoff.role}) prepared bank reconciliation ${recId}`,
        performedBy: signoff.fullName,
      });
    },
    [safeEnqueue]
  );

  const approveReconciliation = useCallback(
    (recId: string, signoff: BankReconciliationSignoff) => {
      setReconciliations((prev) =>
        prev.map((r) => {
          if (r.id === recId) {
            return {
              ...r,
              status: 'APPROVED',
              approvedBy: signoff,
              updatedAt: new Date().toISOString(),
            };
          }
          return r;
        })
      );

      safeEnqueue('BANK_RECONCILIATION', recId, 'POST_JOURNAL_ENTRY', { status: 'APPROVED', approvedBy: signoff });
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${signoff.fullName} (${signoff.role}) approved bank reconciliation ${recId}`,
        performedBy: signoff.fullName,
      });
    },
    [safeEnqueue]
  );

  const toggleClearedEntry = useCallback((recId: string, entryId: string) => {
    setReconciliations((prev) =>
      prev.map((r) => {
        if (r.id === recId) {
          const cleared = new Set(r.clearedEntryIds);
          if (cleared.has(entryId)) {
            cleared.delete(entryId);
          } else {
            cleared.add(entryId);
          }
          return {
            ...r,
            clearedEntryIds: Array.from(cleared),
            updatedAt: new Date().toISOString(),
          };
        }
        return r;
      })
    );
  }, []);

  const importStatementLines = useCallback(
    (
      bankAccountId: string,
      lines: Array<Omit<BankStatementLine, 'id' | 'branchId' | 'createdAt'>>
    ) => {
      const newLines: BankStatementLine[] = lines.map((l, index) => ({
        ...l,
        id: `bsl-${Date.now()}-${index}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        createdAt: new Date().toISOString(),
      }));

      setStatementLines((prev) => [...newLines, ...prev]);

      safeEnqueue('BANK_STATEMENT_LINE', `bsl-batch-${Date.now()}`, 'POST_JOURNAL_ENTRY', newLines);
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} imported ${newLines.length} bank statement lines for account ${bankAccountId}`,
        performedBy: currentUser.fullName,
      });
    },
    [currentUser.fullName, safeEnqueue]
  );

  const recordCheque = useCallback(
    (cheque: Omit<ChequeItem, 'id' | 'branchId'>): ChequeItem => {
      const newCheque: ChequeItem = {
        ...cheque,
        id: `chk-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        branchId: '00000000-0000-0000-0000-000000000001',
      };

      setCheques((prev) => [newCheque, ...prev]);

      safeEnqueue('CHEQUE', newCheque.id, 'POST_JOURNAL_ENTRY', newCheque);
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} recorded cheque ${newCheque.chequeNumber} to ${newCheque.payee}`,
        performedBy: currentUser.fullName,
      });

      return newCheque;
    },
    [currentUser.fullName, safeEnqueue]
  );

  const markChequePresented = useCallback(
    (chequeId: string, presentedDate: string) => {
      setCheques((prev) =>
        prev.map((c) =>
          c.id === chequeId ? { ...c, status: 'PRESENTED', presentedDate } : c
        )
      );

      safeEnqueue('CHEQUE', chequeId, 'POST_JOURNAL_ENTRY', { status: 'PRESENTED', presentedDate });
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} marked cheque ${chequeId} as presented on ${presentedDate}`,
        performedBy: currentUser.fullName,
      });
    },
    [currentUser.fullName, safeEnqueue]
  );

  const cancelCheque = useCallback(
    (chequeId: string, reason: string) => {
      setCheques((prev) =>
        prev.map((c) =>
          c.id === chequeId ? { ...c, status: 'CANCELLED', cancelReason: reason } : c
        )
      );

      safeEnqueue('CHEQUE', chequeId, 'POST_JOURNAL_ENTRY', { status: 'CANCELLED', cancelReason: reason });
      safeEnqueue('AUDIT_LOG', `aud-${Date.now()}`, 'POST_JOURNAL_ENTRY', {
        action: `${currentUser.fullName} cancelled cheque ${chequeId}: ${reason}`,
        performedBy: currentUser.fullName,
      });
    },
    [currentUser.fullName, safeEnqueue]
  );

  const getNextChequeNumber = useCallback(
    (bankAccountId: string): string => {
      const acctCheques = cheques.filter((c) => c.bankAccountId === bankAccountId);
      return domainGetNextChequeNumber(acctCheques, 396);
    },
    [cheques]
  );

  const value = useMemo<CashbookContextValue>(
    () => ({
      cashAccounts,
      selectedAccountId,
      setSelectedAccountId,
      entries,
      cheques,
      cashCounts,
      reconciliations,
      statementLines,
      getEntriesForAccount,
      getAccountSummary,
      getTodaySummary,
      recordReceipt,
      createReceipt: recordReceipt,
      recordPayment,
      createPayment: recordPayment,
      recordTransfer,
      recordCashCount,
      updateChequeStatus,
      getReconciliationsForAccount,
      saveReconciliation,
      prepareReconciliation,
      approveReconciliation,
      toggleClearedEntry,
      importStatementLines,
      recordCheque,
      markChequePresented,
      cancelCheque,
      getNextChequeNumber,
    }),
    [
      cashAccounts,
      selectedAccountId,
      entries,
      cheques,
      cashCounts,
      reconciliations,
      statementLines,
      getEntriesForAccount,
      getAccountSummary,
      getTodaySummary,
      recordReceipt,
      recordPayment,
      recordTransfer,
      recordCashCount,
      updateChequeStatus,
      getReconciliationsForAccount,
      saveReconciliation,
      prepareReconciliation,
      approveReconciliation,
      toggleClearedEntry,
      importStatementLines,
      recordCheque,
      markChequePresented,
      cancelCheque,
      getNextChequeNumber,
    ]
  );

  return <CashbookContext.Provider value={value}>{children}</CashbookContext.Provider>;
};

export const useCashbook = (): CashbookContextValue => {
  const context = useContext(CashbookContext);
  if (!context) {
    throw new Error('useCashbook must be used within a CashbookProvider');
  }
  return context;
};
