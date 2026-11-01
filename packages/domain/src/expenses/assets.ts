import type { FixedAsset, AssetDepreciationResult } from './types.js';

/**
 * Calculates straight-line depreciation for an asset as of a specific date.
 */
export function calculateAssetDepreciation(
  asset: FixedAsset,
  asOfDateStr: string = new Date().toISOString().slice(0, 10)
): AssetDepreciationResult {
  const purchaseDate = new Date(asset.purchaseDate);
  const asOfDate = new Date(asOfDateStr);

  const usefulLifeYears = Math.max(1, asset.usefulLifeYears);
  const depreciableAmount = asset.purchaseCostPesewas - asset.residualValuePesewas;

  if (depreciableAmount <= 0n) {
    return {
      assetId: asset.id,
      assetTag: asset.assetTag,
      purchaseCostPesewas: asset.purchaseCostPesewas,
      usefulLifeYears,
      annualDepreciationPesewas: 0n,
      monthlyDepreciationPesewas: 0n,
      ageMonths: 0,
      accumulatedDepreciationPesewas: 0n,
      netBookValuePesewas: asset.purchaseCostPesewas,
    };
  }

  // Straight-line annual & monthly rates
  const annualDepreciationPesewas = depreciableAmount / BigInt(usefulLifeYears);
  const monthlyDepreciationPesewas = annualDepreciationPesewas / 12n;

  // Calculate age in months
  let ageMonths =
    (asOfDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
    (asOfDate.getMonth() - purchaseDate.getMonth());

  if (ageMonths < 0) ageMonths = 0;

  // Total accumulated depreciation cannot exceed depreciable amount
  const maxDepreciation = depreciableAmount;
  let accumulated = monthlyDepreciationPesewas * BigInt(ageMonths);
  if (accumulated > maxDepreciation) {
    accumulated = maxDepreciation;
  }

  const netBookValuePesewas = asset.purchaseCostPesewas - accumulated;

  return {
    assetId: asset.id,
    assetTag: asset.assetTag,
    purchaseCostPesewas: asset.purchaseCostPesewas,
    usefulLifeYears,
    annualDepreciationPesewas,
    monthlyDepreciationPesewas,
    ageMonths,
    accumulatedDepreciationPesewas: accumulated,
    netBookValuePesewas,
  };
}

/**
 * Computes portfolio summary metrics for the fixed asset register.
 */
export function summarizeAssetRegister(
  assets: readonly FixedAsset[],
  asOfDateStr?: string
): {
  totalAssetsCount: number;
  totalCostPesewas: bigint;
  totalAccumulatedDepreciationPesewas: bigint;
  totalNetBookValuePesewas: bigint;
  results: AssetDepreciationResult[];
} {
  const results = assets.map((a) => calculateAssetDepreciation(a, asOfDateStr));

  const totalCostPesewas = results.reduce((acc, r) => acc + r.purchaseCostPesewas, 0n);
  const totalAccumulatedDepreciationPesewas = results.reduce(
    (acc, r) => acc + r.accumulatedDepreciationPesewas,
    0n
  );
  const totalNetBookValuePesewas = results.reduce((acc, r) => acc + r.netBookValuePesewas, 0n);

  return {
    totalAssetsCount: assets.length,
    totalCostPesewas,
    totalAccumulatedDepreciationPesewas,
    totalNetBookValuePesewas,
    results,
  };
}
