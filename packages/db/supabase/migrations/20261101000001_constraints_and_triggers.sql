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
