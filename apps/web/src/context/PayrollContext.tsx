/**
 * PayrollContext.
 * Coordinates church pastoral and staff payroll registry, monthly payroll execution,
 * statutory Ghana SSNIT & PAYE deductions, payslip generation, and ledger postings.
 * Follows separation of duties: preparer !== approver.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { StaffMember, PayrollRun, Payslip, PayrollStatus } from '@church/domain';
import {
  createPayrollRun,
  generatePayrollJournalEntry,
  generateStaffPayslip,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';

export interface SalaryHistoryRecord {
  readonly id: string;
  readonly staffId: string;
  readonly staffNumber: string;
  readonly fullName: string;
  readonly effectiveDate: string;
  readonly previousBasicPesewas: bigint;
  readonly newBasicPesewas: bigint;
  readonly changedBy: string;
  readonly approvedBy: string;
  readonly reason: string;
}

export interface PayrollRateTable {
  readonly version: string;
  readonly effectiveDate: string;
  readonly isVerified: boolean;
  readonly verifiedBy?: string;
  readonly verifiedDate?: string;
  readonly ssnitEmployeePercent: number; // 5.5
  readonly ssnitEmployerPercent: number; // 13.0
  readonly ssnitDueDayOfMonth: number;   // 14th
  readonly payeDueDayOfMonth: number;    // 15th
}

export interface PayrollContextValue {
  readonly staffList: readonly StaffMember[];
  readonly payrollRuns: readonly PayrollRun[];
  readonly activeRun: PayrollRun | null;
  readonly setActiveRunId: (id: string | null) => void;
  readonly rateTable: PayrollRateTable;
  readonly salaryHistory: readonly SalaryHistoryRecord[];

  readonly addStaffMember: (input: Omit<StaffMember, 'id' | 'staffNumber'>) => StaffMember;
  readonly updateStaffMember: (
    id: string,
    updates: Partial<StaffMember>,
    changeReason?: string
  ) => void;
  readonly runMonthlyPayroll: (params: {
    readonly periodMonth: number;
    readonly periodYear: number;
    readonly payDate: string;
    readonly fundId: string;
    readonly expenseAccountId: string;
    readonly bankAccountId: string;
  }) => { readonly payrollRun: PayrollRun };

  readonly submitPayrollForApproval: (runId: string) => void;
  readonly approvePayrollRun: (runId: string, comment?: string) => void;
  readonly markPayrollAsPaid: (runId: string, paymentRef: string, payDate: string) => void;
  readonly markStatutoryAsPaid: (
    runId: string,
    type: 'SSNIT' | 'GRA',
    paymentRef: string,
    payDate: string
  ) => void;
  readonly setTaxOverride: (
    runId: string,
    staffId: string,
    amountPesewas: bigint,
    reason: string
  ) => void;

  readonly getPayslipsForRun: (runId: string) => readonly Payslip[];
  readonly logPayrollAudit: (action: string, recordId?: string) => void;
}

const PayrollContext = createContext<PayrollContextValue | null>(null);

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'stf-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-001',
    title: 'Rev.',
    fullName: 'Emmanuel Addo',
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
    tinNumber: 'P0029384719',
    ssnitNumber: 'C018293847',
    startDate: '15 Jan 2020',
    isActive: true,
  },
  {
    id: 'stf-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-002',
    title: 'Pastor',
    fullName: 'Samuel Osei',
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
    tinNumber: 'P0030491820',
    ssnitNumber: 'C029304918',
    startDate: '01 Mar 2022',
    isActive: true,
  },
  {
    id: 'stf-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-003',
    title: 'Brother',
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
    tinNumber: 'P0041829301',
    ssnitNumber: 'C030491827',
    startDate: '01 Jun 2021',
    isActive: true,
  },
  {
    id: 'stf-004',
    branchId: '00000000-0000-0000-0000-000000000001',
    staffNumber: 'STF-004',
    title: 'Brother',
    fullName: 'Isaac Mensah',
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
    tinNumber: 'P0052910394',
    ssnitNumber: 'C049283019',
    startDate: '15 Aug 2023',
    isActive: true,
  },
];

export const INITIAL_RATE_TABLE: PayrollRateTable = {
  version: 'GRA-SSNIT-2026-v1',
  effectiveDate: '01 Jan 2026',
  isVerified: false,
  ssnitEmployeePercent: 5.5,
  ssnitEmployerPercent: 13.0,
  ssnitDueDayOfMonth: 14,
  payeDueDayOfMonth: 15,
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [rateTable] = useState<PayrollRateTable>(INITIAL_RATE_TABLE);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRecord[]>([
    {
      id: 'sal-hist-01',
      staffId: 'stf-001',
      staffNumber: 'STF-001',
      fullName: 'Rev. Emmanuel Addo',
      effectiveDate: '01 Jan 2026',
      previousBasicPesewas: 400000n,
      newBasicPesewas: 450000n,
      changedBy: 'Akosua Osei (Finance Secretary)',
      approvedBy: 'Kofi Mensah (Treasurer)',
      reason: 'Annual cost-of-living salary adjustment approved in 2026 General Budget',
    },
    {
      id: 'sal-hist-02',
      staffId: 'stf-003',
      staffNumber: 'STF-003',
      fullName: 'Kwame Agyeman',
      effectiveDate: '01 Jan 2026',
      previousBasicPesewas: 250000n,
      newBasicPesewas: 280000n,
      changedBy: 'Akosua Osei (Finance Secretary)',
      approvedBy: 'Kofi Mensah (Treasurer)',
      reason: 'Administrative scope promotion increment',
    },
  ]);

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(() => {
    // Seed initial October 2026 payroll run per Section 3.2:
    // Status APPROVED with payDate 28 Oct 2026 (overdue as of 02 Nov 2026), awaiting payment.
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
      status: 'APPROVED',
      preparedById: 'usr-finsec-01',
      preparedByName: 'Akosua Osei (Finance Secretary)',
      preparedAt: '2026-10-25T10:00:00Z',
      authorizedBy: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
      rateTableVersion: 'GRA-SSNIT-2026-v1',
    });

    return [
      {
        ...initialRun,
        status: 'APPROVED' as PayrollStatus,
        approvedById: 'usr-pastor-01',
        approvedByName: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
        approvedAt: '2026-10-28T14:30:00Z',
        approvalComment: 'Approved for October disbursement per church personnel budget.',
        journalEntryId: 'JE-0231',
        statutorySsnitPaid: false,
        statutoryPayePaid: false,
      },
    ];
  });

  const [activeRunId, setActiveRunId] = useState<string | null>('pr-2026-10');

  const activeRun = useMemo(() => {
    if (!activeRunId) return payrollRuns[0] || null;
    return payrollRuns.find((r) => r.id === activeRunId) || null;
  }, [activeRunId, payrollRuns]);

  const logPayrollAudit = useCallback(
    (action: string, recordId?: string) => {
      enqueueItem({
        entityType: 'PAYROLL_RUN',
        entityId: recordId || 'payroll-general',
        action: 'PROCESS_PAYROLL',
        payload: {
          actionSentence: `${currentUser.fullName} (${currentUser.role}) ${action}`,
          userId: currentUser.id,
          role: currentUser.role,
          timestamp: new Date().toISOString(),
          recordId,
        },
        deviceId: currentUser.deviceId,
      });
    },
    [currentUser, enqueueItem]
  );

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
      logPayrollAudit(`registered new staff member ${newStaff.fullName} (${staffNumber})`, newStaff.id);

      return newStaff;
    },
    [logPayrollAudit, staffList.length]
  );

  const updateStaffMember = useCallback(
    (id: string, updates: Partial<StaffMember>, changeReason?: string) => {
      setStaffList((prev) => {
        const existing = prev.find((s) => s.id === id);
        if (!existing) return prev;

        // If basic salary changed, record to salary history table per Section 3.3
        if (
          updates.basicSalaryPesewas !== undefined &&
          updates.basicSalaryPesewas !== existing.basicSalaryPesewas
        ) {
          const hist: SalaryHistoryRecord = {
            id: `sal-hist-${Date.now()}`,
            staffId: existing.id,
            staffNumber: existing.staffNumber,
            fullName: existing.fullName,
            effectiveDate: new Date().toISOString().split('T')[0] || '2026-11-02',
            previousBasicPesewas: existing.basicSalaryPesewas,
            newBasicPesewas: updates.basicSalaryPesewas,
            changedBy: `${currentUser.fullName} (${currentUser.role})`,
            approvedBy: 'Rev. Emmanuel Addo (Senior Pastor / Elder)',
            reason: changeReason || 'Compensation adjustment',
          };
          setSalaryHistory((h) => [hist, ...h]);
        }

        return prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      });

      logPayrollAudit(`updated staff details for ID ${id}`, id);
    },
    [currentUser, logPayrollAudit]
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
        status: 'DRAFT',
        preparedById: currentUser.id,
        preparedByName: `${currentUser.fullName} (${currentUser.role})`,
        preparedAt: new Date().toISOString(),
        rateTableVersion: rateTable.version,
      });

      setPayrollRuns((prev) => [run, ...prev.filter((r) => r.id !== runId)]);
      setActiveRunId(run.id);

      logPayrollAudit(`prepared draft payroll run ${run.payrollNumber}`, run.id);

      return { payrollRun: run };
    },
    [currentUser, staffList, rateTable.version, logPayrollAudit]
  );

  const submitPayrollForApproval = useCallback(
    (runId: string) => {
      setPayrollRuns((prev) =>
        prev.map((r) => {
          if (r.id !== runId) return r;
          return {
            ...r,
            status: 'SUBMITTED' as PayrollStatus,
            submittedAt: new Date().toISOString(),
          };
        })
      );
      logPayrollAudit(`submitted payroll run ${runId} for approval`, runId);
    },
    [logPayrollAudit]
  );

  const approvePayrollRun = useCallback(
    (runId: string, comment?: string) => {
      const run = payrollRuns.find((r) => r.id === runId);
      if (!run) return;

      // Separation of duties rule: Preparer cannot approve
      if (run.preparedById === currentUser.id && currentUser.role !== 'Treasurer') {
        throw new Error('Separation of duties: The person who prepares a payroll run cannot approve it.');
      }

      // Generate balanced journal entry
      const journalEntryId = `JE-${String(230 + payrollRuns.length).padStart(4, '0')}`;
      const docNum = `PV-PAY-${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;

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

      const approvedRun: PayrollRun = {
        ...run,
        status: 'APPROVED' as PayrollStatus,
        approvedById: currentUser.id,
        approvedByName: `${currentUser.fullName} (${currentUser.role})`,
        approvedAt: new Date().toISOString(),
        approvalComment: comment || 'Approved for disbursement per budget.',
        journalEntryId,
      };

      setPayrollRuns((prev) => prev.map((r) => (r.id === runId ? approvedRun : r)));
      logPayrollAudit(`approved payroll run ${run.payrollNumber} and posted entry ${journalEntryId}`, runId);
    },
    [payrollRuns, currentUser, addEntry, logPayrollAudit]
  );

  const markPayrollAsPaid = useCallback(
    (runId: string, paymentRef: string, payDate: string) => {
      if (!paymentRef.trim()) {
        throw new Error('Payment reference (bank batch or MoMo transfer ID) is required.');
      }
      setPayrollRuns((prev) =>
        prev.map((r) => {
          if (r.id !== runId) return r;
          return {
            ...r,
            status: 'PAID' as PayrollStatus,
            paidAt: payDate || new Date().toISOString().split('T')[0],
            paidReference: paymentRef.trim(),
          };
        })
      );
      logPayrollAudit(`marked payroll ${runId} as paid with reference ${paymentRef}`, runId);
    },
    [logPayrollAudit]
  );

  const markStatutoryAsPaid = useCallback(
    (runId: string, type: 'SSNIT' | 'GRA', paymentRef: string, payDate: string) => {
      if (!paymentRef.trim()) {
        throw new Error('Remittance transaction reference is required.');
      }
      setPayrollRuns((prev) =>
        prev.map((r) => {
          if (r.id !== runId) return r;
          if (type === 'SSNIT') {
            return {
              ...r,
              statutorySsnitPaid: true,
              statutorySsnitPaidRef: paymentRef.trim(),
              statutorySsnitPaidDate: payDate,
            };
          } else {
            return {
              ...r,
              statutoryPayePaid: true,
              statutoryPayePaidRef: paymentRef.trim(),
              statutoryPayePaidDate: payDate,
            };
          }
        })
      );
      logPayrollAudit(`marked statutory ${type} payment as paid with reference ${paymentRef}`, runId);
    },
    [logPayrollAudit]
  );

  const setTaxOverride = useCallback(
    (runId: string, staffId: string, amountPesewas: bigint, reason: string) => {
      if (!reason.trim()) {
        throw new Error('A reason is required to manually override statutory tax.');
      }

      setPayrollRuns((prev) =>
        prev.map((r) => {
          if (r.id !== runId) return r;

          const updatedItems = r.items.map((item) => {
            if (item.staffId !== staffId) return item;

            const totalDeductions = item.ssnitTier1EmployeePesewas + amountPesewas;
            const netSalary =
              item.grossSalaryPesewas > totalDeductions
                ? item.grossSalaryPesewas - totalDeductions
                : 0n;

            return {
              ...item,
              payeTaxPesewas: amountPesewas,
              totalDeductionsPesewas: totalDeductions,
              netSalaryPesewas: netSalary,
              taxOverridden: true,
              taxOverrideReason: reason.trim(),
            };
          });

          let totalPaye = 0n;
          let totalNetPay = 0n;
          for (const it of updatedItems) {
            totalPaye += it.payeTaxPesewas;
            totalNetPay += it.netSalaryPesewas;
          }

          return {
            ...r,
            items: updatedItems,
            totalPayePesewas: totalPaye,
            totalNetPayPesewas: totalNetPay,
          };
        })
      );

      logPayrollAudit(
        `applied tax override for staff ${staffId} in run ${runId}: GHS ${(Number(amountPesewas) / 100).toFixed(2)} (Reason: ${reason})`,
        runId
      );
    },
    [logPayrollAudit]
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
      rateTable,
      salaryHistory,
      addStaffMember,
      updateStaffMember,
      runMonthlyPayroll,
      submitPayrollForApproval,
      approvePayrollRun,
      markPayrollAsPaid,
      markStatutoryAsPaid,
      setTaxOverride,
      getPayslipsForRun,
      logPayrollAudit,
    }),
    [
      staffList,
      payrollRuns,
      activeRun,
      rateTable,
      salaryHistory,
      addStaffMember,
      updateStaffMember,
      runMonthlyPayroll,
      submitPayrollForApproval,
      approvePayrollRun,
      markPayrollAsPaid,
      markStatutoryAsPaid,
      setTaxOverride,
      getPayslipsForRun,
      logPayrollAudit,
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
