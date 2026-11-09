import type {
  FixedAssetCategoryCode,
  FixedAssetRecord,
  FixedAssetSummary,
  DepreciationLine,
  DepreciationRun,
  MovementScheduleCategoryRow,
  FixedAssetMovementSchedule,
  RegisterLedgerReconciliationCategoryRow,
  RegisterLedgerReconciliation,
  VerificationScope,
  VerificationItemStatus,
  AssetVerificationLine,
  AssetVerificationSignoff,
  AssetVerification,
  FixedAssetCondition,
  AssetEvent,
} from './types.js';
import {
  DEFAULT_ASSET_CATEGORIES,
  getCategoryByCode,
  isCategoryDepreciable,
} from './categories.js';

export interface DepreciationCalculation {
  readonly ageMonths: number;
  readonly depreciableAmountPesewas: bigint;
  readonly monthlyDepreciationPesewas: bigint;
  readonly annualDepreciationPesewas: bigint;
  readonly accumulatedDepreciationPesewas: bigint;
  readonly netBookValuePesewas: bigint;
  readonly isFullyDepreciated: boolean;
}

/**
 * Calculates exact straight-line depreciation for an asset at a given valuation date.
 * Land and non-depreciable categories always return zero accumulated depreciation.
 */
export function calculateAssetDepreciationValues(
  costPesewas: bigint,
  residualValuePesewas: bigint,
  usefulLifeMonths: number,
  startDateStr: string,
  asOfDateStr: string = new Date().toISOString().slice(0, 10),
  isDepreciable: boolean = true
): DepreciationCalculation {
  if (!isDepreciable || usefulLifeMonths <= 0 || costPesewas <= 0n) {
    return {
      ageMonths: 0,
      depreciableAmountPesewas: 0n,
      monthlyDepreciationPesewas: 0n,
      annualDepreciationPesewas: 0n,
      accumulatedDepreciationPesewas: 0n,
      netBookValuePesewas: costPesewas,
      isFullyDepreciated: false,
    };
  }

  const depreciableAmount = costPesewas > residualValuePesewas ? costPesewas - residualValuePesewas : 0n;
  if (depreciableAmount === 0n) {
    return {
      ageMonths: 0,
      depreciableAmountPesewas: 0n,
      monthlyDepreciationPesewas: 0n,
      annualDepreciationPesewas: 0n,
      accumulatedDepreciationPesewas: 0n,
      netBookValuePesewas: costPesewas,
      isFullyDepreciated: true,
    };
  }

  const startDate = new Date(startDateStr);
  const asOfDate = new Date(asOfDateStr);

  let ageMonths =
    (asOfDate.getFullYear() - startDate.getFullYear()) * 12 +
    (asOfDate.getMonth() - startDate.getMonth());

  if (asOfDate.getDate() < startDate.getDate()) {
    ageMonths -= 1;
  }

  if (ageMonths < 0) {
    ageMonths = 0;
  }

  const totalMonthsBig = BigInt(usefulLifeMonths);
  const monthlyDep = depreciableAmount / totalMonthsBig;
  const annualDep = monthlyDep * 12n;

  let accumulated: bigint;
  let isFullyDepreciated = false;

  if (BigInt(ageMonths) >= totalMonthsBig) {
    accumulated = depreciableAmount;
    isFullyDepreciated = true;
  } else {
    // Preserve integer precision by multiplying before dividing
    accumulated = (depreciableAmount * BigInt(ageMonths)) / totalMonthsBig;
    if (accumulated > depreciableAmount) {
      accumulated = depreciableAmount;
      isFullyDepreciated = true;
    }
  }

  const netBookValue = costPesewas - accumulated;

  return {
    ageMonths,
    depreciableAmountPesewas: depreciableAmount,
    monthlyDepreciationPesewas: monthlyDep,
    annualDepreciationPesewas: annualDep,
    accumulatedDepreciationPesewas: accumulated,
    netBookValuePesewas: netBookValue,
    isFullyDepreciated,
  };
}

/**
 * Calculates gain or loss on asset disposal.
 * Positive = Gain on Disposal
 * Negative = Loss on Disposal
 */
export function calculateDisposalGainLoss(
  costInGhsPesewas: bigint,
  accumulatedDepreciationPesewas: bigint,
  proceedsPesewas: bigint
): {
  netBookValuePesewas: bigint;
  gainOrLossPesewas: bigint;
  isGain: boolean;
  isLoss: boolean;
  isBreakEven: boolean;
} {
  const netBookValuePesewas =
    costInGhsPesewas > accumulatedDepreciationPesewas
      ? costInGhsPesewas - accumulatedDepreciationPesewas
      : 0n;

  const gainOrLossPesewas = proceedsPesewas - netBookValuePesewas;

  return {
    netBookValuePesewas,
    gainOrLossPesewas,
    isGain: gainOrLossPesewas > 0n,
    isLoss: gainOrLossPesewas < 0n,
    isBreakEven: gainOrLossPesewas === 0n,
  };
}

/**
 * Summarizes the entire fixed asset portfolio.
 * Disposed assets are excluded from active totals (Section 3.6).
 */
export function summarizeFixedAssets(
  assets: readonly FixedAssetRecord[],
  includeDisposedInTotals: boolean = false
): FixedAssetSummary {
  const activeAssets = includeDisposedInTotals
    ? assets
    : assets.filter((a) => a.status !== 'DISPOSED');

  let totalCostPesewas = 0n;
  let totalAccumulatedDepreciationPesewas = 0n;
  let totalNetBookValuePesewas = 0n;

  const countByCategory: Record<FixedAssetCategoryCode, number> = {
    LAND: 0,
    BUILDINGS: 0,
    FURNITURE: 0,
    SOUND_AV: 0,
    MUSICAL_INSTRUMENTS: 0,
    VEHICLES: 0,
    COMPUTERS_IT: 0,
    GENERATORS: 0,
    KITCHEN: 0,
    OTHER: 0,
  };

  const costByCategory: Record<FixedAssetCategoryCode, bigint> = {
    LAND: 0n,
    BUILDINGS: 0n,
    FURNITURE: 0n,
    SOUND_AV: 0n,
    MUSICAL_INSTRUMENTS: 0n,
    VEHICLES: 0n,
    COMPUTERS_IT: 0n,
    GENERATORS: 0n,
    KITCHEN: 0n,
    OTHER: 0n,
  };

  const netBookValueByCategory: Record<FixedAssetCategoryCode, bigint> = {
    LAND: 0n,
    BUILDINGS: 0n,
    FURNITURE: 0n,
    SOUND_AV: 0n,
    MUSICAL_INSTRUMENTS: 0n,
    VEHICLES: 0n,
    COMPUTERS_IT: 0n,
    GENERATORS: 0n,
    KITCHEN: 0n,
    OTHER: 0n,
  };

  for (const asset of activeAssets) {
    totalCostPesewas += asset.costInGhsPesewas;
    totalAccumulatedDepreciationPesewas += asset.accumulatedDepreciationPesewas;
    totalNetBookValuePesewas += asset.netBookValuePesewas;

    const cat = asset.categoryCode;
    if (cat in countByCategory) {
      countByCategory[cat] += 1;
      costByCategory[cat] += asset.costInGhsPesewas;
      netBookValueByCategory[cat] += asset.netBookValuePesewas;
    }
  }

  return {
    totalAssetsCount: activeAssets.length,
    totalCostPesewas,
    totalAccumulatedDepreciationPesewas,
    totalNetBookValuePesewas,
    countByCategory,
    costByCategory,
    netBookValueByCategory,
  };
}

/**
 * Checks if an expenditure meets or exceeds the capitalisation threshold.
 */
export function meetsCapitalisationThreshold(
  costPesewasOrCents: bigint,
  thresholdPesewasOrCents: bigint
): boolean {
  return costPesewasOrCents >= thresholdPesewasOrCents;
}

/**
 * Generates an append-only depreciation preview for a specified period and frequency.
 * Lists all active depreciable assets with individual charges, and skipped assets with exact reasons.
 */
export function generateDepreciationPreview(
  assets: readonly FixedAssetRecord[],
  period: string, // e.g. "2026-10" or "2026"
  periodType: 'MONTHLY' | 'YEARLY',
  asOfDateStr: string = new Date().toISOString().slice(0, 10),
  preparedBy: string = 'Finance Secretary'
): DepreciationRun {
  const lines: DepreciationLine[] = [];
  let totalEligibleAssets = 0;
  let totalSkippedAssets = 0;
  let totalChargePesewas = 0n;

  for (const asset of assets) {
    const cat = getCategoryByCode(asset.categoryCode);
    const catName = cat?.name ?? asset.categoryName;
    const isDep = cat ? cat.isDepreciable : isCategoryDepreciable(asset.categoryCode);

    const assetAcct = cat ? `acct-${cat.costAccountCode}` : 'acct-1590';
    const accDepAcct = cat?.accumulatedDepAccountCode
      ? `acct-${cat.accumulatedDepAccountCode}`
      : 'acct-1591';
    const depExpAcct = cat?.depExpenseAccountCode
      ? `acct-${cat.depExpenseAccountCode}`
      : 'acct-5290';

    // Rule 1: Disposed assets are skipped (Section 3.4 & 3.6)
    if (asset.status === 'DISPOSED') {
      totalSkippedAssets++;
      lines.push({
        id: `depline-${asset.id}-${period}`,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        description: asset.description,
        categoryCode: asset.categoryCode,
        categoryName: catName,
        fundId: asset.fundId,
        fundName: asset.fundName,
        costPesewas: asset.costInGhsPesewas,
        residualValuePesewas: asset.residualValuePesewas,
        priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        chargePesewas: 0n,
        newAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        projectedNetBookValuePesewas: asset.netBookValuePesewas,
        assetAccountCode: assetAcct,
        accumulatedDepreciationAccountCode: accDepAcct,
        depreciationExpenseAccountCode: depExpAcct,
        status: 'SKIPPED',
        skipReason: 'DISPOSED',
      });
      continue;
    }

    // Rule 2: Land and non-depreciable categories are skipped (Section 3.1 & 3.4)
    if (!isDep || asset.categoryCode === 'LAND') {
      totalSkippedAssets++;
      lines.push({
        id: `depline-${asset.id}-${period}`,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        description: asset.description,
        categoryCode: asset.categoryCode,
        categoryName: catName,
        fundId: asset.fundId,
        fundName: asset.fundName,
        costPesewas: asset.costInGhsPesewas,
        residualValuePesewas: asset.residualValuePesewas,
        priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        chargePesewas: 0n,
        newAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        projectedNetBookValuePesewas: asset.netBookValuePesewas,
        assetAccountCode: assetAcct,
        accumulatedDepreciationAccountCode: accDepAcct,
        depreciationExpenseAccountCode: depExpAcct,
        status: 'SKIPPED',
        skipReason: 'LAND_NON_DEPRECIABLE',
      });
      continue;
    }

    // Rule 3: Start date in the future (asset not yet in service) (Section 3.4)
    if (asset.depreciationStartDate > asOfDateStr) {
      totalSkippedAssets++;
      lines.push({
        id: `depline-${asset.id}-${period}`,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        description: asset.description,
        categoryCode: asset.categoryCode,
        categoryName: catName,
        fundId: asset.fundId,
        fundName: asset.fundName,
        costPesewas: asset.costInGhsPesewas,
        residualValuePesewas: asset.residualValuePesewas,
        priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        chargePesewas: 0n,
        newAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        projectedNetBookValuePesewas: asset.netBookValuePesewas,
        assetAccountCode: assetAcct,
        accumulatedDepreciationAccountCode: accDepAcct,
        depreciationExpenseAccountCode: depExpAcct,
        status: 'SKIPPED',
        skipReason: 'NOT_YET_IN_SERVICE',
      });
      continue;
    }

    // Rule 4: Already fully depreciated / reached residual value (Section 3.4)
    if (asset.netBookValuePesewas <= asset.residualValuePesewas) {
      totalSkippedAssets++;
      lines.push({
        id: `depline-${asset.id}-${period}`,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        description: asset.description,
        categoryCode: asset.categoryCode,
        categoryName: catName,
        fundId: asset.fundId,
        fundName: asset.fundName,
        costPesewas: asset.costInGhsPesewas,
        residualValuePesewas: asset.residualValuePesewas,
        priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        chargePesewas: 0n,
        newAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        projectedNetBookValuePesewas: asset.netBookValuePesewas,
        assetAccountCode: assetAcct,
        accumulatedDepreciationAccountCode: accDepAcct,
        depreciationExpenseAccountCode: depExpAcct,
        status: 'SKIPPED',
        skipReason: 'FULLY_DEPRECIATED',
      });
      continue;
    }

    // Active eligible depreciable asset
    const depreciableBase =
      asset.costInGhsPesewas > asset.residualValuePesewas
        ? asset.costInGhsPesewas - asset.residualValuePesewas
        : 0n;

    const usefulLifeMonthsBig = BigInt(Math.max(1, asset.usefulLifeMonths));
    const monthlyCharge = depreciableBase / usefulLifeMonthsBig;
    const nominalCharge =
      periodType === 'YEARLY' ? monthlyCharge * 12n : monthlyCharge;

    // Minimum 1 pesewa charge if depreciableBase > 0 to prevent zero progress due to integer division
    const candidateCharge = nominalCharge > 0n ? nominalCharge : 1n;

    // Hard stop when net book value reaches residual value (Section 3.4)
    const maxChargeAllowed = asset.netBookValuePesewas - asset.residualValuePesewas;
    const charge = candidateCharge > maxChargeAllowed ? maxChargeAllowed : candidateCharge;

    if (charge <= 0n) {
      totalSkippedAssets++;
      lines.push({
        id: `depline-${asset.id}-${period}`,
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        description: asset.description,
        categoryCode: asset.categoryCode,
        categoryName: catName,
        fundId: asset.fundId,
        fundName: asset.fundName,
        costPesewas: asset.costInGhsPesewas,
        residualValuePesewas: asset.residualValuePesewas,
        priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        chargePesewas: 0n,
        newAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
        projectedNetBookValuePesewas: asset.netBookValuePesewas,
        assetAccountCode: assetAcct,
        accumulatedDepreciationAccountCode: accDepAcct,
        depreciationExpenseAccountCode: depExpAcct,
        status: 'SKIPPED',
        skipReason: 'FULLY_DEPRECIATED',
      });
      continue;
    }

    const newAccumulated = asset.accumulatedDepreciationPesewas + charge;
    const projectedNbv = asset.costInGhsPesewas - newAccumulated;

    totalEligibleAssets++;
    totalChargePesewas += charge;

    lines.push({
      id: `depline-${asset.id}-${period}`,
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      description: asset.description,
      categoryCode: asset.categoryCode,
      categoryName: catName,
      fundId: asset.fundId,
      fundName: asset.fundName,
      costPesewas: asset.costInGhsPesewas,
      residualValuePesewas: asset.residualValuePesewas,
      priorAccumulatedDepreciationPesewas: asset.accumulatedDepreciationPesewas,
      chargePesewas: charge,
      newAccumulatedDepreciationPesewas: newAccumulated,
      projectedNetBookValuePesewas: projectedNbv,
      assetAccountCode: assetAcct,
      accumulatedDepreciationAccountCode: accDepAcct,
      depreciationExpenseAccountCode: depExpAcct,
      status: 'ACTIVE',
    });
  }

  const runNumber = `DEP-${period.toUpperCase()}`;

  return {
    id: `deprun-${period}-${Date.now()}`,
    runNumber,
    period,
    periodType,
    runDate: asOfDateStr,
    totalEligibleAssets,
    totalSkippedAssets,
    totalChargePesewas,
    lines,
    preparedBy,
    approvedByTreasurer: 'Pending Approval',
    status: 'POSTED',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Checks if a depreciation run can be posted for a given period.
 * Returns false if a non-reversed run already exists for this period (Section 3.4).
 */
export function canPostDepreciationPeriod(
  existingRuns: readonly DepreciationRun[],
  period: string
): { canPost: boolean; reason?: string } {
  const existing = existingRuns.find(
    (r) => r.period === period && r.status === 'POSTED'
  );
  if (existing) {
    return {
      canPost: false,
      reason: `Period ${period} has already been depreciated in run ${existing.runNumber}. A period cannot be depreciated twice unless reversed.`,
    };
  }
  return { canPost: true };
}

/**
 * Generates the standard Fixed Asset Movement Schedule (Note to Financial Statements per Section 3.10).
 */
export function generateMovementSchedule(
  assets: readonly FixedAssetRecord[],
  periodStart: string,
  periodEnd: string
): FixedAssetMovementSchedule {
  const rows: MovementScheduleCategoryRow[] = [];

  let totCostAtStart = 0n;
  let totAdditionsCost = 0n;
  let totDisposalsCost = 0n;
  let totCostAtEnd = 0n;
  let totAccDepAtStart = 0n;
  let totChargeForPeriod = 0n;
  let totDisposalsAccDep = 0n;
  let totAccDepAtEnd = 0n;
  let totNbvAtStart = 0n;
  let totNbvAtEnd = 0n;

  for (const cat of DEFAULT_ASSET_CATEGORIES) {
    const catAssets = assets.filter((a) => a.categoryCode === cat.code);

    let costAtStart = 0n;
    let additionsCost = 0n;
    let disposalsCost = 0n;
    let accDepAtStart = 0n;
    let chargeForPeriod = 0n;
    let disposalsAccDep = 0n;
    let costAtEnd = 0n;
    let accDepAtEnd = 0n;

    for (const a of catAssets) {
      const isAcquiredBeforeStart = a.acquisitionDate < periodStart;
      const isAcquiredDuringPeriod =
        a.acquisitionDate >= periodStart && a.acquisitionDate <= periodEnd;

      const isDisposed = a.status === 'DISPOSED' && !!a.disposalDetails;
      const disposalDate = a.disposalDetails?.disposalDate;
      const isDisposedBeforeStart =
        isDisposed && disposalDate && disposalDate < periodStart;
      const isDisposedDuringPeriod =
        isDisposed &&
        disposalDate &&
        disposalDate >= periodStart &&
        disposalDate <= periodEnd;

      if (isDisposedBeforeStart) {
        // Excluded from this period entirely
        continue;
      }

      if (isAcquiredBeforeStart) {
        costAtStart += a.costInGhsPesewas;
        // Prior accumulated depreciation
        accDepAtStart += a.accumulatedDepreciationPesewas;
      } else if (isAcquiredDuringPeriod) {
        additionsCost += a.costInGhsPesewas;
      }

      if (isDisposedDuringPeriod) {
        disposalsCost += a.costInGhsPesewas;
        disposalsAccDep += a.accumulatedDepreciationPesewas;
      } else if (!isDisposed) {
        costAtEnd += a.costInGhsPesewas;
        accDepAtEnd += a.accumulatedDepreciationPesewas;
      }

      // Find any depreciation events during period
      const periodDepEvents = a.events.filter(
        (e) =>
          e.eventType === 'DEPRECIATION' &&
          e.date >= periodStart &&
          e.date <= periodEnd
      );
      for (const e of periodDepEvents) {
        if (e.costPesewas) {
          chargeForPeriod += e.costPesewas;
        }
      }
    }

    // If costAtEnd was computed from active assets, ensure arithmetic reconciliation:
    // costAtEnd = costAtStart + additionsCost - disposalsCost
    if (costAtEnd === 0n && (costAtStart > 0n || additionsCost > 0n)) {
      costAtEnd = costAtStart + additionsCost - disposalsCost;
    }
    if (accDepAtEnd === 0n && accDepAtStart > 0n) {
      accDepAtEnd = accDepAtStart + chargeForPeriod - disposalsAccDep;
    }

    const nbvAtStart =
      costAtStart > accDepAtStart ? costAtStart - accDepAtStart : 0n;
    const nbvAtEnd = costAtEnd > accDepAtEnd ? costAtEnd - accDepAtEnd : 0n;

    rows.push({
      categoryCode: cat.code,
      categoryName: cat.name,
      costAtStartPesewas: costAtStart,
      additionsCostPesewas: additionsCost,
      disposalsCostPesewas: disposalsCost,
      costAtEndPesewas: costAtEnd,
      accumulatedDepreciationAtStartPesewas: accDepAtStart,
      chargeForPeriodPesewas: chargeForPeriod,
      disposalsAccumulatedDepreciationPesewas: disposalsAccDep,
      accumulatedDepreciationAtEndPesewas: accDepAtEnd,
      netBookValueAtStartPesewas: nbvAtStart,
      netBookValueAtEndPesewas: nbvAtEnd,
    });

    totCostAtStart += costAtStart;
    totAdditionsCost += additionsCost;
    totDisposalsCost += disposalsCost;
    totCostAtEnd += costAtEnd;
    totAccDepAtStart += accDepAtStart;
    totChargeForPeriod += chargeForPeriod;
    totDisposalsAccDep += disposalsAccDep;
    totAccDepAtEnd += accDepAtEnd;
    totNbvAtStart += nbvAtStart;
    totNbvAtEnd += nbvAtEnd;
  }

  const totals: MovementScheduleCategoryRow = {
    categoryCode: 'OTHER',
    categoryName: 'Total Fixed Assets',
    costAtStartPesewas: totCostAtStart,
    additionsCostPesewas: totAdditionsCost,
    disposalsCostPesewas: totDisposalsCost,
    costAtEndPesewas: totCostAtEnd,
    accumulatedDepreciationAtStartPesewas: totAccDepAtStart,
    chargeForPeriodPesewas: totChargeForPeriod,
    disposalsAccumulatedDepreciationPesewas: totDisposalsAccDep,
    accumulatedDepreciationAtEndPesewas: totAccDepAtEnd,
    netBookValueAtStartPesewas: totNbvAtStart,
    netBookValueAtEndPesewas: totNbvAtEnd,
  };

  return {
    periodStart,
    periodEnd,
    rows,
    totals,
  };
}

/**
 * Reconciles the Fixed Asset sub-ledger register with general ledger control accounts (Section 0 & Section 5).
 * Validates that total cost and total accumulated depreciation equal the control account balances.
 */
export function reconcileRegisterWithLedger(
  assets: readonly FixedAssetRecord[],
  accountBalances: Map<string, { debitPesewas: bigint; creditPesewas: bigint }>,
  asOfDateStr: string = new Date().toISOString().slice(0, 10)
): RegisterLedgerReconciliation {
  const rows: RegisterLedgerReconciliationCategoryRow[] = [];
  const activeAssets = assets.filter((a) => a.status !== 'DISPOSED');

  let totalRegisterCost = 0n;
  let totalLedgerCost = 0n;
  let totalRegisterAccDep = 0n;
  let totalLedgerAccDep = 0n;

  for (const cat of DEFAULT_ASSET_CATEGORIES) {
    const catAssets = activeAssets.filter((a) => a.categoryCode === cat.code);

    const regCost = catAssets.reduce((sum, a) => sum + a.costInGhsPesewas, 0n);
    const regAccDep = catAssets.reduce(
      (sum, a) => sum + a.accumulatedDepreciationPesewas,
      0n
    );

    const assetAcctId = `acct-${cat.costAccountCode}`;
    const accDepAcctId = cat.accumulatedDepAccountCode
      ? `acct-${cat.accumulatedDepAccountCode}`
      : 'acct-1591';

    const assetBal = accountBalances.get(assetAcctId) ?? {
      debitPesewas: 0n,
      creditPesewas: 0n,
    };
    const accDepBal = accountBalances.get(accDepAcctId) ?? {
      debitPesewas: 0n,
      creditPesewas: 0n,
    };

    // Cost accounts are Assets (Debit balance = Dr - Cr)
    const ledgerCost = assetBal.debitPesewas - assetBal.creditPesewas;
    // Accumulated depreciation accounts are Contra-Assets (Credit balance = Cr - Dr)
    const ledgerAccDep = accDepBal.creditPesewas - accDepBal.debitPesewas;

    const costDiff = regCost - ledgerCost;
    const accDepDiff = regAccDep - ledgerAccDep;

    const isInBalance = costDiff === 0n && accDepDiff === 0n;

    rows.push({
      categoryCode: cat.code,
      categoryName: cat.name,
      assetAccountCode: cat.costAccountCode,
      registerCostPesewas: regCost,
      ledgerCostPesewas: ledgerCost,
      costDifferencePesewas: costDiff,
      accumulatedDepreciationAccountCode: cat.accumulatedDepAccountCode ?? '1591',
      registerAccDepPesewas: regAccDep,
      ledgerAccDepPesewas: ledgerAccDep,
      accDepDifferencePesewas: accDepDiff,
      isInBalance,
    });

    totalRegisterCost += regCost;
    totalLedgerCost += ledgerCost;
    totalRegisterAccDep += regAccDep;
    totalLedgerAccDep += ledgerAccDep;
  }

  const totalCostDiff = totalRegisterCost - totalLedgerCost;
  const totalAccDepDiff = totalRegisterAccDep - totalLedgerAccDep;
  const isFullyInBalance = totalCostDiff === 0n && totalAccDepDiff === 0n;

  return {
    asOfDate: asOfDateStr,
    rows,
    totalRegisterCostPesewas: totalRegisterCost,
    totalLedgerCostPesewas: totalLedgerCost,
    totalCostDifferencePesewas: totalCostDiff,
    totalRegisterAccDepPesewas: totalRegisterAccDep,
    totalLedgerAccDepPesewas: totalLedgerAccDep,
    totalAccDepDifferencePesewas: totalAccDepDiff,
    isFullyInBalance,
  };
}

export interface CreateVerificationRunInput {
  title: string;
  scope: VerificationScope;
  scopeValue?: string;
  startDate?: string;
  createdBy: string;
  existingRunCount?: number;
}

/**
 * Initializes a new physical verification run (Section 3.8).
 * Scopes to active assets by location, custodian, category, or whole church.
 */
export function createVerificationRun(
  assets: readonly FixedAssetRecord[],
  input: CreateVerificationRunInput
): AssetVerification {
  const activeAssets = assets.filter((a) => a.status !== 'DISPOSED');

  let scopedAssets = activeAssets;
  if (input.scope === 'LOCATION' && input.scopeValue) {
    scopedAssets = activeAssets.filter((a) => a.location === input.scopeValue);
  } else if (input.scope === 'CUSTODIAN' && input.scopeValue) {
    scopedAssets = activeAssets.filter((a) => a.custodian === input.scopeValue);
  } else if (input.scope === 'CATEGORY' && input.scopeValue) {
    scopedAssets = activeAssets.filter((a) => a.categoryCode === input.scopeValue);
  }

  const year = new Date().getFullYear();
  const runIndex = (input.existingRunCount ?? 0) + 1;
  const verificationNumber = `VER-${year}-${String(runIndex).padStart(3, '0')}`;
  const verificationId = `ver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const startDate = input.startDate || new Date().toISOString().slice(0, 10);

  const lines: AssetVerificationLine[] = scopedAssets.map((a, idx) => ({
    id: `verline-${verificationId}-${idx + 1}`,
    verificationId,
    assetId: a.id,
    assetNumber: a.assetNumber,
    description: a.description,
    categoryName: a.categoryName,
    expectedLocation: a.location,
    expectedCustodian: a.custodian,
    costPesewas: a.costInGhsPesewas,
    netBookValuePesewas: a.netBookValuePesewas,
    status: 'PENDING',
    isUnrecordedFound: false,
    condition: a.condition,
  }));

  return {
    id: verificationId,
    verificationNumber,
    title: input.title,
    scope: input.scope,
    scopeValue: input.scopeValue,
    startDate,
    status: 'IN_PROGRESS',
    totalExpectedAssets: lines.length,
    pendingCount: lines.length,
    foundCount: 0,
    movedCount: 0,
    damagedCount: 0,
    missingCount: 0,
    unrecordedFoundCount: 0,
    lines,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
}

/**
 * Updates a verification line following physical barcode scan or visual inspection (Section 3.8).
 */
export function updateVerificationItem(
  verification: AssetVerification,
  lineId: string,
  updates: {
    status: VerificationItemStatus;
    actualLocation?: string;
    actualCustodian?: string;
    condition?: FixedAssetCondition;
    notes?: string;
    photoUrl?: string;
    verifiedBy: string;
    verifiedAt?: string;
  }
): AssetVerification {
  const verifiedAt = updates.verifiedAt || new Date().toISOString();

  let pendingCount = 0;
  let foundCount = 0;
  let movedCount = 0;
  let damagedCount = 0;
  let missingCount = 0;
  let unrecordedFoundCount = 0;

  const newLines = verification.lines.map((line) => {
    let updatedLine = line;
    if (line.id === lineId) {
      updatedLine = {
        ...line,
        status: updates.status,
        actualLocation: updates.actualLocation ?? line.actualLocation ?? line.expectedLocation,
        actualCustodian: updates.actualCustodian ?? line.actualCustodian ?? line.expectedCustodian,
        condition: updates.condition ?? line.condition,
        notes: updates.notes !== undefined ? updates.notes : line.notes,
        photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : line.photoUrl,
        verifiedBy: updates.verifiedBy,
        verifiedAt,
      };
    }

    if (updatedLine.isUnrecordedFound) {
      unrecordedFoundCount++;
    }

    switch (updatedLine.status) {
      case 'PENDING':
        pendingCount++;
        break;
      case 'FOUND':
        foundCount++;
        break;
      case 'MOVED':
        movedCount++;
        break;
      case 'DAMAGED':
        damagedCount++;
        break;
      case 'MISSING':
        missingCount++;
        break;
    }

    return updatedLine;
  });

  return {
    ...verification,
    pendingCount,
    foundCount,
    movedCount,
    damagedCount,
    missingCount,
    unrecordedFoundCount,
    lines: newLines,
  };
}

/**
 * Adds an unrecorded equipment asset discovered on premises to the verification run (Section 3.8).
 */
export function addUnrecordedAssetToVerification(
  verification: AssetVerification,
  item: {
    description: string;
    categoryName: string;
    actualLocation: string;
    actualCustodian: string;
    condition?: FixedAssetCondition;
    notes?: string;
    verifiedBy: string;
  }
): AssetVerification {
  const year = new Date().getFullYear();
  const unrecordedIndex = verification.unrecordedFoundCount + 1;
  const tempTag = `FOUND-${year}-${String(unrecordedIndex).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newLine: AssetVerificationLine = {
    id: `verline-unrec-${verification.id}-${Date.now()}`,
    verificationId: verification.id,
    assetNumber: tempTag,
    description: item.description,
    categoryName: item.categoryName,
    expectedLocation: 'Unrecorded',
    actualLocation: item.actualLocation,
    expectedCustodian: 'Unassigned',
    actualCustodian: item.actualCustodian,
    costPesewas: 0n,
    netBookValuePesewas: 0n,
    status: 'FOUND',
    condition: item.condition || 'GOOD',
    isUnrecordedFound: true,
    notes: item.notes || 'Found on premises during physical verification; not in asset register',
    verifiedAt: now,
    verifiedBy: item.verifiedBy,
  };

  const newLines = [...verification.lines, newLine];

  return {
    ...verification,
    foundCount: verification.foundCount + 1,
    unrecordedFoundCount: verification.unrecordedFoundCount + 1,
    lines: newLines,
  };
}

/**
 * Validates dual sign-off (Verifier and Treasurer or Pastor/Elder) and completes the verification (Section 3.8).
 */
export function finalizeVerificationRun(
  verification: AssetVerification,
  signoff: AssetVerificationSignoff
): { isValid: boolean; verification: AssetVerification; error?: string } {
  if (!signoff.verifierName || !signoff.verifierSignedAt) {
    return {
      isValid: false,
      verification,
      error: 'Physical verifier signature is mandatory to close the run.',
    };
  }

  if (!signoff.officerName || !signoff.officerSignedAt) {
    return {
      isValid: false,
      verification,
      error: 'Treasurer or Pastor / Elder approval sign-off is mandatory (dual-signature rule).',
    };
  }

  // Any items still pending are automatically marked MISSING with an audit note
  let updatedMissingCount = verification.missingCount;
  let updatedPendingCount = 0;

  const resolvedLines = verification.lines.map((l) => {
    if (l.status === 'PENDING') {
      updatedMissingCount++;
      return {
        ...l,
        status: 'MISSING' as VerificationItemStatus,
        notes: l.notes ? `${l.notes}; Unchecked at sign-off, flagged as missing` : 'Unchecked at sign-off, flagged as missing',
        verifiedBy: signoff.verifierName,
        verifiedAt: signoff.verifierSignedAt,
      };
    }
    return l;
  });

  const completedVerification: AssetVerification = {
    ...verification,
    status: 'COMPLETED',
    completedDate: new Date().toISOString().slice(0, 10),
    pendingCount: updatedPendingCount,
    missingCount: updatedMissingCount,
    lines: resolvedLines,
    signoff,
  };

  return {
    isValid: true,
    verification: completedVerification,
  };
}

/**
 * Applies physical verification exceptions directly to the fixed asset register (Section 3.8).
 * - MOVED: Updates asset location & records TRANSFER event.
 * - DAMAGED: Updates condition & flags as UNDER_REPAIR.
 * - MISSING: Flags status as MISSING for board write-off review.
 */
export function applyVerificationExceptions(
  assets: readonly FixedAssetRecord[],
  verification: AssetVerification,
  appliedBy: string
): { updatedAssets: FixedAssetRecord[]; appliedChanges: { moved: number; damaged: number; missing: number } } {
  const lineMap = new Map(
    verification.lines.filter((l) => !l.isUnrecordedFound && l.assetId).map((l) => [l.assetId!, l])
  );

  let moved = 0;
  let damaged = 0;
  let missing = 0;
  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);

  const updatedAssets = assets.map((asset) => {
    const line = lineMap.get(asset.id);
    if (!line) return asset;

    let updatedAsset = { ...asset };
    const newEvents: AssetEvent[] = [...asset.events];

    if (line.status === 'MOVED' && line.actualLocation && line.actualLocation !== asset.location) {
      moved++;
      newEvents.unshift({
        id: `evt-ver-mov-${Date.now()}-${asset.id}`,
        assetId: asset.id,
        eventType: 'TRANSFER',
        date: dateStr,
        performedBy: appliedBy,
        details: `Location updated from "${asset.location}" to "${line.actualLocation}" following verification ${verification.verificationNumber}`,
        fromLocation: asset.location,
        toLocation: line.actualLocation,
        approvalStatus: 'APPROVED',
        approvedBy: verification.signoff?.officerName || appliedBy,
        notes: line.notes,
        createdAt: now,
      });
      updatedAsset = {
        ...updatedAsset,
        location: line.actualLocation,
      };
    }

    if (line.status === 'DAMAGED' && line.condition) {
      damaged++;
      const isSevere = line.condition === 'DAMAGED' || line.condition === 'POOR';
      newEvents.unshift({
        id: `evt-ver-dam-${Date.now()}-${asset.id}`,
        assetId: asset.id,
        eventType: 'MAINTENANCE_REPAIR',
        date: dateStr,
        performedBy: appliedBy,
        details: `Condition assessed as ${line.condition} during verification ${verification.verificationNumber}. Notes: ${line.notes || 'Damage noted'}`,
        approvalStatus: 'APPROVED',
        approvedBy: verification.signoff?.officerName || appliedBy,
        notes: line.notes,
        createdAt: now,
      });
      updatedAsset = {
        ...updatedAsset,
        condition: line.condition,
        status: isSevere ? 'UNDER_REPAIR' : updatedAsset.status,
      };
    }

    if (line.status === 'MISSING') {
      missing++;
      newEvents.unshift({
        id: `evt-ver-mis-${Date.now()}-${asset.id}`,
        assetId: asset.id,
        eventType: 'VERIFICATION',
        date: dateStr,
        performedBy: appliedBy,
        details: `Asset not located during verification ${verification.verificationNumber}. Flagged as MISSING. Notes: ${line.notes || 'Unaccounted for'}`,
        approvalStatus: 'APPROVED',
        approvedBy: verification.signoff?.officerName || appliedBy,
        notes: line.notes,
        createdAt: now,
      });
      updatedAsset = {
        ...updatedAsset,
        status: 'MISSING',
      };
    }

    return {
      ...updatedAsset,
      events: newEvents,
    };
  });

  return {
    updatedAssets,
    appliedChanges: { moved, damaged, missing },
  };
}
