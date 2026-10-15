'use client';

/**
 * Reusable Tabs (Phase UX-1) — accessible tablist with keyboard arrow support.
 */
import { ReactNode, useRef } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  const { dir } = useI18n();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    // Arrow keys follow the visual direction: in RTL, ArrowLeft moves to the next tab.
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = (e.key === forward && 1) || (e.key === backward && -1) || 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + items.length) % items.length;
    onChange(items[next].id);
    refs.current[items[next].id]?.focus();
  };

  return (
    <div role="tablist" className={cn('flex flex-wrap gap-1 border-b border-line', className)}>
      {items.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, i)}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            value === t.id ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
