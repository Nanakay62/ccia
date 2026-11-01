import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Requisition,
  PaymentVoucher,
  Vendor,
  PettyCashFloat,
  PettyCashTransaction,
  FixedAsset,
  WithholdingTaxRate,
  VoucherPaymentMethod,
} from '@church/domain';
import {
  calculateWithholdingTax,
  generateJournalEntryFromVoucher,
  calculatePettyCashStatus,
  generateReplenishmentJournalEntry,
  summarizeAssetRegister,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';

export const SEED_VENDORS: Vendor[] = [
  {
    id: 'ven-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    name: 'Electricity Company of Ghana (ECG)',
    category: 'Utilities',
    contactPhone: '+233 30 267 6727',
    tinOrGhanaCard: 'C0001234567',
    isActive: true,
    totalPaidGhsPesewas: 240000n, // GHS 2,400.00
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'ven-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    name: 'Akwasi Sound & Acoustic Engineering Ltd',
    category: 'Audio/Visual & Instruments',
    contactPhone: '+233 24 456 7890',
    tinOrGhanaCard: 'P0009876543',
    momoNumber: '+233 24 456 7890 (MTN)',
    bankDetails: 'GCB Bank - High Street Branch - Acct: 1011002233445',
    isActive: true,
    totalPaidGhsPesewas: 500000n, // GHS 5,000.00
    createdAt: '2026-02-15T11:00:00Z',
  },
  {
    id: 'ven-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    name: 'Ghana Water Company Limited (GWCL)',
    category: 'Utilities',
    contactPhone: '+233 80 040 000',
    tinOrGhanaCard: 'C0007654321',
    isActive: true,
    totalPaidGhsPesewas: 80000n, // GHS 800.00
    createdAt: '2026-01-12T09:00:00Z',
  },
  {
    id: 'ven-004',
    branchId: '00000000-0000-0000-0000-000000000001',
    name: 'TotalEnergies Fuel Service Station',
    category: 'Fuel & Transport',
    contactPhone: '+233 20 888 7766',
    isActive: true,
    totalPaidGhsPesewas: 60000n, // GHS 600.00
    createdAt: '2026-03-01T08:00:00Z',
  },
];

export const SEED_REQUISITIONS: Requisition[] = [
  {
    id: 'req-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    reqNumber: 'REQ-D01-000014',
    departmentId: 'dept-music',
    departmentName: 'Music & Choir',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    purpose: 'Quarterly acoustic servicing of main stage audio mixers & wireless mics',
    currency: 'GHS',
    estimatedAmountPesewas: 500000n, // GHS 5,000.00
    submittedById: 'user-0005-depthead',
    submittedByName: 'Brother Samuel (Choir Director)',
    status: 'APPROVED',
    quotesNotes: 'Quote attached from Akwasi Sound Engineering Ltd',
    approvedById: 'user-0004-pastor',
    approvedByName: 'Pastor Kwesi Mensah',
    approvalComments: 'Approved. Proceed to prepare payment voucher with 5% WHT deducted.',
    approvedAt: '2026-10-24T14:30:00Z',
    createdAt: '2026-10-24T10:00:00Z',
  },
  {
    id: 'req-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    reqNumber: 'REQ-D01-000015',
    departmentId: 'dept-admin',
    departmentName: 'Administration',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    purpose: 'Monthly prepaid electricity meter recharge for auditorium air conditioners',
    currency: 'GHS',
    estimatedAmountPesewas: 120000n, // GHS 1,200.00
    submittedById: 'user-0002-finsec',
    submittedByName: 'Sister Naomi Addo',
    status: 'PENDING',
    quotesNotes: 'ECG Prepaid Tariffs',
    createdAt: '2026-10-28T09:15:00Z',
  },
];

export const SEED_VOUCHERS: PaymentVoucher[] = [
  {
    id: 'v-seed-01',
    branchId: '00000000-0000-0000-0000-000000000001',
    voucherNumber: 'PV-FS-D01-000041',
    requisitionId: 'req-001',
    requisitionNumber: 'REQ-D01-000014',
    vendorId: 'ven-002',
    payeeName: 'Akwasi Sound & Acoustic Engineering Ltd',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    expenseAccountId: 'acct-5030',
    expenseAccountName: 'Maintenance & Repairs',
    purpose: 'Main stage audio mixer servicing (5% WHT applied)',
    paymentMethod: 'CHEQUE',
    currency: 'GHS',
    grossAmountPesewas: 500000n, // GHS 5,000.00
    withholdingTaxRate: 5,
    withholdingTaxPesewas: 25000n, // GHS 250.00
    netPayablePesewas: 475000n, // GHS 4,750.00
    voucherDate: '2026-10-25',
    chequeNumber: 'CHQ-009941',
    preparedById: 'user-0002-finsec',
    preparedByName: 'Sister Naomi Addo',
    authorizedById: 'user-0001-treasurer',
    authorizedByName: 'Elder Kofi Asante',
    createdAt: '2026-10-25T11:00:00Z',
  },
];

export const SEED_PETTY_CASH_FLOAT: PettyCashFloat = {
  branchId: '00000000-0000-0000-0000-000000000001',
  targetFloatPesewas: 100000n, // GHS 1,000.00 Imprest Float
  custodianName: 'Sister Naomi Addo',
  cashOnHandPesewas: 60000n,
  unreimbursedReceiptsPesewas: 40000n,
  lastReplenishedAt: '2026-10-15T10:00:00Z',
};

export const SEED_PETTY_CASH_TRANSACTIONS: PettyCashTransaction[] = [
  {
    id: 'pc-seed-1',
    branchId: '00000000-0000-0000-0000-000000000001',
    date: '2026-10-20',
    description: 'Emergency standby generator diesel fuel top-up',
    category: 'Utilities',
    expenseAccountId: 'acct-5020',
    amountPesewas: 25000n, // GHS 250.00
    paidTo: 'TotalEnergies Station',
    disbursedBy: 'Sister Naomi Addo',
    isReplenished: false,
  },
  {
    id: 'pc-seed-2',
    branchId: '00000000-0000-0000-0000-000000000001',
    date: '2026-10-22',
    description: 'Sunday school craft materials and cleaning detergents',
    category: 'Maintenance & Repairs',
    expenseAccountId: 'acct-5030',
    amountPesewas: 15000n, // GHS 150.00
    paidTo: 'Accra Central Supermarket',
    disbursedBy: 'Sister Naomi Addo',
    isReplenished: false,
  },
];

export const SEED_ASSETS: FixedAsset[] = [
  {
    id: 'ast-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    assetTag: 'AST-MUS-001',
    name: 'Yamaha Montage 8 Synthesizer Keyboard',
    category: 'Musical Instruments',
    location: 'Auditorium Main Stage',
    purchaseDate: '2024-10-01',
    purchaseCostPesewas: 6000000n, // GHS 60,000.00
    currency: 'GHS',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    usefulLifeYears: 5,
    residualValuePesewas: 0n,
    condition: 'EXCELLENT',
    serialNumber: 'YAM-MON-88190',
  },
  {
    id: 'ast-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    assetTag: 'AST-PWR-001',
    name: 'Perkins 50kVA Soundproof Standby Diesel Generator',
    category: 'Power & Generators',
    location: 'Generator Shed Yard',
    purchaseDate: '2025-04-01',
    purchaseCostPesewas: 12000000n, // GHS 120,000.00
    currency: 'GHS',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    usefulLifeYears: 10,
    residualValuePesewas: 1000000n, // GHS 10,000.00
    condition: 'GOOD',
    serialNumber: 'PRK-GEN-50K-4421',
  },
  {
    id: 'ast-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    assetTag: 'AST-AV-001',
    name: 'Behringer X32 Digital Mixing Console',
    category: 'Audio / Visual Equipment',
    location: 'Sound Control Booth',
    purchaseDate: '2023-06-15',
    purchaseCostPesewas: 3500000n, // GHS 35,000.00
    currency: 'GHS',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    usefulLifeYears: 6,
    residualValuePesewas: 0n,
    condition: 'GOOD',
    serialNumber: 'BHR-X32-99011',
  },
];

interface ExpensesContextType {
  requisitions: Requisition[];
  vouchers: PaymentVoucher[];
  vendors: Vendor[];
  pettyCashFloat: PettyCashFloat;
  pettyCashTransactions: PettyCashTransaction[];
  assets: FixedAsset[];
  submitRequisition: (
    data: Omit<Requisition, 'id' | 'reqNumber' | 'status' | 'createdAt' | 'submittedById' | 'submittedByName'>
  ) => Requisition;
  approveRequisition: (id: string, comments?: string) => void;
  rejectRequisition: (id: string, comments: string) => void;
  createPaymentVoucher: (params: {
    requisitionId?: string;
    vendorId?: string;
    payeeName: string;
    fundId: string;
    expenseAccountId: string;
    expenseAccountName: string;
    purpose: string;
    paymentMethod: VoucherPaymentMethod;
    currency: 'GHS' | 'USD';
    grossAmountPesewas: bigint;
    withholdingTaxRate: WithholdingTaxRate;
    chequeNumber?: string;
    momoNetwork?: string;
    momoReference?: string;
    momoRecipientPhone?: string;
  }) => { voucher: PaymentVoucher; journalEntryId: string };
  disbursePettyCash: (data: {
    description: string;
    category: string;
    expenseAccountId: string;
    amountPesewas: bigint;
    paidTo: string;
    receiptNumber?: string;
  }) => PettyCashTransaction;
  replenishPettyCash: (paymentAccountId?: string) => { journalEntryId: string; totalGhs: bigint };
  addVendor: (vendor: Omit<Vendor, 'id' | 'createdAt' | 'totalPaidGhsPesewas' | 'isActive'>) => Vendor;
  addAsset: (asset: Omit<FixedAsset, 'id'>) => FixedAsset;
  getAssetSummary: () => ReturnType<typeof summarizeAssetRegister>;
}

const ExpensesContext = createContext<ExpensesContextType | undefined>(undefined);

export const ExpensesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [requisitions, setRequisitions] = useState<Requisition[]>(SEED_REQUISITIONS);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>(SEED_VOUCHERS);
  const [vendors, setVendors] = useState<Vendor[]>(SEED_VENDORS);
  const [pettyCashFloat, setPettyCashFloat] = useState<PettyCashFloat>(SEED_PETTY_CASH_FLOAT);
  const [pettyCashTransactions, setPettyCashTransactions] = useState<PettyCashTransaction[]>(
    SEED_PETTY_CASH_TRANSACTIONS
  );
  const [assets, setAssets] = useState<FixedAsset[]>(SEED_ASSETS);

  // Submit Requisition
  const submitRequisition = useCallback(
    (
      data: Omit<
        Requisition,
        'id' | 'reqNumber' | 'status' | 'createdAt' | 'submittedById' | 'submittedByName'
      >
    ) => {
      const reqNumber = `REQ-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;
      const newReq: Requisition = {
        ...data,
        id: `req-${Date.now()}`,
        reqNumber,
        status: 'PENDING',
        submittedById: currentUser.id,
        submittedByName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      };

      setRequisitions((prev) => [newReq, ...prev]);

      enqueueItem({
        entityId: newReq.id,
        entityType: 'REQUISITION',
        action: 'POST_JOURNAL_ENTRY',
        payload: { ...newReq },
        deviceId: currentUser.deviceId,
      });

      return newReq;
    },
    [currentUser, enqueueItem]
  );

  // Approve Requisition (Pastor / Elder or Treasurer)
  const approveRequisition = useCallback(
    (id: string, comments?: string) => {
      setRequisitions((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'APPROVED',
                approvedById: currentUser.id,
                approvedByName: currentUser.fullName,
                approvalComments: comments ?? 'Approved as requested',
                approvedAt: new Date().toISOString(),
              }
            : r
        )
      );

      enqueueItem({
        entityId: id,
        entityType: 'REQUISITION',
        action: 'APPROVE_REQUISITION',
        payload: { id, action: 'APPROVED', comments },
        deviceId: currentUser.deviceId,
      });
    },
    [currentUser, enqueueItem]
  );

  // Reject Requisition
  const rejectRequisition = useCallback(
    (id: string, comments: string) => {
      setRequisitions((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'REJECTED',
                approvedById: currentUser.id,
                approvedByName: currentUser.fullName,
                approvalComments: comments,
                approvedAt: new Date().toISOString(),
              }
            : r
        )
      );

      enqueueItem({
        entityId: id,
        entityType: 'REQUISITION',
        action: 'APPROVE_REQUISITION',
        payload: { id, action: 'REJECTED', comments },
        deviceId: currentUser.deviceId,
      });
    },
    [currentUser, enqueueItem]
  );

  // Create Payment Voucher (with WHT calculation and auto-posted balanced double-entry)
  const createPaymentVoucher = useCallback(
    (params: {
      requisitionId?: string;
      vendorId?: string;
      payeeName: string;
      fundId: string;
      expenseAccountId: string;
      expenseAccountName: string;
      purpose: string;
      paymentMethod: VoucherPaymentMethod;
      currency: 'GHS' | 'USD';
      grossAmountPesewas: bigint;
      withholdingTaxRate: WithholdingTaxRate;
      chequeNumber?: string;
      momoNetwork?: string;
      momoReference?: string;
      momoRecipientPhone?: string;
    }) => {
      // 1. Calculate WHT and Net
      const { whtPesewas, netPesewas } = calculateWithholdingTax(
        params.grossAmountPesewas,
        params.withholdingTaxRate
      );

      const voucherId = `v-${Date.now()}`;
      const voucherNumber = `PV-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;
      const req = requisitions.find((r) => r.id === params.requisitionId);

      const voucher: PaymentVoucher = {
        id: voucherId,
        branchId: currentUser.branchId,
        voucherNumber,
        requisitionId: params.requisitionId,
        requisitionNumber: req?.reqNumber,
        vendorId: params.vendorId,
        payeeName: params.payeeName,
        fundId: params.fundId,
        fundName: req?.fundName || 'General Fund',
        expenseAccountId: params.expenseAccountId,
        expenseAccountName: params.expenseAccountName,
        purpose: params.purpose,
        paymentMethod: params.paymentMethod,
        currency: params.currency,
        grossAmountPesewas: params.grossAmountPesewas,
        withholdingTaxRate: params.withholdingTaxRate,
        withholdingTaxPesewas: whtPesewas,
        netPayablePesewas: netPesewas,
        voucherDate: new Date().toISOString().slice(0, 10),
        chequeNumber: params.chequeNumber,
        momoNetwork: params.momoNetwork,
        momoReference: params.momoReference,
        momoRecipientPhone: params.momoRecipientPhone,
        preparedById: currentUser.id,
        preparedByName: currentUser.fullName,
        authorizedById: currentUser.id,
        authorizedByName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      };

      // 2. Generate and post balanced journal entry to general ledger
      const entry = generateJournalEntryFromVoucher({
        voucher,
        branchId: currentUser.branchId,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
      });

      addEntry(entry);

      // 3. Update state
      setVouchers((prev) => [{ ...voucher, journalEntryId: entry.id }, ...prev]);

      // If tied to requisition, mark requisition PAID
      if (params.requisitionId) {
        setRequisitions((prev) =>
          prev.map((r) => (r.id === params.requisitionId ? { ...r, status: 'PAID' } : r))
        );
      }

      // If tied to vendor, update total paid
      if (params.vendorId) {
        setVendors((prev) =>
          prev.map((v) =>
            v.id === params.vendorId
              ? { ...v, totalPaidGhsPesewas: v.totalPaidGhsPesewas + params.grossAmountPesewas }
              : v
          )
        );
      }

      // 4. Enqueue offline sync
      enqueueItem({
        entityId: voucher.id,
        entityType: 'PAYMENT_VOUCHER',
        action: 'POST_JOURNAL_ENTRY',
        payload: { ...voucher, journal_entry_id: entry.id },
        deviceId: currentUser.deviceId,
      });

      return { voucher, journalEntryId: entry.id };
    },
    [currentUser, requisitions, addEntry, enqueueItem]
  );

  // Disburse Petty Cash
  const disbursePettyCash = useCallback(
    (data: {
      description: string;
      category: string;
      expenseAccountId: string;
      amountPesewas: bigint;
      paidTo: string;
      receiptNumber?: string;
    }) => {
      const newTx: PettyCashTransaction = {
        ...data,
        id: `pc-${Date.now()}`,
        branchId: currentUser.branchId,
        date: new Date().toISOString().slice(0, 10),
        disbursedBy: currentUser.fullName,
        isReplenished: false,
      };

      const updatedTransactions = [newTx, ...pettyCashTransactions];
      setPettyCashTransactions(updatedTransactions);

      const status = calculatePettyCashStatus(pettyCashFloat, updatedTransactions);
      setPettyCashFloat((prev) => ({
        ...prev,
        cashOnHandPesewas: status.cashInBoxPesewas,
        unreimbursedReceiptsPesewas: status.unreimbursedReceiptsPesewas,
      }));

      return newTx;
    },
    [currentUser, pettyCashFloat, pettyCashTransactions]
  );

  // Replenish Petty Cash Imprest
  const replenishPettyCash = useCallback(
    (paymentAccountId: string = 'acct-1030') => {
      const unreimbursed = pettyCashTransactions.filter((t) => !t.isReplenished);
      if (unreimbursed.length === 0) {
        throw new Error('No unreimbursed petty cash transactions to replenish.');
      }

      const replDocNum = `PV-REP-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;

      // 1. Generate balanced replenishment journal entry
      const entry = generateReplenishmentJournalEntry({
        replenishmentNumber: replDocNum,
        transactions: unreimbursed,
        paymentAccountId,
        fundId: 'fund-gen',
        branchId: currentUser.branchId,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        date: new Date().toISOString().slice(0, 10),
      });

      // 2. Post to ledger
      addEntry(entry);

      // 3. Mark transactions as replenished
      setPettyCashTransactions((prev) =>
        prev.map((t) => (!t.isReplenished ? { ...t, isReplenished: true, replenishmentVoucherId: replDocNum } : t))
      );

      // 4. Restore float to full target
      setPettyCashFloat((prev) => ({
        ...prev,
        cashOnHandPesewas: prev.targetFloatPesewas,
        unreimbursedReceiptsPesewas: 0n,
        lastReplenishedAt: new Date().toISOString(),
      }));

      // 5. Enqueue sync
      enqueueItem({
        entityId: replDocNum,
        entityType: 'PETTY_CASH_REPLENISHMENT',
        action: 'POST_JOURNAL_ENTRY',
        payload: { doc_number: replDocNum, total_pesewas: Number(entry.totalDebitGhs) },
        deviceId: currentUser.deviceId,
      });

      return { journalEntryId: entry.id, totalGhs: entry.totalDebitGhs };
    },
    [currentUser, pettyCashTransactions, addEntry, enqueueItem]
  );

  // Add Vendor
  const addVendor = useCallback(
    (vendorData: Omit<Vendor, 'id' | 'createdAt' | 'totalPaidGhsPesewas' | 'isActive'>) => {
      const newVendor: Vendor = {
        ...vendorData,
        id: `ven-${Date.now()}`,
        totalPaidGhsPesewas: 0n,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setVendors((prev) => [newVendor, ...prev]);

      enqueueItem({
        entityId: newVendor.id,
        entityType: 'VENDOR',
        action: 'UPDATE_VENDOR',
        payload: { ...newVendor },
        deviceId: currentUser.deviceId,
      });

      return newVendor;
    },
    [currentUser, enqueueItem]
  );

  // Add Asset
  const addAsset = useCallback(
    (assetData: Omit<FixedAsset, 'id'>) => {
      const newAsset: FixedAsset = {
        ...assetData,
        id: `ast-${Date.now()}`,
      };
      setAssets((prev) => [newAsset, ...prev]);

      enqueueItem({
        entityId: newAsset.id,
        entityType: 'ASSET',
        action: 'POST_JOURNAL_ENTRY',
        payload: { ...newAsset },
        deviceId: currentUser.deviceId,
      });

      return newAsset;
    },
    [currentUser, enqueueItem]
  );

  // Asset Depreciation Summary
  const getAssetSummary = useCallback(() => {
    return summarizeAssetRegister(assets);
  }, [assets]);

  return (
    <ExpensesContext.Provider
      value={{
        requisitions,
        vouchers,
        vendors,
        pettyCashFloat,
        pettyCashTransactions,
        assets,
        submitRequisition,
        approveRequisition,
        rejectRequisition,
        createPaymentVoucher,
        disbursePettyCash,
        replenishPettyCash,
        addVendor,
        addAsset,
        getAssetSummary,
      }}
    >
      {children}
    </ExpensesContext.Provider>
  );
};

export function useExpenses(): ExpensesContextType {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpensesProvider');
  }
  return context;
}
