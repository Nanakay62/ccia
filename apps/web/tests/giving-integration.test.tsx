import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { CountingSheetView } from '../src/components/giving/CountingSheetView.js';
import { GivingDirectoryView } from '../src/components/giving/GivingDirectoryView.js';
import { PrintableReceiptModal } from '../src/components/giving/PrintableReceiptModal.js';
import type { PrintableReceipt } from '@church/domain';

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <SyncProvider>
      <LedgerProvider>
        <GivingProvider>{children}</GivingProvider>
      </LedgerProvider>
    </SyncProvider>
  </AuthProvider>
);

describe('Phase 4: CountingSheetView Web UI', () => {
  it('renders CountingSheetView and detects dual-counter identical user violation', async () => {
    render(
      <TestAppProviders>
        <CountingSheetView />
      </TestAppProviders>
    );

    expect(screen.getByText(/Weekly Counting Sheet/i)).toBeDefined();
    expect(screen.getByText(/Cash Denomination Count/i)).toBeDefined();

    // Find the two counter dropdowns by their default selected values
    const counter1Select = screen.getByDisplayValue(/Sister Grace Addo \(Counter 1\)/i);
    const counter2Select = screen.getByDisplayValue(/Brother Emmanuel Ofori \(Counter 2\)/i);

    // Set counter2 to match counter1's id
    fireEvent.change(counter2Select, { target: { value: 'user-0003-counter' } });
    fireEvent.change(counter1Select, { target: { value: 'user-0003-counter' } });

    // Warning banner should be visible
    expect(screen.getByText(/Violation: Counter 1 and Counter 2 cannot be the same person/i)).toBeDefined();

    // Submit button should be disabled
    const submitBtn = screen.getByText(/Sign Off & Post Counting Sheet to Ledger/i).closest('button');
    expect(submitBtn?.disabled).toBe(true);
  });

  it('allows adding cheques, calculating totals, and posting with distinct counters', async () => {
    render(
      <TestAppProviders>
        <CountingSheetView />
      </TestAppProviders>
    );

    // Enter GHS 200 quantity = 10 -> GHS 2,000.00
    const qtyInputs = screen.getAllByPlaceholderText('Qty');
    const ghs200Input = qtyInputs[0]!;
    fireEvent.change(ghs200Input, { target: { value: '10' } });

    // Click quick allocate so fund allocation matches GHS 2,000.00
    const quickAllocBtn = screen.getByText(/Quick Allocate \(50\/50\)/i);
    fireEvent.click(quickAllocBtn);

    // Ensure distinct counters (Counter 1: Sister Grace, Counter 2: Brother Emmanuel)
    const counter1Select = screen.getByDisplayValue(/Sister Grace Addo \(Counter 1\)/i);
    const counter2Select = screen.getByDisplayValue(/Brother Emmanuel Ofori \(Counter 2\)/i);
    fireEvent.change(counter1Select, { target: { value: 'user-0003-counter' } });
    fireEvent.change(counter2Select, { target: { value: 'user-0004-counter2' } });

    // Click submit
    const submitBtn = screen.getByText(/Sign Off & Post Counting Sheet to Ledger/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Counting Sheet Posted Successfully/i)).toBeDefined();
    });
  });
});

describe('Phase 4: GivingDirectoryView & Privacy Rule', () => {
  it('displays member directory, searches by name, and shows unmasked records for Treasurer', async () => {
    render(
      <TestAppProviders>
        <GivingDirectoryView />
      </TestAppProviders>
    );

    // Default logged in user is Treasurer -> Full Giving Records Authorized
    expect(screen.getByText(/Full Giving Records Authorized/i)).toBeDefined();

    // Member Directory table displays Kofi Mensah
    expect(screen.getByText('Kofi Mensah')).toBeDefined();
    expect(screen.getByText('Akua Mansa')).toBeDefined();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Akua' } });

    expect(screen.queryByText('Kofi Mensah')).toBeNull();
    expect(screen.getByText('Akua Mansa')).toBeDefined();
  });

  it('switches to Tithes tab, records new contribution, and shows printable receipt', async () => {
    render(
      <TestAppProviders>
        <GivingDirectoryView />
      </TestAppProviders>
    );

    // Switch to Individual Tithes & Giving tab
    const tithesTab = screen.getByText(/Individual Tithes & Giving/i);
    fireEvent.click(tithesTab);

    expect(screen.getByText(/Record Contribution & Issue Printable Official Receipt/i)).toBeDefined();

    // Submit form to issue receipt
    const form = screen.getByText(/Issue Official Receipt & Record/i).closest('form')!;
    fireEvent.submit(form);

    // Receipt Modal should pop up with legal tender words
    await waitFor(() => {
      expect(screen.getByText(/Official Giving & Tithe Receipt/i)).toBeDefined();
      expect(screen.getByText(/In Words:/i)).toBeDefined();
      expect(screen.getByText(/Receipt No:/i)).toBeDefined();
    });
  });

  it('renders Building Pledges tab and tracks campaign progress', async () => {
    render(
      <TestAppProviders>
        <GivingDirectoryView />
      </TestAppProviders>
    );

    // Switch to Pledges tab
    const pledgesTab = screen.getByText(/Pledges & Special Campaigns/i);
    fireEvent.click(pledgesTab);

    expect(screen.getAllByText(/Auditorium Expansion Project 2026/i)[0]).toBeDefined();
    expect(screen.getByText(/Total Pledged:/i)).toBeDefined();
    expect(screen.getByText(/Collected:/i)).toBeDefined();
  });
});

describe('Phase 4: PrintableReceiptModal Component', () => {
  it('renders official church receipt with Ghanaian church details and legal tender words', () => {
    const mockReceipt: PrintableReceipt = {
      receiptNumber: 'REC-FS-00124',
      date: '2026-10-25',
      churchName: 'Accra Central Grace Chapel',
      churchBranch: 'Accra Main Branch',
      churchAddress: 'P.O. Box AN 1234, Accra North, Ghana',
      donorName: 'Deacon Kwabena Acheampong',
      donorMemberNumber: 'MEM-003',
      donorEnvelopeNumber: 'ENV-045',
      category: 'Tithe',
      fundName: 'General Fund',
      paymentMethod: 'CASH',
      currency: 'GHS',
      amountFigures: 'GHS 2,500.00',
      amountInWords: 'Two Thousand Five Hundred Ghana Cedis Only',
      receivingOfficer: 'Sister Naomi Addo',
      receivingOfficerRole: 'Finance Secretary',
    };

    render(
      <PrintableReceiptModal
        receipt={mockReceipt}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/Accra Central Grace Chapel/i)).toBeDefined();
    expect(screen.getByText('REC-FS-00124')).toBeDefined();
    expect(screen.getByText('Deacon Kwabena Acheampong')).toBeDefined();
    expect(screen.getByText('GHS 2,500.00')).toBeDefined();
    expect(screen.getByText(/Two Thousand Five Hundred Ghana Cedis Only/i)).toBeDefined();
    expect(screen.getByText('Sister Naomi Addo')).toBeDefined();
  });
});
