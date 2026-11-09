import { describe, it, expect } from 'vitest';
import {
  calculateTitheBatchSummary,
  validateTitheBatchPosting,
  calculateTitheParticipation,
  calculateMemberTitheSummary,
  createTitheReversal,
  standardizeEnvelopeNumber,
  calculateDueDateForPeriod,
  calculateRemittanceDue,
  isRemittanceOverdue,
  evaluateRemittanceStatus,
  type TitheBatch,
  type TitheRecord,
  type TitheRemittanceRule,
  type TitheRemittance,
} from '../src/index.js';

describe('Tithes Domain Rules', () => {
  describe('calculateTitheBatchSummary', () => {
    it('balances when counted equals allocated', () => {
      const counted = 500000n; // 5,000.00 GHS
      const records = [
        { amount: 200000n },
        { amount: 150000n },
        { amount: 150000n },
      ];
      const result = calculateTitheBatchSummary(counted, records);

      expect(result.allocatedTotal).toBe(500000n);
      expect(result.unallocatedTotal).toBe(0n);
      expect(result.unexplainedVariance).toBe(0n);
      expect(result.isBalanced).toBe(true);
      expect(result.canReconcile).toBe(true);
      expect(result.canPost).toBe(true);
    });

    it('identifies unallocated tithes when allocated is less than counted', () => {
      const counted = 500000n;
      const records = [
        { amount: 200000n },
        { amount: 150000n },
      ]; // total 350000n
      const result = calculateTitheBatchSummary(counted, records);

      expect(result.allocatedTotal).toBe(350000n);
      expect(result.unallocatedTotal).toBe(150000n);
      expect(result.unexplainedVariance).toBe(150000n);
      expect(result.isBalanced).toBe(false);
      expect(result.canPost).toBe(false);
    });

    it('balances when unallocated difference is fully explained (e.g. anonymous cash envelope)', () => {
      const counted = 500000n;
      const records = [
        { amount: 350000n },
      ];
      const explainedUnallocated = 150000n;
      const result = calculateTitheBatchSummary(counted, records, explainedUnallocated);

      expect(result.allocatedTotal).toBe(350000n);
      expect(result.unallocatedTotal).toBe(150000n);
      expect(result.explainedUnallocated).toBe(150000n);
      expect(result.unexplainedVariance).toBe(0n);
      expect(result.isBalanced).toBe(true);
      expect(result.canPost).toBe(true);
    });

    it('detects when allocated exceeds counted total', () => {
      const counted = 400000n;
      const records = [
        { amount: 250000n },
        { amount: 200000n },
      ]; // 450000n
      const result = calculateTitheBatchSummary(counted, records);

      expect(result.allocatedTotal).toBe(450000n);
      expect(result.unallocatedTotal).toBe(-50000n);
      expect(result.isBalanced).toBe(false);
      expect(result.message).toContain('exceeds counted tithes');
    });
  });

  describe('validateTitheBatchPosting', () => {
    const validBatch: TitheBatch = {
      id: 'tb-001',
      branchId: 'b-01',
      countingSheetId: 'cs-001',
      serviceDate: '2026-10-18',
      serviceName: 'Sunday 1st Service',
      currency: 'GHS',
      countedTotal: 500000n,
      allocatedTotal: 500000n,
      unallocatedTotal: 0n,
      explainedUnallocated: 0n,
      status: 'RECONCILED',
      reconciledBy: 'user-sec-01',
      recordsCount: 10,
      createdAt: '2026-10-18T10:00:00Z',
    };

    it('approves posting when reconciled and dual control verifier is different', () => {
      const validation = validateTitheBatchPosting(validBatch, 'user-treasurer-02');
      expect(validation.valid).toBe(true);
    });

    it('blocks posting if already posted', () => {
      const postedBatch: TitheBatch = { ...validBatch, status: 'POSTED' };
      const validation = validateTitheBatchPosting(postedBatch, 'user-treasurer-02');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('already been posted');
    });

    it('blocks posting if unexplained variance exists', () => {
      const unbalancedBatch: TitheBatch = {
        ...validBatch,
        unallocatedTotal: 50000n,
        explainedUnallocated: 0n,
      };
      const validation = validateTitheBatchPosting(unbalancedBatch, 'user-treasurer-02');
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('unexplained variance');
    });

    it('blocks posting if poster is the same person who prepared/reconciled (dual control)', () => {
      const validation = validateTitheBatchPosting(validBatch, 'user-sec-01', true);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Dual control required');
    });
  });

  describe('calculateTitheParticipation', () => {
    const mockRecords: TitheRecord[] = [
      {
        id: 'r-1',
        branchId: 'b-01',
        memberId: 'm-1',
        memberName: 'Member 1',
        recordDate: '2026-10-04',
        amount: 4000n, // 40.00 -> band 1 (<50)
        currency: 'GHS',
        method: 'ENVELOPE',
        recordedBy: 'user-1',
        createdAt: '2026-10-04T12:00:00Z',
      },
      {
        id: 'r-2',
        branchId: 'b-01',
        memberId: 'm-2',
        memberName: 'Member 2',
        recordDate: '2026-10-11',
        amount: 10000n, // 100.00 -> band 2 (50-199)
        currency: 'GHS',
        method: 'ENVELOPE',
        recordedBy: 'user-1',
        createdAt: '2026-10-11T12:00:00Z',
      },
      {
        id: 'r-3',
        branchId: 'b-01',
        memberId: 'm-3',
        memberName: 'Member 3',
        recordDate: '2026-10-18',
        amount: 30000n, // 300.00 -> band 3 (200+)
        currency: 'GHS',
        method: 'MOMO',
        recordedBy: 'user-1',
        createdAt: '2026-10-18T12:00:00Z',
      },
      {
        id: 'r-4',
        branchId: 'b-01',
        memberId: 'm-3',
        memberName: 'Member 3',
        recordDate: '2026-10-25',
        amount: 20000n, // adds to m-3 total (now 500.00)
        currency: 'GHS',
        method: 'ENVELOPE',
        recordedBy: 'user-1',
        createdAt: '2026-10-25T12:00:00Z',
      },
    ];

    it('calculates total, payers, average, median, and participation percentage', () => {
      const stats = calculateTitheParticipation(mockRecords, 4, '2026-10', 'GHS');

      expect(stats.totalPayers).toBe(3); // 3 distinct members
      expect(stats.totalTitheAmount).toBe(64000n); // 40 + 100 + 500 = 640 GHS
      expect(stats.averageTitheAmount).toBe(21333n); // 64000 / 3 = 213.33 GHS
      expect(stats.medianTitheAmount).toBe(10000n); // sorted: [4000, 10000, 50000] -> mid is 10000
      expect(stats.participationPercentage).toBe(75); // 3/4 = 75%
    });

    it('categorizes payers into distribution bands without exposing names', () => {
      const stats = calculateTitheParticipation(mockRecords, 4, '2026-10', 'GHS');

      expect(stats.bands).toHaveLength(3);
      // Band 1 (< 50 GHS): Member 1 (40.00)
      expect(stats.bands[0].count).toBe(1);
      expect(stats.bands[0].totalAmount).toBe(4000n);

      // Band 2 (50 - 199 GHS): Member 2 (100.00)
      expect(stats.bands[1].count).toBe(1);
      expect(stats.bands[1].totalAmount).toBe(10000n);

      // Band 3 (200+ GHS): Member 3 (500.00)
      expect(stats.bands[2].count).toBe(1);
      expect(stats.bands[2].totalAmount).toBe(50000n);
    });
  });

  describe('calculateMemberTitheSummary', () => {
    const memberRecords: TitheRecord[] = [
      {
        id: 'tr-01',
        branchId: 'b-01',
        memberId: 'mem-101',
        memberName: 'Deacon Kwame',
        recordDate: '2026-01-15',
        amount: 25000n,
        currency: 'GHS',
        method: 'ENVELOPE',
        recordedBy: 'user-1',
        createdAt: '2026-01-15T12:00:00Z',
      },
      {
        id: 'tr-02',
        branchId: 'b-01',
        memberId: 'mem-101',
        memberName: 'Deacon Kwame',
        recordDate: '2026-03-20',
        amount: 30000n,
        currency: 'GHS',
        method: 'MOMO',
        recordedBy: 'user-1',
        createdAt: '2026-03-20T12:00:00Z',
      },
      {
        id: 'tr-03',
        branchId: 'b-01',
        memberId: 'mem-101',
        memberName: 'Deacon Kwame',
        recordDate: '2026-10-10',
        amount: 40000n,
        currency: 'GHS',
        method: 'BANK_TRANSFER',
        recordedBy: 'user-1',
        createdAt: '2026-10-10T12:00:00Z',
      },
    ];

    it('computes YTD total and months paid out of elapsed months', () => {
      // For October (month 10): paid in Jan, Mar, Oct -> 3 months paid out of 10
      const summary = calculateMemberTitheSummary(
        'mem-101',
        'Deacon Kwame',
        memberRecords,
        2026,
        10
      );

      expect(summary.ytdTotal).toBe(95000n); // 250 + 300 + 400 = 950 GHS
      expect(summary.monthsPaidCount).toBe(3);
      expect(summary.monthsElapsedCount).toBe(10);
      expect(summary.consistencyPercentage).toBe(30); // 3/10 * 100 = 30%
      expect(summary.lastTitheDate).toBe('2026-10-10');
      expect(summary.lastTitheAmount).toBe(40000n);
    });
  });

  describe('createTitheReversal', () => {
    const original: TitheRecord = {
      id: 'tr-orig-123',
      branchId: 'b-01',
      batchId: 'tb-01',
      memberId: 'mem-202',
      memberName: 'Sister Akua',
      envelopeNumber: 'ENV-019',
      recordDate: '2026-10-18',
      amount: 15000n,
      currency: 'GHS',
      method: 'ENVELOPE',
      recordedBy: 'user-sec-01',
      createdAt: '2026-10-18T11:00:00Z',
    };

    it('creates an append-only negative reversal record', () => {
      const reversal = createTitheReversal(
        original,
        'Wrong envelope number entered',
        'user-sec-01',
        '2026-10-19'
      );

      expect(reversal.amount).toBe(-15000n);
      expect(reversal.isReversal).toBe(true);
      expect(reversal.reversalOfId).toBe('tr-orig-123');
      expect(reversal.reversalReason).toBe('Wrong envelope number entered');
      expect(reversal.recordDate).toBe('2026-10-19');
    });

    it('requires a non-empty reversal reason', () => {
      expect(() => createTitheReversal(original, '   ', 'user-sec-01')).toThrow(
        'A reversal reason is mandatory.'
      );
    });
  });

  describe('standardizeEnvelopeNumber', () => {
    it('normalizes envelope numbers', () => {
      expect(standardizeEnvelopeNumber('12')).toBe('ENV-012');
      expect(standardizeEnvelopeNumber('ENV-45')).toBe('ENV-045');
      expect(standardizeEnvelopeNumber('env 88')).toBe('ENV-088');
      expect(standardizeEnvelopeNumber('')).toBe('');
    });
  });

  describe('Tithe Remittance Rules & Calculations', () => {
    const mockRule: TitheRemittanceRule = {
      id: 'rule-dist-10',
      branchId: 'b-01',
      name: 'Accra District Assessment',
      basis: 'PERCENTAGE',
      percentageOrAmount: '10', // 10%
      currency: 'GHS',
      frequency: 'MONTHLY',
      dueDayOfMonth: 10,
      effectiveFrom: '2026-01-01',
      payeeName: 'Accra District Office',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('calculates due date for next month with day padding and year rollover', () => {
      expect(calculateDueDateForPeriod('2026-10', 10)).toBe('2026-11-10');
      expect(calculateDueDateForPeriod('2026-12', 15)).toBe('2027-01-15');
      expect(calculateDueDateForPeriod('2026-02', 31)).toBe('2026-03-28'); // capped at 28
    });

    it('calculates remittance due on percentage basis in GHS', () => {
      // 10% of 24,900.00 GHS (2,490,000 pesewas) = 2,490.00 GHS (249,000 pesewas)
      const res = calculateRemittanceDue(mockRule, 2490000n, '2026-10');
      expect(res.amountDue).toBe(249000n);
      expect(res.dueDate).toBe('2026-11-10');
      expect(res.currency).toBe('GHS');
      expect(res.rateOrAmount).toBe('10%');
    });

    it('calculates fixed remittance amount', () => {
      const fixedRule: TitheRemittanceRule = {
        ...mockRule,
        basis: 'FIXED',
        percentageOrAmount: '300000', // 3,000.00 GHS
      };
      const res = calculateRemittanceDue(fixedRule, 2490000n, '2026-10');
      expect(res.amountDue).toBe(300000n);
    });

    it('calculates USD remittance converted from GHS gross tithes', () => {
      const usdRule: TitheRemittanceRule = {
        ...mockRule,
        currency: 'USD',
      };
      // 10% of 24,900.00 GHS = 2,490.00 GHS. At rate 15.5 GHS/USD -> 2490 / 15.5 = $160.65 USD (16065 cents)
      const res = calculateRemittanceDue(usdRule, 2490000n, '2026-10', 15.5);
      expect(res.amountDue).toBe(16065n);
      expect(res.currency).toBe('USD');
    });

    it('identifies overdue remittances', () => {
      const remittance: TitheRemittance = {
        id: 'rem-01',
        branchId: 'b-01',
        ruleId: 'rule-dist-10',
        period: '2026-09',
        tithesBasisGhs: 2340000n,
        amountDue: 234000n,
        amountPaid: 0n,
        balanceOutstanding: 234000n,
        currency: 'GHS',
        status: 'ACCRUED',
        dueDate: '2026-10-10',
        voucherIds: [],
        createdAt: '2026-10-01T00:00:00Z',
      };

      // As of 2026-10-28, dueDate 2026-10-10 is overdue
      expect(isRemittanceOverdue(remittance, '2026-10-28')).toBe(true);

      // As of 2026-10-05, not overdue yet
      expect(isRemittanceOverdue(remittance, '2026-10-05')).toBe(false);

      // Fully paid is not overdue even after due date
      const paidRemittance = { ...remittance, balanceOutstanding: 0n };
      expect(isRemittanceOverdue(paidRemittance, '2026-10-28')).toBe(false);
    });

    it('evaluates status correctly across lifecycle', () => {
      expect(evaluateRemittanceStatus(249000n, 0n, '2026-11-10', '2026-10-28')).toBe('ACCRUED');
      expect(evaluateRemittanceStatus(249000n, 100000n, '2026-11-10', '2026-10-28')).toBe('PARTIALLY_PAID');
      expect(evaluateRemittanceStatus(249000n, 249000n, '2026-11-10', '2026-10-28')).toBe('FULLY_PAID');
      expect(evaluateRemittanceStatus(249000n, 0n, '2026-10-10', '2026-10-28')).toBe('OVERDUE');
    });
  });
});
