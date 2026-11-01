import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
const SyncContext = createContext(undefined);
export const SyncProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(() => {
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingUploadCount, setPendingUploadCount] = useState(3); // Sample pending offline queue
    const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date(Date.now() - 1000 * 60 * 2)); // 2 mins ago
    const [rejections, setRejections] = useState([
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
    const simulateRejection = useCallback((reason) => {
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
    const dismissRejection = useCallback((id) => {
        setRejections((prev) => prev.filter((r) => r.id !== id));
    }, []);
    return (_jsx(SyncContext.Provider, { value: {
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
        }, children: children }));
};
export function useSync() {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}
