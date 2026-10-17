'use client';

import { Children, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/cn';

/** Field wrapper — label + hint + control + error. A single control child is linked to the label, hint and error automatically. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>) : null;
  const controlId = only?.props.id ?? autoId;
  const noteId = `${controlId}-note`;
  const hasNote = Boolean(error || hint);
  const control = only
    ? cloneElement(only, {
        id: controlId,
        'aria-describedby': [only.props['aria-describedby'], hasNote ? noteId : null].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : only.props['aria-invalid'],
      })
    : children;
  return (
    <div className={cn('space-y-1', className)}>
      {label && <label className="ax-label" htmlFor={only ? controlId : undefined}>{label}</label>}
      {control}
      {error ? <p id={noteId} role="alert" className="text-xs text-danger">{error}</p> : hint ? <p id={noteId} className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('ax-input', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('ax-input min-h-[80px]', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('ax-select', className)} {...props}>
      {children}
    </select>
  );
}
