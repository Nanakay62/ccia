import { describe, it, expect } from 'vitest';
import {
  formatDocumentNumber,
  parseDocumentNumber,
  buildDevicePrefix,
} from '../src/numbering/index.js';

describe('Document Numbering Domain Module', () => {
  it('formats document numbers with device prefix and sequence', () => {
    const formatted = formatDocumentNumber('FS-D1', 1);
    expect(formatted).toBe('FS-D1-000001');

    const formattedCustomPadding = formatDocumentNumber('TR-D2', 45, 4);
    expect(formattedCustomPadding).toBe('TR-D2-0045');
  });

  it('parses valid document numbers', () => {
    const parsed = parseDocumentNumber('CS-D01-000123');
    expect(parsed.prefix).toBe('CS-D01');
    expect(parsed.sequence).toBe(123);
    expect(parsed.formatted).toBe('CS-D01-000123');
  });

  it('rejects malformed document numbers', () => {
    expect(() => parseDocumentNumber('INVALIDFORMAT')).toThrow(/Invalid document number format/);
    expect(() => parseDocumentNumber('FS-D1-ABC')).toThrow(/Sequence must be numeric/);
  });

  it('builds device prefix from role, document type, and device id', () => {
    const prefix = buildDevicePrefix('COUNTING_SHEET', 'Counter', 'phone-android-99');
    expect(prefix).toBe('CS-COU-ID99');
  });
});
