export type Role =
  | 'Treasurer'
  | 'Finance Secretary'
  | 'Counter'
  | 'Pastor / Elder'
  | 'Auditor'
  | 'Department Head'
  | 'Admin';

export const ALL_ROLES: readonly Role[] = [
  'Treasurer',
  'Finance Secretary',
  'Counter',
  'Pastor / Elder',
  'Auditor',
  'Department Head',
  'Admin',
] as const;

export type Permission =
  // Ledger & Period Locking
  | 'ledger:post_entry'
  | 'ledger:reverse_entry'
  | 'ledger:close_period'
  | 'ledger:reopen_period'
  | 'ledger:override_overdraft'
  | 'ledger:manage_chart_of_accounts'
  | 'ledger:set_exchange_rate'
  | 'ledger:run_revaluation'
  | 'ledger:run_trial_balance_doctor'
  | 'ledger:act_on_trial_balance_doctor'

  // Income & Counting Sheets
  | 'income:enter_giving'
  | 'income:create_counting_sheet'
  | 'income:sign_counting_sheet'
  | 'income:issue_receipt'

  // Member & Giving Privacy
  | 'members:view_directory'
  | 'members:manage_directory'
  | 'members:view_individual_giving'
  | 'members:issue_giving_statement'

  // Expenses & Requisitions
  | 'expenses:submit_requisition'
  | 'expenses:approve_requisition'
  | 'expenses:prepare_voucher'
  | 'expenses:disburse_payment'
  | 'expenses:manage_vendors'
  | 'expenses:manage_assets'
  | 'expenses:manage_petty_cash'

  // Budgets & Payroll
  | 'budget:manage'
  | 'budget:view_all'
  | 'budget:view_own_department'
  | 'payroll:view'
  | 'payroll:process'
  | 'payroll:approve'

  // Cashbook
  | 'cashbook:view'
  | 'cashbook:enter'
  | 'cashbook:override_overdraft'
  | 'cashbook:reconcile'
  | 'cashbook:signoff_reconciliation'
  | 'cashbook:cash_count'

  // Tithes
  | 'tithes:view_summary'
  | 'tithes:view_individual'
  | 'tithes:record_batch'
  | 'tithes:post_batch'
  | 'tithes:manage_remittance'

  // Fixed Assets
  | 'assets:view_register'
  | 'assets:manage'
  | 'assets:approve_depreciation'
  | 'assets:approve_disposal'
  | 'assets:verify'

  // Reports
  | 'reports:view_financial'
  | 'reports:view_usd_summary'
  | 'reports:export'

  // System & Audit
  | 'audit:view_log'
  | 'admin:manage_users'
  | 'admin:manage_roles'
  | 'admin:manage_devices';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  Treasurer: [
    'ledger:post_entry',
    'ledger:reverse_entry',
    'ledger:close_period',
    'ledger:reopen_period',
    'ledger:override_overdraft',
    'ledger:manage_chart_of_accounts',
    'ledger:set_exchange_rate',
    'ledger:run_revaluation',
    'ledger:run_trial_balance_doctor',
    'ledger:act_on_trial_balance_doctor',

    'income:enter_giving',
    'income:issue_receipt',

    'members:view_directory',
    'members:manage_directory',
    'members:view_individual_giving',
    'members:issue_giving_statement',

    'expenses:submit_requisition',
    'expenses:prepare_voucher',
    'expenses:disburse_payment',
    'expenses:manage_vendors',
    'expenses:manage_assets',
    'expenses:manage_petty_cash',

    'budget:manage',
    'budget:view_all',
    'budget:view_own_department',
    'payroll:view',
    'payroll:process',
    'payroll:approve',

    'cashbook:view',
    'cashbook:enter',
    'cashbook:override_overdraft',
    'cashbook:reconcile',
    'cashbook:signoff_reconciliation',
    'cashbook:cash_count',

    'tithes:view_summary',
    'tithes:view_individual',
    'tithes:record_batch',
    'tithes:post_batch',
    'tithes:manage_remittance',

    'assets:view_register',
    'assets:manage',
    'assets:approve_depreciation',
    'assets:approve_disposal',
    'assets:verify',

    'reports:view_financial',
    'reports:view_usd_summary',
    'reports:export',

    'audit:view_log',
  ],

  'Finance Secretary': [
    'ledger:post_entry',
    'income:enter_giving',
    'income:issue_receipt',

    'members:view_directory',
    'members:manage_directory',
    'members:view_individual_giving',
    'members:issue_giving_statement',

    'expenses:submit_requisition',
    'expenses:prepare_voucher',
    'expenses:disburse_payment',
    'expenses:manage_vendors',
    'expenses:manage_assets',
    'expenses:manage_petty_cash',

    'budget:view_all',
    'budget:view_own_department',
    'payroll:view',
    'payroll:process',

    'cashbook:view',
    'cashbook:enter',
    'cashbook:reconcile',
    'cashbook:cash_count',

    'tithes:view_summary',
    'tithes:view_individual',
    'tithes:record_batch',

    'assets:view_register',
    'assets:manage',
    'assets:verify',

    'reports:view_financial',
    'reports:view_usd_summary',
    'reports:export',
  ],

  Counter: [
    'income:create_counting_sheet',
    'income:sign_counting_sheet',
  ],

  'Pastor / Elder': [
    'expenses:approve_requisition',

    'members:view_directory',
    'members:view_individual_giving',

    'budget:view_all',
    'budget:view_own_department',
    'payroll:view',
    'payroll:approve',

    'cashbook:view',
    'tithes:view_summary',
    'assets:view_register',
    'assets:approve_disposal',

    'reports:view_financial',
    'reports:view_usd_summary',
    'reports:export',
  ],

  Auditor: [
    'ledger:run_trial_balance_doctor', // Read-only diagnostic

    'members:view_directory',
    'members:view_individual_giving',

    'budget:view_all',
    'budget:view_own_department',
    'payroll:view',

    'cashbook:view',
    'tithes:view_summary',
    'tithes:view_individual', // logged
    'assets:view_register',

    'reports:view_financial',
    'reports:view_usd_summary',
    'reports:export',

    'audit:view_log',
  ],

  'Department Head': [
    'expenses:submit_requisition',
    'budget:view_own_department',
    'assets:view_register',
  ],

  Admin: [
    'admin:manage_users',
    'admin:manage_roles',
    'admin:manage_devices',
  ],
};

/**
 * Checks whether a role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

/**
 * Returns all permissions granted to a given role.
 */
export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Privacy Rule: Individual member giving records are visible ONLY to
 * Treasurer, Finance Secretary, Pastor / Elder, and Auditor.
 * Everyone else (Counters, Department Heads, Admins) must see totals only.
 */
export function canViewIndividualGiving(role: Role): boolean {
  return (
    role === 'Treasurer' ||
    role === 'Finance Secretary' ||
    role === 'Pastor / Elder' ||
    role === 'Auditor'
  );
}

/**
 * Checks whether a user can access a department's budget or requisitions.
 * Department Heads can only access their own department.
 * Management roles can access all departments.
 */
export function canAccessDepartmentData(
  role: Role,
  userDepartmentId: string | null | undefined,
  targetDepartmentId: string
): boolean {
  if (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Pastor / Elder' || role === 'Auditor') {
    return true;
  }
  if (role === 'Department Head') {
    return Boolean(userDepartmentId && userDepartmentId === targetDepartmentId);
  }
  return false;
}

/**
 * Validates counting sheet sign-off rule:
 * Must have signatures from TWO DIFFERENT users who both hold the 'Counter' role
 * (or Treasurer / Finance Secretary acting as counter).
 */
import { validateTwoCounterSignOff } from '../giving/counting.js';

export function validateCountingSheetSignOff(
  firstCounterUserId: string,
  secondCounterUserId: string
): { isValid: boolean; error?: string } {
  const res = validateTwoCounterSignOff(firstCounterUserId, secondCounterUserId);
  return { isValid: res.valid, error: res.error };
}

/**
 * Section 0 & Section 2.6: Determines whether a role is authorized to view or sync
 * individual member tithe records.
 * Default: Treasurer, Finance Secretary, Auditor (read-only), and Pastor / Elder (only if granted in settings).
 * Counter, Department Head, and Admin have zero access to individual tithe records.
 */
export function canViewIndividualTithes(
  role: Role,
  pastorGrantEnabled: boolean = true
): boolean {
  if (role === 'Treasurer' || role === 'Finance Secretary' || role === 'Auditor') {
    return true;
  }
  if (role === 'Pastor / Elder') {
    return pastorGrantEnabled;
  }
  return false;
}

/**
 * Row-Level Security (RLS) & Offline Sync Filter for Tithe Records (Section 0, 2.6 & 7):
 * Strips individual tithe records from sync payloads and local database queries
 * if the user's role is not permitted to see individual tithes (e.g. Department Head, Counter, Admin).
 */
export function filterTitheRecordsForSyncAndRLS<T>(
  records: readonly T[],
  role: Role,
  pastorGrantEnabled: boolean = true
): readonly T[] {
  if (!canViewIndividualTithes(role, pastorGrantEnabled)) {
    return [];
  }
  return records;
}

/**
 * Row-Level Security (RLS) & Department Filter for Fixed Assets (Section 0):
 * - Treasurer, Finance Secretary, Pastor / Elder, Auditor: View full register.
 * - Department Head: Views assets in their department only; can report faults and request transfers.
 * - Counter, Admin: No access to Fixed Assets register.
 */
export function filterFixedAssetsForRole<
  T extends { department?: string; custodian?: string }
>(
  assets: readonly T[],
  role: Role,
  userDepartment?: string
): readonly T[] {
  if (
    role === 'Treasurer' ||
    role === 'Finance Secretary' ||
    role === 'Pastor / Elder' ||
    role === 'Auditor'
  ) {
    return assets;
  }
  if (role === 'Department Head') {
    if (!userDepartment) return [];
    const target = userDepartment.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (a.department && a.department.toLowerCase().includes(target)) ||
        (a.custodian && a.custodian.toLowerCase().includes(target))
    );
  }
  return [];
}

/**
 * Returns the complete Section 0 Role Capability Matrix for Cashbook, Tithes, and Fixed Assets.
 */
export function getModuleAccessForRole(
  role: Role,
  pastorGrantEnabled: boolean = true
): {
  cashbook: 'FULL' | 'ENTER_AND_PREPARE' | 'SUMMARY_ONLY' | 'READ_ONLY' | 'NONE';
  tithes: 'FULL' | 'BATCH_AND_INDIVIDUAL' | 'TOTALS_ONLY' | 'READ_ONLY_LOGGED' | 'NONE';
  fixedAssets: 'FULL' | 'MANAGE_AND_PREPARE' | 'APPROVE_DISPOSALS_AND_VIEW' | 'READ_ONLY' | 'DEPARTMENT_ONLY' | 'NONE';
} {
  switch (role) {
    case 'Treasurer':
      return {
        cashbook: 'FULL',
        tithes: 'FULL',
        fixedAssets: 'FULL',
      };
    case 'Finance Secretary':
      return {
        cashbook: 'ENTER_AND_PREPARE',
        tithes: 'BATCH_AND_INDIVIDUAL',
        fixedAssets: 'MANAGE_AND_PREPARE',
      };
    case 'Pastor / Elder':
      return {
        cashbook: 'SUMMARY_ONLY',
        tithes: pastorGrantEnabled ? 'BATCH_AND_INDIVIDUAL' : 'TOTALS_ONLY',
        fixedAssets: 'APPROVE_DISPOSALS_AND_VIEW',
      };
    case 'Auditor':
      return {
        cashbook: 'READ_ONLY',
        tithes: 'READ_ONLY_LOGGED',
        fixedAssets: 'READ_ONLY',
      };
    case 'Department Head':
      return {
        cashbook: 'NONE',
        tithes: 'NONE',
        fixedAssets: 'DEPARTMENT_ONLY',
      };
    case 'Counter':
    case 'Admin':
    default:
      return {
        cashbook: 'NONE',
        tithes: 'NONE',
        fixedAssets: 'NONE',
      };
  }
}
