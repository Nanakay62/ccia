/**
 * Payroll Domain Types.
 * Staff registry, allowances, statutory deductions, monthly payroll runs, and payslips.
 */

export type EmploymentType = 'PASTORAL_CLERGY' | 'FULL_TIME_STAFF' | 'PART_TIME_STAFF';

export interface StaffMember {
  readonly id: string;
  readonly branchId: string;
  readonly staffNumber: string; // e.g. "STF-001"
  readonly title?: string;
  readonly fullName: string;
  readonly roleTitle: string; // e.g. "Senior Pastor", "Church Administrator"
  readonly department: string; // e.g. "Pastoral", "Administration", "Music", "Facilities"
  readonly employmentType: EmploymentType;
  readonly basicSalaryPesewas: bigint;
  readonly housingAllowancePesewas: bigint;
  readonly transportAllowancePesewas: bigint;
  readonly pastoralResponsibilityPesewas: bigint;
  readonly bankName?: string;
  readonly bankAccountNumber?: string;
  readonly momoNetwork?: 'MTN' | 'VODAFONE' | 'AIRTELTIGO';
  readonly momoNumber?: string;
  readonly ghanaCardNumber?: string;
  readonly tinNumber?: string;
  readonly ssnitNumber?: string;
  readonly startDate?: string;
  readonly isActive: boolean;
}

export interface PayrollItem {
  readonly staffId: string;
  readonly staffNumber: string;
  readonly fullName: string;
  readonly roleTitle: string;
  readonly basicSalaryPesewas: bigint;
  readonly housingAllowancePesewas: bigint;
  readonly transportAllowancePesewas: bigint;
  readonly pastoralResponsibilityPesewas: bigint;
  readonly totalAllowancesPesewas: bigint;
  readonly grossSalaryPesewas: bigint;
  readonly taxableIncomePesewas?: bigint;
  readonly ssnitTier1EmployeePesewas: bigint; // 5.5% employee contribution
  readonly ssnitTier1EmployerPesewas: bigint; // 13% employer contribution
  readonly payeTaxPesewas: bigint;            // Withheld PAYE tax
  readonly totalDeductionsPesewas: bigint;
  readonly netSalaryPesewas: bigint;
  readonly paymentMethod: 'BANK' | 'MOMO' | 'CASH';
  readonly taxOverridden?: boolean;
  readonly taxOverrideReason?: string;
}

export type PayrollStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'POSTED';

export interface PayrollRun {
  readonly id: string;
  readonly branchId: string;
  readonly payrollNumber: string; // e.g. "PR-2026-10"
  readonly periodMonth: number;
  readonly periodYear: number;
  readonly payDate: string;
  readonly fundId: string;
  readonly expenseAccountId: string;
  readonly bankAccountId: string;
  readonly items: readonly PayrollItem[];
  readonly totalBasicPesewas: bigint;
  readonly totalAllowancesPesewas: bigint;
  readonly totalGrossPesewas: bigint;
  readonly totalEmployeeSsnitPesewas: bigint;
  readonly totalEmployerSsnitPesewas: bigint;
  readonly totalPayePesewas: bigint;
  readonly totalNetPayPesewas: bigint;
  readonly totalPayrollCostPesewas: bigint; // Gross + Employer SSNIT
  readonly status: PayrollStatus;
  readonly preparedById?: string;
  readonly preparedByName?: string;
  readonly preparedAt?: string;
  readonly submittedAt?: string;
  readonly authorizedBy?: string;
  readonly authorizedAt?: string;
  readonly approvedById?: string;
  readonly approvedByName?: string;
  readonly approvedAt?: string;
  readonly approvalComment?: string;
  readonly paidAt?: string;
  readonly paidReference?: string;
  readonly rateTableVersion?: string;
  readonly statutorySsnitPaid?: boolean;
  readonly statutorySsnitPaidRef?: string;
  readonly statutorySsnitPaidDate?: string;
  readonly statutoryPayePaid?: boolean;
  readonly statutoryPayePaidRef?: string;
  readonly statutoryPayePaidDate?: string;
  readonly journalEntryId?: string;
}

export interface Payslip {
  readonly payslipNumber: string;
  readonly churchName: string;
  readonly branchName: string;
  readonly periodLabel: string; // e.g. "October 2026"
  readonly payDate: string;
  readonly staffNumber: string;
  readonly fullName: string;
  readonly roleTitle: string;
  readonly department: string;
  readonly ssnitNumber?: string;
  readonly bankOrMomoDetails: string;
  readonly basicSalaryPesewas: bigint;
  readonly housingAllowancePesewas: bigint;
  readonly transportAllowancePesewas: bigint;
  readonly pastoralResponsibilityPesewas: bigint;
  readonly grossSalaryPesewas: bigint;
  readonly ssnitEmployeePesewas: bigint;
  readonly payeTaxPesewas: bigint;
  readonly totalDeductionsPesewas: bigint;
  readonly netSalaryPesewas: bigint;
  readonly netSalaryFigures: string;
  readonly netSalaryInWords: string;
}
