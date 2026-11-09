import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  icon?: React.ReactNode;
  action?: ToastAction;
  duration?: number; // ms, default 5000
  type?: 'neutral' | 'success' | 'warning' | 'error';
}

export interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'> | string, type?: ToastItem['type']) => string;
  show: (toast: Omit<ToastItem, 'id'> | string, type?: ToastItem['type']) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; remaining: number; startedAt: number }>>(
    new Map()
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timersRef.current.delete(timer.timeoutId as any);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'> | string, type?: ToastItem['type']) => {
      const itemConfig = typeof toast === 'string' ? { message: toast, type: type || 'neutral' } : toast;
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = itemConfig.duration ?? 5000;
      const item: ToastItem = { ...itemConfig, id, duration };

      setToasts((prev) => [...prev, item]);

      const timeoutId = setTimeout(() => {
        dismissToast(id);
      }, duration);

      timersRef.current.set(id, {
        timeoutId,
        remaining: duration,
        startedAt: Date.now(),
      });

      return id;
    },
    [dismissToast]
  );

  const handleMouseEnter = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      const elapsed = Date.now() - timer.startedAt;
      timer.remaining = Math.max(0, timer.remaining - elapsed);
    }
  };

  const handleMouseLeave = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer && timer.remaining > 0) {
      timer.startedAt = Date.now();
      timer.timeoutId = setTimeout(() => {
        dismissToast(id);
      }, timer.remaining);
    } else if (timer) {
      dismissToast(id);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, show: showToast, dismissToast }}>
      {children}

      {/* Floating Bottom-Left Toast Container */}
      <div
        className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none"
        aria-label="Notifications"
        role="region"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          let defaultIcon = null;
          if (toast.type === 'success') {
            defaultIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'warning') {
            defaultIcon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
          } else if (toast.type === 'error') {
            defaultIcon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
          } else if (toast.type === 'neutral') {
            defaultIcon = <Info className="w-4 h-4 text-slate-300 shrink-0" />;
          }

          const icon = toast.icon ?? defaultIcon;

          return (
            <div
              key={toast.id}
              onMouseEnter={() => handleMouseEnter(toast.id)}
              onMouseLeave={() => handleMouseLeave(toast.id)}
              className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[6px] bg-[#1c1917] text-[#f5f5f4] dark:bg-[#292524] dark:text-[#f5f5f4] border border-[#2e2a27] dark:border-[#3c3733] shadow-lg text-xs leading-normal animate-fadeIn"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {icon}
                <span className="truncate">{toast.message}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="text-xs font-semibold text-white underline hover:opacity-90"
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-slate-400 hover:text-white p-0.5"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
