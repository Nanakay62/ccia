import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatMoney, money, createJournalEntry, toMajorUnitsString } from '@church/domain';
import { BookOpen, Plus, Trash2, CheckCircle, AlertTriangle, RotateCcw, ArrowRightLeft, X, } from 'lucide-react';
export const LedgerView = () => {
    const { accounts, funds, entries, addEntry, reverseEntry } = useLedger();
    const { currentUser } = useAuth();
    // New Journal Entry Form State
    const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState([
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
    const [formError, setFormError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    // Reversal Modal State
    const [reversalTargetId, setReversalTargetId] = useState(null);
    const [reversalReason, setReversalReason] = useState('');
    // Calculate live line totals
    let computedDebitPesewas = 0n;
    let computedCreditPesewas = 0n;
    const fundTotals = new Map();
    for (const line of lines) {
        const rawAmt = parseFloat(line.amountMajor) || 0;
        const rate = parseFloat(line.exchangeRate) || 1;
        const pesewas = BigInt(Math.round(rawAmt * 100 * rate));
        if (line.isDebit) {
            computedDebitPesewas += pesewas;
        }
        else {
            computedCreditPesewas += pesewas;
        }
        const f = fundTotals.get(line.fundId) ?? { dr: 0n, cr: 0n };
        if (line.isDebit)
            f.dr += pesewas;
        else
            f.cr += pesewas;
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
    const handleRemoveLine = (index) => {
        if (lines.length <= 2)
            return;
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
    const handleSubmit = (e) => {
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
        }
        catch (err) {
            setFormError(err?.message ?? 'Failed to post entry');
        }
    };
    const handleExecuteReversal = () => {
        if (!reversalTargetId || !reversalReason.trim())
            return;
        try {
            const reversal = reverseEntry(reversalTargetId, reversalReason.trim());
            setSuccessMsg(`Reversal ${reversal.documentNumber} successfully posted! Ledger updated.`);
            setReversalTargetId(null);
            setReversalReason('');
        }
        catch (err) {
            setFormError(err?.message ?? 'Reversal failed');
        }
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsx("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3", children: _jsxs("div", { children: [_jsxs("h2", { className: "text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2", children: [_jsx(BookOpen, { className: "w-6 h-6 text-blue-600" }), _jsx("span", { children: "General Ledger & Journal Postings" })] }), _jsx("p", { className: "text-xs sm:text-sm text-slate-500 dark:text-slate-400", children: "Append-only double-entry ledger. All transactions post locally in SQLite and sync to Postgres." })] }) }), successMsg && (_jsxs("div", { className: "p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-5 h-5 shrink-0" }), _jsx("span", { children: successMsg })] })), formError && (_jsxs("div", { className: "p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "w-5 h-5 shrink-0" }), _jsx("span", { children: formError })] })), _jsxs("div", { className: "p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3", children: [_jsx("h3", { className: "font-semibold text-base text-slate-900 dark:text-white", children: "New Double-Entry Journal Transaction" }), _jsxs("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Prefix: ", _jsx("span", { className: "font-mono font-bold text-slate-800 dark:text-slate-200", children: currentUser.devicePrefix })] })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1", children: "Transaction Date" }), _jsx("input", { type: "date", value: entryDate, onChange: (e) => setEntryDate(e.target.value), required: true, className: "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1", children: "Narration / Description" }), _jsx("input", { type: "text", value: narration, onChange: (e) => setNarration(e.target.value), placeholder: "e.g., Weekly Sunday Tithes & General Offering deposit", required: true, className: "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none" })] })] }), _jsx("div", { className: "overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl", children: _jsxs("table", { className: "w-full text-xs text-left", children: [_jsx("thead", { className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "p-2.5", children: "Account" }), _jsx("th", { className: "p-2.5", children: "Fund" }), _jsx("th", { className: "p-2.5", children: "Currency" }), _jsx("th", { className: "p-2.5", children: "Rate" }), _jsx("th", { className: "p-2.5 text-right", children: "Debit (GHS)" }), _jsx("th", { className: "p-2.5 text-right", children: "Credit (GHS)" }), _jsx("th", { className: "p-2.5 text-center", children: "Action" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-200 dark:divide-slate-800", children: lines.map((line, idx) => (_jsxs("tr", { className: "hover:bg-slate-50 dark:hover:bg-slate-800/40", children: [_jsx("td", { className: "p-2", children: _jsx("select", { value: line.accountId, onChange: (e) => {
                                                                const val = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, accountId: val } : l)));
                                                            }, className: "w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs", children: accounts.filter((a) => a.isActive).map((a) => (_jsxs("option", { value: a.id, children: [a.code, " - ", a.name, " (", a.currency, ")"] }, a.id))) }) }), _jsx("td", { className: "p-2", children: _jsx("select", { value: line.fundId, onChange: (e) => {
                                                                const val = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, fundId: val } : l)));
                                                            }, className: "w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs", children: funds.filter((f) => f.isActive).map((f) => (_jsxs("option", { value: f.id, children: [f.code, " - ", f.name, " (", f.type, ")"] }, f.id))) }) }), _jsx("td", { className: "p-2", children: _jsxs("select", { value: line.currency, onChange: (e) => {
                                                                const curr = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => i === idx
                                                                    ? {
                                                                        ...l,
                                                                        currency: curr,
                                                                        exchangeRate: curr === 'USD' ? '15.5000' : '1.0000',
                                                                    }
                                                                    : l));
                                                            }, className: "px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs", children: [_jsx("option", { value: "GHS", children: "GHS" }), _jsx("option", { value: "USD", children: "USD" })] }) }), _jsx("td", { className: "p-2", children: _jsx("input", { type: "text", disabled: line.currency === 'GHS', value: line.exchangeRate, onChange: (e) => {
                                                                const val = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, exchangeRate: val } : l)));
                                                            }, className: "w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono disabled:opacity-40" }) }), _jsx("td", { className: "p-2 text-right", children: line.isDebit ? (_jsx("input", { type: "number", step: "0.01", min: "0", value: line.amountMajor, onChange: (e) => {
                                                                const val = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, amountMajor: val } : l)));
                                                            }, className: "w-28 px-2 py-1.5 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono" })) : (_jsx("button", { type: "button", onClick: () => {
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, isDebit: true } : l)));
                                                            }, className: "text-slate-400 hover:text-blue-600 text-xs px-2 py-1", children: "Make Debit" })) }), _jsx("td", { className: "p-2 text-right", children: !line.isDebit ? (_jsx("input", { type: "number", step: "0.01", min: "0", value: line.amountMajor, onChange: (e) => {
                                                                const val = e.target.value;
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, amountMajor: val } : l)));
                                                            }, className: "w-28 px-2 py-1.5 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono" })) : (_jsx("button", { type: "button", onClick: () => {
                                                                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, isDebit: false } : l)));
                                                            }, className: "text-slate-400 hover:text-blue-600 text-xs px-2 py-1", children: "Make Credit" })) }), _jsx("td", { className: "p-2 text-center", children: _jsx("button", { type: "button", onClick: () => handleRemoveLine(idx), disabled: lines.length <= 2, className: "p-1 text-slate-400 hover:text-rose-500 disabled:opacity-20", children: _jsx(Trash2, { className: "w-4 h-4" }) }) })] }, line.id))) })] }) }), _jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2", children: [_jsxs("button", { type: "button", onClick: handleAddLine, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "Add Line" })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs", children: [_jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Debits: " }), _jsx("span", { className: "font-mono font-semibold text-slate-900 dark:text-white", children: formatMoney(money(computedDebitPesewas, 'GHS')) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Credits: " }), _jsx("span", { className: "font-mono font-semibold text-slate-900 dark:text-white", children: formatMoney(money(computedCreditPesewas, 'GHS')) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "Difference: " }), _jsx("span", { className: `font-mono font-bold ${isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`, children: formatMoney(money(liveDiffPesewas, 'GHS')) })] }), Math.abs(Number(liveDiffPesewas)) <= 2 && liveDiffPesewas !== 0n && (_jsx("button", { type: "button", onClick: handleAutoBalanceRounding, className: "px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded text-[11px] font-semibold border border-amber-300 dark:border-amber-800", children: "Auto-Balance 1p Rounding" }))] }), _jsx("button", { type: "submit", disabled: !isBalanced, className: `px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm text-white shadow transition ${isBalanced
                                            ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                                            : 'bg-slate-400 cursor-not-allowed opacity-60'}`, children: "Post Journal Entry" })] })] })] }), _jsxs("div", { className: "p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "font-semibold text-base text-slate-900 dark:text-white", children: ["Posted Journal Entries (", entries.length, ")"] }), _jsx("span", { className: "text-xs text-slate-500", children: "Strictly Append-Only" })] }), _jsx("div", { className: "divide-y divide-slate-200 dark:divide-slate-800", children: entries.map((entry) => (_jsxs("div", { className: "py-4 space-y-2", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono font-bold text-sm text-blue-600 dark:text-blue-400", children: entry.documentNumber }), _jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: entry.entryDate }), entry.isReversal && (_jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300", children: "REVERSAL" })), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400", children: entry.entryType })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs font-mono font-semibold text-slate-900 dark:text-white", children: formatMoney(money(entry.totalDebitGhs, 'GHS')) }), !entry.isReversal && (_jsxs("button", { onClick: () => setReversalTargetId(entry.id), className: "flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs transition", title: "Post a linked reversal entry", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5 text-purple-500" }), _jsx("span", { children: "Reverse" })] }))] })] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-300", children: entry.narration }), _jsx("div", { className: "pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 pt-1 text-[11px] text-slate-500", children: entry.lines.map((l) => {
                                        const acct = accounts.find((a) => a.id === l.accountId);
                                        const f = funds.find((x) => x.id === l.fundId);
                                        return (_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("span", { children: [acct?.code, " ", acct?.name, " (", f?.code, ") ", l.description ? `— ${l.description}` : ''] }), _jsx("span", { className: "font-mono", children: l.debitAmountGhs > 0n
                                                        ? `Dr ${formatMoney(money(l.debitAmountGhs, 'GHS'))}`
                                                        : `Cr ${formatMoney(money(l.creditAmountGhs, 'GHS'))}` })] }, l.id));
                                    }) })] }, entry.id))) })] }), reversalTargetId && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4", children: _jsxs("div", { className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-900 dark:text-white space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { className: "flex items-center gap-2 font-bold text-base text-purple-600 dark:text-purple-400", children: [_jsx(ArrowRightLeft, { className: "w-5 h-5" }), _jsx("span", { children: "Create Linked Reversal Entry" })] }), _jsx("button", { onClick: () => setReversalTargetId(null), className: "text-slate-400 hover:text-slate-600 p-1", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: "Because accounting ledgers are strictly append-only, entries are never edited or deleted. This will create an exact mirror entry with inverted debits and credits, netting the original entry to zero." }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1", children: "Reason for Reversal (Required for Audit Trail)" }), _jsx("textarea", { value: reversalReason, onChange: (e) => setReversalReason(e.target.value), placeholder: "e.g., Erroneous account posted by counter, duplicate receipt, or bank reconciliation adjustment...", rows: 3, required: true, className: "w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { type: "button", onClick: () => setReversalTargetId(null), className: "px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 rounded text-xs font-medium", children: "Cancel" }), _jsx("button", { type: "button", onClick: handleExecuteReversal, disabled: !reversalReason.trim(), className: "px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold shadow disabled:opacity-50", children: "Confirm & Post Reversal" })] })] }) }))] }));
};
