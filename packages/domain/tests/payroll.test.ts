import { describe, it, expect } from 'vitest';
import type { StaffMember } from '../src/payroll/types.js';
import {
  calculateSsnitContributions,
  calculateGhanaPayeTax,
  calculatePayrollItem,
  createPayrollRun,
  generatePayrollJournalEntry,
  generateStaffPayslip,
} from '../src/payroll/index.js';
import { generateMemberGivingStatement } from '../src/giving/statements.js';
import type { Member, MemberGivingRecord, Pledge } from '../src/giving/types.js';

describe('Phase 7: Ghana Payroll Calculations', () => {
  it('calculates SSNIT Tier 1 contributions (5.5% employee, 13% employer) with Banker Rounding', () => {
    // Basic: GHS 2,000.00 (200,000 pesewas)
    // Employee 5.5%: 200,000 * 0.055 = 11,000 pesewas (GHS 110.00)
    // Employer 13%: 200,000 * 0.13 = 26,000 pesewas (GHS 260.00)
    const { employeeSsnitPesewas, employerSsnitPesewas } =
      calculateSsnitContributions(200000n);
    expect(employeeSsnitPesewas).toBe(11000n);
    expect(employerSsnitPesewas).toBe(26000n);
  });

  it('calculates Ghana GRA statutory PAYE income tax on graduated brackets', () => {
    // Below GHS 490.00 -> 0%
    expect(calculateGhanaPayeTax(40000n)).toBe(0n);
    expect(calculateGhanaPayeTax(49000n)).toBe(0n);

    // GHS 600.00: First 490 free, next 110 @ 5% = GHS 5.50 (550 pesewas)
    expect(calculateGhanaPayeTax(60000n)).toBe(550n);

    // GHS 730.00: First 490 free, next 110 @ 5% (5.50), next 130 @ 10% (13.00) = GHS 18.50 (1850 pesewas)
    expect(calculateGhanaPayeTax(73000n)).toBe(1850n);
  });

  it('calculates complete staff payroll item (basic, allowances, deductions, net pay)', () => {
    const pastor: StaffMember = {
      id: 'stf-001',
      branchId: 'b-01',
      staffNumber: 'STF-001',
      fullName: 'Rev. Emmanuel Appiah',
      roleTitle: 'Senior Pastor',
      department: 'Pastoral',
      employmentType: 'PASTORAL_CLERGY',
      basicSalaryPesewas: 500000n, // GHS 5,000.00
      housingAllowancePesewas: 150000n, // GHS 1,500.00
      transportAllowancePesewas: 100000n, // GHS 1,000.00
      pastoralResponsibilityPesewas: 50000n, // GHS 500.00
      bankName: 'GCB Bank',
      bankAccountNumber: '101112223344',
      isActive: true,
    };

    const item = calculatePayrollItem(pastor);
    // Gross: 5000 + 1500 + 1000 + 500 = GHS 8,000.00 (800,000 pesewas)
    expect(item.grossSalaryPesewas).toBe(800000n);

    // SSNIT Employee: 5.5% of 5,000 = GHS 275.00 (27,500 pesewas)
    expect(item.ssnitTier1EmployeePesewas).toBe(27500n);

    // Employer SSNIT: 13% of 5,000 = GHS 650.00 (65,000 pesewas)
    expect(item.ssnitTier1EmployerPesewas).toBe(65000n);

    // Net = Gross - (SSNIT + PAYE)
    expect(item.netSalaryPesewas).toBe(item.grossSalaryPesewas - item.totalDeductionsPesewas);
    expect(item.netSalaryPesewas).toBeGreaterThan(0n);
    expect(item.paymentMethod).toBe('BANK');
  });

  it('creates full monthly payroll run and generates balanced double-entry journal entry', () => {
    const staffList: StaffMember[] = [
      {
        id: 'stf-001',
        branchId: 'b-01',
        staffNumber: 'STF-001',
        fullName: 'Rev. Emmanuel Appiah',
        roleTitle: 'Senior Pastor',
        department: 'Pastoral',
        employmentType: 'PASTORAL_CLERGY',
        basicSalaryPesewas: 400000n, // GHS 4,000
        housingAllowancePesewas: 100000n, // GHS 1,000
        transportAllowancePesewas: 50000n, // GHS 500
        pastoralResponsibilityPesewas: 0n,
        bankName: 'GCB Bank',
        bankAccountNumber: '101112223344',
        isActive: true,
      },
      {
        id: 'stf-002',
        branchId: 'b-01',
        staffNumber: 'STF-002',
        fullName: 'Kwame Agyeman',
        roleTitle: 'Church Administrator',
        department: 'Administration',
        employmentType: 'FULL_TIME_STAFF',
        basicSalaryPesewas: 250000n, // GHS 2,500
        housingAllowancePesewas: 0n,
        transportAllowancePesewas: 30000n, // GHS 300
        pastoralResponsibilityPesewas: 0n,
        momoNetwork: 'MTN',
        momoNumber: '0244123456',
        isActive: true,
      },
    ];

    const run = createPayrollRun({
      id: 'pr-2026-10',
      branchId: 'b-01',
      payrollNumber: 'PR-2026-10',
      periodMonth: 10,
      periodYear: 2026,
      payDate: '2026-10-28',
      fundId: 'fund-gen',
      expenseAccountId: 'acct-5010',
      bankAccountId: 'acct-1030',
      staff: staffList,
      authorizedBy: 'Elder Kofi Mensah (Treasurer)',
    });

    expect(run.status).toBe('APPROVED');
    expect(run.items.length).toBe(2);
    // Basic: 4,000 + 2,500 = GHS 6,500.00 (650,000 pesewas)
    expect(run.totalBasicPesewas).toBe(650000n);
    // Allowances: 1,500 + 300 = GHS 1,800.00 (180,000 pesewas)
    expect(run.totalAllowancesPesewas).toBe(180000n);
    // Gross: 6,500 + 1,800 = GHS 8,300.00 (830,000 pesewas)
    expect(run.totalGrossPesewas).toBe(830000n);

    // Double-Entry Journal Entry Generation
    const je = generatePayrollJournalEntry({
      payrollRun: run,
      journalEntryId: 'je-pr-001',
      documentNumber: 'PV-PAY-2026-10',
      deviceId: 'DEV-TR-01',
      createdBy: 'usr-001',
    });

    // Debits strictly equal Credits in base GHS
    expect(je.totalDebitGhs).toBe(je.totalCreditGhs);
    expect(je.lines[0]!.accountId).toBe('acct-5010'); // Debit Salaries
    expect(je.lines[1]!.accountId).toBe('acct-1030'); // Credit Bank Net
  });

  it('generates an official payslip with Net Salary in words', () => {
    const staff: StaffMember = {
      id: 'stf-002',
      branchId: 'b-01',
      staffNumber: 'STF-002',
      fullName: 'Kwame Agyeman',
      roleTitle: 'Church Administrator',
      department: 'Administration',
      employmentType: 'FULL_TIME_STAFF',
      basicSalaryPesewas: 200000n, // GHS 2,000.00
      housingAllowancePesewas: 0n,
      transportAllowancePesewas: 0n,
      pastoralResponsibilityPesewas: 0n,
      momoNetwork: 'MTN',
      momoNumber: '0244123456',
      isActive: true,
    };

    const run = createPayrollRun({
      id: 'pr-2026-10',
      branchId: 'b-01',
      payrollNumber: 'PR-2026-10',
      periodMonth: 10,
      periodYear: 2026,
      payDate: '2026-10-28',
      fundId: 'fund-gen',
      expenseAccountId: 'acct-5010',
      bankAccountId: 'acct-1030',
      staff: [staff],
    });

    const payslip = generateStaffPayslip({
      payrollRun: run,
      item: run.items[0]!,
      staff,
    });

    expect(payslip.fullName).toBe('Kwame Agyeman');
    expect(payslip.periodLabel).toBe('October 2026');
    expect(payslip.bankOrMomoDetails).toContain('MTN 0244123456');
    expect(payslip.netSalaryFigures).toContain('GHS');
    expect(payslip.netSalaryInWords).toContain('Ghana Cedis');
  });

  it('generates Member Giving Statement with legal tender phrasing and pledge progress', () => {
    const member: Member = {
      id: 'mem-001',
      branchId: 'b-01',
      memberNumber: 'MEM-001',
      envelopeNumber: 'ENV-012',
      fullName: 'Sister Grace Addo',
      status: 'ACTIVE',
      rowVersion: 1,
    };

    const records: MemberGivingRecord[] = [
      {
        id: 'rec-01',
        branchId: 'b-01',
        memberId: 'mem-001',
        memberName: 'Sister Grace Addo',
        serviceDate: '2026-10-05',
        fundId: 'fund-gen',
        fundName: 'General Fund',
        category: 'Tithe',
        paymentMethod: 'CASH',
        currency: 'GHS',
        amountPesewas: 50000n, // GHS 500.00
        receiptNumber: 'REC-001',
        createdAt: '2026-10-05T12:00:00Z',
      },
      {
        id: 'rec-02',
        branchId: 'b-01',
        memberId: 'mem-001',
        memberName: 'Sister Grace Addo',
        serviceDate: '2026-10-12',
        fundId: 'fund-bld',
        fundName: 'Building Fund',
        category: 'Building Pledge',
        paymentMethod: 'MOMO',
        currency: 'GHS',
        amountPesewas: 100000n, // GHS 1,000.00
        receiptNumber: 'REC-002',
        createdAt: '2026-10-12T12:00:00Z',
      },
    ];

    const pledges: Pledge[] = [
      {
        id: 'plg-01',
        branchId: 'b-01',
        memberId: 'mem-001',
        memberName: 'Sister Grace Addo',
        fundId: 'fund-bld',
        fundName: 'Building Fund',
        campaignName: 'Auditorium Expansion Project 2026',
        pledgeDate: '2026-01-10',
        currency: 'GHS',
        targetAmountPesewas: 500000n, // GHS 5,000.00
        paidAmountPesewas: 200000n,   // GHS 2,000.00
        status: 'ACTIVE',
      },
    ];

    // As Treasurer: unmasked details
    const stmt = generateMemberGivingStatement({
      member,
      records,
      pledges,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      requestingRole: 'Treasurer',
    });

    expect(stmt.memberName).toBe('Sister Grace Addo');
    // Total contributed: 500 + 1,000 = GHS 1,500.00 (150,000 pesewas)
    expect(stmt.totalContributedPesewas).toBe(150000n);
    expect(stmt.totalContributedFigures).toBe('GHS 1500.00');
    expect(stmt.totalContributedWords).toBe('One Thousand Five Hundred Ghana Cedis Only');
    expect(stmt.lines.length).toBe(2);
    expect(stmt.pledgeCampaigns.length).toBe(1);
    expect(stmt.pledgeCampaigns[0]!.outstandingPesewas).toBe(300000n); // 5k - 2k = 3k
    expect(stmt.officialGratitudeText).toContain('grateful');

    // As Counter: masked details
    const maskedStmt = generateMemberGivingStatement({
      member,
      records,
      pledges,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      requestingRole: 'Counter',
    });
    expect(maskedStmt.memberName).toBe('•••••••••••• (Confidential)');
    expect(maskedStmt.memberNumber).toBeUndefined();
  });
});
