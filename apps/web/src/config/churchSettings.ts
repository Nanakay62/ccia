/**
 * Single Source of Truth for church identity, typography, formatting, and appearance.
 * Section 1.3, 1.6, and 8 of specification.
 */

export interface ChurchSettings {
  churchName: string;
  branchName: string;
  shortName: string;
  address: string;
  country: string;
  phone: string;
  email: string;
  taxRegNumber: string;
  logoUrl?: string; // Optional custom uploaded logo
  accentColor: string; // e.g. '#1e4620' (deep green) or '#4a1525' (deep burgundy)
  goldColor: string; // e.g. '#996515'
  baseCurrency: 'GHS';
  reportingCurrency: 'USD';
  dateFormat: string; // 'DD MMM YYYY'
  kentePatternEnabled: boolean; // Subtle border on login & print letterhead only
  fiscalYearStartMonth: number; // 1 = January
  demoModePermanentlyDisabled: boolean;
}

export const defaultChurchSettings: ChurchSettings = {
  churchName: 'Calvary Crystal Church',
  branchName: 'Main Branch',
  shortName: 'Calvary Crystal',
  address: 'Ring Road Central, P.O. Box GP 4421, Accra, Ghana',
  country: 'Ghana',
  phone: '+233 30 222 3344 / +233 24 455 6677',
  email: 'finance@calvarycrystal.org',
  taxRegNumber: 'TIN: C0004928172 • Charity Reg: DSW/7821',
  logoUrl: undefined, // Uses high-fidelity SVG seal if not set
  accentColor: '#1e4620', // Deep ecclesiastical forest green
  goldColor: '#996515', // Refined brass / gold rule mark
  baseCurrency: 'GHS',
  reportingCurrency: 'USD',
  dateFormat: 'DD MMM YYYY',
  kentePatternEnabled: true,
  fiscalYearStartMonth: 1,
  demoModePermanentlyDisabled: false,
};

/**
 * Standard date formatter enforcing DD MMM YYYY everywhere (e.g., "26 Oct 2026").
 * Eliminates day/month confusion for all users.
 */
export function formatDate(input: string | Date | undefined | null): string {
  if (!input) return '—';
  // Parse manually if YYYY-MM-DD string to avoid timezone offset shifts
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    if (y && m && d) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
    }
  }
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return String(input);
  
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateWithWeekday(input: string | Date | undefined | null): string {
  if (!input) return '—';
  let d: Date;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number);
    d = new Date(y!, m! - 1, day!);
  } else {
    d = typeof input === 'string' ? new Date(input) : input;
  }
  if (isNaN(d.getTime())) return String(input);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekday = weekdays[d.getDay()];
  return `${weekday}, ${formatDate(input)}`;
}

/**
 * Standard monetary figure formatter enforcing real thousand separators and 2 decimal places.
 * Pure integer minor units (pesewas/cents) to avoid floating-point errors.
 */
export function formatMoneyAmount(pesewas: bigint | number): string {
  const p = typeof pesewas === 'bigint' ? Number(pesewas) : pesewas;
  const major = p / 100;
  return major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
