import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSET_CATEGORIES,
  calculateAssetDepreciationValues,
  calculateDisposalGainLoss,
  summarizeFixedAssets,
  meetsCapitalisationThreshold,
  generateQrMatrix,
  generateQrCodeSvg,
  getCategoryByCode,
  generateDepreciationPreview,
  canPostDepreciationPeriod,
  generateMovementSchedule,
  reconcileRegisterWithLedger,
  createVerificationRun,
  updateVerificationItem,
  addUnrecordedAssetToVerification,
  finalizeVerificationRun,
  applyVerificationExceptions,
  type FixedAssetRecord,
  type DepreciationRun,
  type AssetVerification,
} from '../src/index.js';

describe('Fixed Assets Domain Rules & Calculations', () => {
  it('loads the 10 standard asset categories with Land non-depreciable', () => {
    expect(DEFAULT_ASSET_CATEGORIES.length).toBe(10);
    const land = getCategoryByCode('LAND');
    expect(land).toBeDefined();
    expect(land?.isDepreciable).toBe(false);
    expect(land?.costAccountCode).toBe('1500');

    const buildings = getCategoryByCode('BUILDINGS');
    expect(buildings?.isDepreciable).toBe(true);
    expect(buildings?.costAccountCode).toBe('1510');
    expect(buildings?.accumulatedDepAccountCode).toBe('1511');
    expect(buildings?.depExpenseAccountCode).toBe('5210');
  });

  describe('calculateAssetDepreciationValues', () => {
    it('returns zero depreciation for Land and non-depreciable items', () => {
      const landCost = 25000000n; // GHS 250,000.00
      const calc = calculateAssetDepreciationValues(
        landCost,
        0n,
        0,
        '2020-01-01',
        '2026-10-31',
        false
      );

      expect(calc.accumulatedDepreciationPesewas).toBe(0n);
      expect(calc.netBookValuePesewas).toBe(landCost);
      expect(calc.monthlyDepreciationPesewas).toBe(0n);
      expect(calc.isFullyDepreciated).toBe(false);
    });

    it('calculates monthly straight-line depreciation correctly and respects residual value', () => {
      // Asset cost: GHS 60,000.00 = 6,000,000 pesewas
      // Useful life: 5 years = 60 months
      // Residual value: GHS 0
      // Purchased: 2024-10-01, Evaluated: 2026-10-01 -> Exactly 24 months elapsed
      const cost = 6000000n;
      const residual = 0n;
      const usefulLifeMonths = 60;

      const calc = calculateAssetDepreciationValues(
        cost,
        residual,
        usefulLifeMonths,
        '2024-10-01',
        '2026-10-01',
        true
      );

      expect(calc.ageMonths).toBe(24);
      // Depreciable base = 6,000,000. Monthly = 6,000,000 / 60 = 100,000 pesewas (GHS 1,000.00)
      expect(calc.monthlyDepreciationPesewas).toBe(100000n);
      // 24 months * 100,000 = 2,400,000 pesewas (GHS 24,000.00)
      expect(calc.accumulatedDepreciationPesewas).toBe(2400000n);
      // Net book value = 6,000,000 - 2,400,000 = 3,600,000 pesewas (GHS 36,000.00)
      expect(calc.netBookValuePesewas).toBe(3600000n);
      expect(calc.isFullyDepreciated).toBe(false);
    });

    it('stops depreciating when reaching the residual value', () => {
      // Cost: GHS 120,000.00 = 12,000,000 pesewas
      // Residual: GHS 10,000.00 = 1,000,000 pesewas
      // Useful life: 10 years = 120 months
      // Age: 15 years (180 months) -> Exceeds useful life
      const cost = 12000000n;
      const residual = 1000000n;
      const usefulLifeMonths = 120;

      const calc = calculateAssetDepreciationValues(
        cost,
        residual,
        usefulLifeMonths,
        '2010-01-01',
        '2026-10-01',
        true
      );

      expect(calc.ageMonths).toBeGreaterThan(120);
      expect(calc.accumulatedDepreciationPesewas).toBe(11000000n); // 12,000,000 - 1,000,000
      expect(calc.netBookValuePesewas).toBe(1000000n); // exactly equals residual value
      expect(calc.isFullyDepreciated).toBe(true);
    });
  });

  describe('calculateDisposalGainLoss', () => {
    it('detects a gain on disposal when proceeds exceed net book value', () => {
      // Cost: GHS 18,000.00 (1,800,000 pesewas)
      // Accumulated Dep: GHS 14,400.00 (1,440,000 pesewas)
      // Net book value = GHS 3,600.00 (360,000 pesewas)
      // Proceeds: GHS 4,500.00 (450,000 pesewas)
      const res = calculateDisposalGainLoss(1800000n, 1440000n, 450000n);

      expect(res.netBookValuePesewas).toBe(360000n);
      expect(res.gainOrLossPesewas).toBe(90000n); // +GHS 900.00
      expect(res.isGain).toBe(true);
      expect(res.isLoss).toBe(false);
      expect(res.isBreakEven).toBe(false);
    });

    it('detects a loss on disposal when proceeds are lower than net book value', () => {
      // Cost: GHS 18,000.00 (1,800,000 pesewas)
      // Accumulated Dep: GHS 14,400.00 (1,440,000 pesewas)
      // Net book value = GHS 3,600.00 (360,000 pesewas)
      // Proceeds: GHS 2,000.00 (200,000 pesewas)
      const res = calculateDisposalGainLoss(1800000n, 1440000n, 200000n);

      expect(res.netBookValuePesewas).toBe(360000n);
      expect(res.gainOrLossPesewas).toBe(-160000n); // -GHS 1,600.00
      expect(res.isGain).toBe(false);
      expect(res.isLoss).toBe(true);
      expect(res.isBreakEven).toBe(false);
    });

    it('handles scrapped assets with zero proceeds as full loss of net book value', () => {
      const res = calculateDisposalGainLoss(1000000n, 600000n, 0n);

      expect(res.netBookValuePesewas).toBe(400000n);
      expect(res.gainOrLossPesewas).toBe(-400000n);
      expect(res.isLoss).toBe(true);
    });
  });

  describe('Offline QR Code Generation', () => {
    it('generates an ISO QR matrix with finder patterns for asset tag', () => {
      const matrix = generateQrMatrix('AST-2026-0001');
      expect(matrix.length).toBeGreaterThanOrEqual(21);
      // Top-left finder center is dark (r=3, c=3)
      expect(matrix[3]?.[3]).toBe(true);
      // Top-right finder center is dark (r=3, c=len-4)
      expect(matrix[3]?.[matrix.length - 4]).toBe(true);
      // Bottom-left finder center is dark (r=len-4, c=3)
      expect(matrix[matrix.length - 4]?.[3]).toBe(true);
    });

    it('renders valid SVG markup with path elements and viewBox', () => {
      const svg = generateQrCodeSvg('AST-2026-0001', { size: 150 });
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox=');
      expect(svg).toContain('<path');
      expect(svg).toContain('width="150"');
    });
  });

  describe('summarizeFixedAssets', () => {
    const dummyAsset1: FixedAssetRecord = {
      id: 'ast-1',
      branchId: '00000000-0000-0000-0000-000000000001',
      assetNumber: 'AST-2026-0001',
      description: 'Active Mixer',
      categoryCode: 'SOUND_AV',
      categoryName: 'Sound and audio-visual equipment',
      location: 'Sound Booth',
      custodian: 'Media Team',
      department: 'Media',
      acquisitionType: 'PURCHASED',
      acquisitionDate: '2025-01-01',
      currency: 'GHS',
      exchangeRate: '1.0000',
      costInOriginalCurrency: 3500000n,
      costInGhsPesewas: 3500000n,
      fundId: 'fund-gen',
      fundName: 'General Fund',
      photos: [],
      condition: 'EXCELLENT',
      status: 'IN_USE',
      usefulLifeMonths: 60,
      residualValuePesewas: 0n,
      depreciationStartDate: '2025-01-01',
      accumulatedDepreciationPesewas: 500000n,
      netBookValuePesewas: 3000000n,
      events: [],
      createdAt: '2025-01-01T00:00:00Z',
      createdBy: 'Finance Secretary',
      deviceId: 'dev-1',
      assetTag: 'AST-2026-0001',
      name: 'Active Mixer',
      purchaseCostPesewas: 3500000n,
      purchaseDate: '2025-01-01',
      usefulLifeYears: 5,
      category: 'Sound and audio-visual equipment',
    };

    const dummyDisposed: FixedAssetRecord = {
      ...dummyAsset1,
      id: 'ast-2',
      assetNumber: 'AST-2026-0002',
      description: 'Disposed Mixer',
      status: 'DISPOSED',
      accumulatedDepreciationPesewas: 3500000n,
      netBookValuePesewas: 0n,
    };

    it('excludes disposed assets from active portfolio totals per Section 3.6', () => {
      const summary = summarizeFixedAssets([dummyAsset1, dummyDisposed]);
      expect(summary.totalAssetsCount).toBe(1);
      expect(summary.totalCostPesewas).toBe(3500000n);
      expect(summary.totalNetBookValuePesewas).toBe(3000000n);
      expect(summary.countByCategory.SOUND_AV).toBe(1);
    });
  });

  describe('meetsCapitalisationThreshold', () => {
    it('accurately evaluates capitalisation threshold', () => {
      const threshold = 100000n; // GHS 1,000.00
      expect(meetsCapitalisationThreshold(150000n, threshold)).toBe(true);
      expect(meetsCapitalisationThreshold(100000n, threshold)).toBe(true);
      expect(meetsCapitalisationThreshold(99999n, threshold)).toBe(false);
    });
  });

  describe('Depreciation Run Engine (Section 3.4 & Phase 6)', () => {
    const baseAsset: FixedAssetRecord = {
      id: 'ast-101',
      branchId: 'accra-central',
      assetNumber: 'AST-2026-0101',
      description: 'Yamaha Keyboard',
      categoryCode: 'MUSICAL_INSTRUMENTS',
      categoryName: 'Musical instruments',
      location: 'Sanctuary Stage',
      custodian: 'Music Ministry',
      department: 'Music',
      acquisitionType: 'PURCHASED',
      acquisitionDate: '2025-01-01',
      currency: 'GHS',
      exchangeRate: '1.0',
      costInOriginalCurrency: 6000000n,
      costInGhsPesewas: 6000000n, // GHS 60,000.00
      fundId: 'fund-general',
      fundName: 'General Fund',
      photos: [],
      condition: 'EXCELLENT',
      status: 'IN_USE',
      usefulLifeMonths: 60, // 5 years -> GHS 1,000/mo or 100,000 pesewas/mo
      residualValuePesewas: 600000n, // GHS 6,000.00 residual -> Depreciable base = GHS 54,000.00
      depreciationStartDate: '2025-01-01',
      accumulatedDepreciationPesewas: 1800000n, // GHS 18,000.00 prior
      netBookValuePesewas: 4200000n, // GHS 42,000.00 NBV
      events: [],
      createdAt: '2025-01-01T08:00:00Z',
      createdBy: 'Finance Secretary',
      deviceId: 'DEV-01',
      assetTag: 'AST-2026-0101',
      name: 'Yamaha Keyboard',
      purchaseCostPesewas: 6000000n,
      purchaseDate: '2025-01-01',
      usefulLifeYears: 5,
      category: 'Musical instruments',
    };

    const landAsset: FixedAssetRecord = {
      ...baseAsset,
      id: 'ast-land',
      assetNumber: 'AST-2026-0001',
      description: 'Church Land Plot',
      categoryCode: 'LAND',
      categoryName: 'Land',
      costInGhsPesewas: 50000000n,
      accumulatedDepreciationPesewas: 0n,
      netBookValuePesewas: 50000000n,
    };

    const disposedAsset: FixedAssetRecord = {
      ...baseAsset,
      id: 'ast-disp',
      assetNumber: 'AST-2026-0099',
      description: 'Old Sound Console',
      status: 'DISPOSED',
      costInGhsPesewas: 2000000n,
      accumulatedDepreciationPesewas: 2000000n,
      netBookValuePesewas: 0n,
    };

    const fullyDepreciatedAsset: FixedAssetRecord = {
      ...baseAsset,
      id: 'ast-depr',
      assetNumber: 'AST-2026-0088',
      description: 'Fully Depreciated Office Laptop',
      categoryCode: 'COMPUTERS_IT',
      categoryName: 'Computers and IT equipment',
      costInGhsPesewas: 1000000n,
      residualValuePesewas: 100000n,
      accumulatedDepreciationPesewas: 900000n,
      netBookValuePesewas: 100000n, // NBV equals residual value
    };

    const futureAsset: FixedAssetRecord = {
      ...baseAsset,
      id: 'ast-fut',
      assetNumber: 'AST-2026-0200',
      description: 'New Projector (Not Yet In Service)',
      categoryCode: 'SOUND_AV',
      categoryName: 'Sound and audio-visual equipment',
      depreciationStartDate: '2026-12-01', // in the future
      costInGhsPesewas: 1500000n,
      accumulatedDepreciationPesewas: 0n,
      netBookValuePesewas: 1500000n,
    };

    it('generates depreciation preview and correctly skips non-depreciable, disposed, fully depreciated, and future assets', () => {
      const preview = generateDepreciationPreview(
        [baseAsset, landAsset, disposedAsset, fullyDepreciatedAsset, futureAsset],
        '2026-10',
        'MONTHLY',
        '2026-10-31',
        'Finance Secretary'
      );

      expect(preview.runNumber).toBe('DEP-2026-10');
      expect(preview.period).toBe('2026-10');
      expect(preview.totalEligibleAssets).toBe(1);
      expect(preview.totalSkippedAssets).toBe(4);

      // Depreciable base = 6,000,000 - 600,000 = 5,400,000 pesewas
      // Useful life = 60 months -> 5,400,000 / 60 = 90,000 pesewas (GHS 900.00/month)
      expect(preview.totalChargePesewas).toBe(90000n);

      const activeLine = preview.lines.find((l) => l.assetId === 'ast-101');
      expect(activeLine?.status).toBe('ACTIVE');
      expect(activeLine?.chargePesewas).toBe(90000n);
      expect(activeLine?.newAccumulatedDepreciationPesewas).toBe(1890000n);
      expect(activeLine?.projectedNetBookValuePesewas).toBe(4110000n);
      expect(activeLine?.depreciationExpenseAccountCode).toBe('acct-5240');
      expect(activeLine?.accumulatedDepreciationAccountCode).toBe('acct-1541');

      const landLine = preview.lines.find((l) => l.assetId === 'ast-land');
      expect(landLine?.status).toBe('SKIPPED');
      expect(landLine?.skipReason).toBe('LAND_NON_DEPRECIABLE');

      const dispLine = preview.lines.find((l) => l.assetId === 'ast-disp');
      expect(dispLine?.status).toBe('SKIPPED');
      expect(dispLine?.skipReason).toBe('DISPOSED');

      const fullLine = preview.lines.find((l) => l.assetId === 'ast-depr');
      expect(fullLine?.status).toBe('SKIPPED');
      expect(fullLine?.skipReason).toBe('FULLY_DEPRECIATED');

      const futLine = preview.lines.find((l) => l.assetId === 'ast-fut');
      expect(futLine?.status).toBe('SKIPPED');
      expect(futLine?.skipReason).toBe('NOT_YET_IN_SERVICE');
    });

    it('calculates yearly depreciation charges and halts when residual value is reached', () => {
      // Asset has NBV GHS 7,000 with residual value GHS 6,000 -> only GHS 1,000 remaining depreciable
      const nearResidualAsset: FixedAssetRecord = {
        ...baseAsset,
        id: 'ast-near',
        accumulatedDepreciationPesewas: 5300000n, // GHS 53,000.00 accumulated
        netBookValuePesewas: 700000n, // GHS 7,000.00 (Cost 60,000 - 53,000)
        residualValuePesewas: 600000n, // GHS 6,000.00
      };

      const yearlyPreview = generateDepreciationPreview(
        [nearResidualAsset],
        '2026',
        'YEARLY',
        '2026-12-31'
      );

      // Normal yearly charge would be 90,000 * 12 = 1,080,000 pesewas,
      // but remaining is only 100,000 pesewas! Must be capped at 100,000 pesewas.
      expect(yearlyPreview.totalChargePesewas).toBe(100000n);
      const line = yearlyPreview.lines[0];
      expect(line?.chargePesewas).toBe(100000n);
      expect(line?.projectedNetBookValuePesewas).toBe(600000n); // exactly equals residual value
    });

    it('prevents posting the same period twice unless reversed', () => {
      const postedRun: DepreciationRun = {
        id: 'deprun-1',
        runNumber: 'DEP-2026-10',
        period: '2026-10',
        periodType: 'MONTHLY',
        runDate: '2026-10-31',
        totalEligibleAssets: 1,
        totalSkippedAssets: 0,
        totalChargePesewas: 90000n,
        lines: [],
        preparedBy: 'Finance Secretary',
        approvedByTreasurer: 'Treasurer',
        status: 'POSTED',
        createdAt: '2026-10-31T10:00:00Z',
      };

      const check1 = canPostDepreciationPeriod([postedRun], '2026-10');
      expect(check1.canPost).toBe(false);
      expect(check1.reason).toContain('has already been depreciated');

      const check2 = canPostDepreciationPeriod([postedRun], '2026-11');
      expect(check2.canPost).toBe(true);

      const reversedRun: DepreciationRun = {
        ...postedRun,
        status: 'REVERSED',
      };
      const check3 = canPostDepreciationPeriod([reversedRun], '2026-10');
      expect(check3.canPost).toBe(true);
    });
  });

  describe('Fixed Asset Movement Schedule & Register Reconciliation', () => {
    it('generates balanced Movement Schedule with category subtotals and grand totals', () => {
      const assetA: FixedAssetRecord = {
        id: 'ast-a',
        branchId: 'accra-central',
        assetNumber: 'AST-2026-0001',
        description: 'Sanctuary Building',
        categoryCode: 'BUILDINGS',
        categoryName: 'Buildings',
        location: 'Main Compound',
        custodian: 'Property Committee',
        department: 'Administration',
        acquisitionType: 'PURCHASED',
        acquisitionDate: '2020-01-01',
        currency: 'GHS',
        exchangeRate: '1.0',
        costInOriginalCurrency: 120000000n,
        costInGhsPesewas: 120000000n,
        fundId: 'fund-building',
        fundName: 'Building Fund',
        photos: [],
        condition: 'GOOD',
        status: 'IN_USE',
        usefulLifeMonths: 600,
        residualValuePesewas: 0n,
        depreciationStartDate: '2020-01-01',
        accumulatedDepreciationPesewas: 12000000n,
        netBookValuePesewas: 108000000n,
        events: [],
        createdAt: '2020-01-01T00:00:00Z',
        createdBy: 'Admin',
        deviceId: 'DEV-01',
        assetTag: 'AST-2026-0001',
        name: 'Sanctuary Building',
        purchaseCostPesewas: 120000000n,
        purchaseDate: '2020-01-01',
        usefulLifeYears: 50,
        category: 'Buildings',
      };

      const sched = generateMovementSchedule([assetA], '2026-01-01', '2026-12-31');
      expect(sched.periodStart).toBe('2026-01-01');
      expect(sched.periodEnd).toBe('2026-12-31');
      expect(sched.rows.length).toBe(10); // All 10 standard categories

      const bldRow = sched.rows.find((r) => r.categoryCode === 'BUILDINGS');
      expect(bldRow?.costAtStartPesewas).toBe(120000000n);
      expect(bldRow?.costAtEndPesewas).toBe(120000000n);
      expect(bldRow?.accumulatedDepreciationAtEndPesewas).toBe(12000000n);
      expect(bldRow?.netBookValueAtEndPesewas).toBe(108000000n);

      expect(sched.totals.costAtEndPesewas).toBe(120000000n);
    });

    it('accurately reconciles sub-ledger register against general ledger control accounts', () => {
      const asset: FixedAssetRecord = {
        id: 'ast-1',
        branchId: 'accra-central',
        assetNumber: 'AST-2026-0001',
        description: 'Church Bus',
        categoryCode: 'VEHICLES',
        categoryName: 'Vehicles',
        location: 'Parking Lot',
        custodian: 'Transport Ministry',
        department: 'Transport',
        acquisitionType: 'PURCHASED',
        acquisitionDate: '2025-01-01',
        currency: 'GHS',
        exchangeRate: '1.0',
        costInOriginalCurrency: 25000000n,
        costInGhsPesewas: 25000000n, // GHS 250,000.00
        fundId: 'fund-general',
        fundName: 'General Fund',
        photos: [],
        condition: 'GOOD',
        status: 'IN_USE',
        usefulLifeMonths: 60,
        residualValuePesewas: 0n,
        depreciationStartDate: '2025-01-01',
        accumulatedDepreciationPesewas: 5000000n, // GHS 50,000.00
        netBookValuePesewas: 20000000n,
        events: [],
        createdAt: '2025-01-01T00:00:00Z',
        createdBy: 'Admin',
        deviceId: 'DEV-01',
        assetTag: 'AST-2026-0001',
        name: 'Church Bus',
        purchaseCostPesewas: 25000000n,
        purchaseDate: '2025-01-01',
        usefulLifeYears: 5,
        category: 'Vehicles',
      };

      const matchingLedgerBalances = new Map<string, { debitPesewas: bigint; creditPesewas: bigint }>([
        ['acct-1550', { debitPesewas: 25000000n, creditPesewas: 0n }], // Dr Vehicles
        ['acct-1551', { debitPesewas: 0n, creditPesewas: 5000000n }],  // Cr Acc Dep Vehicles
      ]);

      const rec = reconcileRegisterWithLedger([asset], matchingLedgerBalances);
      expect(rec.isFullyInBalance).toBe(true);
      expect(rec.totalCostDifferencePesewas).toBe(0n);
      expect(rec.totalAccDepDifferencePesewas).toBe(0n);

      const mismatchedLedgerBalances = new Map<string, { debitPesewas: bigint; creditPesewas: bigint }>([
        ['acct-1550', { debitPesewas: 24000000n, creditPesewas: 0n }], // Missing 10,000
        ['acct-1551', { debitPesewas: 0n, creditPesewas: 5000000n }],
      ]);

      const mismatchRec = reconcileRegisterWithLedger([asset], mismatchedLedgerBalances);
      expect(mismatchRec.isFullyInBalance).toBe(false);
      expect(mismatchRec.totalCostDifferencePesewas).toBe(1000000n);
    });
  });

  describe('Physical Asset Verification Engine (Section 3.8 & Phase 7)', () => {
    const asset1: FixedAssetRecord = {
      id: 'ast-v1',
      branchId: 'accra-central',
      assetNumber: 'AST-2026-0001',
      description: 'Audio Mixer',
      categoryCode: 'SOUND_AV',
      categoryName: 'Sound and audio-visual equipment',
      location: 'Main Sanctuary',
      custodian: 'Sound Team',
      department: 'Media',
      acquisitionType: 'PURCHASED',
      acquisitionDate: '2024-01-01',
      currency: 'GHS',
      exchangeRate: '1.0',
      costInOriginalCurrency: 2000000n,
      costInGhsPesewas: 2000000n,
      fundId: 'fund-gen',
      fundName: 'General Fund',
      photos: [],
      condition: 'GOOD',
      status: 'IN_USE',
      usefulLifeMonths: 60,
      residualValuePesewas: 0n,
      depreciationStartDate: '2024-01-01',
      accumulatedDepreciationPesewas: 400000n,
      netBookValuePesewas: 1600000n,
      events: [],
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'Admin',
      deviceId: 'DEV-01',
      assetTag: 'AST-2026-0001',
      name: 'Audio Mixer',
      purchaseCostPesewas: 2000000n,
      purchaseDate: '2024-01-01',
      usefulLifeYears: 5,
      category: 'Sound and audio-visual equipment',
    };

    const asset2: FixedAssetRecord = {
      ...asset1,
      id: 'ast-v2',
      assetNumber: 'AST-2026-0002',
      description: 'Stage Mic Set',
      location: 'Main Sanctuary',
    };

    const asset3: FixedAssetRecord = {
      ...asset1,
      id: 'ast-v3',
      assetNumber: 'AST-2026-0003',
      description: 'Youth Hall Projector',
      location: 'Youth Hall',
    };

    it('creates scoped verification run by location and initializes pending items', () => {
      const run = createVerificationRun([asset1, asset2, asset3], {
        title: 'Main Sanctuary Annual Check',
        scope: 'LOCATION',
        scopeValue: 'Main Sanctuary',
        createdBy: 'Auditor',
      });

      expect(run.status).toBe('IN_PROGRESS');
      expect(run.totalExpectedAssets).toBe(2);
      expect(run.pendingCount).toBe(2);
      expect(run.foundCount).toBe(0);
      expect(run.lines[0]?.expectedLocation).toBe('Main Sanctuary');
    });

    it('updates inspection status for found, moved, and damaged items', () => {
      const run = createVerificationRun([asset1, asset2], {
        title: 'Full Audit',
        scope: 'ALL',
        createdBy: 'Auditor',
      });

      // Item 1: Found
      const line1Id = run.lines[0]!.id;
      const updated1 = updateVerificationItem(run, line1Id, {
        status: 'FOUND',
        verifiedBy: 'Brother John (Verifier)',
      });
      expect(updated1.foundCount).toBe(1);
      expect(updated1.pendingCount).toBe(1);

      // Item 2: Moved
      const line2Id = run.lines[1]!.id;
      const updated2 = updateVerificationItem(updated1, line2Id, {
        status: 'MOVED',
        actualLocation: 'Fellowship Annex Stage',
        notes: 'Moved for rehearsal session',
        verifiedBy: 'Brother John (Verifier)',
      });
      expect(updated2.foundCount).toBe(1);
      expect(updated2.movedCount).toBe(1);
      expect(updated2.pendingCount).toBe(0);
    });

    it('adds unrecorded asset found on premises', () => {
      const run = createVerificationRun([asset1], {
        title: 'Sanctuary Verification',
        scope: 'ALL',
        createdBy: 'Auditor',
      });

      const updated = addUnrecordedAssetToVerification(run, {
        description: 'Unrecorded Fender Bass Amplifier',
        categoryName: 'Musical instruments',
        actualLocation: 'Sanctuary Stage Left',
        actualCustodian: 'Music Ministry',
        verifiedBy: 'Brother John',
      });

      expect(updated.unrecordedFoundCount).toBe(1);
      expect(updated.foundCount).toBe(1);
      const foundLine = updated.lines.find((l) => l.isUnrecordedFound);
      expect(foundLine).toBeDefined();
      expect(foundLine?.assetNumber).toContain('FOUND-');
    });

    it('enforces dual sign-off requirement to finalize verification and resolves pending items as missing', () => {
      const run = createVerificationRun([asset1, asset2], {
        title: 'Audit Run',
        scope: 'ALL',
        createdBy: 'Auditor',
      });

      // Attempt finalize without dual sign-off
      const failed = finalizeVerificationRun(run, {
        verifierName: 'Brother John',
        verifierRole: 'Physical Verifier',
        verifierSignedAt: '2026-11-03T10:00:00Z',
        officerName: '',
        officerRole: 'Treasurer',
        officerSignedAt: '',
      });
      expect(failed.isValid).toBe(false);
      expect(failed.error).toContain('dual-signature rule');

      // Valid dual sign-off
      const success = finalizeVerificationRun(run, {
        verifierName: 'Brother John',
        verifierRole: 'Physical Verifier',
        verifierSignedAt: '2026-11-03T10:00:00Z',
        officerName: 'Kofi Mensah',
        officerRole: 'Treasurer',
        officerSignedAt: '2026-11-03T10:05:00Z',
      });
      expect(success.isValid).toBe(true);
      expect(success.verification.status).toBe('COMPLETED');
      // Unchecked items resolved as MISSING
      expect(success.verification.missingCount).toBe(2);
      expect(success.verification.pendingCount).toBe(0);
    });

    it('applies verification exceptions to the register (moved location, damaged status, missing flag)', () => {
      let run = createVerificationRun([asset1, asset2], {
        title: 'Audit Run',
        scope: 'ALL',
        createdBy: 'Auditor',
      });

      // Item 1: Moved
      run = updateVerificationItem(run, run.lines[0]!.id, {
        status: 'MOVED',
        actualLocation: 'Children Sanctuary',
        verifiedBy: 'Verifier',
      });

      // Item 2: Damaged
      run = updateVerificationItem(run, run.lines[1]!.id, {
        status: 'DAMAGED',
        condition: 'DAMAGED',
        notes: 'Blown capacitor on output',
        verifiedBy: 'Verifier',
      });

      const { updatedAssets, appliedChanges } = applyVerificationExceptions([asset1, asset2], run, 'Treasurer');

      expect(appliedChanges.moved).toBe(1);
      expect(appliedChanges.damaged).toBe(1);

      const updated1 = updatedAssets.find((a) => a.id === asset1.id);
      expect(updated1?.location).toBe('Children Sanctuary');
      expect(updated1?.events[0]?.eventType).toBe('TRANSFER');

      const updated2 = updatedAssets.find((a) => a.id === asset2.id);
      expect(updated2?.condition).toBe('DAMAGED');
      expect(updated2?.status).toBe('UNDER_REPAIR');
      expect(updated2?.events[0]?.eventType).toBe('MAINTENANCE_REPAIR');
    });
  });
});
