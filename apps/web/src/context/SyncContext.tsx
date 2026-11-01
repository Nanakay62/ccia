import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SyncStatusState } from '../types/index.js';

interface SyncContextType extends SyncStatusState {
  toggleOnlineStatus: () => void;
  triggerSync: () => Promise<void>;
  simulateRejection: (reason: string) => void;
  dismissRejection: (id: string) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingUploadCount, setPendingUploadCount] = useState<number>(3); // Sample pending offline queue
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date(Date.now() - 1000 * 60 * 2)); // 2 mins ago
  const [rejections, setRejections] = useState<SyncStatusState['rejections']>([
    {
      id: 'rej-001',
      entityType: 'JOURNAL_ENTRY',
      reason: 'Validation failed: Closed period cannot receive new postings (Period: 2026-09).',
      rejectedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
  ]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleOnlineStatus = useCallback(() => {
    setIsOnline((prev) => !prev);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    setIsSyncing(true);
    // Simulate PowerSync upload connector & batch replication
    await new Promise((resolve) => setTimeout(resolve, 800));
    setPendingUploadCount(0);
    setLastSyncedAt(new Date());
    setIsSyncing(false);
  }, [isOnline]);

  const simulateRejection = useCallback((reason: string) => {
    setRejections((prev) => [
      ...prev,
      {
        id: `rej-${Date.now()}`,
        entityType: 'JOURNAL_ENTRY',
        reason,
        rejectedAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const dismissRejection = useCallback((id: string) => {
    setRejections((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingUploadCount,
        needsAttentionCount: rejections.length,
        lastSyncedAt,
        rejections,
        toggleOnlineStatus,
        triggerSync,
        simulateRejection,
        dismissRejection,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
