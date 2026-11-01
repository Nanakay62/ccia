/**
 * PayrollContext.
 * Coordinates church pastoral and staff payroll registry, monthly payroll execution,
 * statutory Ghana SSNIT & PAYE deductions, payslip generation, and ledger postings.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { StaffMember, PayrollRun, Payslip, JournalEntry } from '@church/domain';
import {
  createPayrollRun,
  generatePayrollJournalEntry,
  generateStaffPayslip,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';

export interface PayrollContextValue {
  readonly staffList: readonly StaffMember[];
  readonly payrollRuns: readonly PayrollRun[];
  readonly activeRun: PayrollRun | null;
  readonly setActiveRunId: (id: string | null) => void;

  readonly addStaffMember: (input: Omit<StaffMember, 'id' | 'staffNumber'>) => StaffMember;
  readonly updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
  readonly runMonthlyPayroll: (params: {
    readonly periodMonth: number;
    readonly periodYear: number;
    readonly payDate: string;
    readonly fundId: string;
    readonly expenseAccountId: string;
    readonly bankAccountId: string;
  }) => { readonly payrollRun: PayrollRun; readonly journalEntry: JournalEntry };
  readonly getPayslipsForRun: (runId: string) => readonly Payslip[];
}

const PayrollContext = createContext<PayrollContextValue | null>(null);

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'stf-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-001',
    fullName: 'Rev. Emmanuel Appiah',
    roleTitle: 'Senior Pastor',
    department: 'Pastoral',
    employmentType: 'PASTORAL_CLERGY',
    basicSalaryPesewas: 450000n, // GHS 4,500.00
    housingAllowancePesewas: 120000n, // GHS 1,200.00
    transportAllowancePesewas: 80000n, // GHS 800.00
    pastoralResponsibilityPesewas: 50000n, // GHS 500.00
    bankName: 'GCB Bank (High Street)',
    bankAccountNumber: '101112223344',
    ghanaCardNumber: 'GHA-718293847-1',
    ssnitNumber: 'C018293847',
    isActive: true,
  },
  {
    id: 'stf-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-002',
    fullName: 'Pastor Samuel Osei',
    roleTitle: 'Associate & Youth Pastor',
    department: 'Youth Ministry',
    employmentType: 'PASTORAL_CLERGY',
    basicSalaryPesewas: 300000n, // GHS 3,000.00
    housingAllowancePesewas: 80000n, // GHS 800.00
    transportAllowancePesewas: 50000n, // GHS 500.00
    pastoralResponsibilityPesewas: 20000n, // GHS 200.00
    bankName: 'Ecobank Ghana (Ring Road)',
    bankAccountNumber: '144100029384',
    ghanaCardNumber: 'GHA-829304918-2',
    ssnitNumber: 'C029304918',
    isActive: true,
  },
  {
    id: 'stf-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-003',
    fullName: 'Kwame Agyeman',
    roleTitle: 'Church Administrator & Accountant',
    department: 'Administration',
    employmentType: 'FULL_TIME_STAFF',
    basicSalaryPesewas: 280000n, // GHS 2,800.00
    housingAllowancePesewas: 0n,
    transportAllowancePesewas: 40000n, // GHS 400.00
    pastoralResponsibilityPesewas: 0n,
    momoNetwork: 'MTN',
    momoNumber: '0244123456',
    ghanaCardNumber: 'GHA-930491827-3',
    ssnitNumber: 'C030491827',
    isActive: true,
  },
  {
    id: 'stf-004',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-004',
    fullName: 'Brother Isaac Mensah',
    roleTitle: 'Church Caretaker & Facility Officer',
    department: 'Facilities',
    employmentType: 'FULL_TIME_STAFF',
    basicSalaryPesewas: 160000n, // GHS 1,600.00
    housingAllowancePesewas: 0n,
    transportAllowancePesewas: 20000n, // GHS 200.00
    pastoralResponsibilityPesewas: 0n,
    momoNetwork: 'VODAFONE',
    momoNumber: '0208123456',
    ghanaCardNumber: 'GHA-619283019-4',
    ssnitNumber: 'C049283019',
    isActive: true,
  },
];

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(() => {
    // Seed initial October 2026 payroll run
    const initialRun = createPayrollRun({
      id: 'pr-2026-10',
      branchId: currentUser.branchId,
      payrollNumber: 'PR-2026-10',
      periodMonth: 10,
      periodYear: 2026,
      payDate: '2026-10-28',
      fundId: 'fund-gen',
      expenseAccountId: 'acct-5010',
      bankAccountId: 'acct-1030',
      staff: INITIAL_STAFF,
      authorizedBy: 'Elder Kofi Mensah (Treasurer)',
    });
    return [initialRun];
  });

  const [activeRunId, setActiveRunId] = useState<string | null>('pr-2026-10');

  const activeRun = useMemo(() => {
    if (!activeRunId) return payrollRuns[0] || null;
    return payrollRuns.find((r) => r.id === activeRunId) || null;
  }, [activeRunId, payrollRuns]);

  const addStaffMember = useCallback(
    (input: Omit<StaffMember, 'id' | 'staffNumber'>): StaffMember => {
      const nextNum = staffList.length + 1;
      const staffNumber = `STF-${String(nextNum).padStart(3, '0')}`;
      const newStaff: StaffMember = {
        ...input,
        id: `stf-${Date.now()}`,
        staffNumber,
      };

      setStaffList((prev) => [...prev, newStaff]);
      enqueueItem({
        entityType: 'STAFF_MEMBER',
        entityId: newStaff.id,
        action: 'UPDATE_MEMBER',
        payload: newStaff,
        deviceId: currentUser.deviceId,
      });

      return newStaff;
    },
    [currentUser.deviceId, staffList.length, enqueueItem]
  );

  const updateStaffMember = useCallback(
    (id: string, updates: Partial<StaffMember>) => {
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      enqueueItem({
        entityType: 'STAFF_MEMBER',
        entityId: id,
        action: 'UPDATE_MEMBER',
        payload: updates,
        deviceId: currentUser.deviceId,
      });
    },
    [currentUser.deviceId, enqueueItem]
  );

  const runMonthlyPayroll = useCallback(
    (params: {
      periodMonth: number;
      periodYear: number;
      payDate: string;
      fundId: string;
      expenseAccountId: string;
      bankAccountId: string;
    }) => {
      const runId = `pr-${params.periodYear}-${String(params.periodMonth).padStart(2, '0')}`;
      const payrollNumber = `PR-${params.periodYear}-${String(params.periodMonth).padStart(2, '0')}`;

      const run = createPayrollRun({
        id: runId,
        branchId: currentUser.branchId,
        payrollNumber,
        periodMonth: params.periodMonth,
        periodYear: params.periodYear,
        payDate: params.payDate,
        fundId: params.fundId,
        expenseAccountId: params.expenseAccountId,
        bankAccountId: params.bankAccountId,
        staff: staffList,
        authorizedBy: `${currentUser.fullName} (${currentUser.role})`,
      });

      // Generate balanced journal entry
      const journalEntryId = `je-pr-${Date.now()}`;
      const docNum = `PV-PAY-${params.periodYear}-${String(params.periodMonth).padStart(2, '0')}`;

      const journalEntry = generatePayrollJournalEntry({
        payrollRun: run,
        journalEntryId,
        documentNumber: docNum,
        deviceId: currentUser.deviceId,
        createdBy: currentUser.id,
        ssnitLiabilityAccountId: 'acct-2020',
        payeLiabilityAccountId: 'acct-2030',
      });

      // Post balanced entry to general ledger
      addEntry(journalEntry);

      const finalRun = { ...run, journalEntryId, status: 'POSTED' as const };
      setPayrollRuns((prev) => [finalRun, ...prev.filter((r) => r.id !== runId)]);
      setActiveRunId(finalRun.id);

      enqueueItem({
        entityType: 'PAYROLL_RUN',
        entityId: finalRun.id,
        action: 'PROCESS_PAYROLL',
        payload: finalRun,
        deviceId: currentUser.deviceId,
      });

      return { payrollRun: finalRun, journalEntry };
    },
    [currentUser, staffList, addEntry, enqueueItem]
  );

  const getPayslipsForRun = useCallback(
    (runId: string): Payslip[] => {
      const run = payrollRuns.find((r) => r.id === runId);
      if (!run) return [];

      const staffMap = new Map(staffList.map((s) => [s.id, s]));

      return run.items.map((item) => {
        const staff = staffMap.get(item.staffId) || {
          id: item.staffId,
          branchId: run.branchId,
          staffNumber: item.staffNumber,
          fullName: item.fullName,
          roleTitle: item.roleTitle,
          department: 'Church Office',
          employmentType: 'FULL_TIME_STAFF',
          basicSalaryPesewas: item.basicSalaryPesewas,
          housingAllowancePesewas: item.housingAllowancePesewas,
          transportAllowancePesewas: item.transportAllowancePesewas,
          pastoralResponsibilityPesewas: item.pastoralResponsibilityPesewas,
          isActive: true,
        };

        return generateStaffPayslip({
          payrollRun: run,
          item,
          staff,
        });
      });
    },
    [payrollRuns, staffList]
  );

  const value = useMemo(
    () => ({
      staffList,
      payrollRuns,
      activeRun,
      setActiveRunId,
      addStaffMember,
      updateStaffMember,
      runMonthlyPayroll,
      getPayslipsForRun,
    }),
    [
      staffList,
      payrollRuns,
      activeRun,
      addStaffMember,
      updateStaffMember,
      runMonthlyPayroll,
      getPayslipsForRun,
    ]
  );

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
};

export function usePayroll(): PayrollContextValue {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayroll must be used within a PayrollProvider');
  }
  return context;
}
