import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  Member,
  Pledge,
  CountingSheet,
  SheetCounterSignOff,
  MemberGivingRecord,
  ServiceType,
  CashDenominationCount,
  ChequeRecord,
  MoMoRecord,
  FundAllocationLine,
} from '@church/domain';
import {
  calculateDenominationTotal,
  calculateChequeTotal,
  calculateMomoTotal,
  validateTwoCounterSignOff,
  generateJournalEntryFromCountingSheet,
  maskGivingRecordForRole,
  maskPledgeForRole,
  convertLineToBaseCurrency,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { useLedger } from './LedgerContext.js';
import { useSync } from './SyncContext.js';
import { useDemo } from './DemoContext.js';
import { loadFromStore, saveToStore } from '../utils/database.js';

export const SEED_MEMBERS: Member[] = [
  {
    id: 'mem-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-001',
    envelopeNumber: 'ENV-012',
    title: 'Elder',
    firstName: 'Kofi',
    lastName: 'Mensah',
    fullName: 'Kofi Mensah',
    phone: '+233 24 111 2222',
    phoneHint: '222',
    email: 'kofi.mensah@accrachurch.org',
    familyGroup: 'Mensah Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2022-01-15',
    rowVersion: 1,
  },
  {
    id: 'mem-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-002',
    envelopeNumber: 'ENV-019',
    title: 'Sister',
    firstName: 'Akua',
    lastName: 'Mansa',
    fullName: 'Akua Mansa',
    phone: '+233 20 333 4444',
    phoneHint: '444',
    email: 'akua.mansa@accrachurch.org',
    familyGroup: 'Mansa Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2021-06-10',
    rowVersion: 1,
  },
  {
    id: 'mem-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-003',
    envelopeNumber: 'ENV-045',
    title: 'Deacon',
    firstName: 'Kwabena',
    lastName: 'Acheampong',
    fullName: 'Kwabena Acheampong',
    phone: '+233 24 555 6666',
    phoneHint: '666',
    email: 'kwabena.ach@accrachurch.org',
    familyGroup: 'Acheampong Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2019-03-20',
    rowVersion: 1,
  },
  {
    id: 'mem-004',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-004',
    envelopeNumber: 'ENV-077',
    title: 'Sister',
    firstName: 'Efua',
    lastName: 'Dadson',
    fullName: 'Efua Dadson',
    phone: '+233 50 777 8888',
    phoneHint: '888',
    email: 'efua.dadson@accrachurch.org',
    familyGroup: 'Dadson Family',
    department: 'Choir',
    status: 'ACTIVE',
    joinDate: '2023-02-01',
    rowVersion: 1,
  },
  {
    id: 'mem-005',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-005',
    envelopeNumber: 'ENV-088',
    title: 'Brother',
    firstName: 'Emmanuel',
    lastName: 'Ofori',
    fullName: 'Emmanuel Ofori',
    phone: '+233 24 888 9999',
    phoneHint: '999',
    email: 'emmanuel.ofori@accrachurch.org',
    familyGroup: 'Ofori Family',
    department: 'Ushers',
    status: 'ACTIVE',
    joinDate: '2024-05-12',
    rowVersion: 1,
  },
  {
    id: 'mem-006',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-006',
    envelopeNumber: 'ENV-092',
    title: 'Sister',
    firstName: 'Akosua',
    lastName: 'Osei',
    fullName: 'Akosua Osei',
    phone: '+233 24 222 3311',
    phoneHint: '311',
    email: 'akosua.osei@accrachurch.org',
    familyGroup: 'Osei Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2020-04-10',
    rowVersion: 1,
  },
  {
    id: 'mem-007',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-007',
    envelopeNumber: 'ENV-103',
    title: 'Rev.',
    firstName: 'Emmanuel',
    lastName: 'Addo',
    fullName: 'Emmanuel Addo',
    phone: '+233 20 444 5522',
    phoneHint: '522',
    email: 'emmanuel.addo@accrachurch.org',
    familyGroup: 'Addo Family',
    department: 'Pastoral Council',
    status: 'ACTIVE',
    joinDate: '2018-01-01',
    rowVersion: 1,
  },
  {
    id: 'mem-008',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-008',
    envelopeNumber: 'ENV-115',
    title: 'Brother',
    firstName: 'Kwame',
    lastName: 'Boateng',
    fullName: 'Kwame Boateng',
    phone: '+233 54 111 8833',
    phoneHint: '833',
    email: 'kwame.boateng@accrachurch.org',
    familyGroup: 'Boateng Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2022-08-14',
    rowVersion: 1,
  },
  {
    id: 'mem-009',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-009',
    envelopeNumber: 'ENV-120',
    title: 'Sister',
    firstName: 'Abena',
    lastName: 'Poku',
    fullName: 'Abena Poku',
    phone: '+233 27 666 9944',
    phoneHint: '944',
    email: 'abena.poku@accrachurch.org',
    familyGroup: 'Poku Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2021-11-20',
    rowVersion: 1,
  },
  {
    id: 'mem-010',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-010',
    envelopeNumber: 'ENV-134',
    title: 'Brother',
    firstName: 'Justice',
    lastName: 'Appiah',
    fullName: 'Justice Appiah',
    phone: '+233 24 777 0055',
    phoneHint: '055',
    email: 'justice.appiah@accrachurch.org',
    familyGroup: 'Appiah Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2019-07-05',
    rowVersion: 1,
  },
  {
    id: 'mem-011',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-011',
    envelopeNumber: 'ENV-142',
    title: 'Brother',
    firstName: 'Yaw',
    lastName: 'Kwarteng',
    fullName: 'Yaw Kwarteng',
    phone: '+233 50 888 1166',
    phoneHint: '166',
    email: 'yaw.kwarteng@accrachurch.org',
    familyGroup: 'Kwarteng Family',
    department: 'Youth',
    status: 'ACTIVE',
    joinDate: '2023-09-01',
    rowVersion: 1,
  },
  {
    id: 'mem-012',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-012',
    envelopeNumber: 'ENV-156',
    title: 'Deaconess',
    firstName: 'Grace',
    lastName: 'Darko',
    fullName: 'Grace Darko',
    phone: '+233 24 999 2277',
    phoneHint: '277',
    email: 'grace.darko@accrachurch.org',
    familyGroup: 'Darko Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2018-11-15',
    rowVersion: 1,
  },
  {
    id: 'mem-013',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-013',
    envelopeNumber: 'ENV-161',
    title: 'Sister',
    firstName: 'Naomi',
    lastName: 'Baah',
    fullName: 'Naomi Baah',
    phone: '+233 20 123 4588',
    phoneHint: '588',
    email: 'naomi.baah@accrachurch.org',
    familyGroup: 'Baah Family',
    department: 'Choir',
    status: 'ACTIVE',
    joinDate: '2022-03-12',
    rowVersion: 1,
  },
  {
    id: 'mem-014',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-014',
    envelopeNumber: 'ENV-175',
    title: 'Brother',
    firstName: 'Samuel',
    lastName: 'Ansah',
    fullName: 'Samuel Ansah',
    phone: '+233 54 234 5699',
    phoneHint: '699',
    email: 'samuel.ansah@accrachurch.org',
    familyGroup: 'Ansah Family',
    department: 'Media & IT',
    status: 'ACTIVE',
    joinDate: '2024-01-10',
    rowVersion: 1,
  },
  {
    id: 'mem-015',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-015',
    envelopeNumber: 'ENV-183',
    title: 'Deacon',
    firstName: 'Isaac',
    lastName: 'Quaye',
    fullName: 'Isaac Quaye',
    phone: '+233 24 345 6700',
    phoneHint: '700',
    email: 'isaac.quaye@accrachurch.org',
    familyGroup: 'Quaye Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2020-02-18',
    rowVersion: 1,
  },
  {
    id: 'mem-016',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-016',
    envelopeNumber: 'ENV-199',
    title: 'Sister',
    firstName: 'Mary',
    lastName: 'Osei',
    fullName: 'Mary Osei',
    phone: '+233 27 456 7811',
    phoneHint: '811',
    email: 'mary.osei@accrachurch.org',
    familyGroup: 'Osei Family',
    department: 'Children Ministry',
    status: 'ACTIVE',
    joinDate: '2021-05-22',
    rowVersion: 1,
  },
  {
    id: 'mem-017',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-017',
    envelopeNumber: 'ENV-204',
    title: 'Brother',
    firstName: 'Peter',
    lastName: 'Mensah',
    fullName: 'Peter Mensah',
    phone: '+233 50 567 8922',
    phoneHint: '922',
    email: 'peter.mensah@accrachurch.org',
    familyGroup: 'Mensah Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2023-04-17',
    rowVersion: 1,
  },
  {
    id: 'mem-018',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-018',
    envelopeNumber: 'ENV-218',
    title: 'Dr.',
    firstName: 'Kwesi',
    lastName: 'Arthur',
    fullName: 'Kwesi Arthur',
    phone: '+233 24 678 9033',
    phoneHint: '033',
    email: 'kwesi.arthur@accrachurch.org',
    familyGroup: 'Arthur Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2019-10-30',
    rowVersion: 1,
  },
  {
    id: 'mem-019',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-019',
    envelopeNumber: 'ENV-225',
    title: 'Sister',
    firstName: 'Mercy',
    lastName: 'Agyemang',
    fullName: 'Mercy Agyemang',
    phone: '+233 20 789 0144',
    phoneHint: '144',
    email: 'mercy.agyemang@accrachurch.org',
    familyGroup: 'Agyemang Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2022-07-09',
    rowVersion: 1,
  },
  {
    id: 'mem-020',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-020',
    envelopeNumber: 'ENV-233',
    title: 'Brother',
    firstName: 'Francis',
    lastName: 'Donkor',
    fullName: 'Francis Donkor',
    phone: '+233 54 890 1255',
    phoneHint: '255',
    email: 'francis.donkor@accrachurch.org',
    familyGroup: 'Donkor Family',
    department: 'Ushers',
    status: 'ACTIVE',
    joinDate: '2024-02-14',
    rowVersion: 1,
  },
  {
    id: 'mem-021',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-021',
    envelopeNumber: 'ENV-247',
    title: 'Sister',
    firstName: 'Joyce',
    lastName: 'Frimpong',
    fullName: 'Joyce Frimpong',
    phone: '+233 24 901 2366',
    phoneHint: '366',
    email: 'joyce.frimpong@accrachurch.org',
    familyGroup: 'Frimpong Family',
    department: 'Choir',
    status: 'INACTIVE',
    joinDate: '2021-08-19',
    rowVersion: 1,
  },
  {
    id: 'mem-022',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-022',
    envelopeNumber: 'ENV-252',
    title: 'Brother',
    firstName: 'Joseph',
    lastName: 'Gyasi',
    fullName: 'Joseph Gyasi',
    phone: '+233 27 012 3477',
    phoneHint: '477',
    email: 'joseph.gyasi@accrachurch.org',
    familyGroup: 'Gyasi Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2023-03-25',
    rowVersion: 1,
  },
  {
    id: 'mem-023',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-023',
    envelopeNumber: 'ENV-268',
    title: 'Deaconess',
    firstName: 'Comfort',
    lastName: 'Hayford',
    fullName: 'Comfort Hayford',
    phone: '+233 50 123 4588',
    phoneHint: '588',
    email: 'comfort.hayford@accrachurch.org',
    familyGroup: 'Hayford Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2019-12-05',
    rowVersion: 1,
  },
  {
    id: 'mem-024',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-024',
    envelopeNumber: 'ENV-275',
    title: 'Brother',
    firstName: 'Daniel',
    lastName: 'Koranteng',
    fullName: 'Daniel Koranteng',
    phone: '+233 24 234 5699',
    phoneHint: '699',
    email: 'daniel.koranteng@accrachurch.org',
    familyGroup: 'Koranteng Family',
    department: 'Youth',
    status: 'ACTIVE',
    joinDate: '2024-06-01',
    rowVersion: 1,
  },
  {
    id: 'mem-025',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-025',
    envelopeNumber: 'ENV-281',
    title: 'Sister',
    firstName: 'Victoria',
    lastName: 'Lamptey',
    fullName: 'Victoria Lamptey',
    phone: '+233 20 345 6700',
    phoneHint: '700',
    email: 'victoria.lamptey@accrachurch.org',
    familyGroup: 'Lamptey Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2020-09-14',
    rowVersion: 1,
  },
  {
    id: 'mem-026',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-026',
    envelopeNumber: 'ENV-294',
    title: 'Brother',
    firstName: 'Benjamin',
    lastName: 'Mills',
    fullName: 'Benjamin Mills',
    phone: '+233 54 456 7811',
    phoneHint: '811',
    email: 'benjamin.mills@accrachurch.org',
    familyGroup: 'Mills Family',
    department: 'Media & IT',
    status: 'ACTIVE',
    joinDate: '2023-11-11',
    rowVersion: 1,
  },
  {
    id: 'mem-027',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-027',
    envelopeNumber: 'ENV-306',
    title: 'Sister',
    firstName: 'Beatrice',
    lastName: 'Nortey',
    fullName: 'Beatrice Nortey',
    phone: '+233 24 567 8922',
    phoneHint: '922',
    email: 'beatrice.nortey@accrachurch.org',
    familyGroup: 'Nortey Family',
    department: 'Children Ministry',
    status: 'ACTIVE',
    joinDate: '2022-10-04',
    rowVersion: 1,
  },
  {
    id: 'mem-028',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-028',
    envelopeNumber: 'ENV-312',
    title: 'Elder',
    firstName: 'Seth',
    lastName: 'Owusu',
    fullName: 'Seth Owusu',
    phone: '+233 27 678 9033',
    phoneHint: '033',
    email: 'seth.owusu@accrachurch.org',
    familyGroup: 'Owusu Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2017-06-20',
    rowVersion: 1,
  },
  {
    id: 'mem-029',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-029',
    envelopeNumber: 'ENV-329',
    title: 'Sister',
    firstName: 'Theresa',
    lastName: 'Quansah',
    fullName: 'Theresa Quansah',
    phone: '+233 50 789 0144',
    phoneHint: '144',
    email: 'theresa.quansah@accrachurch.org',
    familyGroup: 'Quansah Family',
    department: 'Women Ministry',
    status: 'TRANSFERRED',
    joinDate: '2021-01-18',
    rowVersion: 1,
  },
  {
    id: 'mem-030',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-030',
    envelopeNumber: 'ENV-335',
    title: 'Brother',
    firstName: 'David',
    lastName: 'Sackey',
    fullName: 'David Sackey',
    phone: '+233 24 890 1255',
    phoneHint: '255',
    email: 'david.sackey@accrachurch.org',
    familyGroup: 'Sackey Family',
    department: 'Choir',
    status: 'ACTIVE',
    joinDate: '2023-05-30',
    rowVersion: 1,
  },
  {
    id: 'mem-031',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-031',
    envelopeNumber: 'ENV-348',
    title: 'Sister',
    firstName: 'Rita',
    lastName: 'Tagoe',
    fullName: 'Rita Tagoe',
    phone: '+233 20 901 2366',
    phoneHint: '366',
    email: 'rita.tagoe@accrachurch.org',
    familyGroup: 'Tagoe Family',
    department: 'Ushers',
    status: 'ACTIVE',
    joinDate: '2024-03-08',
    rowVersion: 1,
  },
  {
    id: 'mem-032',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-032',
    envelopeNumber: 'ENV-354',
    title: 'Brother',
    firstName: 'Gideon',
    lastName: 'Tetteh',
    fullName: 'Gideon Tetteh',
    phone: '+233 54 012 3477',
    phoneHint: '477',
    email: 'gideon.tetteh@accrachurch.org',
    familyGroup: 'Tetteh Family',
    department: 'Youth',
    status: 'ACTIVE',
    joinDate: '2022-12-15',
    rowVersion: 1,
  },
  {
    id: 'mem-033',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-033',
    envelopeNumber: 'ENV-367',
    title: 'Deacon',
    firstName: 'Solomon',
    lastName: 'Yeboah',
    fullName: 'Solomon Yeboah',
    phone: '+233 24 123 4588',
    phoneHint: '588',
    email: 'solomon.yeboah@accrachurch.org',
    familyGroup: 'Yeboah Family',
    department: 'Deacon Board',
    status: 'ACTIVE',
    joinDate: '2019-04-12',
    rowVersion: 1,
  },
  {
    id: 'mem-034',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-034',
    envelopeNumber: 'ENV-372',
    title: 'Sister',
    firstName: 'Priscilla',
    lastName: 'Ampofo',
    fullName: 'Priscilla Ampofo',
    phone: '+233 27 234 5699',
    phoneHint: '699',
    email: 'priscilla.ampofo@accrachurch.org',
    familyGroup: 'Ampofo Family',
    department: 'Choir',
    status: 'ACTIVE',
    joinDate: '2023-07-21',
    rowVersion: 1,
  },
  {
    id: 'mem-035',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-035',
    envelopeNumber: 'ENV-389',
    title: 'Brother',
    firstName: 'Charles',
    lastName: 'Boadi',
    fullName: 'Charles Boadi',
    phone: '+233 50 345 6700',
    phoneHint: '700',
    email: 'charles.boadi@accrachurch.org',
    familyGroup: 'Boadi Family',
    department: 'Men Fellowship',
    status: 'ACTIVE',
    joinDate: '2021-09-03',
    rowVersion: 1,
  },
  {
    id: 'mem-036',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-036',
    envelopeNumber: 'ENV-395',
    title: 'Sister',
    firstName: 'Evelyn',
    lastName: 'Cudjoe',
    fullName: 'Evelyn Cudjoe',
    phone: '+233 24 456 7811',
    phoneHint: '811',
    email: 'evelyn.cudjoe@accrachurch.org',
    familyGroup: 'Cudjoe Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2024-04-19',
    rowVersion: 1,
  },
  {
    id: 'mem-037',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-037',
    envelopeNumber: 'ENV-401',
    title: 'Brother',
    firstName: 'George',
    lastName: 'Dzamesi',
    fullName: 'George Dzamesi',
    phone: '+233 20 567 8922',
    phoneHint: '922',
    email: 'george.dzamesi@accrachurch.org',
    familyGroup: 'Dzamesi Family',
    department: 'Media & IT',
    status: 'ACTIVE',
    joinDate: '2023-08-10',
    rowVersion: 1,
  },
  {
    id: 'mem-038',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-038',
    envelopeNumber: 'ENV-418',
    title: 'Elder',
    firstName: 'Joshua',
    lastName: 'Essien',
    fullName: 'Joshua Essien',
    phone: '+233 54 678 9033',
    phoneHint: '033',
    email: 'joshua.essien@accrachurch.org',
    familyGroup: 'Essien Family',
    department: 'Men Fellowship',
    status: 'DECEASED',
    joinDate: '2016-02-11',
    rowVersion: 1,
  },
  {
    id: 'mem-039',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-039',
    envelopeNumber: 'ENV-426',
    title: 'Sister',
    firstName: 'Patience',
    lastName: 'Fianko',
    fullName: 'Patience Fianko',
    phone: '+233 24 789 0144',
    phoneHint: '144',
    email: 'patience.fianko@accrachurch.org',
    familyGroup: 'Fianko Family',
    department: 'Women Ministry',
    status: 'ACTIVE',
    joinDate: '2022-05-16',
    rowVersion: 1,
  },
  {
    id: 'mem-040',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberNumber: 'MEM-040',
    envelopeNumber: 'ENV-433',
    title: 'Brother',
    firstName: 'Stephen',
    lastName: 'Gyan',
    fullName: 'Stephen Gyan',
    phone: '+233 27 890 1255',
    phoneHint: '255',
    email: 'stephen.gyan@accrachurch.org',
    familyGroup: 'Gyan Family',
    department: 'Youth',
    status: 'ACTIVE',
    joinDate: '2024-07-02',
    rowVersion: 1,
  },
];

export function getMemberDisplayName(member?: { title?: string; fullName: string } | null): string {
  if (!member || !member.fullName) return '';
  if (member.title && !member.fullName.toLowerCase().startsWith(member.title.toLowerCase())) {
    return `${member.title} ${member.fullName}`;
  }
  return member.fullName;
}

export const SEED_PLEDGES: Pledge[] = [
  {
    id: 'pld-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-001',
    memberName: 'Kofi Mensah',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-08-01',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 500000n, // GHS 5,000.00
    paidAmountPesewas: 350000n, // GHS 3,500.00
    status: 'ACTIVE',
    notes: 'Pledged towards auditorium roofing tiles',
  },
  {
    id: 'pld-002',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-002',
    memberName: 'Akua Mansa',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-08-15',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 300000n, // GHS 3,000.00
    paidAmountPesewas: 300000n, // GHS 3,000.00
    status: 'FULFILLED',
    notes: 'Paid in 3 equal monthly installments',
  },
  {
    id: 'pld-003',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-003',
    memberName: 'Deacon Kwabena Acheampong',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    campaignName: 'Auditorium Expansion Project 2026',
    pledgeDate: '2026-09-01',
    targetDate: '2026-12-31',
    currency: 'GHS',
    targetAmountPesewas: 1000000n, // GHS 10,000.00
    paidAmountPesewas: 450000n, // GHS 4,500.00
    status: 'ACTIVE',
    notes: 'Supporting church soundproofing installation',
  },
];

export const SEED_GIVING_RECORDS: MemberGivingRecord[] = [
  {
    id: 'rec-101',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-001',
    memberName: 'Kofi Mensah',
    memberNumber: 'MEM-001',
    envelopeNumber: 'ENV-012',
    serviceDate: '2026-10-18',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    category: 'Tithe',
    paymentMethod: 'CASH',
    currency: 'GHS',
    amountPesewas: 120000n, // GHS 1,200.00
    receiptNumber: 'REC-FS-D01-000031',
    createdAt: '2026-10-18T12:30:00Z',
  },
  {
    id: 'rec-102',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-002',
    memberName: 'Akua Mansa',
    memberNumber: 'MEM-002',
    envelopeNumber: 'ENV-019',
    serviceDate: '2026-10-18',
    fundId: 'fund-bld',
    fundName: 'Building Fund',
    category: 'Building Pledge',
    paymentMethod: 'MOMO',
    currency: 'GHS',
    amountPesewas: 100000n, // GHS 1,000.00
    receiptNumber: 'REC-FS-D01-000032',
    createdAt: '2026-10-18T12:35:00Z',
  },
  {
    id: 'rec-103',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-003',
    memberName: 'Deacon Kwabena Acheampong',
    memberNumber: 'MEM-003',
    envelopeNumber: 'ENV-045',
    serviceDate: '2026-10-25',
    fundId: 'fund-gen',
    fundName: 'General Fund',
    category: 'Tithe',
    paymentMethod: 'CHEQUE',
    currency: 'GHS',
    amountPesewas: 250000n, // GHS 2,500.00
    receiptNumber: 'REC-FS-D01-000033',
    createdAt: '2026-10-25T11:45:00Z',
  },
  {
    id: 'rec-104',
    branchId: '00000000-0000-0000-0000-000000000001',
    memberId: 'mem-004',
    memberName: 'Sister Efua Dadson',
    memberNumber: 'MEM-004',
    envelopeNumber: 'ENV-077',
    serviceDate: '2026-10-25',
    fundId: 'fund-mis',
    fundName: 'Missions & Outreach',
    category: 'Special Offering',
    paymentMethod: 'CASH',
    currency: 'USD',
    amountPesewas: 10000n, // $100.00
    receiptNumber: 'REC-FS-D01-000034',
    createdAt: '2026-10-25T12:00:00Z',
  },
];

export const SEED_COUNTING_SHEETS: CountingSheet[] = [
  {
    id: 'cs-001',
    branchId: '00000000-0000-0000-0000-000000000001',
    sheetNumber: 'CS-CNT-000001',
    serviceDate: '2026-10-18',
    serviceType: 'Sunday 1st Service',
    cashDenominationsGhs: [
      { denomination: 200, count: 15 },
      { denomination: 100, count: 35 },
      { denomination: 50, count: 40 },
      { denomination: 20, count: 50 },
    ],
    cashDenominationsUsd: [{ denomination: 100, count: 2 }],
    cheques: [
      { id: 'chq-1', drawerName: 'Kwesi Darko', bankName: 'GCB Bank', chequeNumber: '00891', amountPesewas: 150000n, currency: 'GHS' },
    ],
    momoTransactions: [
      { id: 'mo-1', network: 'MTN', senderName: 'Ama Osei', transactionReference: 'MTN-77123', amountPesewas: 80000n },
    ],
    fundAllocations: [
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'Tithe', amountPesewas: 580000n, currency: 'GHS' },
      { fundId: 'fund-gen', fundName: 'General Fund', category: 'General Offering', amountPesewas: 600000n, currency: 'GHS' },
    ],
    firstCounterId: 'user-0003-counter',
    firstCounterName: 'Sister Grace Addo (Counter 1)',
    firstSignedAt: '2026-10-18T13:00:00Z',
    secondCounterId: 'user-0004-counter2',
    secondCounterName: 'Brother Emmanuel Ofori (Counter 2)',
    secondSignedAt: '2026-10-18T13:08:00Z',
    status: 'POSTED',
    totalCashGhsPesewas: 950000n,
    totalCashUsdCents: 20000n,
    totalChequesGhsPesewas: 150000n,
    totalMomoGhsPesewas: 80000n,
    grandTotalGhsPesewas: 1180000n,
    grandTotalUsdCents: 20000n,
  },
];

interface GivingContextType {
  members: Member[];
  pledges: Pledge[];
  givingRecords: MemberGivingRecord[];
  countingSheets: CountingSheet[];
  addMember: (member: Omit<Member, 'id' | 'rowVersion'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  recordPledge: (pledge: Omit<Pledge, 'id' | 'paidAmountPesewas' | 'status'>) => Pledge;
  recordGiving: (
    data: Omit<MemberGivingRecord, 'id' | 'receiptNumber' | 'createdAt'>
  ) => MemberGivingRecord;
  reverseGivingRecord: (recordId: string, reason: string) => void;
  submitCountingSheet: (params: {
    serviceDate: string;
    serviceType: ServiceType;
    cashGhs: CashDenominationCount[];
    cashUsd: CashDenominationCount[];
    cheques: ChequeRecord[];
    momo: MoMoRecord[];
    allocations: FundAllocationLine[];
    firstCounterId: string;
    firstCounterName: string;
    secondCounterId: string;
    secondCounterName: string;
    counters?: SheetCounterSignOff[];
    exchangeRateUsd?: string;
  }) => { sheet: CountingSheet; journalEntryId: string };
  signDraftCountingSheet: (params: {
    sheetId: string;
    secondCounterId: string;
    secondCounterName: string;
    exchangeRateUsd?: string;
  }) => { sheet: CountingSheet; journalEntryId: string };
  getMaskedGivingRecords: () => MemberGivingRecord[];
  getMaskedPledges: () => Pledge[];
}

export const GivingContext = createContext<GivingContextType | undefined>(undefined);

export const GivingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { isDemoMode, demoDataset, demoResetKey, markDemoChanged } = useDemo();
  const { addEntry } = useLedger();
  const { enqueueItem } = useSync();

  const [members, setMembers] = useState<Member[]>(() =>
    loadFromStore('members', isDemoMode, isDemoMode ? (demoDataset.members as Member[]) : SEED_MEMBERS)
  );
  const [pledges, setPledges] = useState<Pledge[]>(() =>
    loadFromStore('pledges', isDemoMode, isDemoMode ? (demoDataset.pledges as Pledge[]) : SEED_PLEDGES)
  );
  const [givingRecords, setGivingRecords] = useState<MemberGivingRecord[]>(() =>
    loadFromStore('giving_records', isDemoMode, isDemoMode ? (demoDataset.givingRecords as MemberGivingRecord[]) : SEED_GIVING_RECORDS)
  );
  const [countingSheets, setCountingSheets] = useState<CountingSheet[]>(() =>
    loadFromStore('counting_sheets', isDemoMode, isDemoMode ? (demoDataset.countingSheets as CountingSheet[]) : SEED_COUNTING_SHEETS)
  );

  // Reload state from database partition on mode switch or demo reset (Section 5.1)
  React.useEffect(() => {
    setMembers(loadFromStore('members', isDemoMode, isDemoMode ? (demoDataset.members as Member[]) : SEED_MEMBERS));
    setPledges(loadFromStore('pledges', isDemoMode, isDemoMode ? (demoDataset.pledges as Pledge[]) : SEED_PLEDGES));
    setGivingRecords(loadFromStore('giving_records', isDemoMode, isDemoMode ? (demoDataset.givingRecords as MemberGivingRecord[]) : SEED_GIVING_RECORDS));
    setCountingSheets(loadFromStore('counting_sheets', isDemoMode, isDemoMode ? (demoDataset.countingSheets as CountingSheet[]) : SEED_COUNTING_SHEETS));
  }, [isDemoMode, demoResetKey]);

  const effectiveMembers = members;
  const effectivePledges = pledges;
  const effectiveGivingRecords = givingRecords;
  const effectiveCountingSheets = countingSheets;

  const addMember = useCallback(
    (memberData: Omit<Member, 'id' | 'rowVersion'>) => {
      const newMember: Member = {
        ...memberData,
        id: `mem-${Date.now()}`,
        rowVersion: 1,
      };
      setMembers((prev) => [newMember, ...prev]);

      // Queue offline sync
      enqueueItem({
        entityId: newMember.id,
        entityType: 'MEMBER',
        action: 'UPDATE_MEMBER',
        payload: { ...newMember, client_version: 1 },
        deviceId: currentUser.deviceId,
      });

      return newMember;
    },
    [currentUser, enqueueItem]
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Member>) => {
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            const nextVersion = m.rowVersion + 1;
            const updated = { ...m, ...updates, rowVersion: nextVersion };
            enqueueItem({
              entityId: id,
              entityType: 'MEMBER',
              action: 'UPDATE_MEMBER',
              payload: { ...updated, client_version: m.rowVersion },
              deviceId: currentUser.deviceId,
            });
            return updated;
          }
          return m;
        })
      );
    },
    [currentUser, enqueueItem]
  );

  const recordPledge = useCallback(
    (pledgeData: Omit<Pledge, 'id' | 'paidAmountPesewas' | 'status'>) => {
      const newPledge: Pledge = {
        ...pledgeData,
        id: `pld-${Date.now()}`,
        paidAmountPesewas: 0n,
        status: 'ACTIVE',
      };
      setPledges((prev) => [newPledge, ...prev]);
      return newPledge;
    },
    []
  );

  const recordGiving = useCallback(
    (data: Omit<MemberGivingRecord, 'id' | 'receiptNumber' | 'createdAt'>) => {
      const receiptNumber = `REC-${currentUser.devicePrefix}-${Date.now().toString().slice(-6)}`;
      const newRecord: MemberGivingRecord = {
        ...data,
        id: `rec-${Date.now()}`,
        receiptNumber,
        createdAt: new Date().toISOString(),
      };

      setGivingRecords((prev) => [newRecord, ...prev]);

      // If tied to a pledge, update paid amount
      if (data.category === 'Building Pledge' && data.memberId) {
        setPledges((prev) =>
          prev.map((p) => {
            if (p.memberId === data.memberId && p.status === 'ACTIVE') {
              const updatedPaid = p.paidAmountPesewas + data.amountPesewas;
              const isFulfilled = updatedPaid >= p.targetAmountPesewas;
              return {
                ...p,
                paidAmountPesewas: updatedPaid,
                status: isFulfilled ? 'FULFILLED' : 'ACTIVE',
              };
            }
            return p;
          })
        );
      }

      // Enqueue sync operation
      enqueueItem({
        entityId: newRecord.id,
        entityType: 'MEMBER_GIVING',
        action: 'UPDATE_MEMBER',
        payload: {
          id: newRecord.id,
          receipt_number: receiptNumber,
          member_id: newRecord.memberId,
          amount_pesewas: Number(newRecord.amountPesewas),
          fund_id: newRecord.fundId,
          category: newRecord.category,
        },
        deviceId: currentUser.deviceId,
      });

      return newRecord;
    },
    [currentUser, enqueueItem]
  );

  const reverseGivingRecord = useCallback(
    (recordId: string, reason: string) => {
      setGivingRecords((prev) =>
        prev.map((r) => {
          if (r.id === recordId) {
            return {
              ...r,
              isReversed: true,
              reversalReason: reason,
              reversedAt: new Date().toISOString(),
              reversedBy: currentUser.fullName,
            };
          }
          return r;
        })
      );
    },
    [currentUser]
  );

  const submitCountingSheet = useCallback(
    (params: {
      serviceDate: string;
      serviceType: ServiceType;
      cashGhs: CashDenominationCount[];
      cashUsd: CashDenominationCount[];
      cheques: ChequeRecord[];
      momo: MoMoRecord[];
      allocations: FundAllocationLine[];
      firstCounterId: string;
      firstCounterName: string;
      secondCounterId: string;
      secondCounterName: string;
      exchangeRateUsd?: string;
    }) => {
      // 1. Verify two-counter sign-off
      const validation = validateTwoCounterSignOff(
        params.firstCounterId,
        params.secondCounterId
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const totalCashGhs = calculateDenominationTotal(params.cashGhs);
      const totalCashUsd = calculateDenominationTotal(params.cashUsd);
      const totalCheques = calculateChequeTotal(params.cheques);
      const totalMomo = calculateMomoTotal(params.momo);
      const usdConv = convertLineToBaseCurrency(totalCashUsd, 'USD', params.exchangeRateUsd || '15.5000');
      const grandTotalGhs = totalCashGhs + usdConv.baseAmountGhs + totalCheques + totalMomo;

      const sheetId = `cs-${Date.now()}`;
      const sheetNumber = `CS-${currentUser.devicePrefix}-${Date.now().toString().slice(-4)}`;

      const sheet: CountingSheet = {
        id: sheetId,
        branchId: currentUser.branchId,
        sheetNumber,
        serviceDate: params.serviceDate,
        serviceType: params.serviceType,
        cashDenominationsGhs: params.cashGhs,
        cashDenominationsUsd: params.cashUsd,
        cheques: params.cheques,
        momoTransactions: params.momo,
        fundAllocations: params.allocations,
        firstCounterId: params.firstCounterId,
        firstCounterName: params.firstCounterName,
        firstSignedAt: new Date().toISOString(),
        secondCounterId: params.secondCounterId,
        secondCounterName: params.secondCounterName,
        secondSignedAt: new Date().toISOString(),
        counters: (params as any).counters || [
          { id: params.firstCounterId, name: params.firstCounterName, signedAt: new Date().toISOString() },
          { id: params.secondCounterId, name: params.secondCounterName, signedAt: new Date().toISOString() },
        ],
        status: 'POSTED',
        totalCashGhsPesewas: totalCashGhs,
        totalCashUsdCents: totalCashUsd,
        totalChequesGhsPesewas: totalCheques,
        totalMomoGhsPesewas: totalMomo,
        grandTotalGhsPesewas: grandTotalGhs,
        grandTotalUsdCents: totalCashUsd,
      };

      // 2. Automatically generate balanced double-entry Journal Entry
      const entry = generateJournalEntryFromCountingSheet({
        sheet,
        branchId: currentUser.branchId,
        documentNumber: `JE-${sheetNumber}`,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        exchangeRateUsd: params.exchangeRateUsd,
      });

      // 3. Post to local Ledger
      addEntry(entry);

      // 4. Update counting sheet state and save
      setCountingSheets((prev) => {
        const next = [{ ...sheet, journalEntryId: entry.id }, ...prev];
        saveToStore('counting_sheets', isDemoMode, next);
        return next;
      });

      if (isDemoMode) {
        markDemoChanged();
      } else {
        // 5. Enqueue for offline sync
        enqueueItem({
          entityId: sheet.id,
          entityType: 'COUNTING_SHEET',
          action: 'SUBMIT_COUNTING_SHEET',
          payload: {
            id: sheet.id,
            sheet_number: sheet.sheetNumber,
            service_date: sheet.serviceDate,
            counter_a_id: sheet.firstCounterId,
            counter_b_id: sheet.secondCounterId,
            total_ghs: Number(sheet.grandTotalGhsPesewas),
          },
          deviceId: currentUser.deviceId,
        });
      }

      return { sheet, journalEntryId: entry.id };
    },
    [currentUser, addEntry, enqueueItem, isDemoMode, markDemoChanged]
  );

  const signDraftCountingSheet = useCallback(
    (params: {
      sheetId: string;
      secondCounterId: string;
      secondCounterName: string;
      exchangeRateUsd?: string;
    }) => {
      const existing = countingSheets.find((s) => s.id === params.sheetId);
      if (!existing) {
        throw new Error(`Counting sheet ${params.sheetId} not found`);
      }

      const validation = validateTwoCounterSignOff(
        existing.firstCounterId,
        params.secondCounterId
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const updatedSheet: CountingSheet = {
        ...existing,
        secondCounterId: params.secondCounterId,
        secondCounterName: params.secondCounterName,
        secondSignedAt: new Date().toISOString(),
        status: 'POSTED',
      };

      const entry = generateJournalEntryFromCountingSheet({
        sheet: updatedSheet,
        branchId: currentUser.branchId,
        documentNumber: `JE-${updatedSheet.sheetNumber}`,
        createdBy: currentUser.fullName,
        deviceId: currentUser.deviceId,
        exchangeRateUsd: params.exchangeRateUsd,
      });

      addEntry(entry);

      const nextSheets = countingSheets.map((s) =>
        s.id === params.sheetId ? { ...updatedSheet, journalEntryId: entry.id } : s
      );
      setCountingSheets(nextSheets);
      saveToStore('counting_sheets', isDemoMode, nextSheets);

      if (isDemoMode) {
        markDemoChanged();
      } else {
        enqueueItem({
          entityId: updatedSheet.id,
          entityType: 'COUNTING_SHEET',
          action: 'SUBMIT_COUNTING_SHEET',
          payload: {
            id: updatedSheet.id,
            sheet_number: updatedSheet.sheetNumber,
            service_date: updatedSheet.serviceDate,
            counter_a_id: updatedSheet.firstCounterId,
            counter_b_id: updatedSheet.secondCounterId,
            total_ghs: Number(updatedSheet.grandTotalGhsPesewas),
          },
          deviceId: currentUser.deviceId,
        });
      }

      return { sheet: updatedSheet, journalEntryId: entry.id };
    },
    [countingSheets, currentUser, addEntry, isDemoMode, markDemoChanged, enqueueItem]
  );

  // Return giving records with donor names masked if current role lacks permission
  const getMaskedGivingRecords = useCallback(() => {
    return effectiveGivingRecords.map((r) => maskGivingRecordForRole(r, currentUser.role));
  }, [effectiveGivingRecords, currentUser.role]);

  // Return pledges with donor names masked if current role lacks permission
  const getMaskedPledges = useCallback(() => {
    return effectivePledges.map((p) => maskPledgeForRole(p, currentUser.role));
  }, [effectivePledges, currentUser.role]);

  return (
    <GivingContext.Provider
      value={{
        members: effectiveMembers,
        pledges: effectivePledges,
        givingRecords: effectiveGivingRecords,
        countingSheets: effectiveCountingSheets,
        addMember,
        updateMember,
        recordPledge,
        recordGiving,
        reverseGivingRecord,
        submitCountingSheet,
        signDraftCountingSheet,
        getMaskedGivingRecords,
        getMaskedPledges,
      }}
    >
      {children}
    </GivingContext.Provider>
  );
};

export function useGiving(): GivingContextType {
  const context = useContext(GivingContext);
  if (!context) {
    throw new Error('useGiving must be used within a GivingProvider');
  }
  return context;
}
