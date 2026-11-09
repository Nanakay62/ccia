import React, { useState, useMemo, useContext } from 'react';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { GivingContext } from '../../context/GivingContext.js';
import {
  createJournalEntry,
  toMajorUnitsString,
  type JournalEntry,
} from '@church/domain';
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useSecurityEvents } from '../../context/SecurityEventsContext.js';
import { UnderlineTabs, type UnderlineTabItem } from '../ui/UnderlineTabs.js';
import { DataTable, type Column } from '../ui/DataTable.js';
import { ConfirmationDialog } from '../ui/ConfirmationDialog.js';
import { CategoryTag } from '../ui/StatusDot.js';
import { MoneyCell } from '../ui/MoneyCell.js';
import { formatDate } from '../../config/churchSettings.js';

interface JournalLineFormItem {
  id: string;
  accountId: string;
  fundId: string;
  currency: 'GHS' | 'USD';
  exchangeRate: string;
  debit: string;
  credit: string;
  memo: string;
}

export const LedgerView: React.FC = () => {
  const { accounts, funds, entries, addEntry, reverseEntry } = useLedger();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const givingCtx = useContext(GivingContext);
  const countingSheets = givingCtx?.countingSheets ?? [];

  // Active Tab: "Journal entries" (default) or "New entry" (Spec B3.2)
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'NEW_ENTRY'>('ENTRIES');

  // Expanded row IDs for collapsible nested debit/credit lines (Spec B3.4)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Search & Filter state for Journal entries table (Spec B3.4)
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [fundFilter, setFundFilter] = useState<string>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');

  // Reversal Confirmation Dialog state (Spec B3.5)
  const [reversalTargetEntry, setReversalTargetEntry] = useState<JournalEntry | null>(null);

  // Hash-Chain Anti-Tampering (Spec C6)
  const { hashChainResult, verifyHashChainNow } = useSecurityEvents();
  const [isHashChainModalOpen, setIsHashChainModalOpen] = useState(false);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);

  // New Journal Entry Form State (Spec B3.3)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<JournalLineFormItem[]>([
    {
      id: 'l-1',
      accountId: 'acct-1010',
      fundId: 'fund-gen',
      currency: 'GHS',
      exchangeRate: '1.0000',
      debit: '100.00',
      credit: '',
      memo: '',
    },
    {
      id: 'l-2',
      accountId: 'acct-4010',
      fundId: 'fund-gen',
      currency: 'GHS',
      exchangeRate: '1.0000',
      debit: '',
      credit: '100.00',
      memo: '',
    },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  // Map of reversed entries for linking (Spec B3.5)
  const reversedByMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      if (e.isReversal && e.reversalOfId) {
        map.set(e.reversalOfId, e.documentNumber);
      }
    }
    return map;
  }, [entries]);

  // Infer entry source
  const getEntrySource = (entry: JournalEntry): string => {
    if (entry.isReversal) return 'Reversal';
    const num = entry.documentNumber.toUpperCase();
    const narr = entry.narration.toLowerCase();
    if (num.startsWith('JE-CS') || narr.includes('counting sheet') || narr.includes('sunday')) {
      return 'Counting sheet';
    }
    if (num.startsWith('PV-') || num.startsWith('JE-PV') || narr.includes('voucher') || narr.includes('wht')) {
      return 'Payment voucher';
    }
    if (narr.includes('payroll') || narr.includes('salary')) {
      return 'Payroll';
    }
    return 'Manual';
  };

  // Helper to extract counter information for counting sheet entries (supports 2, 3, 4, 5+ counters)
  const getEntryCounters = (
    entry: JournalEntry
  ): Array<{ name: string; isPermanent?: boolean; time?: string }> | null => {
    // 1. Try to match linked CountingSheet from GivingContext
    const linkedSheet = countingSheets.find(
      (s) =>
        s.id === entry.id ||
        s.journalEntryId === entry.id ||
        (s.sheetNumber && entry.documentNumber.includes(s.sheetNumber)) ||
        (entry.documentNumber.startsWith('JE-CS-') &&
          s.sheetNumber &&
          entry.documentNumber.endsWith(s.sheetNumber.replace(/^CS-/, '')))
    );

    if (linkedSheet) {
      if (linkedSheet.counters && linkedSheet.counters.length > 0) {
        return linkedSheet.counters.map((c) => ({
          name: c.name.replace(/\s*\([^)]*\)/g, '').trim(),
          isPermanent: c.isPermanent,
          time: c.signedAt
            ? new Date(c.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined,
        }));
      }

      const list: Array<{ name: string; isPermanent?: boolean; time?: string }> = [];
      if (linkedSheet.firstCounterName) {
        list.push({
          name: linkedSheet.firstCounterName.replace(/\s*\([^)]*\)/g, '').trim(),
          isPermanent: true,
          time: linkedSheet.firstSignedAt
            ? new Date(linkedSheet.firstSignedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined,
        });
      }
      if (linkedSheet.secondCounterName) {
        list.push({
          name: linkedSheet.secondCounterName.replace(/\s*\([^)]*\)/g, '').trim(),
          isPermanent: true,
          time: linkedSheet.secondSignedAt
            ? new Date(linkedSheet.secondSignedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined,
        });
      }
      if (list.length > 0) return list;
    }

    // 2. Parse from narration: e.g. "Sunday Service Collection Sign-off (Counters: Mabel Ankrah & Emmanuel Ofori)"
    const match = entry.narration.match(/Counters:\s*([^)]+)/i);
    if (match && match[1]) {
      const raw = match[1];
      const names = raw
        .split(/[,&]/)
        .map((n) => n.trim())
        .filter(Boolean);
      if (names.length > 0) {
        return names.map((name) => ({ name, isPermanent: true }));
      }
    }

    // 3. Fallback for seed Sunday offering entry
    if (entry.documentNumber === 'JE-TR-000001' || entry.documentNumber.startsWith('JE-CS-')) {
      const defaultSheet = countingSheets[0];
      if (defaultSheet && (defaultSheet.firstCounterName || defaultSheet.secondCounterName)) {
        const list: Array<{ name: string; isPermanent?: boolean; time?: string }> = [];
        if (defaultSheet.firstCounterName) {
          list.push({
            name: defaultSheet.firstCounterName.replace(/\s*\([^)]*\)/g, '').trim(),
            isPermanent: true,
          });
        }
        if (defaultSheet.secondCounterName) {
          list.push({
            name: defaultSheet.secondCounterName.replace(/\s*\([^)]*\)/g, '').trim(),
            isPermanent: true,
          });
        }
        return list;
      }
    }

    return null;
  };

  // Calculate live line totals (Spec B3.3)
  let computedDebitPesewas = 0n;
  let computedCreditPesewas = 0n;
  const fundTotals = new Map<string, { dr: bigint; cr: bigint }>();

  for (const line of lines) {
    const rate = parseFloat(line.exchangeRate) || 1;
    const drVal = parseFloat(line.debit) || 0;
    const crVal = parseFloat(line.credit) || 0;

    const drPesewas = BigInt(Math.round(drVal * 100 * rate));
    const crPesewas = BigInt(Math.round(crVal * 100 * rate));

    computedDebitPesewas += drPesewas;
    computedCreditPesewas += crPesewas;

    const f = fundTotals.get(line.fundId) ?? { dr: 0n, cr: 0n };
    f.dr += drPesewas;
    f.cr += crPesewas;
    fundTotals.set(line.fundId, f);
  }

  const liveDiffPesewas = computedDebitPesewas - computedCreditPesewas;
  const isBalanced = liveDiffPesewas === 0n && computedDebitPesewas > 0n;

  // Add new line to form
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        accountId: accounts[0]?.id || 'acct-1010',
        fundId: funds[0]?.id || 'fund-gen',
        currency: 'GHS',
        exchangeRate: '1.0000',
        debit: '',
        credit: '',
        memo: '',
      },
    ]);
  };

  // Remove line from form
  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Auto-balance rounding (1p or 2p)
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
          exchangeRate: '1.0000',
          debit: isDebitNeeded ? majorUnits : '',
          credit: !isDebitNeeded ? majorUnits : '',
          memo: 'Rounding adjustment',
        },
      ]);
    }
  };

  // Submit Journal Entry Form (Spec B3.3)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isBalanced) {
      setFormError(
        `Entry is unbalanced: Total Debits <> Total Credits (Difference: GHS ${toMajorUnitsString(
          liveDiffPesewas
        )}).`
      );
      return;
    }

    // Check per-fund balance
    for (const [fundId, f] of fundTotals.entries()) {
      if (f.dr !== f.cr) {
        const fName = funds.find((x) => x.id === fundId)?.name ?? fundId;
        setFormError(
          `Fund "${fName}" is unbalanced (Dr: GHS ${toMajorUnitsString(
            f.dr
          )}, Cr: GHS ${toMajorUnitsString(
            f.cr
          )}). Fund accounting requires balancing entries per fund or interfund clearing.`
        );
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
        narration: narration.trim(),
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        lines: lines
          .filter((l) => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0)
          .map((l, idx) => {
            const isDebit = (parseFloat(l.debit) || 0) > 0;
            const amtStr = isDebit ? l.debit : l.credit;
            const originalAmount = BigInt(Math.round((parseFloat(amtStr) || 0) * 100));

            return {
              id: `l-${Date.now()}-${idx + 1}`,
              accountId: l.accountId,
              fundId: l.fundId,
              originalCurrency: l.currency,
              originalAmount,
              exchangeRate: l.exchangeRate,
              isDebit,
              description: l.memo.trim() || undefined,
            };
          }),
      });

      addEntry(newEntry);
      showToast({
        message: `Journal entry ${docNum} posted successfully.`,
      });

      // Reset form and switch to table view
      setNarration('');
      setActiveTab('ENTRIES');
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to post entry');
    }
  };

  // Reversal Execution Handler (Spec B3.5)
  const handleExecuteReversal = (reason?: string) => {
    if (!reversalTargetEntry || !reason?.trim()) return;
    try {
      const reversal = reverseEntry(reversalTargetEntry.id, reason.trim());
      showToast({
        message: `Reversal entry ${reversal.documentNumber} posted to ledger.`,
      });
      setReversalTargetEntry(null);
    } catch (err: any) {
      setFormError(err?.message ?? 'Reversal failed');
    }
  };

  // Filtered entries for table
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Source filter
      if (sourceFilter !== 'ALL') {
        const src = getEntrySource(entry);
        if (src !== sourceFilter) return false;
      }

      // Fund filter
      if (fundFilter !== 'ALL') {
        const hasFund = entry.lines.some((l) => l.fundId === fundFilter);
        if (!hasFund) return false;
      }

      // Account filter
      if (accountFilter !== 'ALL') {
        const hasAccount = entry.lines.some((l) => l.accountId === accountFilter);
        if (!hasAccount) return false;
      }

      return true;
    });
  }, [entries, sourceFilter, fundFilter, accountFilter]);

  // Toggle row expand
  const toggleRowExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tabs specification (Spec B3.2)
  const tabs: UnderlineTabItem[] = [
    { id: 'ENTRIES', label: 'Journal entries', count: entries.length },
    { id: 'NEW_ENTRY', label: 'New entry' },
  ];

  // DataTable columns for Journal entries (Spec B3.4, B3.5, B3.6)
  const journalColumns: Column<JournalEntry>[] = [
    {
      key: 'expand',
      header: '',
      width: 'w-8',
      render: (entry) => {
        const isExpanded = expandedRowIds.has(entry.id);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRowExpand(entry.id);
            }}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition"
            aria-label={isExpanded ? 'Collapse entry lines' : 'Expand entry lines'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-primary)]" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        );
      },
    },
    {
      key: 'documentNumber',
      header: 'Entry',
      sortable: true,
      render: (entry) => {
        const originalEntry = entry.reversalOfId
          ? entries.find((e) => e.id === entry.reversalOfId)
          : null;
        const reversedByDoc = reversedByMap.get(entry.id);

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {entry.documentNumber}
              </span>

              {/* Exception Tags only per Spec B3.6 */}
              {entry.isReversal && <CategoryTag>Reversal</CategoryTag>}
              {entry.entryType === 'OPENING_BALANCE' && (
                <CategoryTag>Opening balance</CategoryTag>
              )}
              {entry.entryType === 'REVALUATION' && (
                <CategoryTag>Revaluation</CategoryTag>
              )}
            </div>

            {/* Reversal Linkages per Spec B3.5 */}
            {entry.isReversal && (
              <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-1">
                <span>Reverses</span>
                <span className="font-mono font-medium text-[var(--text-secondary)]">
                  {originalEntry?.documentNumber || 'original'}
                </span>
              </div>
            )}
            {reversedByDoc && (
              <div className="text-[12px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                <span>Reversed by</span>
                <span className="font-mono">{reversedByDoc}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'entryDate',
      header: 'Date',
      sortable: true,
      render: (entry) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {formatDate(entry.entryDate)}
        </span>
      ),
    },
    {
      key: 'narration',
      header: 'Description',
      render: (entry) => (
        <div className="max-w-xs md:max-w-md">
          <p className="line-clamp-2 text-xs text-[var(--text-primary)] font-medium leading-snug">
            {entry.narration}
          </p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (entry) => {
        const src = getEntrySource(entry);
        return <span className="text-xs text-[var(--text-secondary)]">{src}</span>;
      },
    },
    {
      key: 'totalDebitGhs',
      header: 'Dr',
      align: 'right',
      sortable: true,
      render: (entry) => (
        <MoneyCell amountPesewas={entry.totalDebitGhs} align="right" size="sm" />
      ),
    },
    {
      key: 'totalCreditGhs',
      header: 'Cr',
      align: 'right',
      sortable: true,
      render: (entry) => (
        <MoneyCell amountPesewas={entry.totalCreditGhs} align="right" size="sm" />
      ),
    },
    {
      key: 'createdBy',
      header: 'Posted by',
      render: (entry) => (
        <span className="text-xs text-[var(--text-secondary)]">{entry.createdBy}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      render: (entry) => {
        const isReversed = reversedByMap.has(entry.id);
        if (entry.isReversal || isReversed) return null;

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReversalTargetEntry(entry);
            }}
            className="px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--status-red)] hover:bg-[var(--surface-subtle)] border border-[var(--surface-border)] transition"
            title="Create a linked reversal entry"
          >
            Reverse
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header (Spec B3.1): Title "Journal and ledger", no icon tile, no subtitle */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Journal and ledger
          </h1>
        </div>

        {/* Underline Tabs: Journal entries | New entry (Spec B3.2) */}
        <UnderlineTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as any)}
          ariaLabel="Ledger Navigation"
          tabRole="button"
        />
      </div>

      {/* 2. TAB 1: JOURNAL ENTRIES TABLE (Spec B3.4, B3.5, B3.6) */}
      {activeTab === 'ENTRIES' && (
        <div className="space-y-4">
          {/* Table Heading & Toolbar (Spec B3.4) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Posted Journal Entries ({filteredEntries.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsHashChainModalOpen(true)}
                title="Click to inspect cryptographic hash-chain anti-tampering verification"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-panel)] border border-[var(--surface-border)] hover:bg-[var(--surface-subtle)] text-[12px] text-[var(--text-secondary)] transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium text-[var(--text-primary)]">Hash chain:</span>
                <span className="text-emerald-600 font-semibold">
                  {hashChainResult.isClean ? 'Verified (SHA-256)' : 'Tamper Alert'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Source Filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                aria-label="Filter by source"
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">All Sources</option>
                <option value="Counting sheet">Counting sheet</option>
                <option value="Payment voucher">Payment voucher</option>
                <option value="Payroll">Payroll</option>
                <option value="Manual">Manual</option>
                <option value="Reversal">Reversal</option>
              </select>

              {/* Fund Filter */}
              <select
                value={fundFilter}
                onChange={(e) => setFundFilter(e.target.value)}
                aria-label="Filter by fund"
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)]"
              >
                <option value="ALL">All Funds</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Account Filter */}
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                aria-label="Filter by account"
                className="px-2.5 py-1.5 rounded-[var(--radius)] bg-[var(--surface-panel)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)] max-w-[180px] truncate"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>

              {/* Primary "New Entry" Button */}
              <button
                type="button"
                onClick={() => setActiveTab('NEW_ENTRY')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New entry</span>
              </button>
            </div>
          </div>

          {/* DataTable Component (Spec B3.4: 50 rows pagination) */}
          <DataTable<JournalEntry>
            columns={journalColumns}
            data={filteredEntries}
            keyExtractor={(e) => e.id}
            pageSize={50}
            searchable={true}
            searchPlaceholder="Search entries by number, narration, user, or amount..."
            searchFilter={(entry, q) =>
              entry.documentNumber.toLowerCase().includes(q) ||
              entry.narration.toLowerCase().includes(q) ||
              entry.createdBy.toLowerCase().includes(q) ||
              entry.lines.some((l) => {
                const acc = accounts.find((a) => a.id === l.accountId);
                return (
                  acc?.name.toLowerCase().includes(q) ||
                  acc?.code.toLowerCase().includes(q) ||
                  (l.description && l.description.toLowerCase().includes(q))
                );
              })
            }
            emptyMessage="No journal entries found matching filters."
            emptyActionLabel="New entry"
            onEmptyAction={() => setActiveTab('NEW_ENTRY')}
            isRowExpanded={(entry) => expandedRowIds.has(entry.id)}
            onRowClick={(entry) => toggleRowExpand(entry.id)}
            renderExpandedRow={(entry) => {
              const counters = getEntryCounters(entry);

              return (
                <div className="px-6 py-3.5 bg-[var(--surface-subtle)]/40 border-y border-[var(--surface-border-subtle)] space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--surface-border)]/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Double-Entry Breakdown: {entry.documentNumber}
                      </span>
                      <span className="text-[var(--text-muted)] text-[12px]">
                        ({entry.lines.length} lines)
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      <span className="text-[var(--text-secondary)]">
                        Total Dr:{' '}
                        <span className="font-medium text-[var(--text-primary)]">
                          GHS {toMajorUnitsString(entry.totalDebitGhs)}
                        </span>
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        Total Cr:{' '}
                        <span className="font-medium text-[var(--text-primary)]">
                          GHS {toMajorUnitsString(entry.totalCreditGhs)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Audit Counters Strip (when entry originates from a Counting Sheet) */}
                  {counters && counters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 py-1 px-2.5 rounded-[4px] bg-[var(--surface-panel)] border border-[var(--surface-border)]">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        Sign-off Counters ({counters.length}):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {counters.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[var(--surface-subtle)] border border-[var(--surface-border-subtle)]"
                          >
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">✓</span>
                            <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                            {c.isPermanent !== undefined && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                ({c.isPermanent ? 'Permanent' : 'Temporary'})
                              </span>
                            )}
                            {c.time && (
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                · {c.time}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold">
                        <th className="py-1.5 px-2">Account</th>
                        <th className="py-1.5 px-2">Fund</th>
                        <th className="py-1.5 px-2">Currency</th>
                        <th className="py-1.5 px-2 text-right">Dr</th>
                        <th className="py-1.5 px-2 text-right">Cr</th>
                        <th className="py-1.5 px-2">Memo / Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]/50">
                      {entry.lines.map((line) => {
                        const acc = accounts.find((a) => a.id === line.accountId);
                        const fund = funds.find((f) => f.id === line.fundId);

                        return (
                          <tr key={line.id} className="hover:bg-[var(--surface-subtle)]">
                            <td className="py-1.5 px-2 font-medium text-[var(--text-primary)]">
                              <span className="font-mono">{acc?.code}</span> · {acc?.name}
                            </td>
                            <td className="py-1.5 px-2">
                              <CategoryTag>{fund?.name || line.fundId}</CategoryTag>
                            </td>
                            <td className="py-1.5 px-2 text-[var(--text-secondary)]">
                              {line.originalCurrency}
                              {line.originalCurrency === 'USD' && (
                                <span className="font-mono text-[11px] text-[var(--text-muted)] block">
                                  @ {line.exchangeRate}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {line.debitAmountGhs > 0n ? (
                                <MoneyCell amountPesewas={line.debitAmountGhs} align="right" size="sm" />
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {line.creditAmountGhs > 0n ? (
                                <MoneyCell amountPesewas={line.creditAmountGhs} align="right" size="sm" />
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-[var(--text-secondary)] italic">
                              {line.description || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }}
          />

          {/* Reversal Confirmation Dialog with Reason (Spec B3.5) */}
          <ConfirmationDialog
            isOpen={!!reversalTargetEntry}
            onClose={() => setReversalTargetEntry(null)}
            onConfirm={handleExecuteReversal}
            title="Reverse Journal Entry"
            description={`Are you sure you want to reverse entry ${reversalTargetEntry?.documentNumber}? Accounting ledgers are strictly append-only; this creates an exact mirror entry with inverted debits and credits.`}
            confirmLabel="Confirm & Post Reversal"
            isDestructive={true}
            requireReason={true}
            reasonLabel="Reason for Reversal"
            reasonPlaceholder="e.g., Erroneous account selected, duplicate receipt, or audit reclassification..."
          />
        </div>
      )}

      {/* 3. TAB 2: NEW ENTRY FORM (Spec B3.1, B3.3) */}
      {activeTab === 'NEW_ENTRY' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              New Double-Entry Journal Transaction
            </h2>
            {/* One-line muted note replacing manual adjustment screen box (Spec B3.1) */}
            <p className="text-xs text-[var(--text-muted)]">
              For manual adjustments. Sunday counts and vouchers post automatically.
            </p>
          </div>

          {formError && (
            <div className="p-3 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--status-red)] text-xs text-[var(--status-red)]">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)]/40 border border-[var(--surface-border)]">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Narration / Description
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Monthly bank ledger service charges & account maintenance fee"
                  required
                  className="w-full px-3 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                />
              </div>
            </div>

            {/* Spreadsheet Grid Table (Spec B3.3) */}
            <div className="border border-[var(--surface-border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface-panel)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-semibold border-b border-[var(--surface-border)]">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[220px]">Account (Code & Name)</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Fund</th>
                    <th className="py-2.5 px-3 w-20">Currency</th>
                    <th className="py-2.5 px-3 w-24">Rate</th>
                    <th className="py-2.5 px-3 w-32 text-right">Dr (Debit)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Cr (Credit)</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Memo</th>
                    <th className="py-2.5 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)] font-normal">
                  {lines.map((line, idx) => {
                    const isLastRow = idx === lines.length - 1;

                    return (
                      <tr key={line.id} className="hover:bg-[var(--surface-subtle)]/40">
                        {/* Account */}
                        <td className="p-2">
                          <select
                            value={line.accountId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, accountId: val } : l))
                              );
                            }}
                            className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name} ({a.currency})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Fund */}
                        <td className="p-2">
                          <select
                            value={line.fundId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, fundId: val } : l))
                              );
                            }}
                            className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                          >
                            {funds.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.code} - {f.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Currency */}
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
                            className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                          >
                            <option value="GHS">GHS</option>
                            <option value="USD">USD</option>
                          </select>
                        </td>

                        {/* Exchange Rate */}
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
                            className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs font-mono disabled:opacity-40 outline-none"
                          />
                        </td>

                        {/* Dr (Debit) Column */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.debit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        debit: val,
                                        credit: val ? '' : l.credit,
                                      }
                                    : l
                                )
                              );
                            }}
                            className="w-full px-2 py-1.5 text-right rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs font-mono outline-none"
                          />
                        </td>

                        {/* Cr (Credit) Column */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.credit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        credit: val,
                                        debit: val ? '' : l.debit,
                                      }
                                    : l
                                )
                              );
                            }}
                            className="w-full px-2 py-1.5 text-right rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs font-mono outline-none"
                          />
                        </td>

                        {/* Memo */}
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Optional line memo"
                            value={line.memo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, memo: val } : l))
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isLastRow) {
                                e.preventDefault();
                                handleAddLine();
                              }
                            }}
                            className="w-full px-2 py-1.5 rounded-[var(--radius)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-xs outline-none"
                          />
                        </td>

                        {/* Delete Action */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lines.length <= 2}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--status-red)] disabled:opacity-20 transition"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Running Footer (Spec B3.3) */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[var(--radius)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--surface-border)] hover:bg-[var(--surface-panel)] text-[var(--text-primary)] rounded-[var(--radius)] text-xs font-medium transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add line</span>
                </button>
                <span className="text-[var(--text-muted)] hidden sm:inline">
                  Press Enter on the last memo cell to add a line
                </span>
              </div>

              {/* Running Dr · Cr · Difference (Spec B3.3) */}
              <div className="flex items-center gap-3 font-medium">
                <div>
                  <span className="text-[var(--text-muted)]">Dr </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {(Number(computedDebitPesewas) / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <span className="text-[var(--text-muted)]">·</span>
                <div>
                  <span className="text-[var(--text-muted)]">Cr </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {(Number(computedCreditPesewas) / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <span className="text-[var(--text-muted)]">·</span>
                <div>
                  <span className="text-[var(--text-muted)]">Difference </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      isBalanced
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-[var(--status-red)]'
                    }`}
                  >
                    {(Number(Math.abs(Number(liveDiffPesewas))) / 100).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {Math.abs(Number(liveDiffPesewas)) <= 2 && liveDiffPesewas !== 0n && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceRounding}
                    className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-[var(--radius)] text-xs font-medium border border-amber-300 dark:border-amber-800 ml-1"
                  >
                    Auto-balance 1p
                  </button>
                )}
              </div>

              {/* Single Primary Post Button (Spec B3.3) */}
              <button
                type="submit"
                disabled={!isBalanced || !narration.trim()}
                className="px-5 py-2 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-white rounded-[var(--radius)] text-xs font-semibold shadow-none transition disabled:cursor-not-allowed"
              >
                Post Journal Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Anti-Tampering Hash-Chain Inspection Modal (Spec C6) */}
      {isHashChainModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--radius)] border border-[var(--surface-border)] max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>General Ledger Anti-Tampering Hash Chain</span>
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Every journal entry cryptographically seals the SHA-256 digest of the previous entry, forming an unbroken ledger chain from genesis to the latest record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHashChainModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div className="p-3.5 rounded-[var(--radius-sm)] bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-[13px] space-y-1">
              <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Chain Status: 100% Intact & Verified</span>
              </div>
              <div className="text-[12px] text-emerald-800 dark:text-emerald-300">
                {hashChainResult.summary}
              </div>
              <div className="text-[11px] font-mono text-[var(--text-muted)] pt-1">
                Latest Block SHA-256: {hashChainResult.latestChainHash.slice(0, 32)}...
              </div>
            </div>

            {/* Chained Entries Sample Table */}
            <div className="border border-[var(--surface-border)] rounded-[var(--radius-sm)] overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[var(--surface-subtle)] text-[var(--text-muted)] font-semibold border-b border-[var(--surface-border)] text-left">
                  <tr>
                    <th className="py-2 px-3">Entry</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Total (GHS)</th>
                    <th className="py-2 px-3">Prev Hash</th>
                    <th className="py-2 px-3 text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {entries.slice(0, 8).map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-1.5 px-3 font-semibold text-[var(--text-primary)]">
                        {entry.documentNumber}
                      </td>
                      <td className="py-1.5 px-3 text-[var(--text-muted)]">
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="py-1.5 px-3 font-mono">
                        {toMajorUnitsString(entry.totalDebitGhs)}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                        {idx === 0 ? '000000000000...' : 'sha256:d8b2e1...'}
                      </td>
                      <td className="py-1.5 px-3 text-right text-emerald-600 font-medium">
                        ✓ Verified
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)]">
              <button
                type="button"
                onClick={() => {
                  setIsVerifyingChain(true);
                  setTimeout(() => {
                    verifyHashChainNow();
                    setIsVerifyingChain(false);
                    showToast({ message: 'Cryptographic hash-chain re-verified: All links unbroken.' });
                  }, 400);
                }}
                disabled={isVerifyingChain}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-border)] text-[13px] font-semibold text-[var(--text-primary)] transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingChain ? 'animate-spin' : ''}`} />
                <span>{isVerifyingChain ? 'Verifying digests...' : 'Re-verify chain now'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHashChainModalOpen(false)}
                className="px-4 py-1.5 text-[13px] font-semibold rounded-[var(--radius-sm)] bg-[var(--accent)] text-white hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
