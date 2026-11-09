import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { SyncProvider } from '../src/context/SyncContext.js';
import { GivingProvider } from '../src/context/GivingContext.js';
import { ToastProvider } from '../src/context/ToastContext.js';
import { CountingSheetView } from '../src/components/giving/CountingSheetView.js';
import { GivingDirectoryView } from '../src/components/giving/GivingDirectoryView.js';
import { PrintableReceiptModal } from '../src/components/giving/PrintableReceiptModal.js';
import type { PrintableReceipt } from '@church/domain';

const TestAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>
      <SyncProvider>
        <LedgerProvider>
          <GivingProvider>
            <ToastProvider>{children}</ToastProvider>
          </GivingProvider>
        </LedgerProvider>
      </SyncProvider>
    </DemoProvider>
  </AuthProvider>
);

describe('Phase 4: CountingSheetView Web UI', () => {
  it('renders CountingSheetView and detects dual-counter identical user violation', async () => {
    render(
      <TestAppProviders>
        <CountingSheetView />
      </TestAppProviders>
    );

    expect(screen.getByRole('heading', { name: /^Counting sheet$/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^GHS cash$/i })).toBeDefined();

    // Find the two counter dropdowns by their default selected values
    const counter1Select = screen.getByDisplayValue(/Mabel Ankrah/i);
    const counter2Select = screen.getByDisplayValue(/Emmanuel Ofori/i);

    // Set counter2 to match counter1's id
    fireEvent.change(counter2Select, { target: { value: 'user-0003-counter' } });
    fireEvent.change(counter1Select, { target: { value: 'user-0003-counter' } });

    // Warning banner should be visible
    expect(screen.getByText(/Violation: Counter 1 and Counter 2 cannot be the same person/i)).toBeDefined();

    // Submit button should be disabled
    const submitBtn = screen.getByText(/Sign Off & Post Counting Sheet to Ledger/i).closest('button');
    expect(submitBtn?.disabled).toBe(true);
  });

  it('allows adding cash, calculating totals, and posting with distinct counters', async () => {
    render(
      <TestAppProviders>
        <CountingSheetView />
      </TestAppProviders>
    );

    // Enter GHS 200 quantity = 10 -> GHS 2,000.00
    const ghs200Input = screen.getByTestId('qty-ghs-200');
    fireEvent.change(ghs200Input, { target: { value: '10' } });

    // Click quick allocate so fund allocation matches GHS 2,000.00
    const quickAllocBtn = screen.getByText(/Quick allocate \(50\/50\)/i);
    fireEvent.click(quickAllocBtn);

    // Ensure distinct counters (Counter 1: Mabel Ankrah, Counter 2: Emmanuel Ofori)
    const counter1Select = screen.getByDisplayValue(/Mabel Ankrah/i);
    const counter2Select = screen.getByDisplayValue(/Emmanuel Ofori/i);
    fireEvent.change(counter1Select, { target: { value: 'user-0003-counter' } });
    fireEvent.change(counter2Select, { target: { value: 'user-0004-counter2' } });

    // Click submit
    const submitBtn = screen.getByText(/Sign Off & Post Counting Sheet to Ledger/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Posted to (general )?ledger/i).length).toBeGreaterThan(0);
    });
  });

  it('supports adding permanent and temporary counters to roster and assigns them', async () => {
    render(
      <TestAppProviders>
        <CountingSheetView />
      </TestAppProviders>
    );

    // Click "+ Add counter" button
    const addCounterBtn = screen.getAllByRole('button', { name: /\+ Add counter/i })[0]!;
    fireEvent.click(addCounterBtn);

    // Modal should be visible
    expect(screen.getByRole('heading', { name: /Add counter to roster/i })).toBeDefined();

    // Fill in name and select Temporary counter
    const nameInput = screen.getByPlaceholderText(/e\.g\. Deacon Kwabena Mensah/i);
    fireEvent.change(nameInput, { target: { value: 'Deacon Kwabena Mensah' } });

    const tempBtn = screen.getByRole('button', { name: /Temporary Counter/i });
    fireEvent.click(tempBtn);

    // Select "Assign to Counter 1"
    const counter1Radio = screen.getByLabelText(/Counter 1/i);
    fireEvent.click(counter1Radio);

    // Submit
    const saveBtn = screen.getByRole('button', { name: /Save Counter/i });
    fireEvent.click(saveBtn);

    // Verify modal is closed and Counter 1 now shows Deacon Kwabena Mensah
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add counter to roster/i })).toBeNull();
      expect(screen.getAllByText(/Deacon Kwabena Mensah/i)[0]).toBeDefined();
    });
  });
});

describe('Phase 4: GivingDirectoryView & Privacy Rule', () => {
  it('displays member directory, searches by name, and removes the green authorized badge per spec 2.1', async () => {
    render(
      <TestAppProviders>
        <GivingDirectoryView />
      </TestAppProviders>
    );

    // Header has title Members and does NOT show decorative permission badge (Spec 2.1)
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeDefined();
    expect(screen.queryByText(/Full Giving Records Authorized/i)).toBeNull();

    // Member Directory table displays Kofi Mensah and Akua Mansa
    expect(screen.getByText(/Kofi Mensah/i)).toBeDefined();
    expect(screen.getByText(/Akua Mansa/i)).toBeDefined();

    // Test search filter
    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Akua' } });

    expect(screen.queryByText(/Kofi Mensah/i)).toBeNull();
    expect(screen.getByText(/Akua Mansa/i)).toBeDefined();
  });

  it('switches to Giving tab, records new contribution, and shows printable receipt', async () => {
    render(
      <TestAppProviders>
        <GivingDirectoryView />
      </TestAppProviders>
    );

    // Switch to Giving tab (underline tabs per Spec 2.1)
    const givingTab = screen.getByRole('button', { name: /^giving/i });
    fireEvent.click(givingTab);

    // Click "Record giving"
    const recordBtn = screen.getByRole('button', { name: /Record giving/i });
    fireEvent.click(recordBtn);

    expect(screen.getByText(/Record giving contribution/i)).toBeDefined();

    // Submit form to issue receipt
    const form = screen.getByRole('button', { name: /Record and issue receipt/i }).closest('form')!;
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
    const pledgesTab = screen.getByRole('button', { name: /Pledges and campaigns/i });
    fireEvent.click(pledgesTab);

    expect(screen.getAllByText(/Auditorium Expansion Project 2026/i)[0]).toBeDefined();
    expect(screen.getByText(/Total Pledged/i)).toBeDefined();
    expect(screen.getByText(/Total Paid/i)).toBeDefined();
  });
});

describe('Phase 4: PrintableReceiptModal Component', () => {
  it('renders official church receipt with Ghanaian church details and legal tender words', () => {
    const mockReceipt: PrintableReceipt = {
      receiptNumber: 'REC-FS-00124',
      date: '2026-10-25',
      churchName: 'Calvary Crystal Church',
      churchBranch: 'Main Branch',
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

    expect(screen.getByText(/Calvary Crystal Church/i)).toBeDefined();
    expect(screen.getByText('REC-FS-00124')).toBeDefined();
    expect(screen.getByText('Deacon Kwabena Acheampong')).toBeDefined();
    expect(screen.getByText('GHS 2,500.00')).toBeDefined();
    expect(screen.getByText(/Two Thousand Five Hundred Ghana Cedis Only/i)).toBeDefined();
    expect(screen.getByText('Sister Naomi Addo')).toBeDefined();
  });
});
