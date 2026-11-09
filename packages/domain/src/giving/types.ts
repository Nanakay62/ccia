import type { Currency } from '../money/index.js';

export type ServiceType =
  | 'Sunday Service'
  | 'Midweek Service (Wednesday Evening)'
  | 'Grace Thursday'
  | 'Friday Evening Service'
  | 'Special Thanksgiving'
  | 'Sunday 1st Service'
  | 'Sunday 2nd Service'
  | 'Midweek Service'
  | 'Youth Service';

export interface CounterProfile {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly isPermanent: boolean;
}

export type MoMoNetwork = 'MTN' | 'VODAFONE' | 'AIRTELTIGO';

export type PaymentMethod = 'CASH' | 'CHEQUE' | 'MOMO' | 'BANK_TRANSFER';

export type GivingCategory =
  | 'Tithe'
  | 'General Offering'
  | 'Special Offering'
  | 'Building Pledge'
  | 'Missions'
  | 'Welfare'
  | 'Other Donation';

export interface Member {
  readonly id: string;
  readonly branchId: string;
  readonly memberNumber: string; // e.g. "MEM-001"
  readonly envelopeNumber?: string; // e.g. "ENV-042"
  readonly title?: string; // e.g. "Deacon", "Sister", "Brother", "Elder", "Rev.", "Pastor", "Dr."
  readonly firstName?: string;
  readonly lastName?: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly phoneHint?: string; // Last 3 digits for privacy lookup
  readonly email?: string;
  readonly familyGroup?: string; // e.g. "Mensah Family"
  readonly department?: string; // e.g. "Choir", "Youth", "Ushers"
  readonly status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'DECEASED' | 'VISITOR';
  readonly joinDate?: string;
  readonly rowVersion: number;
}

export interface Pledge {
  readonly id: string;
  readonly branchId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly campaignName: string; // e.g. "Auditorium Roofing 2026"
  readonly pledgeDate: string;
  readonly targetDate?: string;
  readonly currency: Currency;
  readonly targetAmountPesewas: bigint;
  readonly paidAmountPesewas: bigint;
  readonly status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
  readonly notes?: string;
}

export interface CashDenominationCount {
  readonly denomination: number; // e.g. 200, 100, 50, 20, 10, 5, 2, 1, or minor units (0.50)
  readonly count: number;
}

export interface ChequeRecord {
  readonly id: string;
  readonly drawerName: string;
  readonly bankName: string;
  readonly chequeNumber: string;
  readonly amountPesewas: bigint;
  readonly currency: Currency;
}

export interface MoMoRecord {
  readonly id: string;
  readonly network: MoMoNetwork;
  readonly senderName: string;
  readonly transactionReference: string;
  readonly amountPesewas: bigint;
}

export interface FundAllocationLine {
  readonly fundId: string;
  readonly fundName: string;
  readonly category: GivingCategory;
  readonly amountPesewas: bigint;
  readonly currency: Currency;
}

export interface SheetCounterSignOff {
  readonly id: string;
  readonly name: string;
  readonly isPermanent?: boolean;
  readonly role?: string;
  readonly signedAt?: string;
}

export interface CountingSheet {
  readonly id: string;
  readonly branchId: string;
  readonly sheetNumber: string; // e.g. "CS-CNT-D01-000042"
  readonly serviceDate: string;
  readonly serviceType: ServiceType;
  readonly cashDenominationsGhs: readonly CashDenominationCount[];
  readonly cashDenominationsUsd: readonly CashDenominationCount[];
  readonly cheques: readonly ChequeRecord[];
  readonly momoTransactions: readonly MoMoRecord[];
  readonly fundAllocations: readonly FundAllocationLine[];
  readonly firstCounterId: string;
  readonly firstCounterName: string;
  readonly firstSignedAt: string;
  readonly secondCounterId?: string;
  readonly secondCounterName?: string;
  readonly secondSignedAt?: string;
  readonly counters?: readonly SheetCounterSignOff[]; // Supports dynamic multi-counter teams (2, 3, 4, 5+ counters)
  readonly status: 'DRAFT' | 'SUBMITTED' | 'POSTED';
  readonly totalCashGhsPesewas: bigint;
  readonly totalCashUsdCents: bigint;
  readonly totalChequesGhsPesewas: bigint;
  readonly totalMomoGhsPesewas: bigint;
  readonly grandTotalGhsPesewas: bigint;
  readonly grandTotalUsdCents: bigint;
  readonly journalEntryId?: string;
}

export interface MemberGivingRecord {
  readonly id: string;
  readonly branchId: string;
  readonly memberId?: string; // Null if anonymous
  readonly memberName: string;
  readonly memberNumber?: string;
  readonly envelopeNumber?: string;
  readonly serviceDate: string;
  readonly fundId: string;
  readonly fundName: string;
  readonly category: GivingCategory;
  readonly paymentMethod: PaymentMethod;
  readonly currency: Currency;
  readonly amountPesewas: bigint;
  readonly receiptNumber: string;
  readonly countingSheetId?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly recordedBy?: string;
  readonly isReversed?: boolean;
  readonly reversalReason?: string;
  readonly reversedAt?: string;
  readonly reversedBy?: string;
}

export interface PrintableReceipt {
  readonly receiptNumber: string;
  readonly date: string;
  readonly churchName: string;
  readonly churchBranch: string;
  readonly churchAddress: string;
  readonly donorName: string;
  readonly donorMemberNumber?: string;
  readonly donorEnvelopeNumber?: string;
  readonly category: GivingCategory;
  readonly fundName: string;
  readonly paymentMethod: PaymentMethod;
  readonly currency: Currency;
  readonly amountFigures: string; // e.g. "GHS 1,500.00"
  readonly amountInWords: string; // e.g. "One Thousand Five Hundred Ghana Cedis Only"
  readonly receivingOfficer: string;
  readonly receivingOfficerRole: string;
}
