/**
 * TithesContext.
 * Sub-ledger for recording, reconciling, reporting and auditing tithes member by member.
 * Strictly adheres to privacy controls, append-only reversals, and ties out to general ledger.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  TitheBatch,
  TitheRecord,
  TitheSettings,
  TitheParticipationStats,
  MemberTitheSummary,
  TitheRemittanceRule,
  TitheRemittance,
} from '@church/domain';
import {
  calculateTitheBatchSummary,
  validateTitheBatchPosting,
  calculateTitheParticipation,
  calculateMemberTitheSummary,
  createTitheReversal,
  DEFAULT_TITHE_SETTINGS,
  calculateRemittanceDue,
  isRemittanceOverdue,
  evaluateRemittanceStatus,
  createJournalEntry,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useDemo } from './DemoContext.js';
import { useLedger, INITIAL_ACCOUNTS, INITIAL_FUNDS } from './LedgerContext.js';
import { useCashbook } from './CashbookContext.js';
import { useGiving } from './GivingContext.js';
import { useSync } from './SyncContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';
import { logAuditEvent } from '../utils/auditLogger.js';

export interface TithesContextType {
  batches: TitheBatch[];
  records: TitheRecord[];
  settings: TitheSettings;
  remittanceRules: TitheRemittanceRule[];
  remittances: TitheRemittance[];
  canViewIndividualTithes: boolean;
  saveBatchDraft: (
    batchId: string,
    records: Omit<TitheRecord, 'id' | 'branchId' | 'createdAt'>[],
    explainedUnallocated?: bigint,
    unallocatedReason?: string
  ) => void;
  reconcileBatch: (batchId: string) => { success: boolean; error?: string };
  postBatch: (batchId: string) => { success: boolean; error?: string };
  deleteDraftBatch: (batchId: string) => { success: boolean; error?: string };
  recordDirectTithe: (input: {
    memberId: string;
    memberName: string;
    envelopeNumber?: string;
    amount: bigint;
    currency: string;
    exchangeRate?: string;
    recordDate: string;
    method: 'MOMO' | 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';
    cashAccountId: string;
    reference?: string;
    narration: string;
  }) => { record: TitheRecord; receiptRef: string };
  reverseTithe: (recordId: string, reason: string) => TitheRecord;
  createBatchFromCountingSheet: (params: {
    countingSheetId: string;
    serviceDate: string;
    serviceName: string;
    currency: string;
    countedTotal: bigint;
  }) => TitheBatch;
  getMemberSummary: (memberId: string, referenceYear?: number, referenceMonth?: number) => MemberTitheSummary;
  getParticipationStats: (period?: string, currency?: string) => TitheParticipationStats;
  logMemberTithesView: (memberId: string, memberName: string) => void;
  logExport: (format: string, rowCount: number) => void;
  logStatementPrint: (memberId: string, memberName: string) => void;
  updateSettings: (newSettings: Partial<TitheSettings>) => void;
  saveRemittanceRule: (
    rule: Omit<TitheRemittanceRule, 'id' | 'createdAt'>,
    id?: string
  ) => TitheRemittanceRule;
  deleteRemittanceRule: (id: string) => void;
  accrueMonthlyRemittance: (period: string, ruleId?: string) => TitheRemittance;
  payRemittanceViaVoucher: (params: {
    remittanceId: string;
    paymentAmount: bigint;
    paymentMethod: 'CHEQUE' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
    cashAccountId: string;
    chequeNumber?: string;
    momoNumber?: string;
    momoNetwork?: string;
    notes?: string;
  }) => { remittance: TitheRemittance; voucherNumber: string };
  getOverdueRemittances: (referenceDate?: string) => TitheRemittance[];
}

const TithesContext = createContext<TithesContextType | undefined>(undefined);

const SEED_TITHE_BATCHES: TitheBatch[] = [
  {
    id: 'tb-2026-10-04',
    branchId: '00000000-0000-0000-0000-000000000001',
    countingSheetId: 'CS-2026-W40',
    serviceDate: '2026-10-04',
    serviceName: 'Sunday 1st Service',
    currency: 'GHS',
    countedTotal: 540000n, // 5,400.00 GHS
    allocatedTotal: 540000n,
    unallocatedTotal: 0n,
    explainedUnallocated: 0n,
    status: 'POSTED',
    reconciledBy: 'user-0002-sec',
    reconciledAt: '2026-10-04T15:30:00Z',
    postedBy: 'user-0001-treasurer',
    postedAt: '2026-10-04T17:00:00Z',
    recordsCount: 18,
    createdAt: '2026-10-04T14:00:00Z',
  },
  {
    id: 'tb-2026-10-11',
    branchId: '00000000-0000-0000-0000-000000000001',
    countingSheetId: 'CS-2026-W41',
    serviceDate: '2026-10-11',
    serviceName: 'Sunday 1st Service',
    currency: 'GHS',
    countedTotal: 565000n, // 5,650.00 GHS
    allocatedTotal: 565000n,
    unallocatedTotal: 0n,
    explainedUnallocated: 0n,
    status: 'POSTED',
    reconciledBy: 'user-0002-sec',
    reconciledAt: '2026-10-11T16:00:00Z',
    postedBy: 'user-0001-treasurer',
    postedAt: '2026-10-11T17:15:00Z',
    recordsCount: 19,
    createdAt: '2026-10-11T14:10:00Z',
  },
  {
    id: 'tb-2026-10-18',
    branchId: '00000000-0000-0000-0000-000000000001',
    countingSheetId: 'cs-001',
    serviceDate: '2026-10-18',
    serviceName: 'Sunday 1st Service',
    currency: 'GHS',
    countedTotal: 580000n, // 5,800.00 GHS (ties exactly to CS-CNT-000001 Tithe allocation)
    allocatedTotal: 580000n,
    unallocatedTotal: 0n,
    explainedUnallocated: 0n,
    status: 'RECONCILED',
    reconciledBy: 'user-0002-sec',
    reconciledAt: '2026-10-18T16:20:00Z',
    recordsCount: 20,
    createdAt: '2026-10-18T14:30:00Z',
  },
  {
    id: 'tb-2026-10-25',
    branchId: '00000000-0000-0000-0000-000000000001',
    countingSheetId: 'CS-2026-W43',
    serviceDate: '2026-10-25',
    serviceName: 'Sunday 1st Service',
    currency: 'GHS',
    countedTotal: 610000n, // 6,100.00 GHS
    allocatedTotal: 575000n, // 5,750.00 GHS
    unallocatedTotal: 35000n, // 350.00 GHS (unreconciled batch with unallocated envelope)
    explainedUnallocated: 0n,
    unallocatedReason: 'One envelope had water damage on envelope number and member signature. Pending counter review.',
    status: 'DRAFT',
    recordsCount: 21,
    createdAt: '2026-10-25T14:45:00Z',
  },
];

const SEED_REMITTANCE_RULES: TitheRemittanceRule[] = [
  {
    id: 'trr-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    name: 'District Headquarters Remittance',
    basis: 'PERCENTAGE',
    percentageOrAmount: '10',
    currency: 'GHS',
    frequency: 'MONTHLY',
    dueDayOfMonth: 10,
    effectiveFrom: '2026-01-01',
    payeeName: 'Accra District Office',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const SEED_REMITTANCES: TitheRemittance[] = [
  {
    id: 'rem-2026-08',
    branchId: '00000000-0000-0000-0000-000000000001',
    ruleId: 'trr-001',
    ruleName: 'District Headquarters Remittance',
    period: '2026-08',
    tithesBasisGhs: 2250000n, // GHS 22,500.00
    rateUsed: '10%',
    amountDue: 225000n, // GHS 2,250.00
    amountPaid: 225000n,
    balanceOutstanding: 0n,
    currency: 'GHS',
    status: 'FULLY_PAID',
    dueDate: '2026-09-10',
    voucherIds: ['PV-2026-0881'],
    journalEntryId: 'je-rem-2026-08',
    notes: 'Paid via GCB Bank Cheque CHQ-009912.',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-08T11:00:00Z',
  },
  {
    id: 'rem-2026-09',
    branchId: '00000000-0000-0000-0000-000000000001',
    ruleId: 'trr-001',
    ruleName: 'District Headquarters Remittance',
    period: '2026-09',
    tithesBasisGhs: 2340000n, // GHS 23,400.00
    rateUsed: '10%',
    amountDue: 234000n, // GHS 2,340.00
    amountPaid: 234000n,
    balanceOutstanding: 0n,
    currency: 'GHS',
    status: 'FULLY_PAID',
    dueDate: '2026-10-10',
    voucherIds: ['PV-2026-0945'],
    journalEntryId: 'je-rem-2026-09',
    notes: 'Paid via GCB Bank Transfer Ref TX-98402.',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-07T14:30:00Z',
  },
  {
    id: 'rem-2026-10',
    branchId: '00000000-0000-0000-0000-000000000001',
    ruleId: 'trr-001',
    ruleName: 'District Headquarters Remittance',
    period: '2026-10',
    tithesBasisGhs: 2490000n, // GHS 24,900.00
    rateUsed: '10%',
    amountDue: 249000n, // GHS 2,490.00
    amountPaid: 0n,
    balanceOutstanding: 249000n, // GHS 2,490.00
    currency: 'GHS',
    status: 'ACCRUED',
    dueDate: '2026-11-10',
    voucherIds: [],
    journalEntryId: 'je-rem-2026-10',
    notes: 'Accrued October 2026 assessment for Accra District Office.',
    createdAt: '2026-10-31T20:00:00Z',
  },
];

// Helper to seed realistic records for batches
function generateSeedTitheRecords(): TitheRecord[] {
  const records: TitheRecord[] = [];
  const branchId = '00000000-0000-0000-0000-000000000001';

  // Seed historical records for Oct 4
  const oct4Amounts: { memId: string; name: string; env: string; amt: bigint }[] = [
    { memId: 'mem-001', name: 'Elder Kofi Mensah', env: 'ENV-012', amt: 50000n },
    { memId: 'mem-002', name: 'Sister Akua Mansa', env: 'ENV-019', amt: 35000n },
    { memId: 'mem-003', name: 'Deacon Kwabena Acheampong', env: 'ENV-045', amt: 40000n },
    { memId: 'mem-004', name: 'Sister Efua Dadson', env: 'ENV-077', amt: 25000n },
    { memId: 'mem-005', name: 'Brother Emmanuel Ofori', env: 'ENV-088', amt: 30000n },
    { memId: 'mem-006', name: 'Sister Akosua Osei', env: 'ENV-092', amt: 30000n },
    { memId: 'mem-007', name: 'Rev. Emmanuel Addo', env: 'ENV-103', amt: 60000n },
    { memId: 'mem-010', name: 'Brother Justice Appiah', env: 'ENV-134', amt: 25000n },
    { memId: 'mem-011', name: 'Brother Yaw Kwarteng', env: 'ENV-142', amt: 20000n },
    { memId: 'mem-012', name: 'Deaconess Grace Darko', env: 'ENV-156', amt: 45000n },
    { memId: 'mem-013', name: 'Sister Naomi Baah', env: 'ENV-161', amt: 20000n },
    { memId: 'mem-014', name: 'Brother Samuel Ansah', env: 'ENV-175', amt: 25000n },
    { memId: 'mem-015', name: 'Deacon Isaac Quaye', env: 'ENV-183', amt: 35000n },
    { memId: 'mem-016', name: 'Sister Lydia Sarpong', env: 'ENV-198', amt: 15000n },
    { memId: 'mem-017', name: 'Brother Daniel Arthur', env: 'ENV-204', amt: 20000n },
    { memId: 'mem-018', name: 'Sister Comfort Frimpong', env: 'ENV-219', amt: 25000n },
    { memId: 'mem-019', name: 'Elder Peter Mensah', env: 'ENV-225', amt: 30000n },
    { memId: 'mem-020', name: 'Sister Joyce Antwi', env: 'ENV-238', amt: 10000n },
  ]; // Sum = 5,400.00 GHS

  oct4Amounts.forEach((m, idx) => {
    records.push({
      id: `tr-2026-10-04-${(idx + 1).toString().padStart(2, '0')}`,
      branchId,
      batchId: 'tb-2026-10-04',
      memberId: m.memId,
      memberName: m.name,
      envelopeNumber: m.env,
      recordDate: '2026-10-04',
      amount: m.amt,
      currency: 'GHS',
      method: 'ENVELOPE',
      recordedBy: 'user-0002-sec',
      createdAt: '2026-10-04T14:15:00Z',
    });
  });

  // Seed records for Oct 11 (Sum = 5,650.00 GHS)
  const oct11Amounts: { memId: string; name: string; env: string; amt: bigint }[] = [
    { memId: 'mem-001', name: 'Elder Kofi Mensah', env: 'ENV-012', amt: 50000n },
    { memId: 'mem-002', name: 'Sister Akua Mansa', env: 'ENV-019', amt: 35000n },
    { memId: 'mem-003', name: 'Deacon Kwabena Acheampong', env: 'ENV-045', amt: 40000n },
    { memId: 'mem-005', name: 'Brother Emmanuel Ofori', env: 'ENV-088', amt: 30000n },
    { memId: 'mem-006', name: 'Sister Akosua Osei', env: 'ENV-092', amt: 30000n },
    { memId: 'mem-007', name: 'Rev. Emmanuel Addo', env: 'ENV-103', amt: 60000n },
    { memId: 'mem-010', name: 'Brother Justice Appiah', env: 'ENV-134', amt: 25000n },
    { memId: 'mem-012', name: 'Deaconess Grace Darko', env: 'ENV-156', amt: 45000n },
    { memId: 'mem-014', name: 'Brother Samuel Ansah', env: 'ENV-175', amt: 25000n },
    { memId: 'mem-015', name: 'Deacon Isaac Quaye', env: 'ENV-183', amt: 35000n },
    { memId: 'mem-017', name: 'Brother Daniel Arthur', env: 'ENV-204', amt: 20000n },
    { memId: 'mem-018', name: 'Sister Comfort Frimpong', env: 'ENV-219', amt: 25000n },
    { memId: 'mem-019', name: 'Elder Peter Mensah', env: 'ENV-225', amt: 30000n },
    { memId: 'mem-022', name: 'Sister Mary Appiah', env: 'ENV-256', amt: 15000n },
    { memId: 'mem-023', name: 'Brother Paul Danquah', env: 'ENV-268', amt: 30000n },
    { memId: 'mem-024', name: 'Sister Hannah Kumi', env: 'ENV-274', amt: 15000n },
    { memId: 'mem-025', name: 'Deacon Philip Donkor', env: 'ENV-289', amt: 25000n },
    { memId: 'mem-026', name: 'Brother Francis Asare', env: 'ENV-293', amt: 15000n },
    { memId: 'mem-027', name: 'Sister Beatrice Nortey', env: 'ENV-306', amt: 15000n },
  ]; // Sum = 5,650.00 GHS

  oct11Amounts.forEach((m, idx) => {
    records.push({
      id: `tr-2026-10-11-${(idx + 1).toString().padStart(2, '0')}`,
      branchId,
      batchId: 'tb-2026-10-11',
      memberId: m.memId,
      memberName: m.name,
      envelopeNumber: m.env,
      recordDate: '2026-10-11',
      amount: m.amt,
      currency: 'GHS',
      method: 'ENVELOPE',
      recordedBy: 'user-0002-sec',
      createdAt: '2026-10-11T14:20:00Z',
    });
  });

  // Seed records for Oct 18 (Sum = 5,800.00 GHS)
  const oct18Amounts: { memId: string; name: string; env: string; amt: bigint }[] = [
    { memId: 'mem-001', name: 'Elder Kofi Mensah', env: 'ENV-012', amt: 50000n },
    { memId: 'mem-002', name: 'Sister Akua Mansa', env: 'ENV-019', amt: 35000n },
    { memId: 'mem-003', name: 'Deacon Kwabena Acheampong', env: 'ENV-045', amt: 40000n },
    { memId: 'mem-004', name: 'Sister Efua Dadson', env: 'ENV-077', amt: 25000n },
    { memId: 'mem-005', name: 'Brother Emmanuel Ofori', env: 'ENV-088', amt: 30000n },
    { memId: 'mem-006', name: 'Sister Akosua Osei', env: 'ENV-092', amt: 30000n },
    { memId: 'mem-007', name: 'Rev. Emmanuel Addo', env: 'ENV-103', amt: 60000n },
    { memId: 'mem-010', name: 'Brother Justice Appiah', env: 'ENV-134', amt: 25000n },
    { memId: 'mem-011', name: 'Brother Yaw Kwarteng', env: 'ENV-142', amt: 20000n },
    { memId: 'mem-012', name: 'Deaconess Grace Darko', env: 'ENV-156', amt: 45000n },
    { memId: 'mem-013', name: 'Sister Naomi Baah', env: 'ENV-161', amt: 20000n },
    { memId: 'mem-014', name: 'Brother Samuel Ansah', env: 'ENV-175', amt: 25000n },
    { memId: 'mem-015', name: 'Deacon Isaac Quaye', env: 'ENV-183', amt: 35000n },
    { memId: 'mem-016', name: 'Sister Lydia Sarpong', env: 'ENV-198', amt: 15000n },
    { memId: 'mem-017', name: 'Brother Daniel Arthur', env: 'ENV-204', amt: 20000n },
    { memId: 'mem-018', name: 'Sister Comfort Frimpong', env: 'ENV-219', amt: 25000n },
    { memId: 'mem-019', name: 'Elder Peter Mensah', env: 'ENV-225', amt: 30000n },
    { memId: 'mem-025', name: 'Deacon Philip Donkor', env: 'ENV-289', amt: 25000n },
    { memId: 'mem-030', name: 'Brother David Sackey', env: 'ENV-335', amt: 15000n },
    { memId: 'mem-031', name: 'Sister Rita Tagoe', env: 'ENV-348', amt: 10000n },
  ]; // Sum = 5,800.00 GHS

  oct18Amounts.forEach((m, idx) => {
    records.push({
      id: `tr-2026-10-18-${(idx + 1).toString().padStart(2, '0')}`,
      branchId,
      batchId: 'tb-2026-10-18',
      memberId: m.memId,
      memberName: m.name,
      envelopeNumber: m.env,
      recordDate: '2026-10-18',
      amount: m.amt,
      currency: 'GHS',
      method: 'ENVELOPE',
      recordedBy: 'user-0002-sec',
      createdAt: '2026-10-18T14:40:00Z',
    });
  });

  // Seed records for Oct 25 (Counted = 6,100.00, Allocated = 5,750.00, Unallocated = 350.00)
  const oct25Amounts: { memId: string; name: string; env: string; amt: bigint }[] = [
    { memId: 'mem-001', name: 'Elder Kofi Mensah', env: 'ENV-012', amt: 50000n },
    { memId: 'mem-002', name: 'Sister Akua Mansa', env: 'ENV-019', amt: 35000n },
    { memId: 'mem-003', name: 'Deacon Kwabena Acheampong', env: 'ENV-045', amt: 40000n },
    { memId: 'mem-004', name: 'Sister Efua Dadson', env: 'ENV-077', amt: 25000n },
    { memId: 'mem-005', name: 'Brother Emmanuel Ofori', env: 'ENV-088', amt: 30000n },
    { memId: 'mem-006', name: 'Sister Akosua Osei', env: 'ENV-092', amt: 30000n },
    { memId: 'mem-007', name: 'Rev. Emmanuel Addo', env: 'ENV-103', amt: 60000n },
    { memId: 'mem-010', name: 'Brother Justice Appiah', env: 'ENV-134', amt: 25000n },
    { memId: 'mem-011', name: 'Brother Yaw Kwarteng', env: 'ENV-142', amt: 20000n },
    { memId: 'mem-012', name: 'Deaconess Grace Darko', env: 'ENV-156', amt: 45000n },
    { memId: 'mem-014', name: 'Brother Samuel Ansah', env: 'ENV-175', amt: 25000n },
    { memId: 'mem-015', name: 'Deacon Isaac Quaye', env: 'ENV-183', amt: 35000n },
    { memId: 'mem-018', name: 'Sister Comfort Frimpong', env: 'ENV-219', amt: 25000n },
    { memId: 'mem-019', name: 'Elder Peter Mensah', env: 'ENV-225', amt: 30000n },
    { memId: 'mem-021', name: 'Brother Joseph Agyeman', env: 'ENV-241', amt: 20000n },
    { memId: 'mem-023', name: 'Brother Paul Danquah', env: 'ENV-268', amt: 30000n },
    { memId: 'mem-025', name: 'Deacon Philip Donkor', env: 'ENV-289', amt: 25000n },
    { memId: 'mem-028', name: 'Elder Seth Owusu', env: 'ENV-312', amt: 35000n },
    { memId: 'mem-030', name: 'Brother David Sackey', env: 'ENV-335', amt: 10000n },
    { memId: 'mem-031', name: 'Sister Rita Tagoe', env: 'ENV-348', amt: 15000n },
    { memId: 'mem-032', name: 'Brother Gideon Tetteh', env: 'ENV-354', amt: 15000n },
  ]; // Sum = 5,750.00 GHS (Leaves 350.00 GHS unallocated!)

  oct25Amounts.forEach((m, idx) => {
    records.push({
      id: `tr-2026-10-25-${(idx + 1).toString().padStart(2, '0')}`,
      branchId,
      batchId: 'tb-2026-10-25',
      memberId: m.memId,
      memberName: m.name,
      envelopeNumber: m.env,
      recordDate: '2026-10-25',
      amount: m.amt,
      currency: 'GHS',
      method: 'ENVELOPE',
      recordedBy: 'user-0002-sec',
      createdAt: '2026-10-25T14:50:00Z',
    });
  });

  // Direct non-service tithes via MoMo, Bank Transfer, and Cheque
  records.push({
    id: 'tr-direct-001',
    branchId,
    batchId: null,
    memberId: 'mem-008',
    memberName: 'Brother Kwame Boateng',
    envelopeNumber: 'ENV-115',
    recordDate: '2026-10-22',
    amount: 50000n, // 500.00 GHS
    currency: 'GHS',
    method: 'MOMO',
    cashAccountId: 'ca-momo-ghs',
    journalEntryId: 'je-tr-dir-001',
    notes: 'Mobile Money tithe transfer ref: MTN-99882',
    recordedBy: 'user-0002-sec',
    createdAt: '2026-10-22T10:15:00Z',
  });

  records.push({
    id: 'tr-direct-002',
    branchId,
    batchId: null,
    memberId: 'mem-009',
    memberName: 'Sister Abena Poku',
    envelopeNumber: 'ENV-120',
    recordDate: '2026-10-24',
    amount: 45000n, // 450.00 GHS
    currency: 'GHS',
    method: 'BANK_TRANSFER',
    cashAccountId: 'ca-bank-ghs',
    journalEntryId: 'je-tr-dir-002',
    notes: 'Direct bank transfer ref: GCB-TR-7821',
    recordedBy: 'user-0002-sec',
    createdAt: '2026-10-24T11:20:00Z',
  });

  records.push({
    id: 'tr-direct-003',
    branchId,
    batchId: null,
    memberId: 'mem-010',
    memberName: 'Brother Justice Appiah',
    envelopeNumber: 'ENV-134',
    recordDate: '2026-10-26',
    amount: 100000n, // 1,000.00 GHS
    currency: 'GHS',
    method: 'CHEQUE',
    cashAccountId: 'ca-bank-ghs',
    journalEntryId: 'je-tr-dir-003',
    notes: 'Monthly corporate tithe cheque no. 004128',
    recordedBy: 'user-0002-sec',
    createdAt: '2026-10-26T09:30:00Z',
  });

  // Example reversal record to show append-only corrections
  records.push({
    id: 'tr-rev-001',
    branchId,
    batchId: 'tb-2026-10-18',
    memberId: 'mem-005',
    memberName: 'Brother Emmanuel Ofori',
    envelopeNumber: 'ENV-088',
    recordDate: '2026-10-19',
    amount: -15000n, // -150.00 GHS
    currency: 'GHS',
    method: 'ENVELOPE',
    isReversal: true,
    reversalOfId: 'tr-2026-10-18-05',
    reversalReason: 'Misread envelope handwriting (was Sister Efua Dadson ENV-077, not Brother Emmanuel Ofori). Reversed and re-credited.',
    recordedBy: 'user-0001-treasurer',
    createdAt: '2026-10-19T09:00:00Z',
  });

  return records;
}

export const TithesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isDemoMode } = useDemo();
  const { enqueueItem } = useSync();
  const { recordPayment, recordReceipt, cashAccounts } = useCashbook();
  const { accounts, funds, addEntry } = useLedger();
  const { members } = useGiving();

  const [batches, setBatches] = useState<TitheBatch[]>(() => {
    return loadFromStore<TitheBatch[]>('tithe_batches', isDemoMode, isDemoMode ? SEED_TITHE_BATCHES : []);
  });

  const [records, setRecords] = useState<TitheRecord[]>(() => {
    return loadFromStore<TitheRecord[]>('tithe_records', isDemoMode, isDemoMode ? generateSeedTitheRecords() : []);
  });

  const [settings, setSettings] = useState<TitheSettings>(() => {
    return loadFromStore<TitheSettings>('tithe_settings', isDemoMode, DEFAULT_TITHE_SETTINGS) || DEFAULT_TITHE_SETTINGS;
  });

  const [remittanceRules, setRemittanceRules] = useState<TitheRemittanceRule[]>(() => {
    return (
      loadFromStore<TitheRemittanceRule[]>('tithe_remittance_rules', isDemoMode, isDemoMode ? SEED_REMITTANCE_RULES : []) ||
      (isDemoMode ? SEED_REMITTANCE_RULES : [])
    );
  });

  const [remittances, setRemittances] = useState<TitheRemittance[]>(() => {
    return (
      loadFromStore<TitheRemittance[]>('tithe_remittances', isDemoMode, isDemoMode ? SEED_REMITTANCES : []) ||
      (isDemoMode ? SEED_REMITTANCES : [])
    );
  });

  // Save changes to storage
  const persistBatches = useCallback((newBatches: TitheBatch[]) => {
    setBatches(newBatches);
    saveToStore('tithe_batches', isDemoMode, newBatches);
  }, [isDemoMode]);

  const persistRecords = useCallback((newRecords: TitheRecord[]) => {
    setRecords(newRecords);
    saveToStore('tithe_records', isDemoMode, newRecords);
  }, [isDemoMode]);

  const persistSettings = useCallback((newSettings: TitheSettings) => {
    setSettings(newSettings);
    saveToStore('tithe_settings', isDemoMode, newSettings);
  }, [isDemoMode]);

  const persistRemittanceRules = useCallback((newRules: TitheRemittanceRule[]) => {
    setRemittanceRules(newRules);
    saveToStore('tithe_remittance_rules', isDemoMode, newRules);
  }, [isDemoMode]);

  const persistRemittances = useCallback((newRemittances: TitheRemittance[]) => {
    setRemittances(newRemittances);
    saveToStore('tithe_remittances', isDemoMode, newRemittances);
  }, [isDemoMode]);

  // Privacy evaluation
  const canViewIndividualTithes = useMemo(() => {
    if (!currentUser) return false;
    const { role } = currentUser;
    if (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Auditor') {
      return true;
    }
    if (role === 'Pastor / Elder' && settings?.allowPastorViewIndividual) {
      return true;
    }
    return false;
  }, [currentUser, settings]);

  const safeEnqueue = useCallback((entityType: string, entityId: string, _action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
    try {
      if (!isDemoMode && enqueueItem) {
        enqueueItem({
          entityType,
          entityId,
          action: 'POST_JOURNAL_ENTRY' as any,
          payload: JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
          deviceId: currentUser?.deviceId || 'DEV-01',
        });
      }
    } catch (e) {
      console.warn('Sync enqueue failed', e);
    }
  }, [isDemoMode, enqueueItem, currentUser]);

  // Save batch draft (fast entry updates)
  const saveBatchDraft = useCallback(
    (
      batchId: string,
      updatedRecords: Omit<TitheRecord, 'id' | 'branchId' | 'createdAt'>[],
      explainedUnallocated: bigint = 0n,
      unallocatedReason?: string
    ) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return;
      if (batch.status === 'POSTED') {
        throw new Error('Posted batches are read-only and cannot be edited.');
      }

      const branchId = batch.branchId || '00000000-0000-0000-0000-000000000001';
      const newRecordsList: TitheRecord[] = updatedRecords.map((r, idx) => ({
        id: `tr-${batchId}-${(idx + 1).toString().padStart(3, '0')}`,
        branchId,
        batchId,
        memberId: r.memberId,
        memberName: r.memberName,
        envelopeNumber: r.envelopeNumber,
        recordDate: batch.serviceDate,
        amount: r.amount,
        currency: batch.currency,
        method: r.method,
        notes: r.notes,
        recordedBy: currentUser?.fullName || 'Finance Secretary',
        createdAt: new Date().toISOString(),
      }));

      // Remove existing records for this batch and replace with updated set
      const otherRecords = records.filter((r) => r.batchId !== batchId);
      const combinedRecords = [...otherRecords, ...newRecordsList];
      persistRecords(combinedRecords);

      const summary = calculateTitheBatchSummary(batch.countedTotal, newRecordsList, explainedUnallocated);

      const updatedBatch: TitheBatch = {
        ...batch,
        allocatedTotal: summary.allocatedTotal,
        unallocatedTotal: summary.unallocatedTotal,
        explainedUnallocated,
        unallocatedReason,
        recordsCount: newRecordsList.length,
        status: summary.isBalanced ? 'RECONCILED' : 'DRAFT',
        updatedAt: new Date().toISOString(),
      };

      const updatedBatches = batches.map((b) => (b.id === batchId ? updatedBatch : b));
      persistBatches(updatedBatches);
      safeEnqueue('tithe_batches', batchId, 'UPDATE', updatedBatch);

      logAuditEvent({
        action: 'UPDATE_TITHE_BATCH',
        record: `Batch ${batch.serviceDate} (${batch.serviceName})`,
        entityType: 'tithe_batches',
        entityId: batchId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Saved draft with ${newRecordsList.length} member records, allocated ${summary.allocatedTotal} pesewas.`,
      });
    },
    [batches, records, currentUser, persistRecords, persistBatches, safeEnqueue]
  );

  // Reconcile batch
  const reconcileBatch = useCallback(
    (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return { success: false, error: 'Batch not found.' };

      const batchRecords = records.filter((r) => r.batchId === batchId && !r.isReversal);
      const summary = calculateTitheBatchSummary(batch.countedTotal, batchRecords, batch.explainedUnallocated);

      if (!summary.isBalanced) {
        return { success: false, error: summary.message };
      }

      const updatedBatch: TitheBatch = {
        ...batch,
        allocatedTotal: summary.allocatedTotal,
        unallocatedTotal: summary.unallocatedTotal,
        status: 'RECONCILED',
        reconciledBy: currentUser?.id || 'user-sec',
        reconciledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedBatches = batches.map((b) => (b.id === batchId ? updatedBatch : b));
      persistBatches(updatedBatches);
      safeEnqueue('tithe_batches', batchId, 'UPDATE', updatedBatch);

      logAuditEvent({
        action: 'RECONCILE_TITHE_BATCH',
        record: `Batch ${batch.serviceDate}`,
        entityType: 'tithe_batches',
        entityId: batchId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Reconciled tithe batch against counting sheet ${batch.countingSheetId}.`,
      });

      return { success: true };
    },
    [batches, records, currentUser, persistBatches, safeEnqueue]
  );

  // Post batch (Treasurer verification)
  const postBatch = useCallback(
    (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return { success: false, error: 'Batch not found.' };

      const validation = validateTitheBatchPosting(
        batch,
        currentUser?.id || 'user-treasurer',
        settings?.requireTwoSignaturesToPost ?? true
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const updatedBatch: TitheBatch = {
        ...batch,
        status: 'POSTED',
        postedBy: currentUser?.id || 'user-treasurer',
        postedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedBatches = batches.map((b) => (b.id === batchId ? updatedBatch : b));
      persistBatches(updatedBatches);
      safeEnqueue('tithe_batches', batchId, 'UPDATE', updatedBatch);

      logAuditEvent({
        action: 'POST_TITHE_BATCH',
        record: `Batch ${batch.serviceDate}`,
        entityType: 'tithe_batches',
        entityId: batchId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Verified and posted tithe batch into sub-ledger. Batch is now read-only.`,
      });

      return { success: true };
    },
    [batches, currentUser, settings?.requireTwoSignaturesToPost, persistBatches, safeEnqueue]
  );

  // Delete unposted draft tithe batch
  const deleteDraftBatch = useCallback(
    (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return { success: false, error: 'Batch not found.' };

      if (batch.status === 'POSTED') {
        return { success: false, error: 'Posted batches cannot be deleted. Use append-only reversals.' };
      }

      // Remove draft batch and associated unposted records
      const updatedBatches = batches.filter((b) => b.id !== batchId);
      const updatedRecords = records.filter((r) => r.batchId !== batchId);

      persistBatches(updatedBatches);
      persistRecords(updatedRecords);
      safeEnqueue('tithe_batches', batchId, 'DELETE', { id: batchId });

      logAuditEvent({
        action: 'DELETE_DRAFT_TITHE_BATCH',
        record: `Batch ${batch.serviceDate} (${batch.serviceName})`,
        entityType: 'tithe_batches',
        entityId: batchId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Deleted unposted draft tithe batch. Counted: ${batch.countedTotal}, Allocated: ${batch.allocatedTotal}.`,
      });

      return { success: true };
    },
    [batches, records, currentUser, persistBatches, persistRecords, safeEnqueue]
  );

  // Record direct non-service tithe (posts GL receipt + tithe record)
  const recordDirectTithe = useCallback(
    (input: {
      memberId: string;
      memberName: string;
      envelopeNumber?: string;
      amount: bigint;
      currency: string;
      exchangeRate?: string;
      recordDate: string;
      method: 'MOMO' | 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';
      cashAccountId: string;
      reference?: string;
      narration: string;
    }) => {
      // 1. Post to Cashbook / General Ledger
      const targetCashAccount = cashAccounts.find((a) => a.id === input.cashAccountId) || cashAccounts[0]!;
      const targetFund = funds.find((f) => f.id === 'fund-gen') || funds[0]!;
      const targetIncomeAcct = accounts.find((a) => a.id === 'acct-4010') || accounts[0]!;

      const refNum = input.reference?.trim() || `RCT-${input.method}-${Date.now().toString().slice(-4)}`;

      const { cashbookEntry } = recordReceipt({
        cashAccount: targetCashAccount,
        receivedFrom: input.memberName,
        fund: targetFund,
        incomeAccount: targetIncomeAcct,
        amount: input.amount,
        method: input.method as any,
        refNumber: refNum,
        narration: input.narration || `Direct Tithe received from ${input.memberName}`,
        entryDate: input.recordDate,
      });

      // 2. Create sub-ledger TitheRecord
      const newRecord: TitheRecord = {
        id: `tr-dir-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        batchId: null,
        memberId: input.memberId,
        memberName: input.memberName,
        envelopeNumber: input.envelopeNumber,
        recordDate: input.recordDate,
        amount: input.amount,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        method: input.method,
        journalEntryId: cashbookEntry.journalEntryId || 'je-receipt',
        cashAccountId: input.cashAccountId,
        notes: input.reference ? `${input.reference} - ${input.narration}` : input.narration,
        recordedBy: currentUser?.fullName || 'Finance Secretary',
        createdAt: new Date().toISOString(),
      };

      const updatedRecords = [newRecord, ...records];
      persistRecords(updatedRecords);
      safeEnqueue('tithe_records', newRecord.id, 'INSERT', newRecord);

      logAuditEvent({
        action: 'RECORD_DIRECT_TITHE',
        record: `${input.memberName} (${input.method})`,
        entityType: 'tithe_records',
        entityId: newRecord.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Recorded direct tithe of ${input.amount} pesewas and posted cashbook receipt ${cashbookEntry.refNumber || cashbookEntry.id}.`,
      });

      return { record: newRecord, receiptRef: cashbookEntry.refNumber || cashbookEntry.id };
    },
    [recordReceipt, cashAccounts, funds, accounts, currentUser, records, persistRecords, safeEnqueue]
  );

  // Reverse erroneous tithe record (append-only)
  const reverseTithe = useCallback(
    (recordId: string, reason: string) => {
      const original = records.find((r) => r.id === recordId);
      if (!original) throw new Error('Tithe record not found.');

      const reversalRecord = createTitheReversal(
        original,
        reason,
        currentUser?.fullName || 'Treasurer'
      );

      const updatedRecords = [reversalRecord, ...records];
      persistRecords(updatedRecords);
      safeEnqueue('tithe_records', reversalRecord.id, 'INSERT', reversalRecord);

      logAuditEvent({
        action: 'REVERSE_TITHE_RECORD',
        record: `${original.memberName} (${original.id})`,
        entityType: 'tithe_records',
        entityId: reversalRecord.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Reversed tithe record ${original.id} with reason: ${reason}`,
      });

      return reversalRecord;
    },
    [records, currentUser, persistRecords, safeEnqueue]
  );

  // Create new batch from signed counting sheet
  const createBatchFromCountingSheet = useCallback(
    (params: {
      countingSheetId: string;
      serviceDate: string;
      serviceName: string;
      currency: string;
      countedTotal: bigint;
    }) => {
      const newBatch: TitheBatch = {
        id: `tb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        countingSheetId: params.countingSheetId,
        serviceDate: params.serviceDate,
        serviceName: params.serviceName,
        currency: params.currency,
        countedTotal: params.countedTotal,
        allocatedTotal: 0n,
        unallocatedTotal: params.countedTotal,
        explainedUnallocated: 0n,
        status: 'DRAFT',
        recordsCount: 0,
        createdAt: new Date().toISOString(),
      };

      const updatedBatches = [newBatch, ...batches];
      persistBatches(updatedBatches);
      safeEnqueue('tithe_batches', newBatch.id, 'INSERT', newBatch);

      logAuditEvent({
        action: 'CREATE_TITHE_BATCH',
        record: `Batch ${params.serviceDate}`,
        entityType: 'tithe_batches',
        entityId: newBatch.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Created new tithe batch from counting sheet ${params.countingSheetId}.`,
      });

      return newBatch;
    },
    [batches, currentUser, persistBatches, safeEnqueue]
  );

  // Member Tithe Summary
  const getMemberSummary = useCallback(
    (memberId: string, referenceYear: number = 2026, referenceMonth: number = 10) => {
      const member = members.find((m) => m.id === memberId);
      const name = member?.fullName || member?.lastName || 'Member';
      return calculateMemberTitheSummary(
        memberId,
        name,
        records,
        referenceYear,
        referenceMonth,
        member?.envelopeNumber
      );
    },
    [members, records]
  );

  // Aggregate participation stats
  const getParticipationStats = useCallback(
    (period: string = '2026-10', currency: string = 'GHS') => {
      const activeMembersCount = members.filter((m) => m.status === 'ACTIVE').length || 40;
      return calculateTitheParticipation(
        records,
        activeMembersCount,
        period,
        currency,
        settings.distributionBandsGhs
      );
    },
    [records, members, settings.distributionBandsGhs]
  );

  // Audit log triggers
  const logMemberTithesView = useCallback(
    (memberId: string, memberName: string) => {
      logAuditEvent({
        action: 'VIEW_MEMBER_TITHES',
        record: memberName,
        entityType: 'member_tithes',
        entityId: memberId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Viewed confidential tithe history and consistency metrics.`,
      });
    },
    [currentUser]
  );

  const logExport = useCallback(
    (format: string, rowCount: number) => {
      logAuditEvent({
        action: 'EXPORT_TITHES',
        record: format.toUpperCase(),
        entityType: 'tithe_records',
        entityId: 'all',
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Exported ${rowCount} tithe records to ${format.toUpperCase()}.`,
      });
    },
    [currentUser]
  );

  const logStatementPrint = useCallback(
    (memberId: string, memberName: string) => {
      logAuditEvent({
        action: 'PRINT_TITHE_STATEMENT',
        record: memberName,
        entityType: 'tithe_statement',
        entityId: memberId,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Generated and printed formal annual tithe statement.`,
      });
    },
    [currentUser]
  );

  const updateSettings = useCallback(
    (newSettings: Partial<TitheSettings>) => {
      const updated = { ...settings, ...newSettings };
      persistSettings(updated);
    },
    [settings, persistSettings]
  );

  const saveRemittanceRule = useCallback(
    (ruleData: Omit<TitheRemittanceRule, 'id' | 'createdAt'>, id?: string) => {
      if (currentUser?.role !== 'Treasurer') {
        throw new Error('Only the Treasurer is authorized to configure remittance rules.');
      }
      let ruleToSave: TitheRemittanceRule;
      if (id) {
        ruleToSave = {
          ...ruleData,
          id,
          createdAt: remittanceRules.find((r) => r.id === id)?.createdAt || new Date().toISOString(),
        };
        const updated = remittanceRules.map((r) => (r.id === id ? ruleToSave : r));
        persistRemittanceRules(updated);
      } else {
        ruleToSave = {
          ...ruleData,
          id: `trr-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        const updated = [...remittanceRules, ruleToSave];
        persistRemittanceRules(updated);
      }

      logAuditEvent({
        action: 'SAVE_REMITTANCE_RULE',
        record: ruleToSave.name,
        entityType: 'tithe_remittance_rules',
        entityId: ruleToSave.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Configured remittance rule ${ruleToSave.name} (${ruleToSave.basis === 'PERCENTAGE' ? ruleToSave.percentageOrAmount + '%' : ruleToSave.percentageOrAmount}).`,
      });

      return ruleToSave;
    },
    [currentUser, remittanceRules, persistRemittanceRules]
  );

  const deleteRemittanceRule = useCallback(
    (id: string) => {
      if (currentUser?.role !== 'Treasurer') {
        throw new Error('Only the Treasurer is authorized to delete remittance rules.');
      }
      persistRemittanceRules(remittanceRules.filter((r) => r.id !== id));
      logAuditEvent({
        action: 'DELETE_REMITTANCE_RULE',
        record: id,
        entityType: 'tithe_remittance_rules',
        entityId: id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Deleted remittance rule ${id}.`,
      });
    },
    [currentUser, remittanceRules, persistRemittanceRules]
  );

  const accrueMonthlyRemittance = useCallback(
    (period: string, ruleId?: string) => {
      const activeRule = ruleId
        ? remittanceRules.find((r) => r.id === ruleId)
        : remittanceRules.find((r) => r.isActive);

      if (!activeRule) {
        throw new Error('No active tithe remittance rule configured in settings.');
      }

      // Calculate gross tithes received in that period
      const periodBatches = batches.filter((b) => b.serviceDate.startsWith(period));
      const countedSunday = periodBatches.reduce((sum, b) => sum + b.countedTotal, 0n);
      const directRecords = records.filter(
        (r) => !r.batchId && r.recordDate.startsWith(period) && !r.isReversal
      );
      const directTotal = directRecords.reduce((sum, r) => sum + r.amount, 0n);
      const grossTithesBasis = countedSunday + directTotal;

      const calc = calculateRemittanceDue(activeRule, grossTithesBasis, period);

      // Post GL entry: Dr Remittance Expense (acct-5060), Cr Denominational Remittances Payable (acct-2050)
      const docNum = `JE-REM-${period.replace('-', '')}`;
      const generalFund = funds.find((f) => f.id === 'fund-gen') || INITIAL_FUNDS[0]!;
      const expenseAcct =
        accounts.find((a) => a.id === 'acct-5060') ||
        INITIAL_ACCOUNTS.find((a) => a.id === 'acct-5060')!;
      const payableAcct =
        accounts.find((a) => a.id === 'acct-2050') ||
        INITIAL_ACCOUNTS.find((a) => a.id === 'acct-2050')!;

      const entryId = `je-rem-${period}-${Date.now()}`;
      const entry = createJournalEntry({
        id: entryId,
        branchId: activeRule.branchId,
        documentNumber: docNum,
        entryDate: calc.dueDate,
        narration: `Accrual of denominational tithe remittance for ${period} (${activeRule.name})`,
        createdBy: currentUser?.fullName || 'Treasurer',
        deviceId: currentUser?.deviceId || 'DEV-01',
        lines: [
          {
            id: `line-${docNum}-1`,
            accountId: expenseAcct.id,
            fundId: generalFund.id,
            originalCurrency: (activeRule.currency as 'GHS' | 'USD') || 'GHS',
            originalAmount: calc.amountDue,
            exchangeRate: '1.0000',
            isDebit: true,
            description: `Denominational remittance expense (${activeRule.name})`,
          },
          {
            id: `line-${docNum}-2`,
            accountId: payableAcct.id,
            fundId: generalFund.id,
            originalCurrency: (activeRule.currency as 'GHS' | 'USD') || 'GHS',
            originalAmount: calc.amountDue,
            exchangeRate: '1.0000',
            isDebit: false,
            description: `Payable to ${activeRule.payeeName}`,
          },
        ],
      });
      addEntry(entry);

      // Update or create remittance item
      const existing = remittances.find((r) => r.period === period && r.ruleId === activeRule.id);
      const paid = existing ? existing.amountPaid : 0n;
      const status = evaluateRemittanceStatus(calc.amountDue, paid, calc.dueDate);

      const remittanceItem: TitheRemittance = {
        id: existing?.id || `rem-${period}-${activeRule.id}`,
        branchId: activeRule.branchId,
        ruleId: activeRule.id,
        ruleName: activeRule.name,
        period,
        tithesBasisGhs: grossTithesBasis,
        rateUsed: calc.rateOrAmount,
        amountDue: calc.amountDue,
        amountPaid: paid,
        balanceOutstanding: calc.amountDue - paid,
        currency: activeRule.currency,
        status,
        dueDate: calc.dueDate,
        voucherIds: existing?.voucherIds || [],
        journalEntryId: docNum,
        notes: `Accrued assessment for ${activeRule.payeeName}`,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedRemittances = [
        ...remittances.filter((r) => r.id !== remittanceItem.id),
        remittanceItem,
      ];
      persistRemittances(updatedRemittances);

      logAuditEvent({
        action: 'ACCRUE_TITHE_REMITTANCE',
        record: `${period} (${activeRule.name})`,
        entityType: 'tithe_remittances',
        entityId: remittanceItem.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Accrued ${calc.amountDue} pesewas for period ${period} (${calc.rateOrAmount}).`,
      });

      return remittanceItem;
    },
    [
      remittanceRules,
      batches,
      records,
      funds,
      accounts,
      addEntry,
      currentUser,
      remittances,
      persistRemittances,
    ]
  );

  const payRemittanceViaVoucher = useCallback(
    (params: {
      remittanceId: string;
      paymentAmount: bigint;
      paymentMethod: 'CHEQUE' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
      cashAccountId: string;
      chequeNumber?: string;
      momoNumber?: string;
      momoNetwork?: string;
      notes?: string;
    }) => {
      const remittance = remittances.find((r) => r.id === params.remittanceId);
      if (!remittance) {
        throw new Error('Remittance record not found.');
      }

      if (params.paymentAmount <= 0n) {
        throw new Error('Payment amount must be greater than zero.');
      }

      const rule = remittanceRules.find((r) => r.id === remittance.ruleId);
      const payeeName = rule?.payeeName || 'Accra District Office';
      const cashAccount =
        cashAccounts.find((c) => c.id === params.cashAccountId) || cashAccounts[0]!;
      const generalFund = funds.find((f) => f.id === 'fund-gen') || INITIAL_FUNDS[0]!;
      const payableAcct =
        accounts.find((a) => a.id === 'acct-2050') ||
        INITIAL_ACCOUNTS.find((a) => a.id === 'acct-2050')!;

      // Voucher number
      const voucherNumber = `PV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const entryDate = new Date().toISOString().split('T')[0] ?? '2026-11-02';

      // Record disbursement in cashbook & general ledger (Dr Remittances Payable, Cr Cash/Bank)
      const cashbookMethod =
        params.paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : params.paymentMethod;

      recordPayment({
        cashAccount,
        entryDate,
        paidTo: payeeName,
        linkedVoucherId: voucherNumber,
        fund: generalFund,
        expenseAccount: payableAcct, // Dr Remittances Payable
        amount: params.paymentAmount,
        method: cashbookMethod,
        chequeNumber: params.chequeNumber,
        narration: `Payment of ${remittance.period} tithe remittance to ${payeeName} (Voucher ${voucherNumber})`,
        category: 'Remittance',
      });

      const newAmountPaid = remittance.amountPaid + params.paymentAmount;
      const newBalance = remittance.amountDue - newAmountPaid;
      const newStatus = evaluateRemittanceStatus(
        remittance.amountDue,
        newAmountPaid,
        remittance.dueDate
      );

      const updatedRemittance: TitheRemittance = {
        ...remittance,
        amountPaid: newAmountPaid,
        balanceOutstanding: newBalance,
        status: newStatus,
        voucherIds: [...remittance.voucherIds, voucherNumber],
        notes: params.notes
          ? `${remittance.notes ? remittance.notes + ' · ' : ''}${params.notes}`
          : remittance.notes,
        updatedAt: new Date().toISOString(),
      };

      const updatedList = remittances.map((r) => (r.id === remittance.id ? updatedRemittance : r));
      persistRemittances(updatedList);

      logAuditEvent({
        action: 'PAY_TITHE_REMITTANCE',
        record: `${remittance.period} (${payeeName})`,
        entityType: 'tithe_remittances',
        entityId: remittance.id,
        userName: currentUser?.fullName || 'Treasurer',
        userRole: currentUser?.role,
        details: `Disbursed remittance payment of ${params.paymentAmount} pesewas via voucher ${voucherNumber} (${params.paymentMethod}).`,
      });

      return { remittance: updatedRemittance, voucherNumber };
    },
    [
      remittances,
      remittanceRules,
      cashAccounts,
      funds,
      accounts,
      recordPayment,
      persistRemittances,
      currentUser,
    ]
  );

  const getOverdueRemittances = useCallback(
    (referenceDate: string = '2026-11-02') => {
      return remittances.filter((r) => isRemittanceOverdue(r, referenceDate));
    },
    [remittances]
  );

  const value = useMemo(
    () => ({
      batches,
      records,
      settings,
      remittanceRules,
      remittances,
      canViewIndividualTithes,
      saveBatchDraft,
      reconcileBatch,
      postBatch,
      deleteDraftBatch,
      recordDirectTithe,
      reverseTithe,
      createBatchFromCountingSheet,
      getMemberSummary,
      getParticipationStats,
      logMemberTithesView,
      logExport,
      logStatementPrint,
      updateSettings,
      saveRemittanceRule,
      deleteRemittanceRule,
      accrueMonthlyRemittance,
      payRemittanceViaVoucher,
      getOverdueRemittances,
    }),
    [
      batches,
      records,
      settings,
      remittanceRules,
      remittances,
      canViewIndividualTithes,
      saveBatchDraft,
      reconcileBatch,
      postBatch,
      deleteDraftBatch,
      recordDirectTithe,
      reverseTithe,
      createBatchFromCountingSheet,
      getMemberSummary,
      getParticipationStats,
      logMemberTithesView,
      logExport,
      logStatementPrint,
      updateSettings,
      saveRemittanceRule,
      deleteRemittanceRule,
      accrueMonthlyRemittance,
      payRemittanceViaVoucher,
      getOverdueRemittances,
    ]
  );

  return <TithesContext.Provider value={value}>{children}</TithesContext.Provider>;
};

export const useTithes = (): TithesContextType => {
  const context = useContext(TithesContext);
  if (!context) {
    return {
      batches: [],
      records: [],
      settings: DEFAULT_TITHE_SETTINGS,
      remittanceRules: SEED_REMITTANCE_RULES,
      remittances: SEED_REMITTANCES,
      canViewIndividualTithes: false,
      saveBatchDraft: () => {},
      reconcileBatch: () => ({ success: true }),
      postBatch: () => ({ success: true }),
      deleteDraftBatch: () => ({ success: false, error: 'TithesContext not found' }),
      recordDirectTithe: () => ({ record: {} as any, receiptRef: '' }),
      reverseTithe: () => ({} as any),
      createBatchFromCountingSheet: () => ({} as any),
      getMemberSummary: () => ({} as any),
      getParticipationStats: () => ({} as any),
      logMemberTithesView: () => {},
      logExport: () => {},
      logStatementPrint: () => {},
      updateSettings: () => {},
      saveRemittanceRule: () => ({} as any),
      deleteRemittanceRule: () => {},
      accrueMonthlyRemittance: () => ({} as any),
      payRemittanceViaVoucher: () => ({ remittance: {} as any, voucherNumber: '' }),
      getOverdueRemittances: () => [],
    };
  }
  return context;
};
