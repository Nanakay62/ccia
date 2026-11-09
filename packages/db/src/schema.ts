import { column, Schema, Table } from '@powersync/web';

/**
 * PowerSync Client SQLite Schema for Offline-First Church Accounting
 * Mirrors the Postgres schema and data types.
 *
 * Money values are integer minor units (pesewas / cents).
 * UUIDs are stored as TEXT (standard in SQLite).
 */

export const branches = new Table({
  name: column.text,
  code: column.text,
  currency: column.text,
  is_main: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

export const roles = new Table({
  description: column.text,
});

export const users_profile = new Table(
  {
    branch_id: column.text,
    email: column.text,
    full_name: column.text,
    role: column.text,
    department_id: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      role: ['role'],
      branch: ['branch_id'],
    },
  }
);

export const devices = new Table({
  user_id: column.text,
  branch_id: column.text,
  device_name: column.text,
  prefix: column.text,
  is_revoked: column.integer,
  last_synced_at: column.text,
  created_at: column.text,
});

export const funds = new Table(
  {
    branch_id: column.text,
    code: column.text,
    name: column.text,
    type: column.text,
    description: column.text,
    allow_overdraft: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      code: ['code'],
      type: ['type'],
    },
  }
);

export const accounts = new Table(
  {
    branch_id: column.text,
    code: column.text,
    name: column.text,
    type: column.text,
    currency: column.text,
    is_bank_or_cash: column.integer,
    parent_id: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      code: ['code'],
      type: ['type'],
      currency: ['currency'],
    },
  }
);

export const financial_years = new Table(
  {
    branch_id: column.text,
    label: column.text,
    start_month: column.integer,
    start_date: column.text,
    end_date: column.text,
    has_adjustment_period: column.integer,
    status: column.text, // OPEN | CLOSING_IN_PROGRESS | LOCKED | REOPENED_ADJUSTMENT_ONLY
    locked_at: column.text,
    locked_by: column.text,
    reopened_at: column.text,
    reopened_by: column.text,
    reopen_approved_by: column.text,
    reopen_reason: column.text,
    created_by: column.text,
    device_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      branch_label: ['branch_id', 'label'],
      status: ['status'],
    },
  }
);

export const periods = new Table(
  {
    branch_id: column.text,
    financial_year_id: column.text,
    year: column.integer,
    month: column.integer, // 1..13 (13 = adjustment period)
    is_adjustment_period: column.integer,
    status: column.text, // OPEN | SOFT_CLOSED | CLOSED
    start_date: column.text,
    end_date: column.text,
    is_closed: column.integer,
    soft_closed_at: column.text,
    soft_closed_by: column.text,
    closed_at: column.text,
    closed_by: column.text,
    created_by: column.text,
    device_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      year_month: ['year', 'month'],
      fy: ['financial_year_id'],
    },
  }
);

export const exchange_rates = new Table(
  {
    branch_id: column.text,
    rate_date: column.text,
    currency: column.text,
    rate: column.text, // High precision numeric rate as text
    entered_by: column.text,
    notes: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      date_currency: ['rate_date', 'currency'],
    },
  }
);

export const journal_entries = new Table(
  {
    branch_id: column.text,
    financial_year_id: column.text,
    document_number: column.text,
    entry_date: column.text,
    period_id: column.text,
    is_adjustment_period_entry: column.integer,
    import_batch_id: column.text,
    auto_reverse_on_date: column.text,
    entry_type: column.text,
    narration: column.text,
    line_count: column.integer,
    total_debit_ghs: column.integer,
    total_credit_ghs: column.integer,
    is_reversal: column.integer,
    reversal_of_id: column.text,
    created_by: column.text,
    device_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      doc_num: ['document_number'],
      entry_date: ['entry_date'],
      period: ['period_id'],
      fy: ['financial_year_id'],
      import_batch: ['import_batch_id'],
    },
  }
);

export const journal_lines = new Table(
  {
    journal_entry_id: column.text,
    account_id: column.text,
    fund_id: column.text,
    line_number: column.integer,
    original_currency: column.text,
    original_amount: column.integer,
    exchange_rate: column.text,
    debit_amount_ghs: column.integer,
    credit_amount_ghs: column.integer,
    rounding_difference_pesewas: column.integer,
    description: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      entry_id: ['journal_entry_id'],
      account: ['account_id'],
      fund: ['fund_id'],
    },
  }
);

export const members = new Table(
  {
    branch_id: column.text,
    member_number: column.text,
    full_name: column.text,
    encrypted_phone: column.text,
    phone_hint: column.text,
    department: column.text,
    status: column.text,
    join_date: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      member_no: ['member_number'],
      full_name: ['full_name'],
    },
  }
);

export const pledges = new Table(
  {
    branch_id: column.text,
    member_id: column.text,
    fund_id: column.text,
    pledge_date: column.text,
    target_date: column.text,
    currency: column.text,
    amount: column.integer,
    notes: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      member: ['member_id'],
      fund: ['fund_id'],
    },
  }
);

export const counting_sheets = new Table(
  {
    branch_id: column.text,
    sheet_number: column.text,
    service_date: column.text,
    service_type: column.text,
    first_counter_id: column.text,
    first_signed_at: column.text,
    second_counter_id: column.text,
    second_signed_at: column.text,
    status: column.text,
    journal_entry_id: column.text,
    total_ghs: column.integer,
    total_usd: column.integer,
    created_by: column.text,
    device_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      sheet_num: ['sheet_number'],
      service_date: ['service_date'],
      status: ['status'],
    },
  }
);

export const counting_sheet_lines = new Table(
  {
    counting_sheet_id: column.text,
    fund_id: column.text,
    category: column.text,
    currency: column.text,
    denomination_value: column.integer,
    quantity: column.integer,
    line_total: column.integer,
    member_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      sheet_id: ['counting_sheet_id'],
      fund: ['fund_id'],
      member: ['member_id'],
    },
  }
);

export const requisitions = new Table(
  {
    branch_id: column.text,
    req_number: column.text,
    department_id: column.text,
    fund_id: column.text,
    purpose: column.text,
    currency: column.text,
    amount: column.integer,
    submitted_by: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      dept: ['department_id'],
      status: ['status'],
    },
  }
);

export const requisition_approvals = new Table({
  requisition_id: column.text,
  approver_id: column.text,
  action: column.text,
  comments: column.text,
  approved_at: column.text,
});

export const vendors = new Table({
  branch_id: column.text,
  name: column.text,
  category: column.text,
  contact_phone: column.text,
  is_active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

export const vouchers = new Table(
  {
    branch_id: column.text,
    voucher_number: column.text,
    requisition_id: column.text,
    vendor_id: column.text,
    payee_name: column.text,
    fund_id: column.text,
    payment_method: column.text,
    currency: column.text,
    amount: column.integer,
    voucher_date: column.text,
    prepared_by: column.text,
    authorized_by: column.text,
    journal_entry_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      voucher_num: ['voucher_number'],
      date: ['voucher_date'],
    },
  }
);

export const budgets = new Table(
  {
    branch_id: column.text,
    year: column.integer,
    name: column.text,
    is_approved: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      year: ['year'],
    },
  }
);

export const budget_lines = new Table(
  {
    budget_id: column.text,
    fund_id: column.text,
    account_id: column.text,
    department_id: column.text,
    annual_amount_ghs: column.integer,
    created_at: column.text,
  },
  {
    indexes: {
      budget: ['budget_id'],
      dept: ['department_id'],
    },
  }
);

export const assets = new Table({
  branch_id: column.text,
  asset_tag: column.text,
  name: column.text,
  purchase_date: column.text,
  cost_amount: column.integer,
  cost_currency: column.text,
  location: column.text,
  status: column.text,
  created_at: column.text,
  updated_at: column.text,
});

export const staff = new Table({
  branch_id: column.text,
  full_name: column.text,
  role_title: column.text,
  monthly_salary_ghs: column.integer,
  allowances_ghs: column.integer,
  is_active: column.integer,
  created_at: column.text,
});

export const payroll_runs = new Table({
  branch_id: column.text,
  period_id: column.text,
  run_date: column.text,
  total_gross_ghs: column.integer,
  total_allowances_ghs: column.integer,
  journal_entry_id: column.text,
  created_by: column.text,
  created_at: column.text,
});

export const attachments = new Table({
  branch_id: column.text,
  entity_type: column.text,
  entity_id: column.text,
  storage_path: column.text,
  mime_type: column.text,
  size_bytes: column.integer,
  uploaded_at: column.text,
  created_at: column.text,
});

export const audit_log = new Table(
  {
    branch_id: column.text,
    entity_type: column.text,
    entity_id: column.text,
    action: column.text,
    performed_by: column.text,
    device_id: column.text,
    reason: column.text,
    before_state: column.text,
    after_state: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      entity: ['entity_type', 'entity_id'],
      created: ['created_at'],
    },
  }
);

export const sync_rejections = new Table(
  {
    branch_id: column.text,
    transaction_id: column.text,
    entity_type: column.text,
    reason: column.text,
    payload: column.text,
    device_id: column.text,
    rejected_at: column.text,
    resolved_at: column.text,
    resolved_by: column.text,
    resolution_notes: column.text,
  },
  {
    indexes: {
      rejected_at: ['rejected_at'],
      resolved_at: ['resolved_at'],
    },
  }
);

export const integrity_runs = new Table(
  {
    branch_id: column.text,
    triggered_by: column.text,
    is_automated: column.integer,
    total_debits_ghs: column.integer,
    total_credits_ghs: column.integer,
    difference_ghs: column.integer,
    explained_ghs: column.integer,
    unexplained_ghs: column.integer,
    findings_count: column.integer,
    created_at: column.text,
  },
  {
    indexes: {
      created: ['created_at'],
    },
  }
);

export const integrity_findings = new Table(
  {
    run_id: column.text,
    rule_number: column.integer,
    severity: column.text,
    title: column.text,
    description: column.text,
    evidence: column.text,
    recommended_fix: column.text,
    related_entry_id: column.text,
    is_reviewed: column.integer,
    reviewed_by: column.text,
    reviewed_at: column.text,
    review_notes: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      run: ['run_id'],
      reviewed: ['is_reviewed'],
    },
  }
);

export const cash_accounts = new Table(
  {
    branch_id: column.text,
    account_id: column.text,
    name: column.text,
    kind: column.text, // cash | bank | mobile | petty
    currency: column.text,
    bank_name: column.text,
    branch_name: column.text,
    account_number_encrypted: column.text,
    account_number_masked: column.text,
    opening_balance: column.integer,
    opening_date: column.text,
    allow_overdraft: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      account: ['account_id'],
      kind: ['kind'],
    },
  }
);

export const cashbook_entries = new Table(
  {
    branch_id: column.text,
    journal_entry_id: column.text,
    cash_account_id: column.text,
    direction: column.text, // RECEIPT | PAYMENT | TRANSFER
    counterparty: column.text,
    linked_voucher_id: column.text,
    linked_counting_sheet_id: column.text,
    cheque_id: column.text,
    method: column.text, // CASH | MOMO | BANK_TRANSFER | CHEQUE
    ref_number: column.text,
    notes: column.text,
    created_by: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      account: ['cash_account_id'],
      journal: ['journal_entry_id'],
      voucher: ['linked_voucher_id'],
      sheet: ['linked_counting_sheet_id'],
    },
  }
);

export const cheques = new Table(
  {
    branch_id: column.text,
    bank_account_id: column.text,
    cheque_number: column.text,
    status: column.text, // ISSUED | PRESENTED | CANCELLED | STALE
    payee: column.text,
    amount: column.integer,
    currency: column.text,
    date: column.text,
    presented_date: column.text,
    stale_date: column.text,
    cancel_reason: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      bank_acct: ['bank_account_id'],
      cheque_num: ['cheque_number'],
      status: ['status'],
    },
  }
);

export const cash_counts = new Table(
  {
    branch_id: column.text,
    cash_account_id: column.text,
    count_date: column.text,
    count_time: column.text,
    book_balance: column.integer,
    physical_balance: column.integer,
    difference: column.integer,
    reason: column.text,
    status: column.text, // BALANCED | PENDING_APPROVAL | APPROVED | POSTED
    journal_entry_id: column.text,
    created_by: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      cash_acct: ['cash_account_id'],
      count_date: ['count_date'],
    },
  }
);

export const cash_count_lines = new Table({
  cash_count_id: column.text,
  denomination: column.integer,
  quantity: column.integer,
  line_total: column.integer,
});

export const cash_count_signoffs = new Table({
  cash_count_id: column.text,
  user_id: column.text,
  user_name: column.text,
  role: column.text,
  signed_at: column.text,
});

export const bank_statement_lines = new Table(
  {
    branch_id: column.text,
    bank_account_id: column.text,
    statement_date: column.text,
    description: column.text,
    reference: column.text,
    debit: column.integer,
    credit: column.integer,
    is_matched: column.integer,
    matched_journal_line_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      bank_acct: ['bank_account_id'],
      statement_date: ['statement_date'],
    },
  }
);

export const bank_reconciliations = new Table(
  {
    branch_id: column.text,
    bank_account_id: column.text,
    statement_date: column.text,
    statement_balance: column.integer,
    adjusted_balance: column.integer,
    cashbook_balance: column.integer,
    variance: column.integer,
    status: column.text, // DRAFT | PREPARED | APPROVED
    prepared_by: column.text,
    prepared_at: column.text,
    approved_by: column.text,
    approved_at: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      bank_acct: ['bank_account_id'],
      statement_date: ['statement_date'],
      status: ['status'],
    },
  }
);

export const bank_reconciliation_items = new Table({
  reconciliation_id: column.text,
  item_type: column.text, // DEPOSIT_IN_TRANSIT | UNPRESENTED_CHEQUE | BANK_CHARGE | INTEREST | ADJUSTMENT
  journal_line_id: column.text,
  amount: column.integer,
  description: column.text,
});

export const bank_reconciliation_signoffs = new Table({
  reconciliation_id: column.text,
  user_id: column.text,
  user_name: column.text,
  role: column.text,
  action: column.text,
  signed_at: column.text,
});

export const tithe_batches = new Table(
  {
    branch_id: column.text,
    counting_sheet_id: column.text,
    service_date: column.text,
    currency: column.text,
    counted_total: column.integer,
    allocated_total: column.integer,
    unallocated_total: column.integer,
    status: column.text, // DRAFT | RECONCILED | POSTED
    reconciled_by: column.text,
    reconciled_at: column.text,
    posted_by: column.text,
    posted_at: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      sheet: ['counting_sheet_id'],
      service_date: ['service_date'],
      status: ['status'],
    },
  }
);

export const tithe_records = new Table(
  {
    branch_id: column.text,
    batch_id: column.text,
    member_id: column.text,
    envelope_number: column.text,
    record_date: column.text,
    amount: column.integer,
    currency: column.text,
    exchange_rate: column.text,
    method: column.text, // ENVELOPE | MOMO | BANK_TRANSFER | CHEQUE
    journal_entry_id: column.text,
    notes: column.text,
    recorded_by: column.text,
    is_reversal: column.integer,
    reversal_of_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      batch: ['batch_id'],
      member: ['member_id'],
      record_date: ['record_date'],
    },
  }
);

export const tithe_remittance_rules = new Table({
  branch_id: column.text,
  name: column.text,
  basis: column.text, // PERCENTAGE | FIXED
  percentage_or_amount: column.text,
  currency: column.text,
  frequency: column.text, // MONTHLY | QUARTERLY
  due_day_of_month: column.integer,
  effective_from: column.text,
  is_active: column.integer,
  created_at: column.text,
});

export const tithe_remittances = new Table(
  {
    branch_id: column.text,
    rule_id: column.text,
    period: column.text,
    tithes_basis_ghs: column.integer,
    rate_used: column.text,
    amount_due: column.integer,
    amount_paid: column.integer,
    currency: column.text,
    status: column.text, // ACCRUED | PARTIALLY_PAID | FULLY_PAID
    due_date: column.text,
    voucher_ids: column.text,
    journal_entry_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      period: ['period'],
      status: ['status'],
    },
  }
);

export const asset_categories = new Table({
  branch_id: column.text,
  code: column.text,
  name: column.text,
  default_useful_life_years: column.integer,
  asset_cost_account_id: column.text,
  accumulated_depreciation_account_id: column.text,
  depreciation_expense_account_id: column.text,
  is_depreciable: column.integer,
  created_at: column.text,
});

export const fixed_assets = new Table(
  {
    branch_id: column.text,
    asset_number: column.text,
    category_id: column.text,
    description: column.text,
    serial_or_model: column.text,
    location: column.text,
    custodian: column.text,
    department_id: column.text,
    supplier_id: column.text,
    acquisition_mode: column.text, // PURCHASED | DONATED | TRANSFERRED_IN
    acquisition_date: column.text,
    cost_amount: column.integer,
    cost_currency: column.text,
    acquisition_rate: column.text,
    cost_ghs: column.integer,
    funding_fund_id: column.text,
    invoice_or_receipt_ref: column.text,
    warranty_expiry: column.text,
    insurance_policy_ref: column.text,
    condition: column.text, // EXCELLENT | GOOD | FAIR | POOR
    status: column.text, // IN_USE | UNDER_REPAIR | STORED | DISPOSED | MISSING
    useful_life_years: column.integer,
    residual_value_ghs: column.integer,
    depreciation_start_date: column.text,
    accumulated_depreciation_ghs: column.integer,
    net_book_value_ghs: column.integer,
    journal_entry_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      asset_num: ['asset_number'],
      category: ['category_id'],
      status: ['status'],
      location: ['location'],
    },
  }
);

export const asset_events = new Table(
  {
    asset_id: column.text,
    event_type: column.text, // ACQUISITION | TRANSFER | REPAIR | IMPROVEMENT | DISPOSAL | VERIFICATION | CORRECTION
    event_date: column.text,
    description: column.text,
    performed_by: column.text,
    linked_voucher_id: column.text,
    amount_ghs: column.integer,
    notes: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      asset: ['asset_id'],
      event_type: ['event_type'],
    },
  }
);

export const asset_attachments = new Table({
  asset_id: column.text,
  attachment_type: column.text, // PHOTO | RECEIPT | MANUAL | WARRANTY
  file_name: column.text,
  storage_path: column.text,
  uploaded_at: column.text,
});

export const depreciation_runs = new Table(
  {
    branch_id: column.text,
    period: column.text,
    run_date: column.text,
    total_charge_ghs: column.integer,
    assets_count: column.integer,
    journal_entry_id: column.text,
    status: column.text, // PREVIEW | POSTED | REVERSED
    created_by: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      period: ['period'],
      status: ['status'],
    },
  }
);

export const depreciation_lines = new Table({
  run_id: column.text,
  asset_id: column.text,
  charge_ghs: column.integer,
  cost_ghs: column.integer,
  prior_accumulated_ghs: column.integer,
  new_accumulated_ghs: column.integer,
  new_nbv_ghs: column.integer,
});

export const asset_verifications = new Table({
  branch_id: column.text,
  verification_date: column.text,
  location_or_custodian: column.text,
  total_assets_checked: column.integer,
  found_count: column.integer,
  missing_count: column.integer,
  damaged_count: column.integer,
  verified_by: column.text,
  approved_by: column.text,
  status: column.text,
  report_pdf_path: column.text,
  created_at: column.text,
});

export const asset_verification_lines = new Table({
  verification_id: column.text,
  asset_id: column.text,
  status_found: column.text, // FOUND | MISSING | DAMAGED | MOVED
  new_location: column.text,
  condition: column.text,
  notes: column.text,
});

export const asset_policy_settings = new Table({
  branch_id: column.text,
  capitalisation_threshold_ghs: column.integer,
  capitalisation_threshold_usd: column.integer,
  depreciation_enabled: column.integer,
  depreciation_frequency: column.text, // MONTHLY | YEARLY
  depreciation_method: column.text, // STRAIGHT_LINE
  verification_frequency_months: column.integer,
  updated_at: column.text,
});

// ============================================================================
// Go-Live, Year-End Close & Security Tables (Section 3)
// ============================================================================

export const year_end_runs = new Table({
  branch_id: column.text,
  financial_year_id: column.text,
  run_number: column.text,
  status: column.text,
  total_income_ghs: column.integer,
  total_expenditure_ghs: column.integer,
  net_surplus_ghs: column.integer,
  net_assets_ghs: column.integer,
  prepared_by: column.text,
  prepared_at: column.text,
  approved_by_pastor_elder: column.text,
  approved_at: column.text,
  auditor_signed_by: column.text,
  auditor_signed_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const year_end_checks = new Table({
  branch_id: column.text,
  year_end_run_id: column.text,
  check_key: column.text,
  category: column.text,
  label: column.text,
  status: column.text,
  details: column.text,
  target_route: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const year_end_overrides = new Table({
  branch_id: column.text,
  financial_year_id: column.text,
  year_end_run_id: column.text,
  check_key: column.text,
  check_label: column.text,
  reason: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const issued_reports = new Table({
  branch_id: column.text,
  financial_year_id: column.text,
  year_end_run_id: column.text,
  report_code: column.text,
  report_title: column.text,
  period_start: column.text,
  period_end: column.text,
  currency: column.text,
  payload_json: column.text,
  pdf_sha256: column.text,
  overrides_summary: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const import_batches = new Table({
  branch_id: column.text,
  batch_number: column.text,
  template_type: column.text,
  file_name: column.text,
  file_sha256: column.text,
  column_mapping: column.text,
  row_count: column.integer,
  status: column.text,
  cut_over_date: column.text,
  approved_by: column.text,
  reversed_at: column.text,
  reversed_by: column.text,
  reversal_reason: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const import_rows = new Table({
  branch_id: column.text,
  import_batch_id: column.text,
  row_number: column.integer,
  masked_payload: column.text,
  created_entity_type: column.text,
  created_entity_id: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const import_errors = new Table({
  branch_id: column.text,
  import_batch_id: column.text,
  row_number: column.integer,
  severity: column.text,
  field_name: column.text,
  message: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const parallel_run_entries = new Table({
  branch_id: column.text,
  period_id: column.text,
  account_id: column.text,
  fund_id: column.text,
  old_book_balance_pesewas: column.integer,
  system_balance_pesewas: column.integer,
  variance_pesewas: column.integer,
  status: column.text,
  explanation: column.text,
  approved_by_treasurer: column.text,
  approved_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const go_live_items = new Table({
  branch_id: column.text,
  item_key: column.text,
  label: column.text,
  status: column.text,
  target_route: column.text,
  verified_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const go_live_event = new Table({
  branch_id: column.text,
  cut_over_date: column.text,
  confirmed_by_treasurer: column.text,
  confirmed_by_pastor_elder: column.text,
  setup_window_closed: column.integer,
  demo_mode_locked: column.integer,
  notes: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const mfa_factors = new Table({
  branch_id: column.text,
  user_id: column.text,
  factor_type: column.text,
  secret_encrypted: column.text,
  credential_id: column.text,
  status: column.text,
  enrolled_at: column.text,
  reset_requested_by: column.text,
  reset_approved_by: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const recovery_codes = new Table({
  branch_id: column.text,
  user_id: column.text,
  code_sha256: column.text,
  is_used: column.integer,
  used_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const login_attempts = new Table({
  branch_id: column.text,
  user_email: column.text,
  user_id: column.text,
  attempt_type: column.text,
  succeeded: column.integer,
  consecutive_failures: column.integer,
  locked_until: column.text,
  unlocked_by: column.text,
  ip_label: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const device_enrolments = new Table({
  branch_id: column.text,
  device_id: column.text,
  device_name: column.text,
  user_id: column.text,
  app_version: column.text,
  schema_version: column.integer,
  approval_status: column.text,
  approved_by: column.text,
  approved_at: column.text,
  revoked_by: column.text,
  revoked_at: column.text,
  wipe_on_next_sync: column.integer,
  last_sync_at: column.text,
  created_by: column.text,
  created_at: column.text,
});

export const approval_rule_versions = new Table({
  branch_id: column.text,
  version_number: column.integer,
  effective_from: column.text,
  proposed_by: column.text,
  approved_by: column.text,
  approved_at: column.text,
  status: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const approval_rules = new Table({
  branch_id: column.text,
  version_id: column.text,
  transaction_type: column.text,
  band_label: column.text,
  min_amount_pesewas: column.integer,
  max_amount_pesewas: column.integer,
  required_approvals_count: column.integer,
  required_roles: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const approval_requests = new Table({
  branch_id: column.text,
  transaction_type: column.text,
  target_entity_id: column.text,
  amount_ghs_equivalent_pesewas: column.integer,
  required_approvals_count: column.integer,
  required_roles: column.text,
  payload_hash: column.text,
  status: column.text,
  requested_by: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const approval_steps = new Table({
  branch_id: column.text,
  approval_request_id: column.text,
  step_number: column.integer,
  approver_id: column.text,
  approver_role: column.text,
  decision: column.text,
  comments: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const sod_rules = new Table({
  branch_id: column.text,
  rule_code: column.text,
  description: column.text,
  is_blocking: column.integer,
  allow_treasurer_override: column.integer,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const sod_exceptions = new Table({
  branch_id: column.text,
  rule_code: column.text,
  exception_type: column.text,
  target_entity_type: column.text,
  target_entity_id: column.text,
  actor_user_id: column.text,
  overridden_by_treasurer: column.text,
  reason: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const controlled_detail_changes = new Table({
  branch_id: column.text,
  entity_type: column.text,
  entity_id: column.text,
  entity_name: column.text,
  field_name: column.text,
  old_value_masked: column.text,
  new_value: column.text,
  status: column.text,
  changed_by: column.text,
  approved_by: column.text,
  approved_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const security_events = new Table({
  branch_id: column.text,
  event_category: column.text,
  severity: column.text,
  summary: column.text,
  actor_user_id: column.text,
  ip_location_label: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const notifications = new Table({
  branch_id: column.text,
  recipient_role: column.text,
  security_event_id: column.text,
  title: column.text,
  message: column.text,
  is_read: column.integer,
  read_at: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const member_data_requests = new Table({
  branch_id: column.text,
  member_id: column.text,
  request_type: column.text,
  reason: column.text,
  status: column.text,
  approved_by: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const client_versions = new Table({
  branch_id: column.text,
  min_supported_app_version: column.text,
  latest_app_version: column.text,
  min_supported_schema_version: column.integer,
  current_schema_version: column.integer,
  release_notes: column.text,
  created_by: column.text,
  device_id: column.text,
  created_at: column.text,
});

export const AppSchema = new Schema({
  branches,
  roles,
  users_profile,
  devices,
  funds,
  accounts,
  financial_years,
  periods,
  exchange_rates,
  journal_entries,
  journal_lines,
  members,
  pledges,
  counting_sheets,
  counting_sheet_lines,
  requisitions,
  requisition_approvals,
  vendors,
  vouchers,
  budgets,
  budget_lines,
  assets,
  staff,
  payroll_runs,
  attachments,
  audit_log,
  sync_rejections,
  integrity_runs,
  integrity_findings,

  // Cashbook additions
  cash_accounts,
  cashbook_entries,
  cheques,
  cash_counts,
  cash_count_lines,
  cash_count_signoffs,
  bank_statement_lines,
  bank_reconciliations,
  bank_reconciliation_items,
  bank_reconciliation_signoffs,

  // Tithes additions
  tithe_batches,
  tithe_records,
  tithe_remittance_rules,
  tithe_remittances,

  // Fixed Assets additions
  asset_categories,
  fixed_assets,
  asset_events,
  asset_attachments,
  depreciation_runs,
  depreciation_lines,
  asset_verifications,
  asset_verification_lines,
  asset_policy_settings,

  // Go-Live, Year-End Close & Security additions
  year_end_runs,
  year_end_checks,
  year_end_overrides,
  issued_reports,
  import_batches,
  import_rows,
  import_errors,
  parallel_run_entries,
  go_live_items,
  go_live_event,
  mfa_factors,
  recovery_codes,
  login_attempts,
  device_enrolments,
  approval_rule_versions,
  approval_rules,
  approval_requests,
  approval_steps,
  sod_rules,
  sod_exceptions,
  controlled_detail_changes,
  security_events,
  notifications,
  member_data_requests,
  client_versions,
});

export type Database = (typeof AppSchema)['types'];
