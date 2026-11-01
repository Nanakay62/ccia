/**
 * BudgetManagerView Component.
 * Departmental budget allocations, quarterly distribution matrices,
 * revision management with audit history, and real-time expense utilization monitoring.
 */

import React, { useState } from 'react';
import {
  PieChart,
  TrendingUp,
  History,
  AlertTriangle,
  CheckCircle,
  Edit,
} from 'lucide-react';
import { useBudget } from '../../context/BudgetContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const BudgetManagerView: React.FC = () => {
  const { activeBudget, applyRevision, getUtilization } = useBudget();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'REVISIONS'>('OVERVIEW');
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [selectedAccountCode, setSelectedAccountCode] = useState('5020');
  const [newAmountGhs, setNewAmountGhs] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useModalEscape(isRevisionOpen, () => setIsRevisionOpen(false));

  if (!activeBudget) {
    return <div className="p-6 text-center text-slate-400">No active church budget found.</div>;
  }

  const utilizationList = getUtilization(activeBudget.id);

  const totalProjectedRevenue = Number(activeBudget.totalIncomeBudgetPesewas) / 100;
  const totalPlannedExpense = Number(activeBudget.totalExpenseBudgetPesewas) / 100;
  const projectedSurplus = Number(activeBudget.projectedSurplusPesewas) / 100;

  const handleApplyRevision = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmountGhs);
    if (isNaN(amt) || amt < 0 || !revisionReason.trim()) {
      alert('Please enter a valid amount and justification reason.');
      return;
    }

    try {
      applyRevision({
        budgetId: activeBudget.id,
        reason: revisionReason.trim(),
        updatedLines: [
          {
            accountCode: selectedAccountCode,
            newAmountPesewas: BigInt(Math.round(amt * 100)),
          },
        ],
      });

      setIsRevisionOpen(false);
      setNewAmountGhs('');
      setRevisionReason('');
      setSuccessBanner(`Budget revised successfully. Line ${selectedAccountCode} updated.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Church Operating Budget & Departmental Allocations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeBudget.title} • Year {activeBudget.year} ({activeBudget.status})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRevisionOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Edit className="w-4 h-4" />
              <span>Revise Allocation</span>
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-500 hover:text-emerald-700">
              ×
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Target Revenue</span>
            <div className="text-xl font-black text-emerald-600 mt-1">
              GHS {totalProjectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Planned Expenditures</span>
            <div className="text-xl font-black text-rose-600 mt-1">
              GHS {totalPlannedExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Projected Operating Surplus</span>
            <div className={`text-xl font-black mt-1 ${projectedSurplus >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              GHS {projectedSurplus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'OVERVIEW'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Quarterly Matrix & Utilization ({activeBudget.lines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('REVISIONS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'REVISIONS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Revision History ({activeBudget.revisions.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Matrix */}
      {activeTab === 'OVERVIEW' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Budget Allocation & Quarterly Distribution
            </h3>
            <span className="text-xs text-slate-400">Equal 4-quarter distribution with integer remainder reconciliation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-400 font-semibold">
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Account</th>
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-right">Annual Budget</th>
                  <th className="py-2 text-right">Q1</th>
                  <th className="py-2 text-right">Q2</th>
                  <th className="py-2 text-right">Q3</th>
                  <th className="py-2 text-right">Q4</th>
                  <th className="py-2 text-right">Actual Spent</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeBudget.lines.map((line) => {
                  const util = utilizationList.find((u) => u.accountCode === line.accountCode);
                  const isExpense = line.category === 'EXPENSE';

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2 font-mono text-slate-400">{line.accountCode}</td>
                      <td className="py-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{line.accountName}</div>
                        {line.notes && <div className="text-[10px] text-slate-400">{line.notes}</div>}
                      </td>
                      <td className="py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpense ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {line.category}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-right font-bold text-slate-900 dark:text-white">
                        {(Number(line.annualAmountPesewas) / 100).toFixed(2)}
                      </td>
                      <td className="py-2 font-mono text-right text-slate-500">{(Number(line.quarterlyAmountsPesewas[0]) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-slate-500">{(Number(line.quarterlyAmountsPesewas[1]) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-slate-500">{(Number(line.quarterlyAmountsPesewas[2]) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right text-slate-500">{(Number(line.quarterlyAmountsPesewas[3]) / 100).toFixed(2)}</td>
                      <td className="py-2 font-mono text-right font-semibold text-blue-600">
                        {util ? (Number(util.actualPesewas) / 100).toFixed(2) : '0.00'}
                      </td>
                      <td className="py-2 text-center">
                        {util?.isOverBudget ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Over Budget
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            On Track ({util?.utilizationPercentage.toFixed(0)}%)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Revision History */}
      {activeTab === 'REVISIONS' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Audit Trail of Budget Revisions</h3>

          {activeBudget.revisions.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No budget revisions have been made yet.</p>
          ) : (
            <div className="space-y-3">
              {activeBudget.revisions.map((rev) => (
                <div key={rev.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Revision #{rev.revisionNumber} — {rev.reason}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{rev.revisionDate}</span>
                  </div>
                  <p className="text-slate-500">
                    Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{rev.requestedBy}</span> • Authorized by{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{rev.authorizedBy}</span>
                  </p>
                  <div className="pt-2 border-t space-y-1">
                    {rev.changes.map((ch, idx) => (
                      <div key={idx} className="flex justify-between font-mono text-[11px]">
                        <span>Account {ch.accountCode}:</span>
                        <span>
                          GHS {(Number(ch.fromPesewas) / 100).toFixed(2)} →{' '}
                          <span className="font-bold text-blue-600">GHS {(Number(ch.toPesewas) / 100).toFixed(2)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Revise Allocation */}
      {isRevisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Revise Budget Line Allocation</h3>

            <form onSubmit={handleApplyRevision} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Account Line</label>
                <select
                  value={selectedAccountCode}
                  onChange={(e) => setSelectedAccountCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                >
                  {activeBudget.lines.map((l) => (
                    <option key={l.accountCode} value={l.accountCode}>
                      {l.accountCode} - {l.accountName} (Current: GHS {(Number(l.annualAmountPesewas) / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold">New Annual Amount (GHS) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newAmountGhs}
                  onChange={(e) => setNewAmountGhs(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Justification / Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Unanticipated surge in utilities tariff by regulatory commission"
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsRevisionOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Authorize Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
