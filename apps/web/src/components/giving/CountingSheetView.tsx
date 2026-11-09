import React, { useState, useRef, useEffect } from 'react';
import { useGiving } from '../../context/GivingContext.js';
import { useToast } from '../../context/ToastContext.js';
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
  convertLineToBaseCurrency,
} from '@church/domain';
import {
  AlertTriangle,
  Eye,
  X,
  Printer,
  Trash2,
} from 'lucide-react';
import { PrintableCountingSheetModal } from './PrintableCountingSheetModal.js';
import { EmptyState } from '../ui/EmptyState.js';
import { useModalEscape } from '../../utils/useModalEscape.js';
import { loadFromStore, saveToStore } from '../../utils/database.js';
import { useDemo } from '../../context/DemoContext.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { StatusDot } from '../ui/StatusDot.js';
import { DateInput } from '../ui/DateInput.js';
import { UnderlineTabs } from '../ui/UnderlineTabs.js';
import { formatDateWithWeekday, formatDate } from '../../config/churchSettings.js';

export interface CounterOption {
  id: string;
  name: string;
  isPermanent: boolean;
  role?: string;
}

export interface BankTransferItem {
  id: string;
  senderName: string;
  bankName: string;
  reference: string;
  amountPesewas: bigint;
}

export const DEFAULT_COUNTERS: CounterOption[] = [
  { id: 'user-0003-counter', name: 'Mabel Ankrah', isPermanent: true, role: 'Audit / Counter' },
  { id: 'user-0004-counter2', name: 'Emmanuel Ofori', isPermanent: true, role: 'Counter' },
  { id: 'user-0001-treasurer', name: 'Kofi Asante', isPermanent: true, role: 'Treasurer' },
  { id: 'user-0002-finsec', name: 'Naomi Addo', isPermanent: true, role: 'Finance Secretary' },
  { id: 'user-0005-deacon', name: 'Kwabena Acheampong', isPermanent: true, role: 'Deacon' },
  { id: 'user-0006-temp-guest', name: 'Kwame Mensah', isPermanent: false, role: 'Youth Leader (Temp)' },
];

export const CountingSheetView: React.FC = () => {
  const { isDemoMode } = useDemo();
  const { countingSheets, submitCountingSheet } = useGiving();
  const { showToast } = useToast();

  const [activeView, setActiveView] = useState<'ENTRY' | 'HISTORY'>('ENTRY');
  const [activeTab, setActiveTab] = useState<'GHS' | 'USD' | 'CHEQUES' | 'MOMO' | 'BANK_TRANSFER'>('GHS');
  const [printableSheet, setPrintableSheet] = useState<CountingSheet | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<CountingSheet | null>(null);
  const [postedSheet, setPostedSheet] = useState<CountingSheet | null>(null);

  useModalEscape(Boolean(selectedSheet), () => setSelectedSheet(null));

  // Service meta
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState<ServiceType>('Sunday Service');
  const [autosaveTime, setAutosaveTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  // Cash Denominations
  const [ghsCounts, setGhsCounts] = useState<{ [denom: number]: number }>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0, 0.2: 0, 0.1: 0,
  });

  const [usdCounts, setUsdCounts] = useState<{ [denom: number]: number }>({
    100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0,
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

  // Bank Transfers
  const [bankTransfers, setBankTransfers] = useState<BankTransferItem[]>([]);
  const [newBtSender, setNewBtSender] = useState('');
  const [newBtBank, setNewBtBank] = useState('');
  const [newBtRef, setNewBtRef] = useState('');
  const [newBtAmtGhs, setNewBtAmtGhs] = useState('');

  // Fund Allocations
  const [allocTitheGhs, setAllocTitheGhs] = useState<string>('');
  const [allocOfferingGhs, setAllocOfferingGhs] = useState<string>('');
  const [allocBuildingGhs, setAllocBuildingGhs] = useState<string>('');
  const [allocMissionsGhs, setAllocMissionsGhs] = useState<string>('');

  // Counters Management
  const [countersRoster, setCountersRoster] = useState<CounterOption[]>(() => {
    const loaded = loadFromStore<CounterOption[]>('church_counter_roster', false, DEFAULT_COUNTERS);
    return loaded.map((c) => {
      if (c.id === 'user-0003-counter' && (c.name.includes('Grace Addo') || c.name.includes('(Counter 1)'))) {
        return { ...c, name: 'Mabel Ankrah' };
      }
      if (c.id === 'user-0004-counter2' && (c.name.includes('Brother Emmanuel') || c.name.includes('(Counter 2)'))) {
        return { ...c, name: 'Emmanuel Ofori' };
      }
      return c;
    });
  });

  const [counter1Id, setCounter1Id] = useState('user-0003-counter');
  const [counter1Name, setCounter1Name] = useState('Mabel Ankrah');
  const [counter1Time] = useState(() => '12:48');

  const [counter2Id, setCounter2Id] = useState('user-0004-counter2');
  const [counter2Name, setCounter2Name] = useState('Emmanuel Ofori');
  const [counter2Time] = useState(() => '12:51');

  const [counter1Manual, setCounter1Manual] = useState(false);
  const [counter2Manual, setCounter2Manual] = useState(false);

  // Dynamic Multi-Counter Support (Counter 3, 4, 5+ for large counting committees)
  interface ActiveSheetCounter {
    id: string;
    name: string;
    isPermanent: boolean;
    role?: string;
    time: string;
    isManual?: boolean;
  }
  const [additionalCounters, setAdditionalCounters] = useState<ActiveSheetCounter[]>([]);

  const handleAddCounterToSheet = () => {
    const alreadyUsedIds = new Set([
      counter1Id,
      counter2Id,
      ...additionalCounters.map((c) => c.id),
    ]);
    const available = countersRoster.find((c) => !alreadyUsedIds.has(c.id));

    if (available) {
      setAdditionalCounters((prev) => [
        ...prev,
        {
          id: available.id,
          name: available.name,
          isPermanent: available.isPermanent,
          role: available.role,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isManual: false,
        },
      ]);
    } else {
      setAdditionalCounters((prev) => [
        ...prev,
        {
          id: `counter-extra-${Date.now()}`,
          name: '',
          isPermanent: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isManual: true,
        },
      ]);
    }
  };

  const handleRemoveAdditionalCounter = (index: number) => {
    setAdditionalCounters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAdditionalCounter = (
    index: number,
    updates: Partial<ActiveSheetCounter>
  ) => {
    setAdditionalCounters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  // Counter Modals & Form State
  const [showAddCounterModal, setShowAddCounterModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [addCounterTargetSlot, setAddCounterTargetSlot] = useState<'COUNTER1' | 'COUNTER2' | 'NONE'>('NONE');
  const [newCounterName, setNewCounterName] = useState('');
  const [newCounterType, setNewCounterType] = useState<'PERMANENT' | 'TEMPORARY'>('PERMANENT');
  const [newCounterRole, setNewCounterRole] = useState('');
  const [addCounterError, setAddCounterError] = useState<string | null>(null);

  useModalEscape(showAddCounterModal, () => setShowAddCounterModal(false));
  useModalEscape(showRosterModal, () => setShowRosterModal(false));

  const openAddCounterModal = (slot: 'COUNTER1' | 'COUNTER2' | 'NONE' = 'NONE') => {
    setAddCounterTargetSlot(slot);
    setNewCounterName('');
    setNewCounterType(slot === 'NONE' ? 'PERMANENT' : 'TEMPORARY');
    setNewCounterRole('');
    setAddCounterError(null);
    setShowAddCounterModal(true);
  };

  const handleSaveNewCounter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCounterName.trim();
    if (!trimmed) {
      setAddCounterError("Please enter the counter's full name.");
      return;
    }
    const isDuplicate = countersRoster.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setAddCounterError('A counter with this name already exists in the roster.');
      return;
    }

    const isPermanent = newCounterType === 'PERMANENT';
    const newOption: CounterOption = {
      id: `counter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      isPermanent,
      role: newCounterRole.trim() || undefined,
    };

    const updated = [...countersRoster, newOption];
    setCountersRoster(updated);
    saveToStore('church_counter_roster', isDemoMode, updated);

    if (addCounterTargetSlot === 'COUNTER1') {
      setCounter1Id(newOption.id);
      setCounter1Name(newOption.name);
      setCounter1Manual(false);
    } else if (addCounterTargetSlot === 'COUNTER2') {
      setCounter2Id(newOption.id);
      setCounter2Name(newOption.name);
      setCounter2Manual(false);
    }

    setShowAddCounterModal(false);
    setNewCounterName('');
    setNewCounterRole('');
    setAddCounterError(null);
  };

  const handleDeleteCounter = (id: string) => {
    if (counter1Id === id || counter2Id === id) {
      alert('Cannot remove a counter currently assigned to this sheet. Change the assigned counter first.');
      return;
    }
    const updated = countersRoster.filter((c) => c.id !== id);
    setCountersRoster(updated);
    saveToStore('church_counter_roster', isDemoMode, updated);
  };

  const handleToggleCounterPermanence = (id: string) => {
    const updated = countersRoster.map((c) =>
      c.id === id ? { ...c, isPermanent: !c.isPermanent } : c
    );
    setCountersRoster(updated);
    saveToStore('church_counter_roster', isDemoMode, updated);
  };

  const selectedCounter1 = countersRoster.find((c) => c.id === counter1Id);
  const isCounter1Permanent = counter1Manual ? false : selectedCounter1?.isPermanent ?? true;

  const selectedCounter2 = countersRoster.find((c) => c.id === counter2Id);
  const isCounter2Permanent = counter2Manual ? false : selectedCounter2?.isPermanent ?? true;

  // Status message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keyboard navigation input refs
  const ghsInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const usdInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update autosave indicator periodically on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAutosaveTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 400);
    return () => clearTimeout(timer);
  }, [ghsCounts, usdCounts, cheques, momoList, bankTransfers, allocTitheGhs, allocOfferingGhs, allocBuildingGhs, allocMissionsGhs]);

  const usdRate = '15.5000';

  // Computed totals
  const cashDenomArrayGhs: CashDenominationCount[] = Object.entries(ghsCounts).map(
    ([denom, count]) => ({ denomination: parseFloat(denom), count })
  );
  const totalCashGhsPesewas = calculateDenominationTotal(cashDenomArrayGhs);

  const cashDenomArrayUsd: CashDenominationCount[] = Object.entries(usdCounts).map(
    ([denom, count]) => ({ denomination: parseFloat(denom), count })
  );
  const totalCashUsdCents = calculateDenominationTotal(cashDenomArrayUsd);

  const usdConversion =
    totalCashUsdCents > 0n
      ? convertLineToBaseCurrency(totalCashUsdCents, 'USD', usdRate)
      : { baseAmountGhs: 0n, exchangeRate: usdRate, roundingDifference: 0n };
  const totalCashUsdInGhsPesewas = usdConversion.baseAmountGhs;

  const totalChequesGhsPesewas = calculateChequeTotal(cheques);
  const totalMomoGhsPesewas = calculateMomoTotal(momoList);
  const totalBankTransfersPesewas = bankTransfers.reduce((acc, bt) => acc + bt.amountPesewas, 0n);

  const grandTotalGhsPesewas =
    totalCashGhsPesewas +
    totalCashUsdInGhsPesewas +
    totalChequesGhsPesewas +
    totalMomoGhsPesewas +
    totalBankTransfersPesewas;

  // Live Allocation Totals
  const tGhs = BigInt(Math.round((parseFloat(allocTitheGhs) || 0) * 100));
  const oGhs = BigInt(Math.round((parseFloat(allocOfferingGhs) || 0) * 100));
  const bGhs = BigInt(Math.round((parseFloat(allocBuildingGhs) || 0) * 100));
  const mGhs = BigInt(Math.round((parseFloat(allocMissionsGhs) || 0) * 100));

  const totalAllocatedPesewas = tGhs + oGhs + bGhs + mGhs;
  const allocationDifference = grandTotalGhsPesewas - totalAllocatedPesewas;

  // Handlers
  const handleAddCheque = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newChequeAmtGhs);
    if (!newDrawer.trim() || !newBank.trim() || isNaN(amt) || amt <= 0) return;
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

  const handleAddMomo = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newMomoAmtGhs);
    if (!newMomoSender.trim() || !newMomoRef.trim() || isNaN(amt) || amt <= 0) return;
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

  const handleAddBankTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newBtAmtGhs);
    if (!newBtSender.trim() || !newBtBank.trim() || isNaN(amt) || amt <= 0) return;
    const newBt: BankTransferItem = {
      id: `bt-${Date.now()}`,
      senderName: newBtSender.trim(),
      bankName: newBtBank.trim(),
      reference: newBtRef.trim() || 'TRANSFER',
      amountPesewas: BigInt(Math.round(amt * 100)),
    };
    setBankTransfers([...bankTransfers, newBt]);
    setNewBtSender('');
    setNewBtBank('');
    setNewBtRef('');
    setNewBtAmtGhs('');
  };

  const handleAutoAllocate = () => {
    const half = grandTotalGhsPesewas / 2n;
    const remainder = grandTotalGhsPesewas - half;
    setAllocTitheGhs((Number(half) / 100).toFixed(2));
    setAllocOfferingGhs((Number(remainder) / 100).toFixed(2));
    setAllocBuildingGhs('0.00');
    setAllocMissionsGhs('0.00');
  };

  const handleAutoBalanceRemainder = () => {
    if (allocationDifference <= 0n) return;
    const currentOffering = parseFloat(allocOfferingGhs) || 0;
    const remainderGhs = Number(allocationDifference) / 100;
    setAllocOfferingGhs((currentOffering + remainderGhs).toFixed(2));
  };

  // Submit and Post Counting Sheet Handler
  const handleSubmitSheet = () => {
    setErrorMessage(null);

    const c1Clean = counter1Name.trim().toLowerCase();
    const c2Clean = counter2Name.trim().toLowerCase();
    if (!c1Clean || !c2Clean || counter1Id === counter2Id || c1Clean === c2Clean) {
      setErrorMessage(
        'Dual-Control Rule Violation: Two distinct counters must sign off the counting sheet. The two signers cannot be the same person.'
      );
      return;
    }

    if (grandTotalGhsPesewas <= 0n && totalCashUsdCents <= 0n) {
      setErrorMessage('Counting sheet total cannot be zero. Enter collections before signing.');
      return;
    }

    if (totalAllocatedPesewas !== grandTotalGhsPesewas) {
      const diffFormatted = (Math.abs(Number(allocationDifference)) / 100).toFixed(2);
      setErrorMessage(
        `Total allocated does not equal total collections. Difference: GHS ${diffFormatted}.`
      );
      return;
    }

    const allocations: FundAllocationLine[] = [
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe' as const, amountPesewas: tGhs, currency: 'GHS' as const },
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering' as const, amountPesewas: oGhs, currency: 'GHS' as const },
      { fundId: 'fund-bld', fundName: 'Building Fund', category: 'Building Pledge' as const, amountPesewas: bGhs, currency: 'GHS' as const },
      { fundId: 'fund-mis', fundName: 'Missions & Outreach', category: 'Special Offering' as const, amountPesewas: mGhs, currency: 'GHS' as const },
    ].filter((a) => a.amountPesewas > 0n);

    // Merge bank transfers into cheques with a distinct chequeNumber prefix so they post to Account 1030
    const consolidatedCheques: ChequeRecord[] = [
      ...cheques,
      ...bankTransfers.map((bt) => ({
        id: bt.id,
        drawerName: bt.senderName,
        bankName: bt.bankName,
        chequeNumber: `TRF-${bt.reference}`,
        amountPesewas: bt.amountPesewas,
        currency: 'GHS' as const,
      })),
    ];

    const allCountersSignOff = [
      {
        id: counter1Id,
        name: counter1Name,
        isPermanent: isCounter1Permanent,
        signedAt: new Date().toISOString(),
      },
      {
        id: counter2Id,
        name: counter2Name,
        isPermanent: isCounter2Permanent,
        signedAt: new Date().toISOString(),
      },
      ...additionalCounters.map((ac) => ({
        id: ac.id,
        name: ac.name,
        isPermanent: ac.isPermanent,
        role: ac.role,
        signedAt: new Date().toISOString(),
      })),
    ];

    try {
      const res = submitCountingSheet({
        serviceDate,
        serviceType,
        cashGhs: cashDenomArrayGhs,
        cashUsd: cashDenomArrayUsd,
        cheques: consolidatedCheques,
        momo: momoList,
        allocations,
        firstCounterId: counter1Id,
        firstCounterName: counter1Name,
        secondCounterId: counter2Id,
        secondCounterName: counter2Name,
        counters: allCountersSignOff,
        exchangeRateUsd: usdRate,
      });

      setPostedSheet(res.sheet);

      showToast({
        message: 'Counting sheet posted.',
        action: {
          label: 'View entry',
          onClick: () => setSelectedSheet(res.sheet),
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStartNewSheet = () => {
    setPostedSheet(null);
    setCheques([]);
    setMomoList([]);
    setBankTransfers([]);
    setAllocTitheGhs('');
    setAllocOfferingGhs('');
    setAllocBuildingGhs('');
    setAllocMissionsGhs('');
    setGhsCounts({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0, 0.2: 0, 0.1: 0 });
    setUsdCounts({ 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    setErrorMessage(null);
    setAdditionalCounters([]);
  };

  const allActiveCounters = [
    { id: counter1Id, name: counter1Name.trim() },
    { id: counter2Id, name: counter2Name.trim() },
    ...additionalCounters.map((c) => ({ id: c.id, name: c.name.trim() })),
  ];
  const allActiveCounterNames = allActiveCounters.map((c) => c.name.toLowerCase()).filter(Boolean);
  const allActiveCounterIds = allActiveCounters.map((c) => c.id).filter(Boolean);

  const hasDuplicateCounters =
    new Set(allActiveCounterNames).size !== allActiveCounterNames.length ||
    new Set(allActiveCounterIds).size !== allActiveCounterIds.length;
  const hasEmptyCounter = allActiveCounters.some((c) => !c.name);

  const isSignDisabled =
    grandTotalGhsPesewas === 0n ||
    allocationDifference !== 0n ||
    hasEmptyCounter ||
    hasDuplicateCounters;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 min-[1100px]:pb-8">
      {/* 1. Header: Plain text, single surface, date format '02 Nov 2026', service type, counters, autosave state */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
              Counting sheet
            </h1>
            {postedSheet && (
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                <span>
                  Posted to general ledger as {postedSheet.sheetNumber} · Signed by{' '}
                  {postedSheet.counters && postedSheet.counters.length > 0
                    ? postedSheet.counters.map((c) => c.name).join(', ')
                    : `${postedSheet.firstCounterName} ${counter1Time} and ${postedSheet.secondCounterName} ${counter2Time}`}
                </span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setSelectedSheet(postedSheet)}
                  className="text-slate-900 dark:text-white font-medium underline hover:opacity-80"
                >
                  View entry
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            {!postedSheet && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Draft saved {autosaveTime}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'ENTRY' ? 'HISTORY' : 'ENTRY')}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              {activeView === 'ENTRY' ? (
                <>
                  Past sheets <span className="text-slate-400 dark:text-slate-500 font-normal">({countingSheets.length})</span>
                </>
              ) : (
                'New entry'
              )}
            </button>
          </div>
        </div>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500">Service:</span>
            {postedSheet ? (
              <span className="font-medium text-slate-900 dark:text-white">{serviceType}</span>
            ) : (
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="bg-transparent font-medium text-slate-900 dark:text-white border-0 p-0 pr-4 focus:ring-0 cursor-pointer"
              >
                <option value="Sunday Service">Sunday Service</option>
                <option value="Midweek Service (Wednesday Evening)">Midweek Service (Wednesday Evening)</option>
                <option value="Grace Thursday">Grace Thursday</option>
                <option value="Friday Evening Service">Friday Evening Service</option>
                <option value="Special Thanksgiving">Special Thanksgiving</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500">Date:</span>
            {postedSheet ? (
              <span className="font-medium text-slate-900 dark:text-white">{formatDateWithWeekday(serviceDate)}</span>
            ) : (
              <DateInput
                value={serviceDate}
                onChange={(val) => setServiceDate(val)}
                showWeekday={true}
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 dark:text-slate-500">Counters:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {counter1Name} <span className="text-slate-400 font-normal text-[11px]">({isCounter1Permanent ? 'Permanent' : 'Temporary'})</span>
              {' '}·{' '}
              {counter2Name} <span className="text-slate-400 font-normal text-[11px]">({isCounter2Permanent ? 'Permanent' : 'Temporary'})</span>
              {additionalCounters.map((ac) => (
                <span key={ac.id}>
                  {' '}·{' '}
                  {ac.name} <span className="text-slate-400 font-normal text-[11px]">({ac.isPermanent ? 'Permanent' : 'Temporary'})</span>
                </span>
              ))}
            </span>
            {!postedSheet && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRosterModal(true)}
                  className="ml-1 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white underline font-medium"
                >
                  Roster
                </button>
                <button
                  type="button"
                  onClick={() => openAddCounterModal('NONE')}
                  className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline font-medium"
                >
                  + Add
                </button>
              </>
            )}
          </div>

          {postedSheet && (
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSheet(postedSheet)}
                className="text-xs font-medium text-slate-900 dark:text-white underline hover:opacity-80"
              >
                View journal entry
              </button>
              <button
                type="button"
                onClick={() => setPrintableSheet(postedSheet)}
                className="text-xs font-medium text-slate-900 dark:text-white underline hover:opacity-80 flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print sheet</span>
              </button>
              <button
                type="button"
                onClick={handleStartNewSheet}
                className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-[4px] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                Start new sheet
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="py-2.5 px-3 rounded-[6px] border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeView === 'HISTORY' ? (
        /* History View */
        <div className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Past counting sheets</h2>
          </div>

          {countingSheets.length === 0 ? (
            <EmptyState
              message="No service counting sheets recorded yet."
              actionLabel="Start new sheet"
              onAction={() => setActiveView('ENTRY')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3 font-normal">Sheet number</th>
                    <th className="py-2 px-3 font-normal">Date &amp; service</th>
                    <th className="py-2 px-3 font-normal">Counters</th>
                    <th className="py-2 px-3 font-normal text-right">Cash (GH₵)</th>
                    <th className="py-2 px-3 font-normal text-right">Total collections (GH₵)</th>
                    <th className="py-2 px-3 font-normal text-center">Status</th>
                    <th className="py-2 px-3 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {countingSheets.map((sheet) => (
                    <tr key={sheet.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                        {sheet.sheetNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{sheet.serviceType}</div>
                        <div className="text-[11px] text-slate-400">{formatDate(sheet.serviceDate)}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {sheet.firstCounterName}, {sheet.secondCounterName}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <MoneyCell amountPesewas={sheet.totalCashGhsPesewas} currency="GH₵" align="right" />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                        <MoneyCell amountPesewas={sheet.grandTotalGhsPesewas} currency="GH₵" align="right" />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusDot status="posted" label={sheet.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSheet(sheet)}
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintableSheet(sheet)}
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* 2. Two-Column Layout: Left = Entry Area, Right = Sticky Summary Panel */
        <div className="grid grid-cols-1 min-[1100px]:grid-cols-[1fr_360px] gap-8 items-start">
          {/* LEFT: Entry Area */}
          <div className="space-y-6">
            {/* 3. Underline Tabs */}
            <UnderlineTabs
              tabs={[
                { id: 'GHS', label: 'GH₵ cash', ariaLabel: 'GHS cash' },
                { id: 'USD', label: 'USD cash' },
                { id: 'CHEQUES', label: 'Cheques', count: cheques.length },
                { id: 'MOMO', label: 'MoMo', count: momoList.length },
                { id: 'BANK_TRANSFER', label: 'Bank transfer', count: bankTransfers.length },
              ]}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
            />

            {/* TAB CONTENT */}

            {/* 1. GHS Cash Table */}
            {activeTab === 'GHS' && (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 font-normal">Denomination</th>
                      <th className="py-2 px-3 text-right font-normal">Quantity</th>
                      <th className="py-2 px-3 text-right font-normal">Amount (GH₵)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {GHS_STANDARD_DENOMINATIONS.map((denom, idx) => {
                      const count = ghsCounts[denom] || 0;
                      const linePesewas = BigInt(Math.round(denom * 100)) * BigInt(count);
                      return (
                        <tr key={denom} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-medium">
                            {denom >= 1 ? `GH₵ ${denom}` : `${denom * 100}p`}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {postedSheet ? (
                              <span className="tabular-nums font-normal text-slate-900 dark:text-slate-100">
                                {count > 0 ? count : <span className="text-slate-400 dark:text-slate-600">—</span>}
                              </span>
                            ) : (
                              <input
                                ref={(el) => (ghsInputRefs.current[idx] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                aria-label={`Quantity for GHS ${denom}`}
                                data-testid={`qty-ghs-${denom}`}
                                value={count === 0 ? '' : count}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    ghsInputRefs.current[idx + 1]?.focus();
                                    ghsInputRefs.current[idx + 1]?.select();
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  if (val === '' || /^\d+$/.test(val)) {
                                    setGhsCounts({ ...ghsCounts, [denom]: val === '' ? 0 : parseInt(val, 10) });
                                  }
                                }}
                                className="w-24 px-2 py-1 text-right text-sm border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {linePesewas > 0n ? (
                              <MoneyCell amountPesewas={linePesewas} currency="GH₵" showCurrency={false} align="right" />
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                      <td className="py-2.5 px-3 text-slate-900 dark:text-white">Subtotal</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {Object.values(ghsCounts).reduce((a, b) => a + b, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <MoneyCell
                          amountPesewas={totalCashGhsPesewas}
                          currency="GH₵"
                          showCurrency={true}
                          align="right"
                          className="font-semibold text-slate-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 2. USD Cash Table */}
            {activeTab === 'USD' && (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 font-normal">Denomination</th>
                      <th className="py-2 px-3 text-right font-normal">Quantity</th>
                      <th className="py-2 px-3 text-right font-normal">Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {USD_STANDARD_DENOMINATIONS.map((denom, idx) => {
                      const count = usdCounts[denom] || 0;
                      const lineCents = BigInt(denom * 100) * BigInt(count);
                      return (
                        <tr key={denom} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-medium">
                            ${denom}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {postedSheet ? (
                              <span className="tabular-nums font-normal text-slate-900 dark:text-slate-100">
                                {count > 0 ? count : <span className="text-slate-400 dark:text-slate-600">—</span>}
                              </span>
                            ) : (
                              <input
                                ref={(el) => (usdInputRefs.current[idx] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                aria-label={`Quantity for USD ${denom}`}
                                data-testid={`qty-usd-${denom}`}
                                value={count === 0 ? '' : count}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    usdInputRefs.current[idx + 1]?.focus();
                                    usdInputRefs.current[idx + 1]?.select();
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  if (val === '' || /^\d+$/.test(val)) {
                                    setUsdCounts({ ...usdCounts, [denom]: val === '' ? 0 : parseInt(val, 10) });
                                  }
                                }}
                                className="w-24 px-2 py-1 text-right text-sm border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {lineCents > 0n ? (
                              <MoneyCell amountPesewas={lineCents} currency="USD" showCurrency={false} align="right" />
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                      <td className="py-2.5 px-3 text-slate-900 dark:text-white">Subtotal</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {Object.values(usdCounts).reduce((a, b) => a + b, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <MoneyCell
                          amountPesewas={totalCashUsdCents}
                          currency="USD"
                          showCurrency={false}
                          align="right"
                          className="font-semibold text-slate-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 3. Cheques Tab */}
            {activeTab === 'CHEQUES' && (
              <div className="space-y-4">
                {!postedSheet && (
                  <form onSubmit={handleAddCheque} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Drawer / Issuer"
                      value={newDrawer}
                      onChange={(e) => setNewDrawer(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Bank name"
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Cheque #"
                      value={newChequeNum}
                      onChange={(e) => setNewChequeNum(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={newChequeAmtGhs}
                        onChange={(e) => setNewChequeAmtGhs(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-right border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium underline shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 font-normal">Drawer</th>
                      <th className="py-2 px-3 font-normal">Bank</th>
                      <th className="py-2 px-3 font-normal">Cheque #</th>
                      <th className="py-2 px-3 text-right font-normal">Amount (GH₵)</th>
                      {!postedSheet && <th className="py-2 px-2 text-center w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {cheques.length === 0 ? (
                      <tr>
                        <td colSpan={postedSheet ? 4 : 5} className="py-4 text-center text-xs text-slate-400">
                          No cheques recorded.
                        </td>
                      </tr>
                    ) : (
                      cheques.map((c, i) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">{c.drawerName}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{c.bankName}</td>
                          <td className="py-2 px-3 font-mono text-xs text-slate-500">{c.chequeNumber}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            <MoneyCell amountPesewas={c.amountPesewas} currency="GH₵" showCurrency={false} align="right" />
                          </td>
                          {!postedSheet && (
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setCheques(cheques.filter((_, idx) => idx !== i))}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {cheques.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                        <td colSpan={3} className="py-2.5 px-3 text-slate-900 dark:text-white">Subtotal</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <MoneyCell amountPesewas={totalChequesGhsPesewas} currency="GH₵" showCurrency={true} align="right" className="font-semibold" />
                        </td>
                        {!postedSheet && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 4. MoMo Tab */}
            {activeTab === 'MOMO' && (
              <div className="space-y-4">
                {!postedSheet && (
                  <form onSubmit={handleAddMomo} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <select
                      value={newMomoNet}
                      onChange={(e) => setNewMomoNet(e.target.value as MoMoNetwork)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    >
                      <option value="MTN">MTN MoMo</option>
                      <option value="VODAFONE">Telecel</option>
                      <option value="AIRTELTIGO">AT Money</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Sender name"
                      value={newMomoSender}
                      onChange={(e) => setNewMomoSender(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Reference"
                      value={newMomoRef}
                      onChange={(e) => setNewMomoRef(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={newMomoAmtGhs}
                        onChange={(e) => setNewMomoAmtGhs(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-right border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium underline shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 font-normal">Network</th>
                      <th className="py-2 px-3 font-normal">Sender</th>
                      <th className="py-2 px-3 font-normal">Reference</th>
                      <th className="py-2 px-3 text-right font-normal">Amount (GH₵)</th>
                      {!postedSheet && <th className="py-2 px-2 text-center w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {momoList.length === 0 ? (
                      <tr>
                        <td colSpan={postedSheet ? 4 : 5} className="py-4 text-center text-xs text-slate-400">
                          No mobile money records.
                        </td>
                      </tr>
                    ) : (
                      momoList.map((m, i) => (
                        <tr key={m.id}>
                          <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">{m.network}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{m.senderName}</td>
                          <td className="py-2 px-3 font-mono text-xs text-slate-500">{m.transactionReference}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            <MoneyCell amountPesewas={m.amountPesewas} currency="GH₵" showCurrency={false} align="right" />
                          </td>
                          {!postedSheet && (
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setMomoList(momoList.filter((_, idx) => idx !== i))}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {momoList.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                        <td colSpan={3} className="py-2.5 px-3 text-slate-900 dark:text-white">Subtotal</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <MoneyCell amountPesewas={totalMomoGhsPesewas} currency="GH₵" showCurrency={true} align="right" className="font-semibold" />
                        </td>
                        {!postedSheet && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 5. Bank Transfer Tab */}
            {activeTab === 'BANK_TRANSFER' && (
              <div className="space-y-4">
                {!postedSheet && (
                  <form onSubmit={handleAddBankTransfer} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Sender / Donor"
                      value={newBtSender}
                      onChange={(e) => setNewBtSender(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Bank / Channel"
                      value={newBtBank}
                      onChange={(e) => setNewBtBank(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Transfer Ref"
                      value={newBtRef}
                      onChange={(e) => setNewBtRef(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={newBtAmtGhs}
                        onChange={(e) => setNewBtAmtGhs(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-right border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium underline shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3 font-normal">Sender</th>
                      <th className="py-2 px-3 font-normal">Bank</th>
                      <th className="py-2 px-3 font-normal">Reference</th>
                      <th className="py-2 px-3 text-right font-normal">Amount (GH₵)</th>
                      {!postedSheet && <th className="py-2 px-2 text-center w-8"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {bankTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={postedSheet ? 4 : 5} className="py-4 text-center text-xs text-slate-400">
                          No direct bank transfers recorded.
                        </td>
                      </tr>
                    ) : (
                      bankTransfers.map((b, i) => (
                        <tr key={b.id}>
                          <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">{b.senderName}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{b.bankName}</td>
                          <td className="py-2 px-3 font-mono text-xs text-slate-500">{b.reference}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            <MoneyCell amountPesewas={b.amountPesewas} currency="GH₵" showCurrency={false} align="right" />
                          </td>
                          {!postedSheet && (
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setBankTransfers(bankTransfers.filter((_, idx) => idx !== i))}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {bankTransfers.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-200 dark:border-slate-700 font-medium">
                        <td colSpan={3} className="py-2.5 px-3 text-slate-900 dark:text-white">Subtotal</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <MoneyCell amountPesewas={totalBankTransfersPesewas} currency="GH₵" showCurrency={true} align="right" className="font-semibold" />
                        </td>
                        {!postedSheet && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Sticky Summary Panel (Below 1100px sits naturally and docks) */}
          <div className="space-y-6">
            {/* 5. Summary Section */}
            <div>
              <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Summary</h2>
              </div>

              {/* Totals per currency */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>GH₵ cash</span>
                  <MoneyCell amountPesewas={totalCashGhsPesewas} currency="GH₵" align="right" />
                </div>
                {totalCashUsdCents > 0n && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>USD cash</span>
                    <MoneyCell amountPesewas={totalCashUsdCents} currency="USD" align="right" />
                  </div>
                )}
                {totalChequesGhsPesewas > 0n && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Cheques</span>
                    <MoneyCell amountPesewas={totalChequesGhsPesewas} currency="GH₵" align="right" />
                  </div>
                )}
                {totalMomoGhsPesewas > 0n && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Mobile money</span>
                    <MoneyCell amountPesewas={totalMomoGhsPesewas} currency="GH₵" align="right" />
                  </div>
                )}
                {totalBankTransfersPesewas > 0n && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Bank transfers</span>
                    <MoneyCell amountPesewas={totalBankTransfersPesewas} currency="GH₵" align="right" />
                  </div>
                )}
              </div>

              {/* Grand Total in GH₵: Large plain figure, no glowing box */}
              <div className="pt-3 pb-3 my-3 border-t border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total in base currency (GH₵)</div>
                <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums mt-0.5">
                  <MoneyCell
                    amountPesewas={grandTotalGhsPesewas}
                    currency="GH₵"
                    size="xl"
                    className="font-semibold text-3xl"
                  />
                </div>
                {totalCashUsdCents > 0n && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    USD ${(Number(totalCashUsdCents) / 100).toFixed(2)} @ {usdRate} ({formatDate(serviceDate)})
                  </div>
                )}
              </div>
            </div>

            {/* Fund Allocation Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Fund allocation</h2>
                {!postedSheet && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline"
                    >
                      Quick allocate (50/50)
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">Tithes (GEN)</label>
                  {postedSheet ? (
                    <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                      {allocTitheGhs && parseFloat(allocTitheGhs) > 0 ? `GH₵ ${(Number(tGhs) / 100).toFixed(2)}` : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={allocTitheGhs}
                      onChange={(e) => setAllocTitheGhs(e.target.value)}
                      placeholder="0.00"
                      className="w-28 px-2 py-1 text-right text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">General offerings (GEN)</label>
                  {postedSheet ? (
                    <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                      {allocOfferingGhs && parseFloat(allocOfferingGhs) > 0 ? `GH₵ ${(Number(oGhs) / 100).toFixed(2)}` : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={allocOfferingGhs}
                      onChange={(e) => setAllocOfferingGhs(e.target.value)}
                      placeholder="0.00"
                      className="w-28 px-2 py-1 text-right text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">Building project (BLD)</label>
                  {postedSheet ? (
                    <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                      {allocBuildingGhs && parseFloat(allocBuildingGhs) > 0 ? `GH₵ ${(Number(bGhs) / 100).toFixed(2)}` : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={allocBuildingGhs}
                      onChange={(e) => setAllocBuildingGhs(e.target.value)}
                      placeholder="0.00"
                      className="w-28 px-2 py-1 text-right text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">Missions &amp; outreach (MIS)</label>
                  {postedSheet ? (
                    <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                      {allocMissionsGhs && parseFloat(allocMissionsGhs) > 0 ? `GH₵ ${(Number(mGhs) / 100).toFixed(2)}` : '—'}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={allocMissionsGhs}
                      onChange={(e) => setAllocMissionsGhs(e.target.value)}
                      placeholder="0.00"
                      className="w-28 px-2 py-1 text-right text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900 tabular-nums"
                    />
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Total allocated</span>
                  <MoneyCell amountPesewas={totalAllocatedPesewas} currency="GH₵" align="right" className="font-medium" />
                </div>

                {/* Warning / Difference in amber text with icon */}
                {!postedSheet && allocationDifference !== 0n && grandTotalGhsPesewas > 0n && (
                  <div className="pt-1 space-y-1">
                    <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        {allocationDifference > 0n
                          ? `GH₵ ${(Number(allocationDifference) / 100).toFixed(2)} unallocated`
                          : `GH₵ ${(Math.abs(Number(allocationDifference)) / 100).toFixed(2)} over allocated`}
                      </span>
                    </div>
                    {allocationDifference > 0n && (
                      <button
                        type="button"
                        onClick={handleAutoBalanceRemainder}
                        className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        Auto-balance remainder into General offerings
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 6. Sign-off Block: Counter 1 and Counter 2 with name, time, permanent/temporary status */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sign-off</h2>
                {!postedSheet && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAddCounterModal('NONE')}
                      className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline font-medium"
                    >
                      + Add counter
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setShowRosterModal(true)}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                    >
                      Roster ({countersRoster.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs">
                {/* Counter 1 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Counter 1: {counter1Name} <span className="font-normal text-slate-500">(signed {counter1Time})</span>
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                        isCounter1Permanent
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      {isCounter1Permanent ? 'Permanent' : 'Temporary'}
                    </span>
                  </div>
                  {!postedSheet ? (
                    counter1Manual ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Counter 1 full name"
                          value={counter1Name}
                          onChange={(e) => {
                            setCounter1Name(e.target.value);
                            setCounter1Id(`manual-1-${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setCounter1Manual(false)}
                          className="text-[11px] text-slate-500 underline"
                        >
                          List
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 items-center">
                        <select
                          value={counter1Id}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__ADD_NEW__') {
                              openAddCounterModal('COUNTER1');
                              return;
                            }
                            setCounter1Id(val);
                            const found = countersRoster.find((c) => c.id === val);
                            if (found) setCounter1Name(found.name);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                        >
                          <optgroup label="Permanent Counters">
                            {countersRoster
                              .filter((c) => c.isPermanent)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.role ? `• ${c.role}` : ''}
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Temporary Counters">
                            {countersRoster
                              .filter((c) => !c.isPermanent)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.role ? `• ${c.role}` : ''}
                                </option>
                              ))}
                          </optgroup>
                          <option value="__ADD_NEW__">+ Add new counter...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openAddCounterModal('COUNTER1')}
                          className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline font-medium whitespace-nowrap"
                          title="Add counter"
                        >
                          + Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setCounter1Manual(true)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline whitespace-nowrap"
                        >
                          Type
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Signed off &amp; verified</span>
                    </div>
                  )}
                </div>

                {/* Counter 2 */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Counter 2: {counter2Name} <span className="font-normal text-slate-500">(signed {counter2Time})</span>
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                        isCounter2Permanent
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      {isCounter2Permanent ? 'Permanent' : 'Temporary'}
                    </span>
                  </div>
                  {!postedSheet ? (
                    counter2Manual ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Counter 2 full name"
                          value={counter2Name}
                          onChange={(e) => {
                            setCounter2Name(e.target.value);
                            setCounter2Id(`manual-2-${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setCounter2Manual(false)}
                          className="text-[11px] text-slate-500 underline"
                        >
                          List
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 items-center">
                        <select
                          value={counter2Id}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__ADD_NEW__') {
                              openAddCounterModal('COUNTER2');
                              return;
                            }
                            setCounter2Id(val);
                            const found = countersRoster.find((c) => c.id === val);
                            if (found) setCounter2Name(found.name);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                        >
                          <optgroup label="Permanent Counters">
                            {countersRoster
                              .filter((c) => c.isPermanent)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.role ? `• ${c.role}` : ''}
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Temporary Counters">
                            {countersRoster
                              .filter((c) => !c.isPermanent)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.role ? `• ${c.role}` : ''}
                                </option>
                              ))}
                          </optgroup>
                          <option value="__ADD_NEW__">+ Add new counter...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openAddCounterModal('COUNTER2')}
                          className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline font-medium whitespace-nowrap"
                          title="Add counter"
                        >
                          + Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setCounter2Manual(true)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline whitespace-nowrap"
                        >
                          Type
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Signed off &amp; verified</span>
                    </div>
                  )}
                </div>

                {/* Additional Counters (Counter 3, Counter 4, etc. for counting committees > 2) */}
                {additionalCounters.map((counter, idx) => {
                  const slotNum = 3 + idx;
                  return (
                    <div
                      key={counter.id || idx}
                      className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Counter {slotNum}: {counter.name || `(Counter ${slotNum})`}{' '}
                          <span className="font-normal text-slate-500">(signed {counter.time})</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                              counter.isPermanent
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            {counter.isPermanent ? 'Permanent' : 'Temporary'}
                          </span>
                          {!postedSheet && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAdditionalCounter(idx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 text-[11px]"
                              title={`Remove Counter ${slotNum}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {!postedSheet ? (
                        counter.isManual ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder={`Counter ${slotNum} full name`}
                              value={counter.name}
                              onChange={(e) =>
                                handleUpdateAdditionalCounter(idx, {
                                  name: e.target.value,
                                  id: `manual-${slotNum}-${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateAdditionalCounter(idx, { isManual: false })}
                              className="text-[11px] text-slate-500 underline"
                            >
                              List
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 items-center">
                            <select
                              value={counter.id}
                              onChange={(e) => {
                                const val = e.target.value;
                                const found = countersRoster.find((c) => c.id === val);
                                if (found) {
                                  handleUpdateAdditionalCounter(idx, {
                                    id: found.id,
                                    name: found.name,
                                    isPermanent: found.isPermanent,
                                    role: found.role,
                                  });
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-[4px] bg-white dark:bg-slate-900"
                            >
                              <optgroup label="Permanent Counters">
                                {countersRoster
                                  .filter((c) => c.isPermanent)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} {c.role ? `• ${c.role}` : ''}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Temporary Counters">
                                {countersRoster
                                  .filter((c) => !c.isPermanent)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} {c.role ? `• ${c.role}` : ''}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleUpdateAdditionalCounter(idx, { isManual: true })}
                              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline whitespace-nowrap"
                            >
                              Type
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Signed off &amp; verified</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Counter to Sheet Button */}
                {!postedSheet && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleAddCounterToSheet}
                      className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline font-medium inline-flex items-center gap-1"
                    >
                      + Add another counter to this sheet (Counter {3 + additionalCounters.length})
                    </button>
                  </div>
                )}

                {/* Same Counter Warning */}
                {!postedSheet && hasDuplicateCounters && (
                  <div className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Violation: Counter 1 and Counter 2 cannot be the same person. Dual control required.</span>
                  </div>
                )}

                {/* One filled primary button on the page OR Posted confirmation block */}
                <div className="pt-2">
                  {postedSheet ? (
                    <div className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-[4px] text-center font-medium leading-relaxed">
                      Counting sheet posted to general ledger as <strong className="text-slate-900 dark:text-white">{postedSheet.sheetNumber}</strong>. Corrections require a reversal entry in the journal.
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSubmitSheet}
                        disabled={isSignDisabled}
                        className="w-full py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-[4px] text-sm font-semibold transition"
                      >
                        Sign Off &amp; Post Counting Sheet to Ledger
                      </button>

                      {/* Missing criteria explanation when button is disabled */}
                      {isSignDisabled && (
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                          {grandTotalGhsPesewas === 0n
                            ? 'Sheet total cannot be zero.'
                            : allocationDifference !== 0n
                            ? `Allocations must equal total collections (difference: GHS ${(Math.abs(Number(allocationDifference)) / 100).toFixed(2)}).`
                            : counter1Id === counter2Id || counter1Name.trim().toLowerCase() === counter2Name.trim().toLowerCase()
                            ? 'Two distinct counter signatures required.'
                            : 'Complete all required fields to sign.'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheet / Journal Entry Details Modal */}
      {selectedSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[6px] max-w-xl w-full p-6 text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-sm">
                  Journal Entry · JE-{selectedSheet.sheetNumber}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Posted from counting sheet {selectedSheet.sheetNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSheet(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Service &amp; Date</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {selectedSheet.serviceType} · {formatDateWithWeekday(selectedSheet.serviceDate)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Sign-off Counters</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {selectedSheet.counters && selectedSheet.counters.length > 0
                    ? selectedSheet.counters.map((c) => c.name).join(', ')
                    : `${selectedSheet.firstCounterName} & ${selectedSheet.secondCounterName}`}
                </span>
              </div>
            </div>

            {/* General Ledger Double-Entry Breakdown */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                General Ledger Posting Lines
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-1 px-2 text-left font-normal">Account</th>
                    <th className="py-1 px-2 text-right font-normal">Dr (GH₵)</th>
                    <th className="py-1 px-2 text-right font-normal">Cr (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedSheet.totalCashGhsPesewas > 0n && (
                    <tr>
                      <td className="py-1 px-2 font-mono text-[11px]">1010 Petty Cash / Float (GHS Cash)</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        <MoneyCell amountPesewas={selectedSheet.totalCashGhsPesewas} currency="GH₵" showCurrency={false} align="right" />
                      </td>
                      <td className="py-1 px-2 text-right text-slate-400">—</td>
                    </tr>
                  )}
                  {selectedSheet.totalCashUsdCents > 0n && (
                    <tr>
                      <td className="py-1 px-2 font-mono text-[11px]">1020 Foreign Currency Cash (USD Cash in GHS)</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        <MoneyCell
                          amountPesewas={convertLineToBaseCurrency(selectedSheet.totalCashUsdCents, 'USD', '15.5000').baseAmountGhs}
                          currency="GH₵"
                          showCurrency={false}
                          align="right"
                        />
                      </td>
                      <td className="py-1 px-2 text-right text-slate-400">—</td>
                    </tr>
                  )}
                  {selectedSheet.totalChequesGhsPesewas > 0n && (
                    <tr>
                      <td className="py-1 px-2 font-mono text-[11px]">1030 Cheques &amp; Bank Transfers</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        <MoneyCell amountPesewas={selectedSheet.totalChequesGhsPesewas} currency="GH₵" showCurrency={false} align="right" />
                      </td>
                      <td className="py-1 px-2 text-right text-slate-400">—</td>
                    </tr>
                  )}
                  {selectedSheet.totalMomoGhsPesewas > 0n && (
                    <tr>
                      <td className="py-1 px-2 font-mono text-[11px]">1040 Mobile Money Clearing</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        <MoneyCell amountPesewas={selectedSheet.totalMomoGhsPesewas} currency="GH₵" showCurrency={false} align="right" />
                      </td>
                      <td className="py-1 px-2 text-right text-slate-400">—</td>
                    </tr>
                  )}

                  {/* Fund Allocations Credits */}
                  {selectedSheet.fundAllocations.map((alloc, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2 pl-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {alloc.category === 'Tithe'
                          ? '4010 Tithes (General Fund)'
                          : alloc.category === 'Building Pledge'
                          ? '4030 Building Pledge (Building Fund)'
                          : alloc.category === 'Special Offering'
                          ? '4040 Missions & Outreach'
                          : '4020 General Offerings (General Fund)'}
                      </td>
                      <td className="py-1 px-2 text-right text-slate-400">—</td>
                      <td className="py-1 px-2 text-right tabular-nums">
                        <MoneyCell amountPesewas={alloc.amountPesewas} currency="GH₵" showCurrency={false} align="right" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white">
                    <td className="py-1.5 px-2">Total</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <MoneyCell amountPesewas={selectedSheet.grandTotalGhsPesewas} currency="GH₵" showCurrency={true} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <MoneyCell amountPesewas={selectedSheet.grandTotalGhsPesewas} currency="GH₵" showCurrency={true} align="right" />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pt-2 flex justify-end gap-3 text-xs border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const s = selectedSheet;
                  setSelectedSheet(null);
                  setPrintableSheet(s);
                }}
                className="hover:underline text-slate-700 dark:text-slate-300 font-medium"
              >
                Print official sheet
              </button>
              <button
                type="button"
                onClick={() => setSelectedSheet(null)}
                className="hover:underline text-slate-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Counter to Roster */}
      {showAddCounterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[6px] max-w-md w-full p-6 text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-sm">Add counter to roster</h3>
                <p className="text-[11px] text-slate-500">Register a permanent church counter or an ad-hoc temporary counter.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCounterModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addCounterError && (
              <div className="py-2 px-3 rounded-[6px] border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{addCounterError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewCounter} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Deacon Kwabena Mensah"
                  value={newCounterName}
                  onChange={(e) => setNewCounterName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-[6px] bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Counter Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCounterType('PERMANENT')}
                    className={`p-2.5 rounded-[6px] border text-left transition ${
                      newCounterType === 'PERMANENT'
                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Permanent Counter</span>
                      {newCounterType === 'PERMANENT' && <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                      Regular church officer. Preserved in roster across all services.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCounterType('TEMPORARY')}
                    className={`p-2.5 rounded-[6px] border text-left transition ${
                      newCounterType === 'TEMPORARY'
                        ? 'border-amber-600 dark:border-amber-400 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Temporary Counter</span>
                      {newCounterType === 'TEMPORARY' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                      Ad-hoc or guest counter assigned for today's service only.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department / Congregation Role (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Audit Committee / Youth Executive / Deacon"
                  value={newCounterRole}
                  onChange={(e) => setNewCounterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-[6px] bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assign immediately to
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="assignSlot"
                      checked={addCounterTargetSlot === 'COUNTER1'}
                      onChange={() => setAddCounterTargetSlot('COUNTER1')}
                    />
                    <span>Counter 1</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="assignSlot"
                      checked={addCounterTargetSlot === 'COUNTER2'}
                      onChange={() => setAddCounterTargetSlot('COUNTER2')}
                    />
                    <span>Counter 2</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="assignSlot"
                      checked={addCounterTargetSlot === 'NONE'}
                      onChange={() => setAddCounterTargetSlot('NONE')}
                    />
                    <span>Roster only</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCounterModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[6px] text-xs font-semibold hover:opacity-90 transition"
                >
                  Save Counter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Church Counters Roster */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[6px] max-w-xl w-full p-6 text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-sm">Church Counters Roster</h3>
                <p className="text-[11px] text-slate-500">
                  {countersRoster.filter((c) => c.isPermanent).length} Permanent &bull;{' '}
                  {countersRoster.filter((c) => !c.isPermanent).length} Temporary
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRosterModal(false);
                    openAddCounterModal('NONE');
                  }}
                  className="text-xs font-medium text-slate-900 dark:text-white underline hover:opacity-80"
                >
                  + Add counter
                </button>
                <button
                  type="button"
                  onClick={() => setShowRosterModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {countersRoster.map((counter) => {
                const isAssigned = counter1Id === counter.id || counter2Id === counter.id;
                return (
                  <div key={counter.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{counter.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                            counter.isPermanent
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                          }`}
                        >
                          {counter.isPermanent ? 'Permanent' : 'Temporary'}
                        </span>
                        {isAssigned && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            (Currently Assigned)
                          </span>
                        )}
                      </div>
                      {counter.role && (
                        <p className="text-[11px] text-slate-400">{counter.role}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCounterPermanence(counter.id)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                      >
                        Make {counter.isPermanent ? 'Temporary' : 'Permanent'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCounter(counter.id)}
                        disabled={isAssigned}
                        className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400"
                        title={isAssigned ? 'Cannot delete currently assigned counter' : 'Remove counter'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRosterModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Printable Counting Sheet */}
      <PrintableCountingSheetModal
        sheet={printableSheet}
        isOpen={!!printableSheet}
        onClose={() => setPrintableSheet(null)}
      />
    </div>
  );
};
