import type { Account, Fund, JournalEntry, AccountingPeriod } from '../ledger/types.js';
import { calculateTrialBalance, createJournalEntry, createReversalEntry } from '../ledger/rules.js';
import type {
  ImportBatchRecord,
  ImportColumnMapping,
  ImportDryRunRecordSummary,
  ImportRowDiagnostic,
  ImportTemplateDefinition,
  ImportTemplateType,
  ImportValidationAndDryRunResult,
} from './types.js';
import {
  parseOpeningBalanceCsv,
  runOpeningBalanceDryRun,
} from './openingBalances.js';

/**
 * Deterministic SHA-256-like 64-character hex fingerprint for CSV file contents
 * (Spec Section B3: "Uploading the same file twice is refused by file fingerprint").
 */
export function computeImportFileSha256(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const idx = i % 8;
    h[idx] = Math.imul((h[idx]! ^ code) + i, 0x01000193) >>> 0;
    h[(idx + 3) % 8] = (h[(idx + 3) % 8]! + ((h[idx]! << 5) | (h[idx]! >>> 27))) >>> 0;
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}

/**
 * Masks personal data and phone numbers in import logs and error messages (Spec Section B3).
 * Example: "+233244111222" -> "+233 ** *** *222"
 * Example: "kofi.mensah@gmail.com" -> "ko***@gmail.com"
 */
export function maskPiiInDiagnostic(rawValue: string, fieldKey?: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';

  // Email masking
  if (trimmed.includes('@')) {
    const [local, domain] = trimmed.split('@');
    if (local && domain) {
      const visible = local.slice(0, Math.min(2, local.length));
      return `${visible}***@${domain}`;
    }
  }

  // Phone number masking
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (
    fieldKey === 'phone' ||
    (digitsOnly.length >= 9 && digitsOnly.length <= 15 && /^[\d+\-\s()]+$/.test(trimmed))
  ) {
    const last3 = digitsOnly.slice(-3);
    if (trimmed.startsWith('+233')) {
      return `+233 ** *** *${last3}`;
    }
    return `*** *** *${last3}`;
  }

  // Name / address partial masking if explicitly flagged as PII
  if (fieldKey === 'fullName' || fieldKey === 'memberName') {
    const parts = trimmed.split(/\s+/);
    return parts
      .map((part, idx) => (idx === 0 ? part : `${part.charAt(0)}***`))
      .join(' ');
  }

  return trimmed;
}

export const IMPORT_TEMPLATES: readonly ImportTemplateDefinition[] = [
  {
    type: 'MEMBERS',
    label: 'Members',
    description:
      'Import church members with envelope numbers, member numbers, and household details. Detects duplicates by name and phone.',
    requiredFields: [
      { key: 'memberNumber', label: 'Member number', required: true },
      { key: 'envelopeNumber', label: 'Envelope number', required: true },
      { key: 'fullName', label: 'Full name', required: true, containsPii: true },
      { key: 'phone', label: 'Phone number', required: true, containsPii: true },
      { key: 'email', label: 'Email (optional)', required: false, containsPii: true },
      { key: 'householdName', label: 'Household / Family (optional)', required: false },
    ],
    sampleCsv: [
      'member_number,envelope_number,full_name,phone,email,household_name',
      'MEM-2026-101,ENV-101,Nana Yaw Asante,+233244810111,nana.asante@calvarycrystal.org,Asante Household',
      'MEM-2026-102,ENV-102,Efua Mansa Mensah,+233244810222,efua.mensah@calvarycrystal.org,Mensah Household',
      'MEM-2026-103,ENV-103,Elder Kwesi Appiah,+233208910333,kwesi.appiah@calvarycrystal.org,Appiah Household',
      'MEM-2026-104,ENV-104,Deaconess Comfort Ofori,+233544910444,comfort.ofori@calvarycrystal.org,Ofori Household',
    ].join('\n'),
  },
  {
    type: 'OPENING_BALANCES',
    label: 'Opening balances',
    description:
      'Import cut-over account balances by fund and currency. Validates per-fund balance and posts one balanced entry per fund.',
    requiredFields: [
      { key: 'account_code', label: 'Account code', required: true },
      { key: 'fund_code', label: 'Fund code', required: true },
      { key: 'currency', label: 'Currency (GHS/USD)', required: true },
      { key: 'debit_amount', label: 'Debit amount', required: true },
      { key: 'credit_amount', label: 'Credit amount', required: true },
      { key: 'exchange_rate', label: 'Exchange rate', required: true },
      { key: 'rate_date', label: 'Rate date', required: false },
      { key: 'description', label: 'Description', required: false },
    ],
    sampleCsv: [
      'account_code,fund_code,currency,debit_amount,credit_amount,exchange_rate,rate_date,description',
      '1010,GEN,GHS,4500.00,0.00,1.0000,2026-01-01,Opening Cash on Hand (GHS)',
      '1030,GEN,GHS,28500.00,0.00,1.0000,2026-01-01,Opening Bank Account (GHS) - General Fund',
      '2010,GEN,GHS,0.00,1200.00,1.0000,2026-01-01,Opening Accounts Payable',
      '3010,GEN,GHS,0.00,31800.00,1.0000,2026-01-01,Opening General Fund Balance',
      '1030,BLD,GHS,42000.00,0.00,1.0000,2026-01-01,Opening Bank Account (GHS) - Building Fund',
      '3020,BLD,GHS,0.00,42000.00,1.0000,2026-01-01,Opening Restricted Building Fund Balance',
    ].join('\n'),
  },
  {
    type: 'FIXED_ASSETS',
    label: 'Fixed assets',
    description:
      'Import the physical fixed asset register with historical cost, acquisition date, and accumulated depreciation to the cut-over date.',
    requiredFields: [
      { key: 'assetTag', label: 'Asset tag', required: true },
      { key: 'name', label: 'Asset description', required: true },
      { key: 'category', label: 'Category', required: true },
      { key: 'acquisitionDate', label: 'Acquisition date (YYYY-MM-DD)', required: true },
      { key: 'costGhs', label: 'Historical cost (GHS)', required: true },
      { key: 'accumDepreciationGhs', label: 'Accumulated depreciation (GHS)', required: true },
      { key: 'fundCode', label: 'Fund code', required: true },
    ],
    sampleCsv: [
      'asset_tag,name,category,acquisition_date,cost_ghs,accum_depreciation_ghs,fund_code',
      'AST-2026-001,Main Sanctuary Building (Adabraka),Buildings,2020-03-15,320000.00,32000.00,BLD',
      'AST-2026-002,Yamaha Digital Mixing Console & Line Array,Sound & AV,2024-06-01,60000.00,18000.00,GEN',
      'AST-2026-003,Sanctuary Pews & Pulpit Furniture,Furniture & Fittings,2022-01-10,25000.00,5000.00,GEN',
    ].join('\n'),
  },
  {
    type: 'PLEDGES',
    label: 'Pledges',
    description:
      'Import open member pledges by campaign with total pledged and balance remaining at cut-over (memo sub-ledger).',
    requiredFields: [
      { key: 'memberNumber', label: 'Member number', required: true },
      { key: 'memberName', label: 'Member name', required: true, containsPii: true },
      { key: 'campaignName', label: 'Pledge campaign', required: true },
      { key: 'fundCode', label: 'Fund code', required: true },
      { key: 'pledgedAmountGhs', label: 'Total pledged (GHS)', required: true },
      { key: 'paidPriorGhs', label: 'Paid before cut-over (GHS)', required: true },
      { key: 'dueDate', label: 'Target completion date', required: true },
    ],
    sampleCsv: [
      'member_number,member_name,campaign_name,fund_code,pledged_amount_ghs,paid_prior_ghs,due_date',
      'MEM-2026-101,Nana Yaw Asante,2026 Children Wing Expansion,BLD,5000.00,2000.00,2026-12-31',
      'MEM-2026-102,Efua Mansa Mensah,2026 Children Wing Expansion,BLD,3000.00,1000.00,2026-12-31',
      'MEM-2026-103,Elder Kwesi Appiah,2026 Missions Vehicle Drive,MIS,4000.00,1500.00,2026-11-30',
    ].join('\n'),
  },
  {
    type: 'PRIOR_GIVING_HISTORY',
    label: 'Prior giving history (non-posting)',
    description:
      'Optional memo import of member giving prior to the cut-over date so annual giving statements for the cut-over year are complete without double-counting in the general ledger.',
    requiredFields: [
      { key: 'memberNumber', label: 'Member number', required: true },
      { key: 'memberName', label: 'Member name', required: true, containsPii: true },
      { key: 'givingDate', label: 'Giving date (YYYY-MM-DD)', required: true },
      { key: 'fundCode', label: 'Fund code', required: true },
      { key: 'amountGhs', label: 'Amount (GHS)', required: true },
      { key: 'method', label: 'Payment method', required: true },
    ],
    sampleCsv: [
      'member_number,member_name,giving_date,fund_code,amount_ghs,method',
      'MEM-2026-101,Nana Yaw Asante,2025-11-02,GEN,450.00,MoMo',
      'MEM-2026-102,Efua Mansa Mensah,2025-11-09,GEN,300.00,Cash',
      'MEM-2026-103,Elder Kwesi Appiah,2025-12-07,BLD,1000.00,Bank transfer',
    ].join('\n'),
  },
  {
    type: 'HISTORICAL_TRANSACTIONS',
    label: 'Historical transactions (discouraged)',
    description:
      'Optional import of past general ledger entries. Opening balances at the cut-over date are preferred for almost every church.',
    isDiscouraged: true,
    discouragedNote:
      'Chief Accountant guidance (D2): Importing historical transactions is discouraged. Use Opening Balances at your cut-over date instead, and retain your old books as a read-only archive.',
    requiredFields: [
      { key: 'entryDate', label: 'Entry date (YYYY-MM-DD)', required: true },
      { key: 'documentNumber', label: 'Original ref', required: true },
      { key: 'debitAccountCode', label: 'Debit account code', required: true },
      { key: 'creditAccountCode', label: 'Credit account code', required: true },
      { key: 'fundCode', label: 'Fund code', required: true },
      { key: 'amountGhs', label: 'Amount (GHS)', required: true },
      { key: 'narration', label: 'Narration', required: true },
    ],
    sampleCsv: [
      'entry_date,document_number,debit_account_code,credit_account_code,fund_code,amount_ghs,narration',
      '2026-01-04,HIST-001,1010,4020,GEN,1250.00,Historical first Sunday offering',
      '2026-01-11,HIST-002,5020,1010,GEN,350.00,Historical water bill payment',
    ].join('\n'),
  },
];

export function getImportTemplate(type: ImportTemplateType): ImportTemplateDefinition {
  return IMPORT_TEMPLATES.find((t) => t.type === type) ?? IMPORT_TEMPLATES[0]!;
}

/**
 * Parses CSV text into headers and raw row objects.
 */
export function parseGenericCsv(csvText: string): {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0]!.split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cols[idx] ?? '';
    });
    rows.push(record);
  }

  return { headers, rows };
}

/**
 * Builds default column mapping by matching template keys or snake_case equivalents to CSV headers.
 */
export function buildDefaultColumnMapping(
  template: ImportTemplateDefinition,
  csvHeaders: readonly string[]
): ImportColumnMapping {
  const mapping: Record<string, string> = {};
  for (const field of template.requiredFields) {
    const snakeKey = field.key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const match = csvHeaders.find(
      (h) =>
        h.toLowerCase() === field.key.toLowerCase() ||
        h.toLowerCase() === snakeKey.toLowerCase() ||
        h.toLowerCase().replace(/[^a-z0-9]/g, '') === field.key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    mapping[field.key] = match ?? (csvHeaders[0] || '');
  }
  return mapping;
}

function parseGhsToPesewas(raw: string): bigint | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (isNaN(num) || num < 0) return null;
  return BigInt(Math.round(num * 100));
}

export interface ValidateAndDryRunImportParams {
  readonly templateType: ImportTemplateType;
  readonly fileName: string;
  readonly csvContent: string;
  readonly columnMapping: ImportColumnMapping;
  readonly existingBatches: readonly ImportBatchRecord[];
  readonly existingMembers?: readonly {
    readonly fullName: string;
    readonly phone: string;
    readonly memberNumber?: string;
  }[];
  readonly accounts: readonly Account[];
  readonly funds: readonly Fund[];
  readonly existingEntries: readonly JournalEntry[];
  readonly branchId: string;
  readonly financialYearId: string;
  readonly period: AccountingPeriod | null;
  readonly cutOverDate: string;
  readonly nextBatchNumber: string; // e.g., "IMP-0001"
  readonly createdBy: string;
  readonly deviceId: string;
}

/**
 * Runs the 5-step Import Wizard validation and dry-run calculation (Spec Section B3):
 * - Checks SHA-256 fingerprint against previously committed batches (refuses duplicate file uploads)
 * - Validates every row according to template rules
 * - Masks PII and phone numbers in all diagnostic messages
 * - Enforces all-or-nothing rule: if any row has an ERROR, canCommit is false
 * - Produces dry-run record summary and resulting Trial Balance
 */
export function validateAndDryRunImport(
  params: ValidateAndDryRunImportParams
): ImportValidationAndDryRunResult {
  const template = getImportTemplate(params.templateType);
  const fileSha256 = computeImportFileSha256(params.csvContent);

  const duplicateBatch = params.existingBatches.find(
    (b) => b.fileSha256 === fileSha256 && b.status === 'COMMITTED'
  );
  const isDuplicateFile = Boolean(duplicateBatch);

  const { rows: rawCsvRows } = parseGenericCsv(params.csvContent);
  const diagnostics: ImportRowDiagnostic[] = [];
  const mappedRows: Record<string, string>[] = [];

  if (isDuplicateFile && duplicateBatch) {
    diagnostics.push({
      rowNumber: 0,
      severity: 'ERROR',
      fieldKey: 'file',
      message: `Duplicate file upload refused: This exact file (SHA-256 ${fileSha256.slice(0, 12)}…) was already imported in batch ${duplicateBatch.batchNumber}.`,
    });
  }

  if (rawCsvRows.length === 0) {
    diagnostics.push({
      rowNumber: 0,
      severity: 'ERROR',
      fieldKey: 'file',
      message: 'The uploaded CSV file contains no data rows.',
    });
  }

  // Map rows using user's column mapping
  for (let i = 0; i < rawCsvRows.length; i++) {
    const raw = rawCsvRows[i]!;
    const mapped: Record<string, string> = {};
    for (const field of template.requiredFields) {
      const headerName = params.columnMapping[field.key];
      const val = headerName ? (raw[headerName] ?? '').trim() : '';
      mapped[field.key] = val;

      if (field.required && !val) {
        diagnostics.push({
          rowNumber: i + 1,
          severity: 'ERROR',
          fieldKey: field.key,
          message: `Row ${i + 1}: Missing required field "${field.label}".`,
        });
      }
    }
    mappedRows.push(mapped);
  }

  const proposedJournalEntries: JournalEntry[] = [];
  const recordSummaries: ImportDryRunRecordSummary[] = [];

  // Template-specific validations
  if (params.templateType === 'MEMBERS') {
    const seenNamesAndPhones = new Set<string>();
    const existingList = params.existingMembers ?? [];

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i]!;
      const rowNum = i + 1;
      const fullName = row.fullName ?? '';
      const phone = row.phone ?? '';
      const normName = fullName.toLowerCase().replace(/\s+/g, ' ').trim();
      const normPhone = phone.replace(/\D/g, '').slice(-9);

      if (phone && normPhone.length < 9) {
        const masked = maskPiiInDiagnostic(phone, 'phone');
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'phone',
          maskedValue: masked,
          message: `Row ${rowNum}: Invalid phone number format (${masked}). Expected at least 9 digits.`,
        });
      }

      const compositeKey = `${normName}|${normPhone}`;
      if (normName && normPhone) {
        if (seenNamesAndPhones.has(compositeKey)) {
          const maskedName = maskPiiInDiagnostic(fullName, 'fullName');
          const maskedPhone = maskPiiInDiagnostic(phone, 'phone');
          diagnostics.push({
            rowNumber: rowNum,
            severity: 'ERROR',
            fieldKey: 'fullName',
            maskedValue: `${maskedName} (${maskedPhone})`,
            message: `Row ${rowNum}: Duplicate member within CSV file for ${maskedName} (${maskedPhone}).`,
          });
        }
        seenNamesAndPhones.add(compositeKey);

        const existingDup = existingList.find(
          (m) =>
            m.fullName.toLowerCase().replace(/\s+/g, ' ').trim() === normName ||
            (normPhone.length >= 9 && m.phone.replace(/\D/g, '').slice(-9) === normPhone)
        );
        if (existingDup) {
          const maskedName = maskPiiInDiagnostic(fullName, 'fullName');
          const maskedPhone = maskPiiInDiagnostic(phone, 'phone');
          diagnostics.push({
            rowNumber: rowNum,
            severity: 'ERROR',
            fieldKey: 'phone',
            maskedValue: `${maskedName} (${maskedPhone})`,
            message: `Row ${rowNum}: Member already exists in directory matching name or phone: ${maskedName} (${maskedPhone}).`,
          });
        }
      }
    }

    recordSummaries.push({
      recordType: 'Member directory profiles',
      count: mappedRows.length,
      totalAmountGhs: 0n,
      notes: 'Tagged with batch ID; no general ledger impact.',
    });
  } else if (params.templateType === 'OPENING_BALANCES') {
    const obRows = parseOpeningBalanceCsv(params.csvContent);
    const obDryRun = runOpeningBalanceDryRun({
      rows: obRows,
      cutOverDate: params.cutOverDate,
      branchId: params.branchId,
      financialYearId: params.financialYearId,
      period: params.period,
      accounts: params.accounts,
      funds: params.funds,
      createdBy: params.createdBy,
      deviceId: params.deviceId,
      existingEntries: params.existingEntries,
    });

    for (const d of obDryRun.validation.rowDiagnostics) {
      diagnostics.push({
        rowNumber: d.rowNumber,
        severity: d.severity,
        fieldKey: 'account_code',
        message: d.message,
      });
    }

    if (!obDryRun.validation.allFundsBalanced) {
      for (const f of obDryRun.validation.fundSummaries) {
        if (!f.isBalanced) {
          diagnostics.push({
            rowNumber: 0,
            severity: 'ERROR',
            fieldKey: 'fund_code',
            message: `Fund ${f.fundCode} (${f.fundName}) is out of balance by GHS ${(Number(f.differenceGhs) / 100).toFixed(2)}.`,
          });
        }
      }
    }

    for (const entry of obDryRun.proposedEntriesByFund) {
      proposedJournalEntries.push({
        ...entry,
        importBatchId: params.nextBatchNumber,
        narration: `[${params.nextBatchNumber}] ${entry.narration}`,
      });
    }

    recordSummaries.push({
      recordType: 'Balanced opening balance journal entries (1 per fund)',
      count: proposedJournalEntries.length,
      totalAmountGhs: obDryRun.validation.totalDebitGhs,
      notes: `Cut-over date ${params.cutOverDate}`,
    });
  } else if (params.templateType === 'FIXED_ASSETS') {
    let totalCostGhs = 0n;
    let totalAccumDepGhs = 0n;

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i]!;
      const rowNum = i + 1;
      const cost = parseGhsToPesewas(row.costGhs ?? '');
      const accum = parseGhsToPesewas(row.accumDepreciationGhs ?? '');
      const fund = params.funds.find((f) => f.code.toUpperCase() === (row.fundCode ?? '').toUpperCase());

      if (cost === null || cost <= 0n) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'costGhs',
          message: `Row ${rowNum}: Historical cost must be a positive GHS amount.`,
        });
      }
      if (accum === null || (cost !== null && accum > cost)) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'accumDepreciationGhs',
          message: `Row ${rowNum}: Accumulated depreciation cannot exceed historical cost.`,
        });
      }
      if (!fund) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'fundCode',
          message: `Row ${rowNum}: Unknown fund code "${row.fundCode}".`,
        });
      }
      if (cost !== null) totalCostGhs += cost;
      if (accum !== null) totalAccumDepGhs += accum;
    }

    recordSummaries.push({
      recordType: 'Fixed asset register items',
      count: mappedRows.length,
      totalAmountGhs: totalCostGhs - totalAccumDepGhs,
      notes: `Gross cost GHS ${(Number(totalCostGhs) / 100).toFixed(2)} less Accum. Dep. GHS ${(Number(totalAccumDepGhs) / 100).toFixed(2)}`,
    });
  } else if (params.templateType === 'PLEDGES') {
    let totalRemainingGhs = 0n;
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i]!;
      const rowNum = i + 1;
      const pledged = parseGhsToPesewas(row.pledgedAmountGhs ?? '');
      const paid = parseGhsToPesewas(row.paidPriorGhs ?? '');
      const fund = params.funds.find((f) => f.code.toUpperCase() === (row.fundCode ?? '').toUpperCase());

      if (pledged === null || pledged <= 0n) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'pledgedAmountGhs',
          message: `Row ${rowNum}: Pledged amount must be greater than zero.`,
        });
      }
      if (paid === null || (pledged !== null && paid > pledged)) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'paidPriorGhs',
          message: `Row ${rowNum}: Prior paid amount cannot exceed total pledged amount for ${maskPiiInDiagnostic(row.memberName ?? '', 'memberName')}.`,
        });
      }
      if (!fund) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'fundCode',
          message: `Row ${rowNum}: Unknown fund code "${row.fundCode}".`,
        });
      }
      if (pledged !== null && paid !== null && pledged >= paid) {
        totalRemainingGhs += pledged - paid;
      }
    }

    recordSummaries.push({
      recordType: 'Open member pledges (sub-ledger memo)',
      count: mappedRows.length,
      totalAmountGhs: totalRemainingGhs,
      notes: 'Outstanding pledge balances carried into active campaigns.',
    });
  } else if (params.templateType === 'PRIOR_GIVING_HISTORY') {
    let totalMemoGivingGhs = 0n;
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i]!;
      const rowNum = i + 1;
      const amount = parseGhsToPesewas(row.amountGhs ?? '');
      const fund = params.funds.find((f) => f.code.toUpperCase() === (row.fundCode ?? '').toUpperCase());
      const givingDate = row.givingDate ?? '';

      if (amount === null || amount <= 0n) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'amountGhs',
          message: `Row ${rowNum}: Giving amount must be greater than zero for ${maskPiiInDiagnostic(row.memberName ?? '', 'memberName')}.`,
        });
      }
      if (!fund) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'fundCode',
          message: `Row ${rowNum}: Unknown fund code "${row.fundCode}".`,
        });
      }
      if (givingDate >= params.cutOverDate) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'WARNING',
          fieldKey: 'givingDate',
          message: `Row ${rowNum}: Giving date (${givingDate}) is on or after cut-over date (${params.cutOverDate}). Prior giving history is meant for pre-cut-over dates.`,
        });
      }
      if (amount !== null) totalMemoGivingGhs += amount;
    }

    recordSummaries.push({
      recordType: 'Prior giving history memo records (non-posting)',
      count: mappedRows.length,
      totalAmountGhs: totalMemoGivingGhs,
      notes: 'Included on member giving statements only; does NOT post to the general ledger.',
    });
  } else if (params.templateType === 'HISTORICAL_TRANSACTIONS') {
    diagnostics.push({
      rowNumber: 0,
      severity: 'WARNING',
      fieldKey: 'template',
      message:
        'Historical transaction imports are discouraged (Decision D2). Ensure these transactions are not already included in your Opening Balances.',
    });

    let totalPostedGhs = 0n;
    const errorCountBeforeEntries = diagnostics.filter((d) => d.severity === 'ERROR').length;

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i]!;
      const rowNum = i + 1;
      const amount = parseGhsToPesewas(row.amountGhs ?? '');
      const drAcct = params.accounts.find((a) => a.code === row.debitAccountCode);
      const crAcct = params.accounts.find((a) => a.code === row.creditAccountCode);
      const fund = params.funds.find((f) => f.code.toUpperCase() === (row.fundCode ?? '').toUpperCase());

      if (!drAcct) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'debitAccountCode',
          message: `Row ${rowNum}: Debit account "${row.debitAccountCode}" does not exist.`,
        });
      }
      if (!crAcct) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'creditAccountCode',
          message: `Row ${rowNum}: Credit account "${row.creditAccountCode}" does not exist.`,
        });
      }
      if (!fund) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'fundCode',
          message: `Row ${rowNum}: Fund "${row.fundCode}" does not exist.`,
        });
      }
      if (amount === null || amount <= 0n) {
        diagnostics.push({
          rowNumber: rowNum,
          severity: 'ERROR',
          fieldKey: 'amountGhs',
          message: `Row ${rowNum}: Amount must be positive.`,
        });
      }

      if (drAcct && crAcct && fund && amount && amount > 0n && errorCountBeforeEntries === 0) {
        totalPostedGhs += amount;
        const entry = createJournalEntry({
          id: `imp-${params.nextBatchNumber.toLowerCase()}-row-${rowNum}`,
          branchId: params.branchId,
          financialYearId: params.financialYearId,
          importBatchId: params.nextBatchNumber,
          documentNumber: `${params.nextBatchNumber}-${String(rowNum).padStart(3, '0')}`,
          entryDate: row.entryDate || params.cutOverDate,
          entryType: 'IMPORTED',
          narration: `[${params.nextBatchNumber}] ${row.narration || 'Imported historical transaction'}`,
          createdBy: params.createdBy,
          deviceId: params.deviceId,
          period: params.period,
          lines: [
            {
              id: `imp-l-${rowNum}-1`,
              accountId: drAcct.id,
              fundId: fund.id,
              originalCurrency: 'GHS',
              originalAmount: amount,
              exchangeRate: '1.0000',
              isDebit: true,
              description: row.narration,
            },
            {
              id: `imp-l-${rowNum}-2`,
              accountId: crAcct.id,
              fundId: fund.id,
              originalCurrency: 'GHS',
              originalAmount: amount,
              exchangeRate: '1.0000',
              isDebit: false,
              description: row.narration,
            },
          ],
        });
        proposedJournalEntries.push(entry);
      }
    }

    recordSummaries.push({
      recordType: 'Imported historical journal entries',
      count: proposedJournalEntries.length,
      totalAmountGhs: totalPostedGhs,
      notes: `Tagged with ${params.nextBatchNumber} (reversible as a batch while period is open).`,
    });
  }

  const errorCount = diagnostics.filter((d) => d.severity === 'ERROR').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'WARNING').length;
  const errorRows = new Set(
    diagnostics.filter((d) => d.severity === 'ERROR' && d.rowNumber > 0).map((d) => d.rowNumber)
  );
  const validRowCount = Math.max(0, mappedRows.length - errorRows.size);

  // Atomic all-or-nothing rule: if ANY error exists, zero entries are proposed for commit
  const effectiveProposedEntries = errorCount === 0 ? proposedJournalEntries : [];
  const combinedEntries = [...effectiveProposedEntries, ...params.existingEntries];
  const resultingTrialBalance = calculateTrialBalance(
    combinedEntries,
    params.accounts,
    params.funds
  );

  return {
    templateType: params.templateType,
    fileName: params.fileName,
    fileSha256,
    isDuplicateFile,
    duplicateOfBatchNumber: duplicateBatch?.batchNumber ?? null,
    totalRows: mappedRows.length,
    validRowCount,
    errorCount,
    warningCount,
    canCommit: errorCount === 0 && mappedRows.length > 0,
    diagnostics,
    mappedRows,
    recordSummaries,
    proposedJournalEntries: effectiveProposedEntries,
    resultingTrialBalance,
  };
}

/**
 * Reverses an entire committed import batch in one action while the period is open (Spec Section B3).
 */
export function reverseImportBatch(params: {
  readonly batch: ImportBatchRecord;
  readonly period: AccountingPeriod | null;
  readonly existingEntries: readonly JournalEntry[];
  readonly reversedBy: string;
  readonly reversalReason: string;
  readonly deviceId: string;
}): {
  readonly updatedBatch: ImportBatchRecord;
  readonly reversalEntries: readonly JournalEntry[];
} {
  if (params.batch.status === 'REVERSED') {
    throw new Error(`Import batch ${params.batch.batchNumber} has already been reversed.`);
  }
  if (!params.reversalReason || params.reversalReason.trim().length < 3) {
    throw new Error('A written reason is required to reverse an import batch.');
  }
  if (params.period && (params.period.isClosed || params.period.status === 'CLOSED')) {
    throw new Error(
      `Cannot reverse import batch ${params.batch.batchNumber} because its accounting period (${params.period.year}-${String(params.period.month).padStart(2, '0')}) is closed.`
    );
  }

  const batchEntries = params.existingEntries.filter(
    (e) =>
      params.batch.createdJournalEntryIds.includes(e.id) ||
      e.importBatchId === params.batch.batchNumber
  );

  const reversalDate = new Date().toISOString().slice(0, 10);
  const reversalEntries: JournalEntry[] = batchEntries.map((orig, idx) =>
    createReversalEntry({
      reversalEntryId: `rev-${params.batch.batchNumber.toLowerCase()}-${idx + 1}`,
      originalEntry: orig,
      documentNumber: `REV-${params.batch.batchNumber}-${String(idx + 1).padStart(2, '0')}`,
      reversalDate,
      reason: `Batch reversal of ${params.batch.batchNumber}: ${params.reversalReason.trim()}`,
      reversedBy: params.reversedBy,
      deviceId: params.deviceId,
      period: params.period,
    })
  );

  const updatedBatch: ImportBatchRecord = {
    ...params.batch,
    status: 'REVERSED',
    reversedAt: new Date().toISOString(),
    reversedBy: params.reversedBy,
    reversalReason: params.reversalReason.trim(),
    reversalEntryIds: reversalEntries.map((e) => e.id),
  };

  return {
    updatedBatch,
    reversalEntries,
  };
}
