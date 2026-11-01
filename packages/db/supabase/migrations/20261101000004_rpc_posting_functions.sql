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
