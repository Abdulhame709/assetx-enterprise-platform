'use client';

/**
 * ConfirmDialog framework (Phase UX-1).
 * useConfirm() returns a promise-based confirm() so callers can do:
 *   const ok = await confirm({ title, message, tone: 'danger', confirmLabel: 'Dispose' });
 * Unifies confirmation for destructive/critical operations (delete, dispose,
 * archive, transfer, reset) across all modules.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmTone = 'default' | 'danger' | 'warning';

export interface ConfirmOptions {
  title: string;
  message: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions & { open: boolean } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((s) => (s ? { ...s, open: false } : s));
    resolver.current?.(result);
    resolver.current = null;
    // allow fade then unmount
    setTimeout(() => setState(null), 150);
  }, []);

  const api = useMemo<ConfirmApi>(() => ({ confirm }), [confirm]);

  const confirmLabel = state?.confirmLabel ?? 'Confirm';
  const cancelLabel = state?.cancelLabel ?? 'Cancel';
  const isDanger = state?.tone === 'danger' || state?.tone === 'warning';

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state?.open && (
        <Modal
          open={state.open}
          onClose={() => close(false)}
          title={state.title}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>{cancelLabel}</Button>
              <Button variant={isDanger ? 'danger' : 'primary'} onClick={() => close(true)}>{confirmLabel}</Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <span className="shrink-0 rounded-full bg-warning/10 p-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-muted">{state.message}</p>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
