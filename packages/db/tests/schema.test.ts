import { describe, it, expect } from 'vitest';
import { AppSchema } from '../src/schema.js';

describe('PowerSync Client Schema', () => {
  it('contains all 51 required tables for the church accounting system', () => {
    const tableNames = AppSchema.tables.map((t) => t.name);

    const requiredTables = [
      'branches',
      'roles',
      'users_profile',
      'devices',
      'funds',
      'accounts',
      'periods',
      'exchange_rates',
      'journal_entries',
      'journal_lines',
      'members',
      'pledges',
      'counting_sheets',
      'counting_sheet_lines',
      'requisitions',
      'requisition_approvals',
      'vendors',
      'vouchers',
      'budgets',
      'budget_lines',
      'assets',
      'staff',
      'payroll_runs',
      'attachments',
      'audit_log',
      'sync_rejections',
      'integrity_runs',
      'integrity_findings',
      'cash_accounts',
      'cashbook_entries',
      'cheques',
      'cash_counts',
      'cash_count_lines',
      'cash_count_signoffs',
      'bank_statement_lines',
      'bank_reconciliations',
      'bank_reconciliation_items',
      'bank_reconciliation_signoffs',
      'tithe_batches',
      'tithe_records',
      'tithe_remittance_rules',
      'tithe_remittances',
      'asset_categories',
      'fixed_assets',
      'asset_events',
      'asset_attachments',
      'depreciation_runs',
      'depreciation_lines',
      'asset_verifications',
      'asset_verification_lines',
      'asset_policy_settings',
      'financial_years',
      'year_end_runs',
      'year_end_checks',
      'year_end_overrides',
      'issued_reports',
      'import_batches',
      'import_rows',
      'import_errors',
      'parallel_run_entries',
      'go_live_items',
      'go_live_event',
      'mfa_factors',
      'recovery_codes',
      'login_attempts',
      'device_enrolments',
      'approval_rule_versions',
      'approval_rules',
      'approval_requests',
      'approval_steps',
      'sod_rules',
      'sod_exceptions',
      'controlled_detail_changes',
      'security_events',
      'notifications',
      'member_data_requests',
      'client_versions',
    ];

    for (const required of requiredTables) {
      expect(tableNames).toContain(required);
    }
  });

  it('defines journal_entries and journal_lines with correct integer money columns', () => {
    const je = AppSchema.tables.find((t) => t.name === 'journal_entries');
    const jl = AppSchema.tables.find((t) => t.name === 'journal_lines');

    expect(je).toBeDefined();
    expect(jl).toBeDefined();

    // Verify key columns exist
    const jeColumns = je?.columns.map((c) => c.name);
    expect(jeColumns).toContain('document_number');
    expect(jeColumns).toContain('total_debit_ghs');
    expect(jeColumns).toContain('total_credit_ghs');
    expect(jeColumns).toContain('line_count');

    const jlColumns = jl?.columns.map((c) => c.name);
    expect(jlColumns).toContain('journal_entry_id');
    expect(jlColumns).toContain('fund_id');
    expect(jlColumns).toContain('account_id');
    expect(jlColumns).toContain('debit_amount_ghs');
    expect(jlColumns).toContain('credit_amount_ghs');
    expect(jlColumns).toContain('original_currency');
  });
});
