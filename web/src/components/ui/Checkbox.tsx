'use client';

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** Visible label. Omit for a bare box (give it an aria-label instead). */
  label?: ReactNode;
  description?: ReactNode;
  /** "card" draws the label as a bordered, clickable tile (role pickers, option grids). */
  variant?: 'plain' | 'card';
};

const box =
  'h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed';

/** Checkbox — a choice that is saved with the form (use Switch for settings that apply immediately). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, variant = 'plain', className, disabled, ...props },
  ref,
) {
  if (label === undefined) {
    return <input ref={ref} type="checkbox" disabled={disabled} className={cn(box, className)} {...props} />;
  }
  return (
    <label
      className={cn(
        'flex items-start gap-2 text-sm text-ink',
        variant === 'card' && 'cursor-pointer items-center rounded-lg border border-line bg-surface-raised px-3 py-2 transition-colors hover:bg-surface-muted',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input ref={ref} type="checkbox" disabled={disabled} className={cn(box, variant === 'plain' && 'mt-0.5')} {...props} />
      <span className="min-w-0">
        {label}
        {description && <span className="block text-xs text-ink-faint">{description}</span>}
      </span>
    </label>
  );
});
