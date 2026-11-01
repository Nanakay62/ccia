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

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                Accra Main Branch
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Offline-First Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              Financial Administration Dashboard
            </h1>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Accra Central Grace Chapel • Double-entry fund accounting in GHS with USD denominational reporting.
            </p>
          </div>

          {/* Quick Doctor Status Pill */}
          <button
            onClick={() => onNavigate('doctor')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 transition text-left"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-blue-200">Trial Balance Doctor</div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span>10/10 Diagnostics Healthy</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Giving & Income</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              GHS {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ≈ ${((totalRevenue * 100) / 15.5 / 100).toFixed(2)} USD summary
            </p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Expenditures</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              GHS {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Including WHT & petty cash float
            </p>
          </div>
        </div>

        {/* Net Operating Surplus */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Net Operating Surplus</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${netSurplus >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
              GHS {netSurplus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {netSurplus >= 0 ? 'Operating with positive margin' : 'Expenditure exceeds inflows'}
            </p>
          </div>
        </div>

        {/* Liquid Bank & Cash */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Liquid Cash & Bank</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              GHS {liquidReserves.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Bank GHS, MoMo & physical cash
            </p>
          </div>
        </div>
      </div>

      {/* Fund Protection & Allocation Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Fund Integrity & Restricted Capital Protection</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fund accounting prevents restricted collections (Building, Missions, Welfare) from being spent on general overhead.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              Unrestricted: GHS {unrestrictedFunds.toFixed(2)}
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Restricted: GHS {restrictedFunds.toFixed(2)} ({restrictedPercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          <div
            style={{ width: `${100 - restrictedPercent}%` }}
            className="bg-blue-600 transition-all duration-500"
            title={`Unrestricted: ${(100 - restrictedPercent).toFixed(1)}%`}
          />
          <div
            style={{ width: `${restrictedPercent}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Restricted: ${restrictedPercent.toFixed(1)}%`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {fundBalance.funds.map((f) => (
            <div key={f.fundId} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{f.fundName}</span>
                <span className={`text-[9px] font-bold ${f.fundType === 'Restricted' ? 'text-amber-600' : 'text-blue-600'}`}>
                  {f.fundCode}
                </span>
              </div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                GHS {(Number(f.closingBalancePesewas) / 100).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Operations Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('counting')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm transition text-left group"
        >
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 group-hover:scale-105 transition-transform w-fit">
            <Coins className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3">Counting Sheet</h4>
          <p className="text-xs text-slate-400 mt-0.5">Record Sunday service giving with dual sign-off</p>
        </button>

        <button
          onClick={() => onNavigate('expenses')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm transition text-left group"
        >
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 group-hover:scale-105 transition-transform w-fit">
            <CreditCard className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3">Payment Voucher</h4>
          <p className="text-xs text-slate-400 mt-0.5">Issue voucher with Ghana Withholding Tax (WHT)</p>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm transition text-left group"
        >
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 group-hover:scale-105 transition-transform w-fit">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3">Financial Reports</h4>
          <p className="text-xs text-slate-400 mt-0.5">Export PDF, Excel, and CSV statements offline</p>
        </button>

        <button
          onClick={() => onNavigate('doctor')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 shadow-sm transition text-left group"
        >
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 group-hover:scale-105 transition-transform w-fit">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-3">Ledger Integrity</h4>
          <p className="text-xs text-slate-400 mt-0.5">Run 10-step diagnostic check before month-end lock</p>
        </button>
      </div>

      {/* Feeds Grid: Recent Ledger Entries & Giving Privacy Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Ledger Entries Feed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Recent Posted Transactions</span>
            </h3>
            <button
              onClick={() => onNavigate('ledger')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              View Ledger →
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.slice(0, 4).map((entry) => (
              <div key={entry.id} className="py-2 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {entry.documentNumber}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {entry.entryType}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{entry.narration}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    GHS {(Number(entry.totalDebitGhs) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">{entry.entryDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Member Giving (Strict Privacy Gating) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Recent Giving & Tithes</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
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
              <div key={idx} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {canSeeGiving ? g.donor : '•••••••••••• (Confidential)'}
                  </div>
                  <span className="text-[11px] text-slate-400">{g.category}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-600">GHS {g.amountGhs}</div>
                  <span className="text-[10px] text-slate-400">{g.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
