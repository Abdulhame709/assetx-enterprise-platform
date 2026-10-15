'use client';

import { ReactNode, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional trailing count (already formatted). */
  count?: string;
}

/**
 * SegmentedControl — mutually exclusive view/filter switch (role="radiogroup").
 * Arrow keys follow the visual direction, so they work the same in RTL.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const { dir } = useI18n();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = (event.key === forward && 1) || (event.key === backward && -1) || 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface-muted p-0.5', className)}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => { refs.current[option.value] = element; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              active ? 'bg-surface text-ink shadow-button' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-brand-soft text-brand' : 'bg-line/60 text-ink-muted')}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
