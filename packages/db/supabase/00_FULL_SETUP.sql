-- ============================================================================
-- CHURCH ACCOUNTING SYSTEM — COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- Run this entire file in your Supabase SQL Editor to initialize the database.
-- ============================================================================

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261101000000_core_tables.sql <<<
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

-- >>> END FILE: packages\db\supabase\migrations\20261101000000_core_tables.sql <<<

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261101000001_constraints_and_triggers.sql <<<
-- Migration 20261101000001: Accounting Integrity Constraints, Deferred Triggers, & Immutability Rules

-- 1. Function to enforce Journal Entry Balancing (Base Currency, Per-Fund, and Control Totals)
CREATE OR REPLACE FUNCTION fn_check_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    entry_rec RECORD;
    fund_balance_rec RECORD;
    actual_line_count INTEGER;
    actual_debit BIGINT;
    actual_credit BIGINT;
    entry_period_closed BOOLEAN;
BEGIN
    -- Evaluate all journal entries affected in the transaction
    FOR entry_rec IN
        SELECT DISTINCT je.id, je.document_number, je.line_count, je.total_debit_ghs, je.total_credit_ghs, je.entry_date, je.period_id
        FROM journal_entries je
        WHERE je.id IN (
            SELECT journal_entry_id FROM journal_lines WHERE id = COALESCE(NEW.id, OLD.id)
            UNION
            SELECT COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
        )
    LOOP
        -- Check 1: Verify period is not closed
        IF entry_rec.period_id IS NOT NULL THEN
            SELECT is_closed INTO entry_period_closed FROM periods WHERE id = entry_rec.period_id;
            IF entry_period_closed THEN
                RAISE EXCEPTION 'Ledger rejection: Cannot post to closed period for entry %', entry_rec.document_number;
            END IF;
        ELSE
            SELECT is_closed INTO entry_period_closed
            FROM periods
            WHERE start_date <= entry_rec.entry_date AND end_date >= entry_rec.entry_date
            LIMIT 1;
            IF entry_period_closed THEN
                RAISE EXCEPTION 'Ledger rejection: Entry date % falls in a closed accounting period.', entry_rec.entry_date;
            END IF;
        END IF;

        -- Check 2: Aggregate actual lines for the entry
        SELECT
            COUNT(*),
            COALESCE(SUM(debit_amount_ghs), 0),
            COALESCE(SUM(credit_amount_ghs), 0)
        INTO
            actual_line_count,
            actual_debit,
            actual_credit
        FROM journal_lines
        WHERE journal_entry_id = entry_rec.id;

        -- Check 2a: Minimum 2 lines
        IF actual_line_count < 2 THEN
            RAISE EXCEPTION 'Ledger rejection: Journal entry % must have at least 2 lines, found %',
                entry_rec.document_number, actual_line_count;
        END IF;

        -- Check 2b: Line count control total
        IF actual_line_count <> entry_rec.line_count THEN
            RAISE EXCEPTION 'Ledger rejection: Journal entry % line count mismatch. Header specifies %, lines contain %',
                entry_rec.document_number, entry_rec.line_count, actual_line_count;
        END IF;

        -- Check 2c: Overall Debits must equal Credits in Base Currency (GHS)
        IF actual_debit <> actual_credit THEN
            RAISE EXCEPTION 'Ledger rejection: Unbalanced entry %! Total Debits (% pesewas) <> Total Credits (% pesewas)',
                entry_rec.document_number, actual_debit, actual_credit;
        END IF;

        -- Check 2d: Control totals in header must match lines
        IF actual_debit <> entry_rec.total_debit_ghs OR actual_credit <> entry_rec.total_credit_ghs THEN
            RAISE EXCEPTION 'Ledger rejection: Journal entry % control total mismatch. Header (Dr: %, Cr: %) <> Lines (Dr: %, Cr: %)',
                entry_rec.document_number, entry_rec.total_debit_ghs, entry_rec.total_credit_ghs, actual_debit, actual_credit;
        END IF;

        -- Check 3: Per-Fund Balancing Rule (Fund Accounting Principle)
        -- Every fund in the transaction must balance (sum Dr = sum Cr)
        -- unless interfund due-to/due-from clearing accounts are used.
        FOR fund_balance_rec IN
            SELECT
                jl.fund_id,
                f.name as fund_name,
                COALESCE(SUM(jl.debit_amount_ghs), 0) as fund_debit,
                COALESCE(SUM(jl.credit_amount_ghs), 0) as fund_credit
            FROM journal_lines jl
            JOIN funds f ON f.id = jl.fund_id
            WHERE jl.journal_entry_id = entry_rec.id
            GROUP BY jl.fund_id, f.name
        LOOP
            IF fund_balance_rec.fund_debit <> fund_balance_rec.fund_credit THEN
                RAISE EXCEPTION 'Ledger rejection: Entry % is unbalanced for fund "%" (Dr: %, Cr: %). Fund accounting requires balanced entries per fund or explicit interfund clearing.',
                    entry_rec.document_number, fund_balance_rec.fund_name, fund_balance_rec.fund_debit, fund_balance_rec.fund_credit;
            END IF;
        END LOOP;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create constraint trigger on journal_lines, deferred until transaction commit
DROP TRIGGER IF EXISTS trg_check_journal_lines_balance ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_lines_balance
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_check_journal_entry_balance();

-- 2. Immutability Trigger: Append-Only Ledger Enforcement
CREATE OR REPLACE FUNCTION fn_prevent_journal_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Accounting ledger is append-only. Modifying posted entries or lines is strictly prohibited. Create a linked reversal instead.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Accounting ledger is append-only. Deleting posted entries or lines is strictly prohibited. Create a linked reversal instead.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_journal_entries ON journal_entries;
CREATE TRIGGER trg_immutable_journal_entries
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_journal_modification();

DROP TRIGGER IF EXISTS trg_immutable_journal_lines ON journal_lines;
CREATE TRIGGER trg_immutable_journal_lines
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_journal_modification();

-- 3. Automatic Audit Logging Trigger for Configuration & Administrative Changes
CREATE OR REPLACE FUNCTION fn_audit_log_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user UUID;
    v_device TEXT;
BEGIN
    v_user := COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID
    );
    v_device := COALESCE(
        NULLIF(current_setting('app.current_device_id', true), ''),
        'SYSTEM-SERVER'
    );

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (branch_id, entity_type, entity_id, action, performed_by, device_id, after_state)
        VALUES (NEW.branch_id, TG_TABLE_NAME, NEW.id, 'CREATE', v_user, v_device, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (branch_id, entity_type, entity_id, action, performed_by, device_id, before_state, after_state)
        VALUES (NEW.branch_id, TG_TABLE_NAME, NEW.id, 'UPDATE', v_user, v_device, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (branch_id, entity_type, entity_id, action, performed_by, device_id, before_state)
        VALUES (OLD.branch_id, TG_TABLE_NAME, OLD.id, 'DELETE', v_user, v_device, to_jsonb(OLD));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_funds ON funds;
CREATE TRIGGER trg_audit_funds
AFTER INSERT OR UPDATE OR DELETE ON funds
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_accounts ON accounts;
CREATE TRIGGER trg_audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_periods ON periods;
CREATE TRIGGER trg_audit_periods
AFTER INSERT OR UPDATE ON periods
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_rates ON exchange_rates;
CREATE TRIGGER trg_audit_rates
AFTER INSERT OR UPDATE ON exchange_rates
FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

-- >>> END FILE: packages\db\supabase\migrations\20261101000001_constraints_and_triggers.sql <<<

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261101000002_rls_policies.sql <<<
-- Migration 20261101000002: Row Level Security (RLS) Policies
-- Enforces role-based permissions and member giving privacy inside Postgres

-- Helper function to fetch current authenticated user profile
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS users_profile AS $$
DECLARE
    profile users_profile;
BEGIN
    SELECT * INTO profile
    FROM users_profile
    WHERE id = auth.uid() OR id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
    LIMIT 1;
    RETURN profile;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS across all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE counting_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE counting_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_findings ENABLE ROW LEVEL SECURITY;

-- 1. Reference Data (Roles, Branches, Funds, Accounts, Exchange Rates, Periods)
-- Read policy: Any active user in the branch can view reference data
DROP POLICY IF EXISTS "Read reference data" ON funds;
CREATE POLICY "Read reference data" ON funds
    FOR SELECT USING ((get_current_user_profile()).is_active);

DROP POLICY IF EXISTS "Read accounts" ON accounts;
CREATE POLICY "Read accounts" ON accounts
    FOR SELECT USING ((get_current_user_profile()).is_active);

DROP POLICY IF EXISTS "Read periods" ON periods;
CREATE POLICY "Read periods" ON periods
    FOR SELECT USING ((get_current_user_profile()).is_active);

DROP POLICY IF EXISTS "Read exchange_rates" ON exchange_rates;
CREATE POLICY "Read exchange_rates" ON exchange_rates
    FOR SELECT USING ((get_current_user_profile()).is_active);

DROP POLICY IF EXISTS "Read branches" ON branches;
CREATE POLICY "Read branches" ON branches
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Read roles" ON roles;
CREATE POLICY "Read roles" ON roles
    FOR SELECT USING (true);

-- Treasurer can manage reference data
DROP POLICY IF EXISTS "Treasurer manage funds" ON funds;
CREATE POLICY "Treasurer manage funds" ON funds
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

DROP POLICY IF EXISTS "Treasurer manage accounts" ON accounts;
CREATE POLICY "Treasurer manage accounts" ON accounts
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

DROP POLICY IF EXISTS "Treasurer manage periods" ON periods;
CREATE POLICY "Treasurer manage periods" ON periods
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

DROP POLICY IF EXISTS "Treasurer manage rates" ON exchange_rates;
CREATE POLICY "Treasurer manage rates" ON exchange_rates
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

-- 2. Journal Entries and Lines
-- Read: Treasurer, Finance Secretary, Pastor / Elder, Auditor
DROP POLICY IF EXISTS "Read journal entries" ON journal_entries;
CREATE POLICY "Read journal entries" ON journal_entries
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

DROP POLICY IF EXISTS "Read journal lines" ON journal_lines;
CREATE POLICY "Read journal lines" ON journal_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

-- Insert: Treasurer, Finance Secretary
DROP POLICY IF EXISTS "Insert journal entries" ON journal_entries;
CREATE POLICY "Insert journal entries" ON journal_entries
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

DROP POLICY IF EXISTS "Insert journal lines" ON journal_lines;
CREATE POLICY "Insert journal lines" ON journal_lines
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- 3. Member Directory & Privacy (Section 5: individual giving visible ONLY to Treasurer, Finance Secretary, Pastor/Elder, Auditor)
DROP POLICY IF EXISTS "View member directory" ON members;
CREATE POLICY "View member directory" ON members
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor', 'Counter')
    );

DROP POLICY IF EXISTS "Manage members" ON members;
CREATE POLICY "Manage members" ON members
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- Pledges: visible only to leadership roles
DROP POLICY IF EXISTS "View pledges" ON pledges;
CREATE POLICY "View pledges" ON pledges
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

DROP POLICY IF EXISTS "Manage pledges" ON pledges;
CREATE POLICY "Manage pledges" ON pledges
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- 4. Weekly Counting Sheets
-- Counters, Treasurer, Finance Secretary can create/view counting sheets
DROP POLICY IF EXISTS "View counting sheets" ON counting_sheets;
CREATE POLICY "View counting sheets" ON counting_sheets
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

DROP POLICY IF EXISTS "Manage counting sheets" ON counting_sheets;
CREATE POLICY "Manage counting sheets" ON counting_sheets
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary')
    );

DROP POLICY IF EXISTS "View counting sheet lines" ON counting_sheet_lines;
CREATE POLICY "View counting sheet lines" ON counting_sheet_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

DROP POLICY IF EXISTS "Insert counting sheet lines" ON counting_sheet_lines;
CREATE POLICY "Insert counting sheet lines" ON counting_sheet_lines
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary')
    );

-- 5. Requisitions and Approvals
-- Department Head can view and submit only their department's requisitions
DROP POLICY IF EXISTS "Department head view requisitions" ON requisitions;
CREATE POLICY "Department head view requisitions" ON requisitions
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor') OR
        ((get_current_user_profile()).role = 'Department Head' AND department_id = (get_current_user_profile()).department_id)
    );

DROP POLICY IF EXISTS "Submit requisitions" ON requisitions;
CREATE POLICY "Submit requisitions" ON requisitions
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Department Head')
    );

-- Pastor / Elder approves requisitions
DROP POLICY IF EXISTS "Pastor approve requisitions" ON requisition_approvals;
CREATE POLICY "Pastor approve requisitions" ON requisition_approvals
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Pastor / Elder', 'Treasurer')
    );

DROP POLICY IF EXISTS "View approvals" ON requisition_approvals;
CREATE POLICY "View approvals" ON requisition_approvals
    FOR SELECT USING (true);

-- 6. Budgets
DROP POLICY IF EXISTS "View budgets" ON budgets;
CREATE POLICY "View budgets" ON budgets
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Department head view budget lines" ON budget_lines;
CREATE POLICY "Department head view budget lines" ON budget_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor') OR
        ((get_current_user_profile()).role = 'Department Head' AND department_id = (get_current_user_profile()).department_id)
    );

DROP POLICY IF EXISTS "Treasurer manage budgets" ON budgets;
CREATE POLICY "Treasurer manage budgets" ON budgets
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

DROP POLICY IF EXISTS "Treasurer manage budget lines" ON budget_lines;
CREATE POLICY "Treasurer manage budget lines" ON budget_lines
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

-- 7. Audit Log: Visible only to Auditor and Treasurer. Strictly no update/delete.
DROP POLICY IF EXISTS "Auditor and Treasurer view audit log" ON audit_log;
CREATE POLICY "Auditor and Treasurer view audit log" ON audit_log
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Auditor', 'Treasurer')
    );

DROP POLICY IF EXISTS "System insert audit log" ON audit_log;
CREATE POLICY "System insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);

-- 8. Sync Rejections: Visible and managed by Treasurer
DROP POLICY IF EXISTS "Treasurer manage sync rejections" ON sync_rejections;
CREATE POLICY "Treasurer manage sync rejections" ON sync_rejections
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

-- 9. Trial Balance Doctor (Integrity Runs & Findings)
DROP POLICY IF EXISTS "View integrity runs" ON integrity_runs;
CREATE POLICY "View integrity runs" ON integrity_runs
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Auditor')
    );

DROP POLICY IF EXISTS "Treasurer manage integrity runs" ON integrity_runs;
CREATE POLICY "Treasurer manage integrity runs" ON integrity_runs
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

DROP POLICY IF EXISTS "View integrity findings" ON integrity_findings;
CREATE POLICY "View integrity findings" ON integrity_findings
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Auditor')
    );

DROP POLICY IF EXISTS "Treasurer manage integrity findings" ON integrity_findings;
CREATE POLICY "Treasurer manage integrity findings" ON integrity_findings
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

-- 10. Admin: User and Device management
DROP POLICY IF EXISTS "Admin manage users" ON users_profile;
CREATE POLICY "Admin manage users" ON users_profile
    FOR ALL USING (
        (get_current_user_profile()).role = 'Admin' OR (get_current_user_profile()).role = 'Treasurer'
    );

DROP POLICY IF EXISTS "View user profiles" ON users_profile;
CREATE POLICY "View user profiles" ON users_profile
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage devices" ON devices;
CREATE POLICY "Admin manage devices" ON devices
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Admin', 'Treasurer')
    );

-- >>> END FILE: packages\db\supabase\migrations\20261101000002_rls_policies.sql <<<

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261101000003_seed_data.sql <<<
-- Migration 20261101000003: Default Seed Data (Chart of Accounts, Funds, Sample Exchange Rate)

-- 1. Standard Church Funds
INSERT INTO funds (id, branch_id, code, name, type, description, allow_overdraft) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'GEN', 'General Fund', 'Unrestricted', 'Main operational church fund', true),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'BLD', 'Building Fund', 'Restricted', 'Capital building project and infrastructure', false),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'MIS', 'Missions & Outreach', 'Restricted', 'Evangelism, church planting and missionary support', false),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'WEL', 'Welfare & Benevolence', 'Restricted', 'Support for needy church members and community care', false),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'YTH', 'Youth Ministry', 'Restricted', 'Youth and teenage ministry activities', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 2. Standard Church Chart of Accounts
-- Assets (1000-1999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000000001', '1010', 'Cash on Hand (GHS)', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001020', '00000000-0000-0000-0000-000000000001', '1020', 'Cash on Hand (USD)', 'Asset', 'USD', true),
    ('20000000-0000-0000-0000-000000001030', '00000000-0000-0000-0000-000000000001', '1030', 'Bank Account (GHS)', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001040', '00000000-0000-0000-0000-000000000001', '1040', 'Bank Account (USD)', 'Asset', 'USD', true),
    ('20000000-0000-0000-0000-000000001050', '00000000-0000-0000-0000-000000000001', '1050', 'Mobile Money (MoMo) Wallet', 'Asset', 'GHS', true),
    ('20000000-0000-0000-0000-000000001500', '00000000-0000-0000-0000-000000000001', '1500', 'Fixed Assets (Equipment & Buildings)', 'Asset', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Liabilities (2000-2999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000002010', '00000000-0000-0000-0000-000000000001', '2010', 'Accounts Payable', 'Liability', 'GHS', false),
    ('20000000-0000-0000-0000-000000002020', '00000000-0000-0000-0000-000000000001', '2020', 'Interfund Due To / Due From', 'Liability', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Equity / Fund Balances (3000-3999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000003010', '00000000-0000-0000-0000-000000000001', '3010', 'General Fund Equity', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003020', '00000000-0000-0000-0000-000000000001', '3020', 'Building Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003030', '00000000-0000-0000-0000-000000000001', '3030', 'Missions Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003040', '00000000-0000-0000-0000-000000000001', '3040', 'Welfare Fund Balance', 'Equity', 'GHS', false),
    ('20000000-0000-0000-0000-000000003050', '00000000-0000-0000-0000-000000000001', '3050', 'Youth Fund Balance', 'Equity', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Income Accounts (4000-4999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000004010', '00000000-0000-0000-0000-000000000001', '4010', 'Tithes', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004020', '00000000-0000-0000-0000-000000000001', '4020', 'General Offerings', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004030', '00000000-0000-0000-0000-000000000001', '4030', 'Special Offerings', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004040', '00000000-0000-0000-0000-000000000001', '4040', 'Pledge Payments', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004050', '00000000-0000-0000-0000-000000000001', '4050', 'Donations & Gifts', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004060', '00000000-0000-0000-0000-000000000001', '4060', 'Rentals & Facility Income', 'Income', 'GHS', false),
    ('20000000-0000-0000-0000-000000004090', '00000000-0000-0000-0000-000000000001', '4090', 'Other Income', 'Income', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- Expense Accounts (5000-5999)
INSERT INTO accounts (id, branch_id, code, name, type, currency, is_bank_or_cash) VALUES
    ('20000000-0000-0000-0000-000000005010', '00000000-0000-0000-0000-000000000001', '5010', 'Salaries and Allowances', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005020', '00000000-0000-0000-0000-000000000001', '5020', 'Utilities (Electricity, Water, Internet)', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005030', '00000000-0000-0000-0000-000000000001', '5030', 'Maintenance & Repairs', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005040', '00000000-0000-0000-0000-000000000001', '5040', 'Outreach and Missions', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005050', '00000000-0000-0000-0000-000000000001', '5050', 'Welfare Support', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005060', '00000000-0000-0000-0000-000000000001', '5060', 'Church Events & Conferences', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005070', '00000000-0000-0000-0000-000000000001', '5070', 'Equipment & Instruments', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005080', '00000000-0000-0000-0000-000000000001', '5080', 'Admin, Office & Printing', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005090', '00000000-0000-0000-0000-000000000001', '5090', 'Transport & Fuel', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005980', '00000000-0000-0000-0000-000000000001', '5980', 'Foreign Exchange Gain/Loss', 'Expense', 'GHS', false),
    ('20000000-0000-0000-0000-000000005990', '00000000-0000-0000-0000-000000000001', '5990', 'Rounding Differences', 'Expense', 'GHS', false)
ON CONFLICT (branch_id, code) DO NOTHING;

-- 3. Initial Sample Exchange Rate for USD/GHS
INSERT INTO exchange_rates (id, branch_id, rate_date, currency, rate, notes) VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', CURRENT_DATE, 'USD', 15.5000, 'Initial benchmark market rate for USD/GHS')
ON CONFLICT (branch_id, rate_date, currency) DO NOTHING;

-- >>> END FILE: packages\db\supabase\migrations\20261101000003_seed_data.sql <<<

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261101000004_rpc_posting_functions.sql <<<
-- Migration 20261101000004: Server-Validated RPC Posting Functions & Optimistic Concurrency Control

-- 1. Add row_version to mutable tables for optimistic locking and conflict detection
ALTER TABLE members ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

-- Trigger to increment row_version on update
CREATE OR REPLACE FUNCTION fn_increment_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version = OLD.row_version + 1;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_version ON members;
CREATE TRIGGER trg_members_version
BEFORE UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION fn_increment_row_version();

DROP TRIGGER IF EXISTS trg_vendors_version ON vendors;
CREATE TRIGGER trg_vendors_version
BEFORE UPDATE ON vendors
FOR EACH ROW EXECUTE FUNCTION fn_increment_row_version();

DROP TRIGGER IF EXISTS trg_requisitions_version ON requisitions;
CREATE TRIGGER trg_requisitions_version
BEFORE UPDATE ON requisitions
FOR EACH ROW EXECUTE FUNCTION fn_increment_row_version();

-- 2. RPC: post_journal_entry (Server-validated, idempotent by UUID)
CREATE OR REPLACE FUNCTION post_journal_entry(p_entry JSONB)
RETURNS JSONB AS $$
DECLARE
    v_id UUID;
    v_branch_id UUID;
    v_doc_number TEXT;
    v_entry_date DATE;
    v_narration TEXT;
    v_entry_type TEXT;
    v_created_by UUID;
    v_device_id TEXT;
    v_lines JSONB;
    v_line RECORD;
    v_total_dr BIGINT := 0;
    v_total_cr BIGINT := 0;
    v_line_count INTEGER;
    v_user_role TEXT;
    v_period_closed BOOLEAN;
    v_existing_id UUID;
BEGIN
    v_id := (p_entry->>'id')::UUID;
    v_branch_id := COALESCE((p_entry->>'branch_id')::UUID, '00000000-0000-0000-0000-000000000001'::UUID);
    v_doc_number := p_entry->>'document_number';
    v_entry_date := (p_entry->>'entry_date')::DATE;
    v_narration := p_entry->>'narration';
    v_entry_type := COALESCE(p_entry->>'entry_type', 'STANDARD');
    v_created_by := (p_entry->>'created_by')::UUID;
    v_device_id := p_entry->>'device_id';
    v_lines := p_entry->'lines';

    -- 1. Idempotency Check: if entry ID already posted, return success without duplicate insert
    SELECT id INTO v_existing_id FROM journal_entries WHERE id = v_id;
    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'id', v_id,
            'idempotent', true,
            'message', 'Entry already posted (idempotent replay).'
        );
    END IF;

    -- 2. Authorization Check
    SELECT role INTO v_user_role FROM users_profile WHERE id = v_created_by;
    IF v_user_role NOT IN ('Treasurer', 'Finance Secretary') THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: User role % is not authorized to post journal entries.', v_user_role;
    END IF;

    -- 3. Accounting Period Lock Check
    SELECT is_closed INTO v_period_closed
    FROM periods
    WHERE branch_id = v_branch_id AND start_date <= v_entry_date AND end_date >= v_entry_date;

    IF v_period_closed THEN
        RAISE EXCEPTION 'PERIOD_CLOSED: Accounting period for % is closed. Postings rejected.', v_entry_date;
    END IF;

    -- 4. Line validation and totals
    v_line_count := jsonb_array_length(v_lines);
    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Journal entry must contain at least 2 lines, received %', v_line_count;
    END IF;

    -- Compute line totals
    FOR v_line IN SELECT * FROM jsonb_to_recordset(v_lines) AS x(
        debit_amount_ghs BIGINT,
        credit_amount_ghs BIGINT
    )
    LOOP
        v_total_dr := v_total_dr + COALESCE(v_line.debit_amount_ghs, 0);
        v_total_cr := v_total_cr + COALESCE(v_line.credit_amount_ghs, 0);
    END LOOP;

    -- Double-entry balance check in base currency
    IF v_total_dr <> v_total_cr THEN
        RAISE EXCEPTION 'UNBALANCED_ENTRY: Debits (%) do not equal Credits (%). Difference: %',
            v_total_dr, v_total_cr, (v_total_dr - v_total_cr);
    END IF;

    -- 5. Insert Entry Header
    INSERT INTO journal_entries (
        id, branch_id, document_number, entry_date, entry_type,
        narration, line_count, total_debit_ghs, total_credit_ghs,
        created_by, device_id
    ) VALUES (
        v_id, v_branch_id, v_doc_number, v_entry_date, v_entry_type,
        v_narration, v_line_count, v_total_dr, v_total_cr,
        v_created_by, v_device_id
    );

    -- 6. Insert Lines
    INSERT INTO journal_lines (
        id, journal_entry_id, account_id, fund_id, line_number,
        original_currency, original_amount, exchange_rate,
        debit_amount_ghs, credit_amount_ghs, rounding_difference_pesewas,
        description
    )
    SELECT
        (l->>'id')::UUID,
        v_id,
        (l->>'account_id')::UUID,
        (l->>'fund_id')::UUID,
        (l->>'line_number')::INTEGER,
        l->>'original_currency',
        (l->>'original_amount')::BIGINT,
        (COALESCE(l->>'exchange_rate', '1.0000'))::NUMERIC(12, 4),
        (COALESCE(l->>'debit_amount_ghs', '0'))::BIGINT,
        (COALESCE(l->>'credit_amount_ghs', '0'))::BIGINT,
        (COALESCE(l->>'rounding_difference_pesewas', '0'))::BIGINT,
        l->>'description'
    FROM jsonb_array_elements(v_lines) AS l;

    -- Log to audit trail
    INSERT INTO audit_log (branch_id, entity_type, entity_id, action, performed_by, device_id, after_state)
    VALUES (v_branch_id, 'journal_entries', v_id, 'CREATE', v_created_by, v_device_id, p_entry);

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'document_number', v_doc_number,
        'total_debit_ghs', v_total_dr
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: submit_counting_sheet (Enforces two-counter digital signoff)
CREATE OR REPLACE FUNCTION submit_counting_sheet(p_sheet JSONB, p_lines JSONB)
RETURNS JSONB AS $$
DECLARE
    v_id UUID;
    v_branch_id UUID;
    v_sheet_number TEXT;
    v_first_counter UUID;
    v_second_counter UUID;
    v_existing_id UUID;
BEGIN
    v_id := (p_sheet->>'id')::UUID;
    v_branch_id := COALESCE((p_sheet->>'branch_id')::UUID, '00000000-0000-0000-0000-000000000001'::UUID);
    v_sheet_number := p_sheet->>'sheet_number';
    v_first_counter := (p_sheet->>'first_counter_id')::UUID;
    v_second_counter := (p_sheet->>'second_counter_id')::UUID;

    -- Idempotency check
    SELECT id INTO v_existing_id FROM counting_sheets WHERE id = v_id;
    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'id', v_id, 'idempotent', true);
    END IF;

    -- Rule: Two distinct counters required
    IF v_first_counter IS NULL OR v_second_counter IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Counting sheet requires two counter sign-offs.';
    END IF;

    IF v_first_counter = v_second_counter THEN
        RAISE EXCEPTION 'VALIDATION_FAILED: Two distinct counter users must sign off. Same user cannot sign twice.';
    END IF;

    -- Insert counting sheet
    INSERT INTO counting_sheets (
        id, branch_id, sheet_number, service_date, service_type,
        first_counter_id, first_signed_at, second_counter_id, second_signed_at,
        status, total_ghs, total_usd, created_by, device_id
    ) VALUES (
        v_id, v_branch_id, v_sheet_number,
        (p_sheet->>'service_date')::DATE,
        p_sheet->>'service_type',
        v_first_counter, NOW(),
        v_second_counter, NOW(),
        'SUBMITTED',
        (p_sheet->>'total_ghs')::BIGINT,
        (p_sheet->>'total_usd')::BIGINT,
        (p_sheet->>'created_by')::UUID,
        p_sheet->>'device_id'
    );

    -- Insert lines
    INSERT INTO counting_sheet_lines (
        id, counting_sheet_id, fund_id, category, currency,
        denomination_value, quantity, line_total, member_id
    )
    SELECT
        (l->>'id')::UUID,
        v_id,
        (l->>'fund_id')::UUID,
        l->>'category',
        l->>'currency',
        (l->>'denomination_value')::INTEGER,
        (l->>'quantity')::INTEGER,
        (l->>'line_total')::BIGINT,
        NULLIF(l->>'member_id', '')::UUID
    FROM jsonb_array_elements(p_lines) AS l;

    RETURN jsonb_build_object('success', true, 'id', v_id, 'sheet_number', v_sheet_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: update_mutable_record_with_conflict_check (Optimistic Locking)
CREATE OR REPLACE FUNCTION update_member_with_conflict_check(
    p_id UUID,
    p_expected_version INTEGER,
    p_full_name TEXT,
    p_encrypted_phone TEXT,
    p_phone_hint TEXT,
    p_department TEXT,
    p_status TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_current_version INTEGER;
BEGIN
    SELECT row_version INTO v_current_version FROM members WHERE id = p_id;

    IF v_current_version IS NULL THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Member with id % does not exist.', p_id;
    END IF;

    IF v_current_version <> p_expected_version THEN
        RAISE EXCEPTION 'CONFLICT_DETECTED: Stale update rejected. Record has been updated by another device (version % vs expected %).',
            v_current_version, p_expected_version;
    END IF;

    UPDATE members
    SET
        full_name = p_full_name,
        encrypted_phone = p_encrypted_phone,
        phone_hint = p_phone_hint,
        department = p_department,
        status = p_status
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'id', p_id, 'new_version', v_current_version + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: close_period (Runs pre-check validation; blocks if out-of-balance)
CREATE OR REPLACE FUNCTION close_period_with_doctor_check(
    p_period_id UUID,
    p_closed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_period periods%ROWTYPE;
    v_total_dr BIGINT;
    v_total_cr BIGINT;
    v_difference BIGINT;
BEGIN
    -- Authorization: Treasurer only
    SELECT role INTO v_user_role FROM users_profile WHERE id = p_closed_by;
    IF v_user_role <> 'Treasurer' THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Only the Treasurer is authorized to close accounting periods.';
    END IF;

    SELECT * INTO v_period FROM periods WHERE id = p_period_id;
    IF v_period.id IS NULL THEN
        RAISE EXCEPTION 'RECORD_NOT_FOUND: Period % does not exist.', p_period_id;
    END IF;

    IF v_period.is_closed THEN
        RAISE EXCEPTION 'ALREADY_CLOSED: Period is already closed.';
    END IF;

    -- Trial Balance Doctor Pre-Check: Period cannot close if books do not balance
    SELECT
        COALESCE(SUM(jl.debit_amount_ghs), 0),
        COALESCE(SUM(jl.credit_amount_ghs), 0)
    INTO v_total_dr, v_total_cr
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    WHERE je.branch_id = v_period.branch_id
      AND je.entry_date BETWEEN v_period.start_date AND v_period.end_date;

    v_difference := v_total_dr - v_total_cr;
    IF v_difference <> 0 THEN
        RAISE EXCEPTION 'DOCTOR_CHECK_FAILED: Cannot close period %-%. Trial balance has an imbalance of % pesewas (Dr: %, Cr: %). Run Trial Balance Doctor first.',
            v_period.year, v_period.month, v_difference, v_total_dr, v_total_cr;
    END IF;

    -- Mark closed
    UPDATE periods
    SET is_closed = true, closed_at = NOW(), closed_by = p_closed_by
    WHERE id = p_period_id;

    -- Audit log
    INSERT INTO audit_log (branch_id, entity_type, entity_id, action, performed_by, device_id, reason)
    VALUES (v_period.branch_id, 'periods', p_period_id, 'PERIOD_CLOSE', p_closed_by, 'SERVER', 'Monthly financial period close');

    RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'status', 'CLOSED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- >>> END FILE: packages\db\supabase\migrations\20261101000004_rpc_posting_functions.sql <<<

-- >>> BEGIN FILE: packages\db\supabase\migrations\20261105000000_golive_yearend_security.sql <<<
-- ============================================================================
-- Migration: 20261105000000_golive_yearend_security.sql
-- Purpose: Section 3 Data Model Additions for Go-Live, Year-End Close & Security
-- ============================================================================

-- 1. FINANCIAL YEARS
CREATE TABLE IF NOT EXISTS financial_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  label TEXT NOT NULL, -- e.g. 'FY2026'
  start_month SMALLINT NOT NULL DEFAULT 1 CHECK (start_month BETWEEN 1 AND 12),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  has_adjustment_period BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSING_IN_PROGRESS', 'LOCKED', 'REOPENED_ADJUSTMENT_ONLY')),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users_profile(id),
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES users_profile(id),
  reopen_approved_by UUID REFERENCES users_profile(id),
  reopen_reason TEXT,
  created_by UUID REFERENCES users_profile(id),
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, label)
);

-- 2. EXTEND PERIODS (Support Period 13 Adjustment Period & Soft-Closed State)
ALTER TABLE periods DROP CONSTRAINT IF EXISTS periods_month_check;
ALTER TABLE periods ADD CONSTRAINT periods_month_check CHECK (month BETWEEN 1 AND 13);
ALTER TABLE periods ADD COLUMN IF NOT EXISTS financial_year_id UUID REFERENCES financial_years(id);
ALTER TABLE periods ADD COLUMN IF NOT EXISTS is_adjustment_period BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE periods ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SOFT_CLOSED', 'CLOSED'));
ALTER TABLE periods ADD COLUMN IF NOT EXISTS soft_closed_at TIMESTAMPTZ;
ALTER TABLE periods ADD COLUMN IF NOT EXISTS soft_closed_by UUID REFERENCES users_profile(id);
ALTER TABLE periods ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users_profile(id);
ALTER TABLE periods ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 3. EXTEND JOURNAL ENTRIES (Support Year-End Closing, Accruals, and Import Batches)
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check CHECK (
  entry_type IN (
    'STANDARD',
    'COUNTING_SHEET',
    'VOUCHER',
    'REVALUATION',
    'REVERSAL',
    'OPENING_BALANCE',
    'YEAR_END_CLOSING',
    'ACCRUAL_PREPAYMENT',
    'IMPORTED'
  )
);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS financial_year_id UUID REFERENCES financial_years(id);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_adjustment_period_entry BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS auto_reverse_on_date DATE;

-- 4. YEAR-END RUNS, CHECKS, OVERRIDES & ISSUED REPORTS
CREATE TABLE IF NOT EXISTS year_end_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  run_number TEXT NOT NULL, -- e.g. 'YEC-0001'
  status TEXT NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW', 'SUBMITTED', 'APPROVED', 'LOCKED', 'REOPENED')),
  total_income_ghs BIGINT NOT NULL DEFAULT 0,
  total_expenditure_ghs BIGINT NOT NULL DEFAULT 0,
  net_surplus_ghs BIGINT NOT NULL DEFAULT 0,
  net_assets_ghs BIGINT NOT NULL DEFAULT 0,
  prepared_by UUID REFERENCES users_profile(id),
  prepared_at TIMESTAMPTZ,
  approved_by_pastor_elder UUID REFERENCES users_profile(id),
  approved_at TIMESTAMPTZ,
  auditor_signed_by UUID REFERENCES users_profile(id),
  auditor_signed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS year_end_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  year_end_run_id UUID NOT NULL REFERENCES year_end_runs(id),
  check_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('BLOCKING', 'ADVISORY')),
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASSED', 'FAILED', 'OVERRIDDEN', 'WARNING')),
  details TEXT,
  target_route TEXT,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS year_end_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  year_end_run_id UUID REFERENCES year_end_runs(id),
  check_key TEXT NOT NULL,
  check_label TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issued_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  financial_year_id UUID REFERENCES financial_years(id),
  year_end_run_id UUID REFERENCES year_end_runs(id),
  report_code TEXT NOT NULL,
  report_title TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_sha256 TEXT NOT NULL,
  overrides_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. IMPORT BATCHES, ROWS & ERRORS (B2, B3)
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  batch_number TEXT NOT NULL, -- e.g. 'IMP-0001'
  template_type TEXT NOT NULL CHECK (
    template_type IN (
      'MEMBERS',
      'OPENING_BALANCES',
      'FIXED_ASSETS',
      'PLEDGES',
      'PRIOR_GIVING_HISTORY',
      'HISTORICAL_TRANSACTIONS'
    )
  ),
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK (status IN ('VALIDATED', 'COMMITTED', 'REVERSED')),
  cut_over_date DATE,
  approved_by UUID REFERENCES users_profile(id),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users_profile(id),
  reversal_reason TEXT,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, batch_number),
  UNIQUE (branch_id, file_sha256)
);

CREATE TABLE IF NOT EXISTS import_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  masked_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_entity_type TEXT,
  created_entity_id UUID,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  import_batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('ERROR', 'WARNING')),
  field_name TEXT,
  message TEXT NOT NULL, -- Masked PII only
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PARALLEL RUN ENTRIES (B4)
CREATE TABLE IF NOT EXISTS parallel_run_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  period_id UUID NOT NULL REFERENCES periods(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  fund_id UUID NOT NULL REFERENCES funds(id),
  old_book_balance_pesewas BIGINT NOT NULL DEFAULT 0,
  system_balance_pesewas BIGINT NOT NULL DEFAULT 0,
  variance_pesewas BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UNEXPLAINED' CHECK (status IN ('AGREES', 'EXPLAINED', 'UNEXPLAINED')),
  explanation TEXT,
  approved_by_treasurer UUID REFERENCES users_profile(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, period_id, account_id, fund_id)
);

-- 7. GO-LIVE READINESS ITEMS & EVENT (B5)
CREATE TABLE IF NOT EXISTS go_live_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PASSED', 'PENDING', 'FAILED')),
  target_route TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, item_key)
);

CREATE TABLE IF NOT EXISTS go_live_event (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) UNIQUE,
  cut_over_date DATE NOT NULL,
  confirmed_by_treasurer UUID NOT NULL REFERENCES users_profile(id),
  confirmed_by_pastor_elder UUID NOT NULL REFERENCES users_profile(id),
  setup_window_closed BOOLEAN NOT NULL DEFAULT true,
  demo_mode_locked BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. SECURITY: MFA FACTORS, RECOVERY CODES, LOGIN ATTEMPTS & DEVICE ENROLMENTS (C1, C2)
CREATE TABLE IF NOT EXISTS mfa_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  user_id UUID NOT NULL REFERENCES users_profile(id),
  factor_type TEXT NOT NULL CHECK (factor_type IN ('TOTP', 'PASSKEY')),
  secret_encrypted TEXT,
  credential_id TEXT,
  status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('PENDING', 'VERIFIED', 'RESET_PENDING', 'REVOKED')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_requested_by UUID REFERENCES users_profile(id),
  reset_approved_by UUID REFERENCES users_profile(id),
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  user_id UUID NOT NULL REFERENCES users_profile(id),
  code_sha256 TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES users_profile(id),
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('ONLINE_PASSWORD', 'TOTP', 'OFFLINE_PIN', 'RECOVERY_CODE')),
  succeeded BOOLEAN NOT NULL,
  consecutive_failures INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  unlocked_by UUID REFERENCES users_profile(id),
  ip_label TEXT,
  created_by UUID REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_enrolments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users_profile(id),
  app_version TEXT NOT NULL DEFAULT '2.0.0',
  schema_version INT NOT NULL DEFAULT 2,
  approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REVOKED')),
  approved_by UUID REFERENCES users_profile(id),
  approved_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users_profile(id),
  revoked_at TIMESTAMPTZ,
  wipe_on_next_sync BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. APPROVAL LIMITS MATRIX, REQUESTS & STEPS (C3)
CREATE TABLE IF NOT EXISTS approval_rule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  version_number INT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  proposed_by UUID NOT NULL REFERENCES users_profile(id),
  approved_by UUID REFERENCES users_profile(id),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, version_number)
);

CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  version_id UUID NOT NULL REFERENCES approval_rule_versions(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'REQUISITION',
      'VOUCHER_PAYMENT',
      'PAYROLL_RUN',
      'TITHE_REMITTANCE',
      'ASSET_DISPOSAL',
      'MANUAL_JOURNAL',
      'CASH_OR_FUND_OVERRIDE',
      'PERIOD_REOPENING',
      'BACKUP_RESTORE'
    )
  ),
  band_label TEXT NOT NULL,
  min_amount_pesewas BIGINT NOT NULL DEFAULT 0,
  max_amount_pesewas BIGINT, -- NULL means unlimited above min_amount_pesewas
  required_approvals_count SMALLINT NOT NULL DEFAULT 1 CHECK (required_approvals_count >= 1),
  required_roles TEXT[] NOT NULL DEFAULT ARRAY['Treasurer'],
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  transaction_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  amount_ghs_equivalent_pesewas BIGINT NOT NULL DEFAULT 0,
  required_approvals_count SMALLINT NOT NULL DEFAULT 1,
  required_roles TEXT[] NOT NULL DEFAULT ARRAY['Treasurer'],
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'VOIDED_BY_EDIT')),
  requested_by UUID NOT NULL REFERENCES users_profile(id),
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_number SMALLINT NOT NULL,
  approver_id UUID NOT NULL REFERENCES users_profile(id),
  approver_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  comments TEXT,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (approval_request_id, approver_id) -- Prevents one user counting as two approvals
);

-- 10. SEPARATION OF DUTIES & CONTROLLED PAYMENT DETAILS (C4)
CREATE TABLE IF NOT EXISTS sod_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  rule_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  is_blocking BOOLEAN NOT NULL DEFAULT true,
  allow_treasurer_override BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sod_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  rule_code TEXT NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('TREASURER_OVERRIDE', 'BLOCKED_NEAR_MISS')),
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users_profile(id),
  overridden_by_treasurer UUID REFERENCES users_profile(id),
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlled_detail_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('VENDOR', 'STAFF', 'MEMBER')),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  field_name TEXT NOT NULL CHECK (field_name IN ('BANK_ACCOUNT', 'MOMO_NUMBER')),
  old_value_masked TEXT,
  new_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  changed_by UUID NOT NULL REFERENCES users_profile(id),
  approved_by UUID REFERENCES users_profile(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> changed_by)
);

-- 11. SECURITY EVENTS, NOTIFICATIONS, MEMBER DATA REQUESTS & CLIENT VERSIONS (C5, C6, D)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  event_category TEXT NOT NULL CHECK (
    event_category IN (
      'FAILED_LOGIN',
      'ACCOUNT_LOCKOUT',
      'DEVICE_ENROLMENT',
      'ROLE_CHANGE',
      'MFA_RESET',
      'APPROVAL_LIMIT_CHANGE',
      'PERIOD_OR_YEAR_REOPEN',
      'BACKUP_OR_RESTORE',
      'GIVING_EXPORT_OR_STATEMENTS',
      'SOD_OR_CHECKLIST_OVERRIDE',
      'LARGE_MANUAL_JOURNAL',
      'OFF_HOURS_POSTING',
      'REPEATED_REVERSALS'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  summary TEXT NOT NULL,
  actor_user_id UUID REFERENCES users_profile(id),
  ip_location_label TEXT,
  created_by UUID REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  recipient_role TEXT NOT NULL,
  security_event_id UUID REFERENCES security_events(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_data_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  member_id UUID NOT NULL REFERENCES members(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('EXPORT_DATA', 'ANONYMISE_FORMER_MEMBER')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED')),
  approved_by UUID REFERENCES users_profile(id),
  created_by UUID NOT NULL REFERENCES users_profile(id),
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  min_supported_app_version TEXT NOT NULL DEFAULT '2.0.0',
  latest_app_version TEXT NOT NULL DEFAULT '2.1.0',
  min_supported_schema_version INT NOT NULL DEFAULT 2,
  current_schema_version INT NOT NULL DEFAULT 2,
  release_notes TEXT NOT NULL DEFAULT 'Added Financial Year Close, Opening Balances Cut-Over, and Two-Step Security Controls.',
  created_by UUID REFERENCES users_profile(id),
  device_id TEXT NOT NULL DEFAULT 'SERVER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATABASE ENFORCEMENT TRIGGERS (Section 3)
-- ============================================================================

-- Rule 1: Entries cannot be posted into a LOCKED financial year or CLOSED period,
-- and SOFT_CLOSED periods only allow Treasurer postings.
CREATE OR REPLACE FUNCTION enforce_financial_year_and_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_fy_status TEXT;
  v_period_status TEXT;
  v_is_adj BOOLEAN;
  v_user_role TEXT;
BEGIN
  IF NEW.financial_year_id IS NOT NULL THEN
    SELECT status INTO v_fy_status FROM financial_years WHERE id = NEW.financial_year_id;
    IF v_fy_status = 'LOCKED' THEN
      RAISE EXCEPTION 'Cannot post journal entry % into locked financial year.', NEW.document_number;
    END IF;
    IF v_fy_status = 'REOPENED_ADJUSTMENT_ONLY' AND NOT COALESCE(NEW.is_adjustment_period_entry, false) THEN
      RAISE EXCEPTION 'Reopened financial year only permits postings into Period 13 (Adjustment period).';
    END IF;
  END IF;

  IF NEW.period_id IS NOT NULL THEN
    SELECT status, is_adjustment_period INTO v_period_status, v_is_adj FROM periods WHERE id = NEW.period_id;
    IF v_period_status = 'CLOSED' THEN
      RAISE EXCEPTION 'Cannot post journal entry % into closed period.', NEW.document_number;
    END IF;
    IF v_period_status = 'SOFT_CLOSED' THEN
      SELECT role INTO v_user_role FROM users_profile WHERE id = NEW.created_by;
      IF v_user_role IS DISTINCT FROM 'Treasurer' THEN
        RAISE EXCEPTION 'Period is soft-closed; only the Treasurer can post entries.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_fy_and_period_lock ON journal_entries;
CREATE TRIGGER trg_enforce_fy_and_period_lock
  BEFORE INSERT ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_financial_year_and_period_lock();

-- Rule 2: Approval step cannot be completed by the requester (no self-approval)
CREATE OR REPLACE FUNCTION enforce_no_self_approval_step()
RETURNS TRIGGER AS $$
DECLARE
  v_requester UUID;
BEGIN
  SELECT requested_by INTO v_requester FROM approval_requests WHERE id = NEW.approval_request_id;
  IF v_requester = NEW.approver_id THEN
    RAISE EXCEPTION 'Self-approval violation: Requester cannot approve their own request.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_no_self_approval ON approval_steps;
CREATE TRIGGER trg_enforce_no_self_approval
  BEFORE INSERT ON approval_steps
  FOR EACH ROW
  EXECUTE FUNCTION enforce_no_self_approval_step();

-- >>> END FILE: packages\db\supabase\migrations\20261105000000_golive_yearend_security.sql <<<

-- ============================================================================
-- SUPABASE AUTH SYNCHRONIZATION TRIGGER
-- Automatically creates a user_profile record when an officer signs up / is invited
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, email, full_name, role, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Counter'),
    '00000000-0000-0000-0000-000000000001'::UUID
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SUPABASE STORAGE BUCKET: church-attachments
-- Run to create and permit authenticated uploads for receipts and vouchers
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('church-attachments', 'church-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to upload and view receipts
DROP POLICY IF EXISTS "Public Read church-attachments" ON storage.objects;
CREATE POLICY "Public Read church-attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'church-attachments');

DROP POLICY IF EXISTS "Authenticated Upload church-attachments" ON storage.objects;
CREATE POLICY "Authenticated Upload church-attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'church-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated Update church-attachments" ON storage.objects;
CREATE POLICY "Authenticated Update church-attachments" ON storage.objects
  FOR UPDATE USING (bucket_id = 'church-attachments' AND auth.role() = 'authenticated');