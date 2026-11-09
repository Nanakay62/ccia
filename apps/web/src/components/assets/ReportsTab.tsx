import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  User,
} from 'lucide-react';
import { useFixedAssets } from '../../context/FixedAssetsContext.js';
import { StatusDot } from '../ui/StatusDot.js';
import { exportReportToCSV } from '../../utils/exports/csv.js';

type ReportSubTab = 'movement' | 'reconciliation' | 'forecast' | 'lifecycle';

export const ReportsTab: React.FC = () => {
  const { assets, getMovementSchedule, getReconciliation } = useFixedAssets();
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('movement');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // 1. Movement Schedule
  const movementSchedule = useMemo(() => {
    return getMovementSchedule(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
  }, [getMovementSchedule, selectedYear]);

  // 2. Register vs Ledger Reconciliation
  const reconciliation = useMemo(() => {
    return getReconciliation();
  }, [getReconciliation]);

  // 3. 5-Year Forecast Calculation
  const forecast = useMemo(() => {
    const years = [2026, 2027, 2028, 2029, 2030];
    const activeAssets = assets.filter((a) => a.status !== 'DISPOSED' && a.categoryCode !== 'LAND');

    const byCategory: Record<string, bigint[]> = {};

    for (const asset of activeAssets) {
      if (!byCategory[asset.categoryName]) {
        byCategory[asset.categoryName] = [0n, 0n, 0n, 0n, 0n];
      }
      const depBase = asset.costInGhsPesewas > asset.residualValuePesewas ? asset.costInGhsPesewas - asset.residualValuePesewas : 0n;
      const annualCharge = (depBase * 12n) / BigInt(Math.max(1, asset.usefulLifeMonths));

      let currentNbv = asset.netBookValuePesewas;
      const row = byCategory[asset.categoryName]!;
      for (let i = 0; i < years.length; i++) {
        if (currentNbv <= asset.residualValuePesewas) break;
        const maxCharge = currentNbv - asset.residualValuePesewas;
        const charge = annualCharge > maxCharge ? maxCharge : annualCharge;
        row[i] = (row[i] ?? 0n) + charge;
        currentNbv -= charge;
      }
    }

    const yearTotals = [0n, 0n, 0n, 0n, 0n];
    for (const catRows of Object.values(byCategory)) {
      for (let i = 0; i < 5; i++) {
        yearTotals[i] = (yearTotals[i] ?? 0n) + (catRows[i] ?? 0n);
      }
    }

    return { years, byCategory, yearTotals };
  }, [assets]);

  // 4. Lifecycle & Custodians
  const lifecycleData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in90DaysDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const fullyDepreciatedInUse = assets.filter(
      (a) => a.status === 'IN_USE' && a.netBookValuePesewas <= a.residualValuePesewas && a.categoryCode !== 'LAND'
    );

    const expiringWarranty = assets.filter(
      (a) => a.warrantyExpiry && a.warrantyExpiry >= today && a.warrantyExpiry <= in90DaysDate
    );

    const expiringInsurance = assets.filter(
      (a) => a.insuranceExpiry && a.insuranceExpiry >= today && a.insuranceExpiry <= in90DaysDate
    );

    const byCustodian = assets.reduce((map, a) => {
      const c = a.custodian || 'Unassigned';
      if (!map[c]) map[c] = [];
      map[c].push(a);
      return map;
    }, {} as Record<string, typeof assets>);

    return { fullyDepreciatedInUse, expiringWarranty, expiringInsurance, byCustodian };
  }, [assets]);

  // Export handlers
  const handleExportCSV = () => {
    if (activeSubTab === 'movement') {
      const rows = movementSchedule.rows.map((r) => ({
        Category: r.categoryName,
        'Cost At Start': (Number(r.costAtStartPesewas) / 100).toFixed(2),
        Additions: (Number(r.additionsCostPesewas) / 100).toFixed(2),
        Disposals: (Number(r.disposalsCostPesewas) / 100).toFixed(2),
        'Cost At End': (Number(r.costAtEndPesewas) / 100).toFixed(2),
        'Acc Dep At Start': (Number(r.accumulatedDepreciationAtStartPesewas) / 100).toFixed(2),
        'Dep Charge For Year': (Number(r.chargeForPeriodPesewas) / 100).toFixed(2),
        'Acc Dep Disposals': (Number(r.disposalsAccumulatedDepreciationPesewas) / 100).toFixed(2),
        'Acc Dep At End': (Number(r.accumulatedDepreciationAtEndPesewas) / 100).toFixed(2),
        'Net Book Value At Start': (Number(r.netBookValueAtStartPesewas) / 100).toFixed(2),
        'Net Book Value At End': (Number(r.netBookValueAtEndPesewas) / 100).toFixed(2),
      }));
      exportReportToCSV(rows, `fixed_assets_movement_schedule_${selectedYear}.csv`);
    } else if (activeSubTab === 'reconciliation') {
      const rows = reconciliation.rows.map((r) => ({
        Category: r.categoryName,
        'Asset Account': r.assetAccountCode,
        'Register Cost': (Number(r.registerCostPesewas) / 100).toFixed(2),
        'Ledger Cost': (Number(r.ledgerCostPesewas) / 100).toFixed(2),
        'Cost Diff': (Number(r.costDifferencePesewas) / 100).toFixed(2),
        'Acc Dep Account': r.accumulatedDepreciationAccountCode,
        'Register Acc Dep': (Number(r.registerAccDepPesewas) / 100).toFixed(2),
        'Ledger Acc Dep': (Number(r.ledgerAccDepPesewas) / 100).toFixed(2),
        'Acc Dep Diff': (Number(r.accDepDifferencePesewas) / 100).toFixed(2),
        'In Balance': r.isInBalance ? 'YES' : 'NO',
      }));
      exportReportToCSV(rows, `fixed_assets_register_ledger_reconciliation.csv`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Subtab navigation */}
      <div className="border-b border-[var(--surface-border)] flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveSubTab('movement')}
            className={`py-2 border-b-2 transition ${
              activeSubTab === 'movement'
                ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Fixed Asset Movement Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('reconciliation')}
            className={`py-2 border-b-2 transition ${
              activeSubTab === 'reconciliation'
                ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Sub-Ledger vs General Ledger Reconciliation
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('forecast')}
            className={`py-2 border-b-2 transition ${
              activeSubTab === 'forecast'
                ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            5-Year Depreciation Forecast
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('lifecycle')}
            className={`py-2 border-b-2 transition ${
              activeSubTab === 'lifecycle'
                ? 'border-[#1e4620] text-[#1e4620] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Lifecycle, Expiries & Custodians
          </button>
        </div>

        <div className="flex items-center gap-2 pb-1.5">
          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-1 transition"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* 1. MOVEMENT SCHEDULE */}
      {activeSubTab === 'movement' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-secondary)]">Financial Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-2.5 py-1 border border-[var(--surface-border)] rounded text-xs bg-[var(--surface-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#1e4620]"
              >
                <option value="2026">2026 (01 Jan 2026 – 31 Dec 2026)</option>
                <option value="2025">2025 (01 Jan 2025 – 31 Dec 2025)</option>
              </select>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Official Note to Financial Statements · Straight-line basis · Land is non-depreciable
            </div>
          </div>

          <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--text-secondary)] whitespace-nowrap">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th rowSpan={2} className="py-2 px-3 border-r border-[var(--surface-border)]">Category</th>
                    <th colSpan={4} className="py-1 px-3 text-center border-r border-[var(--surface-border)] bg-neutral-100/60 dark:bg-neutral-800/60 font-semibold">
                      Gross Carrying Amount / Cost (GHS)
                    </th>
                    <th colSpan={4} className="py-1 px-3 text-center border-r border-[var(--surface-border)] bg-neutral-100/40 dark:bg-neutral-800/40 font-semibold">
                      Accumulated Depreciation (GHS)
                    </th>
                    <th colSpan={2} className="py-1 px-3 text-center font-semibold">
                      Net Book Value (GHS)
                    </th>
                  </tr>
                  <tr className="border-t border-[var(--surface-border)] text-[10px]">
                    <th className="py-1.5 px-2.5 text-right">At Start</th>
                    <th className="py-1.5 px-2.5 text-right">Additions</th>
                    <th className="py-1.5 px-2.5 text-right">Disposals</th>
                    <th className="py-1.5 px-2.5 text-right border-r border-[var(--surface-border)] font-semibold">At End</th>
                    <th className="py-1.5 px-2.5 text-right">At Start</th>
                    <th className="py-1.5 px-2.5 text-right">Charge</th>
                    <th className="py-1.5 px-2.5 text-right">Disposals</th>
                    <th className="py-1.5 px-2.5 text-right border-r border-[var(--surface-border)] font-semibold">At End</th>
                    <th className="py-1.5 px-2.5 text-right">At Start</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold text-[var(--text-primary)]">At End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {movementSchedule.rows.map((row) => {
                    const fmt = (v: bigint) =>
                      (Number(v) / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });

                    return (
                      <tr key={row.categoryCode} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-3 font-medium text-[var(--text-primary)] border-r border-[var(--surface-border)]">
                          {row.categoryName}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-muted)]">{fmt(row.costAtStartPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono">{fmt(row.additionsCostPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-muted)]">{fmt(row.disposalsCostPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-[var(--text-primary)] border-r border-[var(--surface-border)]">
                          {fmt(row.costAtEndPesewas)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-muted)]">{fmt(row.accumulatedDepreciationAtStartPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-[#1e4620]">{fmt(row.chargeForPeriodPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-muted)]">{fmt(row.disposalsAccumulatedDepreciationPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-[var(--text-primary)] border-r border-[var(--surface-border)]">
                          {fmt(row.accumulatedDepreciationAtEndPesewas)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-[var(--text-muted)]">{fmt(row.netBookValueAtStartPesewas)}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-[var(--text-primary)]">
                          {fmt(row.netBookValueAtEndPesewas)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[var(--surface-subtle)] border-t-2 border-[var(--surface-border)] font-semibold text-[var(--text-primary)]">
                  <tr>
                    <td className="py-2.5 px-3 border-r border-[var(--surface-border)]">Total Fixed Assets</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.costAtStartPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.additionsCostPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.disposalsCostPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono border-r border-[var(--surface-border)]">{(Number(movementSchedule.totals.costAtEndPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.accumulatedDepreciationAtStartPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[#1e4620]">{(Number(movementSchedule.totals.chargeForPeriodPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.disposalsAccumulatedDepreciationPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono border-r border-[var(--surface-border)]">{(Number(movementSchedule.totals.accumulatedDepreciationAtEndPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">{(Number(movementSchedule.totals.netBookValueAtStartPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-[#1e4620]">{(Number(movementSchedule.totals.netBookValueAtEndPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. RECONCILIATION */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-3">
          {/* Plain Status Line */}
          <div className="py-2.5 px-4 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-4">
            <div>
              Register Cost: <span className="font-mono font-semibold text-[var(--text-primary)]">{(Number(reconciliation.totalRegisterCostPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> · Ledger Cost: <span className="font-mono font-semibold text-[var(--text-primary)]">{(Number(reconciliation.totalLedgerCostPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> · Cost Difference: <span className={`font-mono font-bold ${reconciliation.totalCostDifferencePesewas === 0n ? 'text-[#1e4620]' : 'text-red-600'}`}>{(Number(reconciliation.totalCostDifferencePesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <StatusDot
                status={reconciliation.isFullyInBalance ? 'approved' : 'error'}
                label={reconciliation.isFullyInBalance ? 'Sub-ledger agrees with General Ledger' : 'Discrepancy Detected'}
              />
            </div>
          </div>

          <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Asset Account</th>
                    <th className="py-2.5 px-3 text-right">Register Cost</th>
                    <th className="py-2.5 px-3 text-right">Ledger Cost</th>
                    <th className="py-2.5 px-3 text-right">Cost Diff</th>
                    <th className="py-2.5 px-3">Acc Dep Account</th>
                    <th className="py-2.5 px-3 text-right">Register Acc Dep</th>
                    <th className="py-2.5 px-3 text-right">Ledger Acc Dep</th>
                    <th className="py-2.5 px-3 text-right">Acc Dep Diff</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {reconciliation.rows.map((row) => {
                    const fmt = (v: bigint) =>
                      (Number(v) / 100).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });

                    return (
                      <tr key={row.categoryCode} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                          {row.categoryName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                          acct-{row.assetAccountCode}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt(row.registerCostPesewas)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt(row.ledgerCostPesewas)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono ${row.costDifferencePesewas === 0n ? 'text-[#1e4620]' : 'text-red-600 font-bold'}`}>
                          {fmt(row.costDifferencePesewas)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                          acct-{row.accumulatedDepreciationAccountCode}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt(row.registerAccDepPesewas)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt(row.ledgerAccDepPesewas)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono ${row.accDepDifferencePesewas === 0n ? 'text-[#1e4620]' : 'text-red-600 font-bold'}`}>
                          {fmt(row.accDepDifferencePesewas)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusDot
                            status={row.isInBalance ? 'approved' : 'error'}
                            label={row.isInBalance ? 'Balanced' : 'Difference'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. FORECAST */}
      {activeSubTab === 'forecast' && (
        <div className="space-y-3">
          <div className="py-2 px-3 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded text-xs text-[var(--text-secondary)]">
            Projected straight-line depreciation expense for the next 5 fiscal years based on existing active depreciable assets.
          </div>

          <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Asset Category</th>
                    {forecast.years.map((yr) => (
                      <th key={yr} className="py-2.5 px-3 text-right">{yr} (GHS)</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {Object.entries(forecast.byCategory).map(([catName, rowYears]) => (
                    <tr key={catName} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">{catName}</td>
                      {rowYears.map((val, idx) => (
                        <td key={idx} className="py-2.5 px-3 text-right font-mono">
                          {(Number(val) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--surface-subtle)] border-t-2 border-[var(--surface-border)] font-semibold text-[var(--text-primary)]">
                  <tr>
                    <td className="py-2.5 px-3">Total Projected Annual Depreciation</td>
                    {forecast.yearTotals.map((tot, idx) => (
                      <td key={idx} className="py-2.5 px-3 text-right font-mono text-[#1e4620]">
                        {(Number(tot) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. LIFECYCLE & CUSTODIANS */}
      {activeSubTab === 'lifecycle' && (
        <div className="space-y-4">
          {/* Fully Depreciated In Use */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Fully Depreciated Assets Still in Active Service ({lifecycleData.fullyDepreciatedInUse.length})
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">Carried at residual value · Zero ongoing depreciation charge</span>
            </div>

            <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Asset No.</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Custodian</th>
                    <th className="py-2 px-3 text-right">Cost (GHS)</th>
                    <th className="py-2 px-3 text-right">Residual Value</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {lifecycleData.fullyDepreciatedInUse.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-[var(--text-muted)]">
                        No fully depreciated assets currently in service.
                      </td>
                    </tr>
                  ) : (
                    lifecycleData.fullyDepreciatedInUse.map((a) => (
                      <tr key={a.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-3 font-mono font-medium text-[var(--text-primary)]">{a.assetNumber}</td>
                        <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{a.description}</td>
                        <td className="py-2 px-3">{a.categoryName}</td>
                        <td className="py-2 px-3">{a.custodian}</td>
                        <td className="py-2 px-3 text-right font-mono">{(Number(a.costInGhsPesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-3 text-right font-mono">{(Number(a.residualValuePesewas)/100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-3">
                          <StatusDot status="approved" label="In Use (Fully Depreciated)" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expiries: Warranty & Insurance */}
          <div className="space-y-2">
            <span className="font-semibold text-[var(--text-primary)] text-xs">
              Warranty & Insurance Expiring Within 90 Days ({lifecycleData.expiringWarranty.length + lifecycleData.expiringInsurance.length})
            </span>

            <div className="border border-[var(--surface-border)] rounded overflow-hidden bg-[var(--surface-card)]">
              <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] font-medium text-[var(--text-muted)] text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Asset No.</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Item Expiring</th>
                    <th className="py-2 px-3">Expiry Date</th>
                    <th className="py-2 px-3">Custodian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {lifecycleData.expiringWarranty.length === 0 && lifecycleData.expiringInsurance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">
                        No warranties or insurance policies expiring within the next 90 days.
                      </td>
                    </tr>
                  ) : (
                    [
                      ...lifecycleData.expiringWarranty.map((a) => ({ asset: a, type: 'Warranty', date: a.warrantyExpiry })),
                      ...lifecycleData.expiringInsurance.map((a) => ({ asset: a, type: 'Insurance', date: a.insuranceExpiry })),
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-3 font-mono font-medium text-[var(--text-primary)]">{item.asset.assetNumber}</td>
                        <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{item.asset.description}</td>
                        <td className="py-2 px-3 font-semibold text-amber-700">{item.type}</td>
                        <td className="py-2 px-3 font-mono text-[var(--text-primary)]">{item.date}</td>
                        <td className="py-2 px-3">{item.asset.custodian}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custodians Handover Sheet */}
          <div className="space-y-2 pt-2 border-t border-[var(--surface-border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Assets by Custodian (Handover Sign-off Sheet)
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Includes blank signature lines for custody transfers and inventory verification
              </span>
            </div>

            <div className="space-y-3">
              {Object.entries(lifecycleData.byCustodian).slice(0, 4).map(([custodianName, cAssets]) => (
                <div key={custodianName} className="p-3 border border-[var(--surface-border)] rounded bg-[var(--surface-card)] text-xs space-y-2">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-[var(--text-primary)] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Custodian: {custodianName}
                    </span>
                    <span className="text-[var(--text-muted)]">{cAssets.length} assets assigned</span>
                  </div>

                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {cAssets.map((a) => `${a.assetNumber} (${a.description})`).join(' · ')}
                  </div>

                  <div className="pt-2 border-t border-[var(--surface-border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Custodian Acknowledgement Signature: _______________________</span>
                    <span>Date: ____________</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
