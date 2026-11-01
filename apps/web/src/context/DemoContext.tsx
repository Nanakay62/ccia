/**
 * DemoContext.
 * Implements Section 5 (DEMO MODE) of the Church Accounting System specification.
 * 
 * Features:
 * - Strict database partition between live records ('church_live_*') and training sandbox ('church_demo_*')
 * - Realistic Ghanaian church dataset: Christ Church of Grace, Adabraka (300 members, 6 months transactions)
 * - Open action items: 2 pending requisitions, 1 unsigned counting sheet, 1 deliberate 20p Doctor discrepancy
 * - Reset Demo Data: Restores the sandbox database cleanly
 * - Exit Demo Safeguard: Confirmation dialog if changes were made in the sandbox
 * - Walkthrough Wizard state: Track dismissal and active guided tasks
 */

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import {
  generateDemoSandboxData,
  type DemoDataset,
} from '@church/domain';
import { useAuth } from './AuthContext.js';
import { clearDemoDatabase } from '../utils/database.js';

export type GuidedTask = 'counting' | 'expenses' | 'doctor';

export interface DemoContextValue {
  readonly isDemoMode: boolean;
  readonly demoResetKey: number;
  readonly isWizardDismissed: boolean;
  readonly activeGuideTask: GuidedTask | null;
  readonly isExitConfirmOpen: boolean;
  readonly isResetConfirmOpen: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly demoDataset: Required<DemoDataset>;
  readonly toggleDemoMode: () => void;
  readonly enterDemoMode: () => void;
  readonly requestExitDemoMode: () => void;
  readonly confirmExitDemoMode: () => void;
  readonly cancelExitDemoMode: () => void;
  readonly requestResetDemoData: () => void;
  readonly confirmResetDemoData: () => void;
  readonly cancelResetDemoData: () => void;
  readonly dismissWizard: () => void;
  readonly restoreWizard: () => void;
  readonly markDemoChanged: () => void;
  readonly startGuideTask: (task: GuidedTask) => void;
  readonly clearGuideTask: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') return true;
    return localStorage.getItem('church_demo_mode') === 'true';
  });

  const [demoResetKey, setDemoResetKey] = useState<number>(0);

  const [isWizardDismissed, setIsWizardDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('church_demo_wizard_dismissed') === 'true';
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [activeGuideTask, setActiveGuideTask] = useState<GuidedTask | null>(null);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  // Sync demo mode class on body for diagonal print watermark (Section 5.3)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('demo-mode-active', isDemoMode);
    }
  }, [isDemoMode]);

  // Generate pristine demo dataset (300 members, 6 months transactions, open action items)
  const demoDataset = useMemo(() => {
    return generateDemoSandboxData(currentUser.branchId || '00000000-0000-0000-0000-000000000001');
  }, [currentUser.branchId, demoResetKey]);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    localStorage.setItem('church_demo_mode', 'true');
  }, []);

  const requestExitDemoMode = useCallback(() => {
    if (hasUnsavedChanges) {
      setIsExitConfirmOpen(true);
    } else {
      setIsDemoMode(false);
      localStorage.setItem('church_demo_mode', 'false');
      setActiveGuideTask(null);
    }
  }, [hasUnsavedChanges]);

  const confirmExitDemoMode = useCallback(() => {
    setIsExitConfirmOpen(false);
    setHasUnsavedChanges(false);
    setIsDemoMode(false);
    localStorage.setItem('church_demo_mode', 'false');
    setActiveGuideTask(null);
  }, []);

  const cancelExitDemoMode = useCallback(() => {
    setIsExitConfirmOpen(false);
  }, []);

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) {
      requestExitDemoMode();
    } else {
      enterDemoMode();
    }
  }, [isDemoMode, requestExitDemoMode, enterDemoMode]);

  const requestResetDemoData = useCallback(() => {
    setIsResetConfirmOpen(true);
  }, []);

  const confirmResetDemoData = useCallback(() => {
    clearDemoDatabase();
    setHasUnsavedChanges(false);
    setIsResetConfirmOpen(false);
    setActiveGuideTask(null);
    setDemoResetKey((k) => k + 1);
  }, []);

  const cancelResetDemoData = useCallback(() => {
    setIsResetConfirmOpen(false);
  }, []);

  const dismissWizard = useCallback(() => {
    setIsWizardDismissed(true);
    localStorage.setItem('church_demo_wizard_dismissed', 'true');
  }, []);

  const restoreWizard = useCallback(() => {
    setIsWizardDismissed(false);
    localStorage.removeItem('church_demo_wizard_dismissed');
  }, []);

  const markDemoChanged = useCallback(() => {
    if (isDemoMode) {
      setHasUnsavedChanges(true);
    }
  }, [isDemoMode]);

  const startGuideTask = useCallback((task: GuidedTask) => {
    setActiveGuideTask(task);
  }, []);

  const clearGuideTask = useCallback(() => {
    setActiveGuideTask(null);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoResetKey,
        isWizardDismissed,
        activeGuideTask,
        isExitConfirmOpen,
        isResetConfirmOpen,
        hasUnsavedChanges,
        demoDataset,
        toggleDemoMode,
        enterDemoMode,
        requestExitDemoMode,
        confirmExitDemoMode,
        cancelExitDemoMode,
        requestResetDemoData,
        confirmResetDemoData,
        cancelResetDemoData,
        dismissWizard,
        restoreWizard,
        markDemoChanged,
        startGuideTask,
        clearGuideTask,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

let _cachedFallbackDataset: Required<DemoDataset> | null = null;
function getFallbackDemoDataset(): Required<DemoDataset> {
  if (!_cachedFallbackDataset) {
    _cachedFallbackDataset = generateDemoSandboxData('00000000-0000-0000-0000-000000000001');
  }
  return _cachedFallbackDataset;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) {
    return {
      isDemoMode: false,
      demoResetKey: 0,
      isWizardDismissed: false,
      activeGuideTask: null,
      isExitConfirmOpen: false,
      isResetConfirmOpen: false,
      hasUnsavedChanges: false,
      demoDataset: getFallbackDemoDataset(),
      toggleDemoMode: () => {},
      enterDemoMode: () => {},
      requestExitDemoMode: () => {},
      confirmExitDemoMode: () => {},
      cancelExitDemoMode: () => {},
      requestResetDemoData: () => {},
      confirmResetDemoData: () => {},
      cancelResetDemoData: () => {},
      dismissWizard: () => {},
      restoreWizard: () => {},
      markDemoChanged: () => {},
      startGuideTask: () => {},
      clearGuideTask: () => {},
    };
  }
  return context;
}
