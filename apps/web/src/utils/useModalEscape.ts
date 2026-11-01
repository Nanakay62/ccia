/**
 * Keyboard navigation utility for modals and dialogs.
 * Listens for Escape key to cleanly dismiss open modals,
 * satisfying Section 9 (Phase 6: Keyboard pass: Escape to close modals).
 */

import { useEffect } from 'react';

export function useModalEscape(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}
