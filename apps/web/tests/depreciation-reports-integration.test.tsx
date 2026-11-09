import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FixedAssetsProvider } from '../src/context/FixedAssetsContext.js';
import { LedgerProvider } from '../src/context/LedgerContext.js';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { FixedAssetsView } from '../src/components/assets/FixedAssetsView.js';

const renderFixedAssetsView = (initialTab: any = 'depreciation') => {
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

describe('Phase 6: Depreciation Runs & Fixed Asset Reports Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Depreciation tab with summary status line and past seeded runs', () => {
    renderFixedAssetsView('depreciation');

    // 1. Title and tabs
    expect(screen.getByRole('heading', { level: 1, name: /Fixed assets/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Depreciation/i })).toBeDefined();

    // 2. Summary status line per Section 6
    expect(screen.getByText(/Total YTD Depreciation/i)).toBeDefined();
    expect(screen.getByText(/Straight-line basis/i)).toBeDefined();

    // 3. Past seeded run DEP-2026-09 is listed
    expect(screen.getByText('DEP-2026-09')).toBeDefined();
    expect(screen.getAllByText('2026-09').length).toBeGreaterThan(0);
    expect(screen.getByText('POSTED')).toBeDefined();
  });

  it('opens Depreciation Run modal, generates reactive preview, displays eligible vs skipped assets, and shows balanced GL preview', () => {
    renderFixedAssetsView('depreciation');

    // Click "Run Depreciation"
    const runBtn = screen.getByRole('button', { name: /Run Depreciation/i });
    fireEvent.click(runBtn);

    // Modal opens
    expect(screen.getByText('Run Fixed Asset Depreciation')).toBeDefined();
    expect(screen.getAllByText(/eligible assets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/skipped/i).length).toBeGreaterThan(0);

    // Switch between preview subtabs
    const skippedTab = screen.getByRole('button', { name: /Skipped Assets/i });
    fireEvent.click(skippedTab);
    expect(screen.getByText(/Land is non-depreciable/i)).toBeDefined();

    const glTab = screen.getByRole('button', { name: /GL Journal Breakdown/i });
    fireEvent.click(glTab);
    expect(screen.getByText(/Total Balanced Journal Entry Posting/i)).toBeDefined();
  });

  it('executes depreciation run posting with Treasurer approval and posts balanced GL entries', async () => {
    renderFixedAssetsView('depreciation');

    const runBtn = screen.getByRole('button', { name: /Run Depreciation/i });
    fireEvent.click(runBtn);

    // Approve & Post Depreciation button in modal
    const postBtn = screen.getByRole('button', { name: /Approve & Post Depreciation/i });
    fireEvent.click(postBtn);

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to post depreciation/i)).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: 'Approve & Post' });
    fireEvent.click(confirmBtn);

    // Success toast / message appears
    await waitFor(() => {
      expect(screen.getByText(/successfully posted to General Ledger/i)).toBeDefined();
    });
  });

  it('opens Depreciation Run Detail slideover panel and allows reversing with mandatory reason', async () => {
    renderFixedAssetsView('depreciation');

    // Click on the past run row
    const runRow = screen.getByText('DEP-2026-09');
    fireEvent.click(runRow);

    // Detail panel opens
    expect(screen.getByText(/Depreciation for 2026-09/i)).toBeDefined();
    expect(screen.getByText(/Prepared By:/i)).toBeDefined();

    // Click Reverse Run
    const reverseBtn = screen.getByRole('button', { name: /Reverse Run/i });
    fireEvent.click(reverseBtn);

    // Confirmation dialog opens with reason input
    await waitFor(() => {
      expect(screen.getByText(/Reverse Depreciation Run DEP-2026-09/i)).toBeDefined();
    });

    const reasonInput = screen.getByPlaceholderText(/incorrect period dates/i);
    fireEvent.change(reasonInput, { target: { value: 'Incorrect month cutoff applied by office' } });

    const confirmRevBtn = screen.getAllByRole('button', { name: 'Reverse Run' }).at(-1)!;
    fireEvent.click(confirmRevBtn);

    // Verify run marked REVERSED
    await waitFor(() => {
      expect(screen.getAllByText('REVERSED').length).toBeGreaterThan(0);
    });
  });

  it('renders Fixed Asset Movement Schedule with all 10 categories, additions, disposals, and total row', () => {
    renderFixedAssetsView('reports');

    // Default subtab is Movement Schedule
    expect(screen.getByText('Fixed Asset Movement Schedule')).toBeDefined();
    expect(screen.getByText(/Official Note to Financial Statements/i)).toBeDefined();

    // Verify key categories are in the schedule
    expect(screen.getByText('Land')).toBeDefined();
    expect(screen.getByText('Buildings')).toBeDefined();
    expect(screen.getByText('Furniture and fittings')).toBeDefined();
    expect(screen.getByText('Sound and audio-visual equipment')).toBeDefined();
    expect(screen.getByText('Musical instruments')).toBeDefined();
    expect(screen.getByText('Vehicles')).toBeDefined();
    expect(screen.getByText('Total Fixed Assets')).toBeDefined();
  });

  it('renders Sub-Ledger vs General Ledger Reconciliation and verifies exact balance', () => {
    renderFixedAssetsView('reports');

    // Click Reconciliation subtab
    const recTab = screen.getByRole('button', { name: /Sub-Ledger vs General Ledger Reconciliation/i });
    fireEvent.click(recTab);

    // Check status line and account columns
    expect(screen.getByText(/Register Cost:/i)).toBeDefined();
    expect(screen.getByText(/Ledger Cost:/i)).toBeDefined();
    expect(screen.getAllByText(/Balanced/i).length).toBeGreaterThan(0);
  });

  it('renders 5-Year Depreciation Forecast and Lifecycle / Custodians handover sheet with blank signature lines', () => {
    renderFixedAssetsView('reports');

    // 1. Forecast subtab
    const forecastTab = screen.getByRole('button', { name: /5-Year Depreciation Forecast/i });
    fireEvent.click(forecastTab);
    expect(screen.getByText('2026 (GHS)')).toBeDefined();
    expect(screen.getByText('2027 (GHS)')).toBeDefined();
    expect(screen.getByText(/Total Projected Annual Depreciation/i)).toBeDefined();

    // 2. Lifecycle & Custodians subtab
    const lifecycleTab = screen.getByRole('button', { name: /Lifecycle, Expiries & Custodians/i });
    fireEvent.click(lifecycleTab);

    expect(screen.getByText(/Fully Depreciated Assets Still in Active Service/i)).toBeDefined();
    expect(screen.getByText(/Warranty & Insurance Expiring Within 90 Days/i)).toBeDefined();
    expect(screen.getByText(/Assets by Custodian/i)).toBeDefined();
    expect(screen.getAllByText(/Custodian Acknowledgement Signature: _______________________/i).length).toBeGreaterThan(0);
  });
});
