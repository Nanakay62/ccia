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

export const periods = new Table(
  {
    branch_id: column.text,
    year: column.integer,
    month: column.integer,
    start_date: column.text,
    end_date: column.text,
    is_closed: column.integer,
    closed_at: column.text,
    closed_by: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      year_month: ['year', 'month'],
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
    document_number: column.text,
    entry_date: column.text,
    period_id: column.text,
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

export const AppSchema = new Schema({
  branches,
  roles,
  users_profile,
  devices,
  funds,
  accounts,
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
});

export type Database = (typeof AppSchema)['types'];
