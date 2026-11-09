import type { FixedAssetCategory, FixedAssetCategoryCode, AssetPolicySettings } from './types.js';

export const DEFAULT_ASSET_CATEGORIES: readonly FixedAssetCategory[] = [
  {
    id: 'cat-land',
    code: 'LAND',
    name: 'Land',
    defaultUsefulLifeMonths: 0,
    isDepreciable: false,
    costAccountCode: '1500',
    description: 'Freehold land and permanent plots (never depreciated)',
  },
  {
    id: 'cat-bld',
    code: 'BUILDINGS',
    name: 'Buildings',
    defaultUsefulLifeMonths: 600, // 50 years
    isDepreciable: true,
    costAccountCode: '1510',
    accumulatedDepAccountCode: '1511',
    depExpenseAccountCode: '5210',
    description: 'Main sanctuary, fellowship halls, offices, permanent church structures',
  },
  {
    id: 'cat-furn',
    code: 'FURNITURE',
    name: 'Furniture and fittings',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1520',
    accumulatedDepAccountCode: '1521',
    depExpenseAccountCode: '5220',
    description: 'Pews, pulpit suites, office desks, chairs, conference tables, storage',
  },
  {
    id: 'cat-sound',
    code: 'SOUND_AV',
    name: 'Sound and audio-visual equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1530',
    accumulatedDepAccountCode: '1531',
    depExpenseAccountCode: '5230',
    description: 'Digital mixers, line array speakers, microphones, video switchers, laser projectors',
  },
  {
    id: 'cat-mus',
    code: 'MUSICAL_INSTRUMENTS',
    name: 'Musical instruments',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1540',
    accumulatedDepAccountCode: '1541',
    depExpenseAccountCode: '5240',
    description: 'Synthesizers, acoustic pianos, drum sets, guitars, brass instruments',
  },
  {
    id: 'cat-veh',
    code: 'VEHICLES',
    name: 'Vehicles',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1550',
    accumulatedDepAccountCode: '1551',
    depExpenseAccountCode: '5250',
    description: 'Church buses, ministry pickups, transport vans',
  },
  {
    id: 'cat-it',
    code: 'COMPUTERS_IT',
    name: 'Computers and IT equipment',
    defaultUsefulLifeMonths: 36, // 3 years
    isDepreciable: true,
    costAccountCode: '1560',
    accumulatedDepAccountCode: '1561',
    depExpenseAccountCode: '5260',
    description: 'Desktop computers, laptops, network servers, NAS storage, printers',
  },
  {
    id: 'cat-gen',
    code: 'GENERATORS',
    name: 'Generators and electrical',
    defaultUsefulLifeMonths: 84, // 7 years
    isDepreciable: true,
    costAccountCode: '1570',
    accumulatedDepAccountCode: '1571',
    depExpenseAccountCode: '5270',
    description: 'Diesel generators, online UPS systems, voltage regulators, power plants',
  },
  {
    id: 'cat-kit',
    code: 'KITCHEN',
    name: 'Kitchen and catering equipment',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1580',
    accumulatedDepAccountCode: '1581',
    depExpenseAccountCode: '5280',
    description: 'Industrial cookers, commercial refrigerators, catering warmers, kitchen appliances',
  },
  {
    id: 'cat-oth',
    code: 'OTHER',
    name: 'Other',
    defaultUsefulLifeMonths: 60, // 5 years
    isDepreciable: true,
    costAccountCode: '1590',
    accumulatedDepAccountCode: '1591',
    depExpenseAccountCode: '5290',
    description: 'Specialized assets, tools, landscaping equipment, sundry fixed assets',
  },
] as const;

export const DEFAULT_ASSET_POLICY_SETTINGS: AssetPolicySettings = {
  capitalisationThresholdGhsPesewas: 100000n, // GHS 1,000.00
  capitalisationThresholdUsdCents: 10000n, // USD 100.00
  depreciationEnabled: true,
  defaultDepreciationMethod: 'STRAIGHT_LINE',
  depreciationFrequency: 'YEARLY',
  verificationPeriodMonths: 12,
};

export function getCategoryByCode(code: FixedAssetCategoryCode): FixedAssetCategory | undefined {
  return DEFAULT_ASSET_CATEGORIES.find((c) => c.code === code);
}

export function getCategoryById(id: string): FixedAssetCategory | undefined {
  return DEFAULT_ASSET_CATEGORIES.find((c) => c.id === id);
}

export function isCategoryDepreciable(code: FixedAssetCategoryCode): boolean {
  const cat = getCategoryByCode(code);
  return cat ? cat.isDepreciable : false;
}
