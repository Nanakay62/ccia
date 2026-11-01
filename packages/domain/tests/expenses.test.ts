import { describe, it, expect } from 'vitest';
import {
  calculateWithholdingTax,
  generateJournalEntryFromVoucher,
  calculatePettyCashStatus,
  generateReplenishmentJournalEntry,
  calculateAssetDepreciation,
  summarizeAssetRegister,
  type PaymentVoucher,
  type PettyCashFloat,
  type PettyCashTransaction,
  type FixedAsset,
} from '../src/index.js';

describe('Phase 5: Ghana Withholding Tax (WHT) & Payment Vouchers', () => {
  it('calculates Ghana WHT rates (3% goods, 5% services, 7.5% rent, 10% contracts) accurately', () => {
    // 0% - exempt
    const r0 = calculateWithholdingTax(100000n, 0);
    expect(r0.whtPesewas).toBe(0n);
    expect(r0.netPesewas).toBe(100000n);

    // 3% - Goods (e.g. GHS 10,000.00)
    const r3 = calculateWithholdingTax(1000000n, 3);
    expect(r3.whtPesewas).toBe(30000n); // GHS 300.00
    expect(r3.netPesewas).toBe(970000n); // GHS 9,700.00

    // 5% - Services (e.g. GHS 5,000.00)
    const r5 = calculateWithholdingTax(500000n, 5);
    expect(r5.whtPesewas).toBe(25000n); // GHS 250.00
    expect(r5.netPesewas).toBe(475000n); // GHS 4,750.00

    // 7.5% - Rent (e.g. GHS 12,000.00)
    const r7 = calculateWithholdingTax(1200000n, 7.5);
    expect(r7.whtPesewas).toBe(90000n); // GHS 900.00
    expect(r7.netPesewas).toBe(1110000n); // GHS 11,100.00

    // 10% - Contracts / Non-resident (e.g. GHS 20,000.00)
    const r10 = calculateWithholdingTax(2000000n, 10);
    expect(r10.whtPesewas).toBe(200000n); // GHS 2,000.00
    expect(r10.netPesewas).toBe(1800000n); // GHS 18,000.00
  });

  it('generates a balanced double-entry JournalEntry for voucher with WHT liability split', () => {
    const voucher: PaymentVoucher = {
      id: 'v-001',
      branchId: '00000000-0000-0000-0000-000000000001',
      voucherNumber: 'PV-FS-D01-000042',
      payeeName: 'Akwasi Sound & Acoustic Engineering Ltd',
      fundId: 'fund-gen',
      fundName: 'General Fund',
      expenseAccountId: 'acct-5030', // Maintenance & Repairs
      expenseAccountName: 'Maintenance & Repairs',
      purpose: 'Auditorium public address amplifier repairs & servicing',
      paymentMethod: 'CHEQUE',
      currency: 'GHS',
      grossAmountPesewas: 500000n, // GHS 5,000.00
      withholdingTaxRate: 5, // 5% WHT on services
      withholdingTaxPesewas: 25000n, // GHS 250.00
      netPayablePesewas: 475000n, // GHS 4,750.00
      voucherDate: '2026-10-26',
      chequeNumber: 'CHQ-009941',
      preparedById: 'user-0002-finsec',
      preparedByName: 'Sister Naomi Addo',
      createdAt: '2026-10-26T10:00:00Z',
    };

    const entry = generateJournalEntryFromVoucher({
      voucher,
      branchId: '00000000-0000-0000-0000-000000000001',
      createdBy: 'Sister Naomi Addo',
      deviceId: 'DEV-FS-01',
    });

    expect(entry.documentNumber).toBe('PV-FS-D01-000042');
    expect(entry.totalDebitGhs).toBe(500000n);
    expect(entry.totalCreditGhs).toBe(500000n);
    expect(entry.totalDebitGhs).toBe(entry.totalCreditGhs); // Exactly balanced

    // Lines check:
    // Line 1: Debit Maintenance (5030) for 500,000p
    expect(entry.lines[0]?.accountId).toBe('acct-5030');
    expect(entry.lines[0]?.debitAmountGhs).toBe(500000n);

    // Line 2: Credit Bank (1030) for Net 475,000p
    expect(entry.lines[1]?.accountId).toBe('acct-1030');
    expect(entry.lines[1]?.creditAmountGhs).toBe(475000n);
    expect(entry.lines[1]?.description).toContain('CHQ-009941');

    // Line 3: Credit WHT Payable (2030) for 25,000p
    expect(entry.lines[2]?.accountId).toBe('acct-2030');
    expect(entry.lines[2]?.creditAmountGhs).toBe(25000n);
  });

  it('generates a balanced double-entry JournalEntry for MoMo payment voucher without WHT', () => {
    const voucher: PaymentVoucher = {
      id: 'v-002',
      branchId: '00000000-0000-0000-0000-000000000001',
      voucherNumber: 'PV-TR-D01-000055',
      payeeName: 'ECG Prepaid Electricity',
      fundId: 'fund-gen',
      fundName: 'General Fund',
      expenseAccountId: 'acct-5020', // Utilities
      expenseAccountName: 'Utilities',
      purpose: 'Auditorium monthly prepaid electricity credit',
      paymentMethod: 'MOMO',
      currency: 'GHS',
      grossAmountPesewas: 120000n, // GHS 1,200.00
      withholdingTaxRate: 0,
      withholdingTaxPesewas: 0n,
      netPayablePesewas: 120000n,
      voucherDate: '2026-10-27',
      momoNetwork: 'MTN',
      momoReference: 'MTN-ECG-9921',
      preparedById: 'user-0001-treasurer',
      preparedByName: 'Elder Kofi Asante',
      createdAt: '2026-10-27T09:00:00Z',
    };

    const entry = generateJournalEntryFromVoucher({
      voucher,
      branchId: '00000000-0000-0000-0000-000000000001',
      createdBy: 'Elder Kofi Asante',
      deviceId: 'DEV-TR-01',
    });

    expect(entry.totalDebitGhs).toBe(120000n);
    expect(entry.totalCreditGhs).toBe(120000n);
    expect(entry.lines.length).toBe(2);
    expect(entry.lines[1]?.accountId).toBe('acct-1050'); // MoMo Wallet
    expect(entry.lines[1]?.description).toContain('MTN-ECG-9921');
  });
});

describe('Phase 5: Petty Cash Imprest System', () => {
  const sampleFloat: PettyCashFloat = {
    branchId: '00000000-0000-0000-0000-000000000001',
    targetFloatPesewas: 100000n, // Fixed float of GHS 1,000.00
    custodianName: 'Sister Naomi Addo',
    cashOnHandPesewas: 60000n,
    unreimbursedReceiptsPesewas: 40000n,
  };

  const sampleTransactions: PettyCashTransaction[] = [
    {
      id: 'pc-1',
      branchId: '00000000-0000-0000-0000-000000000001',
      date: '2026-10-20',
      description: 'Emergency emergency generator fuel',
      category: 'Utilities',
      expenseAccountId: 'acct-5020',
      amountPesewas: 25000n, // GHS 250.00
      paidTo: 'TotalEnergies Station',
      disbursedBy: 'Sister Naomi Addo',
      isReplenished: false,
    },
    {
      id: 'pc-2',
      branchId: '00000000-0000-0000-0000-000000000001',
      date: '2026-10-22',
      description: 'Sanitary detergents and cleaning towels',
      category: 'Maintenance & Repairs',
      expenseAccountId: 'acct-5030',
      amountPesewas: 15000n, // GHS 150.00
      paidTo: 'Accra Mall Supermarket',
      disbursedBy: 'Sister Naomi Addo',
      isReplenished: false,
    },
  ];

  it('accurately computes float cash on hand, unreimbursed receipts, and replenishment amount', () => {
    const status = calculatePettyCashStatus(sampleFloat, sampleTransactions);
    expect(status.targetFloatPesewas).toBe(100000n);
    expect(status.unreimbursedReceiptsPesewas).toBe(40000n); // 250 + 150 = GHS 400.00
    expect(status.cashInBoxPesewas).toBe(60000n); // GHS 600.00 remaining
    expect(status.replenishmentNeededPesewas).toBe(40000n);
    expect(status.isHealthy).toBe(true);
  });

  it('generates a balanced replenishment journal entry debiting individual expense accounts and crediting bank', () => {
    const entry = generateReplenishmentJournalEntry({
      replenishmentNumber: 'PV-REP-000001',
      transactions: sampleTransactions,
      paymentAccountId: 'acct-1030', // Bank Account (GHS)
      fundId: 'fund-gen',
      branchId: '00000000-0000-0000-0000-000000000001',
      createdBy: 'Elder Kofi Asante',
      deviceId: 'DEV-TR-01',
      date: '2026-10-25',
    });

    expect(entry.totalDebitGhs).toBe(40000n);
    expect(entry.totalCreditGhs).toBe(40000n);
    expect(entry.lines.length).toBe(3); // 2 expense debits (Utilities, Maintenance) + 1 bank credit
  });
});

describe('Phase 5: Fixed Asset Register & Straight-Line Depreciation', () => {
  const sampleAsset: FixedAsset = {
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
    usefulLifeYears: 5, // 5 years = 60 months
    residualValuePesewas: 0n,
    condition: 'EXCELLENT',
    serialNumber: 'YAM-MON-88190',
  };

  it('computes annual, monthly, accumulated depreciation and net book value (NBV) via straight-line method', () => {
    // Exactly 24 months later (2 years)
    const res = calculateAssetDepreciation(sampleAsset, '2026-10-01');

    expect(res.usefulLifeYears).toBe(5);
    expect(res.annualDepreciationPesewas).toBe(1200000n); // GHS 12,000.00 / year
    expect(res.monthlyDepreciationPesewas).toBe(100000n); // GHS 1,000.00 / month
    expect(res.ageMonths).toBe(24);
    expect(res.accumulatedDepreciationPesewas).toBe(2400000n); // 24 * 100,000p = GHS 24,000.00
    expect(res.netBookValuePesewas).toBe(3600000n); // GHS 60,000 - GHS 24,000 = GHS 36,000.00
  });

  it('caps accumulated depreciation at depreciable amount even when age exceeds useful life', () => {
    // 7 years later (84 months) on a 5-year asset
    const res = calculateAssetDepreciation(sampleAsset, '2031-10-01');
    expect(res.accumulatedDepreciationPesewas).toBe(6000000n); // Capped at GHS 60,000.00
    expect(res.netBookValuePesewas).toBe(0n); // NBV cannot drop below 0 / residual value
  });

  it('summarizes portfolio metrics for multiple assets in the register', () => {
    const asset2: FixedAsset = {
      id: 'ast-002',
      branchId: '00000000-0000-0000-0000-000000000001',
      assetTag: 'AST-GEN-002',
      name: 'Perkins 50kVA Soundproof Standby Generator',
      category: 'Power & Generators',
      location: 'Generator Shed Yard',
      purchaseDate: '2025-10-01',
      purchaseCostPesewas: 12000000n, // GHS 120,000.00
      currency: 'GHS',
      fundId: 'fund-gen',
      fundName: 'General Fund',
      usefulLifeYears: 10, // 10 years = GHS 12,000/yr = GHS 1,000/mo
      residualValuePesewas: 0n,
      condition: 'GOOD',
    };

    const summary = summarizeAssetRegister([sampleAsset, asset2], '2026-10-01');
    expect(summary.totalAssetsCount).toBe(2);
    expect(summary.totalCostPesewas).toBe(18000000n); // GHS 180,000.00
    // Asset 1 age 24mo = GHS 24,000 dep. Asset 2 age 12mo = GHS 12,000 dep. Total = GHS 36,000
    expect(summary.totalAccumulatedDepreciationPesewas).toBe(3600000n);
    expect(summary.totalNetBookValuePesewas).toBe(14400000n); // GHS 144,000.00 NBV
  });
});
