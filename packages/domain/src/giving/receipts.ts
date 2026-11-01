import type { MemberGivingRecord, PrintableReceipt } from './types.js';

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanOneThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return one > 0 ? `${TENS[ten]}-${ONES[one]}` : TENS[ten]!;
  }
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  if (remainder > 0) {
    return `${ONES[hundred]} Hundred and ${convertLessThanOneThousand(remainder)}`;
  }
  return `${ONES[hundred]} Hundred`;
}

function integerToWords(num: bigint): string {
  if (num === 0n) return 'Zero';
  let n = num;
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  let scaleIndex = 0;
  const parts: string[] = [];

  while (n > 0n) {
    const chunk = Number(n % 1000n);
    if (chunk > 0) {
      const chunkWords = convertLessThanOneThousand(chunk);
      const scale = scales[scaleIndex];
      parts.unshift(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
    n = n / 1000n;
    scaleIndex++;
  }

  return parts.join(' ');
}

/**
 * Converts Ghana Cedis minor units (pesewas) to legal tender words.
 * e.g. 150000n -> "One Thousand Five Hundred Ghana Cedis Only"
 * e.g. 15050n  -> "One Hundred and Fifty Ghana Cedis, Fifty Pesewas Only"
 */
export function numberToWordsGhs(pesewas: bigint): string {
  const cedis = pesewas / 100n;
  const minor = Number(pesewas % 100n);

  const parts: string[] = [];

  if (cedis > 0n) {
    const cediWords = integerToWords(cedis);
    parts.push(`${cediWords} ${cedis === 1n ? 'Ghana Cedi' : 'Ghana Cedis'}`);
  }

  if (minor > 0) {
    const minorWords = convertLessThanOneThousand(minor);
    parts.push(`${minorWords} Pesewas`);
  }

  if (parts.length === 0) {
    return 'Zero Ghana Cedis Only';
  }

  return `${parts.join(', ')} Only`;
}

/**
 * Converts USD minor units (cents) to legal tender words.
 * e.g. 10000n -> "One Hundred United States Dollars Only"
 */
export function numberToWordsUsd(cents: bigint): string {
  const dollars = cents / 100n;
  const minor = Number(cents % 100n);

  const parts: string[] = [];

  if (dollars > 0n) {
    const dollarWords = integerToWords(dollars);
    parts.push(`${dollarWords} ${dollars === 1n ? 'United States Dollar' : 'United States Dollars'}`);
  }

  if (minor > 0) {
    const minorWords = convertLessThanOneThousand(minor);
    parts.push(`${minorWords} Cents`);
  }

  if (parts.length === 0) {
    return 'Zero United States Dollars Only';
  }

  return `${parts.join(', ')} Only`;
}

export interface ReceiptGeneratorParams {
  readonly record: MemberGivingRecord;
  readonly churchName?: string;
  readonly churchBranch?: string;
  readonly churchAddress?: string;
  readonly receivingOfficer: string;
  readonly receivingOfficerRole: string;
}

/**
 * Generates structured printable receipt metadata.
 */
export function generatePrintableReceipt(params: ReceiptGeneratorParams): PrintableReceipt {
  const { record } = params;
  const isGhs = record.currency === 'GHS';

  const amountMajor = (Number(record.amountPesewas) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const amountFigures = `${record.currency} ${amountMajor}`;
  const amountInWords = isGhs
    ? numberToWordsGhs(record.amountPesewas)
    : numberToWordsUsd(record.amountPesewas);

  return {
    receiptNumber: record.receiptNumber,
    date: record.serviceDate,
    churchName: params.churchName || 'Accra Central Grace Chapel',
    churchBranch: params.churchBranch || 'Accra Main Branch',
    churchAddress: params.churchAddress || 'P.O. Box AN 1234, Accra North, Ghana',
    donorName: record.memberName || 'Anonymous Congregation Member',
    donorMemberNumber: record.memberNumber,
    donorEnvelopeNumber: record.envelopeNumber,
    category: record.category,
    fundName: record.fundName,
    paymentMethod: record.paymentMethod,
    currency: record.currency,
    amountFigures,
    amountInWords,
    receivingOfficer: params.receivingOfficer,
    receivingOfficerRole: params.receivingOfficerRole,
  };
}
