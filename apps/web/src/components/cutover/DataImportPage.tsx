import React, { useState, useMemo, useContext } from 'react';
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  ShieldAlert,
  ChevronRight,
  Eye,
  X,
} from 'lucide-react';
import {
  IMPORT_TEMPLATES,
  getImportTemplate,
  parseGenericCsv,
  buildDefaultColumnMapping,
  validateAndDryRunImport,
  type ImportTemplateType,
  type ImportBatchRecord,
} from '@church/domain';
import { useLedger } from '../../context/LedgerContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { useGiving } from '../../context/GivingContext.js';
import { useRouter } from '../../context/RouterContext.js';
import { ToastContext } from '../../context/ToastContext.js';
import { formatDate, formatMoneyAmount } from '../../config/churchSettings.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const DataImportPage: React.FC<{ initialBatchId?: string }> = ({ initialBatchId }) => {
  const {
    accounts,
    funds,
    entries,
    selectedFinancialYear,
    currentYearPeriods,
    importBatches,
    commitImportBatch,
    reverseImportBatch,
    goLiveState,
  } = useLedger();
  const { currentUser } = useAuth();
  const { members } = useGiving();
  const { goBack, navigate, navigateToTab } = useRouter();
  const toastCtx = useContext(ToastContext);
  const showToast = toastCtx?.showToast ?? (() => {});

  const [selectedTemplateType, setSelectedTemplateType] = useState<ImportTemplateType>('MEMBERS');
  const [step, setStep] = useState<WizardStep>(1);

  const activeTemplate = useMemo(
    () => getImportTemplate(selectedTemplateType),
    [selectedTemplateType]
  );

  const [fileName, setFileName] = useState<string>('calvary_crystal_members_2026.csv');
  const [csvContent, setCsvContent] = useState<string>(() => getImportTemplate('MEMBERS').sampleCsv);

  // Saved column mappings per template in localStorage (Spec B3: "saved for the next time")
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(() => {
    const tpl = getImportTemplate('MEMBERS');
    const parsed = parseGenericCsv(tpl.sampleCsv);
    return { ...buildDefaultColumnMapping(tpl, parsed.headers) };
  });

  // Post-go-live override inputs (Spec B1: after go-live, imports require Treasurer + reason + Pastor/Elder approval)
  const [postGoLiveApprover, setPostGoLiveApprover] = useState('Rev. Emmanuel Addo (Senior Pastor / Elder)');
  const [postGoLiveReason, setPostGoLiveReason] = useState('');

  // Batch Reversal Modal
  const [batchToReverse, setBatchToReverse] = useState<ImportBatchRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Batch Detail Inspection (full-page sub-section or selected batch)
  const [inspectedBatchId, setInspectedBatchId] = useState<string | null>(initialBatchId ?? null);

  useModalEscape(Boolean(batchToReverse), () => setBatchToReverse(null));

  const parsedCsv = useMemo(() => parseGenericCsv(csvContent), [csvContent]);

  const firstOpenPeriod = useMemo(
    () => currentYearPeriods.find((p) => !p.isClosed && p.status !== 'CLOSED') ?? currentYearPeriods[0] ?? null,
    [currentYearPeriods]
  );

  const nextBatchNumber = `IMP-${String(importBatches.length + 1).padStart(4, '0')}`;

  const dryRunResult = useMemo(
    () =>
      validateAndDryRunImport({
        templateType: selectedTemplateType,
        fileName,
        csvContent,
        columnMapping,
        existingBatches: importBatches,
        existingMembers: members.map((m) => ({
          fullName: m.fullName || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim(),
          phone: m.phone || '',
          memberNumber: m.memberNumber || m.envelopeNumber,
        })),
        accounts,
        funds,
        existingEntries: entries,
        branchId: currentUser.branchId,
        financialYearId: selectedFinancialYear.id,
        period: firstOpenPeriod,
        cutOverDate: '2026-01-01',
        nextBatchNumber,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
      }),
    [
      selectedTemplateType,
      fileName,
      csvContent,
      columnMapping,
      importBatches,
      members,
      accounts,
      funds,
      entries,
      currentUser.branchId,
      currentUser.fullName,
      currentUser.deviceId,
      selectedFinancialYear.id,
      firstOpenPeriod,
      nextBatchNumber,
    ]
  );

  const handleSelectTemplate = (type: ImportTemplateType) => {
    setSelectedTemplateType(type);
    const tpl = getImportTemplate(type);
    const sample = tpl.sampleCsv;
    setCsvContent(sample);
    setFileName(`calvary_crystal_${type.toLowerCase()}_2026.csv`);

    const parsed = parseGenericCsv(sample);
    try {
      const savedJson = localStorage.getItem(`church_import_mapping_${type}`);
      if (savedJson) {
        const saved = JSON.parse(savedJson) as Record<string, string>;
        setColumnMapping(saved);
        return;
      }
    } catch {}
    setColumnMapping({ ...buildDefaultColumnMapping(tpl, parsed.headers) });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([activeTemplate.sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_${selectedTemplateType.toLowerCase()}_calvary_crystal.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${activeTemplate.label} CSV template downloaded`, 'success');
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      setFileName(file.name);
      setCsvContent(text);
      const parsed = parseGenericCsv(text);
      setColumnMapping({ ...buildDefaultColumnMapping(activeTemplate, parsed.headers) });
      setStep(2);
      showToast(`Uploaded ${file.name} (${parsed.rows.length} rows)`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveMappingAndContinue = () => {
    try {
      localStorage.setItem(`church_import_mapping_${selectedTemplateType}`, JSON.stringify(columnMapping));
    } catch {}
    setStep(3);
  };

  const handleCommitBatch = () => {
    try {
      const totalImpactGhs = dryRunResult.recordSummaries.reduce(
        (sum, s) => sum + s.totalAmountGhs,
        0n
      );
      const created = commitImportBatch({
        templateType: selectedTemplateType,
        fileName,
        fileSha256: dryRunResult.fileSha256,
        columnMapping,
        mappedRows: dryRunResult.mappedRows,
        proposedJournalEntries: dryRunResult.proposedJournalEntries,
        totalImpactGhs,
        postGoLiveApprovedBy: goLiveState.isLive ? postGoLiveApprover : undefined,
        postGoLiveReason: goLiveState.isLive ? postGoLiveReason : undefined,
      });
      setInspectedBatchId(created.id);
      setStep(1);
      showToast(
        `Committed batch ${created.batchNumber} (${created.rowCount} rows imported atomically)`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import commit failed', 'warning');
    }
  };

  const handleConfirmReverseBatch = () => {
    if (!batchToReverse) return;
    try {
      const reversed = reverseImportBatch(batchToReverse.id, reversalReason);
      setBatchToReverse(null);
      setReversalReason('');
      showToast(`Batch ${reversed.batchNumber} reversed in full`, 'neutral');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reverse batch', 'warning');
    }
  };

  const inspectedBatch = useMemo(
    () =>
      inspectedBatchId
        ? importBatches.find((b) => b.id === inspectedBatchId || b.batchNumber === inspectedBatchId) ?? null
        : null,
    [inspectedBatchId, importBatches]
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb & Header Navigation */}
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
              Data import tool (members, balances, assets & pledges)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('#/opening-balances')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
          >
            Opening balances
          </button>
          <button
            onClick={() => navigate('#/go-live')}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
          >
            Go-live readiness checklist
          </button>
        </div>
      </div>

      {/* Page Title & Cut-Over Principle Notice */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Data import and cut-over wizard
          </h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Import members, opening balances, fixed assets, open pledges, or non-posting prior giving history. Every batch is validated row-by-row, fingerprinted (SHA-256) to prevent duplicate uploads, and committed atomically as <span className="font-semibold text-[var(--text-primary)]">{nextBatchNumber}</span>.
          </p>
        </div>
      </div>

      {/* Template Selector Tabs */}
      <div className="p-4 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-[var(--text-primary)]">
            Select import template
          </span>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
          >
            <Download className="w-4 h-4" />
            <span>Download {activeTemplate.label} CSV template</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {IMPORT_TEMPLATES.map((tpl) => {
            const isSelected = tpl.type === selectedTemplateType;
            return (
              <button
                key={tpl.type}
                onClick={() => handleSelectTemplate(tpl.type)}
                className={`text-left p-3 rounded-[var(--radius-sm)] border transition ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                    : 'border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-card)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">
                    {tpl.label}
                  </span>
                  {tpl.isDiscouraged && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                      Discouraged
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-muted)] mt-1 line-clamp-2">
                  {tpl.description}
                </p>
              </button>
            );
          })}
        </div>

        {activeTemplate.isDiscouraged && activeTemplate.discouragedNote && (
          <div className="p-3 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[13px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>{activeTemplate.discouragedNote}</span>
          </div>
        )}
      </div>

      {/* 5-Step Import Wizard Stepper */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {(
              [
                { num: 1, title: '1. Upload CSV' },
                { num: 2, title: '2. Map columns' },
                { num: 3, title: '3. Validation report' },
                { num: 4, title: '4. Dry run & Trial Balance' },
                { num: 5, title: '5. Commit batch' },
              ] as const
            ).map((s, idx) => (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => setStep(s.num)}
                  className={`px-3 py-1.5 rounded-[var(--radius-sm)] font-semibold transition ${
                    step === s.num
                      ? 'bg-[var(--accent)] text-white'
                      : step > s.num
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s.title}
                </button>
                {idx < 4 && <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
              </React.Fragment>
            ))}
          </div>

          <span className="text-[12px] font-sans tabular-nums text-[var(--text-muted)]">
            File SHA-256: <strong className="text-[var(--text-primary)]">{dryRunResult.fileSha256.slice(0, 16)}…</strong>
          </span>
        </div>

        {/* STEP 1: UPLOAD CSV */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Step 1 — Upload or inspect {activeTemplate.label} CSV data
                </h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Uploading the exact same file twice is automatically refused by its SHA-256 fingerprint.
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Choose CSV file from computer</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                <div className="text-[12px] text-[var(--text-muted)]">Active file name</div>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--accent)]" />
                  <span>{fileName}</span>
                </div>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                <div className="text-[12px] text-[var(--text-muted)]">Detected rows & columns</div>
                <div className="font-semibold text-[var(--text-primary)] mt-0.5 font-sans tabular-nums">
                  {parsedCsv.rows.length} data rows · {parsedCsv.headers.length} columns
                </div>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                <div className="text-[12px] text-[var(--text-muted)]">Duplicate file check</div>
                <div className="font-semibold mt-0.5">
                  {dryRunResult.isDuplicateFile ? (
                    <span className="text-rose-600">
                      Refused — already imported in {dryRunResult.duplicateOfBatchNumber}
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Unique file fingerprint verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1">
                CSV content preview (you can also edit rows directly before mapping)
              </label>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[13px] font-sans tabular-nums text-[var(--text-primary)]"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                Continue to column mapping
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Step 2 — Map CSV headers to {activeTemplate.label} fields
              </h3>
              <p className="text-[13px] text-[var(--text-muted)]">
                Column mappings are saved automatically for the next time you import {activeTemplate.label}.
              </p>
            </div>

            <table className="w-full text-[13px] font-sans tabular-nums">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
                  <th className="py-2 px-3">System field</th>
                  <th className="py-2 px-3">Required</th>
                  <th className="py-2 px-3">Privacy protection</th>
                  <th className="py-2 px-3">Mapped CSV column</th>
                  <th className="py-2 px-3">First row sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {activeTemplate.requiredFields.map((field) => {
                  const mappedCol = columnMapping[field.key] ?? '';
                  const firstRowVal = mappedCol ? parsedCsv.rows[0]?.[mappedCol] ?? '' : '';
                  return (
                    <tr key={field.key} className="hover:bg-[var(--surface-subtle)]">
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        {field.label}
                      </td>
                      <td className="py-2.5 px-3">
                        {field.required ? (
                          <span className="text-rose-600 font-semibold">Required</span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Optional</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {field.containsPii ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)]">
                            Masked in error logs
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Standard</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          aria-label={`Map ${field.label}`}
                          value={mappedCol}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                        >
                          <option value="">— Unmapped —</option>
                          {parsedCsv.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {firstRowVal || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)]"
              >
                Back to upload
              </button>
              <button
                onClick={handleSaveMappingAndContinue}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                Save mapping & validate rows
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VALIDATION REPORT */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Step 3 — Row-by-row validation report (PII & phone numbers masked)
                </h3>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Imports are all-or-nothing: if any row has a blocking error, nothing is written to the database.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-sans tabular-nums">
                <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                  {dryRunResult.validRowCount} of {dryRunResult.totalRows} rows valid
                </span>
                <span
                  className={`px-2.5 py-1 rounded font-semibold border ${
                    dryRunResult.errorCount === 0
                      ? 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--surface-border)]'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {dryRunResult.errorCount} blocking {dryRunResult.errorCount === 1 ? 'error' : 'errors'}
                </span>
                {dryRunResult.warningCount > 0 && (
                  <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                    {dryRunResult.warningCount} {dryRunResult.warningCount === 1 ? 'warning' : 'warnings'}
                  </span>
                )}
              </div>
            </div>

            {dryRunResult.diagnostics.length === 0 ? (
              <div className="p-4 rounded-[var(--radius-sm)] bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-[13px] text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold">All {dryRunResult.totalRows} rows passed validation</div>
                  <div>No duplicate members, missing fields, or unbalanced fund lines detected. Ready for dry run.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {dryRunResult.diagnostics.map((diag, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-[var(--radius-sm)] border text-[13px] flex items-start gap-2.5 ${
                      diag.severity === 'ERROR'
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold mr-2">[{diag.severity}]</span>
                      <span>{diag.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)]"
              >
                Back to column mapping
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!dryRunResult.canCommit}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                Proceed to dry run & Trial Balance
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DRY RUN & TRIAL BALANCE */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Step 4 — Dry run preview: records to be created & resulting Trial Balance
              </h3>
              <p className="text-[13px] text-[var(--text-muted)]">
                Review the exact records that will be tagged with <strong className="text-[var(--text-primary)]">{nextBatchNumber}</strong> and the resulting Trial Balance before committing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dryRunResult.recordSummaries.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1 text-[13px]"
                >
                  <div className="text-[12px] text-[var(--text-muted)]">{rec.recordType}</div>
                  <div className="text-lg font-bold text-[var(--text-primary)] font-sans tabular-nums">
                    {rec.count} {rec.count === 1 ? 'record' : 'records'}
                    {rec.totalAmountGhs > 0n && (
                      <span className="ml-2 text-sm font-semibold text-[var(--text-secondary)]">
                        (GHS {formatMoneyAmount(rec.totalAmountGhs)})
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)]">{rec.notes}</div>
                </div>
              ))}

              <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1 text-[13px]">
                <div className="text-[12px] text-[var(--text-muted)]">Resulting Trial Balance status</div>
                <div className="text-lg font-bold text-[var(--text-primary)] font-sans tabular-nums flex items-center gap-2">
                  <span>
                    Dr GHS {formatMoneyAmount(dryRunResult.resultingTrialBalance.totalDebitsGhs)} = Cr GHS{' '}
                    {formatMoneyAmount(dryRunResult.resultingTrialBalance.totalCreditsGhs)}
                  </span>
                  {dryRunResult.resultingTrialBalance.isBalanced && (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 font-semibold">
                      Balanced
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Difference: GHS {formatMoneyAmount(dryRunResult.resultingTrialBalance.differenceGhs)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(3)}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)]"
              >
                Back to validation report
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!dryRunResult.canCommit}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                Continue to commit ({nextBatchNumber})
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: COMMIT BATCH */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-2 text-[13px]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Step 5 — All-or-nothing commit ({nextBatchNumber})
              </h3>
              <p className="text-[var(--text-secondary)]">
                Committing this batch will create <strong>{dryRunResult.totalRows}</strong> records from <strong>{fileName}</strong> and tag every created record with batch ID <strong>{nextBatchNumber}</strong>. You can reverse the entire batch in one action while the accounting period remains open.
              </p>
            </div>

            {goLiveState.isLive && (
              <div className="p-4 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3 text-[13px]">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Setup window is closed (system is live) — Pastor/Elder approval & reason required</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-primary)] mb-1">
                      Approving Pastor or Elder
                    </label>
                    <input
                      type="text"
                      value={postGoLiveApprover}
                      onChange={(e) => setPostGoLiveApprover(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-primary)] mb-1">
                      Written reason for post-go-live import
                    </label>
                    <input
                      type="text"
                      value={postGoLiveReason}
                      onChange={(e) => setPostGoLiveReason(e.target.value)}
                      placeholder="Explain why this import is needed after go-live..."
                      className="w-full px-3 py-1.5 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(4)}
                className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] text-[13px] font-medium text-[var(--text-secondary)]"
              >
                Back to dry run
              </button>
              <button
                onClick={handleCommitBatch}
                disabled={!dryRunResult.canCommit}
                className="px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                Commit import batch {nextBatchNumber}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Committed Import Batches History Table (with Batch Inspection & One-Click Reversal) */}
      <div className="p-5 rounded-[var(--radius)] bg-[var(--surface-card)] border border-[var(--surface-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Import batch history
            </h2>
            <p className="text-[13px] text-[var(--text-muted)]">
              Every import batch is tagged (<code className="font-sans font-semibold">IMP-0001</code>) and can be reversed in one action while its accounting period is open.
            </p>
          </div>
        </div>

        <table className="w-full text-[13px] font-sans tabular-nums">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)] font-semibold text-left">
              <th className="py-2 px-3">Batch ID</th>
              <th className="py-2 px-3">Template</th>
              <th className="py-2 px-3">File name</th>
              <th className="py-2 px-3 text-right">Rows</th>
              <th className="py-2 px-3 text-right">Financial impact</th>
              <th className="py-2 px-3">Committed by</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {importBatches.map((batch) => {
              const tpl = getImportTemplate(batch.templateType);
              return (
                <tr key={batch.id} className="hover:bg-[var(--surface-subtle)]">
                  <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                    {batch.batchNumber}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-primary)]">{tpl.label}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{batch.fileName}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{batch.rowCount}</td>
                  <td className="py-2.5 px-3 text-right">
                    {batch.totalImpactGhs > 0n
                      ? `GHS ${formatMoneyAmount(batch.totalImpactGhs)}`
                      : 'Memo / Directory'}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{batch.committedBy}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                    {formatDate(batch.committedAt.slice(0, 10))}
                  </td>
                  <td className="py-2.5 px-3">
                    {batch.status === 'COMMITTED' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        Committed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Reversed
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setInspectedBatchId(inspectedBatchId === batch.id ? null : batch.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{inspectedBatchId === batch.id ? 'Hide records' : 'Inspect'}</span>
                      </button>
                      {batch.status === 'COMMITTED' && (
                        <button
                          onClick={() => {
                            setBatchToReverse(batch);
                            setReversalReason('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 text-[12px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverse batch</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Inline Full-Width Batch Inspection Section (No Drawers!) */}
        {inspectedBatch && (
          <div className="mt-4 p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3 text-[13px]">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <div>
                <span className="font-bold text-[var(--text-primary)]">
                  Batch {inspectedBatch.batchNumber} — {inspectedBatch.fileName}
                </span>
                <span className="ml-3 text-[12px] text-[var(--text-muted)] font-sans tabular-nums">
                  SHA-256: {inspectedBatch.fileSha256.slice(0, 24)}…
                </span>
              </div>
              <button
                onClick={() => setInspectedBatchId(null)}
                className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Close inspection
              </button>
            </div>

            <div className="text-[12px] text-[var(--text-secondary)]">
              Tagged record IDs: <strong className="text-[var(--text-primary)]">{inspectedBatch.createdRecordIds.join(', ')}</strong>
              {inspectedBatch.status === 'REVERSED' && (
                <span className="ml-3 text-rose-600 font-semibold">
                  Reversed by {inspectedBatch.reversedBy} ({inspectedBatch.reversalReason})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Centred Modal: Reverse Import Batch Confirmation */}
      {batchToReverse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reverse-batch-title"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-2">
              <h3 id="reverse-batch-title" className="text-sm font-bold text-[var(--text-primary)]">
                Reverse import batch {batchToReverse.batchNumber}
              </h3>
              <button
                onClick={() => setBatchToReverse(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-secondary)]">
              <p>
                This will reverse all <strong>{batchToReverse.rowCount}</strong> records imported from{' '}
                <strong>{batchToReverse.fileName}</strong> in one atomic action and post offsetting reversal entries where applicable.
              </p>
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Reason for reversing batch <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Enter reason for audit log..."
                  className="w-full px-3 py-2 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] text-[13px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--surface-border)]">
              <button
                onClick={() => setBatchToReverse(null)}
                className="px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReverseBatch}
                disabled={reversalReason.trim().length < 3}
                className="px-4 py-1.5 rounded-[var(--radius-sm)] bg-rose-700 text-white text-[13px] font-semibold hover:bg-rose-800 disabled:opacity-50"
              >
                Confirm batch reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
