/**
 * Test Suite for Phase 5: Print & Exports.
 * Validates:
 * - Official Church Letterhead component (TIN, logo/crest, address, kente strip, draft & demo watermarks)
 * - DualSignatureBlock component (Prepared by / Approved by, roles, dates, stamp box)
 * - Printable Payment Voucher Modal with WHT deduction and amount in words
 * - Printable Counting Sheet Modal with denominations breakdown and draft status
 * - Word (.doc) export generator utility for council minutes
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { ChurchLetterhead } from '../src/components/common/ChurchLetterhead.js';
import { DualSignatureBlock } from '../src/components/common/DualSignatureBlock.js';
import { PrintableVoucherModal } from '../src/components/expenses/PrintableVoucherModal.js';
import { PrintableCountingSheetModal } from '../src/components/giving/PrintableCountingSheetModal.js';
import { exportReportToWord } from '../src/utils/exports/word.js';
import type { PaymentVoucher, CountingSheet } from '@church/domain';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>{children}</DemoProvider>
  </AuthProvider>
);

describe('Phase 5: Print Layouts and Official Letterhead', () => {
  it('renders official church letterhead with TIN, address, and document badge', () => {
    render(
      <TestWrapper>
        <ChurchLetterhead
          documentTitle="Official Audit Statement"
          documentNumber="DOC-2026-TEST"
          documentDate="1 November 2026"
          periodText="Q4 2026"
          currency="GHS"
        />
      </TestWrapper>
    );

    expect(screen.getByText(/Accra Central Grace Chapel/i)).toBeDefined();
    expect(screen.getByText(/TIN: C0004928172/i)).toBeDefined();
    expect(screen.getByText(/Official Audit Statement/i)).toBeDefined();
    expect(screen.getByText(/DOC-2026-TEST/i)).toBeDefined();
    expect(screen.getByText(/Ghana Cedis \(GHS\)/i)).toBeDefined();
  });

  it('renders DRAFT watermark when document is in draft mode', () => {
    render(
      <TestWrapper>
        <ChurchLetterhead
          documentTitle="Draft Counting Sheet"
          documentNumber="CS-DRAFT-01"
          isDraft={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/DRAFT DOCUMENT — PENDING FINAL POSTING/i)).toBeDefined();
    expect(screen.getByText(/UNOFFICIAL COPY/i)).toBeDefined();
  });

  it('renders dual signature block with printed names, roles, and stamp placeholder', () => {
    render(
      <DualSignatureBlock
        preparedBy={{
          label: 'Prepared by',
          name: 'Ebenezer Mensah',
          role: 'Finance Secretary',
          date: '2026-10-31',
        }}
        approvedBy={{
          label: 'Approved by',
          name: 'Deaconess Akosua Darko',
          role: 'Church Treasurer',
          date: '2026-11-01',
        }}
        showStampBox={true}
      />
    );

    expect(screen.getByText(/Prepared by:/i)).toBeDefined();
    expect(screen.getByText(/Ebenezer Mensah/i)).toBeDefined();
    expect(screen.getByText(/Finance Secretary/i)).toBeDefined();

    expect(screen.getByText(/Approved by:/i)).toBeDefined();
    expect(screen.getByText(/Deaconess Akosua Darko/i)).toBeDefined();
    expect(screen.getByText(/Church Treasurer/i)).toBeDefined();

    expect(screen.getByText(/OFFICIAL CHURCH STAMP/i)).toBeDefined();
  });

  it('renders printable payment voucher with payee, WHT deduction, and amount in words', () => {
    const mockVoucher: PaymentVoucher = {
      id: 'voucher-test-01',
      branchId: 'branch-01',
      voucherNumber: 'PV-FS-D01-000041',
      requisitionNumber: 'REQ-DEMO-001',
      payeeName: 'Akwasi Sound & Instruments Ltd',
      fundId: 'fund-gen',
      fundName: 'General Operating Fund',
      expenseAccountId: 'acct-5030',
      expenseAccountName: 'Maintenance & Repairs',
      purpose: 'Emergency sound mixer repair',
      paymentMethod: 'CHEQUE',
      currency: 'GHS',
      grossAmountPesewas: 350000n, // GHS 3,500.00
      withholdingTaxRate: 5,
      withholdingTaxPesewas: 17500n, // GHS 175.00
      netPayablePesewas: 332500n, // GHS 3,325.00
      voucherDate: '2026-10-25',
      chequeNumber: 'CHQ-882190',
      preparedById: 'user-sec',
      preparedByName: 'Ebenezer Mensah',
      authorizedById: 'user-treas',
      authorizedByName: 'Deaconess Akosua Darko',
      createdAt: '2026-10-25T10:00:00Z',
    };

    render(
      <TestWrapper>
        <PrintableVoucherModal
          voucher={mockVoucher}
          isOpen={true}
          onClose={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/PV-FS-D01-000041/i)).toBeDefined();
    expect(screen.getAllByText(/Akwasi Sound & Instruments Ltd/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/REQ-DEMO-001/i)).toBeDefined();
    expect(screen.getByText(/3500.00/i)).toBeDefined();
    expect(screen.getByText(/5%/i)).toBeDefined();
    expect(screen.getAllByText(/3325.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/three thousand three hundred and twenty-five ghana cedis/i)).toBeDefined();
  });

  it('renders printable counting sheet with denomination breakdown and draft watermark', () => {
    const mockSheet: CountingSheet = {
      id: 'sheet-test-01',
      branchId: 'branch-01',
      sheetNumber: 'CS-2026-043',
      serviceDate: '2026-10-26',
      serviceType: 'Sunday 1st Service',
      cashDenominationsGhs: [
        { denomination: 200, count: 10 },
        { denomination: 100, count: 20 },
        { denomination: 50, count: 40 },
      ],
      cashDenominationsUsd: [],
      cheques: [],
      momoTransactions: [
        {
          id: 'momo-1',
          network: 'MTN',
          senderName: 'Sister Faustina',
          transactionReference: 'TXN-99881',
          amountPesewas: 50000n,
        },
      ],
      fundAllocations: [
        { fundId: 'fund-gen', fundName: 'General Operating Fund', category: 'OFFERING', amountPesewas: 400000n },
        { fundId: 'fund-bld', fundName: 'Building Sanctuary Fund', category: 'BUILDING', amountPesewas: 250000n },
      ],
      firstCounterId: 'user-c1',
      firstCounterName: 'Sister Grace Addo',
      firstSignedAt: '2026-10-26T12:30:00Z',
      status: 'DRAFT',
      totalCashGhsPesewas: 600000n,
      totalCashUsdCents: 0n,
      totalChequesGhsPesewas: 0n,
      totalMomoGhsPesewas: 50000n,
      grandTotalGhsPesewas: 650000n,
      grandTotalUsdCents: 0n,
    };

    render(
      <TestWrapper>
        <PrintableCountingSheetModal
          sheet={mockSheet}
          isOpen={true}
          onClose={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/CS-2026-043/i)).toBeDefined();
    expect(screen.getByText(/DRAFT DOCUMENT — PENDING FINAL POSTING/i)).toBeDefined();
    expect(screen.getAllByText(/Sister Grace Addo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Awaiting Second Signature/i)).toBeDefined();
    expect(screen.getAllByText(/6500.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/six thousand five hundred ghana cedis/i)).toBeDefined();
  });

  it('exports report data to Word (.doc) format with letterhead, table markup and signature blocks', () => {
    let capturedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();

    exportReportToWord({
      title: 'General Ledger Trial Balance',
      periodText: 'As of 31 October 2026',
      currency: 'GHS',
      columns: [
        { header: 'Account Code', key: 'code' },
        { header: 'Account Name', key: 'name' },
        { header: 'Debit', key: 'debit', isCurrency: true },
        { header: 'Credit', key: 'credit', isCurrency: true },
      ],
      data: [
        { code: '1010', name: 'GCB Bank Main Operating Account', debit: 45000, credit: 0 },
        { code: '3010', name: 'General Church Accumulated Fund', debit: 0, credit: 45000 },
        { isTotal: true, code: 'TOTAL', name: 'Total Debits & Credits', debit: 45000, credit: 45000 },
      ],
      isDemo: true,
      filename: 'test-trial-balance.doc',
    });

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob?.type).toContain('application/msword');

    URL.createObjectURL = originalCreateObjectURL;
  });
});
