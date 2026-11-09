import Big from 'big.js';

// Configure Big.js for accounting: Round Half To Even (Banker's Rounding)
// Big.RM = 2 is ROUND_HALF_EVEN (0: ROUND_DOWN, 1: ROUND_HALF_UP, 2: ROUND_HALF_EVEN, 3: ROUND_UP)
Big.RM = 2;
Big.DP = 10; // High internal precision for rate conversions

export type Currency = 'GHS' | 'USD';

export interface Money {
  readonly amount: bigint; // Minor units: pesewas for GHS, cents for USD
  readonly currency: Currency;
}

export interface LineConversionResult {
  readonly originalAmount: bigint;
  readonly originalCurrency: Currency;
  readonly exchangeRate: string; // e.g. "15.2500"
  readonly baseAmountGhs: bigint; // Integer pesewas
  readonly roundingDifference: bigint; // Exact rounding difference in pesewas
}

export interface AllocationSplit {
  readonly share: bigint;
  readonly ratio: number;
}

/**
 * Creates a Money object in minor units (pesewas/cents).
 */
export function money(amount: bigint | number | string, currency: Currency): Money {
  let minorUnits: bigint;
  if (typeof amount === 'bigint') {
    minorUnits = amount;
  } else if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new Error(`Money minor unit must be an integer, got non-integer number: ${amount}`);
    }
    minorUnits = BigInt(amount);
  } else {
    // string representation of integer
    if (!/^-?\d+$/.test(amount.trim())) {
      throw new Error(`Money minor unit string must be an integer, got: ${amount}`);
    }
    minorUnits = BigInt(amount.trim());
  }

  return Object.freeze({
    amount: minorUnits,
    currency,
  });
}

/**
 * Creates a Money object from major units (e.g. "15.50" GHS -> 1550 pesewas).
 */
export function moneyFromMajor(majorUnits: string | number, currency: Currency): Money {
  const b = new Big(majorUnits);
  // Minor units = major * 100
  const minor = b.times(100).round(0, Big.roundHalfEven);
  return money(BigInt(minor.toFixed(0)), currency);
}

/**
 * Converts minor units to a major units string formatted to 2 decimal places (e.g. 1550 -> "15.50").
 */
export function toMajorUnitsString(amount: bigint): string {
  const isNegative = amount < 0n;
  const abs = isNegative ? -amount : amount;
  const major = abs / 100n;
  const minor = abs % 100n;
  const paddedMinor = minor.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${major.toString()}.${paddedMinor}`;
}

/**
 * Formats money with its currency symbol/code for display.
 */
export function formatMoney(value: Money, options: { includeCode?: boolean } = { includeCode: true }): string {
  const formattedNumber = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(toMajorUnitsString(value.amount)));

  if (options.includeCode) {
    return `${value.currency} ${formattedNumber}`;
  }
  return formattedNumber;
}

/**
 * Adds two Money values of the same currency.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} and ${b.currency}`);
  }
  return money(a.amount + b.amount, a.currency);
}

/**
 * Subtracts Money b from Money a (a - b).
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract different currencies: ${a.currency} and ${b.currency}`);
  }
  return money(a.amount - b.amount, a.currency);
}

/**
 * Multiplies Money by a numeric factor using Banker's Rounding.
 */
export function multiplyMoney(a: Money, factor: number | string): Money {
  const result = new Big(a.amount.toString())
    .times(factor)
    .round(0, Big.roundHalfEven);
  return money(BigInt(result.toFixed(0)), a.currency);
}

/**
 * Divides an amount into n parts using the Largest Remainder Method (Hamilton-Apportionment).
 * Guaranteed to NEVER lose or create a single pesewa/cent.
 * Sum of all split amounts is strictly equal to the original amount.
 */
export function allocateMoney(
  total: Money,
  ratios: readonly number[]
): readonly Money[] {
  if (ratios.length === 0) {
    return [];
  }

  const sumOfRatios = ratios.reduce((acc, r) => acc + r, 0);
  if (sumOfRatios <= 0) {
    throw new Error('Sum of allocation ratios must be strictly positive');
  }

  const totalAmount = total.amount;
  const isNegative = totalAmount < 0n;
  const absTotal = isNegative ? -totalAmount : totalAmount;

  const exactShares: { index: number; floor: bigint; remainder: Big }[] = [];
  let allocatedSum = 0n;

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i]!;
    if (ratio < 0) {
      throw new Error(`Ratio cannot be negative: ${ratio}`);
    }
    const exact = new Big(absTotal.toString()).times(ratio).div(sumOfRatios);
    const floorShare = BigInt(exact.round(0, Big.roundDown).toFixed(0));
    const remainder = exact.minus(floorShare.toString());

    exactShares.push({ index: i, floor: floorShare, remainder });
    allocatedSum += floorShare;
  }

  let remainderPesewas = Number(absTotal - allocatedSum);

  // Sort by largest remainder descending, preserving stable order on tie
  const sortedByRemainder = [...exactShares].sort((a, b) => {
    const diff = b.remainder.minus(a.remainder);
    if (diff.gt(0)) return 1;
    if (diff.lt(0)) return -1;
    return a.index - b.index;
  });

  // Distribute remaining 1-unit increments to the highest remainders
  const finalAmounts = new Array<bigint>(ratios.length).fill(0n);
  for (const item of exactShares) {
    finalAmounts[item.index] = item.floor;
  }

  for (let i = 0; i < remainderPesewas; i++) {
    const targetIndex = sortedByRemainder[i % sortedByRemainder.length]!.index;
    finalAmounts[targetIndex] = finalAmounts[targetIndex]! + 1n;
  }

  return finalAmounts.map((amt) =>
    money(isNegative ? -amt : amt, total.currency)
  );
}

/**
 * Converts a line amount to base currency (GHS).
 * For GHS, base_amount = original_amount and rate = 1.0.
 * For USD, computes base_amount_ghs = roundHalfEven(original_amount * exchange_rate)
 * and records the exact rounding difference.
 */
export function convertLineToBaseCurrency(
  originalAmount: bigint,
  originalCurrency: Currency,
  exchangeRateInput: string | number
): LineConversionResult {
  if (originalCurrency === 'GHS') {
    return {
      originalAmount,
      originalCurrency: 'GHS',
      exchangeRate: '1.0000',
      baseAmountGhs: originalAmount,
      roundingDifference: 0n,
    };
  }

  const rate = new Big(exchangeRateInput);
  if (rate.lte(0)) {
    throw new Error(`Exchange rate must be positive, got: ${exchangeRateInput}`);
  }

  const exactBase = new Big(originalAmount.toString()).times(rate);
  const roundedBase = exactBase.round(0, Big.roundHalfEven);
  const baseAmountGhs = BigInt(roundedBase.toFixed(0));

  // Mathematical difference between exact product and rounded integer pesewas
  const diff = exactBase.minus(roundedBase);
  // Rounding difference in whole pesewas (0n if fractional part is rounded off)
  const diffPesewas = BigInt(diff.round(0, Big.roundHalfEven).toFixed(0));

  return {
    originalAmount,
    originalCurrency,
    exchangeRate: rate.toFixed(4),
    baseAmountGhs,
    roundingDifference: diffPesewas,
  };
}

/**
 * Reconciles journal line rounding differences across a transaction.
 * Given lines in base currency, checks if debits == credits.
 * If there is a small rounding difference (e.g. 1-2 pesewas), returns
 * the balancing line to post to the Rounding Differences account.
 */
export function calculateBalancingDifference(
  lines: readonly { debitAmountGhs: bigint; creditAmountGhs: bigint }[]
): {
  totalDebits: bigint;
  totalCredits: bigint;
  difference: bigint; // debits - credits
  isBalanced: boolean;
} {
  let totalDebits = 0n;
  let totalCredits = 0n;

  for (const line of lines) {
    totalDebits += line.debitAmountGhs;
    totalCredits += line.creditAmountGhs;
  }

  const difference = totalDebits - totalCredits;

  return {
    totalDebits,
    totalCredits,
    difference,
    isBalanced: difference === 0n,
  };
}
