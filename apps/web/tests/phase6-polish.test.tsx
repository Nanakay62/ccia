import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../src/context/AuthContext.js';
import { DemoProvider } from '../src/context/DemoContext.js';
import { useModalEscape } from '../src/utils/useModalEscape.js';
import { EmptyState } from '../src/components/ui/EmptyState.js';
import {
  USER_MANUAL_CHAPTERS,
  generateUserManualHtml,
} from '../src/utils/exports/userManualGenerator.js';
import { UserManualModal } from '../src/components/manual/UserManualModal.js';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DemoProvider>{children}</DemoProvider>
  </AuthProvider>
);

// Test component for useModalEscape hook
const TestModalWithEscape: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  useModalEscape(isOpen, onClose);
  if (!isOpen) return null;
  return <div data-testid="test-modal">Modal Open</div>;
};

describe('Phase 6: Accessibility, Polish & Platform User Manual Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Keyboard Navigation: Escape Key Modal Dismissal', () => {
    it('calls onClose when Escape key is pressed while modal is open', () => {
      const handleClose = vi.fn();
      render(<TestModalWithEscape isOpen={true} onClose={handleClose} />);

      expect(screen.getByTestId('test-modal')).toBeDefined();

      // Trigger Escape key
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when a key other than Escape is pressed', () => {
      const handleClose = vi.fn();
      render(<TestModalWithEscape isOpen={true} onClose={handleClose} />);

      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not attach escape handler or trigger when modal is closed', () => {
      const handleClose = vi.fn();
      render(<TestModalWithEscape isOpen={false} onClose={handleClose} />);

      expect(screen.queryByTestId('test-modal')).toBeNull();
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('2. Standard Empty States (One Sentence + One Action Button)', () => {
    it('renders clean EmptyState with single sentence and action button', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          message="No expenditure requisitions submitted yet."
          actionLabel="Submit Requisition"
          onAction={onAction}
        />
      );

      expect(
        screen.getByText('No expenditure requisitions submitted yet.')
      ).toBeDefined();
      const button = screen.getByRole('button', { name: /Submit Requisition/i });
      expect(button).toBeDefined();

      fireEvent.click(button);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Platform User Manual Generator (Word & PDF Guides)', () => {
    it('defines all 11 required user manual chapters with full content', () => {
      expect(USER_MANUAL_CHAPTERS.length).toBe(11);

      const chapterIds = USER_MANUAL_CHAPTERS.map((ch) => ch.id);
      expect(chapterIds).toContain('overview');
      expect(chapterIds).toContain('roles');
      expect(chapterIds).toContain('dashboard');
      expect(chapterIds).toContain('counting');
      expect(chapterIds).toContain('giving');
      expect(chapterIds).toContain('expenses');
      expect(chapterIds).toContain('ledger');
      expect(chapterIds).toContain('payroll');
      expect(chapterIds).toContain('reports');
      expect(chapterIds).toContain('demo');
      expect(chapterIds).toContain('offline');
    });

    it('generates complete official HTML document with church letterhead and chapters', () => {
      const html = generateUserManualHtml(false);
      expect(html).toContain('ACCRA CENTRAL GRACE CHAPEL');
      expect(html).toContain('Double-Entry Accounting Invariant');
      expect(html).toContain('Ghana Withholding Tax (WHT)');
      expect(html).toContain('Ghana SSNIT Tier 1 Pension Compliance');
      expect(html).toContain('Trial Balance Doctor');
      expect(html).toContain('Table of Contents');
      expect(html).toContain('Prepared & Certified By:');
    });

    it('renders interactive UserManualModal with chapter navigation and download buttons', () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <UserManualModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Verify modal header and version tag
      expect(
        screen.getByText(/CCIA Church Accounting Platform — User Manual/i)
      ).toBeDefined();
      expect(screen.getByText('v2.0 GHS/USD')).toBeDefined();

      // Verify export buttons
      expect(screen.getByText(/Word Guide \(\.doc\)/i)).toBeDefined();
      expect(screen.getByText(/Print \/ PDF Guide/i)).toBeDefined();
      expect(screen.getByText(/Download PDF/i)).toBeDefined();

      // Verify chapter 1 is rendered by default
      expect(
        screen.getAllByText(/System Overview & Core Accounting Architecture/i).length
      ).toBeGreaterThan(0);

      // Search functionality
      const searchInput = screen.getByPlaceholderText(/Search manual topics\.\.\./i);
      fireEvent.change(searchInput, { target: { value: 'Withholding Tax' } });

      // Expenditure chapter should match search
      expect(
        screen.getByText(/Expenditure Management, Vouchers & Ghana WHT/i)
      ).toBeDefined();
    });
  });
});
