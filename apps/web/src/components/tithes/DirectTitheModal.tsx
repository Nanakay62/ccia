import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, AlertTriangle } from 'lucide-react';
import { useTithes } from '../../context/TithesContext.js';
import { useCashbook } from '../../context/CashbookContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useToast } from '../../context/ToastContext.js';
import { DateInput } from '../ui/DateInput.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import type { CashAccount } from '@church/domain';

interface DirectTitheModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMemberId?: string;
}

type TitheMethodType = 'MOMO' | 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';

function cleanAccountLabel(acct: CashAccount): string {
  // Fix duplicate (GHS) (GHS) issue by stripping trailing currency in parens
  const baseName = acct.name.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();
  return `${baseName} (${acct.currency})`;
}

export const DirectTitheModal: React.FC<DirectTitheModalProps> = ({
  isOpen,
  onClose,
  defaultMemberId,
}) => {
  const { records, recordDirectTithe } = useTithes();
  const { cashAccounts } = useCashbook();
  const { members } = useGiving();
  const { showToast } = useToast();

  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [memberId, setMemberId] = useState(defaultMemberId || '');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<'GHS' | 'USD'>('GHS');
  const [exchangeRate, setExchangeRate] = useState('15.5000');
  const [amountStr, setAmountStr] = useState('');
  const [method, setMethod] = useState<TitheMethodType>('MOMO');
  const [cashAccountId, setCashAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [narration, setNarration] = useState('');

  // UI / Guard State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [hasAcknowledgedDuplicate, setHasAcknowledgedDuplicate] = useState(false);

  const safeAccounts = useMemo(() => cashAccounts || [], [cashAccounts]);

  // Selected Member
  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === memberId) || null;
  }, [members, memberId]);

  // Filtered Accounts based on selected Method
  const availableAccounts = useMemo(() => {
    if (method === 'MOMO') {
      return safeAccounts.filter((a) => a.kind === 'mobile');
    }
    if (method === 'BANK_TRANSFER') {
      return safeAccounts.filter((a) => a.kind === 'bank' && (currency === 'USD' ? a.currency === 'USD' : a.currency === 'GHS'));
    }
    if (method === 'CHEQUE') {
      return safeAccounts.filter((a) => a.kind === 'cash' || a.kind === 'bank' || a.id === 'ca-cheques-ghs');
    }
    // CASH
    return safeAccounts.filter((a) => a.kind === 'cash' && a.id !== 'ca-cheques-ghs' && a.currency === currency);
  }, [safeAccounts, method, currency]);

  // Preselect matching account on method/currency change
  useEffect(() => {
    if (!isOpen) return;
    if (method === 'MOMO') {
      const momoAcct = safeAccounts.find((a) => a.kind === 'mobile') || safeAccounts[0];
      if (momoAcct) setCashAccountId(momoAcct.id);
    } else if (method === 'BANK_TRANSFER') {
      const bankAcct = safeAccounts.find((a) => a.kind === 'bank' && a.currency === currency) || safeAccounts.find((a) => a.kind === 'bank');
      if (bankAcct) setCashAccountId(bankAcct.id);
    } else if (method === 'CHEQUE') {
      const chequeAcct = safeAccounts.find((a) => a.id === 'ca-cheques-ghs') || safeAccounts.find((a) => a.kind === 'bank');
      if (chequeAcct) setCashAccountId(chequeAcct.id);
    } else if (method === 'CASH') {
      const cashAcct = safeAccounts.find((a) => a.kind === 'cash' && a.id !== 'ca-cheques-ghs' && a.currency === currency) || safeAccounts.find((a) => a.kind === 'cash');
      if (cashAcct) setCashAccountId(cashAcct.id);
    }
  }, [method, currency, safeAccounts, isOpen]);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDuplicateWarning(null);
      setHasAcknowledgedDuplicate(false);
      if (defaultMemberId) {
        setMemberId(defaultMemberId);
        const m = members.find((x) => x.id === defaultMemberId);
        if (m) {
          setMemberSearchQuery(`${m.title ? m.title + ' ' : ''}${m.fullName || `${m.firstName} ${m.lastName}`}`);
        }
      }
      // Focus first field
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultMemberId, members]);

  // Track if user typed any data
  const hasTypedData = useMemo(() => {
    return Boolean(
      (memberId && memberId !== defaultMemberId) ||
      amountStr.trim() ||
      reference.trim() ||
      narration.trim()
    );
  }, [memberId, defaultMemberId, amountStr, reference, narration]);

  // Handle Close with Unsaved Guard
  const handleRequestClose = () => {
    if (hasTypedData) {
      setIsDiscardConfirmOpen(true);
    } else {
      onClose();
    }
  };

  // Keyboard navigation & Esc handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isMemberDropdownOpen) {
          setIsMemberDropdownOpen(false);
        } else {
          handleRequestClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMemberDropdownOpen, hasTypedData]);

  // Filtered members for searchable combobox
  const searchResults = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return members.slice(0, 10);
    return members.filter((m) => {
      const name = `${m.title || ''} ${m.firstName || ''} ${m.lastName || ''} ${m.fullName || ''}`.toLowerCase();
      const env = (m.envelopeNumber || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      return name.includes(q) || env.includes(q) || id.includes(q);
    }).slice(0, 15);
  }, [members, memberSearchQuery]);

  // Calculate live amounts
  const amtNum = parseFloat(amountStr) || 0;
  const rateNum = parseFloat(exchangeRate) || 1;
  const isUsd = currency === 'USD';
  const ghsEquivalentNum = isUsd ? amtNum * rateNum : amtNum;
  const amountPesewas = BigInt(Math.round(amtNum * 100));

  // Live Posting Account Name
  const selectedCashAccount = safeAccounts.find((a) => a.id === cashAccountId) || availableAccounts[0];
  const accountCleanName = selectedCashAccount
    ? selectedCashAccount.name.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim()
    : 'Cash / Bank';

  // Check for duplicate on inputs change
  useEffect(() => {
    if (!memberId || amtNum <= 0) {
      setDuplicateWarning(null);
      return;
    }
    const checkPesewas = BigInt(Math.round(amtNum * 100));
    const matching = records.find(
      (r) =>
        !r.isReversal &&
        r.memberId === memberId &&
        r.amount === checkPesewas &&
        r.recordDate === recordDate &&
        (method === 'CASH' || !reference.trim() || r.notes?.includes(reference.trim()))
    );

    if (matching) {
      setDuplicateWarning(
        `Possible duplicate: A tithe of ${(Number(matching.amount) / 100).toFixed(2)} GHS for this member is already recorded on ${recordDate}.`
      );
    } else {
      setDuplicateWarning(null);
      setHasAcknowledgedDuplicate(false);
    }
  }, [memberId, amtNum, recordDate, reference, method, records]);

  if (!isOpen) return null;

  // Execute Record
  const executeSave = (addAnother: boolean = false) => {
    setError(null);

    if (!memberId) {
      setError('Please search and select a church member.');
      searchInputRef.current?.focus();
      return;
    }

    if (amtNum <= 0 || isNaN(amtNum)) {
      setError('Please enter a valid tithe amount greater than zero.');
      return;
    }

    if (method !== 'CASH' && !reference.trim()) {
      const refName =
        method === 'MOMO'
          ? 'MoMo transaction ID'
          : method === 'BANK_TRANSFER'
          ? 'Bank reference'
          : 'Cheque number';
      setError(`Please enter the ${refName}.`);
      return;
    }

    if (duplicateWarning && !hasAcknowledgedDuplicate) {
      setError('Please confirm this duplicate entry or adjust the details.');
      return;
    }

    try {
      setIsSubmitting(true);
      const memberName = selectedMember
        ? `${selectedMember.title ? selectedMember.title + ' ' : ''}${selectedMember.fullName || `${selectedMember.firstName} ${selectedMember.lastName}`}`
        : 'Church Member';

      const finalRef = method === 'CASH'
        ? (reference.trim() || undefined)
        : reference.trim();

      recordDirectTithe({
        memberId,
        memberName,
        envelopeNumber: selectedMember?.envelopeNumber,
        amount: amountPesewas,
        currency,
        exchangeRate: isUsd ? exchangeRate : undefined,
        recordDate,
        method,
        cashAccountId: selectedCashAccount?.id || 'ca-cash-ghs',
        reference: finalRef,
        narration: narration.trim() || `Direct tithe received via ${method}`,
      });

      showToast(
        `Recorded direct tithe of ${currency} ${amtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${memberName}. Receipt generated!`,
        'success'
      );

      if (addAnother) {
        // Reset form for next entry
        setMemberId('');
        setMemberSearchQuery('');
        setAmountStr('');
        setReference('');
        setNarration('');
        setDuplicateWarning(null);
        setHasAcknowledgedDuplicate(false);
        searchInputRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record direct tithe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-tithe-modal-title"
      >
        <div
          ref={modalRef}
          className="bg-[var(--surface-panel)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-2xl max-w-[720px] w-full max-h-[92vh] flex flex-col text-[var(--text-primary)] animate-scaleUp overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--surface-border)] flex items-start justify-between gap-4 bg-[var(--surface-subtle)]/40">
            <div>
              <h3 id="direct-tithe-modal-title" className="font-serif text-[18px] font-semibold text-[var(--text-primary)]">
                Record direct tithe
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Record tithes received outside service (MoMo, Bank transfer, Cheque, or Cash)
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrolling Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-[13px]">
            {error && (
              <div className="p-3 rounded-[var(--radius)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[13px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 rounded-[var(--radius)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-[12px] flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold block">{duplicateWarning}</span>
                    <span className="text-amber-700 dark:text-amber-300">
                      If this is a separate donation, check the acknowledgement below.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHasAcknowledgedDuplicate(true)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-[var(--radius)] border transition shrink-0 ${
                    hasAcknowledgedDuplicate
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-amber-400 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  }`}
                >
                  {hasAcknowledgedDuplicate ? 'Duplicate Confirmed' : 'Record Anyway'}
                </button>
              </div>
            )}

            {/* 1. Member Searchable Combobox (Requirement 2) */}
            <div className="relative">
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Member
              </label>

              {selectedMember ? (
                <div className="flex items-center justify-between p-2.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-subtle)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">
                      {selectedMember.title ? `${selectedMember.title} ` : ''}
                      {selectedMember.fullName || `${selectedMember.firstName} ${selectedMember.lastName}`}
                    </span>
                    {selectedMember.envelopeNumber && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-sans tabular-nums bg-white dark:bg-slate-800 border border-[var(--surface-border)] font-medium text-[var(--text-secondary)]">
                        {selectedMember.envelopeNumber}
                      </span>
                    )}
                    <span className="text-[12px] text-[var(--text-muted)]">
                      · {selectedMember.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberId('');
                      setMemberSearchQuery('');
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="text-xs text-[var(--accent)] hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search member by name, envelope number (e.g. ENV-012), or member ID..."
                      value={memberSearchQuery}
                      onChange={(e) => {
                        setMemberSearchQuery(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  {isMemberDropdownOpen && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] shadow-xl divide-y divide-[var(--surface-border)]">
                      {searchResults.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setMemberId(m.id);
                            setMemberSearchQuery(
                              `${m.title ? m.title + ' ' : ''}${m.fullName || `${m.firstName} ${m.lastName}`}`
                            );
                            setIsMemberDropdownOpen(false);
                          }}
                          className="p-2.5 hover:bg-[var(--surface-subtle)] cursor-pointer flex items-center justify-between text-[13px] transition"
                        >
                          <div>
                            <span className="font-medium text-[var(--text-primary)]">
                              {m.title ? `${m.title} ` : ''}
                              {m.fullName || `${m.firstName} ${m.lastName}`}
                            </span>
                            <span className="text-[12px] text-[var(--text-muted)] ml-2">
                              {m.department || 'General'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.envelopeNumber && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-sans tabular-nums bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-[var(--text-secondary)]">
                                {m.envelopeNumber}
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--text-muted)] font-sans tabular-nums">
                              {m.id}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Date & Amount Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Date
                </label>
                <DateInput
                  value={recordDate}
                  onChange={setRecordDate}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-[var(--text-primary)]">
                    Amount & Currency
                  </label>
                  <div className="inline-flex rounded-[var(--radius-sm)] border border-[var(--surface-border)] overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setCurrency('GHS')}
                      className={`px-2 py-0.5 font-medium transition ${
                        currency === 'GHS'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      GHS
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2 py-0.5 font-medium transition ${
                        currency === 'USD'
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      USD
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2 text-[var(--text-muted)] font-medium text-[13px]">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    required
                    className="w-full pl-12 pr-3 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-right font-sans tabular-nums font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            {/* USD Exchange Rate Row (Requirement 4) */}
            {isUsd && (
              <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-[var(--text-secondary)] mb-1">
                    Exchange rate (USD to GHS)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums text-right outline-none"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[var(--text-muted)]">GHS Equivalent</span>
                  <span className="font-semibold text-sm text-[var(--text-primary)] font-sans tabular-nums mt-0.5">
                    GHS {ghsEquivalentNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Method & Account Row (Requirement 3 & 6) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as TitheMethodType)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="MOMO">MoMo</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Account
                </label>
                <select
                  value={cashAccountId}
                  onChange={(e) => setCashAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {availableAccounts.map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {cleanAccountLabel(acct)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Reference Field (Requirement 3: Hidden when CASH) */}
            {method !== 'CASH' && (
              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  {method === 'MOMO'
                    ? 'MoMo transaction ID'
                    : method === 'BANK_TRANSFER'
                    ? 'Bank reference'
                    : 'Cheque number'}
                </label>
                <input
                  type="text"
                  placeholder={
                    method === 'MOMO'
                      ? 'e.g. MTN-998812'
                      : method === 'BANK_TRANSFER'
                      ? 'e.g. GCB-TX-44028'
                      : 'e.g. 004128'
                  }
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            )}

            {/* 5. Notes (Optional) */}
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">
                Notes <span className="text-[var(--text-muted)] font-normal text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. October tithe transferred to church account"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* 6. Live Posting Preview (Requirement 5) */}
            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--text-muted)]">Posting preview</span>
              <span className="font-semibold text-[var(--text-primary)] font-sans tabular-nums">
                Dr {accountCleanName} {amtNum > 0 ? amtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} · Cr Tithes {amtNum > 0 ? amtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </span>
            </div>
          </form>

          {/* Sticky Footer (Requirement 7) */}
          <div className="px-6 py-3.5 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)]/40 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRequestClose}
              className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => executeSave(true)}
                className="px-3.5 py-2 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] hover:bg-[var(--surface-subtle)] text-[13px] font-medium text-[var(--text-primary)] transition disabled:opacity-50"
              >
                Record and add another
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => executeSave(false)}
                className="px-5 py-2 rounded-[var(--radius)] text-[13px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50 shadow-xs"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDiscardConfirmOpen}
        onClose={() => setIsDiscardConfirmOpen(false)}
        title="Discard unsaved changes?"
        description="You have entered tithe details that have not been recorded yet. Are you sure you want to close without saving?"
        confirmLabel="Discard Changes"
        isDestructive={true}
        onConfirm={() => {
          setIsDiscardConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
};
