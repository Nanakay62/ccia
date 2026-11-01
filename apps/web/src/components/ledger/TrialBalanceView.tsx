import React, { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { formatMoney, money, calculateRevaluation } from '@church/domain';
import {
  Scale,
  Stethoscope,
  CheckCircle,
  AlertTriangle,
  Building2,
  DollarSign,
  X,
} from 'lucide-react';

interface Props {
  onNavigateToDoctor: () => void;
}

export const TrialBalanceView: React.FC<Props> = ({ onNavigateToDoctor }) => {
  const { accounts, entries, trialBalance } = useLedger();

  const [showRevalModal, setShowRevalModal] = useState(false);
  const [closingRate, setClosingRate] = useState('16.0000');

  const revalResult = calculateRevaluation({
    entries,
    usdAccounts: accounts,
    closingRate,
    revaluationDate: new Date().toISOString().slice(0, 10),
    fxGainLossAccountId: 'acct-5980',
    generalFundId: 'fund-gen',
  });

  return (
    <div className="space-y-8">
      {/* View Header & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            <span>Trial Balance & Fund Position</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time balance verification across all accounts and restricted funds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Check and Diagnose button (Highlighted automatically when debits differ from credits) */}
          <button
            onClick={onNavigateToDoctor}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition ${
              !trialBalance.isBalanced
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Check & Diagnose</span>
            {!trialBalance.isBalanced && (
              <span className="px-1.5 py-0.5 rounded bg-white text-rose-700 text-[10px] font-bold">
                DIFF FOUND
              </span>
            )}
          </button>

          <button
            onClick={() => setShowRevalModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition"
          >
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span>USD Revaluation</span>
          </button>
        </div>
      </div>

      {/* Trial Balance Health Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
          trialBalance.isBalanced
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {trialBalance.isBalanced ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <div className="font-bold text-sm sm:text-base">
              {trialBalance.isBalanced
                ? 'Books are in Perfect Balance'
                : 'Imbalance Detected in Ledger'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {trialBalance.isBalanced
                ? `Total Debits equal Total Credits (${formatMoney(money(trialBalance.totalDebitsGhs, 'GHS'))}).`
                : `Debits and credits diverge by ${formatMoney(money(trialBalance.differenceGhs, 'GHS'))}. Use Trial Balance Doctor to diagnose.`}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Difference:</div>
          <div
            className={`font-mono font-bold text-base ${
              trialBalance.isBalanced
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatMoney(money(trialBalance.differenceGhs, 'GHS'))}
          </div>
        </div>
      </div>

      {/* Accounts Trial Balance Table */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-semibold text-base text-slate-900 dark:text-white">
          General Ledger Accounts Summary
        </h3>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Account Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Currency</th>
                <th className="p-3 text-right">Debit (GHS)</th>
                <th className="p-3 text-right">Credit (GHS)</th>
                <th className="p-3 text-right">Net Balance (GHS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {trialBalance.accounts.map((acct) => (
                <tr key={acct.accountId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">
                    {acct.accountCode}
                  </td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                    {acct.accountName}
                  </td>
                  <td className="p-3 text-slate-500">{acct.accountType}</td>
                  <td className="p-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {acct.currency}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">
                    {acct.debitGhs > 0n ? formatMoney(money(acct.debitGhs, 'GHS'), { includeCode: false }) : '—'}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-800 dark:text-slate-200">
                    {acct.creditGhs > 0n ? formatMoney(money(acct.creditGhs, 'GHS'), { includeCode: false }) : '—'}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {formatMoney(money(acct.netBalanceGhs, 'GHS'))}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Grand Totals Footer */}
            <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
              <tr>
                <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-xs">
                  Grand Totals:
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {formatMoney(money(trialBalance.totalDebitsGhs, 'GHS'))}
                </td>
                <td className="p-3 text-right font-mono text-xs">
                  {formatMoney(money(trialBalance.totalCreditsGhs, 'GHS'))}
                </td>
                <td
                  className={`p-3 text-right font-mono text-xs ${
                    trialBalance.isBalanced ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatMoney(money(trialBalance.differenceGhs, 'GHS'))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Fund Balances & Restricted Fund Compliance */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-base text-slate-900 dark:text-white">
            Fund Balances & Restricted Fund Compliance (Section 3.1)
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Restricted funds (Building, Missions, Welfare, Youth) cannot be overspent without an explicit Treasurer override logged in the audit trail.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trialBalance.fundBalances.map((fund) => (
            <div
              key={fund.fundId}
              className={`p-4 rounded-xl border ${
                fund.isOverdrawn
                  ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {fund.fundName}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    fund.fundType === 'Restricted'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {fund.fundType}
                </span>
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-500">Net Fund Balance:</div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {formatMoney(money(fund.netBalanceGhs, 'GHS'))}
                </div>
              </div>

              {fund.isOverdrawn && (
                <div className="mt-2 text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>OVERDRAWN: Requires Treasurer Override</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Month-End USD Revaluation Modal */}
      {showRevalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-base text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-5 h-5" />
                <span>Month-End USD Revaluation Preview</span>
              </div>
              <button onClick={() => setShowRevalModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Revalues all USD cash and bank balances at the period closing rate and previews the Foreign Exchange Gain/Loss journal posting.
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Period Closing Rate (USD/GHS):
              </label>
              <input
                type="text"
                value={closingRate}
                onChange={(e) => setClosingRate(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
              />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="p-2">Account</th>
                    <th className="p-2 text-right">USD Balance</th>
                    <th className="p-2 text-right">Carrying GHS</th>
                    <th className="p-2 text-right">Revalued GHS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {revalResult.revaluationLines.length > 0 ? (
                    revalResult.revaluationLines.map((l) => (
                      <tr key={l.accountId}>
                        <td className="p-2 font-medium">{l.accountName}</td>
                        <td className="p-2 text-right font-mono">
                          {formatMoney(money(l.usdBalanceCents, 'USD'))}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {formatMoney(money(l.currentGhsBookValue, 'GHS'))}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatMoney(money(l.newGhsValue, 'GHS'))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        No active USD cash/bank balance to revalue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs flex justify-between items-center">
              <span className="font-medium">Total Unrealized Adjustment:</span>
              <span
                className={`font-mono font-bold ${
                  revalResult.isNetGain ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {revalResult.isNetGain ? '+' : '-'}
                {formatMoney(money(revalResult.totalAdjustmentGhs, 'GHS'))} ({revalResult.isNetGain ? 'Gain' : 'Loss'})
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevalModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded text-xs font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
