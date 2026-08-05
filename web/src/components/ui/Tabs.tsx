'use client';

/**
 * Reusable Tabs (Phase UX-1) — accessible tablist with keyboard arrow support.
 */
import { ReactNode, useRef } from 'react';
import { cn } from '@/lib/cn';

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
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const dir = (e.key === 'ArrowRight' && 1) || (e.key === 'ArrowLeft' && -1) || 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + items.length) % items.length;
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
