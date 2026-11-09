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
