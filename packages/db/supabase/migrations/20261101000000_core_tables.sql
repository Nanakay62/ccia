-- Migration 20261101000000: Core Tables for Church Accounting System (Accra, Ghana)
-- Base currency: GHS (cedis/pesewas). Dual currency: GHS & USD.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Branches (Future-proofing, default is main Accra branch)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL DEFAULT 'GHS',
    is_main BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default main branch
INSERT INTO branches (id, name, code, currency, is_main)
VALUES ('00000000-0000-0000-0000-000000000001', 'Accra Central Branch', 'ACCRA-MAIN', 'GHS', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Roles Reference
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT INTO roles (id, description) VALUES
    ('Treasurer', 'Full financial access, periods, rates, overrides'),
    ('Finance Secretary', 'Entry, vouchers, member giving'),
    ('Counter', 'Weekly counting sheet creation and signoff'),
    ('Pastor / Elder', 'Approvals, all reports, giving view'),
    ('Auditor', 'Read-only access to all financial data and audit log'),
    ('Department Head', 'Requisitions and own department budget only'),
    ('Admin', 'User and role management only, no financial access')
ON CONFLICT (id) DO NOTHING;

-- 3. Users Profile (Linked to Supabase auth.users or device profiles)
CREATE TABLE IF NOT EXISTS users_profile (
    id UUID PRIMARY KEY,
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL REFERENCES roles(id),
    department_id TEXT, -- e.g. 'Youth', 'Men', 'Women', 'Welfare'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Devices (For offline tracking, device prefix & revocation)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users_profile(id),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    device_name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Funds (Fund Accounting Core: Unrestricted vs. Restricted)
CREATE TABLE IF NOT EXISTS funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Unrestricted', 'Restricted')),
    description TEXT,
    allow_overdraft BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, code)
);

-- 6. Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
    currency TEXT NOT NULL CHECK (currency IN ('GHS', 'USD')),
    is_bank_or_cash BOOLEAN NOT NULL DEFAULT false,
    parent_id UUID REFERENCES accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, code)
);

-- 7. Accounting Periods (Monthly close)
CREATE TABLE IF NOT EXISTS periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users_profile(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, year, month)
);

-- 8. Exchange Rates (Entered manually by Treasurer)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    rate_date DATE NOT NULL,
    currency TEXT NOT NULL CHECK (currency = 'USD'),
    rate NUMERIC(12, 4) NOT NULL CHECK (rate > 0),
    entered_by UUID REFERENCES users_profile(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, rate_date, currency)
);

-- 9. Journal Entries (Headers)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    document_number TEXT NOT NULL,
    entry_date DATE NOT NULL,
    period_id UUID REFERENCES periods(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('STANDARD', 'COUNTING_SHEET', 'VOUCHER', 'REVALUATION', 'REVERSAL', 'OPENING_BALANCE')),
    narration TEXT NOT NULL,
    line_count INTEGER NOT NULL CHECK (line_count >= 2),
    total_debit_ghs BIGINT NOT NULL CHECK (total_debit_ghs >= 0),
    total_credit_ghs BIGINT NOT NULL CHECK (total_credit_ghs >= 0),
    is_reversal BOOLEAN NOT NULL DEFAULT false,
    reversal_of_id UUID REFERENCES journal_entries(id),
    created_by UUID NOT NULL REFERENCES users_profile(id),
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, document_number)
);

-- 10. Journal Lines (Details)
CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES accounts(id),
    fund_id UUID NOT NULL REFERENCES funds(id),
    line_number INTEGER NOT NULL,
    original_currency TEXT NOT NULL CHECK (original_currency IN ('GHS', 'USD')),
    original_amount BIGINT NOT NULL CHECK (original_amount > 0),
    exchange_rate NUMERIC(12, 4) NOT NULL DEFAULT 1.0000 CHECK (exchange_rate > 0),
    debit_amount_ghs BIGINT NOT NULL DEFAULT 0 CHECK (debit_amount_ghs >= 0),
    credit_amount_ghs BIGINT NOT NULL DEFAULT 0 CHECK (credit_amount_ghs >= 0),
    rounding_difference_pesewas BIGINT NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_debit_or_credit CHECK (
        (debit_amount_ghs > 0 AND credit_amount_ghs = 0) OR
        (credit_amount_ghs > 0 AND debit_amount_ghs = 0)
    ),
    UNIQUE (journal_entry_id, line_number)
);

-- 11. Members
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    member_number TEXT,
    full_name TEXT NOT NULL,
    encrypted_phone TEXT, -- Encrypted via Web Crypto API AES-GCM
    phone_hint TEXT,      -- Last 3 digits for lookup
    department TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'VISITOR')),
    join_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, member_number)
);

-- 12. Pledges
CREATE TABLE IF NOT EXISTS pledges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    member_id UUID NOT NULL REFERENCES members(id),
    fund_id UUID NOT NULL REFERENCES funds(id),
    pledge_date DATE NOT NULL,
    target_date DATE,
    currency TEXT NOT NULL CHECK (currency IN ('GHS', 'USD')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Weekly Counting Sheets (Service-day cash & currency counting)
CREATE TABLE IF NOT EXISTS counting_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    sheet_number TEXT NOT NULL,
    service_date DATE NOT NULL,
    service_type TEXT NOT NULL, -- 'Sunday First Service', 'Sunday Second Service', 'Midweek', 'Special'
    first_counter_id UUID NOT NULL REFERENCES users_profile(id),
    first_signed_at TIMESTAMPTZ,
    second_counter_id UUID REFERENCES users_profile(id),
    second_signed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    total_ghs BIGINT NOT NULL DEFAULT 0,
    total_usd BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users_profile(id),
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_counters_differ CHECK (first_counter_id <> second_counter_id),
    UNIQUE (branch_id, sheet_number)
);

-- 14. Counting Sheet Lines (Denomination breakdowns & category assignments)
CREATE TABLE IF NOT EXISTS counting_sheet_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    counting_sheet_id UUID NOT NULL REFERENCES counting_sheets(id) ON DELETE CASCADE,
    fund_id UUID NOT NULL REFERENCES funds(id),
    category TEXT NOT NULL, -- 'Tithe', 'Offering', 'Special Offering', 'Pledge Payment', 'Donation'
    currency TEXT NOT NULL CHECK (currency IN ('GHS', 'USD')),
    denomination_value INTEGER NOT NULL, -- e.g. 200, 100, 50, 20, 10, 5, 2, 1, or minor coin
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    line_total BIGINT NOT NULL CHECK (line_total >= 0),
    member_id UUID REFERENCES members(id), -- Nullable for anonymous/general offering
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Requisitions (Expense approvals)
CREATE TABLE IF NOT EXISTS requisitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    req_number TEXT NOT NULL,
    department_id TEXT NOT NULL,
    fund_id UUID NOT NULL REFERENCES funds(id),
    purpose TEXT NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('GHS', 'USD')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    submitted_by UUID NOT NULL REFERENCES users_profile(id),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, req_number)
);

-- 16. Requisition Approvals
CREATE TABLE IF NOT EXISTS requisition_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisition_id UUID NOT NULL REFERENCES requisitions(id),
    approver_id UUID NOT NULL REFERENCES users_profile(id),
    action TEXT NOT NULL CHECK (action IN ('APPROVED', 'REJECTED')),
    comments TEXT,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Vendors / Payees
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    name TEXT NOT NULL,
    category TEXT,
    contact_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Payment Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    voucher_number TEXT NOT NULL,
    requisition_id UUID REFERENCES requisitions(id),
    vendor_id UUID REFERENCES vendors(id),
    payee_name TEXT NOT NULL,
    fund_id UUID NOT NULL REFERENCES funds(id),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH_GHS', 'CASH_USD', 'BANK_GHS', 'BANK_USD', 'MOMO', 'CHEQUE')),
    currency TEXT NOT NULL CHECK (currency IN ('GHS', 'USD')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    voucher_date DATE NOT NULL,
    prepared_by UUID NOT NULL REFERENCES users_profile(id),
    authorized_by UUID REFERENCES users_profile(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, voucher_number)
);

-- 19. Budgets
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    year INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, year)
);

-- 20. Budget Lines
CREATE TABLE IF NOT EXISTS budget_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    fund_id UUID NOT NULL REFERENCES funds(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    department_id TEXT,
    annual_amount_ghs BIGINT NOT NULL CHECK (annual_amount_ghs >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. Fixed Assets Register
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    asset_tag TEXT NOT NULL,
    name TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    cost_amount BIGINT NOT NULL CHECK (cost_amount > 0),
    cost_currency TEXT NOT NULL CHECK (cost_currency IN ('GHS', 'USD')),
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_USE' CHECK (status IN ('IN_USE', 'DISPOSED', 'DAMAGED', 'UNDER_MAINTENANCE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, asset_tag)
);

-- 22. Staff List
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    full_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    monthly_salary_ghs BIGINT NOT NULL CHECK (monthly_salary_ghs >= 0),
    allowances_ghs BIGINT NOT NULL DEFAULT 0 CHECK (allowances_ghs >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. Payroll Runs
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    period_id UUID NOT NULL REFERENCES periods(id),
    run_date DATE NOT NULL,
    total_gross_ghs BIGINT NOT NULL CHECK (total_gross_ghs >= 0),
    total_allowances_ghs BIGINT NOT NULL CHECK (total_allowances_ghs >= 0),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID NOT NULL REFERENCES users_profile(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Attachments (Receipt photos, compressed)
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    entity_type TEXT NOT NULL, -- 'VOUCHER', 'REQUISITION', 'COUNTING_SHEET'
    entity_id UUID NOT NULL,
    storage_path TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. Audit Log (Append-only)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL,
    device_id TEXT NOT NULL,
    reason TEXT,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. Sync Rejections (For non-blocking upload queues)
CREATE TABLE IF NOT EXISTS sync_rejections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    transaction_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    payload JSONB NOT NULL,
    device_id TEXT NOT NULL,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users_profile(id),
    resolution_notes TEXT
);

-- 27. Integrity Runs (Trial Balance Doctor runs)
CREATE TABLE IF NOT EXISTS integrity_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES branches(id),
    triggered_by UUID REFERENCES users_profile(id),
    is_automated BOOLEAN NOT NULL DEFAULT false,
    total_debits_ghs BIGINT NOT NULL,
    total_credits_ghs BIGINT NOT NULL,
    difference_ghs BIGINT NOT NULL,
    explained_ghs BIGINT NOT NULL DEFAULT 0,
    unexplained_ghs BIGINT NOT NULL DEFAULT 0,
    findings_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. Integrity Findings
CREATE TABLE IF NOT EXISTS integrity_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES integrity_runs(id) ON DELETE CASCADE,
    rule_number INTEGER NOT NULL, -- Check rule 1 to 10 from Section 3.5
    severity TEXT NOT NULL CHECK (severity IN ('ERROR', 'WARNING', 'INFO')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB,
    recommended_fix TEXT NOT NULL,
    related_entry_id UUID REFERENCES journal_entries(id),
    is_reviewed BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES users_profile(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_fund ON journal_lines(fund_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_counting_sheet_lines_sheet ON counting_sheet_lines(counting_sheet_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
