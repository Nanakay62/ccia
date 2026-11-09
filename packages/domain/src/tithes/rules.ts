import type {
  TitheBatch,
  TitheRecord,
  TitheBatchReconciliationResult,
  TitheParticipationStats,
  MemberTitheSummary,
  TitheDistributionBand,
  TitheSettings,
  TitheRemittanceRule,
  TitheRemittance,
  TitheRemittanceStatus,
  RemittanceCalculationResult,
} from './types.js';

export const DEFAULT_TITHE_SETTINGS: TitheSettings = {
  allowPastorViewIndividual: true,
  allowElderViewIndividual: false,
  distributionBandsGhs: [
    { label: 'Under 50 GHS', min: 0n, max: 4999n },
    { label: '50 to 199 GHS', min: 5000n, max: 19999n },
    { label: '200 GHS and over', min: 20000n, max: null },
  ],
  defaultCurrency: 'GHS',
  requireTwoSignaturesToPost: true,
  showLapsedGivers: false,
};

/**
 * Calculates tithe batch reconciliation status against the counting sheet.
 * The batch is balanced when: Counted = Allocated + Explained Unallocated.
 */
export function calculateTitheBatchSummary(
  countedTotal: bigint,
  records: { amount: bigint; isReversal?: boolean }[],
  explainedUnallocated: bigint = 0n
): TitheBatchReconciliationResult {
  const allocatedTotal = records.reduce((sum, r) => sum + r.amount, 0n);
  const unallocatedTotal = countedTotal - allocatedTotal;
  const unexplainedVariance = unallocatedTotal - explainedUnallocated;
  const isBalanced = unexplainedVariance === 0n;

  let message = 'Balanced to zero.';
  if (unexplainedVariance > 0n) {
    message = `Unallocated tithes of ${formatMinorUnits(unexplainedVariance)} require allocation or explanation.`;
  } else if (unexplainedVariance < 0n) {
    message = `Allocated amount exceeds counted tithes by ${formatMinorUnits(-unexplainedVariance)}.`;
  }

  return {
    countedTotal,
    allocatedTotal,
    unallocatedTotal,
    explainedUnallocated,
    unexplainedVariance,
    isBalanced,
    canReconcile: isBalanced,
    canPost: isBalanced && (records.length > 0 || countedTotal === 0n),
    message,
  };
}

/**
 * Validates whether a tithe batch can be posted to the ledger/subledger.
 * Requires batch to be reconciled, variance to be zero, and dual-person verification.
 */
export function validateTitheBatchPosting(
  batch: TitheBatch,
  postedByUserId: string,
  requireTwoSignatures: boolean = true
): { valid: boolean; error?: string } {
  if (batch.status === 'POSTED') {
    return { valid: false, error: 'This batch has already been posted and is read-only.' };
  }

  if (batch.status !== 'RECONCILED' && batch.status !== 'DRAFT') {
    return { valid: false, error: 'Batch must be reconciled before it can be posted.' };
  }

  const unexplained = batch.unallocatedTotal - batch.explainedUnallocated;
  if (unexplained !== 0n) {
    return {
      valid: false,
      error: `Batch cannot be posted with an unexplained variance of ${formatMinorUnits(unexplained)}.`,
    };
  }

  if (requireTwoSignatures && batch.reconciledBy && batch.reconciledBy === postedByUserId) {
    return {
      valid: false,
      error: 'Dual control required: the verifier/poster must be a different individual from the person who prepared/reconciled the batch.',
    };
  }

  return { valid: true };
}

/**
 * Calculates anonymous participation statistics and distribution bands.
 * Excludes member names to protect privacy.
 */
export function calculateTitheParticipation(
  records: TitheRecord[],
  activeMemberCount: number,
  period: string, // YYYY or YYYY-MM
  currency: string = 'GHS',
  customBands = DEFAULT_TITHE_SETTINGS.distributionBandsGhs
): TitheParticipationStats {
  const filteredRecords = records.filter(
    (r) =>
      r.currency === currency &&
      r.recordDate.startsWith(period) &&
      !r.isReversal
  );

  // Group by member to compute each individual's total for the period
  const memberTotals = new Map<string, bigint>();
  for (const rec of filteredRecords) {
    const current = memberTotals.get(rec.memberId) || 0n;
    memberTotals.set(rec.memberId, current + rec.amount);
  }

  const payerTotals = Array.from(memberTotals.values()).filter((amt) => amt > 0n);
  const totalPayers = payerTotals.length;
  const totalTitheAmount = payerTotals.reduce((sum, amt) => sum + amt, 0n);

  const averageTitheAmount = totalPayers > 0 ? totalTitheAmount / BigInt(totalPayers) : 0n;

  // Calculate median
  let medianTitheAmount = 0n;
  if (totalPayers > 0) {
    const sorted = [...payerTotals].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(sorted.length / 2);
    const midVal = sorted[mid] ?? 0n;
    const midPrev = sorted[mid - 1] ?? 0n;
    if (sorted.length % 2 === 1) {
      medianTitheAmount = midVal;
    } else {
      medianTitheAmount = (midPrev + midVal) / 2n;
    }
  }

  const participationPercentage =
    activeMemberCount > 0
      ? Math.round((totalPayers / activeMemberCount) * 1000) / 10
      : 0;

  // Compute distribution bands
  const bands: TitheDistributionBand[] = customBands.map((band, idx) => {
    const matchingAmounts = payerTotals.filter((amt) => {
      if (amt < band.min) return false;
      if (band.max !== null && amt > band.max) return false;
      return true;
    });

    const count = matchingAmounts.length;
    const bandTotal = matchingAmounts.reduce((sum, amt) => sum + amt, 0n);
    const percentage = totalPayers > 0 ? Math.round((count / totalPayers) * 1000) / 10 : 0;

    return {
      id: `band-${idx + 1}`,
      label: band.label,
      minAmount: band.min,
      maxAmount: band.max,
      count,
      percentage,
      totalAmount: bandTotal,
    };
  });

  return {
    period,
    currency,
    totalTitheAmount,
    totalPayers,
    activeMemberCount,
    participationPercentage,
    averageTitheAmount,
    medianTitheAmount,
    bands,
  };
}

/**
 * Calculates member-specific tithe summary, consistency, and monthly progress.
 */
export function calculateMemberTitheSummary(
  memberId: string,
  memberName: string,
  records: TitheRecord[],
  referenceYear: number,
  referenceMonth: number,
  envelopeNumber?: string,
  currency: string = 'GHS'
): MemberTitheSummary {
  const memberRecords = records.filter(
    (r) => r.memberId === memberId && r.currency === currency
  );

  const monthlyTotals: Record<number, bigint> = {
    1: 0n, 2: 0n, 3: 0n, 4: 0n, 5: 0n, 6: 0n,
    7: 0n, 8: 0n, 9: 0n, 10: 0n, 11: 0n, 12: 0n,
  };

  let ytdTotal = 0n;
  let lastTitheDate: string | undefined;
  let lastTitheAmount: bigint | undefined;

  // Sort by date ascending
  const sorted = [...memberRecords].sort((a, b) => a.recordDate.localeCompare(b.recordDate));

  for (const rec of sorted) {
    const parts = rec.recordDate.split('-');
    const year = parseInt(parts[0] ?? '0', 10);
    const month = parseInt(parts[1] ?? '0', 10);

    if (year === referenceYear && month >= 1 && month <= 12) {
      monthlyTotals[month] = (monthlyTotals[month] ?? 0n) + rec.amount;
      ytdTotal += rec.amount;
    }

    if (!rec.isReversal) {
      lastTitheDate = rec.recordDate;
      lastTitheAmount = rec.amount;
    }
  }

  let monthsPaidCount = 0;
  for (let m = 1; m <= referenceMonth; m++) {
    if ((monthlyTotals[m] ?? 0n) > 0n) {
      monthsPaidCount++;
    }
  }

  const monthsElapsedCount = Math.max(1, referenceMonth);
  const consistencyPercentage = Math.round((monthsPaidCount / monthsElapsedCount) * 100);

  return {
    memberId,
    memberName,
    envelopeNumber,
    currency,
    ytdTotal,
    monthsPaidCount,
    monthsElapsedCount,
    consistencyPercentage,
    lastTitheDate,
    lastTitheAmount,
    monthlyTotals,
    records: sorted,
  };
}

/**
 * Creates an append-only reversal for a misallocated or erroneous tithe record.
 */
export function createTitheReversal(
  originalRecord: TitheRecord,
  reversalReason: string,
  reversedBy: string,
  currentDate: string = (new Date().toISOString().split('T')[0] ?? '')
): TitheRecord {
  if (!reversalReason.trim()) {
    throw new Error('A reversal reason is mandatory.');
  }

  return {
    id: `tr-rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    branchId: originalRecord.branchId,
    batchId: originalRecord.batchId,
    memberId: originalRecord.memberId,
    memberName: originalRecord.memberName,
    envelopeNumber: originalRecord.envelopeNumber,
    recordDate: currentDate,
    amount: -originalRecord.amount,
    currency: originalRecord.currency,
    exchangeRate: originalRecord.exchangeRate,
    method: originalRecord.method,
    notes: `Reversal of ${originalRecord.id}: ${reversalReason}`,
    recordedBy: reversedBy,
    isReversal: true,
    reversalOfId: originalRecord.id,
    reversalReason,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Standardizes envelope numbers (e.g., '12' -> 'ENV-012', 'ENV-12' -> 'ENV-012').
 */
export function standardizeEnvelopeNumber(raw: string | number): string {
  const str = String(raw).trim().toUpperCase();
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (!digits) return str;
  return `ENV-${digits.padStart(3, '0')}`;
}

function formatMinorUnits(amount: bigint): string {
  const isNeg = amount < 0n;
  const abs = isNeg ? -amount : amount;
  const major = abs / 100n;
  const minor = abs % 100n;
  const formatted = `${major.toLocaleString('en-US')}.${minor.toString().padStart(2, '0')}`;
  return isNeg ? `(${formatted})` : formatted;
}

/**
 * Calculates due date for a remittance based on the period (YYYY-MM) and dueDayOfMonth.
 * E.g., for '2026-10' and dueDay 10 -> '2026-11-10'.
 */
export function calculateDueDateForPeriod(period: string, dueDayOfMonth: number): string {
  const parts = period.split('-');
  const y = parseInt(parts[0] ?? '2026', 10);
  const m = parseInt(parts[1] ?? '10', 10);

  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }

  const dayStr = Math.min(28, Math.max(1, dueDayOfMonth)).toString().padStart(2, '0');
  const monthStr = nextM.toString().padStart(2, '0');
  return `${nextY}-${monthStr}-${dayStr}`;
}

/**
 * Calculates tithe remittance liability for a specific rule and period.
 */
export function calculateRemittanceDue(
  rule: TitheRemittanceRule,
  grossTithesGhs: bigint,
  period: string,
  exchangeRate: number = 1.0 // rate for USD conversion if rule currency is USD
): RemittanceCalculationResult {
  let amountDue = 0n;

  if (rule.basis === 'PERCENTAGE') {
    const pct = parseFloat(rule.percentageOrAmount);
    if (!isNaN(pct) && pct > 0) {
      if (rule.currency === 'GHS') {
        amountDue = (grossTithesGhs * BigInt(Math.round(pct * 100))) / 10000n;
      } else if (rule.currency === 'USD') {
        const ghsMinor = (grossTithesGhs * BigInt(Math.round(pct * 100))) / 10000n;
        const rateVal = exchangeRate > 0 ? exchangeRate : 1.0;
        amountDue = BigInt(Math.round(Number(ghsMinor) / rateVal));
      }
    }
  } else {
    try {
      amountDue = BigInt(rule.percentageOrAmount);
    } catch {
      amountDue = 0n;
    }
  }

  const dueDate = calculateDueDateForPeriod(period, rule.dueDayOfMonth);

  return {
    period,
    tithesBasis: grossTithesGhs,
    ruleName: rule.name,
    rateOrAmount: rule.basis === 'PERCENTAGE' ? `${rule.percentageOrAmount}%` : formatMinorUnits(amountDue),
    amountDue,
    dueDate,
    currency: rule.currency,
  };
}

/**
 * Evaluates whether a remittance is overdue as of a reference date.
 */
export function isRemittanceOverdue(
  remittance: TitheRemittance,
  referenceDate: string = (new Date().toISOString().split('T')[0] ?? '')
): boolean {
  if (remittance.balanceOutstanding <= 0n) return false;
  return referenceDate > remittance.dueDate;
}

/**
 * Evaluates the status of a remittance based on amounts and due date.
 */
export function evaluateRemittanceStatus(
  amountDue: bigint,
  amountPaid: bigint,
  dueDate: string,
  referenceDate: string = (new Date().toISOString().split('T')[0] ?? '')
): TitheRemittanceStatus {
  const balance = amountDue - amountPaid;
  if (balance <= 0n) {
    return 'FULLY_PAID';
  }
  if (amountPaid > 0n) {
    return 'PARTIALLY_PAID';
  }
  if (referenceDate > dueDate) {
    return 'OVERDUE';
  }
  return 'ACCRUED';
}
