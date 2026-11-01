import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canViewIndividualGiving,
  canAccessDepartmentData,
  validateCountingSheetSignOff,
  ALL_ROLES,
} from '../src/permissions/index.js';

describe('Permissions & Roles Domain Module', () => {
  it('covers all defined church roles', () => {
    expect(ALL_ROLES).toContain('Treasurer');
    expect(ALL_ROLES).toContain('Finance Secretary');
    expect(ALL_ROLES).toContain('Counter');
    expect(ALL_ROLES).toContain('Pastor / Elder');
    expect(ALL_ROLES).toContain('Auditor');
    expect(ALL_ROLES).toContain('Department Head');
    expect(ALL_ROLES).toContain('Admin');
  });

  describe('Treasurer role', () => {
    it('has full ledger permissions including period close, rate setting, and override', () => {
      expect(hasPermission('Treasurer', 'ledger:post_entry')).toBe(true);
      expect(hasPermission('Treasurer', 'ledger:close_period')).toBe(true);
      expect(hasPermission('Treasurer', 'ledger:set_exchange_rate')).toBe(true);
      expect(hasPermission('Treasurer', 'ledger:override_overdraft')).toBe(true);
      expect(hasPermission('Treasurer', 'ledger:run_trial_balance_doctor')).toBe(true);
      expect(hasPermission('Treasurer', 'ledger:act_on_trial_balance_doctor')).toBe(true);
    });
  });

  describe('Finance Secretary role', () => {
    it('can post entries and manage giving but CANNOT close periods or change roles', () => {
      expect(hasPermission('Finance Secretary', 'ledger:post_entry')).toBe(true);
      expect(hasPermission('Finance Secretary', 'income:enter_giving')).toBe(true);
      expect(hasPermission('Finance Secretary', 'ledger:close_period')).toBe(false);
      expect(hasPermission('Finance Secretary', 'admin:manage_roles')).toBe(false);
    });
  });

  describe('Counter role', () => {
    it('only creates and signs weekly counting sheets', () => {
      expect(hasPermission('Counter', 'income:create_counting_sheet')).toBe(true);
      expect(hasPermission('Counter', 'income:sign_counting_sheet')).toBe(true);
      expect(hasPermission('Counter', 'ledger:post_entry')).toBe(false);
      expect(hasPermission('Counter', 'reports:view_financial')).toBe(false);
    });
  });

  describe('Auditor role', () => {
    it('has read-only access to reports and audit log, but no entry permissions', () => {
      expect(hasPermission('Auditor', 'audit:view_log')).toBe(true);
      expect(hasPermission('Auditor', 'reports:view_financial')).toBe(true);
      expect(hasPermission('Auditor', 'ledger:run_trial_balance_doctor')).toBe(true);
      expect(hasPermission('Auditor', 'ledger:post_entry')).toBe(false);
      expect(hasPermission('Auditor', 'expenses:approve_requisition')).toBe(false);
    });
  });

  describe('Privacy Rule for Individual Member Giving', () => {
    it('allows Treasurer, Finance Secretary, Pastor / Elder, and Auditor', () => {
      expect(canViewIndividualGiving('Treasurer')).toBe(true);
      expect(canViewIndividualGiving('Finance Secretary')).toBe(true);
      expect(canViewIndividualGiving('Pastor / Elder')).toBe(true);
      expect(canViewIndividualGiving('Auditor')).toBe(true);
    });

    it('strictly hides individual giving from Counter, Department Head, and Admin', () => {
      expect(canViewIndividualGiving('Counter')).toBe(false);
      expect(canViewIndividualGiving('Department Head')).toBe(false);
      expect(canViewIndividualGiving('Admin')).toBe(false);
    });
  });

  describe('Department Access Scoping', () => {
    it('limits Department Head to their own assigned department', () => {
      expect(canAccessDepartmentData('Department Head', 'dept_youth', 'dept_youth')).toBe(true);
      expect(canAccessDepartmentData('Department Head', 'dept_youth', 'dept_men')).toBe(false);
    });

    it('allows leadership roles to access any department', () => {
      expect(canAccessDepartmentData('Treasurer', null, 'dept_youth')).toBe(true);
      expect(canAccessDepartmentData('Pastor / Elder', null, 'dept_youth')).toBe(true);
    });
  });

  describe('Counting Sheet Two-Person Sign-Off Validation', () => {
    it('passes when two different users sign off', () => {
      const res = validateCountingSheetSignOff('user_alice_uuid', 'user_bob_uuid');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects when the same user signs twice', () => {
      const res = validateCountingSheetSignOff('user_alice_uuid', 'user_alice_uuid');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/different people/);
    });

    it('rejects when either signer is missing', () => {
      const res = validateCountingSheetSignOff('user_alice_uuid', '');
      expect(res.isValid).toBe(false);
    });
  });
});
