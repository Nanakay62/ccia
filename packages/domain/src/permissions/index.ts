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

    'reports:view_financial',
    'reports:view_usd_summary',
    'reports:export',

    'audit:view_log',
  ],

  'Department Head': [
    'expenses:submit_requisition',
    'budget:view_own_department',
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
export function validateCountingSheetSignOff(
  firstCounterUserId: string,
  secondCounterUserId: string
): { isValid: boolean; error?: string } {
  if (!firstCounterUserId || !secondCounterUserId) {
    return {
      isValid: false,
      error: 'Counting sheet requires two counter signatures.',
    };
  }
  if (firstCounterUserId === secondCounterUserId) {
    return {
      isValid: false,
      error: 'The two signers must be different people.',
    };
  }
  return { isValid: true };
}
