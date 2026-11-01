import React, { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatMoney, money, createJournalEntry, toMajorUnitsString } from '@church/domain';
import {
  BookOpen,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { EmptyState } from '../ui/EmptyState.js';

export const LedgerView: React.FC = () => {
  const { accounts, funds, entries, addEntry, reverseEntry } = useLedger();
  const { currentUser } = useAuth();

  // New Journal Entry Form State
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<
    Array<{
      id: string;
      accountId: string;
      fundId: string;
      currency: 'GHS' | 'USD';
      amountMajor: string; // e.g. "150.00"
      exchangeRate: string;
      isDebit: boolean;
      description: string;
    }>
  >([
    {
      id: 'l-1',
      accountId: 'acct-1010',
      fundId: 'fund-gen',
      currency: 'GHS',
      amountMajor: '100.00',
      exchangeRate: '1.0000',
      isDebit: true,
      description: '',
    },
    {
      id: 'l-2',
      accountId: 'acct-4010',
      fundId: 'fund-gen',
      currency: 'GHS',
      amountMajor: '100.00',
      exchangeRate: '1.0000',
      isDebit: false,
      description: '',
    },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reversal Modal State
  const [reversalTargetId, setReversalTargetId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  useModalEscape(Boolean(reversalTargetId), () => setReversalTargetId(null));

  // Calculate live line totals
  let computedDebitPesewas = 0n;
  let computedCreditPesewas = 0n;
  const fundTotals = new Map<string, { dr: bigint; cr: bigint }>();

  for (const line of lines) {
    const rawAmt = parseFloat(line.amountMajor) || 0;
    const rate = parseFloat(line.exchangeRate) || 1;
    const pesewas = BigInt(Math.round(rawAmt * 100 * rate));

    if (line.isDebit) {
      computedDebitPesewas += pesewas;
    } else {
      computedCreditPesewas += pesewas;
    }

    const f = fundTotals.get(line.fundId) ?? { dr: 0n, cr: 0n };
    if (line.isDebit) f.dr += pesewas;
    else f.cr += pesewas;
    fundTotals.set(line.fundId, f);
  }

  const liveDiffPesewas = computedDebitPesewas - computedCreditPesewas;
  const isBalanced = liveDiffPesewas === 0n;

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        accountId: 'acct-1010',
        fundId: 'fund-gen',
        currency: 'GHS',
        amountMajor: '0.00',
        exchangeRate: '1.0000',
        isDebit: true,
        description: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAutoBalanceRounding = () => {
    if (Math.abs(Number(liveDiffPesewas)) <= 2 && liveDiffPesewas !== 0n) {
      const isDebitNeeded = liveDiffPesewas < 0n;
      const absDiff = liveDiffPesewas < 0n ? -liveDiffPesewas : liveDiffPesewas;
      const majorUnits = (Number(absDiff) / 100).toFixed(2);

      setLines((prev) => [
        ...prev,
        {
          id: `line-rounding-${Date.now()}`,
          accountId: 'acct-5990', // Rounding Differences
          fundId: 'fund-gen',
          currency: 'GHS',
          amountMajor: majorUnits,
          exchangeRate: '1.0000',
          isDebit: isDebitNeeded,
          description: 'Rounding adjustment',
        },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!isBalanced) {
      setFormError(`Entry is unbalanced: Total Debits <> Total Credits (Difference: GHS ${toMajorUnitsString(liveDiffPesewas)}).`);
      return;
    }

    // Check per-fund balance
    for (const [fundId, f] of fundTotals.entries()) {
      if (f.dr !== f.cr) {
        const fName = funds.find((x) => x.id === fundId)?.name ?? fundId;
        setFormError(`Fund "${fName}" is unbalanced (Dr: GHS ${toMajorUnitsString(f.dr)}, Cr: GHS ${toMajorUnitsString(f.cr)}). Fund accounting requires balancing entries per fund or interfund clearing.`);
        return;
      }
    }

    try {
      const docNum = `JE-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;
      const newEntry = createJournalEntry({
        id: `je-${Date.now()}`,
        branchId: '00000000-0000-0000-0000-000000000001',
        documentNumber: docNum,
        entryDate,
        narration,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        lines: lines.map((l, idx) => ({
          id: `l-${Date.now()}-${idx + 1}`,
          accountId: l.accountId,
          fundId: l.fundId,
          originalCurrency: l.currency,
          originalAmount: BigInt(Math.round((parseFloat(l.amountMajor) || 0) * 100)),
          exchangeRate: l.exchangeRate,
          isDebit: l.isDebit,
          description: l.description,
        })),
      });

      addEntry(newEntry);
      setSuccessMsg(`Posted entry ${docNum} successfully to append-only ledger.`);
      setNarration('');
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to post entry');
    }
  };

  const handleExecuteReversal = () => {
    if (!reversalTargetId || !reversalReason.trim()) return;
    try {
      const reversal = reverseEntry(reversalTargetId, reversalReason.trim());
      setSuccessMsg(`Reversal ${reversal.documentNumber} successfully posted! Ledger updated.`);
      setReversalTargetId(null);
      setReversalReason('');
    } catch (err: any) {
      setFormError(err?.message ?? 'Reversal failed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span>General Ledger & Journal Postings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Append-only double-entry ledger. All transactions post locally in SQLite and sync to Postgres.
          </p>
        </div>
      </div>

      {/* Success & Error alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* New Journal Entry Form */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white">
            New Double-Entry Journal Transaction
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Prefix: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentUser.devicePrefix}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Narration / Description
              </label>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="e.g., Weekly Sunday Tithes & General Offering deposit"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Dynamic Lines Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5">Account</th>
                  <th className="p-2.5">Fund</th>
                  <th className="p-2.5">Currency</th>
                  <th className="p-2.5">Rate</th>
                  <th className="p-2.5 text-right">Debit (GHS)</th>
                  <th className="p-2.5 text-right">Credit (GHS)</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2">
                      <select
                        value={line.accountId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, accountId: val } : l))
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      >
                        {accounts.filter((a) => a.isActive).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name} ({a.currency})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2">
                      <select
                        value={line.fundId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, fundId: val } : l))
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      >
                        {funds.filter((f) => f.isActive).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.code} - {f.name} ({f.type})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2">
                      <select
                        value={line.currency}
                        onChange={(e) => {
                          const curr = e.target.value as 'GHS' | 'USD';
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    currency: curr,
                                    exchangeRate: curr === 'USD' ? '15.5000' : '1.0000',
                                  }
                                : l
                            )
                          );
                        }}
                        className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      >
                        <option value="GHS">GHS</option>
                        <option value="USD">USD</option>
                      </select>
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        disabled={line.currency === 'GHS'}
                        value={line.exchangeRate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, exchangeRate: val } : l))
                          );
                        }}
                        className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono disabled:opacity-40"
                      />
                    </td>

                    <td className="p-2 text-right">
                      {line.isDebit ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amountMajor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, amountMajor: val } : l))
                            );
                          }}
                          className="w-28 px-2 py-1.5 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, isDebit: true } : l))
                            );
                          }}
                          className="text-slate-400 hover:text-blue-600 text-xs px-2 py-1"
                        >
                          Make Debit
                        </button>
                      )}
                    </td>

                    <td className="p-2 text-right">
                      {!line.isDebit ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amountMajor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, amountMajor: val } : l))
                            );
                          }}
                          className="w-28 px-2 py-1.5 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, isDebit: false } : l))
                            );
                          }}
                          className="text-slate-400 hover:text-blue-600 text-xs px-2 py-1"
                        >
                          Make Credit
                        </button>
                      )}
                    </td>

                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length <= 2}
                        className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Actions & Balancing Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={handleAddLine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <Plus className="w-4 h-4" />
              <span>Add Line</span>
            </button>

            {/* Balancing Status Bar */}
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500">Debits: </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {formatMoney(money(computedDebitPesewas, 'GHS'))}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Credits: </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {formatMoney(money(computedCreditPesewas, 'GHS'))}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Difference: </span>
                <span
                  className={`font-mono font-bold ${
                    isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatMoney(money(liveDiffPesewas, 'GHS'))}
                </span>
              </div>

              {Math.abs(Number(liveDiffPesewas)) <= 2 && liveDiffPesewas !== 0n && (
                <button
                  type="button"
                  onClick={handleAutoBalanceRounding}
                  className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded text-[11px] font-semibold border border-amber-300 dark:border-amber-800"
                >
                  Auto-Balance 1p Rounding
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!isBalanced}
              className={`px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm text-white shadow transition ${
                isBalanced
                  ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              Post Journal Entry
            </button>
          </div>
        </form>
      </div>

      {/* Posted Entries Feed */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base text-slate-900 dark:text-white">
            Posted Journal Entries ({entries.length})
          </h3>
          <span className="text-xs text-slate-500">Strictly Append-Only</span>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            message="No journal entries posted to the general ledger yet."
            actionLabel="New Journal Entry"
            onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {entries.map((entry) => (
              <div key={entry.id} className="py-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                      {entry.documentNumber}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.entryDate}
                    </span>
                    {entry.isReversal && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:purple-950 text-purple-800 dark:text-purple-300">
                        REVERSAL
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {entry.entryType}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                      {formatMoney(money(entry.totalDebitGhs, 'GHS'))}
                    </span>

                    {!entry.isReversal && (
                      <button
                        onClick={() => setReversalTargetId(entry.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs transition"
                        title="Post a linked reversal entry"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
                        <span>Reverse</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {entry.narration}
                </p>

                {/* Sub-lines */}
                <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 pt-1 text-[11px] text-slate-500">
                  {entry.lines.map((l) => {
                    const acct = accounts.find((a) => a.id === l.accountId);
                    const f = funds.find((x) => x.id === l.fundId);
                    return (
                      <div key={l.id} className="flex justify-between items-center">
                        <span>
                          {acct?.code} {acct?.name} ({f?.code}) {l.description ? `— ${l.description}` : ''}
                        </span>
                        <span className="font-mono">
                          {l.debitAmountGhs > 0n
                            ? `Dr ${formatMoney(money(l.debitAmountGhs, 'GHS'))}`
                            : `Cr ${formatMoney(money(l.creditAmountGhs, 'GHS'))}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Reversal Confirmation Modal */}
      {reversalTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-base text-purple-600 dark:text-purple-400">
                <ArrowRightLeft className="w-5 h-5" />
                <span>Create Linked Reversal Entry</span>
              </div>
              <button onClick={() => setReversalTargetId(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Because accounting ledgers are strictly append-only, entries are never edited or deleted. This will create an exact mirror entry with inverted debits and credits, netting the original entry to zero.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason for Reversal (Required for Audit Trail)
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g., Erroneous account posted by counter, duplicate receipt, or bank reconciliation adjustment..."
                rows={3}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalTargetId(null)}
                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReversal}
                disabled={!reversalReason.trim()}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold shadow disabled:opacity-50"
              >
                Confirm & Post Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
