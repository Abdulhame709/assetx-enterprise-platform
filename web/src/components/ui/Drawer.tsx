'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the panel (visible title is up to the content). */
  label: string;
  children: ReactNode;
  /** Which edge the panel slides from. `start` follows the reading direction. */
  side?: 'start' | 'end';
  /** Show a close button in the panel corner. */
  showClose?: boolean;
  className?: string;
}

/**
 * Drawer — edge-anchored dialog (mobile navigation, side forms).
 * ESC closes, background scroll is locked, focus moves in and is restored on close.
 */
export function Drawer({ open, onClose, label, children, side = 'start', showClose = false, className }: DrawerProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus({ preventScroll: true });
      previousFocus.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="print-hide fixed inset-0 z-40">
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 max-w-[88vw] shadow-pop outline-none',
          side === 'start' ? 'start-0 animate-drawer-start' : 'end-0 animate-drawer-end',
          className,
        )}
      >
        <span id={titleId} className="sr-only">{label}</span>
        {children}
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="absolute end-2 top-2 rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
