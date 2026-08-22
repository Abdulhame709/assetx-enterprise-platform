'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/** Modal/Dialog — accessible overlay dialog with focus + ESC handling. */
export function Modal({ open, onClose, title, children, footer, size = 'md', closeLabel = 'Close' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={cn('ax-card relative z-10 my-auto flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden p-5 shadow-pop sm:max-h-[calc(100dvh-2rem)]', sizes[size])}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button className="rounded-lg p-1 text-ink-faint hover:bg-surface-muted hover:text-ink" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pe-1 text-sm text-ink">{children}</div>
        {footer && <div className="mt-5 flex shrink-0 justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
