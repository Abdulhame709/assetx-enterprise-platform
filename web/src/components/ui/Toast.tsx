'use client';

/**
 * Toast framework (Phase UX-1).
 * ToastProvider + useToast() returning { success, warning, error, info }.
 * Auto-dismissing, dismissible, ARIA-live, reusable across all modules.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'warning' | 'error' | 'info';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" />,
  error: <XCircle className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-info" />,
};

const TONE_BORDER: Record<ToastTone, string> = {
  success: 'border-s-success',
  warning: 'border-s-warning',
  error: 'border-s-danger',
  info: 'border-s-info',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((tone: ToastTone, title: string, description?: string) => {
    // Duplicate prevention: if the same tone+title is already visible, refresh it
    // instead of stacking a duplicate.
    setToasts((prev) => {
      const existing = prev.find((t) => t.tone === tone && t.title === title);
      if (existing) {
        // reset its auto-dismiss timer
        const old = timers.current.get(existing.id);
        if (old) clearTimeout(old);
        timers.current.set(existing.id, setTimeout(() => dismiss(existing.id), 5000));
        return prev.map((t) => (t.id === existing.id ? { ...t, description: description ?? t.description } : t));
      }
      const id = nextId++;
      const timer = setTimeout(() => dismiss(id), 5000);
      timers.current.set(id, timer);
      return [...prev.slice(-4), { id, tone, title, description }];
    });
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (t, d) => push('success', t, d),
    warning: (t, d) => push('warning', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed end-4 top-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border border-line border-s-4 bg-surface-overlay p-3 shadow-pop',
              TONE_BORDER[t.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_ICON[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && <p className="text-xs text-ink-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 text-ink-faint hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
