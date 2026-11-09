import React, { useState, useMemo, useContext } from 'react';
import {
  ArrowLeft,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Paperclip,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  generateOpeningBalanceCsvTemplate,
  parseOpeningBalanceCsv,
  runOpeningBalanceDryRun,
  commitOpeningBalances,
  type OpeningBalanceRowInput,
  type StatementOrCashProofInput,
} from '@church/domain';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { formatDate, formatMoneyAmount } from '../../config/churchSettings.js';
import { DateInput } from '../ui/DateInput.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

export const OpeningBalancesPage: React.FC = () => {
  const {
    accounts,
    funds,
    selectedFinancialYear,
    currentYearPeriods,
    entries,
    openingBalanceBatch,
    recordOpeningBalanceBatch,
  } = useLedger();
  const { currentUser } = useAuth();
  const { pledges } = useGiving();
  const { goBack, navigateToTab } = useRouter();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  const [cutOverDate, setCutOverDate] = useState<string>('2026-01-01');
  const [activeStage, setActiveStage] = useState<'EDIT_AND_VALIDATE' | 'DRY_RUN'>('EDIT_AND_VALIDATE');

  // Seed default rows from the official template so the Treasurer can immediately inspect, edit, or upload a CSV
  const [rows, setRows] = useState<OpeningBalanceRowInput[]>(() => [
    ...parseOpeningBalanceCsv(generateOpeningBalanceCsvTemplate('2026-01-01')),
  ]);

  // Statement & Cash Count Proofs (Spec B2: bank, MoMo and cash balances agree with last bank statement and last cash count)
  const [statementProofs, setStatementProofs] = useState<StatementOrCashProofInput[]>([
    {
      accountCode: '1010',
      statementOrCountBalanceGhs: 450000n, // GHS 4,500.00
      statementDate: '2026-01-01',
      reference: 'Safe Cash Count Sheet #CC-2025-12',
      attachmentFileName: 'safe_cash_count_31dec2025.pdf',
    },
    {
      accountCode: '1030',
      statementOrCountBalanceGhs: 7050000n, // GHS 70,500.00 (28,500 GEN + 42,000 BLD)
      statementDate: '2026-01-01',
      reference: 'GCB Bank Statement #104 (Ring Road Branch)',
      attachmentFileName: 'gcb_bank_stmt_dec2025.pdf',
    },
    {
      accountCode: '1050',
      statementOrCountBalanceGhs: 620000n, // GHS 6,200.00
      statementDate: '2026-01-01',
      reference: 'MTN MoMo Merchant Statement #MM-12',
      attachmentFileName: 'mtn_momo_stmt_dec2025.pdf',
    },
    {
      accountCode: '1020',
      statementOrCountBalanceGhs: 310000n, // $200.00 @ 15.5000 = GHS 3,100.00
      statementDate: '2026-01-01',
      reference: 'USD Physical Safe Count ($200.00 @ 15.5000)',
      attachmentFileName: 'usd_safe_count_dec2025.pdf',
    },
  ]);

  const [payablesScheduleGhs, setPayablesScheduleGhs] = useState<string>('1200.00');

  // Commit Approval Modal State
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [treasurerSigner, setTreasurerSigner] = useState('Kofi Mensah (Treasurer)');
  const [pastorApprover, setPastorApprover] = useState('Rev. Emmanuel Addo (Senior Pastor / Elder)');
  const [commitError, setCommitError] = useState<string | null>(null);

  useModalEscape(isCommitModalOpen, () => setIsCommitModalOpen(false));

  const openPledgesSummary = useMemo(() => {
    const activePledges = pledges.filter((p) => p.status === 'ACTIVE');
    let totalOutstandingPesewas = 0n;
    for (const p of activePledges) {
      const rem = p.targetAmountPesewas - p.paidAmountPesewas;
      if (rem > 0n) totalOutstandingPesewas += rem;
    }
    return {
      count: activePledges.length,
      totalOutstandingPesewas,
      items: activePledges,
    };
  }, [pledges]);

  const payablesSchedulePesewas = useMemo(() => {
    const num = Number(payablesScheduleGhs.replace(/,/g, ''));
    return !isNaN(num) && num >= 0 ? BigInt(Math.round(num * 100)) : 0n;
  }, [payablesScheduleGhs]);

  const firstOpenPeriod = useMemo(
    () => currentYearPeriods.find((p) => !p.isClosed && p.status !== 'CLOSED') ?? currentYearPeriods[0] ?? null,
    [currentYearPeriods]
  );

  // Live Dry Run & Validation Report
  const dryRun = useMemo(
    () =>
      runOpeningBalanceDryRun({
        rows,
        cutOverDate,
        branchId: currentUser.branchId,
        financialYearId: selectedFinancialYear.id,
        period: firstOpenPeriod,
        accounts,
        funds,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        existingEntries: entries,
        proofs: {
          statementAndCashProofs: statementProofs,
          payablesScheduleTotalGhs: payablesSchedulePesewas,
        },
      }),
    [
      rows,
      cutOverDate,
      currentUser.branchId,
      currentUser.fullName,
      currentUser.deviceId,
      selectedFinancialYear.id,
      firstOpenPeriod,
      accounts,
      funds,
      entries,
      statementProofs,
      payablesSchedulePesewas,
    ]
  );

  const { validation } = dryRun;

  // Download CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = generateOpeningBalanceCsvTemplate(cutOverDate);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calvary_crystal_opening_balances_${cutOverDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Opening balances CSV template downloaded', 'success');
  };

  // Upload CSV File
  const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      const parsed = parseOpeningBalanceCsv(content);
      if (parsed.length > 0) {
        setRows([...parsed]);
        showToast(`Loaded ${parsed.length} rows from ${file.name}`, 'success');
      } else {
        showToast('Could not parse rows from CSV file. Check column headers.', 'warning');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateRow = (index: number, patch: Partial<OpeningBalanceRowInput>) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, ...patch } : r))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowNumber: prev.length + 1,
        accountCode: '1010',
        fundCode: 'GEN',
        currency: 'GHS',
        debitOriginalMinor: 0n,
        creditOriginalMinor: 0n,
        exchangeRate: '1.0000',
        rateDate: cutOverDate,
        description: 'Opening balance line',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((r, idx) => ({ ...r, rowNumber: idx + 1 }))
    );
  };

  const handleResetToBalancedSample = () => {
    setRows([...parseOpeningBalanceCsv(generateOpeningBalanceCsvTemplate(cutOverDate))]);
    showToast('Restored balanced cut-over sample rows', 'neutral');
  };

  const handleUpdateStatementProof = (
    accountCode: string,
    newMajorAmountStr: string
  ) => {
    const num = Number(newMajorAmountStr.replace(/,/g, ''));
    const pesewas = !isNaN(num) && num >= 0 ? BigInt(Math.round(num * 100)) : 0n;
    setStatementProofs((prev) =>
      prev.map((p) =>
        p.accountCode === accountCode ? { ...p, statementOrCountBalanceGhs: pesewas } : p
      )
    );
  };

  const handleCommitBatch = () => {
    setCommitError(null);
    try {
      const committedEntries = commitOpeningBalances({
        dryRun,
        treasurerSignedBy: treasurerSigner,
        pastorOrElderApprovedBy: pastorApprover,
      });
      recordOpeningBalanceBatch({
        entries: committedEntries,
        cutOverDate,
        treasurerSignedBy: treasurerSigner,
        pastorApprovedBy: pastorApprover,
      });
      setIsCommitModalOpen(false);
      showToast(
        `Posted ${committedEntries.length} balanced opening balance entries (one per fund) dated ${formatDate(cutOverDate)}`,
        'success'
      );
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Could not commit opening balances');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Settings</span>
          </button>
          <div className="text-[13px] text-[var(--text-muted)]">
            <button onClick={() => navigateToTab('settings')} className="hover:underline">
              Settings
            </button>
            <span className="mx-1.5">/</span>
            <span className="text-[var(--text-primary)] font-semibold">
              Opening balances and cut-over
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded text-[12px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Setup window open (pre-go-live)
          </span>
          {openingBalanceBatch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Committed ({openingBalanceBatch.batchNumber} on {formatDate(openingBalanceBatch.cutOverDate)})
            </span>
          )}
        </div>
      </div>

      {/* Header & Cut-Over Date Principle (Spec B1 & B2) */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">
            Opening balances and cut-over from old books
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            From the cut-over date below, Calvary Crystal Church uses this system as the book of record while earlier books remain as an archive. Debits must equal credits overall and within every fund (differences are never plugged automatically), and cash, bank, and MoMo balances must agree with your last statements and cash counts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
              Cut-over date ({selectedFinancialYear.label})
            </label>
            <div className="w-44">
              <DateInput
                value={cutOverDate}
                onChange={(val) => setCutOverDate(val)}
                aria-label="Cut-over date"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV template</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleUploadCsv}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Stage Switcher: 1. Enter & Validate vs 2. Dry Run Preview & Commit */}
      <div className="flex items-center justify-between border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveStage('EDIT_AND_VALIDATE')}
            className={`pb-2.5 text-[14px] font-semibold border-b-2 transition-colors ${
              activeStage === 'EDIT_AND_VALIDATE'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            1. Opening balance lines & statement reconciliation ({rows.length} rows)
          </button>
          <button
            onClick={() => setActiveStage('DRY_RUN')}
            className={`pb-2.5 text-[14px] font-semibold border-b-2 transition-colors ${
              activeStage === 'DRY_RUN'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            2. Dry run preview & resulting trial balance ({dryRun.proposedEntriesByFund.length} fund entries)
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button
            onClick={handleResetToBalancedSample}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset sample rows</span>
          </button>
          <button
            onClick={() => setIsCommitModalOpen(true)}
            disabled={!validation.isValid}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Commit opening balances</span>
          </button>
        </div>
      </div>

      {/* Validation Status Summary Strip */}
      <div
        className={`p-4 rounded-[var(--radius)] border flex flex-wrap items-center justify-between gap-4 ${
          validation.isValid
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {validation.isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0" />
          )}
          <div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">
              {validation.isValid
                ? 'All opening balance validations pass — ready for dry run and commit'
                : `${validation.rowDiagnostics.length} validation issue(s) must be resolved before posting`}
            </div>
            <div className="text-[13px] text-[var(--text-secondary)] font-sans tabular-nums">
              Total Debits: GHS {formatMoneyAmount(validation.totalDebitGhs)} · Total Credits: GHS{' '}
              {formatMoneyAmount(validation.totalCreditGhs)} · Overall Difference: GHS{' '}
              {formatMoneyAmount(validation.overallDifferenceGhs)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium">
          <span
            className={`px-2.5 py-1 rounded ${
              validation.allFundsBalanced
                ? 'bg-emerald-100/80 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            Per-fund balance: {validation.allFundsBalanced ? 'All funds balanced' : 'Fund imbalance found'}
          </span>
          <span
            className={`px-2.5 py-1 rounded ${
              validation.allStatementsAgree
                ? 'bg-emerald-100/80 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            Statements & cash counts: {validation.allStatementsAgree ? 'Agrees' : 'Difference found'}
          </span>
        </div>
      </div>

      {/* Plain-Language Validation Errors (if any) */}
      {validation.rowDiagnostics.length > 0 && (
        <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-rose-300 dark:border-rose-800 space-y-2">
          <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300">
            Validation report by row and fund
          </h2>
          <ul className="space-y-1.5 text-[13px] text-[var(--text-primary)]">
            {validation.rowDiagnostics.map((diag, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 shrink-0">
                  {diag.rowNumber > 0 ? `Row ${diag.rowNumber}` : 'Fund / Statement'}
                </span>
                <span>{diag.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeStage === 'EDIT_AND_VALIDATE' && (
        <div className="space-y-6">
          {/* 1. Per-Fund Balance Table (Spec B2: debits equal credits overall, and within each fund; never plugged automatically) */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Balance check by fund
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Every fund must self-balance on cut-over so restricted funds are never mixed with general funds.
                </p>
              </div>
            </div>

            <table className="w-full text-[13px] font-sans tabular-nums">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Fund</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Lines</th>
                  <th className="py-2 px-3 text-right">Total debit (GHS)</th>
                  <th className="py-2 px-3 text-right">Total credit (GHS)</th>
                  <th className="py-2 px-3 text-right">Difference (GHS)</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {validation.fundSummaries.map((f) => (
                  <tr key={f.fundId} className="hover:bg-[var(--surface-subtle)]">
                    <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                      {f.fundName} ({f.fundCode})
                    </td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{f.fundType}</td>
                    <td className="py-2 px-3 text-right text-[var(--text-secondary)]">{f.lineCount}</td>
                    <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                      {formatMoneyAmount(f.totalDebitGhs)}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                      {formatMoneyAmount(f.totalCreditGhs)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        f.isBalanced ? 'text-[var(--text-primary)]' : 'text-rose-700'
                      }`}
                    >
                      {formatMoneyAmount(f.differenceGhs)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ${
                          f.isBalanced
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {f.isBalanced ? 'Balanced' : 'Unbalanced'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Opening Balance Rows Table */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Opening balance rows
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  USD balances carry original USD amounts with a rate (cash and bank accounts only; fixed assets keep historical GHS cost).
                </p>
              </div>
              <button
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
              >
                <Plus className="w-4 h-4" />
                <span>Add line</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] font-sans tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Account</th>
                    <th className="py-2 px-2">Fund</th>
                    <th className="py-2 px-2">Currency</th>
                    <th className="py-2 px-2 text-right">Debit (original)</th>
                    <th className="py-2 px-2 text-right">Credit (original)</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2">Rate date</th>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2 px-2 text-[var(--text-muted)]">{r.rowNumber}</td>
                      <td className="py-2 px-2">
                        <select
                          value={r.accountCode}
                          onChange={(e) => handleUpdateRow(idx, { accountCode: e.target.value })}
                          className="px-2 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px]"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.code}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={r.fundCode}
                          onChange={(e) => handleUpdateRow(idx, { fundCode: e.target.value })}
                          className="px-2 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px]"
                        >
                          {funds.map((f) => (
                            <option key={f.id} value={f.code}>
                              {f.code} — {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={r.currency}
                          onChange={(e) =>
                            handleUpdateRow(idx, {
                              currency: e.target.value as 'GHS' | 'USD',
                              exchangeRate: e.target.value === 'GHS' ? '1.0000' : '15.5000',
                            })
                          }
                          className="px-2 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] text-[13px]"
                        >
                          <option value="GHS">GHS</option>
                          <option value="USD">USD</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={Number(r.debitOriginalMinor) / 100}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(Number(e.target.value || 0) * 100));
                            handleUpdateRow(idx, {
                              debitOriginalMinor: BigInt(val),
                              creditOriginalMinor: val > 0 ? 0n : r.creditOriginalMinor,
                            });
                          }}
                          className="w-28 px-2 py-1 text-right rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={Number(r.creditOriginalMinor) / 100}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(Number(e.target.value || 0) * 100));
                            handleUpdateRow(idx, {
                              creditOriginalMinor: BigInt(val),
                              debitOriginalMinor: val > 0 ? 0n : r.debitOriginalMinor,
                            });
                          }}
                          className="w-28 px-2 py-1 text-right rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="text"
                          disabled={r.currency === 'GHS'}
                          value={r.exchangeRate}
                          onChange={(e) => handleUpdateRow(idx, { exchangeRate: e.target.value })}
                          className="w-20 px-2 py-1 text-right rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] disabled:opacity-50 font-sans tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-2 text-[var(--text-secondary)]">
                        {formatDate(r.rateDate || cutOverDate)}
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={r.description ?? ''}
                          onChange={(e) => handleUpdateRow(idx, { description: e.target.value })}
                          className="w-full min-w-[180px] px-2 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          title="Remove row"
                          className="p-1 text-[var(--text-muted)] hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Bank, MoMo & Cash Statement Agreement + Sub-ledgers (Spec B2) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
              <div className="border-b border-[var(--surface-border)] pb-2">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Bank, MoMo and cash statement agreement
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Opening cash and bank balances must agree with the attached statement and last cash count.
                </p>
              </div>

              <table className="w-full text-[13px] font-sans tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                    <th className="py-2 px-2">Account & proof</th>
                    <th className="py-2 px-2 text-right">Opening ledger (GHS)</th>
                    <th className="py-2 px-2 text-right">Statement / count (GHS)</th>
                    <th className="py-2 px-2 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {validation.statementComparisons.map((sc) => (
                    <tr key={sc.accountCode}>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {sc.accountCode} — {sc.accountName}
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                          <Paperclip className="w-3 h-3" />
                          <span>{sc.reference}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-[var(--text-primary)]">
                        {formatMoneyAmount(sc.ledgerOpeningBalanceGhs)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={Number(sc.statementOrCountBalanceGhs) / 100}
                          onChange={(e) =>
                            handleUpdateStatementProof(sc.accountCode, e.target.value)
                          }
                          className="w-28 px-2 py-1 text-right rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {sc.agrees ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-emerald-50 text-emerald-800">
                            Agrees (0.00)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-semibold bg-rose-100 text-rose-800">
                            Diff: {formatMoneyAmount(sc.differenceGhs)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Open Pledges, Fixed Assets & Payables Cut-Over Summary */}
            <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
              <div className="border-b border-[var(--surface-border)] pb-2">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Sub-ledger schedules (pledges, fixed assets & payables)
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Verify that unpaid payables, fixed asset registers, and open member pledges agree at cut-over.
                </p>
              </div>

              <div className="space-y-3 text-[13px] font-sans tabular-nums">
                <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      Accounts payable schedule (2010)
                    </div>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      Unpaid supplier bills at cut-over date
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--text-muted)]">Schedule total (GHS):</span>
                    <input
                      type="text"
                      value={payablesScheduleGhs}
                      onChange={(e) => setPayablesScheduleGhs(e.target.value)}
                      className="w-24 px-2 py-1 text-right rounded border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)] font-sans tabular-nums"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Open pledges carried forward ({openPledgesSummary.count} active pledges)
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      GHS {formatMoneyAmount(openPledgesSummary.totalOutstandingPesewas)}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)]">
                    Open pledges by member and campaign roll forward as memo commitments without inflating general ledger assets until collected.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: DRY RUN PREVIEW & RESULTING TRIAL BALANCE */}
      {activeStage === 'DRY_RUN' && (
        <div className="space-y-6">
          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Proposed opening balance journal entries (one balanced entry per fund)
              </h2>
              <p className="text-[13px] text-[var(--text-muted)]">
                Each fund receives its own balanced opening entry dated {formatDate(cutOverDate)} and tagged "Opening balance".
              </p>
            </div>

            <div className="space-y-4">
              {dryRun.proposedEntriesByFund.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-[var(--text-primary)] font-sans tabular-nums">
                        {entry.documentNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Opening balance
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {entry.narration}
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] font-sans tabular-nums">
                      Dr GHS {formatMoneyAmount(entry.totalDebitGhs)} · Cr GHS{' '}
                      {formatMoneyAmount(entry.totalCreditGhs)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
            <div className="border-b border-[var(--surface-border)] pb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Resulting trial balance after dry run
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Preview of the general ledger Trial Balance once the opening balance batch is committed.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-[12px] font-semibold bg-emerald-50 text-emerald-800">
                {dryRun.resultingTrialBalance.isBalanced ? 'Trial balance agrees' : 'Unbalanced'}
              </span>
            </div>

            <table className="w-full text-[13px] font-sans tabular-nums">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Account name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Debit (GHS)</th>
                  <th className="py-2 px-3 text-right">Credit (GHS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {dryRun.resultingTrialBalance.accounts
                  .filter((a) => a.debitGhs > 0n || a.creditGhs > 0n)
                  .map((a) => (
                    <tr key={a.accountId}>
                      <td className="py-2 px-3 font-semibold">{a.accountCode}</td>
                      <td className="py-2 px-3">{a.accountName}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{a.accountType}</td>
                      <td className="py-2 px-3 text-right">{formatMoneyAmount(a.debitGhs)}</td>
                      <td className="py-2 px-3 text-right">{formatMoneyAmount(a.creditGhs)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Centred Confirmation Dialog for Committing Opening Balances */}
      {isCommitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="commit-ob-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2.5">
              <h3 id="commit-ob-title" className="text-base font-bold text-[var(--text-primary)]">
                Approve and commit opening balances
              </h3>
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <p className="text-[var(--text-secondary)]">
                This will post <strong>{dryRun.proposedEntriesByFund.length} balanced opening entries</strong> (one per fund) dated <strong>{formatDate(cutOverDate)}</strong> totalling <strong>GHS {formatMoneyAmount(validation.totalDebitGhs)}</strong>.
              </p>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Treasurer sign-off
                </label>
                <input
                  type="text"
                  value={treasurerSigner}
                  onChange={(e) => setTreasurerSigner(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-primary)] mb-1">
                  Pastor or Elder approval
                </label>
                <input
                  type="text"
                  value={pastorApprover}
                  onChange={(e) => setPastorApprover(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]"
                />
              </div>

              {commitError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[12px]">
                  {commitError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitBatch}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                Confirm and post opening balances
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
