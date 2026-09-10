import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 5000 }: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2, 9);
      const newToast: Toast = { id, type, title, message, durationMs };

      setToasts((prev) => [...prev, newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          removeToast(id);
        }, durationMs);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'success', title: title || 'Success', message });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'error', title: title || 'Error', message });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'info', title: title || 'Information', message });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, info, removeToast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="assertive"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-xl p-4 shadow-2xl border backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3',
              toast.type === 'success' &&
                'bg-emerald-950/90 border-emerald-800/80 text-emerald-100',
              toast.type === 'error' &&
                'bg-rose-950/90 border-rose-800/80 text-rose-100',
              toast.type === 'info' &&
                'bg-slate-900/90 border-slate-700/80 text-slate-100'
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="h-5 w-5 text-rose-400" />
              )}
              {toast.type === 'info' && (
                <Info className="h-5 w-5 text-indigo-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="text-xs font-semibold tracking-wide uppercase opacity-90">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs mt-0.5 leading-relaxed font-normal opacity-95 break-words">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 hover:bg-black/20 transition-opacity"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
};
