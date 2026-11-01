/**
 * Ghana Statutory Payroll Calculations & Journal Entry Generator.
 * Handles SSNIT (Tier 1 5.5% employee / 13% employer), graduated PAYE tax bands,
 * net pay distribution, payslips, and balanced double-entry ledger postings.
 */

import Big from 'big.js';
import type { StaffMember, PayrollItem, PayrollRun, Payslip } from './types.js';
import type { JournalEntry } from '../ledger/types.js';
import { numberToWordsGhs } from '../giving/receipts.js';

/**
 * Calculates Ghana SSNIT Tier 1 contributions using Banker's Rounding (Round-Half-To-Even).
 */
export function calculateSsnitContributions(basicSalaryPesewas: bigint): {
  readonly employeeSsnitPesewas: bigint;
  readonly employerSsnitPesewas: bigint;
} {
  if (basicSalaryPesewas <= 0n) {
    return { employeeSsnitPesewas: 0n, employerSsnitPesewas: 0n };
  }

  const basic = new Big(basicSalaryPesewas.toString());

  // 5.5% employee
  const empExact = basic.times('0.055');
  const employeeSsnitPesewas = BigInt(empExact.round(0, Big.roundHalfEven).toFixed(0));

  // 13.0% employer
  const emplrExact = basic.times('0.13');
  const employerSsnitPesewas = BigInt(emplrExact.round(0, Big.roundHalfEven).toFixed(0));

  return { employeeSsnitPesewas, employerSsnitPesewas };
}

/**
 * Calculates Ghana GRA Statutory Monthly PAYE Income Tax on taxable income (Gross - Employee SSNIT).
 * Brackets (in GHS):
 * - First 490: 0%
 * - Next 110: 5%
 * - Next 130: 10%
 * - Next 3,166.67: 17.5%
 * - Next 16,000: 25%
 * - Next 30,520: 30%
 * - Exceeding 50,416.67: 35%
 */
export function calculateGhanaPayeTax(taxableIncomePesewas: bigint): bigint {
  if (taxableIncomePesewas <= 49000n) {
    return 0n; // First GHS 490 is tax-free
  }

  const taxableGhs = Number(taxableIncomePesewas) / 100;
  let remaining = taxableGhs;
  let taxGhs = 0;

  // Band 1: First 490 @ 0%
  remaining -= 490;

  // Band 2: Next 110 @ 5%
  if (remaining > 0) {
    const chunk = Math.min(remaining, 110);
    taxGhs += chunk * 0.05;
    remaining -= chunk;
  }

  // Band 3: Next 130 @ 10%
  if (remaining > 0) {
    const chunk = Math.min(remaining, 130);
    taxGhs += chunk * 0.10;
    remaining -= chunk;
  }

  // Band 4: Next 3,166.67 @ 17.5%
  if (remaining > 0) {
    const chunk = Math.min(remaining, 3166.67);
    taxGhs += chunk * 0.175;
    remaining -= chunk;
  }

  // Band 5: Next 16,000 @ 25%
  if (remaining > 0) {
    const chunk = Math.min(remaining, 16000);
    taxGhs += chunk * 0.25;
    remaining -= chunk;
  }

  // Band 6: Next 30,520 @ 30%
  if (remaining > 0) {
    const chunk = Math.min(remaining, 30520);
    taxGhs += chunk * 0.30;
    remaining -= chunk;
  }

  // Band 7: Exceeding 50,416.67 @ 35%
  if (remaining > 0) {
    taxGhs += remaining * 0.35;
  }

  const taxBig = new Big(taxGhs).times(100);
  return BigInt(taxBig.round(0, Big.roundHalfEven).toFixed(0));
}

/**
 * Calculates a single staff member's complete monthly payroll item.
 */
export function calculatePayrollItem(staff: StaffMember): PayrollItem {
  const totalAllowancesPesewas =
    staff.housingAllowancePesewas +
    staff.transportAllowancePesewas +
    staff.pastoralResponsibilityPesewas;

  const grossSalaryPesewas = staff.basicSalaryPesewas + totalAllowancesPesewas;

  const { employeeSsnitPesewas, employerSsnitPesewas } =
    calculateSsnitContributions(staff.basicSalaryPesewas);

  // Taxable income = Gross - Employee SSNIT
  const taxableIncomePesewas =
    grossSalaryPesewas > employeeSsnitPesewas
      ? grossSalaryPesewas - employeeSsnitPesewas
      : 0n;

  const payeTaxPesewas = calculateGhanaPayeTax(taxableIncomePesewas);
  const totalDeductionsPesewas = employeeSsnitPesewas + payeTaxPesewas;
  const netSalaryPesewas =
    grossSalaryPesewas > totalDeductionsPesewas
      ? grossSalaryPesewas - totalDeductionsPesewas
      : 0n;

  const paymentMethod: 'BANK' | 'MOMO' | 'CASH' = staff.bankAccountNumber
    ? 'BANK'
    : staff.momoNumber
    ? 'MOMO'
    : 'CASH';

  return {
    staffId: staff.id,
    staffNumber: staff.staffNumber,
    fullName: staff.fullName,
    roleTitle: staff.roleTitle,
    basicSalaryPesewas: staff.basicSalaryPesewas,
    housingAllowancePesewas: staff.housingAllowancePesewas,
    transportAllowancePesewas: staff.transportAllowancePesewas,
    pastoralResponsibilityPesewas: staff.pastoralResponsibilityPesewas,
    totalAllowancesPesewas,
    grossSalaryPesewas,
    ssnitTier1EmployeePesewas: employeeSsnitPesewas,
    ssnitTier1EmployerPesewas: employerSsnitPesewas,
    payeTaxPesewas,
    totalDeductionsPesewas,
    netSalaryPesewas,
    paymentMethod,
  };
}

export interface CreatePayrollRunInput {
  readonly id: string;
  readonly branchId: string;
  readonly payrollNumber: string;
  readonly periodMonth: number;
  readonly periodYear: number;
  readonly payDate: string;
  readonly fundId: string;
  readonly expenseAccountId: string; // e.g. "acct-5010" Salaries
  readonly bankAccountId: string;    // e.g. "acct-1030" Bank
  readonly staff: readonly StaffMember[];
  readonly authorizedBy?: string;
}

/**
 * Creates and evaluates a full monthly payroll run across all active church staff.
 */
export function createPayrollRun(input: CreatePayrollRunInput): PayrollRun {
  const activeStaff = input.staff.filter((s) => s.isActive);
  const items = activeStaff.map(calculatePayrollItem);

  let totalBasic = 0n;
  let totalAllowances = 0n;
  let totalGross = 0n;
  let totalEmployeeSsnit = 0n;
  let totalEmployerSsnit = 0n;
  let totalPaye = 0n;
  let totalNetPay = 0n;

  for (const item of items) {
    totalBasic += item.basicSalaryPesewas;
    totalAllowances += item.totalAllowancesPesewas;
    totalGross += item.grossSalaryPesewas;
    totalEmployeeSsnit += item.ssnitTier1EmployeePesewas;
    totalEmployerSsnit += item.ssnitTier1EmployerPesewas;
    totalPaye += item.payeTaxPesewas;
    totalNetPay += item.netSalaryPesewas;
  }

  const totalPayrollCost = totalGross + totalEmployerSsnit;

  return {
    id: input.id,
    branchId: input.branchId,
    payrollNumber: input.payrollNumber,
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    payDate: input.payDate,
    fundId: input.fundId,
    expenseAccountId: input.expenseAccountId,
    bankAccountId: input.bankAccountId,
    items,
    totalBasicPesewas: totalBasic,
    totalAllowancesPesewas: totalAllowances,
    totalGrossPesewas: totalGross,
    totalEmployeeSsnitPesewas: totalEmployeeSsnit,
    totalEmployerSsnitPesewas: totalEmployerSsnit,
    totalPayePesewas: totalPaye,
    totalNetPayPesewas: totalNetPay,
    totalPayrollCostPesewas: totalPayrollCost,
    status: input.authorizedBy ? 'APPROVED' : 'DRAFT',
    authorizedBy: input.authorizedBy,
    authorizedAt: input.authorizedBy ? new Date().toISOString() : undefined,
  };
}

/**
 * Generates an automated, balanced double-entry journal entry for the payroll run:
 * - Debit: Salaries & Allowances expense account (Total Cost: Gross + Employer SSNIT)
 * - Credit: Bank Account (Net Pay to staff)
 * - Credit: SSNIT Payable liability account (Employee 5.5% + Employer 13%)
 * - Credit: PAYE Tax Payable liability account (Withheld PAYE)
 */
export function generatePayrollJournalEntry(params: {
  readonly payrollRun: PayrollRun;
  readonly journalEntryId: string;
  readonly documentNumber: string;
  readonly deviceId: string;
  readonly createdBy: string;
  readonly ssnitLiabilityAccountId?: string; // default: "acct-2020"
  readonly payeLiabilityAccountId?: string;  // default: "acct-2030"
}): JournalEntry {
  const {
    payrollRun,
    journalEntryId,
    documentNumber,
    deviceId,
    createdBy,
    ssnitLiabilityAccountId = 'acct-2020',
    payeLiabilityAccountId = 'acct-2030',
  } = params;

  const totalSsnitPayable =
    payrollRun.totalEmployeeSsnitPesewas + payrollRun.totalEmployerSsnitPesewas;

  const lines = [
    // Line 1: Debit Gross Salaries & Allowances + Employer SSNIT
    {
      id: `${journalEntryId}-line-1`,
      journalEntryId,
      accountId: payrollRun.expenseAccountId,
      fundId: payrollRun.fundId,
      lineNumber: 1,
      originalCurrency: 'GHS' as const,
      originalAmount: payrollRun.totalPayrollCostPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: payrollRun.totalPayrollCostPesewas,
      creditAmountGhs: 0n,
      roundingDifferencePesewas: 0n,
      description: `Monthly Staff Salaries & Allowances (${payrollRun.payrollNumber})`,
    },
    // Line 2: Credit Bank (Net Salaries disbursed)
    {
      id: `${journalEntryId}-line-2`,
      journalEntryId,
      accountId: payrollRun.bankAccountId,
      fundId: payrollRun.fundId,
      lineNumber: 2,
      originalCurrency: 'GHS' as const,
      originalAmount: payrollRun.totalNetPayPesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: 0n,
      creditAmountGhs: payrollRun.totalNetPayPesewas,
      roundingDifferencePesewas: 0n,
      description: `Net Staff Salaries Disbursed via Bank`,
    },
  ];

  let nextLineNum = 3;

  // Line 3: Credit SSNIT Payable (if SSNIT applicable)
  if (totalSsnitPayable > 0n) {
    lines.push({
      id: `${journalEntryId}-line-${nextLineNum}`,
      journalEntryId,
      accountId: ssnitLiabilityAccountId,
      fundId: payrollRun.fundId,
      lineNumber: nextLineNum,
      originalCurrency: 'GHS' as const,
      originalAmount: totalSsnitPayable,
      exchangeRate: '1.0000',
      debitAmountGhs: 0n,
      creditAmountGhs: totalSsnitPayable,
      roundingDifferencePesewas: 0n,
      description: `SSNIT Tier 1 Contribution (5.5% Emp + 13% Emplr)`,
    });
    nextLineNum++;
  }

  // Line 4: Credit PAYE Tax Payable (if PAYE applicable)
  if (payrollRun.totalPayePesewas > 0n) {
    lines.push({
      id: `${journalEntryId}-line-${nextLineNum}`,
      journalEntryId,
      accountId: payeLiabilityAccountId,
      fundId: payrollRun.fundId,
      lineNumber: nextLineNum,
      originalCurrency: 'GHS' as const,
      originalAmount: payrollRun.totalPayePesewas,
      exchangeRate: '1.0000',
      debitAmountGhs: 0n,
      creditAmountGhs: payrollRun.totalPayePesewas,
      roundingDifferencePesewas: 0n,
      description: `Ghana GRA PAYE Tax Withheld from Salaries`,
    });
  }

  const totalDebit = lines.reduce((sum, l) => sum + l.debitAmountGhs, 0n);
  const totalCredit = lines.reduce((sum, l) => sum + l.creditAmountGhs, 0n);

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Payroll journal entry does not balance! Debit: ${totalDebit}, Credit: ${totalCredit}`
    );
  }

  const now = new Date().toISOString();

  return {
    id: journalEntryId,
    branchId: payrollRun.branchId,
    documentNumber,
    entryDate: payrollRun.payDate,
    entryType: 'VOUCHER',
    narration: `Staff Payroll Disbursal for ${payrollRun.payrollNumber}`,
    lineCount: lines.length,
    totalDebitGhs: totalDebit,
    totalCreditGhs: totalCredit,
    isReversal: false,
    createdBy,
    deviceId,
    createdAt: now,
    lines,
  };
}

/**
 * Generates an individual official payslip for a staff member.
 */
export function generateStaffPayslip(params: {
  readonly payrollRun: PayrollRun;
  readonly item: PayrollItem;
  readonly staff: StaffMember;
  readonly churchName?: string;
  readonly branchName?: string;
}): Payslip {
  const {
    payrollRun,
    item,
    staff,
    churchName = 'Accra Central Grace Chapel',
    branchName = 'Accra Main Branch',
  } = params;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[payrollRun.periodMonth - 1] || 'Month';
  const periodLabel = `${monthName} ${payrollRun.periodYear}`;

  const bankOrMomoDetails = staff.bankAccountNumber
    ? `${staff.bankName || 'Bank'} A/C ${staff.bankAccountNumber}`
    : staff.momoNumber
    ? `${staff.momoNetwork || 'MoMo'} ${staff.momoNumber}`
    : 'Cash Payment';

  const netSalaryFigures = `GHS ${(Number(item.netSalaryPesewas) / 100).toFixed(2)}`;
  const netSalaryInWords = numberToWordsGhs(item.netSalaryPesewas);

  return {
    payslipNumber: `PS-${item.staffNumber}-${payrollRun.payrollNumber}`,
    churchName,
    branchName,
    periodLabel,
    payDate: payrollRun.payDate,
    staffNumber: item.staffNumber,
    fullName: item.fullName,
    roleTitle: item.roleTitle,
    department: staff.department,
    ssnitNumber: staff.ssnitNumber,
    bankOrMomoDetails,
    basicSalaryPesewas: item.basicSalaryPesewas,
    housingAllowancePesewas: item.housingAllowancePesewas,
    transportAllowancePesewas: item.transportAllowancePesewas,
    pastoralResponsibilityPesewas: item.pastoralResponsibilityPesewas,
    grossSalaryPesewas: item.grossSalaryPesewas,
    ssnitEmployeePesewas: item.ssnitTier1EmployeePesewas,
    payeTaxPesewas: item.payeTaxPesewas,
    totalDeductionsPesewas: item.totalDeductionsPesewas,
    netSalaryPesewas: item.netSalaryPesewas,
    netSalaryFigures,
    netSalaryInWords,
  };
}
