import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSync } from '../context/SyncContext.js';
import { canViewIndividualGiving, formatMoney, money } from '@church/domain';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  PlusCircle,
  Stethoscope,
} from 'lucide-react';

interface Props {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<Props> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { isOnline, pendingUploadCount, triggerSync, simulateRejection } = useSync();

  const canSeeGiving = canViewIndividualGiving(currentUser.role);

  // Sample data in minor units (integer pesewas)
  const totalIncomePesewas = 1245000n; // 12,450.00 GHS
  const totalExpensePesewas = 412000n; // 4,120.00 GHS
  const generalFundPesewas = 833000n; // 8,330.00 GHS
  const buildingFundPesewas = 4500000n; // 45,000.00 GHS (Restricted)

  // Sample member giving data to demonstrate the privacy rule
  const sampleGivingList = [
    { donor: 'Kwame Mensah', category: 'Tithe', amountPesewas: 200000n, currency: 'GHS' as const },
    { donor: 'Akua Mansa', category: 'Building Pledge', amountPesewas: 150000n, currency: 'GHS' as const },
    { donor: 'General Congregation', category: 'Sunday Offering', amountPesewas: 350000n, currency: 'GHS' as const },
    { donor: 'Anonymous Donor', category: 'Missions Gift', amountPesewas: 5000n, currency: 'USD' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-800/80 text-blue-200 mb-2">
              Offline-First PWA Active
            </span>
            <h2 className="text-xl sm:text-2xl font-bold">
              Welcome, {currentUser.fullName}
            </h2>
            <p className="text-xs sm:text-sm text-blue-200 mt-1">
              Church financial console for Accra Central. Primary currency: <span className="font-semibold text-white">Ghana Cedi (GHS)</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('counting')}
              className="px-3.5 py-2 bg-white text-blue-900 hover:bg-blue-50 font-semibold text-xs rounded-lg shadow transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Counting Sheet</span>
            </button>
            <button
              onClick={() => onNavigate('doctor')}
              className="px-3.5 py-2 bg-blue-700/80 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1.5 border border-blue-500/30"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Diagnose Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Total Month Giving (GHS)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatMoney(money(totalIncomePesewas, 'GHS'))}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
            +18% from last month
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Month Expenditures (GHS)</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatMoney(money(totalExpensePesewas, 'GHS'))}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Utilities, Honorariums & Admin
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>General Fund Balance</span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatMoney(money(generalFundPesewas, 'GHS'))}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
            Unrestricted operational liquidity
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span>Building Fund Balance</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {formatMoney(money(buildingFundPesewas, 'GHS'))}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            Restricted: Capital expansion only
          </div>
        </div>
      </div>

      {/* Grid: Member Giving Privacy Verification + Offline Sync Queue Demo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Member Giving Privacy Enforcement */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                Member Giving Privacy Gate (Section 5)
              </h3>
            </div>
            {canSeeGiving ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Access Granted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5" />
                Protected / Confidential
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current Role: <span className="font-bold text-slate-800 dark:text-slate-200">{currentUser.role}</span>.
            {canSeeGiving
              ? ' You are authorized (Treasurer, Finance Secretary, Pastor / Elder, Auditor) to inspect donor names and amounts.'
              : ' Non-authorized roles (Counters, Department Heads, Admins) see totals only to safeguard member privacy.'}
          </p>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5">Contributor / Member</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sampleGivingList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {canSeeGiving ? row.donor : '•••••••••••• (Confidential)'}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.category}</td>
                    <td className="p-2.5 text-right font-mono text-slate-900 dark:text-white">
                      {canSeeGiving
                        ? formatMoney(money(row.amountPesewas, row.currency))
                        : '••••••'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!canSeeGiving && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              Privacy rule enforced: Switch to Treasurer, Finance Secretary, or Pastor/Elder in the header to view unmasked member contributions.
            </div>
          )}
        </div>

        {/* Card 2: Offline Resilience & PowerSync Diagnostics */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                Offline Resilience & Sync Status
              </h3>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isOnline ? 'Online Sync Active' : 'Operating Offline'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Local SQLite database stores journal entries, counting sheets, and fund balances on this device. Changes post immediately offline with zero network latency.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Device Prefix:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{currentUser.devicePrefix}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Unsynced Queued Transactions:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingUploadCount} items</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Postgres RPC Validation:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enforced on Server</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => triggerSync()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
            >
              Run Sync Upload
            </button>
            <button
              onClick={() => simulateRejection('Test rejection: Unbalanced posting detected (debits <> credits).')}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs transition"
            >
              Simulate Server Rejection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
