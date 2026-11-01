/**
 * DemoContext.
 * Coordinates the one-click Demo Mode sandbox toggle in the header.
 * Instantly loads 300 Ghanaian church members and 6 months of balanced transactions
 * for demonstration, training, and testing without altering live production data.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  generate300Members,
  generate6MonthsLedger,
  type DemoDataset,
} from '@church/domain';
import { useAuth } from './AuthContext.js';

export interface DemoContextValue {
  readonly isDemoMode: boolean;
  readonly toggleDemoMode: () => void;
  readonly demoDataset: DemoDataset;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('church_demo_mode') === 'true';
  });

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      localStorage.setItem('church_demo_mode', String(next));
      return next;
    });
  }, []);

  const demoDataset = useMemo(() => {
    const members = generate300Members(currentUser.branchId);
    return generate6MonthsLedger(currentUser.branchId, members);
  }, [currentUser.branchId]);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        demoDataset,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) {
    return {
      isDemoMode: false,
      toggleDemoMode: () => {},
      demoDataset: {
        members: [],
        pledges: [],
        givingRecords: [],
        countingSheets: [],
        entries: [],
      },
    };
  }
  return context;
}
