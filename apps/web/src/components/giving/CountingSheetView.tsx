import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useGiving } from '../../context/GivingContext.js';
import type {
  ServiceType,
  CashDenominationCount,
  ChequeRecord,
  MoMoRecord,
  FundAllocationLine,
  MoMoNetwork,
  CountingSheet,
} from '@church/domain';
import {
  GHS_STANDARD_DENOMINATIONS,
  USD_STANDARD_DENOMINATIONS,
  calculateDenominationTotal,
  calculateChequeTotal,
  calculateMomoTotal,
} from '@church/domain';
import {
  Calculator,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Users2,
  Banknote,
  Smartphone,
  Eye,
  X,
} from 'lucide-react';

export const CountingSheetView: React.FC = () => {
  const { currentUser } = useAuth();
  const { countingSheets, submitCountingSheet, signDraftCountingSheet } = useGiving();

  const [activeTab, setActiveTab] = useState<'NEW_SHEET' | 'HISTORY'>('NEW_SHEET');

  // New Counting Sheet State
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState<ServiceType>('Sunday 1st Service');

  // Cash Denominations
  const [ghsCounts, setGhsCounts] = useState<{ [denom: number]: number }>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
    0.5: 0,
    0.2: 0,
    0.1: 0,
  });

  const [usdCounts, setUsdCounts] = useState<{ [denom: number]: number }>({
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });

  // Cheques
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [newDrawer, setNewDrawer] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newChequeNum, setNewChequeNum] = useState('');
  const [newChequeAmtGhs, setNewChequeAmtGhs] = useState('');

  // MoMo
  const [momoList, setMomoList] = useState<MoMoRecord[]>([]);
  const [newMomoNet, setNewMomoNet] = useState<MoMoNetwork>('MTN');
  const [newMomoSender, setNewMomoSender] = useState('');
  const [newMomoRef, setNewMomoRef] = useState('');
  const [newMomoAmtGhs, setNewMomoAmtGhs] = useState('');

  // Fund Allocations
  const [allocTitheGhs, setAllocTitheGhs] = useState<string>('');
  const [allocOfferingGhs, setAllocOfferingGhs] = useState<string>('');
  const [allocBuildingGhs, setAllocBuildingGhs] = useState<string>('');
  const [allocMissionsGhs, setAllocMissionsGhs] = useState<string>('');

  // Two-Counter Signatures
  const [counter1Id, setCounter1Id] = useState('user-0003-counter');
  const [counter1Name, setCounter1Name] = useState('Sister Grace Addo (Counter 1)');
  const [counter2Id, setCounter2Id] = useState('user-0004-counter2');
  const [counter2Name, setCounter2Name] = useState('Brother Emmanuel Ofori (Counter 2)');

  // Selected sheet for details view
  const [selectedSheet, setSelectedSheet] = useState<CountingSheet | null>(null);

  // Status message
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Computed Totals
  const cashDenomArrayGhs: CashDenominationCount[] = Object.entries(ghsCounts).map(
    ([denom, count]) => ({ denomination: parseFloat(denom), count })
  );
  const totalCashGhsPesewas = calculateDenominationTotal(cashDenomArrayGhs);

  const cashDenomArrayUsd: CashDenominationCount[] = Object.entries(usdCounts).map(
    ([denom, count]) => ({ denomination: parseFloat(denom), count })
  );
  const totalCashUsdCents = calculateDenominationTotal(cashDenomArrayUsd);

  const totalChequesGhsPesewas = calculateChequeTotal(cheques);
  const totalMomoGhsPesewas = calculateMomoTotal(momoList);

  const grandTotalGhsPesewas =
    totalCashGhsPesewas + totalChequesGhsPesewas + totalMomoGhsPesewas;

  // Add Cheque Handler
  const handleAddCheque = () => {
    const amt = parseFloat(newChequeAmtGhs);
    if (!newDrawer.trim() || !newBank.trim() || isNaN(amt) || amt <= 0) {
      alert('Please enter valid drawer, bank, and cheque amount.');
      return;
    }
    const newCheque: ChequeRecord = {
      id: `chq-${Date.now()}`,
      drawerName: newDrawer.trim(),
      bankName: newBank.trim(),
      chequeNumber: newChequeNum.trim() || 'N/A',
      amountPesewas: BigInt(Math.round(amt * 100)),
      currency: 'GHS',
    };
    setCheques([...cheques, newCheque]);
    setNewDrawer('');
    setNewBank('');
    setNewChequeNum('');
    setNewChequeAmtGhs('');
  };

  // Add MoMo Handler
  const handleAddMomo = () => {
    const amt = parseFloat(newMomoAmtGhs);
    if (!newMomoSender.trim() || !newMomoRef.trim() || isNaN(amt) || amt <= 0) {
      alert('Please enter valid sender name, reference, and amount.');
      return;
    }
    const newMomo: MoMoRecord = {
      id: `mo-${Date.now()}`,
      network: newMomoNet,
      senderName: newMomoSender.trim(),
      transactionReference: newMomoRef.trim(),
      amountPesewas: BigInt(Math.round(amt * 100)),
    };
    setMomoList([...momoList, newMomo]);
    setNewMomoSender('');
    setNewMomoRef('');
    setNewMomoAmtGhs('');
  };

  // Quick Allocate Remainder
  const handleAutoAllocate = () => {
    // If no manual entries yet, put 50% to tithe, 50% to offering
    const half = grandTotalGhsPesewas / 2n;
    const remainder = grandTotalGhsPesewas - half;
    setAllocTitheGhs((Number(half) / 100).toFixed(2));
    setAllocOfferingGhs((Number(remainder) / 100).toFixed(2));
    setAllocBuildingGhs('0.00');
    setAllocMissionsGhs('0.00');
  };

  // Submit and Post Counting Sheet Handler
  const handleSubmitSheet = () => {
    setErrorMessage(null);
    setPostSuccess(null);

    // Validate two distinct counters
    if (!counter1Id || !counter2Id || counter1Id === counter2Id) {
      setErrorMessage(
        'Dual-Control Rule Violation: Two distinct counters must sign off the counting sheet.'
      );
      return;
    }

    if (grandTotalGhsPesewas <= 0n && totalCashUsdCents <= 0n) {
      setErrorMessage('Counting sheet is empty. Please enter cash, cheque, or MoMo amounts.');
      return;
    }

    // Build allocations
    const tGhs = BigInt(Math.round((parseFloat(allocTitheGhs) || 0) * 100));
    const oGhs = BigInt(Math.round((parseFloat(allocOfferingGhs) || 0) * 100));
    const bGhs = BigInt(Math.round((parseFloat(allocBuildingGhs) || 0) * 100));
    const mGhs = BigInt(Math.round((parseFloat(allocMissionsGhs) || 0) * 100));

    const totalAlloc = tGhs + oGhs + bGhs + mGhs;
    if (totalAlloc !== grandTotalGhsPesewas) {
      setErrorMessage(
        `Allocation mismatch: Total collection is GHS ${(Number(grandTotalGhsPesewas) / 100).toFixed(2)}, but total allocated is GHS ${(Number(totalAlloc) / 100).toFixed(2)}.`
      );
      return;
    }

    const allocations: FundAllocationLine[] = [
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe' as const, amountPesewas: tGhs, currency: 'GHS' as const },
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering' as const, amountPesewas: oGhs, currency: 'GHS' as const },
      { fundId: 'fund-bld', fundName: 'Building Fund', category: 'Building Pledge' as const, amountPesewas: bGhs, currency: 'GHS' as const },
      { fundId: 'fund-mis', fundName: 'Missions & Outreach', category: 'Special Offering' as const, amountPesewas: mGhs, currency: 'GHS' as const },
    ].filter((a) => a.amountPesewas > 0n);

    try {
      const res = submitCountingSheet({
        serviceDate,
        serviceType,
        cashGhs: cashDenomArrayGhs,
        cashUsd: cashDenomArrayUsd,
        cheques,
        momo: momoList,
        allocations,
        firstCounterId: counter1Id,
        firstCounterName: counter1Name,
        secondCounterId: counter2Id,
        secondCounterName: counter2Name,
      });

      setPostSuccess(
        `Counting Sheet ${res.sheet.sheetNumber} signed off by ${counter1Name} and ${counter2Name}. Balanced Journal Entry posted to General Ledger!`
      );

      // Reset form
      setCheques([]);
      setMomoList([]);
      setAllocTitheGhs('');
      setAllocOfferingGhs('');
      setAllocBuildingGhs('');
      setAllocMissionsGhs('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Weekly Counting Sheet (Service-Day Collections)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cash breakdown, cheques, MoMo, fund allocations, and dual-counter sign-off.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('NEW_SHEET')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'NEW_SHEET'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>New Counting Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'HISTORY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Past Sheets ({countingSheets.length})</span>
          </button>
        </div>
      </div>

      {postSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-emerald-950 dark:text-emerald-100">Counting Sheet Posted Successfully</p>
            <p className="mt-0.5">{postSuccess}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-950 dark:text-rose-100">Verification Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* NEW COUNTING SHEET TAB */}
      {activeTab === 'NEW_SHEET' && (
        <div className="space-y-6">
          {/* 1. Service Meta */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
              <span>Service Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Service Date
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Service Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as ServiceType)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="Sunday 1st Service">Sunday 1st Service</option>
                  <option value="Sunday 2nd Service">Sunday 2nd Service</option>
                  <option value="Midweek Service">Midweek Service</option>
                  <option value="Youth Service">Youth Service</option>
                  <option value="Special Thanksgiving">Special Thanksgiving</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Cash Denomination Counting (GHS & USD) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Cash Denomination Count</span>
              </h3>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Cash Total: GHS {(Number(totalCashGhsPesewas) / 100).toFixed(2)}
                {totalCashUsdCents > 0n && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    + USD ${(Number(totalCashUsdCents) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* GHS Denominations Grid */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Ghana Cedis (GHS) Notes & Coins
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {GHS_STANDARD_DENOMINATIONS.map((denom) => {
                  const count = ghsCounts[denom] || 0;
                  const linePesewas = BigInt(Math.round(denom * 100)) * BigInt(count);
                  return (
                    <div
                      key={denom}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span>{denom >= 1 ? `GHS ${denom}` : `${denom * 100}p`}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          = {(Number(linePesewas) / 100).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={count === 0 ? '' : count}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setGhsCounts({ ...ghsCounts, [denom]: Math.max(0, val) });
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* USD Denominations Grid */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                United States Dollars (USD) Banknotes
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {USD_STANDARD_DENOMINATIONS.map((denom) => {
                  const count = usdCounts[denom] || 0;
                  const lineCents = BigInt(denom * 100) * BigInt(count);
                  return (
                    <div
                      key={denom}
                      className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 space-y-1"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-blue-900 dark:text-blue-300">
                        <span>${denom}</span>
                        <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">
                          = ${(Number(lineCents) / 100).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={count === 0 ? '' : count}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setUsdCounts({ ...usdCounts, [denom]: Math.max(0, val) });
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-center font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Cheques & Mobile Money Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cheques Column */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                  <span>Cheques ({cheques.length})</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  GHS {(Number(totalChequesGhsPesewas) / 100).toFixed(2)}
                </span>
              </div>

              {/* Add Cheque Form */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Drawer Name"
                    value={newDrawer}
                    onChange={(e) => setNewDrawer(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Bank (e.g. GCB, Ecobank)"
                    value={newBank}
                    onChange={(e) => setNewBank(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Cheque No."
                    value={newChequeNum}
                    onChange={(e) => setNewChequeNum(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (GHS)"
                    value={newChequeAmtGhs}
                    onChange={(e) => setNewChequeAmtGhs(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <button
                  onClick={handleAddCheque}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cheque</span>
                </button>
              </div>

              {/* Cheque List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {cheques.map((c, idx) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{c.drawerName}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.bankName} • #{c.chequeNumber}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        GHS {(Number(c.amountPesewas) / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => setCheques(cheques.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Money Column */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  <span>Mobile Money ({momoList.length})</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  GHS {(Number(totalMomoGhsPesewas) / 100).toFixed(2)}
                </span>
              </div>

              {/* Add MoMo Form */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newMomoNet}
                    onChange={(e) => setNewMomoNet(e.target.value as MoMoNetwork)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  >
                    <option value="MTN">MTN MoMo</option>
                    <option value="VODAFONE">Telecel Cash</option>
                    <option value="AIRTELTIGO">AirtelTigo Money</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Sender Name"
                    value={newMomoSender}
                    onChange={(e) => setNewMomoSender(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Transaction Reference"
                    value={newMomoRef}
                    onChange={(e) => setNewMomoRef(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (GHS)"
                    value={newMomoAmtGhs}
                    onChange={(e) => setNewMomoAmtGhs(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <button
                  onClick={handleAddMomo}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add MoMo Transfer</span>
                </button>
              </div>

              {/* MoMo List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {momoList.map((m, idx) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {m.senderName} ({m.network})
                      </div>
                      <div className="text-[11px] text-slate-500">Ref: {m.transactionReference}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        GHS {(Number(m.amountPesewas) / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => setMomoList(momoList.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Fund Allocation Breakdown */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">5</span>
                <span>Fund Allocation Breakdown</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Target: <strong className="text-slate-900 dark:text-white font-mono">GHS {(Number(grandTotalGhsPesewas) / 100).toFixed(2)}</strong>
                </span>
                <button
                  onClick={handleAutoAllocate}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium"
                >
                  Quick Allocate (50/50)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tithes (General Fund)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={allocTitheGhs}
                  onChange={(e) => setAllocTitheGhs(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  General Offerings
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={allocOfferingGhs}
                  onChange={(e) => setAllocOfferingGhs(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Building Project
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={allocBuildingGhs}
                  onChange={(e) => setAllocBuildingGhs(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Missions & Outreach
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={allocMissionsGhs}
                  onChange={(e) => setAllocMissionsGhs(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 5. Dual-Counter Sign-off Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-900 text-white shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <Users2 className="w-5 h-5" />
              <span>Two-Counter Digital Sign-Off (Dual Control Enforcement)</span>
            </div>
            <p className="text-xs text-indigo-200">
              In accordance with church financial regulations, two distinct counters must certify and sign off service day collections before this sheet is posted to the general ledger.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Counter 1 */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <span className="text-xs font-semibold text-indigo-400">First Counter Signature</span>
                <select
                  value={counter1Id}
                  onChange={(e) => {
                    setCounter1Id(e.target.value);
                    if (e.target.value === 'user-0003-counter') setCounter1Name('Sister Grace Addo (Counter 1)');
                    if (e.target.value === 'user-0004-counter2') setCounter1Name('Brother Emmanuel Ofori (Counter 2)');
                    if (e.target.value === 'user-0001-treasurer') setCounter1Name('Elder Kofi Asante (Treasurer)');
                  }}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  <option value="user-0003-counter">Sister Grace Addo (Counter 1)</option>
                  <option value="user-0004-counter2">Brother Emmanuel Ofori (Counter 2)</option>
                  <option value="user-0001-treasurer">Elder Kofi Asante (Treasurer)</option>
                </select>
              </div>

              {/* Counter 2 */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <span className="text-xs font-semibold text-indigo-400">Second Counter Signature</span>
                <select
                  value={counter2Id}
                  onChange={(e) => {
                    setCounter2Id(e.target.value);
                    if (e.target.value === 'user-0004-counter2') setCounter2Name('Brother Emmanuel Ofori (Counter 2)');
                    if (e.target.value === 'user-0003-counter') setCounter2Name('Sister Grace Addo (Counter 1)');
                    if (e.target.value === 'user-0002-finsec') setCounter2Name('Sister Naomi Addo (Finance Secretary)');
                  }}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                >
                  <option value="user-0004-counter2">Brother Emmanuel Ofori (Counter 2)</option>
                  <option value="user-0003-counter">Sister Grace Addo (Counter 1)</option>
                  <option value="user-0002-finsec">Sister Naomi Addo (Finance Secretary)</option>
                </select>
              </div>
            </div>

            {/* Validation warning if same counter */}
            {counter1Id === counter2Id && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Violation: Counter 1 and Counter 2 cannot be the same person. Dual control required.</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSubmitSheet}
                disabled={counter1Id === counter2Id}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Sign Off & Post Counting Sheet to Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAST SHEETS HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Service Counting Sheets History</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5">Sheet No.</th>
                  <th className="p-2.5">Service Date & Type</th>
                  <th className="p-2.5">Counters</th>
                  <th className="p-2.5 text-right">Cash (GHS)</th>
                  <th className="p-2.5 text-right">Cheques / MoMo</th>
                  <th className="p-2.5 text-right">Total Collections</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {countingSheets.map((sheet) => (
                  <tr key={sheet.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {sheet.sheetNumber}
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{sheet.serviceType}</div>
                      <div className="text-[11px] text-slate-500">{sheet.serviceDate}</div>
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      <div>1: {sheet.firstCounterName}</div>
                      <div>2: {sheet.secondCounterName}</div>
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-900 dark:text-white">
                      GHS {(Number(sheet.totalCashGhsPesewas) / 100).toFixed(2)}
                      {sheet.totalCashUsdCents > 0n && (
                        <div className="text-[10px] text-blue-500">
                          + ${(Number(sheet.totalCashUsdCents) / 100).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      GHS {(Number(sheet.totalChequesGhsPesewas + sheet.totalMomoGhsPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {(Number(sheet.grandTotalGhsPesewas) / 100).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          sheet.status === 'DRAFT'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {sheet.status === 'DRAFT' ? 'AWAITING 2ND SIGNATURE' : sheet.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedSheet(sheet)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sheet.status === 'DRAFT' && (
                          <button
                            onClick={() => {
                              try {
                                signDraftCountingSheet({
                                  sheetId: sheet.id,
                                  secondCounterId: currentUser.id,
                                  secondCounterName: currentUser.fullName,
                                });
                                setPostSuccess(
                                  `Counting Sheet ${sheet.sheetNumber} signed off by ${sheet.firstCounterName} and ${currentUser.fullName}. Balanced Journal Entry posted to General Ledger!`
                                );
                              } catch (err) {
                                setErrorMessage(err instanceof Error ? err.message : String(err));
                              }
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm"
                            title="Sign as Counter B and post to ledger"
                          >
                            Sign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sheet Details Modal */}
      {selectedSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="font-bold text-base text-blue-400 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Counting Sheet: {selectedSheet.sheetNumber}</span>
              </div>
              <button
                onClick={() => setSelectedSheet(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Service:</span>
                <span className="font-semibold text-white">
                  {selectedSheet.serviceType} ({selectedSheet.serviceDate})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">First Counter:</span>
                <span className="text-slate-200">{selectedSheet.firstCounterName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Second Counter:</span>
                <span className="text-slate-200">{selectedSheet.secondCounterName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Cash (GHS):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  GHS {(Number(selectedSheet.totalCashGhsPesewas) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Grand Total Collections:</span>
                <span className="font-mono text-emerald-400 font-black text-sm">
                  GHS {(Number(selectedSheet.grandTotalGhsPesewas) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              {selectedSheet.status === 'DRAFT' && (
                <button
                  onClick={() => {
                    try {
                      signDraftCountingSheet({
                        sheetId: selectedSheet.id,
                        secondCounterId: currentUser.id,
                        secondCounterName: currentUser.fullName,
                      });
                      setSelectedSheet(null);
                      setPostSuccess(
                        `Counting Sheet ${selectedSheet.sheetNumber} signed off by ${selectedSheet.firstCounterName} and ${currentUser.fullName}. Balanced Journal Entry posted to General Ledger!`
                      );
                    } catch (err) {
                      setErrorMessage(err instanceof Error ? err.message : String(err));
                    }
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Sign as Counter B ({currentUser.fullName}) &amp; Post to Ledger
                </button>
              )}
              <button
                onClick={() => setSelectedSheet(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
