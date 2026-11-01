import { describe, it, expect } from 'vitest';
import {
  calculateDenominationTotal,
  calculateChequeTotal,
  calculateMomoTotal,
  validateTwoCounterSignOff,
  generateJournalEntryFromCountingSheet,
  numberToWordsGhs,
  numberToWordsUsd,
  generatePrintableReceipt,
  maskGivingRecordForRole,
  CONFIDENTIAL_DONOR_MASK,
  type CountingSheet,
  type MemberGivingRecord,
} from '../src/index.js';

describe('Phase 4: Denomination Counting & Dual-Control Verification', () => {
  it('accurately computes GHS cash minor units (pesewas) from banknote and coin counts', () => {
    const counts = [
      { denomination: 200, count: 5 }, // 5 * 20,000p = 100,000p (GHS 1,000)
      { denomination: 100, count: 10 }, // 10 * 10,000p = 100,000p (GHS 1,000)
      { denomination: 50, count: 4 }, // 4 * 5,000p = 20,000p (GHS 200)
      { denomination: 0.5, count: 12 }, // 12 * 50p = 600p (GHS 6)
    ];

    const totalPesewas = calculateDenominationTotal(counts);
    expect(totalPesewas).toBe(220600n); // GHS 2,206.00
  });

  it('accurately computes USD cash minor units (cents) from banknote counts', () => {
    const usdCounts = [
      { denomination: 100, count: 3 }, // 3 * $100 = $300 (30,000 cents)
      { denomination: 50, count: 2 }, // 2 * $50 = $100 (10,000 cents)
      { denomination: 20, count: 5 }, // 5 * $20 = $100 (10,000 cents)
    ];

    const totalCents = calculateDenominationTotal(usdCounts);
    expect(totalCents).toBe(50000n); // $500.00
  });

  it('computes total cheque and mobile money amounts correctly', () => {
    const cheques = [
      { id: 'chq-1', drawerName: 'Kofi Manu', bankName: 'GCB Bank', chequeNumber: '00124', amountPesewas: 50000n, currency: 'GHS' as const },
      { id: 'chq-2', drawerName: 'Ama Serwaa', bankName: 'Ecobank', chequeNumber: '99201', amountPesewas: 75000n, currency: 'GHS' as const },
    ];
    expect(calculateChequeTotal(cheques)).toBe(125000n); // GHS 1,250.00

    const momoList = [
      { id: 'm-1', network: 'MTN' as const, senderName: 'Kwesi Appiah', transactionReference: 'MTN-88219', amountPesewas: 30000n },
      { id: 'm-2', network: 'VODAFONE' as const, senderName: 'Yaa Asantewaa', transactionReference: 'VOD-33109', amountPesewas: 20000n },
    ];
    expect(calculateMomoTotal(momoList)).toBe(50000n); // GHS 500.00
  });

  it('enforces two distinct counter signatures (blocks single-counter or identical UUIDs)', () => {
    // Missing first
    expect(validateTwoCounterSignOff(undefined, 'user-counter-b').valid).toBe(false);

    // Missing second
    expect(validateTwoCounterSignOff('user-counter-a', '').valid).toBe(false);

    // Identical user UUID attempting to sign both roles
    const identicalCheck = validateTwoCounterSignOff('user-counter-a', 'user-counter-a');
    expect(identicalCheck.valid).toBe(false);
    expect(identicalCheck.error).toContain('Two distinct counters are required');

    // Valid two distinct counters
    const validCheck = validateTwoCounterSignOff('user-counter-a', 'user-counter-b');
    expect(validCheck.valid).toBe(true);
    expect(validCheck.error).toBeUndefined();
  });
});

describe('Phase 4: Automatic Balanced Journal Entry Generation from Counting Sheet', () => {
  it('generates a balanced double-entry JournalEntry debiting cash/bank/momo and crediting fund revenue accounts', () => {
    const sheet: CountingSheet = {
      id: 'cs-test-01',
      branchId: '00000000-0000-0000-0000-000000000001',
      sheetNumber: 'CS-CNT-000101',
      serviceDate: '2026-10-25',
      serviceType: 'Sunday 1st Service',
      cashDenominationsGhs: [{ denomination: 100, count: 20 }], // 200,000p (GHS 2,000.00)
      cashDenominationsUsd: [],
      cheques: [{ id: 'c1', drawerName: 'K. Manu', bankName: 'GCB', chequeNumber: '001', amountPesewas: 50000n, currency: 'GHS' }], // GHS 500.00
      momoTransactions: [{ id: 'm1', network: 'MTN', senderName: 'A. Boakye', transactionReference: 'REF-1', amountPesewas: 50000n }], // GHS 500.00
      fundAllocations: [
        { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe', amountPesewas: 180000n, currency: 'GHS' }, // GHS 1,800.00
        { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering', amountPesewas: 120000n, currency: 'GHS' }, // GHS 1,200.00
      ],
      firstCounterId: 'user-counter-1',
      firstCounterName: 'Brother Emmanuel',
      firstSignedAt: '2026-10-25T13:00:00Z',
      secondCounterId: 'user-counter-2',
      secondCounterName: 'Sister Grace',
      secondSignedAt: '2026-10-25T13:05:00Z',
      status: 'SUBMITTED',
      totalCashGhsPesewas: 200000n,
      totalCashUsdCents: 0n,
      totalChequesGhsPesewas: 50000n,
      totalMomoGhsPesewas: 50000n,
      grandTotalGhsPesewas: 300000n, // GHS 3,000.00
      grandTotalUsdCents: 0n,
    };

    const entry = generateJournalEntryFromCountingSheet({
      sheet,
      branchId: '00000000-0000-0000-0000-000000000001',
      documentNumber: 'JE-CS-000101',
      createdBy: 'Brother Emmanuel',
      deviceId: 'DEV-CNT-01',
    });

    expect(entry.documentNumber).toBe('JE-CS-000101');
    expect(entry.totalDebitGhs).toBe(300000n);
    expect(entry.totalCreditGhs).toBe(300000n);
    expect(entry.totalDebitGhs).toBe(entry.totalCreditGhs); // Exactly balanced!
    expect(entry.lines.length).toBe(5); // 3 debits (Cash, Bank, MoMo) + 2 credits (Tithes, Offering)
  });
});

describe('Phase 4: Legal Tender Words Conversion & Printable Receipts', () => {
  it('converts Ghana Cedis pesewas accurately to official legal tender words', () => {
    expect(numberToWordsGhs(150000n)).toBe('One Thousand Five Hundred Ghana Cedis Only');
    expect(numberToWordsGhs(15050n)).toBe('One Hundred and Fifty Ghana Cedis, Fifty Pesewas Only');
    expect(numberToWordsGhs(75n)).toBe('Seventy-Five Pesewas Only');
    expect(numberToWordsGhs(100n)).toBe('One Ghana Cedi Only');
    expect(numberToWordsGhs(254030n)).toBe('Two Thousand Five Hundred and Forty Ghana Cedis, Thirty Pesewas Only');
  });

  it('converts USD cents accurately to official legal tender words', () => {
    expect(numberToWordsUsd(10000n)).toBe('One Hundred United States Dollars Only');
    expect(numberToWordsUsd(25050n)).toBe('Two Hundred and Fifty United States Dollars, Fifty Cents Only');
  });

  it('generates complete printable receipt layout metadata', () => {
    const record: MemberGivingRecord = {
      id: 'rec-001',
      branchId: '00000000-0000-0000-0000-000000000001',
      memberId: 'mem-001',
      memberName: 'Kofi Mensah',
      memberNumber: 'MEM-001',
      envelopeNumber: 'ENV-012',
      serviceDate: '2026-10-25',
      fundId: 'fund-bld',
      fundName: 'Building Fund',
      category: 'Building Pledge',
      paymentMethod: 'CASH',
      currency: 'GHS',
      amountPesewas: 150000n, // GHS 1,500.00
      receiptNumber: 'REC-FS-D01-000042',
      createdAt: '2026-10-25T14:00:00Z',
    };

    const receipt = generatePrintableReceipt({
      record,
      receivingOfficer: 'Sister Naomi Addo',
      receivingOfficerRole: 'Finance Secretary',
    });

    expect(receipt.receiptNumber).toBe('REC-FS-D01-000042');
    expect(receipt.donorName).toBe('Kofi Mensah');
    expect(receipt.amountFigures).toBe('GHS 1,500.00');
    expect(receipt.amountInWords).toBe('One Thousand Five Hundred Ghana Cedis Only');
    expect(receipt.receivingOfficer).toBe('Sister Naomi Addo');
  });
});

describe('Phase 4: Member Giving Privacy Gating', () => {
  const sampleRecord: MemberGivingRecord = {
    id: 'rec-priv-1',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-777',
    memberName: 'Deacon Kwabena Acheampong',
    memberNumber: 'MEM-077',
    envelopeNumber: 'ENV-077',
    serviceDate: '2026-10-25',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    category: 'Tithe',
    paymentMethod: 'MOMO',
    currency: 'GHS',
    amountPesewas: 500000n, // GHS 5,000.00
    receiptNumber: 'REC-0077',
    notes: 'Personal monthly tithe via MoMo',
    createdAt: '2026-10-25T12:00:00Z',
  };

  it('allows Treasurer, Finance Secretary, Pastor/Elder, and Auditor to view full donor identity', () => {
    const roles = ['Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor'] as const;
    for (const role of roles) {
      const masked = maskGivingRecordForRole(sampleRecord, role);
      expect(masked.memberName).toBe('Deacon Kwabena Acheampong');
      expect(masked.memberId).toBe('mem-777');
      expect(masked.envelopeNumber).toBe('ENV-077');
      expect(masked.notes).toBe('Personal monthly tithe via MoMo');
    }
  });

  it('masks donor identity and removes identifying markers for Counters, Department Heads, and Admins', () => {
    const unauthorizedRoles = ['Counter', 'Department Head', 'Admin'] as const;
    for (const role of unauthorizedRoles) {
      const masked = maskGivingRecordForRole(sampleRecord, role);
      expect(masked.memberName).toBe(CONFIDENTIAL_DONOR_MASK);
      expect(masked.memberId).toBeUndefined();
      expect(masked.memberNumber).toBeUndefined();
      expect(masked.envelopeNumber).toBeUndefined();
      expect(masked.notes).toBeUndefined();
      // Total amount and fund classification remain intact for accounting reports
      expect(masked.amountPesewas).toBe(500000n);
      expect(masked.fundName).toBe('General Fund');
    }
  });
});
