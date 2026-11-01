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
CREATE POLICY "Read reference data" ON funds
    FOR SELECT USING ((get_current_user_profile()).is_active);

CREATE POLICY "Read accounts" ON accounts
    FOR SELECT USING ((get_current_user_profile()).is_active);

CREATE POLICY "Read periods" ON periods
    FOR SELECT USING ((get_current_user_profile()).is_active);

CREATE POLICY "Read exchange_rates" ON exchange_rates
    FOR SELECT USING ((get_current_user_profile()).is_active);

CREATE POLICY "Read branches" ON branches
    FOR SELECT USING (true);

CREATE POLICY "Read roles" ON roles
    FOR SELECT USING (true);

-- Treasurer can manage reference data
CREATE POLICY "Treasurer manage funds" ON funds
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

CREATE POLICY "Treasurer manage accounts" ON accounts
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

CREATE POLICY "Treasurer manage periods" ON periods
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

CREATE POLICY "Treasurer manage rates" ON exchange_rates
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

-- 2. Journal Entries and Lines
-- Read: Treasurer, Finance Secretary, Pastor / Elder, Auditor
CREATE POLICY "Read journal entries" ON journal_entries
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

CREATE POLICY "Read journal lines" ON journal_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

-- Insert: Treasurer, Finance Secretary
CREATE POLICY "Insert journal entries" ON journal_entries
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

CREATE POLICY "Insert journal lines" ON journal_lines
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- 3. Member Directory & Privacy (Section 5: individual giving visible ONLY to Treasurer, Finance Secretary, Pastor/Elder, Auditor)
CREATE POLICY "View member directory" ON members
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor', 'Counter')
    );

CREATE POLICY "Manage members" ON members
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- Pledges: visible only to leadership roles
CREATE POLICY "View pledges" ON pledges
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

CREATE POLICY "Manage pledges" ON pledges
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary')
    );

-- 4. Weekly Counting Sheets
-- Counters, Treasurer, Finance Secretary can create/view counting sheets
CREATE POLICY "View counting sheets" ON counting_sheets
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

CREATE POLICY "Manage counting sheets" ON counting_sheets
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary')
    );

CREATE POLICY "View counting sheet lines" ON counting_sheet_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor')
    );

CREATE POLICY "Insert counting sheet lines" ON counting_sheet_lines
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Counter', 'Treasurer', 'Finance Secretary')
    );

-- 5. Requisitions and Approvals
-- Department Head can view and submit only their department's requisitions
CREATE POLICY "Department head view requisitions" ON requisitions
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor') OR
        ((get_current_user_profile()).role = 'Department Head' AND department_id = (get_current_user_profile()).department_id)
    );

CREATE POLICY "Submit requisitions" ON requisitions
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Department Head')
    );

-- Pastor / Elder approves requisitions
CREATE POLICY "Pastor approve requisitions" ON requisition_approvals
    FOR INSERT WITH CHECK (
        (get_current_user_profile()).role IN ('Pastor / Elder', 'Treasurer')
    );

CREATE POLICY "View approvals" ON requisition_approvals
    FOR SELECT USING (true);

-- 6. Budgets
CREATE POLICY "View budgets" ON budgets
    FOR SELECT USING (true);

CREATE POLICY "Department head view budget lines" ON budget_lines
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Finance Secretary', 'Pastor / Elder', 'Auditor') OR
        ((get_current_user_profile()).role = 'Department Head' AND department_id = (get_current_user_profile()).department_id)
    );

CREATE POLICY "Treasurer manage budgets" ON budgets
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

CREATE POLICY "Treasurer manage budget lines" ON budget_lines
    FOR ALL USING ((get_current_user_profile()).role = 'Treasurer');

-- 7. Audit Log: Visible only to Auditor and Treasurer. Strictly no update/delete.
CREATE POLICY "Auditor and Treasurer view audit log" ON audit_log
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Auditor', 'Treasurer')
    );

CREATE POLICY "System insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);

-- 8. Sync Rejections: Visible and managed by Treasurer
CREATE POLICY "Treasurer manage sync rejections" ON sync_rejections
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

-- 9. Trial Balance Doctor (Integrity Runs & Findings)
CREATE POLICY "View integrity runs" ON integrity_runs
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Auditor')
    );

CREATE POLICY "Treasurer manage integrity runs" ON integrity_runs
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

CREATE POLICY "View integrity findings" ON integrity_findings
    FOR SELECT USING (
        (get_current_user_profile()).role IN ('Treasurer', 'Auditor')
    );

CREATE POLICY "Treasurer manage integrity findings" ON integrity_findings
    FOR ALL USING (
        (get_current_user_profile()).role = 'Treasurer'
    );

-- 10. Admin: User and Device management
CREATE POLICY "Admin manage users" ON users_profile
    FOR ALL USING (
        (get_current_user_profile()).role = 'Admin' OR (get_current_user_profile()).role = 'Treasurer'
    );

CREATE POLICY "View user profiles" ON users_profile
    FOR SELECT USING (true);

CREATE POLICY "Admin manage devices" ON devices
    FOR ALL USING (
        (get_current_user_profile()).role IN ('Admin', 'Treasurer')
    );
