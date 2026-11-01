import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  money,
  moneyFromMajor,
  toMajorUnitsString,
  formatMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  allocateMoney,
  convertLineToBaseCurrency,
  calculateBalancingDifference,
} from '../src/money/index.js';

describe('Money domain module', () => {
  it('creates money in minor units and formats correctly', () => {
    const m = money(1550n, 'GHS');
    expect(m.amount).toBe(1550n);
    expect(m.currency).toBe('GHS');
    expect(toMajorUnitsString(m.amount)).toBe('15.50');
    expect(formatMoney(m)).toBe('GHS 15.50');
  });

  it('creates money from major units with banker rounding', () => {
    const m = moneyFromMajor('100.55', 'GHS');
    expect(m.amount).toBe(10055n);

    const m2 = moneyFromMajor(250.75, 'USD');
    expect(m2.amount).toBe(25075n);
    expect(m2.currency).toBe('USD');
  });

  it('adds and subtracts money of same currency', () => {
    const m1 = money(2000n, 'GHS');
    const m2 = money(1500n, 'GHS');

    expect(addMoney(m1, m2).amount).toBe(3500n);
    expect(subtractMoney(m1, m2).amount).toBe(500n);
  });

  it('rejects adding or subtracting different currencies', () => {
    const ghs = money(1000n, 'GHS');
    const usd = money(1000n, 'USD');

    expect(() => addMoney(ghs, usd)).toThrow(/Cannot add different currencies/);
    expect(() => subtractMoney(ghs, usd)).toThrow(/Cannot subtract different currencies/);
  });

  it('multiplies money by a factor with banker rounding', () => {
    const m = money(100n, 'GHS');
    const multiplied = multiplyMoney(m, '1.155');
    // 100 * 1.155 = 115.5 -> rounds to even 116
    expect(multiplied.amount).toBe(116n);
  });

  describe('allocateMoney (Largest Remainder Method)', () => {
    it('splits an odd pesewa amount exactly without losing or creating a single pesewa', () => {
      const total = money(100n, 'GHS'); // 100 pesewas (1 GHS) split 1:1:1
      const splits = allocateMoney(total, [1, 1, 1]);

      expect(splits).toHaveLength(3);
      const sum = splits.reduce((acc, curr) => acc + curr.amount, 0n);
      expect(sum).toBe(100n);
      // Splits should be 34, 33, 33
      expect(splits[0]!.amount).toBe(34n);
      expect(splits[1]!.amount).toBe(33n);
      expect(splits[2]!.amount).toBe(33n);
    });

    it('property test: sum of allocated parts is ALWAYS strictly equal to original amount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000_000 }), // amounts up to 1,000,000.00 GHS
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (amountInt, ratios) => {
            const total = money(BigInt(amountInt), 'GHS');
            const parts = allocateMoney(total, ratios);
            const sumParts = parts.reduce((acc, p) => acc + p.amount, 0n);
            return sumParts === total.amount;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('convertLineToBaseCurrency (Dual Currency)', () => {
    it('keeps GHS transactions 1:1 with rate 1.0000', () => {
      const res = convertLineToBaseCurrency(5000n, 'GHS', '1.0');
      expect(res.baseAmountGhs).toBe(5000n);
      expect(res.exchangeRate).toBe('1.0000');
      expect(res.roundingDifference).toBe(0n);
    });

    it('converts USD to base GHS accurately', () => {
      // 100.00 USD (10000 cents) at rate 15.5000 GHS/USD
      // base amount = 10000 * 15.5000 = 155000 pesewas (1550.00 GHS)
      const res = convertLineToBaseCurrency(10000n, 'USD', '15.5000');
      expect(res.baseAmountGhs).toBe(155000n);
      expect(res.roundingDifference).toBe(0n);
    });

    it('handles rounding when USD converted has fractional pesewas', () => {
      // 10.33 USD (1033 cents) at rate 15.2500 GHS/USD
      // exact = 1033 * 15.2500 = 15753.25 pesewas
      // banker's round to 0 decimal places = 15753
      const res = convertLineToBaseCurrency(1033n, 'USD', '15.2500');
      expect(res.baseAmountGhs).toBe(15753n);
    });
  });

  describe('calculateBalancingDifference', () => {
    it('detects balanced journal lines', () => {
      const lines = [
        { debitAmountGhs: 5000n, creditAmountGhs: 0n },
        { debitAmountGhs: 0n, creditAmountGhs: 5000n },
      ];
      const result = calculateBalancingDifference(lines);
      expect(result.isBalanced).toBe(true);
      expect(result.difference).toBe(0n);
    });

    it('detects unbalanced journal lines and reports exact difference', () => {
      const lines = [
        { debitAmountGhs: 5001n, creditAmountGhs: 0n },
        { debitAmountGhs: 0n, creditAmountGhs: 5000n },
      ];
      const result = calculateBalancingDifference(lines);
      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(1n);
    });
  });
});
