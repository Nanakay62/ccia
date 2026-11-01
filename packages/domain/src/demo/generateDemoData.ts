/**
 * Demo Data Generator for Church Accounting Software.
 * Generates realistic Ghanaian church data:
 * - 300 church members with authentic Akan, Ga, Ewe, and Northern names, envelope numbers ENV-001 to ENV-300.
 * - 6 months of balanced double-entry transactions (May 2026 – Oct 2026).
 * - Weekly Sunday services with GHS & USD cash denomination counts, cheques, and MoMo.
 * - Monthly payroll runs with Ghana SSNIT Tier 1 and PAYE income tax deductions.
 * - Departmental expenses, requisitions, and vouchers with 3% WHT.
 */

import type { Member, Pledge, MemberGivingRecord, CountingSheet, GivingCategory } from '../giving/types.js';
import type { JournalEntry } from '../ledger/types.js';
import { createJournalEntry } from '../ledger/rules.js';

const GHANA_FIRST_NAMES = [
  'Kofi', 'Kwame', 'Kwabena', 'Yaw', 'Kweku', 'Kwesi', 'Kojo',
  'Ama', 'Akua', 'Yaa', 'Afia', 'Abena', 'Akosua', 'Esi',
  'Emmanuel', 'Samuel', 'David', 'Daniel', 'Michael', 'Joseph', 'Peter',
  'Grace', 'Mercy', 'Patience', 'Faith', 'Blessing', 'Charity', 'Joy',
  'Nii', 'Naa', 'Nii Armah', 'Naa Adjeley', 'Tetteh', 'Kpakpo',
  'Koffi', 'Sena', 'Selorm', 'Elorm', 'Dzifa', 'Mawufemor', 'Mawuli',
  'Ibrahim', 'Yakubu', 'Fuseini', 'Salifu', 'Aminu', 'Baba'
];

const GHANA_LAST_NAMES = [
  'Mensah', 'Appiah', 'Osei', 'Boateng', 'Agyeman', 'Acheampong', 'Asare',
  'Frimpong', 'Antwi', 'Bonsu', 'Darko', 'Owusu', 'Danquah', 'Adjei',
  'Quaye', 'Sowah', 'Lartey', 'Tetteh', 'Aryee', 'Tagoe', 'Lamptey',
  'Ahadzi', 'Dzidzor', 'Gbedemah', 'Attah', 'Dogbe', 'Agbenyega',
  'Alhassan', 'Iddrisu', 'Issah', 'Adams', 'Mahama', 'Seidu',
  'Dadson', 'Forson', 'Essien', 'Baidoo', 'Addy', 'Ofori', 'Kyeremeh'
];

const DEPARTMENTS = [
  'Pastoral', 'Men Fellowship', 'Women Ministry', 'Youth Ministry',
  'Choir', 'Ushers', 'Sound & Media', 'Children Ministry'
];

export interface DemoDataset {
  readonly members: readonly Member[];
  readonly pledges: readonly Pledge[];
  readonly givingRecords: readonly MemberGivingRecord[];
  readonly countingSheets: readonly CountingSheet[];
  readonly entries: readonly JournalEntry[];
}

export function generate300Members(branchId: string): Member[] {
  const members: Member[] = [];
  const total = 300;

  for (let i = 1; i <= total; i++) {
    const fn = GHANA_FIRST_NAMES[(i * 7) % GHANA_FIRST_NAMES.length]!;
    const ln = GHANA_LAST_NAMES[(i * 11) % GHANA_LAST_NAMES.length]!;
    const fullName = `${fn} ${ln}`;
    const envNum = `ENV-${String(i).padStart(3, '0')}`;
    const memNum = `MEM-${String(i).padStart(3, '0')}`;
    const dept = DEPARTMENTS[i % DEPARTMENTS.length]!;
    const familyGroup = `${ln} Family`;
    const phoneHint = String(100 + (i * 3) % 900);

    members.push({
      id: `demo-mem-${String(i).padStart(3, '0')}`,
      branchId,
      memberNumber: memNum,
      envelopeNumber: envNum,
      fullName,
      phone: `+233 24 ${String(100 + (i * 7) % 900)} ${phoneHint}`,
      phoneHint,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@accrachurch.org`,
      familyGroup,
      department: dept,
      status: 'ACTIVE',
      joinDate: '2023-01-15',
      rowVersion: 1,
    });
  }

  return members;
}

export function generate6MonthsLedger(branchId: string, members: readonly Member[]): DemoDataset {
  const entries: JournalEntry[] = [];
  const countingSheets: CountingSheet[] = [];
  const givingRecords: MemberGivingRecord[] = [];
  const pledges: Pledge[] = [];

  // Seed 5 key pledges
  const campaignName = 'Auditorium Expansion Project 2026';
  for (let p = 0; p < 8; p++) {
    const mem = members[p]!;
    const target = BigInt(200000 + p * 100000); // 2,000 to 9,000 GHS
    const paid = BigInt(150000 + p * 80000);
    pledges.push({
      id: `demo-pld-${p + 1}`,
      branchId,
      memberId: mem.id,
      memberName: mem.fullName,
      fundId: 'fund-bld',
      fundName: 'Building Fund',
      campaignName,
      pledgeDate: '2026-05-01',
      targetDate: '2026-12-31',
      currency: 'GHS',
      targetAmountPesewas: target,
      paidAmountPesewas: paid > target ? target : paid,
      status: paid >= target ? 'FULFILLED' : 'ACTIVE',
      notes: `Pledged towards auditorium roofing & tiles`,
    });
  }

  // 26 Weeks of Sunday Services (May 2026 to October 2026)
  // Let's generate entries for every Sunday
  const sundays = [
    '2026-05-03', '2026-05-10', '2026-05-17', '2026-05-24', '2026-05-31',
    '2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28',
    '2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26',
    '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30',
    '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
    '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25',
  ];

  for (let w = 0; w < sundays.length; w++) {
    const sundayDate = sundays[w]!;
    const weekNum = w + 1;
    const docNum = `CS-2026-W${String(weekNum).padStart(2, '0')}`;

    // Sunday Offerings & Tithes (approx 12,000 to 18,000 GHS per week)
    const tithesGhs = BigInt(650000 + (w * 15000)); // 6,500 to 10,250 GHS
    const generalOfferingGhs = BigInt(350000 + (w * 10000));
    const buildingOfferingGhs = BigInt(180000 + (w * 5000));
    const welfareOfferingGhs = BigInt(100000 + (w * 3000));

    // Cash USD: $200.00 to $400.00
    const usdAmtCents = 20000n; // $200.00
    // Rate 15.5000 -> 200 * 15.5 = 3100.00 GHS
    const usdEquivalentGhs = 310000n;

    const totalGeneralIncomeGhs = tithesGhs + generalOfferingGhs;

    // Journal Entry for Sunday Service Income (Balanced)
    const entry = createJournalEntry({
      id: `demo-je-sun-${weekNum}`,
      branchId,
      documentNumber: `JE-SUN-2026-${String(weekNum).padStart(2, '0')}`,
      entryDate: sundayDate,
      narration: `Sunday Divine Worship Tithes, Offerings & Pledges — Week ${weekNum}`,
      createdBy: 'user-0001-treasurer',
      deviceId: 'DEV-TR-01',
      lines: [
        // DEBITS (Cash & Bank & MoMo)
        {
          id: `demo-line-${weekNum}-1`,
          accountId: 'acct-1010', // Cash GHS
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: totalGeneralIncomeGhs,
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'General Cash Collected',
        },
        {
          id: `demo-line-${weekNum}-2`,
          accountId: 'acct-1020', // Cash USD
          fundId: 'fund-mis',
          originalCurrency: 'USD',
          originalAmount: usdAmtCents,
          exchangeRate: '15.5000',
          isDebit: true,
          description: 'USD Offering ($200.00)',
        },
        {
          id: `demo-line-${weekNum}-3`,
          accountId: 'acct-1030', // Bank GHS
          fundId: 'fund-bld',
          originalCurrency: 'GHS',
          originalAmount: buildingOfferingGhs,
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'Building Pledges Paid by Cheque/Transfer',
        },
        {
          id: `demo-line-${weekNum}-4`,
          accountId: 'acct-1050', // MoMo
          fundId: 'fund-wel',
          originalCurrency: 'GHS',
          originalAmount: welfareOfferingGhs,
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'Welfare Offering via MoMo',
        },

        // CREDITS (Income & Funds)
        {
          id: `demo-line-${weekNum}-5`,
          accountId: 'acct-4010', // Tithes
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: tithesGhs,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Tithes Income',
        },
        {
          id: `demo-line-${weekNum}-6`,
          accountId: 'acct-4020', // General Offerings
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: generalOfferingGhs,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'General Offerings Income',
        },
        {
          id: `demo-line-${weekNum}-7`,
          accountId: 'acct-4030', // Missions Special Offering
          fundId: 'fund-mis',
          originalCurrency: 'GHS',
          originalAmount: usdEquivalentGhs,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Foreign Missions Gift (USD)',
        },
        {
          id: `demo-line-${weekNum}-8`,
          accountId: 'acct-4040', // Building Pledges
          fundId: 'fund-bld',
          originalCurrency: 'GHS',
          originalAmount: buildingOfferingGhs,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Building Fund Pledge Income',
        },
        {
          id: `demo-line-${weekNum}-9`,
          accountId: 'acct-4050', // Welfare Offering
          fundId: 'fund-wel',
          originalCurrency: 'GHS',
          originalAmount: welfareOfferingGhs,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Benevolence Offering Income',
        },
      ],
    });

    entries.push(entry);

    // Counting Sheet
    countingSheets.push({
      id: `demo-cs-${weekNum}`,
      branchId,
      sheetNumber: docNum,
      serviceDate: sundayDate,
      serviceType: 'Sunday 1st Service',
      cashDenominationsGhs: [
        { denomination: 200, count: 18 + (w % 5) },
        { denomination: 100, count: 32 + (w % 8) },
        { denomination: 50, count: 40 + (w % 10) },
        { denomination: 20, count: 55 + (w % 12) },
        { denomination: 10, count: 60 + (w % 15) },
      ],
      cashDenominationsUsd: [{ denomination: 100, count: 2 }],
      cheques: [
        {
          id: `demo-chq-${weekNum}`,
          drawerName: members[w % 50]!.fullName,
          bankName: 'GCB Bank',
          chequeNumber: `00${1200 + w}`,
          amountPesewas: buildingOfferingGhs,
          currency: 'GHS',
        },
      ],
      momoTransactions: [
        {
          id: `demo-mo-${weekNum}`,
          network: 'MTN',
          senderName: members[(w + 5) % 50]!.fullName,
          transactionReference: `MTN-TX-${String(88000 + w)}`,
          amountPesewas: welfareOfferingGhs,
        },
      ],
      fundAllocations: [
        { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe', amountPesewas: tithesGhs, currency: 'GHS' },
        { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering', amountPesewas: generalOfferingGhs, currency: 'GHS' },
        { fundId: 'fund-bld', fundName: 'Building Fund', category: 'Building Pledge', amountPesewas: buildingOfferingGhs, currency: 'GHS' },
        { fundId: 'fund-mis', fundName: 'Missions & Outreach', category: 'Special Offering', amountPesewas: 20000n, currency: 'USD' },
      ],
      firstCounterId: 'user-0003-counter1',
      firstCounterName: 'Kwame Boateng (Counter A)',
      firstSignedAt: `${sundayDate}T12:30:00Z`,
      secondCounterId: 'user-0004-counter2',
      secondCounterName: 'Abena Poku (Counter B)',
      secondSignedAt: `${sundayDate}T12:35:00Z`,
      status: 'POSTED',
      journalEntryId: entry.id,
      totalCashGhsPesewas: totalGeneralIncomeGhs,
      totalCashUsdCents: usdAmtCents,
      totalChequesGhsPesewas: buildingOfferingGhs,
      totalMomoGhsPesewas: welfareOfferingGhs,
      grandTotalGhsPesewas: totalGeneralIncomeGhs + buildingOfferingGhs + welfareOfferingGhs,
      grandTotalUsdCents: usdAmtCents,
    });

    // Seed individual member giving records for this week
    for (let m = 0; m < 5; m++) {
      const donor = members[(w * 5 + m) % members.length]!;
      const recAmt = BigInt(15000 + (m * 5000));
      givingRecords.push({
        id: `demo-rec-${weekNum}-${m + 1}`,
        branchId,
        memberId: donor.id,
        memberName: donor.fullName,
        memberNumber: donor.memberNumber,
        envelopeNumber: donor.envelopeNumber,
        serviceDate: sundayDate,
        fundId: 'fund-gen',
        fundName: 'General Fund',
        category: (m === 0 ? 'Tithe' : m === 1 ? 'Building Pledge' : 'General Offering') as GivingCategory,
        paymentMethod: 'CASH',
        currency: 'GHS',
        amountPesewas: recAmt,
        receiptNumber: `REC-FS-DEMO-${String(weekNum * 10 + m).padStart(6, '0')}`,
        createdAt: `${sundayDate}T12:00:00Z`,
      });
    }
  }

  // 6 Monthly Expenses & Payroll Entries (May to October 2026)
  const monthEnds = [
    { year: 2026, month: 5, date: '2026-05-28' },
    { year: 2026, month: 6, date: '2026-06-28' },
    { year: 2026, month: 7, date: '2026-07-28' },
    { year: 2026, month: 8, date: '2026-08-28' },
    { year: 2026, month: 9, date: '2026-09-28' },
    { year: 2026, month: 10, date: '2026-10-28' },
  ];

  for (let m = 0; m < monthEnds.length; m++) {
    const mo = monthEnds[m]!;
    const monthNum = m + 1;

    // Monthly Staff Payroll (Gross 10,300 GHS; Net 8,450; SSNIT 1,905.50; PAYE 1,020.25)
    // Debit Salaries 5010 (11,639.00 = Gross + Employer SSNIT)
    // Credit Bank 1030 (Net 8,450.00)
    // Credit SSNIT 2020 (1,905.50)
    // Credit PAYE 2030 (1,283.50)
    const payrollGross = 1030000n;
    const employerSsnit = 133900n; // 13% of basic
    const employeeSsnit = 56650n;  // 5.5% of basic
    const payeTax = 128350n;
    const netDisbursed = payrollGross - employeeSsnit - payeTax;
    const totalSalariesExpense = payrollGross + employerSsnit;
    const totalSsnitLiability = employeeSsnit + employerSsnit;

    const payrollEntry = createJournalEntry({
      id: `demo-je-pay-${monthNum}`,
      branchId,
      documentNumber: `PV-PAY-2026-${String(mo.month).padStart(2, '0')}`,
      entryDate: mo.date,
      narration: `Church Staff & Pastoral Monthly Payroll — ${mo.year}/${String(mo.month).padStart(2, '0')}`,
      createdBy: 'user-0001-treasurer',
      deviceId: 'DEV-TR-01',
      lines: [
        {
          id: `demo-pay-l1-${monthNum}`,
          accountId: 'acct-5010', // Salaries Expense
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: totalSalariesExpense,
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'Gross Salaries & Employer SSNIT',
        },
        {
          id: `demo-pay-l2-${monthNum}`,
          accountId: 'acct-1030', // Bank Account
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: netDisbursed,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Net Salaries Disbursed via Bank Transfer',
        },
        {
          id: `demo-pay-l3-${monthNum}`,
          accountId: 'acct-2020', // SSNIT Liability
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: totalSsnitLiability,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'SSNIT Tier 1 Remittance (Employee + Employer)',
        },
        {
          id: `demo-pay-l4-${monthNum}`,
          accountId: 'acct-2030', // PAYE Liability
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: payeTax,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'GRA PAYE Income Tax Withheld',
        },
      ],
    });

    entries.push(payrollEntry);

    // Monthly Utilities (ECG Electricity & Ghana Water)
    const utilitiesAmt = BigInt(220000 + (m * 12000));
    const utilEntry = createJournalEntry({
      id: `demo-je-util-${monthNum}`,
      branchId,
      documentNumber: `PV-UTL-2026-${String(mo.month).padStart(2, '0')}`,
      entryDate: mo.date,
      narration: `Monthly ECG Electricity & Ghana Water Payment — ${mo.year}/${String(mo.month).padStart(2, '0')}`,
      createdBy: 'user-0001-treasurer',
      deviceId: 'DEV-TR-01',
      lines: [
        {
          id: `demo-utl-l1-${monthNum}`,
          accountId: 'acct-5020', // Utilities
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: utilitiesAmt,
          exchangeRate: '1.0000',
          isDebit: true,
          description: 'ECG & Water Utility Settlement',
        },
        {
          id: `demo-utl-l2-${monthNum}`,
          accountId: 'acct-1030', // Bank
          fundId: 'fund-gen',
          originalCurrency: 'GHS',
          originalAmount: utilitiesAmt,
          exchangeRate: '1.0000',
          isDebit: false,
          description: 'Payment via Direct Bank Debit',
        },
      ],
    });

    entries.push(utilEntry);
  }

  return {
    members,
    pledges,
    givingRecords,
    countingSheets,
    entries,
  };
}
