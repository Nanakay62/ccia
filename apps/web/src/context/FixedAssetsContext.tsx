import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type {
  FixedAssetRecord,
  FixedAssetCategory,
  FixedAssetCategoryCode,
  AssetPolicySettings,
  FixedAssetCondition,
  FixedAssetStatus,
  AcquisitionType,
  DisposalType,
  AssetEvent,
  FixedAssetSummary,
  Currency,
  DepreciationRun,
  FixedAssetMovementSchedule,
  RegisterLedgerReconciliation,
  AssetVerification,
  AssetVerificationSignoff,
  VerificationScope,
  VerificationItemStatus,
} from '@church/domain';
import {
  DEFAULT_ASSET_CATEGORIES,
  DEFAULT_ASSET_POLICY_SETTINGS,
  calculateAssetDepreciationValues,
  calculateDisposalGainLoss,
  summarizeFixedAssets,
  getCategoryByCode,
  createJournalEntry,
  generateDepreciationPreview,
  canPostDepreciationPeriod,
  generateMovementSchedule,
  reconcileRegisterWithLedger,
  createVerificationRun,
  updateVerificationItem,
  addUnrecordedAssetToVerification,
  finalizeVerificationRun,
  applyVerificationExceptions,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useDemo } from './DemoContext.js';
import { useLedger } from './LedgerContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { SEED_FIXED_ASSETS, SEED_DEPRECIATION_RUNS, SEED_ASSET_VERIFICATIONS } from './seedAssets.js';

export interface CreateAssetInput {
  description: string;
  categoryCode: FixedAssetCategoryCode;
  serialOrModelNumber?: string;
  location: string;
  custodian: string;
  department: string;
  supplier?: string;
  acquisitionType: AcquisitionType;
  acquisitionDate: string; // YYYY-MM-DD
  currency: Currency;
  exchangeRate?: string;
  costInOriginalCurrency: bigint;
  fundId: string;
  fundName: string;
  invoiceOrReceiptNumber?: string;
  voucherId?: string;
  photos?: string[];
  valuationBasis?: string; // For donated assets
  warrantyExpiry?: string;
  insurancePolicy?: string;
  insuranceExpiry?: string;
  condition?: FixedAssetCondition;
  usefulLifeMonths?: number;
  residualValuePesewas?: bigint;
}

export interface UpdateAssetDetailsInput {
  description?: string;
  serialOrModelNumber?: string;
  location?: string;
  custodian?: string;
  department?: string;
  supplier?: string;
  condition?: FixedAssetCondition;
  status?: FixedAssetStatus;
  warrantyExpiry?: string;
  insurancePolicy?: string;
  insuranceExpiry?: string;
  photos?: string[];
  notes?: string;
}

export interface TransferAssetInput {
  toLocation: string;
  toCustodian: string;
  toDepartment?: string;
  reason: string;
}

export interface LogRepairInput {
  date: string;
  description: string;
  costPesewas: bigint;
  provider: string;
  nextServiceDate?: string;
  isImprovement?: boolean;
  voucherId?: string;
  notes?: string;
}

export interface DisposeAssetInput {
  disposalType: DisposalType;
  disposalDate: string;
  reason: string;
  proceedsPesewas: bigint;
  buyerOrRecipient?: string;
  approvedByPastorOrElder: string;
  notes?: string;
}

export interface FixedAssetsContextType {
  assets: FixedAssetRecord[];
  categories: readonly FixedAssetCategory[];
  policySettings: AssetPolicySettings;
  summary: FixedAssetSummary;
  depreciationRuns: DepreciationRun[];
  verifications: AssetVerification[];
  getAssetById: (id: string) => FixedAssetRecord | undefined;
  createAsset: (input: CreateAssetInput) => FixedAssetRecord;
  updateAssetDetails: (id: string, updates: UpdateAssetDetailsInput) => FixedAssetRecord;
  transferAsset: (id: string, input: TransferAssetInput) => FixedAssetRecord;
  logRepair: (id: string, input: LogRepairInput) => FixedAssetRecord;
  disposeAsset: (id: string, input: DisposeAssetInput) => FixedAssetRecord;
  updatePolicySettings: (settings: Partial<AssetPolicySettings>) => void;
  recalculateDepreciation: (asOfDate?: string) => void;
  previewDepreciationRun: (period: string, periodType: 'MONTHLY' | 'YEARLY', asOfDate?: string) => DepreciationRun;
  postDepreciationRun: (previewRun: DepreciationRun, approvedByTreasurer: string) => { success: boolean; journalEntryId?: string; error?: string };
  reverseDepreciationRun: (runId: string, reason: string) => { success: boolean; error?: string };
  getMovementSchedule: (periodStart: string, periodEnd: string) => FixedAssetMovementSchedule;
  getReconciliation: (asOfDate?: string) => RegisterLedgerReconciliation;
  startVerification: (input: { title: string; scope: VerificationScope; scopeValue?: string; startDate?: string }) => AssetVerification;
  updateVerificationLine: (
    verificationId: string,
    lineId: string,
    updates: {
      status: VerificationItemStatus;
      actualLocation?: string;
      actualCustodian?: string;
      condition?: FixedAssetCondition;
      notes?: string;
      photoUrl?: string;
    }
  ) => void;
  addUnrecordedAsset: (
    verificationId: string,
    item: {
      description: string;
      categoryName: string;
      actualLocation: string;
      actualCustodian: string;
      condition?: FixedAssetCondition;
      notes?: string;
    }
  ) => void;
  signAndCompleteVerification: (
    verificationId: string,
    signoff: AssetVerificationSignoff,
    autoApplyExceptions?: boolean
  ) => { success: boolean; error?: string };
  applyExceptionsToRegister: (
    verificationId: string
  ) => { success: boolean; appliedChanges: { moved: number; damaged: number; missing: number } };
}

const FixedAssetsContext = createContext<FixedAssetsContextType | null>(null);

export const FixedAssetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isDemoMode } = useDemo();
  const { addEntry, reverseEntry, accounts, trialBalance } = useLedger();

  const [assets, setAssets] = useState<FixedAssetRecord[]>(() =>
    loadFromStore('fixed_assets', isDemoMode, SEED_FIXED_ASSETS)
  );

  const [policySettings, setPolicySettings] = useState<AssetPolicySettings>(() =>
    loadFromStore('asset_policy_settings', isDemoMode, DEFAULT_ASSET_POLICY_SETTINGS)
  );

  const [depreciationRuns, setDepreciationRuns] = useState<DepreciationRun[]>(() =>
    loadFromStore('depreciation_runs', isDemoMode, SEED_DEPRECIATION_RUNS)
  );

  const [verifications, setVerifications] = useState<AssetVerification[]>(() =>
    loadFromStore('asset_verifications', isDemoMode, SEED_ASSET_VERIFICATIONS)
  );

  // Sync state when Demo Mode changes
  useEffect(() => {
    setAssets(loadFromStore('fixed_assets', isDemoMode, SEED_FIXED_ASSETS));
    setPolicySettings(loadFromStore('asset_policy_settings', isDemoMode, DEFAULT_ASSET_POLICY_SETTINGS));
    setDepreciationRuns(loadFromStore('depreciation_runs', isDemoMode, SEED_DEPRECIATION_RUNS));
    setVerifications(loadFromStore('asset_verifications', isDemoMode, SEED_ASSET_VERIFICATIONS));
  }, [isDemoMode]);

  // Persist assets whenever they change
  useEffect(() => {
    saveToStore('fixed_assets', isDemoMode, assets);
  }, [assets, isDemoMode]);

  // Persist policy settings
  useEffect(() => {
    saveToStore('asset_policy_settings', isDemoMode, policySettings);
  }, [policySettings, isDemoMode]);

  // Persist depreciation runs
  useEffect(() => {
    saveToStore('depreciation_runs', isDemoMode, depreciationRuns);
  }, [depreciationRuns, isDemoMode]);

  // Persist verifications
  useEffect(() => {
    saveToStore('asset_verifications', isDemoMode, verifications);
  }, [verifications, isDemoMode]);

  // Helper to find account ID by code
  const getAccountIdByCode = useCallback(
    (code: string): string => {
      const acct = accounts.find((a) => a.code === code);
      return acct ? acct.id : 'acct-1590';
    },
    [accounts]
  );

  // Summary calculation
  const summary = useMemo(() => {
    return summarizeFixedAssets(assets);
  }, [assets]);

  const getAssetById = useCallback(
    (id: string) => {
      return assets.find((a) => a.id === id);
    },
    [assets]
  );

  // Create new fixed asset
  const createAsset = useCallback(
    (input: CreateAssetInput): FixedAssetRecord => {
      const year = new Date(input.acquisitionDate).getFullYear() || 2026;
      const countForYear = assets.filter((a) => a.assetNumber.includes(`AST-${year}`)).length + 1;
      const assetNumber = `AST-${year}-${String(countForYear).padStart(4, '0')}`;

      const category = getCategoryByCode(input.categoryCode) || DEFAULT_ASSET_CATEGORIES[0]!;
      const usefulLifeMonths =
        input.usefulLifeMonths !== undefined
          ? input.usefulLifeMonths
          : category.defaultUsefulLifeMonths;

      // Currency conversion if USD
      const rate = input.exchangeRate || (input.currency === 'USD' ? '15.50' : '1.0000');
      let costInGhs = input.costInOriginalCurrency;
      if (input.currency === 'USD') {
        const rateFloat = parseFloat(rate) || 15.5;
        // Integer arithmetic: cost in cents * rateFloat
        costInGhs = BigInt(Math.round(Number(input.costInOriginalCurrency) * rateFloat));
      }

      const residualValue = input.residualValuePesewas ?? 0n;

      // Initial straight-line calculation as of today
      const depCalc = calculateAssetDepreciationValues(
        costInGhs,
        residualValue,
        usefulLifeMonths,
        input.acquisitionDate,
        new Date().toISOString().slice(0, 10),
        category.isDepreciable
      );

      const assetId = `ast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const initialEvent: AssetEvent = {
        id: `evt-${Date.now()}-acq`,
        assetId,
        eventType: 'ACQUISITION',
        date: input.acquisitionDate,
        performedBy: currentUser.fullName,
        details:
          input.acquisitionType === 'DONATED'
            ? `Donated asset recorded at assessed value. Basis: ${input.valuationBasis || 'Leadership valuation'}`
            : input.voucherId
            ? `Acquired via Capital Payment Voucher ${input.voucherId}`
            : `Asset acquired and capitalized in ${input.fundName}`,
        approvalStatus: 'APPROVED',
        approvedBy: currentUser.fullName,
        costPesewas: costInGhs,
        voucherId: input.voucherId,
        notes: input.valuationBasis,
        createdAt: new Date().toISOString(),
      };

      // Ledger Posting:
      // If DONATED: Dr Fixed Asset Category Account, Cr Capital Donations in Kind (acct-4060)
      // If PURCHASED and not already posted by a voucher: Dr Fixed Asset Category, Cr Bank Account (GHS)
      let postedJournalEntryId: string | undefined;

      const costAccountCode = category.costAccountCode;
      const costAccountId = getAccountIdByCode(costAccountCode);

      if (input.acquisitionType === 'DONATED') {
        const donationAccountId = getAccountIdByCode('4060'); // Capital Donations in Kind
        const je = createJournalEntry({
          id: `je-asset-don-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: `JE-AST-${Date.now().toString().slice(-4)}`,
          entryDate: input.acquisitionDate,
          narration: `In-kind donation: ${input.description} [${assetNumber}]`,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          lines: [
            {
              id: `l-don-1`,
              accountId: costAccountId,
              fundId: input.fundId,
              originalCurrency: 'GHS',
              originalAmount: costInGhs,
              exchangeRate: '1.0000',
              isDebit: true,
              description: `Capitalize donated asset ${assetNumber}`,
            },
            {
              id: `l-don-2`,
              accountId: donationAccountId,
              fundId: input.fundId,
              originalCurrency: 'GHS',
              originalAmount: costInGhs,
              exchangeRate: '1.0000',
              isDebit: false,
              description: `Capital donation in kind - ${input.valuationBasis || 'Assessed value'}`,
            },
          ],
        });
        addEntry(je);
        postedJournalEntryId = je.id;
      } else if (input.acquisitionType === 'PURCHASED' && !input.voucherId) {
        // Direct purchase entry
        const bankAccountId = getAccountIdByCode('1030'); // Bank Account GHS
        const je = createJournalEntry({
          id: `je-asset-pur-${Date.now()}`,
          branchId: '00000000-0000-0000-0000-000000000001',
          documentNumber: `JE-AST-${Date.now().toString().slice(-4)}`,
          entryDate: input.acquisitionDate,
          narration: `Capital purchase: ${input.description} [${assetNumber}]`,
          createdBy: currentUser.fullName,
          deviceId: currentUser.deviceId,
          lines: [
            {
              id: `l-pur-1`,
              accountId: costAccountId,
              fundId: input.fundId,
              originalCurrency: 'GHS',
              originalAmount: costInGhs,
              exchangeRate: '1.0000',
              isDebit: true,
              description: `Capitalize fixed asset ${assetNumber}`,
            },
            {
              id: `l-pur-2`,
              accountId: bankAccountId,
              fundId: input.fundId,
              originalCurrency: 'GHS',
              originalAmount: costInGhs,
              exchangeRate: '1.0000',
              isDebit: false,
              description: `Disbursement for ${assetNumber}`,
            },
          ],
        });
        addEntry(je);
        postedJournalEntryId = je.id;
      }

      const newAsset: FixedAssetRecord = {
        id: assetId,
        branchId: '00000000-0000-0000-0000-000000000001',
        assetNumber,
        description: input.description,
        categoryCode: input.categoryCode,
        categoryName: category.name,
        serialOrModelNumber: input.serialOrModelNumber,
        location: input.location,
        custodian: input.custodian,
        department: input.department,
        supplier: input.supplier,
        acquisitionType: input.acquisitionType,
        acquisitionDate: input.acquisitionDate,
        currency: input.currency,
        exchangeRate: rate,
        costInOriginalCurrency: input.costInOriginalCurrency,
        costInGhsPesewas: costInGhs,
        fundId: input.fundId,
        fundName: input.fundName,
        invoiceOrReceiptNumber: input.invoiceOrReceiptNumber,
        voucherId: input.voucherId,
        journalEntryId: postedJournalEntryId,
        photos: input.photos || [],
        valuationBasis: input.valuationBasis,
        warrantyExpiry: input.warrantyExpiry,
        insurancePolicy: input.insurancePolicy,
        insuranceExpiry: input.insuranceExpiry,
        condition: input.condition || 'EXCELLENT',
        status: 'IN_USE',
        usefulLifeMonths,
        residualValuePesewas: residualValue,
        depreciationStartDate: input.acquisitionDate,
        accumulatedDepreciationPesewas: depCalc.accumulatedDepreciationPesewas,
        netBookValuePesewas: depCalc.netBookValuePesewas,
        events: [initialEvent],
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        assetTag: assetNumber,
        name: input.description,
        purchaseCostPesewas: costInGhs,
        purchaseDate: input.acquisitionDate,
        usefulLifeYears: Math.round(usefulLifeMonths / 12),
        category: category.name,
      };

      setAssets((prev) => [newAsset, ...prev]);

      logAuditEvent({
        action: 'CREATE_FIXED_ASSET',
        record: `${assetNumber} - ${input.description}`,
        entityType: 'fixed_assets',
        entityId: assetId,
      });

      return newAsset;
    },
    [assets, currentUser, addEntry, getAccountIdByCode]
  );

  // Update descriptive details (cost and dates are immutable after posting per Section 3.9)
  const updateAssetDetails = useCallback(
    (id: string, updates: UpdateAssetDetailsInput): FixedAssetRecord => {
      let updatedRecord: FixedAssetRecord | undefined;

      setAssets((prev) =>
        prev.map((asset) => {
          if (asset.id !== id) return asset;

          const changeLog: string[] = [];
          if (updates.location && updates.location !== asset.location) {
            changeLog.push(`Location: ${asset.location} → ${updates.location}`);
          }
          if (updates.custodian && updates.custodian !== asset.custodian) {
            changeLog.push(`Custodian: ${asset.custodian} → ${updates.custodian}`);
          }
          if (updates.condition && updates.condition !== asset.condition) {
            changeLog.push(`Condition: ${asset.condition} → ${updates.condition}`);
          }
          if (updates.status && updates.status !== asset.status) {
            changeLog.push(`Status: ${asset.status} → ${updates.status}`);
          }

          const correctionEvent: AssetEvent | null =
            changeLog.length > 0
              ? {
                  id: `evt-${Date.now()}-edit`,
                  assetId: id,
                  eventType: 'CORRECTION',
                  date: new Date().toISOString().slice(0, 10),
                  performedBy: currentUser.fullName,
                  details: `Details updated: ${changeLog.join(', ')}`,
                  notes: updates.notes,
                  createdAt: new Date().toISOString(),
                }
              : null;

          updatedRecord = {
            ...asset,
            description: updates.description ?? asset.description,
            serialOrModelNumber: updates.serialOrModelNumber ?? asset.serialOrModelNumber,
            location: updates.location ?? asset.location,
            custodian: updates.custodian ?? asset.custodian,
            department: updates.department ?? asset.department,
            supplier: updates.supplier ?? asset.supplier,
            condition: updates.condition ?? asset.condition,
            status: updates.status ?? asset.status,
            warrantyExpiry: updates.warrantyExpiry ?? asset.warrantyExpiry,
            insurancePolicy: updates.insurancePolicy ?? asset.insurancePolicy,
            insuranceExpiry: updates.insuranceExpiry ?? asset.insuranceExpiry,
            photos: updates.photos ?? asset.photos,
            name: updates.description ?? asset.name,
            events: correctionEvent ? [correctionEvent, ...asset.events] : asset.events,
          };

          return updatedRecord;
        })
      );

      if (!updatedRecord) {
        throw new Error(`Asset not found: ${id}`);
      }

      logAuditEvent({
        action: 'UPDATE_FIXED_ASSET',
        record: `${updatedRecord.assetNumber} - ${updatedRecord.description}`,
        entityType: 'fixed_assets',
        entityId: updatedRecord.id,
      });

      return updatedRecord;
    },
    [currentUser]
  );

  // Transfer asset between locations / custodians
  const transferAsset = useCallback(
    (id: string, input: TransferAssetInput): FixedAssetRecord => {
      let updatedRecord: FixedAssetRecord | undefined;

      setAssets((prev) =>
        prev.map((asset) => {
          if (asset.id !== id) return asset;

          const transferEvent: AssetEvent = {
            id: `evt-${Date.now()}-trans`,
            assetId: id,
            eventType: 'TRANSFER',
            date: new Date().toISOString().slice(0, 10),
            performedBy: currentUser.fullName,
            details: `Transferred from ${asset.location} (${asset.custodian}) to ${input.toLocation} (${input.toCustodian}). Reason: ${input.reason}`,
            fromLocation: asset.location,
            toLocation: input.toLocation,
            fromCustodian: asset.custodian,
            toCustodian: input.toCustodian,
            approvalStatus: 'APPROVED',
            approvedBy: currentUser.fullName,
            notes: input.reason,
            createdAt: new Date().toISOString(),
          };

          updatedRecord = {
            ...asset,
            location: input.toLocation,
            custodian: input.toCustodian,
            department: input.toDepartment || asset.department,
            events: [transferEvent, ...asset.events],
          };

          return updatedRecord;
        })
      );

      if (!updatedRecord) {
        throw new Error(`Asset not found: ${id}`);
      }

      logAuditEvent({
        action: 'TRANSFER_FIXED_ASSET',
        record: `${updatedRecord.assetNumber} → ${input.toLocation}`,
        entityType: 'fixed_assets',
        entityId: updatedRecord.id,
      });

      return updatedRecord;
    },
    [currentUser]
  );

  // Log repair or improvement
  const logRepair = useCallback(
    (id: string, input: LogRepairInput): FixedAssetRecord => {
      let updatedRecord: FixedAssetRecord | undefined;

      setAssets((prev) =>
        prev.map((asset) => {
          if (asset.id !== id) return asset;

          const isCapImprovement = Boolean(input.isImprovement);
          const repairEvent: AssetEvent = {
            id: `evt-${Date.now()}-rep`,
            assetId: id,
            eventType: isCapImprovement ? 'IMPROVEMENT' : 'MAINTENANCE_REPAIR',
            date: input.date,
            performedBy: currentUser.fullName,
            details: `${isCapImprovement ? 'Capital Improvement' : 'Repair'}: ${input.description} by ${input.provider}`,
            costPesewas: input.costPesewas,
            voucherId: input.voucherId,
            approvalStatus: 'APPROVED',
            approvedBy: currentUser.fullName,
            notes: input.notes,
            createdAt: new Date().toISOString(),
          };

          // If capital improvement, increase cost basis
          const newCostInGhs = isCapImprovement
            ? asset.costInGhsPesewas + input.costPesewas
            : asset.costInGhsPesewas;

          const category = getCategoryByCode(asset.categoryCode);
          const depCalc = calculateAssetDepreciationValues(
            newCostInGhs,
            asset.residualValuePesewas,
            asset.usefulLifeMonths,
            asset.depreciationStartDate,
            new Date().toISOString().slice(0, 10),
            category?.isDepreciable ?? true
          );

          updatedRecord = {
            ...asset,
            costInGhsPesewas: newCostInGhs,
            purchaseCostPesewas: newCostInGhs,
            accumulatedDepreciationPesewas: depCalc.accumulatedDepreciationPesewas,
            netBookValuePesewas: depCalc.netBookValuePesewas,
            events: [repairEvent, ...asset.events],
          };

          return updatedRecord;
        })
      );

      if (!updatedRecord) {
        throw new Error(`Asset not found: ${id}`);
      }

      logAuditEvent({
        action: 'LOG_ASSET_MAINTENANCE',
        record: `${updatedRecord.assetNumber} - ${input.description}`,
        entityType: 'fixed_assets',
        entityId: updatedRecord.id,
      });

      return updatedRecord;
    },
    [currentUser]
  );

  // Dispose Asset (sold, scrapped, donated away, written off)
  const disposeAsset = useCallback(
    (id: string, input: DisposeAssetInput): FixedAssetRecord => {
      const asset = assets.find((a) => a.id === id);
      if (!asset) {
        throw new Error(`Asset not found: ${id}`);
      }

      if (asset.status === 'DISPOSED') {
        throw new Error(`Asset ${asset.assetNumber} is already disposed.`);
      }

      const category = getCategoryByCode(asset.categoryCode);
      const costAccountCode = category?.costAccountCode || '1590';
      const accDepAccountCode = category?.accumulatedDepAccountCode || '1591';

      const costAccountId = getAccountIdByCode(costAccountCode);
      const accDepAccountId = getAccountIdByCode(accDepAccountCode);
      const bankAccountId = getAccountIdByCode('1030'); // Bank Account GHS
      const gainAccountId = getAccountIdByCode('4070'); // Gain on Disposal of Assets
      const lossAccountId = getAccountIdByCode('5070'); // Loss on Disposal of Assets

      const disposalCalc = calculateDisposalGainLoss(
        asset.costInGhsPesewas,
        asset.accumulatedDepreciationPesewas,
        input.proceedsPesewas
      );

      // Construct balanced General Ledger journal entry per Section 3.6:
      // Dr Cash/Bank for proceeds (if > 0)
      // Dr Accumulated Depreciation for accumulated depreciation
      // If loss: Dr Loss on Disposal
      // If gain: Cr Gain on Disposal
      // Cr Asset Cost for original cost
      const glLines = [];

      if (input.proceedsPesewas > 0n) {
        glLines.push({
          accountId: bankAccountId,
          fundId: asset.fundId,
          originalCurrency: 'GHS' as Currency,
          originalAmount: input.proceedsPesewas,
          exchangeRate: '1.0000',
          isDebit: true,
          description: `Disposal proceeds for ${asset.assetNumber} (${input.buyerOrRecipient || 'Buyer'})`,
        });
      }

      if (asset.accumulatedDepreciationPesewas > 0n) {
        glLines.push({
          accountId: accDepAccountId,
          fundId: asset.fundId,
          originalCurrency: 'GHS' as Currency,
          originalAmount: asset.accumulatedDepreciationPesewas,
          exchangeRate: '1.0000',
          isDebit: true,
          description: `Derecognize accumulated depreciation on disposal of ${asset.assetNumber}`,
        });
      }

      if (disposalCalc.isLoss) {
        const lossAmount = -disposalCalc.gainOrLossPesewas;
        glLines.push({
          accountId: lossAccountId,
          fundId: asset.fundId,
          originalCurrency: 'GHS' as Currency,
          originalAmount: lossAmount,
          exchangeRate: '1.0000',
          isDebit: true,
          description: `Loss on disposal of asset ${asset.assetNumber}`,
        });
      }

      if (disposalCalc.isGain) {
        glLines.push({
          accountId: gainAccountId,
          fundId: asset.fundId,
          originalCurrency: 'GHS' as Currency,
          originalAmount: disposalCalc.gainOrLossPesewas,
          exchangeRate: '1.0000',
          isDebit: false,
          description: `Gain on disposal of asset ${asset.assetNumber}`,
        });
      }

      glLines.push({
        accountId: costAccountId,
        fundId: asset.fundId,
        originalCurrency: 'GHS' as Currency,
        originalAmount: asset.costInGhsPesewas,
        exchangeRate: '1.0000',
        isDebit: false,
        description: `Derecognize historical cost of disposed asset ${asset.assetNumber}`,
      });

      const je = createJournalEntry({
        id: `je-asset-disp-${Date.now()}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: `JE-AST-${Date.now().toString().slice(-4)}`,
        entryDate: input.disposalDate,
        narration: `Disposal of Fixed Asset: ${asset.description} [${asset.assetNumber}] (${input.disposalType})`,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        lines: glLines.map((l, idx) => ({ ...l, id: `l-disp-${idx + 1}` })),
      });
      addEntry(je);

      const disposalEvent: AssetEvent = {
        id: `evt-${Date.now()}-disp`,
        assetId: id,
        eventType: 'DISPOSAL',
        date: input.disposalDate,
        performedBy: currentUser.fullName,
        details: `Asset disposed (${input.disposalType}). Proceeds: GH₵ ${(Number(input.proceedsPesewas) / 100).toFixed(2)}. ${disposalCalc.isGain ? `Gain: GH₵ ${(Number(disposalCalc.gainOrLossPesewas) / 100).toFixed(2)}` : disposalCalc.isLoss ? `Loss: GH₵ ${(Number(-disposalCalc.gainOrLossPesewas) / 100).toFixed(2)}` : 'Break-even'}. Approved by: ${input.approvedByPastorOrElder}.`,
        costPesewas: input.proceedsPesewas,
        journalEntryId: je.id,
        approvalStatus: 'APPROVED',
        approvedBy: input.approvedByPastorOrElder,
        notes: input.reason,
        createdAt: new Date().toISOString(),
      };

      const updatedRecord: FixedAssetRecord = {
        ...asset,
        status: 'DISPOSED',
        disposalDetails: {
          disposalType: input.disposalType,
          disposalDate: input.disposalDate,
          reason: input.reason,
          proceedsPesewas: input.proceedsPesewas,
          currency: 'GHS',
          buyerOrRecipient: input.buyerOrRecipient,
          approvedByPastorOrElder: input.approvedByPastorOrElder,
          postedByTreasurer: currentUser.fullName,
          gainOrLossPesewas: disposalCalc.gainOrLossPesewas,
          journalEntryId: je.id,
        },
        events: [disposalEvent, ...asset.events],
      };

      setAssets((prev) => prev.map((a) => (a.id === id ? updatedRecord : a)));

      logAuditEvent({
        action: 'DISPOSE_FIXED_ASSET',
        record: `${asset.assetNumber} (${input.disposalType})`,
        entityType: 'fixed_assets',
        entityId: asset.id,
      });

      return updatedRecord;
    },
    [assets, currentUser, addEntry, getAccountIdByCode]
  );

  // Update policy settings
  const updatePolicySettings = useCallback(
    (settings: Partial<AssetPolicySettings>) => {
      setPolicySettings((prev) => {
        const updated = { ...prev, ...settings };
        logAuditEvent({
          action: 'UPDATE_ASSET_POLICY_SETTINGS',
          record: 'Fixed Asset Policies',
          entityType: 'asset_policy_settings',
          entityId: 'global_asset_policy',
        });
        return updated;
      });
    },
    []
  );

  // Recalculate depreciation for all active assets as of a given date
  const recalculateDepreciation = useCallback((asOfDate: string = new Date().toISOString().slice(0, 10)) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.status === 'DISPOSED') return asset;

        const category = getCategoryByCode(asset.categoryCode);
        const depCalc = calculateAssetDepreciationValues(
          asset.costInGhsPesewas,
          asset.residualValuePesewas,
          asset.usefulLifeMonths,
          asset.depreciationStartDate,
          asOfDate,
          category?.isDepreciable ?? true
        );

        return {
          ...asset,
          accumulatedDepreciationPesewas: depCalc.accumulatedDepreciationPesewas,
          netBookValuePesewas: depCalc.netBookValuePesewas,
        };
      })
    );
  }, []);

  const previewDepreciationRun = useCallback(
    (period: string, periodType: 'MONTHLY' | 'YEARLY', asOfDate?: string): DepreciationRun => {
      return generateDepreciationPreview(
        assets,
        period,
        periodType,
        asOfDate || new Date().toISOString().slice(0, 10),
        currentUser.fullName
      );
    },
    [assets, currentUser.fullName]
  );

  const postDepreciationRun = useCallback(
    (
      previewRun: DepreciationRun,
      approvedByTreasurer: string
    ): { success: boolean; journalEntryId?: string; error?: string } => {
      const check = canPostDepreciationPeriod(depreciationRuns, previewRun.period);
      if (!check.canPost) {
        return { success: false, error: check.reason };
      }

      const activeLines = previewRun.lines.filter(
        (l) => l.status === 'ACTIVE' && l.chargePesewas > 0n
      );
      if (activeLines.length === 0) {
        return {
          success: false,
          error: 'No active eligible assets with depreciation charges to post for this period.',
        };
      }

      const groupedCharges = new Map<
        string,
        {
          fundId: string;
          categoryCode: FixedAssetCategoryCode;
          totalCharge: bigint;
          expenseAcct: string;
          accDepAcct: string;
          catName: string;
        }
      >();

      for (const line of activeLines) {
        const key = `${line.fundId}___${line.categoryCode}`;
        const existing = groupedCharges.get(key);
        if (existing) {
          existing.totalCharge += line.chargePesewas;
        } else {
          groupedCharges.set(key, {
            fundId: line.fundId,
            categoryCode: line.categoryCode,
            totalCharge: line.chargePesewas,
            expenseAcct: line.depreciationExpenseAccountCode,
            accDepAcct: line.accumulatedDepreciationAccountCode,
            catName: line.categoryName,
          });
        }
      }

      const docNum = `DEP-${previewRun.period.replace('-', '')}-${Date.now().toString().slice(-4)}`;
      const jeLines: any[] = [];
      let lineIdx = 1;

      for (const group of groupedCharges.values()) {
        // Debit: Depreciation Expense
        jeLines.push({
          id: `jel-dep-${Date.now()}-${lineIdx++}`,
          accountId: group.expenseAcct,
          fundId: group.fundId,
          originalCurrency: 'GHS',
          exchangeRate: '1.0000',
          originalAmount: group.totalCharge,
          isDebit: true,
          description: `Depreciation: ${group.catName} (${previewRun.period})`,
        });

        // Credit: Accumulated Depreciation (Contra-Asset)
        jeLines.push({
          id: `jel-dep-${Date.now()}-${lineIdx++}`,
          accountId: group.accDepAcct,
          fundId: group.fundId,
          originalCurrency: 'GHS',
          exchangeRate: '1.0000',
          originalAmount: group.totalCharge,
          isDebit: false,
          description: `Accum. Dep: ${group.catName} (${previewRun.period})`,
        });
      }

      const journalEntry = createJournalEntry({
        id: `je-dep-${Date.now()}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: docNum,
        entryDate: previewRun.runDate,
        narration: `Asset Depreciation Run: ${previewRun.period} [${previewRun.runNumber}]`,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        lines: jeLines,
      });

      addEntry(journalEntry);

      const lineByAssetId = new Map(activeLines.map((l) => [l.assetId, l]));
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          const line = lineByAssetId.get(asset.id);
          if (!line) return asset;

          const updatedAccumulated = line.newAccumulatedDepreciationPesewas;
          const updatedNbv = line.projectedNetBookValuePesewas;

          const depEvent: AssetEvent = {
            id: `evt-${Date.now()}-${asset.id}-dep`,
            assetId: asset.id,
            eventType: 'DEPRECIATION',
            date: previewRun.runDate,
            performedBy: currentUser.fullName,
            details: `Depreciation charge of GHS ${(Number(line.chargePesewas) / 100).toFixed(2)} for ${previewRun.period}`,
            approvalStatus: 'APPROVED',
            approvedBy: approvedByTreasurer,
            costPesewas: line.chargePesewas,
            journalEntryId: journalEntry.id,
            createdAt: new Date().toISOString(),
          };

          return {
            ...asset,
            accumulatedDepreciationPesewas: updatedAccumulated,
            netBookValuePesewas: updatedNbv,
            events: [depEvent, ...asset.events],
          };
        })
      );

      const postedRun: DepreciationRun = {
        ...previewRun,
        journalEntryId: journalEntry.id,
        approvedByTreasurer,
        status: 'POSTED',
        createdAt: new Date().toISOString(),
      };

      setDepreciationRuns((prev) => [postedRun, ...prev]);

      logAuditEvent({
        action: 'FIXED_ASSETS_DEPRECIATION_POSTED',
        record: postedRun.runNumber,
        entityType: 'fixed_assets_depreciation',
        entityId: postedRun.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        details: JSON.stringify({
          runNumber: postedRun.runNumber,
          period: postedRun.period,
          totalChargePesewas: postedRun.totalChargePesewas.toString(),
          eligibleCount: postedRun.totalEligibleAssets,
          journalEntryId: journalEntry.id,
        }),
      });

      return { success: true, journalEntryId: journalEntry.id };
    },
    [depreciationRuns, addEntry, currentUser]
  );

  const reverseDepreciationRun = useCallback(
    (runId: string, reason: string): { success: boolean; error?: string } => {
      const run = depreciationRuns.find((r) => r.id === runId);
      if (!run) return { success: false, error: 'Depreciation run not found' };
      if (run.status === 'REVERSED') {
        return { success: false, error: 'This depreciation run has already been reversed' };
      }

      let revJeId: string | undefined;
      if (run.journalEntryId) {
        try {
          const revJe = reverseEntry(run.journalEntryId, `Reversal of ${run.runNumber}: ${reason}`);
          revJeId = revJe.id;
        } catch (err: any) {
          console.warn('Could not reverse linked journal entry:', err.message);
        }
      }

      const activeLines = run.lines.filter((l) => l.status === 'ACTIVE' && l.chargePesewas > 0n);
      const lineByAssetId = new Map(activeLines.map((l) => [l.assetId, l]));

      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          const line = lineByAssetId.get(asset.id);
          if (!line) return asset;

          const rolledBackAccumulated =
            asset.accumulatedDepreciationPesewas >= line.chargePesewas
              ? asset.accumulatedDepreciationPesewas - line.chargePesewas
              : 0n;
          const rolledBackNbv = asset.costInGhsPesewas - rolledBackAccumulated;

          const revEvent: AssetEvent = {
            id: `evt-${Date.now()}-${asset.id}-rev`,
            assetId: asset.id,
            eventType: 'CORRECTION',
            date: new Date().toISOString().slice(0, 10),
            performedBy: currentUser.fullName,
            details: `Reversed depreciation charge of GHS ${(Number(line.chargePesewas) / 100).toFixed(2)} for run ${run.runNumber}. Reason: ${reason}`,
            approvalStatus: 'APPROVED',
            approvedBy: currentUser.fullName,
            costPesewas: line.chargePesewas,
            journalEntryId: revJeId,
            createdAt: new Date().toISOString(),
          };

          return {
            ...asset,
            accumulatedDepreciationPesewas: rolledBackAccumulated,
            netBookValuePesewas: rolledBackNbv,
            events: [revEvent, ...asset.events],
          };
        })
      );

      setDepreciationRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                status: 'REVERSED',
                reversalReason: reason,
                reversedBy: currentUser.fullName,
                reversalJournalEntryId: revJeId,
                reversedAt: new Date().toISOString(),
              }
            : r
        )
      );

      logAuditEvent({
        action: 'FIXED_ASSETS_DEPRECIATION_REVERSED',
        record: run.runNumber,
        entityType: 'fixed_assets_depreciation',
        entityId: run.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        details: JSON.stringify({
          runNumber: run.runNumber,
          reason,
          reversalJournalEntryId: revJeId,
        }),
      });

      return { success: true };
    },
    [depreciationRuns, reverseEntry, currentUser]
  );

  const getMovementSchedule = useCallback(
    (periodStart: string, periodEnd: string): FixedAssetMovementSchedule => {
      return generateMovementSchedule(assets, periodStart, periodEnd);
    },
    [assets]
  );

  const getReconciliation = useCallback(
    (asOfDate?: string): RegisterLedgerReconciliation => {
      const accountBalances = new Map<string, { debitPesewas: bigint; creditPesewas: bigint }>();
      for (const item of trialBalance.accounts) {
        accountBalances.set(item.accountId, {
          debitPesewas: item.debitGhs,
          creditPesewas: item.creditGhs,
        });
      }
      return reconcileRegisterWithLedger(
        assets,
        accountBalances,
        asOfDate || new Date().toISOString().slice(0, 10)
      );
    },
    [assets, trialBalance.accounts]
  );

  const startVerification = useCallback(
    (input: {
      title: string;
      scope: VerificationScope;
      scopeValue?: string;
      startDate?: string;
    }): AssetVerification => {
      const newVerification = createVerificationRun(assets, {
        title: input.title,
        scope: input.scope,
        scopeValue: input.scopeValue,
        startDate: input.startDate,
        createdBy: currentUser.fullName,
        existingRunCount: verifications.length,
      });

      setVerifications((prev) => [newVerification, ...prev]);

      logAuditEvent({
        action: 'FIXED_ASSETS_VERIFICATION_STARTED',
        record: `${newVerification.verificationNumber} - ${newVerification.title}`,
        entityType: 'fixed_assets_verification',
        entityId: newVerification.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        details: JSON.stringify({
          verificationNumber: newVerification.verificationNumber,
          scope: newVerification.scope,
          totalExpectedAssets: newVerification.totalExpectedAssets,
        }),
      });

      return newVerification;
    },
    [assets, verifications.length, currentUser]
  );

  const updateVerificationLine = useCallback(
    (
      verificationId: string,
      lineId: string,
      updates: {
        status: VerificationItemStatus;
        actualLocation?: string;
        actualCustodian?: string;
        condition?: FixedAssetCondition;
        notes?: string;
        photoUrl?: string;
      }
    ) => {
      setVerifications((prev) =>
        prev.map((v) => {
          if (v.id !== verificationId) return v;
          return updateVerificationItem(v, lineId, {
            ...updates,
            verifiedBy: currentUser.fullName,
          });
        })
      );
    },
    [currentUser.fullName]
  );

  const addUnrecordedAsset = useCallback(
    (
      verificationId: string,
      item: {
        description: string;
        categoryName: string;
        actualLocation: string;
        actualCustodian: string;
        condition?: FixedAssetCondition;
        notes?: string;
      }
    ) => {
      setVerifications((prev) =>
        prev.map((v) => {
          if (v.id !== verificationId) return v;
          return addUnrecordedAssetToVerification(v, {
            ...item,
            verifiedBy: currentUser.fullName,
          });
        })
      );
    },
    [currentUser.fullName]
  );

  const signAndCompleteVerification = useCallback(
    (
      verificationId: string,
      signoff: AssetVerificationSignoff,
      autoApplyExceptions: boolean = true
    ): { success: boolean; error?: string } => {
      const target = verifications.find((v) => v.id === verificationId);
      if (!target) return { success: false, error: 'Verification run not found' };

      const result = finalizeVerificationRun(target, signoff);
      if (!result.isValid) {
        return { success: false, error: result.error };
      }

      setVerifications((prev) =>
        prev.map((v) => (v.id === verificationId ? result.verification : v))
      );

      if (autoApplyExceptions) {
        const { updatedAssets, appliedChanges } = applyVerificationExceptions(
          assets,
          result.verification,
          currentUser.fullName
        );
        setAssets(updatedAssets);

        logAuditEvent({
          action: 'FIXED_ASSETS_VERIFICATION_EXCEPTIONS_APPLIED',
          record: target.verificationNumber,
          entityType: 'fixed_assets_verification',
          entityId: target.id,
          userName: currentUser.fullName,
          userRole: currentUser.role,
          details: JSON.stringify({
            verificationNumber: target.verificationNumber,
            appliedChanges,
          }),
        });
      }

      logAuditEvent({
        action: 'FIXED_ASSETS_VERIFICATION_COMPLETED',
        record: target.verificationNumber,
        entityType: 'fixed_assets_verification',
        entityId: target.id,
        userName: currentUser.fullName,
        userRole: currentUser.role,
        details: JSON.stringify({
          verificationNumber: target.verificationNumber,
          verifier: signoff.verifierName,
          officer: signoff.officerName,
          missingCount: result.verification.missingCount,
          movedCount: result.verification.movedCount,
          damagedCount: result.verification.damagedCount,
        }),
      });

      return { success: true };
    },
    [verifications, assets, currentUser]
  );

  const applyExceptionsToRegister = useCallback(
    (
      verificationId: string
    ): { success: boolean; appliedChanges: { moved: number; damaged: number; missing: number } } => {
      const target = verifications.find((v) => v.id === verificationId);
      if (!target) {
        return { success: false, appliedChanges: { moved: 0, damaged: 0, missing: 0 } };
      }

      const { updatedAssets, appliedChanges } = applyVerificationExceptions(
        assets,
        target,
        currentUser.fullName
      );
      setAssets(updatedAssets);

      return { success: true, appliedChanges };
    },
    [verifications, assets, currentUser.fullName]
  );

  const value = useMemo(
    () => ({
      assets,
      categories: DEFAULT_ASSET_CATEGORIES,
      policySettings,
      summary,
      depreciationRuns,
      verifications,
      getAssetById,
      createAsset,
      updateAssetDetails,
      transferAsset,
      logRepair,
      disposeAsset,
      updatePolicySettings,
      recalculateDepreciation,
      previewDepreciationRun,
      postDepreciationRun,
      reverseDepreciationRun,
      getMovementSchedule,
      getReconciliation,
      startVerification,
      updateVerificationLine,
      addUnrecordedAsset,
      signAndCompleteVerification,
      applyExceptionsToRegister,
    }),
    [
      assets,
      policySettings,
      summary,
      depreciationRuns,
      verifications,
      getAssetById,
      createAsset,
      updateAssetDetails,
      transferAsset,
      logRepair,
      disposeAsset,
      updatePolicySettings,
      recalculateDepreciation,
      previewDepreciationRun,
      postDepreciationRun,
      reverseDepreciationRun,
      getMovementSchedule,
      getReconciliation,
      startVerification,
      updateVerificationLine,
      addUnrecordedAsset,
      signAndCompleteVerification,
      applyExceptionsToRegister,
    ]
  );

  return <FixedAssetsContext.Provider value={value}>{children}</FixedAssetsContext.Provider>;
};

export const useFixedAssets = (): FixedAssetsContextType => {
  const context = useContext(FixedAssetsContext);
  if (!context) {
    return {
      assets: SEED_FIXED_ASSETS,
      categories: DEFAULT_ASSET_CATEGORIES,
      policySettings: DEFAULT_ASSET_POLICY_SETTINGS,
      summary: summarizeFixedAssets(SEED_FIXED_ASSETS),
      depreciationRuns: SEED_DEPRECIATION_RUNS,
      verifications: SEED_ASSET_VERIFICATIONS,
      getAssetById: (id: string) => SEED_FIXED_ASSETS.find((a) => a.id === id),
      createAsset: () => SEED_FIXED_ASSETS[0]!,
      updateAssetDetails: () => SEED_FIXED_ASSETS[0]!,
      transferAsset: () => SEED_FIXED_ASSETS[0]!,
      logRepair: () => SEED_FIXED_ASSETS[0]!,
      disposeAsset: () => SEED_FIXED_ASSETS[0]!,
      updatePolicySettings: () => {},
      recalculateDepreciation: () => {},
      previewDepreciationRun: () => SEED_DEPRECIATION_RUNS[0]!,
      postDepreciationRun: () => ({ success: true }),
      reverseDepreciationRun: () => ({ success: true }),
      getMovementSchedule: () => generateMovementSchedule(SEED_FIXED_ASSETS, '2026-01-01', '2026-12-31'),
      getReconciliation: () => reconcileRegisterWithLedger(SEED_FIXED_ASSETS, new Map()),
      startVerification: () => SEED_ASSET_VERIFICATIONS[0]!,
      updateVerificationLine: () => {},
      addUnrecordedAsset: () => {},
      signAndCompleteVerification: () => ({ success: true }),
      applyExceptionsToRegister: () => ({ success: true, appliedChanges: { moved: 0, damaged: 0, missing: 0 } }),
    } as FixedAssetsContextType;
  }
  return context;
};
