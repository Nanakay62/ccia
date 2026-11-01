/**
 * SQL queries for the Trial Balance Doctor.
 * Compatible with SQLite (PowerSync client local database) and Supabase Postgres.
 */

export const DOCTOR_SQL_QUERIES = {
  /**
   * Check 1: Summary by Fund
   */
  summaryByFund: `
    SELECT
      f.id AS fund_id,
      f.name AS fund_name,
      f.type AS fund_type,
      COALESCE(SUM(jl.debit_amount_ghs), 0) AS total_debit_ghs,
      COALESCE(SUM(jl.credit_amount_ghs), 0) AS total_credit_ghs,
      COALESCE(SUM(jl.debit_amount_ghs), 0) - COALESCE(SUM(jl.credit_amount_ghs), 0) AS difference_ghs
    FROM funds f
    LEFT JOIN journal_lines jl ON jl.fund_id = f.id
    GROUP BY f.id, f.name, f.type
    ORDER BY f.code ASC;
  `,

  /**
   * Check 1b: Summary by Account
   */
  summaryByAccount: `
    SELECT
      a.id AS account_id,
      a.code AS account_code,
      a.name AS account_name,
      a.type AS account_type,
      COALESCE(SUM(jl.debit_amount_ghs), 0) AS total_debit_ghs,
      COALESCE(SUM(jl.credit_amount_ghs), 0) AS total_credit_ghs,
      COALESCE(SUM(jl.debit_amount_ghs), 0) - COALESCE(SUM(jl.credit_amount_ghs), 0) AS difference_ghs
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code ASC;
  `,

  /**
   * Check 2: Unbalanced Journal Entries
   */
  unbalancedEntries: `
    SELECT
      je.id,
      je.document_number,
      je.entry_date,
      je.narration,
      je.line_count,
      je.total_debit_ghs AS header_debit,
      je.total_credit_ghs AS header_credit,
      COALESCE(SUM(jl.debit_amount_ghs), 0) AS lines_debit,
      COALESCE(SUM(jl.credit_amount_ghs), 0) AS lines_credit,
      COALESCE(SUM(jl.debit_amount_ghs), 0) - COALESCE(SUM(jl.credit_amount_ghs), 0) AS line_difference
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id, je.document_number, je.entry_date, je.narration, je.line_count, je.total_debit_ghs, je.total_credit_ghs
    HAVING COALESCE(SUM(jl.debit_amount_ghs), 0) <> COALESCE(SUM(jl.credit_amount_ghs), 0);
  `,

  /**
   * Check 3a: Orphaned Lines (lines without header)
   */
  orphanedLines: `
    SELECT jl.*
    FROM journal_lines jl
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.id IS NULL;
  `,

  /**
   * Check 3b: Empty Headers (headers without lines)
   */
  emptyHeaders: `
    SELECT je.*
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    WHERE jl.id IS NULL;
  `,

  /**
   * Check 3c: Structural Line Anomalies
   */
  structuralLineAnomalies: `
    SELECT
      jl.id AS line_id,
      jl.journal_entry_id,
      je.document_number,
      jl.original_amount,
      jl.debit_amount_ghs,
      jl.credit_amount_ghs,
      CASE
        WHEN jl.original_amount <= 0 THEN 'Non-positive amount'
        WHEN jl.debit_amount_ghs > 0 AND jl.credit_amount_ghs > 0 THEN 'Simultaneous Dr and Cr'
        WHEN jl.debit_amount_ghs = 0 AND jl.credit_amount_ghs = 0 THEN 'Zero Dr and Cr'
        WHEN a.id IS NULL THEN 'Missing account reference'
        WHEN a.is_active = 0 THEN 'Inactive account reference'
        WHEN f.id IS NULL THEN 'Missing fund reference'
        WHEN f.is_active = 0 THEN 'Inactive fund reference'
        ELSE 'Unknown anomaly'
      END AS anomaly_type
    FROM journal_lines jl
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    LEFT JOIN accounts a ON a.id = jl.account_id
    LEFT JOIN funds f ON f.id = jl.fund_id
    WHERE
      jl.original_amount <= 0
      OR (jl.debit_amount_ghs > 0 AND jl.credit_amount_ghs > 0)
      OR (jl.debit_amount_ghs = 0 AND jl.credit_amount_ghs = 0)
      OR a.id IS NULL
      OR a.is_active = 0
      OR f.id IS NULL
      OR f.is_active = 0;
  `,

  /**
   * Check 4: Sync Gaps (line_count mismatch)
   */
  syncGaps: `
    SELECT
      je.id,
      je.document_number,
      je.line_count AS expected_line_count,
      COUNT(jl.id) AS actual_synced_line_count
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.id, je.document_number, je.line_count
    HAVING COUNT(jl.id) <> je.line_count;
  `,

  /**
   * Check 8: Time Bisect (daily cumulative debits and credits)
   */
  timeBisectDaily: `
    SELECT
      je.entry_date,
      SUM(jl.debit_amount_ghs) AS daily_debit_ghs,
      SUM(jl.credit_amount_ghs) AS daily_credit_ghs,
      SUM(jl.debit_amount_ghs) - SUM(jl.credit_amount_ghs) AS daily_difference_ghs
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    GROUP BY je.entry_date
    ORDER BY je.entry_date ASC;
  `,

  /**
   * Check 10: Opening Balance Validation
   */
  openingBalances: `
    SELECT
      je.id,
      je.document_number,
      je.entry_date,
      SUM(jl.debit_amount_ghs) AS total_debit_ghs,
      SUM(jl.credit_amount_ghs) AS total_credit_ghs,
      SUM(jl.debit_amount_ghs) - SUM(jl.credit_amount_ghs) AS difference_ghs
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    WHERE je.entry_type = 'OPENING_BALANCE'
    GROUP BY je.id, je.document_number, je.entry_date
    HAVING SUM(jl.debit_amount_ghs) <> SUM(jl.credit_amount_ghs);
  `,
};
