import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  default: 'border-border bg-surface text-text-primary',
  success: 'border-success/30 bg-success/10 text-text-primary',
  warning: 'border-warning/30 bg-warning/10 text-text-primary',
  error: 'border-error/30 bg-error/10 text-text-primary',
  info: 'border-brand-accent/30 bg-brand-accent/10 text-text-primary',
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
  error: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  info: <Info className="h-4 w-4" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Math.random().toString(36).slice(2, 10);
      const next: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'default',
        duration: input.duration ?? 5000,
      };

      setToasts((current) => [next, ...current].slice(0, 3));
      return id;
    },
    []
  );

  useEffect(() => {
    toasts.forEach((item) => {
      if (timers.current[item.id]) return;
      timers.current[item.id] = window.setTimeout(() => {
        dismiss(item.id);
      }, item.duration);
    });

    return () => {
      Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
      timers.current = {};
    };
  }, [toasts, dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed right-4 top-4 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-3">
              {toasts.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'animate-slide-up rounded-2xl border px-4 py-3 shadow-card backdrop-blur-xl',
                    variantStyles[item.variant]
                  )}
                  role={item.variant === 'error' ? 'alert' : 'status'}
                  aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-primary/60 text-text-primary">
                      {variantIcons[item.variant]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                      {item.description ? (
                        <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/60 text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

