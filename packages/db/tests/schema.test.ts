import { describe, it, expect } from 'vitest';
import { AppSchema } from '../src/schema.js';

describe('PowerSync Client Schema', () => {
  it('contains all 28 required tables for the church accounting system', () => {
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
