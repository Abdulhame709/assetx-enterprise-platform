'use client';

import { ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

/** Switch — on/off setting that applies immediately (role="switch"). Direction-aware. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className={cn('flex items-start justify-between gap-3', disabled && 'opacity-60', className)}>
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-ink">{label}</p>
        {description && <p id={descId} className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed',
          checked ? 'border-brand bg-brand' : 'border-line bg-surface-muted',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-button transition-[inset-inline-start] duration-200',
            checked ? 'start-[1.375rem]' : 'start-0.5',
          )}
        />
      </button>
    </div>
  );
}
