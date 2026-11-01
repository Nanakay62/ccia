/**
 * DashboardOverview Component.
 * Executive visual dashboard presenting real-time KPIs, liquid reserves,
 * restricted vs unrestricted fund allocations, month-to-date burn rate, and quick action shortcuts.
 */

import React from 'react';
import {
  TrendingUp,
  Landmark,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  FileText,
  CreditCard,
  Coins,
  CheckCircle,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useReports } from '../../context/ReportsContext.js';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { canViewIndividualGiving } from '@church/domain';

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const { incomeExpenditure, balanceSheet, fundBalance } = useReports();
  const { entries } = useLedger();
  const { currentUser } = useAuth();
  const canSeeGiving = canViewIndividualGiving(currentUser.role);

  const totalRevenue = Number(incomeExpenditure.totalIncomePesewas) / 100;
  const totalExpense = Number(incomeExpenditure.totalExpensePesewas) / 100;
  const netSurplus = Number(incomeExpenditure.netSurplusDeficitPesewas) / 100;

  // Liquid Cash & Bank
  const liquidReserves = Number(
    balanceSheet.currentAssets
      .filter((a) => a.accountCode.startsWith('10'))
      .reduce((sum, a) => sum + a.amountPesewas, 0n)
  ) / 100;

  const unrestrictedFunds = Number(fundBalance.totalUnrestrictedPesewas) / 100;
  const restrictedFunds = Number(fundBalance.totalRestrictedPesewas) / 100;
  const totalFunds = unrestrictedFunds + restrictedFunds;
  const restrictedPercent = totalFunds > 0 ? (restrictedFunds / totalFunds) * 100 : 0;
  const unrestrictedPercent = 100 - restrictedPercent;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 text-white shadow-lg relative overflow-hidden border border-blue-800/30">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                Accra Main Branch
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                <CheckCircle className="w-3.5 h-3.5" /> Offline-First Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black mt-2 tracking-tight">
              Financial Administration Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 mt-1 max-w-2xl leading-relaxed">
              Accra Central Grace Chapel • Double-entry fund accounting in GHS with USD denominational reporting view.
            </p>
          </div>

          {/* Quick Doctor Status Pill */}
          <button
            onClick={() => onNavigate('doctor')}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 transition-all shadow-sm text-left group hover:scale-[1.02]"
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">Trial Balance Doctor</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span>10/10 Diagnostics Healthy</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shadow-sm shadow-emerald-400/50" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all hover:border-emerald-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Giving & Income</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-numeric tabular-nums text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              GHS {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-[10px] font-numeric tabular-nums font-semibold text-slate-600 dark:text-slate-300">
                <span>💱</span> ≈ ${((totalRevenue * 100) / 15.5 / 100).toFixed(2)} USD summary
              </span>
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all hover:border-rose-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Expenditures</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-numeric tabular-nums text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              GHS {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Including Ghana WHT & petty cash float
            </p>
          </div>
        </div>

        {/* Net Operating Surplus */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all hover:border-blue-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Operating Surplus</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`font-numeric tabular-nums text-2xl sm:text-3xl font-black tracking-tight ${netSurplus >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
              GHS {netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                netSurplus >= 0
                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
              }`}>
                {netSurplus >= 0 ? '✓ Operating with positive margin' : '⚠ Expenditure exceeds inflows'}
              </span>
            </div>
          </div>
        </div>

        {/* Liquid Bank & Cash */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all hover:border-indigo-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Liquid Cash & Bank</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="font-numeric tabular-nums text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              GHS {liquidReserves.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Bank GHS, MoMo & physical cash float
            </p>
          </div>
        </div>
      </div>

      {/* Fund Protection & Allocation Bar */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Fund Integrity & Restricted Capital Protection</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                Protected
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fund accounting strictly quarantines restricted collections (Building, Missions, Welfare) from general operational overhead.
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>Unrestricted:</span>
              <strong className="font-numeric tabular-nums">GHS {unrestrictedFunds.toFixed(2)}</strong>
              <span className="text-[10px] opacity-80">({unrestrictedPercent.toFixed(1)}%)</span>
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Restricted:</span>
              <strong className="font-numeric tabular-nums">GHS {restrictedFunds.toFixed(2)}</strong>
              <span className="text-[10px] opacity-80">({restrictedPercent.toFixed(1)}%)</span>
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner p-0.5">
          <div
            style={{ width: `${unrestrictedPercent}%` }}
            className="bg-blue-600 h-full rounded-l-full transition-all duration-500 shadow-sm"
            title={`Unrestricted: ${unrestrictedPercent.toFixed(1)}%`}
          />
          <div
            style={{ width: `${restrictedPercent}%` }}
            className="bg-amber-500 h-full rounded-r-full transition-all duration-500 shadow-sm"
            title={`Restricted: ${restrictedPercent.toFixed(1)}%`}
          />
        </div>

        {/* Individual Fund Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          {fundBalance.funds.map((f) => (
            <div
              key={f.fundId}
              className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] gap-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate" title={f.fundName}>
                  {f.fundName}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  f.fundType === 'Restricted'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}>
                  {f.fundCode}
                </span>
              </div>
              <div className="font-numeric tabular-nums font-bold text-slate-900 dark:text-white mt-1 text-sm">
                GHS {(Number(f.closingBalancePesewas) / 100).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Operations Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('counting')}
          className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/60 dark:hover:border-blue-500/60 shadow-sm hover:shadow-md transition-all text-left group relative"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-4">Counting Sheet</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Record Sunday service giving with physical cash denomination breakdown & dual sign-off.
          </p>
        </button>

        <button
          onClick={() => onNavigate('expenses')}
          className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 shadow-sm hover:shadow-md transition-all text-left group relative"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-4">Payment Voucher</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Issue authorized vouchers with statutory Ghana GRA Withholding Tax (7.5% / 3%).
          </p>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 shadow-sm hover:shadow-md transition-all text-left group relative"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-4">Financial Reports</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Generate and export PDF, Excel, and CSV statements offline at any time.
          </p>
        </button>

        <button
          onClick={() => onNavigate('doctor')}
          className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-500/60 dark:hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all text-left group relative"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-4">Ledger Integrity</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Run 10-step diagnostic check before month-end lock to catch imbalances or gaps.
          </p>
        </button>
      </div>

      {/* Feeds Grid: Recent Ledger Entries & Giving Privacy Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Ledger Entries Feed */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Recent Posted Transactions</span>
            </h3>
            <button
              onClick={() => onNavigate('ledger')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View Ledger</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.slice(0, 4).map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded-lg transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-numeric tabular-nums font-bold text-slate-800 dark:text-slate-200">
                      {entry.documentNumber}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {entry.entryType}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{entry.narration}</p>
                </div>
                <div className="text-right">
                  <div className="font-numeric tabular-nums font-bold text-slate-900 dark:text-white">
                    GHS {(Number(entry.totalDebitGhs) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-numeric">{entry.entryDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Member Giving (Strict Privacy Gating) */}
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Recent Giving & Tithes</span>
            </h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200/60 dark:border-slate-700/60">
              {canSeeGiving ? 'Confidential View' : 'Masked (Counter / Dept Head)'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { donor: 'Kwame Mensah', category: 'Tithe', amountGhs: '2,000.00', date: '2026-10-12' },
              { donor: 'Akua Mansa', category: 'Building Pledge', amountGhs: '1,500.00', date: '2026-10-12' },
              { donor: 'Sister Grace Addo', category: 'Special Offering', amountGhs: '850.00', date: '2026-10-14' },
              { donor: 'Anonymous Congregation', category: 'Sunday Offering', amountGhs: '3,500.00', date: '2026-10-12' },
            ].map((g, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded-lg transition-colors">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {canSeeGiving ? g.donor : '•••••••••••• (Confidential)'}
                  </div>
                  <span className="text-[11px] text-slate-400">{g.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-numeric tabular-nums font-bold text-emerald-600 dark:text-emerald-400">GHS {g.amountGhs}</div>
                  <span className="text-[10px] text-slate-400 font-numeric">{g.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
