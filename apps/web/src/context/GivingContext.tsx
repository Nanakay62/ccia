import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Member,
  Pledge,
  CountingSheet,
  MemberGivingRecord,
  ServiceType,
  CashDenominationCount,
  ChequeRecord,
  MoMoRecord,
  FundAllocationLine,
} from '@church/domain';
import {
  calculateDenominationTotal,
  calculateChequeTotal,
  calculateMomoTotal,
  validateTwoCounterSignOff,
  generateJournalEntryFromCountingSheet,
  maskGivingRecordForRole,
  maskPledgeForRole,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';

export const SEED_MEMBERS: Member[] = [
  {
    id: 'mem-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-001',
    envelopeNumber: 'ENV-012',
    fullName: 'Kofi Mensah',
    phone: '+233 24 111 2222',
    phoneHint: '222',
    email: 'kofi.mensah@example.com',
    familyGroup: 'Mensah Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2022-01-15',
    rowVersion: 1,
  },
  {
    id: 'mem-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-002',
    envelopeNumber: 'ENV-019',
    fullName: 'Akua Mansa',
    phone: '+233 20 333 4444',
    phoneHint: '444',
    email: 'akua.mansa@example.com',
    familyGroup: 'Mansa Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2021-06-10',
    rowVersion: 1,
  },
  {
    id: 'mem-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-003',
    envelopeNumber: 'ENV-045',
    fullName: 'Deacon Kwabena Acheampong',
    phone: '+233 24 555 6666',
    phoneHint: '666',
    email: 'kwabena.ach@example.com',
    familyGroup: 'Acheampong Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2019-03-20',
    rowVersion: 1,
  },
  {
    id: 'mem-004',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-004',
    envelopeNumber: 'ENV-077',
    fullName: 'Sister Efua Dadson',
    phone: '+233 50 777 8888',
    phoneHint: '888',
    email: 'efua.dadson@example.com',
    familyGroup: 'Dadson Family',
    department: 'Choir',
    status: 'ACTIVE',
    joinDate: '2023-02-01',
    rowVersion: 1,
  },
  {
    id: 'mem-005',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-005',
    envelopeNumber: 'ENV-088',
    fullName: 'Brother Emmanuel Ofori',
    phone: '+233 24 888 9999',
    phoneHint: '999',
    email: 'emmanuel.ofori@example.com',
    familyGroup: 'Ofori Family',
    department: 'Ushers',
    status: 'ACTIVE',
    joinDate: '2024-05-12',
    rowVersion: 1,
  },
];

export const SEED_PLEDGES: Pledge[] = [
  {
    id: 'pld-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-001',
    memberName: 'Kofi Mensah',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-08-01',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 500000n, // GHS 5,000.00
    paidAmountPesewas: 350000n, // GHS 3,500.00
    status: 'ACTIVE',
    notes: 'Pledged towards auditorium roofing tiles',
  },
  {
    id: 'pld-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-002',
    memberName: 'Akua Mansa',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-08-15',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 300000n, // GHS 3,000.00
    paidAmountPesewas: 300000n, // GHS 3,000.00
    status: 'FULFILLED',
    notes: 'Paid in 3 equal monthly installments',
  },
  {
    id: 'pld-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-003',
    memberName: 'Deacon Kwabena Acheampong',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-09-01',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 1000000n, // GHS 10,000.00
    paidAmountPesewas: 450000n, // GHS 4,500.00
    status: 'ACTIVE',
    notes: 'Supporting church soundproofing installation',
  },
];

export const SEED_GIVING_RECORDS: MemberGivingRecord[] = [
  {
    id: 'rec-101',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-001',
    memberName: 'Kofi Mensah',
    memberNumber: 'MEM-001',
    envelopeNumber: 'ENV-012',
    serviceDate: '2026-10-18',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    category: 'Tithe',
    paymentMethod: 'CASH',
    currency: 'GHS',
    amountPesewas: 120000n, // GHS 1,200.00
    receiptNumber: 'REC-FS-D01-000031',
    createdAt: '2026-10-18T12:30:00Z',
  },
  {
    id: 'rec-102',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-002',
    memberName: 'Akua Mansa',
    memberNumber: 'MEM-002',
    envelopeNumber: 'ENV-019',
    serviceDate: '2026-10-18',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    category: 'Building Pledge',
    paymentMethod: 'MOMO',
    currency: 'GHS',
    amountPesewas: 100000n, // GHS 1,000.00
    receiptNumber: 'REC-FS-D01-000032',
    createdAt: '2026-10-18T12:35:00Z',
  },
  {
    id: 'rec-103',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-003',
    memberName: 'Deacon Kwabena Acheampong',
    memberNumber: 'MEM-003',
    envelopeNumber: 'ENV-045',
    serviceDate: '2026-10-25',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    category: 'Tithe',
    paymentMethod: 'CHEQUE',
    currency: 'GHS',
    amountPesewas: 250000n, // GHS 2,500.00
    receiptNumber: 'REC-FS-D01-000033',
    createdAt: '2026-10-25T11:45:00Z',
  },
  {
    id: 'rec-104',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-004',
    memberName: 'Sister Efua Dadson',
    memberNumber: 'MEM-004',
    envelopeNumber: 'ENV-077',
    serviceDate: '2026-10-25',
    fundId: 'fund-mis',
    fundName: 'Missions & Outreach',
    category: 'Special Offering',
    paymentMethod: 'CASH',
    currency: 'USD',
    amountPesewas: 10000n, // $100.00
    receiptNumber: 'REC-FS-D01-000034',
    createdAt: '2026-10-25T12:00:00Z',
  },
];

export const SEED_COUNTING_SHEETS: CountingSheet[] = [
  {
    id: 'cs-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    sheetNumber: 'CS-CNT-000001',
    serviceDate: '2026-10-18',
    serviceType: 'Sunday 1st Service',
    cashDenominationsGhs: [
      { denomination: 200, count: 15 },
      { denomination: 100, count: 35 },
      { denomination: 50, count: 40 },
      { denomination: 20, count: 50 },
    ],
    cashDenominationsUsd: [{ denomination: 100, count: 2 }],
    cheques: [
      { id: 'chq-1', drawerName: 'Kwesi Darko', bankName: 'GCB Bank', chequeNumber: '00891', amountPesewas: 150000n, currency: 'GHS' },
    ],
    momoTransactions: [
      { id: 'mo-1', network: 'MTN', senderName: 'Ama Osei', transactionReference: 'MTN-77123', amountPesewas: 80000n },
    ],
    fundAllocations: [
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe', amountPesewas: 580000n, currency: 'GHS' },
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering', amountPesewas: 600000n, currency: 'GHS' },
    ],
    firstCounterId: 'user-0003-counter',
    firstCounterName: 'Sister Grace Addo (Counter 1)',
    firstSignedAt: '2026-10-18T13:00:00Z',
    secondCounterId: 'user-0004-counter2',
    secondCounterName: 'Brother Emmanuel Ofori (Counter 2)',
    secondSignedAt: '2026-10-18T13:08:00Z',
    status: 'POSTED',
    totalCashGhsPesewas: 950000n,
    totalCashUsdCents: 20000n,
    totalChequesGhsPesewas: 150000n,
    totalMomoGhsPesewas: 80000n,
    grandTotalGhsPesewas: 1180000n,
    grandTotalUsdCents: 20000n,
  },
];

interface GivingContextType {
  members: Member[];
  pledges: Pledge[];
  givingRecords: MemberGivingRecord[];
  countingSheets: CountingSheet[];
  addMember: (member: Omit<Member, 'id' | 'rowVersion'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  recordPledge: (pledge: Omit<Pledge, 'id' | 'paidAmountPesewas' | 'status'>) => Pledge;
  recordGiving: (
    data: Omit<MemberGivingRecord, 'id' | 'receiptNumber' | 'createdAt'>
  ) => MemberGivingRecord;
  submitCountingSheet: (params: {
    serviceDate: string;
    serviceType: ServiceType;
    cashGhs: CashDenominationCount[];
    cashUsd: CashDenominationCount[];
    cheques: ChequeRecord[];
    momo: MoMoRecord[];
    allocations: FundAllocationLine[];
    firstCounterId: string;
    firstCounterName: string;
    secondCounterId: string;
    secondCounterName: string;
    exchangeRateUsd?: string;
  }) => { sheet: CountingSheet; journalEntryId: string };
  getMaskedGivingRecords: () => MemberGivingRecord[];
  getMaskedPledges: () => Pledge[];
}

const GivingContext = createContext<GivingContextType | undefined>(undefined);

export const GivingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS);
  const [pledges, setPledges] = useState<Pledge[]>(SEED_PLEDGES);
  const [givingRecords, setGivingRecords] = useState<MemberGivingRecord[]>(SEED_GIVING_RECORDS);
  const [countingSheets, setCountingSheets] = useState<CountingSheet[]>(SEED_COUNTING_SHEETS);

  const addMember = useCallback(
    (memberData: Omit<Member, 'id' | 'rowVersion'>) => {
      const newMember: Member = {
        ...memberData,
        id: `mem-${Date.now()}`,
        rowVersion: 1,
      };
      setMembers((prev) => [newMember, ...prev]);

      // Queue offline sync
      enqueueItem({
        entityId: newMember.id,
        entityType: 'MEMBER',
        action: 'UPDATE_MEMBER',
        payload: { ...newMember, client_version: 1 },
        deviceId: currentUser.deviceId,
      });

      return newMember;
    },
    [currentUser, enqueueItem]
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Member>) => {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            const nextVersion = m.rowVersion + 1;
            const updated = { ...m, ...updates, rowVersion: nextVersion };
            enqueueItem({
              entityId: id,
              entityType: 'MEMBER',
              action: 'UPDATE_MEMBER',
              payload: { ...updated, client_version: m.rowVersion },
              deviceId: currentUser.deviceId,
            });
            return updated;
          }
          return m;
        })
      );
    },
    [currentUser, enqueueItem]
  );

  const recordPledge = useCallback(
    (pledgeData: Omit<Pledge, 'id' | 'paidAmountPesewas' | 'status'>) => {
      const newPledge: Pledge = {
        ...pledgeData,
        id: `pld-${Date.now()}`,
        paidAmountPesewas: 0n,
        status: 'ACTIVE',
      };
      setPledges((prev) => [newPledge, ...prev]);
      return newPledge;
    },
    []
  );

  const recordGiving = useCallback(
    (data: Omit<MemberGivingRecord, 'id' | 'receiptNumber' | 'createdAt'>) => {
      const receiptNumber = `REC-${currentUser.devicePrefix}-${Date.now().toString().slice(-6)}`;
      const newRecord: MemberGivingRecord = {
        ...data,
        id: `rec-${Date.now()}`,
        receiptNumber,
        createdAt: new Date().toISOString(),
      };

      setGivingRecords((prev) => [newRecord, ...prev]);

      // If tied to a pledge, update paid amount
      if (data.category === 'Building Pledge' && data.memberId) {
        setPledges((prev) =>
          prev.map((p) => {
            if (p.memberId === data.memberId && p.status === 'ACTIVE') {
              const updatedPaid = p.paidAmountPesewas + data.amountPesewas;
              const isFulfilled = updatedPaid >= p.targetAmountPesewas;
              return {
                ...p,
                paidAmountPesewas: updatedPaid,
                status: isFulfilled ? 'FULFILLED' : 'ACTIVE',
              };
            }
            return p;
          })
        );
      }

      // Enqueue sync operation
      enqueueItem({
        entityId: newRecord.id,
        entityType: 'MEMBER_GIVING',
        action: 'POST_JOURNAL_ENTRY',
        payload: {
          id: newRecord.id,
          receipt_number: receiptNumber,
          member_id: newRecord.memberId,
          amount_pesewas: Number(newRecord.amountPesewas),
          fund_id: newRecord.fundId,
          category: newRecord.category,
        },
        deviceId: currentUser.deviceId,
      });

      return newRecord;
    },
    [currentUser, enqueueItem]
  );

  const submitCountingSheet = useCallback(
    (params: {
      serviceDate: string;
      serviceType: ServiceType;
      cashGhs: CashDenominationCount[];
      cashUsd: CashDenominationCount[];
      cheques: ChequeRecord[];
      momo: MoMoRecord[];
      allocations: FundAllocationLine[];
      firstCounterId: string;
      firstCounterName: string;
      secondCounterId: string;
      secondCounterName: string;
      exchangeRateUsd?: string;
    }) => {
      // 1. Verify two-counter sign-off
      const validation = validateTwoCounterSignOff(
        params.firstCounterId,
        params.secondCounterId
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const totalCashGhs = calculateDenominationTotal(params.cashGhs);
      const totalCashUsd = calculateDenominationTotal(params.cashUsd);
      const totalCheques = calculateChequeTotal(params.cheques);
      const totalMomo = calculateMomoTotal(params.momo);
      const grandTotalGhs = totalCashGhs + totalCheques + totalMomo;

      const sheetId = `cs-${Date.now()}`;
      const sheetNumber = `CS-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;

      const sheet: CountingSheet = {
        id: sheetId,
        branchId: currentUser.branchId,
        sheetNumber,
        serviceDate: params.serviceDate,
        serviceType: params.serviceType,
        cashDenominationsGhs: params.cashGhs,
        cashDenominationsUsd: params.cashUsd,
        cheques: params.cheques,
        momoTransactions: params.momo,
        fundAllocations: params.allocations,
        firstCounterId: params.firstCounterId,
        firstCounterName: params.firstCounterName,
        firstSignedAt: new Date().toISOString(),
        secondCounterId: params.secondCounterId,
        secondCounterName: params.secondCounterName,
        secondSignedAt: new Date().toISOString(),
        status: 'POSTED',
        totalCashGhsPesewas: totalCashGhs,
        totalCashUsdCents: totalCashUsd,
        totalChequesGhsPesewas: totalCheques,
        totalMomoGhsPesewas: totalMomo,
        grandTotalGhsPesewas: grandTotalGhs,
        grandTotalUsdCents: totalCashUsd,
      };

      // 2. Automatically generate balanced double-entry Journal Entry
      const entry = generateJournalEntryFromCountingSheet({
        sheet,
        branchId: currentUser.branchId,
        documentNumber: `JE-${sheetNumber}`,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        exchangeRateUsd: params.exchangeRateUsd,
      });

      // 3. Post to local Ledger
      addEntry(entry);

      // 4. Update counting sheet state
      setCountingSheets((prev) => [{ ...sheet, journalEntryId: entry.id }, ...prev]);

      // 5. Enqueue for offline sync
      enqueueItem({
        entityId: sheet.id,
        entityType: 'COUNTING_SHEET',
        action: 'SUBMIT_COUNTING_SHEET',
        payload: {
          id: sheet.id,
          sheet_number: sheet.sheetNumber,
          service_date: sheet.serviceDate,
          counter_a_id: sheet.firstCounterId,
          counter_b_id: sheet.secondCounterId,
          total_ghs: Number(sheet.grandTotalGhsPesewas),
        },
        deviceId: currentUser.deviceId,
      });

      return { sheet, journalEntryId: entry.id };
    },
    [currentUser, addEntry, enqueueItem]
  );

  // Return giving records with donor names masked if current role lacks permission
  const getMaskedGivingRecords = useCallback(() => {
    return givingRecords.map((r) => maskGivingRecordForRole(r, currentUser.role));
  }, [givingRecords, currentUser.role]);

  // Return pledges with donor names masked if current role lacks permission
  const getMaskedPledges = useCallback(() => {
    return pledges.map((p) => maskPledgeForRole(p, currentUser.role));
  }, [pledges, currentUser.role]);

  return (
    <GivingContext.Provider
      value={{
        members,
        pledges,
        givingRecords,
        countingSheets,
        addMember,
        updateMember,
        recordPledge,
        recordGiving,
        submitCountingSheet,
        getMaskedGivingRecords,
        getMaskedPledges,
      }}
    >
      {children}
    </GivingContext.Provider>
  );
};

export function useGiving(): GivingContextType {
  const context = useContext(GivingContext);
  if (!context) {
    throw new Error('useGiving must be used within a GivingProvider');
  }
  return context;
}
