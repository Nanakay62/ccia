/**
 * Standard formatting utilities for dates, currency, and text.
 * Strictly enforces Rule A6: Dates formatted as DD MMM YYYY (e.g. 18 Oct 2026).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(input?: string | Date | null): string {
  if (!input) return '—';

  try {
    let y: number;
    let m: number;
    let d: number;

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parts = trimmed.slice(0, 10).split('-');
        y = parseInt(parts[0] ?? '0', 10);
        m = parseInt(parts[1] ?? '0', 10);
        d = parseInt(parts[2] ?? '0', 10);
      } else {
        const dt = new Date(trimmed);
        if (isNaN(dt.getTime())) return trimmed;
        y = dt.getFullYear();
        m = dt.getMonth() + 1;
        d = dt.getDate();
      }
    } else {
      y = input.getFullYear();
      m = input.getMonth() + 1;
      d = input.getDate();
    }

    if (m >= 1 && m <= 12) {
      const dayStr = d.toString().padStart(2, '0');
      return `${dayStr} ${MONTHS[m - 1]} ${y}`;
    }

    return String(input);
  } catch {
    return String(input);
  }
}

export function formatPesewas(amount: bigint | number): string {
  const bigAmt = typeof amount === 'number' ? BigInt(Math.round(amount)) : amount;
  const isNeg = bigAmt < 0n;
  const abs = isNeg ? -bigAmt : bigAmt;
  const major = abs / 100n;
  const minor = abs % 100n;
  const formatted = `${major.toLocaleString('en-US')}.${minor.toString().padStart(2, '0')}`;
  return isNeg ? `(${formatted})` : formatted;
}

export function parsePesewas(input: string | number): bigint {
  if (typeof input === 'number') {
    return BigInt(Math.round(input * 100));
  }
  const clean = input.replace(/,/g, '').trim();
  if (!clean) return 0n;
  const num = parseFloat(clean);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

/**
 * Requirement 6: Document numbers are short (e.g. REQ-0015, PV-0014).
 * Converts long device/date-stamped doc IDs to clean short display codes.
 */
export function shortDocNumber(docNum?: string | null): string {
  if (!docNum) return '';
  const match = docNum.match(/^([A-Z]+)-.*?-0*(\d+)$/);
  if (match && match[1] && match[2]) {
    return `${match[1]}-${match[2].padStart(4, '0')}`;
  }
  const simpleMatch = docNum.match(/^([A-Z]+)-0*(\d+)$/);
  if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
    return `${simpleMatch[1]}-${simpleMatch[2].padStart(4, '0')}`;
  }
  return docNum;
}
