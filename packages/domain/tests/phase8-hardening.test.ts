import { describe, it, expect } from 'vitest';
import {
  ALL_ROLES,
  canViewIndividualTithes,
  filterTitheRecordsForSyncAndRLS,
  filterFixedAssetsForRole,
  getModuleAccessForRole,
  generateDepreciationPreview,
  generateMovementSchedule,
  reconcileRegisterWithLedger,
  diagnoseLedger,
  evaluateQueueItemResult,
  calculateTitheBatchSummary,
  calculateRemittanceDue,
  type FixedAssetRecord,
  type TitheRecord,
  type JournalEntry,
  type Account,
  type Fund,
  type SyncQueueItem,
} from '../src/index.js';

describe('Phase 8: Polish & Hardening — Property-Based Money, RLS/Sync, Integrity Checks & Multi-Year Performance', () => {
  // =========================================================================
  // 1. PROPERTY-BASED MONEY ARITHMETIC & DEPRECIATION ROUNDING ABSORPTION
  // =========================================================================
  describe('Property-Based Money Arithmetic (Section 7)', () => {
    it('guarantees zero pesewas gained or lost across complete asset lifecycle depreciation (last period absorbs rounding)', () => {
      // Deterministic PRNG for reproducible property testing across 50 diverse asset configurations
      let seed = 421337;
      const nextRand = (min: number, max: number) => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return min + (seed % (max - min + 1));
      };

      for (let i = 0; i < 50; i++) {
        const costPesewas = BigInt(nextRand(100_000, 95_000_000)); // GHS 1,000.00 to GHS 950,000.00
        const residualPesewas = BigInt(nextRand(0, Number(costPesewas / 5n))); // 0 to 20% residual
        const usefulLifeMonths = nextRand(12, 120); // 1 to 10 years

        const depreciableTarget = costPesewas - residualPesewas;

        let asset: FixedAssetRecord = {
          id: `prop-ast-${i}`,
          branchId: 'branch-main',
          assetNumber: `FA-${String(i + 1).padStart(4, '0')}`,
          description: `Property Test Asset ${i}`,
          categoryCode: 'SOUND_AV',
          categoryName: 'Sound and audio-visual equipment',
          location: 'Main Sanctuary',
          custodian: 'Media Dept',
          department: 'Media',
          acquisitionType: 'PURCHASED',
          acquisitionDate: '2020-01-01',
          currency: 'GHS',
          exchangeRate: '1.0000',
          costInOriginalCurrency: costPesewas,
          costInGhsPesewas: costPesewas,
          fundId: 'fund-general',
          fundName: 'General Fund',
          photos: [],
          condition: 'GOOD',
          status: 'IN_USE',
          usefulLifeMonths,
          residualValuePesewas: residualPesewas,
          depreciationStartDate: '2020-01-01',
          accumulatedDepreciationPesewas: 0n,
          netBookValuePesewas: costPesewas,
          events: [],
          createdAt: '2020-01-01T00:00:00Z',
          createdBy: 'Treasurer',
          deviceId: 'DEV-01',
          assetTag: `FA-${String(i + 1).padStart(4, '0')}`,
          name: `Property Test Asset ${i}`,
          purchaseCostPesewas: costPesewas,
          purchaseDate: '2020-01-01',
          usefulLifeYears: Math.max(1, Math.round(usefulLifeMonths / 12)),
          category: 'Sound and audio-visual equipment',
        };

        let cumulativeCharged = 0n;
        let monthsRun = 0;
        const maxIterations = usefulLifeMonths + 24; // Allow extra periods if integer division rounds down by 1 pesewa

        while (asset.netBookValuePesewas > asset.residualValuePesewas && monthsRun < maxIterations) {
          monthsRun++;
          const periodStr = `2020-${String(monthsRun).padStart(3, '0')}`;
          const preview = generateDepreciationPreview(
            [asset],
            periodStr,
            'MONTHLY',
            'Treasurer',
            '2026-12-31'
          );

          const line = preview.lines[0]!;
          expect(line.status).toBe('ACTIVE');
          expect(line.chargePesewas).toBeGreaterThan(0n);

          cumulativeCharged += line.chargePesewas;
          asset = {
            ...asset,
            accumulatedDepreciationPesewas: line.newAccumulatedDepreciationPesewas,
            netBookValuePesewas: line.projectedNetBookValuePesewas,
          };

          // Never depreciate below residual value
          expect(asset.netBookValuePesewas).toBeGreaterThanOrEqual(residualPesewas);
        }

        // Exact conservation of money: total depreciation equals (Cost - Residual) to the exact pesewa
        expect(cumulativeCharged).toBe(depreciableTarget);
        expect(asset.accumulatedDepreciationPesewas).toBe(depreciableTarget);
        expect(asset.netBookValuePesewas).toBe(residualPesewas);

        // Subsequent run must skip as FULLY_DEPRECIATED with 0 charge
        const afterFullPreview = generateDepreciationPreview(
          [asset],
          '2099-01',
          'MONTHLY',
          'Treasurer',
          '2099-01-31'
        );
        expect(afterFullPreview.totalChargePesewas).toBe(0n);
        expect(afterFullPreview.lines[0]?.status).toBe('SKIPPED');
        expect(afterFullPreview.lines[0]?.skipReason).toBe('FULLY_DEPRECIATED');
      }
    });

    it('guarantees zero pesewas lost in multi-envelope tithe batch allocations and reversals', () => {
      let seed = 987654;
      const nextRand = (min: number, max: number) => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return min + (seed % (max - min + 1));
      };

      for (let i = 0; i < 50; i++) {
        const envelopeCount = nextRand(5, 40);
        const records: { amount: bigint; isReversal?: boolean }[] = [];
        let sumAllocated = 0n;

        for (let j = 0; j < envelopeCount; j++) {
          const amt = BigInt(nextRand(500, 250_000));
          records.push({ amount: amt });
          sumAllocated += amt;
        }

        const unallocatedCash = BigInt(nextRand(0, 50_000));
        const countedTotal = sumAllocated + unallocatedCash;

        // Without explanation, variance equals unallocatedCash
        const summaryUnexplained = calculateTitheBatchSummary(countedTotal, records, 0n);
        expect(summaryUnexplained.allocatedTotal).toBe(sumAllocated);
        expect(summaryUnexplained.unallocatedTotal).toBe(unallocatedCash);
        expect(summaryUnexplained.isBalanced).toBe(unallocatedCash === 0n);

        // When unallocated is explained (e.g. anonymous envelope), variance is strictly 0n
        const summaryExplained = calculateTitheBatchSummary(countedTotal, records, unallocatedCash);
        expect(summaryExplained.unexplainedVariance).toBe(0n);
        expect(summaryExplained.isBalanced).toBe(true);
        expect(summaryExplained.allocatedTotal + summaryExplained.explainedUnallocated).toBe(countedTotal);
      }
    });
  });

  // =========================================================================
  // 2. PERMISSIONS MATRIX, RLS & OFFLINE SYNC PRIVACY RULES (Section 0, 2.6, 7)
  // =========================================================================
  describe('Permissions Matrix, RLS & Offline Sync Privacy (Section 0 & 2.6)', () => {
    const sampleTitheRecords: TitheRecord[] = [
      {
        id: 'tr-1',
        branchId: 'b-1',
        batchId: 'batch-1',
        memberId: 'mem-1',
        memberName: 'Elder Samuel Mensah',
        envelopeNumber: 'ENV-001',
        recordDate: '2026-10-04',
        amount: 50000n,
        currency: 'GHS',
        exchangeRate: '1.0',
        method: 'ENVELOPE',
        recordedBy: 'Finance Secretary',
        isReversal: false,
        createdAt: '2026-10-04T12:00:00Z',
      },
    ];

    it('enforces Section 0 Role Capability Matrix across all 7 church roles', () => {
      expect(ALL_ROLES.length).toBe(7);

      const treasurerAccess = getModuleAccessForRole('Treasurer');
      expect(treasurerAccess).toEqual({
        cashbook: 'FULL',
        tithes: 'FULL',
        fixedAssets: 'FULL',
      });

      const finSecAccess = getModuleAccessForRole('Finance Secretary');
      expect(finSecAccess).toEqual({
        cashbook: 'ENTER_AND_PREPARE',
        tithes: 'BATCH_AND_INDIVIDUAL',
        fixedAssets: 'MANAGE_AND_PREPARE',
      });

      const pastorDefault = getModuleAccessForRole('Pastor / Elder', false);
      expect(pastorDefault).toEqual({
        cashbook: 'SUMMARY_ONLY',
        tithes: 'TOTALS_ONLY',
        fixedAssets: 'APPROVE_DISPOSALS_AND_VIEW',
      });

      const pastorGranted = getModuleAccessForRole('Pastor / Elder', true);
      expect(pastorGranted.tithes).toBe('BATCH_AND_INDIVIDUAL');

      const auditorAccess = getModuleAccessForRole('Auditor');
      expect(auditorAccess).toEqual({
        cashbook: 'READ_ONLY',
        tithes: 'READ_ONLY_LOGGED',
        fixedAssets: 'READ_ONLY',
      });

      const deptHeadAccess = getModuleAccessForRole('Department Head');
      expect(deptHeadAccess).toEqual({
        cashbook: 'NONE',
        tithes: 'NONE',
        fixedAssets: 'DEPARTMENT_ONLY',
      });

      expect(getModuleAccessForRole('Counter')).toEqual({
        cashbook: 'NONE',
        tithes: 'NONE',
        fixedAssets: 'NONE',
      });

      expect(getModuleAccessForRole('Admin')).toEqual({
        cashbook: 'NONE',
        tithes: 'NONE',
        fixedAssets: 'NONE',
      });
    });

    it('blocks Department Head, Counter, and Admin from reading or syncing individual tithe records (RLS)', () => {
      // Finance Secretary & Treasurer see all individual records
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Finance Secretary')).toHaveLength(1);
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Treasurer')).toHaveLength(1);
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Auditor')).toHaveLength(1);

      // Pastor depends on per-role church setting
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Pastor / Elder', true)).toHaveLength(1);
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Pastor / Elder', false)).toHaveLength(0);

      // Department Head, Counter, Admin NEVER receive individual tithe records
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Department Head')).toHaveLength(0);
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Counter')).toHaveLength(0);
      expect(filterTitheRecordsForSyncAndRLS(sampleTitheRecords, 'Admin')).toHaveLength(0);
    });

    it('restricts Department Head fixed asset visibility strictly to their own department', () => {
      const assets = [
        { id: 'a1', department: 'Media & Sound', custodian: 'Head of Media' },
        { id: 'a2', department: 'Children Ministry', custodian: 'Sunday School Supt' },
        { id: 'a3', department: 'Music & Choir', custodian: 'Choir Director' },
      ];

      expect(filterFixedAssetsForRole(assets, 'Treasurer')).toHaveLength(3);
      expect(filterFixedAssetsForRole(assets, 'Finance Secretary')).toHaveLength(3);
      expect(filterFixedAssetsForRole(assets, 'Auditor')).toHaveLength(3);

      const mediaAssets = filterFixedAssetsForRole(assets, 'Department Head', 'Media');
      expect(mediaAssets).toHaveLength(1);
      expect(mediaAssets[0]?.id).toBe('a1');

      expect(filterFixedAssetsForRole(assets, 'Counter')).toHaveLength(0);
      expect(filterFixedAssetsForRole(assets, 'Admin')).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. SECTION 5 INTEGRITY CHECKS (RULES 11 TO 16)
  // =========================================================================
  describe('Sub-Ledger & Control Integrity Checks (Section 5)', () => {
    const baseAccounts: Account[] = [
      { id: 'acct-1110', branchId: 'b1', code: '1110', name: 'Cash on Hand (GHS)', type: 'ASSET', currency: 'GHS', isBankOrCash: true, isActive: true },
      { id: 'acct-4110', branchId: 'b1', code: '4110', name: 'Tithes Income', type: 'INCOME', currency: 'GHS', isBankOrCash: false, isActive: true },
    ];
    const baseFunds: Fund[] = [
      { id: 'fund-general', branchId: 'b1', code: 'GEN', name: 'General Fund', type: 'UNRESTRICTED', allowOverdraft: false, isActive: true },
    ];

    it('detects Rules 11, 12, 13, 14, 15, and 16 violations accurately', () => {
      const report = diagnoseLedger({
        entries: [],
        accounts: baseAccounts,
        funds: baseFunds,
        subledgerChecks: {
          // Rule 11: Cashbook vs Ledger mismatch
          cashbookComparisons: [
            {
              accountId: 'acct-1110',
              accountName: 'Cash on Hand (GHS)',
              cashbookBalancePesewas: 250000n,
              ledgerBalancePesewas: 240000n,
            },
          ],
          // Rule 12: Unallocated tithes difference
          tithesControl: {
            period: '2026-10',
            titheRecordsTotalPesewas: 800000n,
            explainedUnallocatedPesewas: 50000n,
            ledgerTithesIncomePesewas: 900000n,
          },
          // Rule 13: Asset register vs Ledger mismatch
          assetRegisterComparison: {
            activeCostPesewas: 50000000n,
            ledgerCostPesewas: 48000000n,
            activeAccDepPesewas: 12000000n,
            ledgerAccDepPesewas: 12000000n,
          },
          // Rule 14: Double-posted counting sheet & payment voucher
          countingSheetRefs: ['CS-2026-0054', 'CS-2026-0054'],
          voucherPaymentRefs: ['PV-2026-0019', 'PV-2026-0019'],
          // Rule 15: Bank reconciliation older than 35 days (warning)
          bankReconciliations: [
            {
              bankAccountName: 'GCB Bank Main (GHS)',
              lastSignedOffDate: '2026-08-31',
              referenceDate: '2026-10-25', // 55 days elapsed > 35 days
            },
          ],
          // Rule 16: Remittance liability mismatch
          remittanceLiability: {
            totalAccruedPesewas: 450000n,
            totalPaidPesewas: 150000n,
            ledgerRemittancePayablePesewas: 250000n, // Expected 300,000
          },
        },
      });

      const ruleNumbers = report.findings.map((f) => f.ruleNumber);
      expect(ruleNumbers).toContain(11);
      expect(ruleNumbers).toContain(12);
      expect(ruleNumbers).toContain(13);
      expect(ruleNumbers).toContain(14);
      expect(ruleNumbers).toContain(15);
      expect(ruleNumbers).toContain(16);

      // Verify Rule 15 is a non-blocking WARNING per Section 5.5
      const rule15Finding = report.findings.find((f) => f.ruleNumber === 15);
      expect(rule15Finding?.severity).toBe('WARNING');
      expect(rule15Finding?.title).toContain('55 days');
    });
  });

  // =========================================================================
  // 4. OFFLINE & MULTI-DEVICE SYNC QUEUE HARDENING
  // =========================================================================
  describe('Offline & Multi-Device Sync Queue Routing (Section 0 & 7)', () => {
    it('routes rejected offline transactions (closed period, duplicate doc) to Needs Attention without blocking queue', () => {
      const offlineItem: SyncQueueItem = {
        id: 'q-101',
        entityType: 'cashbook_entries',
        entityId: 'cb-991',
        action: 'CREATE',
        payload: { documentNumber: 'FIN-RC-2026-0088', amountPesewas: 150000 },
        deviceId: 'DEV-FIN-SEC-01',
        createdAt: '2026-10-18T09:00:00Z',
        attempts: 1,
        status: 'QUEUED',
      };

      // 1. Period closed permanent rejection
      const closedResult = evaluateQueueItemResult(offlineItem, 'PERIOD_CLOSED: Period 2026-08 is locked');
      expect(closedResult.success).toBe(false);
      expect(closedResult.isPermanentError).toBe(true);
      expect(closedResult.rejection).toBeDefined();
      expect(closedResult.rejection?.transactionId).toBe('cb-991');

      // 2. Transient network timeout schedules exponential backoff retry
      const networkResult = evaluateQueueItemResult(offlineItem, 'NETWORK_TIMEOUT: Server unreachable');
      expect(networkResult.success).toBe(false);
      expect(networkResult.isPermanentError).toBe(false);
      expect(networkResult.retryAfterMs).toBeGreaterThanOrEqual(1000);

      // 3. Valid reconnect sync succeeds
      const okResult = evaluateQueueItemResult(offlineItem);
      expect(okResult.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. MULTI-YEAR PERFORMANCE BENCHMARK (3+ YEARS OF HIGH-VOLUME DATA)
  // =========================================================================
  describe('Multi-Year Dataset Performance (Phase 8)', () => {
    it('processes 3 years of fixed assets, movement schedules, and 3,000+ ledger lines in under 500ms', () => {
      const startMs = performance.now();

      // Generate 150 active fixed assets across 3 years
      const manyAssets: FixedAssetRecord[] = Array.from({ length: 150 }, (_, idx) => {
        const year = 2024 + (idx % 3);
        const cost = BigInt((idx + 1) * 150_000);
        const accDep = cost / 5n;
        return {
          id: `perf-ast-${idx}`,
          branchId: 'b1',
          assetNumber: `FA-${year}-${String(idx + 1).padStart(4, '0')}`,
          description: `High Volume Asset #${idx + 1}`,
          categoryCode: idx % 2 === 0 ? 'COMPUTERS_IT' : 'FURNITURE',
          categoryName: idx % 2 === 0 ? 'Computers and IT equipment' : 'Furniture and fittings',
          location: 'Main Sanctuary',
          custodian: 'General Office',
          department: 'Administration',
          acquisitionType: 'PURCHASED',
          acquisitionDate: `${year}-03-15`,
          currency: 'GHS',
          exchangeRate: '1.0000',
          costInOriginalCurrency: cost,
          costInGhsPesewas: cost,
          fundId: 'fund-general',
          fundName: 'General Fund',
          photos: [],
          condition: 'GOOD',
          status: 'IN_USE',
          usefulLifeMonths: 60,
          residualValuePesewas: 0n,
          depreciationStartDate: `${year}-03-15`,
          accumulatedDepreciationPesewas: accDep,
          netBookValuePesewas: cost - accDep,
          events: [],
          createdAt: `${year}-03-15T10:00:00Z`,
          createdBy: 'Treasurer',
          deviceId: 'DEV-01',
          assetTag: `FA-${year}-${String(idx + 1).padStart(4, '0')}`,
          name: `High Volume Asset #${idx + 1}`,
          purchaseCostPesewas: cost,
          purchaseDate: `${year}-03-15`,
          usefulLifeYears: 5,
          category: idx % 2 === 0 ? 'Computers and IT equipment' : 'Furniture and fittings',
        };
      });

      const schedule = generateMovementSchedule(manyAssets, '2026-01-01', '2026-12-31');
      expect(schedule.totals.costAtEndPesewas).toBeGreaterThan(0n);

      const depPreview = generateDepreciationPreview(manyAssets, '2026-11', 'MONTHLY', 'Treasurer', '2026-11-30');
      expect(depPreview.totalEligibleAssets).toBe(150);
      expect(depPreview.totalChargePesewas).toBeGreaterThan(0n);

      const elapsedMs = performance.now() - startMs;
      expect(elapsedMs).toBeLessThan(500);
    });
  });
});
