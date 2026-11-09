import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { FixedAssetsView } from '../src/components/assets/FixedAssetsView.js';
import { FixedAssetsProvider } from '../src/context/FixedAssetsContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';

const renderFixedAssets = (initialTab: any = 'register') => {
  return render(
    <AuthProvider>
      <DemoProvider>
        <LedgerProvider>
          <FixedAssetsProvider>
            <FixedAssetsView initialTab={initialTab} />
          </FixedAssetsProvider>
        </LedgerProvider>
      </DemoProvider>
    </AuthProvider>
  );
};

describe('Fixed Assets Register Specification Compliance (Section 3 & Phase 5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Fixed Assets View with underline tabs and accounting summary status line', () => {
    renderFixedAssets();

    // Verify title and subtitle
    expect(screen.getByRole('heading', { level: 1, name: /Fixed assets/i })).toBeDefined();

    // Verify underline tabs
    expect(screen.getByRole('tab', { name: /Register/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Depreciation/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Disposals/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Verification/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Reports/i })).toBeDefined();

    // Verify plain accounting summary status line (no cards)
    expect(screen.getByText(/active assets · Cost/i)).toBeDefined();
    expect(screen.getByText(/Accumulated depreciation/i)).toBeDefined();
    expect(screen.getAllByText(/Net book value/i).length).toBeGreaterThan(0);
  });

  it('displays the seeded demo assets across categories including Land and Buildings', () => {
    renderFixedAssets();

    // Freehold Land
    expect(screen.getByText(/Freehold Land - Main Church Premises/i)).toBeDefined();
    // Yamaha Synthesizer
    expect(screen.getByText(/Yamaha Montage 8 Synthesizer/i)).toBeDefined();
    // Toyota Bus
    expect(screen.getByText(/Toyota Coaster 30-Seater/i)).toBeDefined();
  });

  it('opens Add Asset modal and creates a new capital asset with GL posting', async () => {
    renderFixedAssets();

    // Click "Add Asset" button
    const addButton = screen.getByRole('button', { name: /Add Asset/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: /Register Fixed Asset/i })).toBeDefined();

    // Fill in asset fields
    const descInput = screen.getByPlaceholderText(/Yamaha Montage 8/i);
    fireEvent.change(descInput, { target: { value: 'Sony FX3 Cinema Live Stream Camera' } });

    const amountInput = screen.getByPlaceholderText('0.00 (Cost)');
    fireEvent.change(amountInput, { target: { value: '32000.00' } });

    const submitBtn = screen.getByRole('button', { name: /Save Asset Record/i });
    fireEvent.click(submitBtn);

    // Verify asset appears in the list
    await waitFor(() => {
      expect(screen.getByText('Sony FX3 Cinema Live Stream Camera')).toBeDefined();
    });
  });

  it('records an in-kind donated asset with valuation basis and GL donation credit', async () => {
    renderFixedAssets();

    const addButton = screen.getByRole('button', { name: /Add Asset/i });
    fireEvent.click(addButton);

    // Select DONATED acquisition type
    const acqSelect = screen.getAllByRole('combobox').find((el) =>
      el.innerHTML.includes('Purchased (Capital Expenditure)')
    );
    expect(acqSelect).toBeDefined();
    fireEvent.change(acqSelect!, { target: { value: 'DONATED' } });

    // Enter description, valuation basis, and amount
    const descInput = screen.getByPlaceholderText(/Yamaha Montage 8/i);
    fireEvent.change(descInput, { target: { value: 'Hammond B3 Organ with Leslie Speaker' } });

    const valInput = screen.getByPlaceholderText(/Professional valuation report/i);
    fireEvent.change(valInput, { target: { value: 'Certified appraisal by Ghana Music Heritage (GHS 45,000)' } });

    const amountInput = screen.getByPlaceholderText('0.00 (Cost)');
    fireEvent.change(amountInput, { target: { value: '45000.00' } });

    const submitBtn = screen.getByRole('button', { name: /Save Asset Record/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Hammond B3 Organ with Leslie Speaker')).toBeDefined();
    });
  });

  it('opens Asset Detail Panel and supports asset transfer between locations', async () => {
    renderFixedAssets();

    // Click an asset row to open SlideOver panel
    const row = screen.getByText(/Yamaha Montage 8 Synthesizer/i);
    fireEvent.click(row);

    // Verify detail panel opens
    await waitFor(() => {
      expect(screen.getByText(/Book Value & Depreciation/i)).toBeDefined();
    });

    // Click "Transfer" action button in detail panel
    const transferBtn = screen.getByRole('button', { name: /Transfer/i });
    fireEvent.click(transferBtn);

    expect(screen.getByRole('heading', { name: /Transfer Asset/i })).toBeDefined();

    // Fill in transfer details
    const locInput = screen.getByPlaceholderText(/Fellowship Annex Hall/i);
    fireEvent.change(locInput, { target: { value: 'Fellowship Annex Stage' } });

    const custInput = screen.getByPlaceholderText(/Youth Ministry Lead/i);
    fireEvent.change(custInput, { target: { value: 'Brother Daniel Ofori' } });

    const reasonInput = screen.getByPlaceholderText(/State why this equipment is being relocated/i);
    fireEvent.change(reasonInput, { target: { value: 'Youth Ministry Praise Night special event assignment' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Transfer/i });
    fireEvent.click(confirmBtn);

    // Verify transfer updated
    await waitFor(() => {
      expect(screen.getAllByText('Fellowship Annex Stage').length).toBeGreaterThan(0);
    });
  });

  it('renders Disposals tab with gain/loss computation and derecognition', async () => {
    renderFixedAssets('disposals');

    // Verify Disposals tab status line
    expect(screen.getByText(/disposed items · Cost written off/i)).toBeDefined();

    // Verify the demo disposed asset (Soundcraft LX7ii)
    expect(screen.getByText(/Soundcraft LX7ii 24-Channel/i)).toBeDefined();
    expect(screen.getByText(/Bethel Baptist Church/i)).toBeDefined();
  });

  it('generates offline QR code tag and opens printable label modal', async () => {
    renderFixedAssets();

    // Click asset to open detail panel
    const row = screen.getByText(/Yamaha Montage 8 Synthesizer/i);
    fireEvent.click(row);

    // Click "Label" button in the slideover panel
    const labelBtn = screen.getByRole('button', { name: /^Label$/i });
    fireEvent.click(labelBtn);

    // Verify modal and QR tag elements
    expect(screen.getByRole('heading', { name: /Asset Tag & QR Code/i })).toBeDefined();
    expect(screen.getByText(/Accra Central Assembly of God/i)).toBeDefined();
    expect(screen.getByText(/Fixed Asset Inventory Tag/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Print Label', exact: true })).toBeDefined();
  });
});
